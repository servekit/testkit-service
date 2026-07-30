// Package service resource initialization + dependency injection. All resources
// (db, redis, the four embedded downstreams) are instantiated here from cfg and
// wired into the domain subpackages via their constructors. testkit is a terminal
// service, so nothing is injectable — there is no option/owns-from-parent path.
// Consequently owns is always true at every thirdcall NewModule call site here;
// the false (borrowed) branch in each module.go exists only for pattern parity
// with user-service and is unreachable in this service.
// Lifecycle follows user-service: each downstream is registered as a Stopper
// whose stop calls Close() (Handler.Stop for module, conn.Close for grpc). This
// is Stopper-only — mgr.AddStopper does NOT invoke Start(), so an embedded
// downstream's internal cron never runs under testkit. That's fine today (all
// four downstreams ship empty cron schedulers), but it's a load-bearing
// assumption: if any downstream gains a scheduled job, register its raw
// *Handler with mgr.Add (not AddStopper) so Start() runs.
//
// Resolve order: shared redis+db → gid → message → storage → user (each
// downstream shares the raw handlers of its upstreams in module mode). On
// partial failure, already-registered components are stopped via mgr.Stop().
package service

import (
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	gidservice "github.com/servekit/gid-service/pkg"
	gidconfig "github.com/servekit/gid-service/pkg/config"
	"github.com/servekit/go-common/cronx"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/lifecycle"
	"github.com/servekit/go-common/redisx"
	messageservice "github.com/servekit/message-service/pkg"
	messageconfig "github.com/servekit/message-service/pkg/config"
	messageoption "github.com/servekit/message-service/pkg/option"
	storageservice "github.com/servekit/storage-service/pkg"
	storageconfig "github.com/servekit/storage-service/pkg/config"
	stoption "github.com/servekit/storage-service/pkg/option"
	userservice "github.com/servekit/user-service/pkg"
	userconfig "github.com/servekit/user-service/pkg/config"
	usroption "github.com/servekit/user-service/pkg/option"

	"github.com/servekit/testkit-service/internal/jobs"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	"github.com/servekit/testkit-service/internal/service/user"
	thirdcallgid "github.com/servekit/testkit-service/internal/thirdcall/gid"
	thirdcallmessage "github.com/servekit/testkit-service/internal/thirdcall/message"
	thirdcallstorage "github.com/servekit/testkit-service/internal/thirdcall/storage"
	thirdcalluser "github.com/servekit/testkit-service/internal/thirdcall/user"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/xcodes"
)

