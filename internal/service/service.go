// Package service contains testkit-service business logic.
//
// Layering: this file is the runtime surface — the Service struct, Start/Stop,
// Ping, and one-line facade accessors (one per domain). All construction +
// dependency injection lives in init.go. Business logic lives in SUBPACKAGES
// (internal/service/<domain>/). handler calls service.X; service.X is a one-line
// facade that calls s.<domain>.X in the subpackage.
//
// testkit is a single-process BFF: it embeds gid/message/storage/user/license/
// telemetry-service (module mode, in-process) or dials them (grpc mode),
// decided per downstream by cfg.ThirdParty.<svc>.Mode. Each downstream is
// reached through its provider's Connect contract (pkg.Service).
package service

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	gidservice "github.com/servekit/gid-service/pkg"
	referenceservice "github.com/servekit/reference-service/pkg"
	"github.com/servekit/go-common/lifecycle"
	licenseservice "github.com/servekit/license-service/pkg"
	messageservice "github.com/servekit/message-service/pkg"
	storageservice "github.com/servekit/storage-service/pkg"
	telemetryservice "github.com/servekit/telemetry-service/pkg"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	licsvc "github.com/servekit/testkit-service/internal/service/license"
	"github.com/servekit/testkit-service/internal/service/message"
	"github.com/servekit/testkit-service/internal/service/storage"
	telemetriesvc "github.com/servekit/testkit-service/internal/service/telemetry"
	"github.com/servekit/testkit-service/internal/service/user"
	"github.com/servekit/testkit-service/internal/version"
	"github.com/servekit/testkit-service/pkg/config"
	userservice "github.com/servekit/user-service/pkg"
)

// Service holds testkit-service runtime state: the six embedded downstreams
// plus the eight domain services. Construction + DI is in init.go.
type Service struct {
	cfg   *config.Config
	mgr   *lifecycle.Manager
	redis *redis.Client
	db    *gorm.DB

	// The six embedded downstreams (each a full provider Service interface:
	// module-mode Handler or gRPC Client). Built + lifecycle-registered in
	// init.go.
	gid       gidservice.Service
	reference referenceservice.Service
	message   messageservice.Service
	storage   storageservice.Service
	user      userservice.Service
	license   licenseservice.Service
	telemetry telemetryservice.Service

	auth         *auth.Service
	userSvc      *user.Service
	storageSvc   *storage.Service
	messageSvc   *message.Service
	gidSvc       *gidsvc.Service
	dashboardSvc *dashboardsvc.Service
	licenseSvc   *licsvc.Service
	telemetrySvc *telemetriesvc.Service

	startedAt int64
}

// Start starts all owned components concurrently.
func (s *Service) Start() error { return s.mgr.Start() }

// Stop stops all owned components in reverse registration order.
func (s *Service) Stop() error { return s.mgr.Stop() }

// Ping is a health-check RPC. Returns only public, non-sensitive info.
func (s *Service) Ping(_ context.Context) (*commonv1.Pong, error) {
	v := version.Get()
	return &commonv1.Pong{
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

// --- accessors ---

// DB returns the shared PostgreSQL pool (used by the unified migrator).
func (s *Service) DB() *gorm.DB { return s.db }

// UserService exposes the embedded user-service handle (module-mode Handler or
// gRPC Client) for the edge auth middleware (user-service pkg/auth), which
// verifies bearer sessions via GetSession on every request.
func (s *Service) UserService() userservice.Service { return s.user }

// Auth returns the P1 auth domain (login flow + session token issue).
func (s *Service) Auth() *auth.Service { return s.auth }

// User returns the P2 user domain (profile + admin user CRUD over user-service).
func (s *Service) User() *user.Service { return s.userSvc }

// Storage returns the P3 storage domain (file listing + STS over storage-service).
func (s *Service) Storage() *storage.Service { return s.storageSvc }

// Message returns the P4 message domain (email/SMS send over message-service).
func (s *Service) Message() *message.Service { return s.messageSvc }

// Gid returns the P5 gid domain (id issue/debug over gid-service).
func (s *Service) Gid() *gidsvc.Service { return s.gidSvc }

// Dashboard returns the P5 dashboard domain (aggregated user/storage/message stats).
func (s *Service) Dashboard() *dashboardsvc.Service { return s.dashboardSvc }

// License returns the P6 license domain (key lifecycle + activation over
// license-service).
func (s *Service) License() *licsvc.Service { return s.licenseSvc }

// Telemetry returns the P6 telemetry domain (app registry + ingest over
// telemetry-service).
func (s *Service) Telemetry() *telemetriesvc.Service { return s.telemetrySvc }
