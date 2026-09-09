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
	"github.com/servekit/go-common/configx"
	"github.com/servekit/go-common/cronx"
	"github.com/servekit/go-common/dbx"
	"github.com/servekit/go-common/lifecycle"
	"github.com/servekit/go-common/redisx"
	licenseservice "github.com/servekit/license-service/pkg"
	licenseoption "github.com/servekit/license-service/pkg/option"
	messageservice "github.com/servekit/message-service/pkg"
	messageoption "github.com/servekit/message-service/pkg/option"
	referenceservice "github.com/servekit/reference-service/pkg"
	storageservice "github.com/servekit/storage-service/pkg"
	stoption "github.com/servekit/storage-service/pkg/option"
	telemetryservice "github.com/servekit/telemetry-service/pkg"
	telemetryoption "github.com/servekit/telemetry-service/pkg/option"
	"github.com/servekit/testkit-service/internal/service/reference"
	userservice "github.com/servekit/user-service/pkg"
	usroption "github.com/servekit/user-service/pkg/option"

	"github.com/servekit/testkit-service/internal/jobs"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	licsvc "github.com/servekit/testkit-service/internal/service/license"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	telemetriesvc "github.com/servekit/testkit-service/internal/service/telemetry"
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

	// reference-service: pure static data, module mode costs nothing.
	refMode, refTarget, refCfg := unpack(cfg.ThirdParty.Reference)
	ref, _, err := referenceservice.Connect(referenceservice.ConnectConfig{
		Mode: refMode, Target: refTarget, Config: refCfg,
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.reference = ref
	svc.referenceSvc = reference.New(ref)

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

	// P6 license-service: shares db+redis. Its own Database/Redis sub-configs
	// stay empty (injected here); Signing seed is required and comes from the
	// third_party.license.config block.
	licMode, licTarget, licCfg := unpack(cfg.ThirdParty.License)
	lic, _, err := licenseservice.Connect(licenseservice.ConnectConfig{
		Mode:   licMode,
		Target: licTarget,
		Config: licCfg,
		Opts: []licenseoption.Option{
			licenseoption.WithDB(db),
			licenseoption.WithRedis(rdb),
		},
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.license = lic

	// P6 telemetry-service: shares db. The admin token configured here is what
	// the BFF forwards as Bearer metadata on admin-surface RPCs (empty disables
	// the downstream admin surface, fail closed).
	telMode, telTarget, telCfg := unpack(cfg.ThirdParty.Telemetry)
	telAdminToken := ""
	if telCfg != nil && telCfg.Admin != nil {
		telAdminToken = telCfg.Admin.Token
	}
	tel, _, err := telemetryservice.Connect(telemetryservice.ConnectConfig{
		Mode:   telMode,
		Target: telTarget,
		Config: telCfg,
		Opts: []telemetryoption.Option{
			telemetryoption.WithDB(db),
		},
	}, mgr)
	if err != nil {
		return nil, rollback(mgr, err)
	}
	svc.telemetry = tel

	// P1 auth domain: forward to user-service; login returns the session id
	// as the bearer token.
	svc.auth = auth.New(auth.WithUserClient(usr))

	// P2 user domain.
	svc.userSvc = user.New(usr)

	// P3 storage domain.
	if cfg.Storage == nil || cfg.Storage.AppKey == "" || cfg.Storage.AppSecret == "" {
		return nil, rollback(mgr, xcodes.ErrAppNotConfigured.New("cfg.Storage.AppKey/AppSecret are required: every storage data-plane call authenticates as an app (storage.bootstrap_app seeds one at migrate time)"))
	}
	svc.storageSvc = storage.New(st,
		storage.WithAppCredentials(cfg.Storage.AppKey, cfg.Storage.AppSecret),
	)

	// P4 message domain. App credentials are injected into the downstream
	// context of every Send — fail fast on empty rather than sending
	// unauthenticated. cfg.Message is nil when the config file carries no
	// message block (no defaults under it → viper leaves the pointer nil).
	if cfg.Message == nil || cfg.Message.AppKey == "" || cfg.Message.AppSecret == "" {
		return nil, rollback(mgr, xcodes.ErrAppNotConfigured.New())
	}
	svc.messageSvc = message.New(msg,
		message.WithAppCredentials(cfg.Message.AppKey, cfg.Message.AppSecret),
		message.WithReference(ref),
	)

	// P5 gid + dashboard domains.
	svc.gidSvc = gidsvc.New(gid)
	svc.dashboardSvc = dashboardsvc.New(usr, st, msg)

	// P6 license + telemetry domains. License app credentials are injected
	// into the downstream context of every client-surface call — fail fast
	// on empty (the license client surface is fail-closed without them).
	if cfg.License == nil || cfg.License.AppKey == "" || cfg.License.AppSecret == "" {
		return nil, rollback(mgr, xcodes.ErrAppNotConfigured.New())
	}
	svc.licenseSvc = licsvc.New(lic, "",
		licsvc.WithAppCredentials(cfg.License.AppKey, cfg.License.AppSecret),
	)
	svc.telemetrySvc = telemetriesvc.New(tel, telAdminToken)

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
func unpack[T any](cfg *config.RemoteServiceConfig[T]) (mode configx.Mode, target string, config T) {
	if cfg == nil {
		return "", "", config
	}
	return cfg.Mode, cfg.Target, cfg.Config
}
