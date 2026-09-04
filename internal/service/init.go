// Package service resource initialization + dependency injection. All resources
// (db, redis, the four embedded downstreams) are resolved here from cfg and
// wired into the domain subpackages via their constructors. testkit is a
// terminal service, so nothing is injectable — every downstream resolves via
// its provider's Connect (grpc dials + Stopper; module builds + mgr.Add), and
// the raw module Handlers are shared down the dependency graph through the
// providers' own options (WithGIDHandler / WithMessageHandler).
//
// Resolve order: shared redis+db → gid → message → storage → user (each
// downstream shares the raw handlers of its upstreams in module mode). On
// partial failure, already-registered components are stopped via mgr.Stop().
package service

import (
	"errors"
	"fmt"
	"time"

	gidservice "github.com/servekit/gid-service/pkg"
	"github.com/servekit/go-common/cronx"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/lifecycle"
	"github.com/servekit/go-common/redisx"
	messageservice "github.com/servekit/message-service/pkg"
	messageoption "github.com/servekit/message-service/pkg/option"
	storageservice "github.com/servekit/storage-service/pkg"
	stoption "github.com/servekit/storage-service/pkg/option"
	userservice "github.com/servekit/user-service/pkg"
	usroption "github.com/servekit/user-service/pkg/option"

	"github.com/servekit/testkit-service/internal/jobs"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	"github.com/servekit/testkit-service/internal/service/user"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/xcodes"
)

// New constructs a Service from config. All resources are self-built from cfg
// and registered with the internal Manager; Stop stops them in reverse order.
// Resolve order: shared redis + db → gid → message → storage → user. On partial
// failure, already-registered components are stopped before returning the error.
func New(cfg *config.Config) (*Service, error) {
	mgr := lifecycle.NewManager()

	rdb, err := redisx.Connect(cfg.Redis, nil, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	db, err := dbx.Connect(cfg.Database, nil, mgr)
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
	// the raw upstream handlers down the chain (module mode only; a nil raw
	// handler — grpc mode — means the downstream resolves its own upstream).
	gidMode, gidTarget, gidCfg := unpack(cfg.ThirdParty.GID)
	gid, gidRaw, err := gidservice.Connect(gidservice.ConnectConfig{
		Mode: gidMode, Target: gidTarget, Config: gidCfg,
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.gid = gid

	msgMode, msgTarget, msgCfg := unpack(cfg.ThirdParty.Message)
	msg, msgRaw, err := messageservice.Connect(messageservice.ConnectConfig{
		Mode:   msgMode,
		Target: msgTarget,
		Config: msgCfg,
		Opts: []messageoption.Option{
			messageoption.WithDB(db),
			messageoption.WithRedis(rdb),
			messageoption.WithGIDHandler(gidRaw), // nil = not injected; message resolves its own
		},
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.message = msg

	stMode, stTarget, stCfg := unpack(cfg.ThirdParty.Storage)
	st, _, err := storageservice.Connect(storageservice.ConnectConfig{
		Mode:   stMode,
		Target: stTarget,
		Config: stCfg,
		Opts: []stoption.Option{
			stoption.WithDB(db),
			stoption.WithRedis(rdb),
			stoption.WithGIDHandler(gidRaw),
		},
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.storage = st

	// cfg.Config passes through unmodified — user-service's construction is
	// nil-safe (a nil/empty config boots with defaults; unconfigured OAuth
	// providers are skipped).
	usrMode, usrTarget, usrCfg := unpack(cfg.ThirdParty.User)
	usr, _, err := userservice.Connect(userservice.ConnectConfig{
		Mode:   usrMode,
		Target: usrTarget,
		Config: usrCfg,
		Opts: []usroption.Option{
			usroption.WithDB(db),
			usroption.WithRedis(rdb),
			usroption.WithGIDHandler(gidRaw),
			usroption.WithMessageHandler(msgRaw),
		},
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.user = usr

	// JWT manager (stateless; not registered with mgr).
	jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
	if err != nil {
		return nil, rollback(mgr, fmt.Errorf("init jwt: %w", err))
	}

	// P1 auth domain: forward to user-service + issue testkit JWT.
	svc.auth = auth.New(jwtMgr, auth.WithUserClient(usr))

	// P2 user domain.
	svc.userSvc = user.New(usr, jwtMgr)

	// P3 storage domain.
	svc.storageSvc = storage.New(st)

	// P4 message domain. sender_id is a service label injected on every Send —
	// fail fast on empty rather than sending with a blank label.
	if cfg.Message.SenderID == "" {
		return nil, rollback(mgr, xcodes.ErrSenderNotConfigured.New())
	}
	svc.messageSvc = message.New(msg, message.WithSenderID(cfg.Message.SenderID))

	// P5 gid + dashboard domains.
	svc.gidSvc = gidsvc.New(gid)
	svc.dashboardSvc = dashboardsvc.New(usr, st, msg)

	if err := svc.setupJobs(); err != nil {
		return nil, rollback(mgr, err)
	}
	return svc, nil
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

// unpack unwraps an optional ThirdParty section into the triple the
// provider's ConnectConfig takes. testkit is a terminal service with no
// injection path, so each dependency must be configured; a nil section
// returns zeros and fails inside the provider's Connect with a branded error.
func unpack[T any](cfg *config.RemoteServiceConfig[T]) (mode, target string, config T) {
	if cfg == nil {
		return "", "", config
	}
	return cfg.Mode, cfg.Target, cfg.Config
}
