// Package service contains testkit-service business logic.
//
// Layering contract (see golang-service-development skill §2):
//   - This is the SERVICE ROOT. It holds Service struct + New + Start/Stop +
//     resource resolve helpers + one-line facade methods (one per RPC).
//   - Business logic lives in SUBPACKAGES (internal/service/<domain>/). This
//     file does NOT contain CRUD implementations — only delegations.
//   - handler calls service.X; service.X is a one-line facade that calls
//     s.<domain>.X in the subpackage. handler never imports the subpackage.
//   - Service methods take proto types DIRECTLY and return proto types — no
//     intermediate Go structs at any layer.
//   - Resources (db, redis, third-party services) are constructed here from
//     cfg (or injected via option) and passed to subpackage constructors. The
//     subpackages do NOT manage resource lifecycle — this Service does via
//     lifecycle.Manager.
//
// testkit is a single-process BFF: it embeds gid/message/storage/user-service
// in-process (mode=module) and shares one PG pool + one Redis client across
// them. The four handlers are built from cfg.ThirdParty (or injected), wired
// with the shared pools and the gid/message adapters (internal/adapter), and
// each registered with mgr as a lifecycle.Service so their background jobs
// (cron) start and stop with testkit. The shared pools are injected INTO the
// downstreams, so each downstream's own lifecycle.Manager never owns them —
// no double-close on shutdown.
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/servekit/go-common/cronx"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/lifecycle"
	"github.com/servekit/go-common/redisx"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/adapter"
	"github.com/servekit/testkit-service/internal/jobs"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service/auth"
	"github.com/servekit/testkit-service/internal/service/storage"
	"github.com/servekit/testkit-service/internal/service/user"
	"github.com/servekit/testkit-service/internal/version"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/option"
	"github.com/servekit/testkit-service/pkg/thirdcall"
)

// Service holds testkit-service business state: shared resources plus the four
// embedded downstream handlers.
//
// Resource fields (db, redis, gid/message/storage/user) are convenience
// references kept on the root Service — they point at the same instances
// tracked by mgr (when self-built) and injected into the embedded modules.
type Service struct {
	cfg   *config.Config
	mgr   *lifecycle.Manager
	redis *redis.Client
	db    *gorm.DB

	// The four embedded downstream handlers. Aliased types from pkg/thirdcall
	// (full downstream server method set + Start/Stop). nil only transiently
	// during New before resolveDownstreams completes.
	gid     thirdcall.GIDService
	message thirdcall.MessageService
	storage thirdcall.StorageService
	user    thirdcall.UserService

	// auth is the P1 auth domain (forward to user-service + issue JWT). Built
	// once the user handler is resolved and the JWT manager is constructed.
	auth *auth.Service

	// userSvc is the P2 user domain (profile / identity / session / social).
	// Named userSvc (not user) to avoid clashing with the thirdcall user
	// handler field above. Built once the user handler + JWT manager are ready.
	userSvc *user.Service

	// storageSvc is the P3 storage domain (my-files / upload / quota / audit /
	// admin). Named storageSvc (not storage) to avoid clashing with the thirdcall
	// storage handler field above. Built once the storage handler is resolved.
	storageSvc *storage.Service

	// startedAt is set once in New; Ping returns it for uptime.
	startedAt int64
}