// New constructs a Service from config. All resources are self-built from cfg
// and registered with the internal Manager; Stop stops them in reverse order.
// Resolve order: shared redis + db → gid → message → storage → user. On partial
// failure, already-registered components are stopped before returning the error.
func New(cfg *config.Config) (*Service, error) {
	mgr := lifecycle.NewManager()

	rdb, err := resolveRedis(cfg, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	db, err := resolveDB(cfg, mgr)
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

	// Embed the four downstreams in dependency order, wiring shared db/redis and
	// the raw upstream handlers down the chain (module mode only).
	gidSvc, gidRaw, err := resolveGID(cfg.ThirdParty.GID, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.gid = gidSvc

	msgSvc, msgRaw, err := resolveMessage(cfg.ThirdParty.Message, db, rdb, gidRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.message = msgSvc

	stSvc, err := resolveStorage(cfg.ThirdParty.Storage, db, rdb, gidRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.storage = stSvc

	usrSvc, err := resolveUser(cfg.ThirdParty.User, db, rdb, gidRaw, msgRaw, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.user = usrSvc

	// JWT manager (stateless; not registered with mgr).
	jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
	if err != nil {
		return nil, rollback(mgr, fmt.Errorf("init jwt: %w", err))
	}

	// P1 auth domain: forward to user-service + issue testkit JWT.
	svc.auth = auth.New(jwtMgr, auth.WithUserClient(usrSvc))

	// P2 user domain.
	svc.userSvc = user.New(usrSvc, jwtMgr)

	// P3 storage domain.
	svc.storageSvc = storage.New(stSvc)

	// P4 message domain. sender_id is a service label injected on every Send —
	// fail fast on empty rather than sending with a blank label.
	if cfg.Message.SenderID == "" {
		return nil, rollback(mgr, xcodes.ErrSenderNotConfigured.New())
	}
	svc.messageSvc = message.New(msgSvc, message.WithSenderID(cfg.Message.SenderID))

	// P5 gid + dashboard domains.
	svc.gidSvc = gidsvc.New(gidSvc)
	svc.dashboardSvc = dashboardsvc.New(usrSvc, stSvc, msgSvc)

	if err := svc.setupJobs(); err != nil {
		return nil, rollback(mgr, err)
	}
	return svc, nil
}

// resolveGID returns testkit's GIDService and, in module mode, the raw
// *gidservice.Handler so module-mode downstreams can share it. grpc mode
// returns a nil raw (no in-process Handler to share).
func resolveGID(cfg *config.RemoteServiceConfig[*gidconfig.Config], mgr *lifecycle.Manager) (thirdcallgid.GIDService, *gidservice.Handler, error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("third_party.gid: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, nil, fmt.Errorf("third_party.gid.target required when mode=grpc")
		}
		g, err := thirdcallgid.NewGRPC(cfg.Target)
		if err != nil {
			return nil, nil, fmt.Errorf("init gid-service: %w", err)
		}
		mgr.AddStopper("gid", lifecycle.StopFunc(func() {
			if err := g.Close(); err != nil {
				slog.Warn("close gid", "error", err)
			}
		}))
		return g, nil, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, nil, fmt.Errorf("third_party.gid: module config required")
		}
		hdl, err := gidservice.NewModule(cfg.Config)
		if err != nil {
			return nil, nil, fmt.Errorf("init gid-service: %w", err)
		}
		g := thirdcallgid.NewModule(hdl, true)
		mgr.AddStopper("gid", lifecycle.StopFunc(func() {
			if err := g.Close(); err != nil {
				slog.Warn("close gid", "error", err)
			}
		}))
		return g, hdl, nil
	default:
		return nil, nil, fmt.Errorf("third_party.gid: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveMessage returns testkit's MessageService and, in module mode, the raw
// *messageservice.Handler so module-mode user can share it. gidRaw (non-nil in
// module mode) is shared into message-service via WithGIDHandler. When gidRaw is
// nil (gid in grpc mode), it is NOT injected and message-service resolves its
// own gid upstream from its own config — matching user-service's behavior.
func resolveMessage(cfg *config.RemoteServiceConfig[*messageconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, mgr *lifecycle.Manager) (thirdcallmessage.MessageService, *messageservice.Handler, error) {
	if cfg == nil {
		return nil, nil, fmt.Errorf("third_party.message: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, nil, fmt.Errorf("third_party.message.target required when mode=grpc")
		}
		m, err := thirdcallmessage.NewGRPC(cfg.Target)
		if err != nil {
			return nil, nil, fmt.Errorf("init message-service: %w", err)
		}
		mgr.AddStopper("message", lifecycle.StopFunc(func() {
			if err := m.Close(); err != nil {
				slog.Warn("close message", "error", err)
			}
		}))
		return m, nil, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, nil, fmt.Errorf("third_party.message: module config required")
		}
		opts := []messageoption.Option{
			messageoption.WithDB(db),
			messageoption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, messageoption.WithGIDHandler(gidRaw))
		}
		hdl, err := messageservice.NewModule(cfg.Config, opts...)
		if err != nil {
			return nil, nil, fmt.Errorf("init message-service: %w", err)
		}
		m := thirdcallmessage.NewModule(hdl, true)
		mgr.AddStopper("message", lifecycle.StopFunc(func() {
			if err := m.Close(); err != nil {
				slog.Warn("close message", "error", err)
			}
		}))
		return m, hdl, nil
	default:
		return nil, nil, fmt.Errorf("third_party.message: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveStorage returns testkit's StorageService. gidRaw shared in module mode.
// When gidRaw is nil (gid in grpc mode), it is NOT injected and storage-service
// resolves its own gid upstream from its own config — matching user-service's
// behavior.
func resolveStorage(cfg *config.RemoteServiceConfig[*storageconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, mgr *lifecycle.Manager) (thirdcallstorage.StorageService, error) {
	if cfg == nil {
		return nil, fmt.Errorf("third_party.storage: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, fmt.Errorf("third_party.storage.target required when mode=grpc")
		}
		s, err := thirdcallstorage.NewGRPC(cfg.Target)
		if err != nil {
			return nil, fmt.Errorf("init storage-service: %w", err)
		}
		mgr.AddStopper("storage", lifecycle.StopFunc(func() {
			if err := s.Close(); err != nil {
				slog.Warn("close storage", "error", err)
			}
		}))
		return s, nil
	case "module", "":
		if cfg.Config == nil {
			return nil, fmt.Errorf("third_party.storage: module config required")
		}
		opts := []stoption.Option{
			stoption.WithDB(db),
			stoption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, stoption.WithGIDHandler(gidRaw))
		}
		hdl, err := storageservice.NewModule(cfg.Config, opts...)
		if err != nil {
			return nil, fmt.Errorf("init storage-service: %w", err)
		}
		s := thirdcallstorage.NewModule(hdl, true)
		mgr.AddStopper("storage", lifecycle.StopFunc(func() {
			if err := s.Close(); err != nil {
				slog.Warn("close storage", "error", err)
			}
		}))
		return s, nil
	default:
		return nil, fmt.Errorf("third_party.storage: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveUser returns testkit's UserService. gidRaw + msgRaw shared in module
// mode. cfg.Config is passed through as-is — user-service's construction is
// nil-safe (nil/empty Session/RBAC/OAuth resolve to defaults; unconfigured
// providers are skipped), so testkit no longer normalizes it. When either raw
// handler is nil (that upstream in grpc mode), it is NOT injected and
// user-service resolves that upstream from its own config — matching
// user-service's behavior.
func resolveUser(cfg *config.RemoteServiceConfig[*userconfig.Config], db *gorm.DB, rdb *redis.Client, gidRaw *gidservice.Handler, msgRaw *messageservice.Handler, mgr *lifecycle.Manager) (thirdcalluser.UserService, error) {
	if cfg == nil {
		return nil, fmt.Errorf("third_party.user: not configured")
	}
	switch cfg.Mode {
	case "grpc":
		if cfg.Target == "" {
			return nil, fmt.Errorf("third_party.user.target required when mode=grpc")
		}
		u, err := thirdcalluser.NewGRPC(cfg.Target)
		if err != nil {
			return nil, fmt.Errorf("init user-service: %w", err)
		}
		mgr.AddStopper("user", lifecycle.StopFunc(func() {
			if err := u.Close(); err != nil {
				slog.Warn("close user", "error", err)
			}
		}))
		return u, nil
	case "module", "":
		// cfg.Config is passed through unmodified — user-service's construction
		// is nil-safe (a nil/empty config boots with defaults; unconfigured OAuth
		// providers are skipped).
		opts := []usroption.Option{
			usroption.WithDB(db),
			usroption.WithRedis(rdb),
		}
		if gidRaw != nil {
			opts = append(opts, usroption.WithGIDHandler(gidRaw))
		}
		if msgRaw != nil {
			opts = append(opts, usroption.WithMessageHandler(msgRaw))
		}
		hdl, err := userservice.NewModule(cfg.Config, opts...)
		if err != nil {
			return nil, fmt.Errorf("init user-service: %w", err)
		}
		u := thirdcalluser.NewModule(hdl, true)
		mgr.AddStopper("user", lifecycle.StopFunc(func() {
			if err := u.Close(); err != nil {
				slog.Warn("close user", "error", err)
			}
		}))
		return u, nil
	default:
		return nil, fmt.Errorf("third_party.user: unknown mode %q (want \"grpc\" or \"module\")", cfg.Mode)
	}
}

// resolveDB builds the shared PostgreSQL pool from cfg and registers a Stopper.
func resolveDB(cfg *config.Config, mgr *lifecycle.Manager) (*gorm.DB, error) {
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

// resolveRedis builds the shared Redis client from cfg and registers a Stopper.
func resolveRedis(cfg *config.Config, mgr *lifecycle.Manager) (*redis.Client, error) {
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

// setupJobs builds the jobs.Scheduler, registers it on s.mgr, and wires periodic
// jobs (empty by default).
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

// rollback stops all components registered so far and joins the stop error with
// the triggering error. Used by New on partial failure.
func rollback(mgr *lifecycle.Manager, err error) error {
	if cerr := mgr.Stop(); cerr != nil {
		return errors.Join(err, fmt.Errorf("rollback: %w", cerr))
	}
	return err
}
