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
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
	
	"github.com/redis/go-redis/v9"
	testkitv1 "testkit-service/gen/testkit/v1"
	"testkit-service/internal/jobs"
	"testkit-service/internal/version"
	
	"testkit-service/pkg/config"
	"testkit-service/pkg/option"
	"testkit-service/pkg/thirdcall"

	"github.com/servekit/go-common/cronx"
	
	"github.com/servekit/go-common/redisx"
	"github.com/servekit/go-common/lifecycle"
)

// Service holds testkit-service business state.
//
// Resource fields (db, redis, demoSvc) are convenience references kept on the
// root Service for resolveXxx helpers — they point at the same instances
// tracked by mgr and injected into subpackages. Each domain lives in its own
// subpackage field (testkit *testkit.Service); subpackages do NOT
// reference this struct.
type Service struct {
	cfg *config.Config
	mgr *lifecycle.Manager
	redis *redis.Client
	demoSvc thirdcall.DemoService
	

	// startedAt is set once in New; Ping returns it for uptime.
	startedAt int64
}

// New constructs a Service from config and functional options.
//
// Resources not injected via options are created from cfg, wrapped as
// lifecycle.Stoppers, and registered with the internal Manager. Stop will
// stop them in reverse order. Injected resources are NOT registered — caller
// owns their lifecycle.
//
// On partial failure (any resolve returns an error), already-registered
// components are stopped via mgr.Stop() before returning the error.
func New(cfg *config.Config, opts ...option.Option) (*Service, error) {
	o := option.Apply(opts...)
	_ = o // injection seam; enabled resources read o.X below
	mgr := lifecycle.NewManager()
	
	redis, err := resolveRedis(cfg, o.Redis, mgr)
	if err != nil {
		if cerr := mgr.Stop(); cerr != nil {
			err = errors.Join(err, fmt.Errorf("rollback: %w", cerr))
		}
		return nil, err
	}
	
	demoSvc, err := resolveDemo(cfg, o.DemoService, mgr)
	if err != nil {
		if cerr := mgr.Stop(); cerr != nil {
			err = errors.Join(err, fmt.Errorf("rollback: %w", cerr))
		}
		return nil, err
	}
	
	svc := &Service{
		cfg: cfg,
		mgr: mgr,
		redis: redis,
		demoSvc: demoSvc,
		
		startedAt: time.Now().UnixMilli(),
	}

	// jobs.Scheduler owns the cron instance; setupJobs builds it, registers
	// it on mgr, and wires periodic jobs (empty by default — add jobs inside
	// setupJobs as scheduler.AddFunc calls). See architecture.md (jobs.md).
	if err := svc.setupJobs(); err != nil {
		if cerr := mgr.Stop(); cerr != nil {
			err = errors.Join(err, fmt.Errorf("rollback: %w", cerr))
		}
		return nil, err
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
func (s *Service) Ping(ctx context.Context) (*testkitv1.Pong, error) {
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
	
// --- internal helpers ---

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
	
// resolveDemo returns the DemoService to use. If the caller injected one via
// WithDemoService, it's returned as-is. Otherwise a new one is built from cfg
// and — if it implements Close() — registered with mgr as a Stopper.
func resolveDemo(cfg *config.Config, injected thirdcall.DemoService, mgr *lifecycle.Manager) (thirdcall.DemoService, error) {
	if injected != nil {
		return injected, nil
	}
	demo, err := thirdcall.NewDemoService(&cfg.ThirdParty.Demo)
	if err != nil {
		return nil, fmt.Errorf("init demo: %w", err)
	}
	if closer, ok := demo.(interface{ Close() error }); ok {
		mgr.AddStopper("demo", lifecycle.StopFunc(func() {
			if err := closer.Close(); err != nil {
				slog.Warn("close demo", "error", err)
			}
		}))
	}
	return demo, nil
}
	