// New constructs a Service from config and functional options.
//
// Resources not injected via options are created from cfg, wrapped as
// lifecycle.Stoppers/Services, and registered with the internal Manager. Stop
// will stop them in reverse order. Injected resources are NOT registered —
// caller owns their lifecycle.
//
// Resolve order: shared redis + db first, then gid → message → storage → user
// (each downstream depends on the adapters built from the earlier ones). On
// partial failure, already-registered components are stopped via mgr.Stop()
// before returning the error.
func New(cfg *config.Config, opts ...option.Option) (*Service, error) {
	o := option.Apply(opts...)
	mgr := lifecycle.NewManager()

	rdb, err := resolveRedis(cfg, o.Redis, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	db, err := resolveDB(cfg, o.DB, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}

	svc := &Service{
		cfg:       cfg,
		mgr:       mgr,
		redis:     rdb,
		db:        db,
		startedAt: time.Now().UnixMilli(),
	}

	// Embed the four downstreams in dependency order, wiring shared db/redis
	// and the gid/message adapters.
	if err := svc.resolveDownstreams(o); err != nil {
		return nil, rollback(mgr, err)
	}

	// Build the P1 auth domain: a JWT manager (testkit is the sole signer) plus
	// the auth service wired against the embedded user handler. The manager is
	// stateless (secret + ttl only), so it is not registered with mgr.
	jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
	if err != nil {
		return nil, rollback(mgr, fmt.Errorf("init jwt: %w", err))
	}
	svc.auth = auth.New(jwtMgr, auth.WithUserClient(svc.user))

	// Build the P2 user domain against the same embedded user handler + the
	// shared JWT manager (social login consumes the downstream session_id and
	// mints a testkit JWT, mirroring the auth domain's Login).
	svc.userSvc = user.New(svc.user, jwtMgr)

	// Build the P3 storage domain against the embedded storage handler. The
	// domain reads the caller's user_id from ctx (ownerFromCtx) for "my" RPCs
	// and forwards the flat target owner for admin/owner-quota RPCs; no JWT is
	// needed here (the interceptor already enforces login).
	svc.storageSvc = storage.New(svc.storage)

	// jobs.Scheduler owns the cron instance; setupJobs builds it, registers
	// it on mgr, and wires periodic jobs (empty by default — add jobs inside
	// setupJobs as scheduler.AddFunc calls). See architecture.md (jobs.md).
	if err := svc.setupJobs(); err != nil {
		return nil, rollback(mgr, err)
	}

	return svc, nil
}

// Start starts all owned components concurrently.
func (s *Service) Start() error { return s.mgr.Start() }

// Stop stops all owned components in reverse registration order.
func (s *Service) Stop() error { return s.mgr.Stop() }

// Ping is a health-check RPC, always generated so the grpc-gateway has at
// least one HTTP endpoint and pkg/server.go can always register the handler.
// Returns only public, non-sensitive info — never internal addresses, env,
// secrets, or dependency topology.
func (s *Service) Ping(_ context.Context) (*testkitv1.Pong, error) {
	v := version.Get()
	return &testkitv1.Pong{
		Service:   "testkit-service",
		Version:   v.Version,
		GitCommit: v.GitCommit,
		GitBranch: v.GitBranch,
		BuildTime: v.BuildTime,
		GoVersion: v.GoVersion,
		Status:    "SERVING",
		Now:       time.Now().UnixMilli(),
		StartedAt: s.startedAt,
	}, nil
}

// --- accessors for handler / server / future domains ---

// DB returns the shared PostgreSQL pool. Used by the unified migrator
// (cmd/server) and future domains.
func (s *Service) DB() *gorm.DB { return s.db }

// GIDHandler returns the embedded gid-service handler.
func (s *Service) GIDHandler() thirdcall.GIDService { return s.gid }

// MessageHandler returns the embedded message-service handler.
func (s *Service) MessageHandler() thirdcall.MessageService { return s.message }

// StorageHandler returns the embedded storage-service handler.
func (s *Service) StorageHandler() thirdcall.StorageService { return s.storage }

// UserHandler returns the embedded user-service handler. The auth domain
// (internal/service/auth) and the auth interceptor (pkg/auth) call RPC methods
// on it — GetSession for session→user_id resolution, Login/Register/... for
// the auth RPCs.
func (s *Service) UserHandler() thirdcall.UserService { return s.user }

// Auth returns the P1 auth domain (forward to user-service + issue JWT). The
// handler delegates the auth RPCs to it.
func (s *Service) Auth() *auth.Service { return s.auth }

// User returns the P2 user domain (profile / identity / session / social). The
// handler delegates the self-service user RPCs to it.
func (s *Service) User() *user.Service { return s.userSvc }

// Storage returns the P3 storage domain (my-files / upload / quota / audit /
// admin). The handler delegates the storage RPCs to it.
func (s *Service) Storage() *storage.Service { return s.storageSvc }

// --- internal helpers ---

// resolveDownstreams builds the four embedded modules in dependency order and
// registers each self-built handler with mgr as a lifecycle.Service (each
// downstream *handler.Handler satisfies Start/Stop, so its background jobs
// start/stop with testkit). Injected handlers (option.WithX) are used as-is
// and NOT registered — caller owns them. The gid and message adapters are
// built once from the resolved handlers and shared across the downstreams that
// need them.
func (s *Service) resolveDownstreams(o option.Options) error {
	// 1. gid (no upstream deps).
	gidHdl, err := resolveGID(s.cfg, o.GID, s.mgr)
	if err != nil {
		return err
	}
	s.gid = gidHdl
	gidAdapter := adapter.NewGIDAdapter(gidHdl)

	// 2. message (depends on gid).
	msgHdl, err := resolveMessage(s.cfg, o.Message, s.db, s.redis, gidAdapter, s.mgr)
	if err != nil {
		return err
	}
	s.message = msgHdl
	msgAdapter := adapter.NewMessageAdapter(msgHdl)

	// 3. storage (depends on gid).
	stHdl, err := resolveStorage(s.cfg, o.Storage, s.db, s.redis, gidAdapter, s.mgr)
	if err != nil {
		return err
	}
	s.storage = stHdl

	// 4. user (depends on gid + message).
	usrHdl, err := resolveUser(s.cfg, o.User, s.db, s.redis, gidAdapter, msgAdapter, s.mgr)
	if err != nil {
		return err
	}
	s.user = usrHdl
	return nil
}

// resolveGID returns the gid handler to use. Injected → as-is (caller owns).
// Otherwise built from cfg.ThirdParty.GID and registered with mgr.
func resolveGID(cfg *config.Config, injected thirdcall.GIDService, mgr *lifecycle.Manager) (thirdcall.GIDService, error) {
	if injected != nil {
		return injected, nil
	}
	hdl, err := thirdcall.NewGIDService(cfg.ThirdParty.GID)
	if err != nil {
		return nil, fmt.Errorf("init gid: %w", err)
	}
	mgr.Add("gid", hdl)
	return hdl, nil
}

// resolveMessage returns the message handler to use. Injected → as-is.
// Otherwise built with the shared pools + gid adapter and registered with mgr.
func resolveMessage(cfg *config.Config, injected thirdcall.MessageService, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter, mgr *lifecycle.Manager) (thirdcall.MessageService, error) {
	if injected != nil {
		return injected, nil
	}
	hdl, err := thirdcall.NewMessageService(cfg.ThirdParty.Message, db, rdb, gid)
	if err != nil {
		return nil, fmt.Errorf("init message: %w", err)
	}
	mgr.Add("message", hdl)
	return hdl, nil
}

// resolveStorage returns the storage handler to use. Injected → as-is.
// Otherwise built with the shared pools + gid adapter and registered with mgr.
func resolveStorage(cfg *config.Config, injected thirdcall.StorageService, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter, mgr *lifecycle.Manager) (thirdcall.StorageService, error) {
	if injected != nil {
		return injected, nil
	}
	hdl, err := thirdcall.NewStorageService(cfg.ThirdParty.Storage, db, rdb, gid)
	if err != nil {
		return nil, fmt.Errorf("init storage: %w", err)
	}
	mgr.Add("storage", hdl)
	return hdl, nil
}

// resolveUser returns the user handler to use. Injected → as-is. Otherwise
// built with the shared pools + gid/message adapters and registered with mgr.
func resolveUser(cfg *config.Config, injected thirdcall.UserService, db *gorm.DB, rdb *redis.Client, gid *adapter.GIDAdapter, msg *adapter.MessageAdapter, mgr *lifecycle.Manager) (thirdcall.UserService, error) {
	if injected != nil {
		return injected, nil
	}
	hdl, err := thirdcall.NewUserService(cfg.ThirdParty.User, db, rdb, gid, msg)
	if err != nil {
		return nil, fmt.Errorf("init user: %w", err)
	}
	mgr.Add("user", hdl)
	return hdl, nil
}

// setupJobs builds the jobs.Scheduler, registers it on s.mgr, and wires
// periodic jobs. Signature is intentionally receiver-only: future jobs are
// added inside this method as scheduler.AddFunc calls. Timezone default lives
// in config.CronConfig's default tag.
func (s *Service) setupJobs() error {
	scheduler, err := jobs.New(&jobs.Deps{
		Config: &cronx.Config{
			Timezone:      s.cfg.Cron.Timezone,
			OverlapPolicy: "skip",
		},
	})
	if err != nil {
		return fmt.Errorf("init jobs: %w", err)
	}
	s.mgr.Add("jobs", scheduler)
	return nil
}

// resolveDB returns the *gorm.DB to use. If the caller injected one via
// WithDB, it's returned as-is (caller owns lifecycle). Otherwise a new one is
// built from cfg.Database and registered with mgr as a Stopper.
func resolveDB(cfg *config.Config, injected *gorm.DB, mgr *lifecycle.Manager) (*gorm.DB, error) {
	if injected != nil {
		return injected, nil
	}
	db, err := dbx.New(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	mgr.AddStopper("db", lifecycle.StopFunc(func() {
		sqlDB, err := db.DB()
		if err != nil {
			slog.Warn("get sql db for close", "error", err)
			return
		}
		if err := sqlDB.Close(); err != nil {
			slog.Warn("close db", "error", err)
		}
	}))
	return db, nil
}

// resolveRedis returns the *redis.Client to use. If the caller injected one
// via WithRedis, it's returned as-is (caller owns lifecycle). Otherwise a new
// one is built from cfg.Redis and registered with mgr as a Stopper.
func resolveRedis(cfg *config.Config, injected *redis.Client, mgr *lifecycle.Manager) (*redis.Client, error) {
	if injected != nil {
		return injected, nil
	}
	rdb, err := redisx.New(cfg.Redis)
	if err != nil {
		return nil, fmt.Errorf("init redis: %w", err)
	}
	mgr.AddStopper("redis", lifecycle.StopFunc(func() {
		if err := rdb.Close(); err != nil {
			slog.Warn("close redis", "error", err)
		}
	}))
	return rdb, nil
}

// rollback stops all components registered so far and joins the stop error
// with the triggering error. Used by New on partial failure.
func rollback(mgr *lifecycle.Manager, err error) error {
	if cerr := mgr.Stop(); cerr != nil {
		return errors.Join(err, fmt.Errorf("rollback: %w", cerr))
	}
	return err
}
