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
	referencev1 "github.com/servekit/api/gen/go/reference/v1"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	gidservice "github.com/servekit/gid-service/pkg"
	"github.com/servekit/go-common/lifecycle"
	licenseservice "github.com/servekit/license-service/pkg"
	messageservice "github.com/servekit/message-service/pkg"
	portalservice "github.com/servekit/portal-service/pkg"
	referenceservice "github.com/servekit/reference-service/pkg"
	storageservice "github.com/servekit/storage-service/pkg"
	telemetryservice "github.com/servekit/telemetry-service/pkg"
	"github.com/servekit/testkit-service/internal/service/auth"
	dashboardsvc "github.com/servekit/testkit-service/internal/service/dashboard"
	gidsvc "github.com/servekit/testkit-service/internal/service/gid"
	licsvc "github.com/servekit/testkit-service/internal/service/license"
	"github.com/servekit/testkit-service/internal/service/message"
	portalsvc "github.com/servekit/testkit-service/internal/service/portal"
	"github.com/servekit/testkit-service/internal/service/reference"
	"github.com/servekit/testkit-service/internal/service/storage"
	telemetriesvc "github.com/servekit/testkit-service/internal/service/telemetry"
	"github.com/servekit/testkit-service/internal/service/user"
	"github.com/servekit/testkit-service/internal/tenantgate"
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
	gid          gidservice.Service
	reference    referenceservice.Service
	referenceSvc *reference.Service
	message      messageservice.Service
	storage      storageservice.Service
	user         userservice.Service
	license      licenseservice.Service
	telemetry    telemetryservice.Service

	// portal backs the console door's tenant gate (membership binding sets
	// + the tenant registry; grpc mode at the internal admin listener).
	portal portalservice.Service
	// gate is the HTTP edge middleware resolving the trusted x-tenant-key
	// per request (spec §5.3). Mounted in pkg/server.go's GatewayWrap.
	gate *tenantgate.Gate

	auth         *auth.Service
	userSvc      *user.Service
	storageSvc   *storage.Service
	messageSvc   *message.Service
	gidSvc       *gidsvc.Service
	dashboardSvc *dashboardsvc.Service
	licenseSvc   *licsvc.Service
	telemetrySvc *telemetriesvc.Service
	// portalSvc is the phase ④ console forward domain over the portal admin
	// seam (whoami / capabilities / api keys / platform registry writes).
	portalSvc *portalsvc.Service

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

// Portal exposes the portal admin handle (grpc Client dialing the internal
// admin listener) for the phase ④ console self-service forwards.
func (s *Service) Portal() portalservice.Service { return s.portal }

// PortalAdmin exposes the phase ④ console forward domain (whoami /
// capabilities / api keys / platform registry management) over the portal
// admin seam, with the door's actor-type re-checks and tenant-key scoping.
func (s *Service) PortalAdmin() *portalsvc.Service { return s.portalSvc }

// TenantGate exposes the console door's tenant gate — the HTTP middleware
// pkg/server.go mounts inside the gateway wrap, downstream of the session
// middleware (it consumes the verified actor the latter plants).
func (s *Service) TenantGate() *tenantgate.Gate { return s.gate }

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

// --- reference-domain facades (1:1 forwards of reference.v1 types) ---

// ListCountries delegates to the reference domain.
func (s *Service) ListCountries(ctx context.Context, req *referencev1.ListCountriesRequest) (*referencev1.ListCountriesResponse, error) {
	return s.referenceSvc.ListCountries(ctx, req)
}

// ListTimezones delegates to the reference domain.
func (s *Service) ListTimezones(ctx context.Context, req *referencev1.ListTimezonesRequest) (*referencev1.ListTimezonesResponse, error) {
	return s.referenceSvc.ListTimezones(ctx, req)
}

// ListLanguages delegates to the reference domain.
func (s *Service) ListLanguages(ctx context.Context, req *referencev1.ListLanguagesRequest) (*referencev1.ListLanguagesResponse, error) {
	return s.referenceSvc.ListLanguages(ctx, req)
}

// ListCurrencies delegates to the reference domain.
func (s *Service) ListCurrencies(ctx context.Context, req *referencev1.ListCurrenciesRequest) (*referencev1.ListCurrenciesResponse, error) {
	return s.referenceSvc.ListCurrencies(ctx, req)
}

// ListRegionGroups delegates to the reference domain.
func (s *Service) ListRegionGroups(ctx context.Context, req *referencev1.ListRegionGroupsRequest) (*referencev1.ListRegionGroupsResponse, error) {
	return s.referenceSvc.ListRegionGroups(ctx, req)
}

// ParsePhone delegates to the reference domain.
func (s *Service) ParsePhone(ctx context.Context, req *referencev1.ParsePhoneRequest) (*referencev1.ParsePhoneResponse, error) {
	return s.referenceSvc.ParsePhone(ctx, req)
}

// ResolveCodes delegates to the reference domain.
func (s *Service) ResolveCodes(ctx context.Context, req *referencev1.ResolveCodesRequest) (*referencev1.ResolveCodesResponse, error) {
	return s.referenceSvc.ResolveCodes(ctx, req)
}

// GetCountryProfile delegates to the reference domain.
func (s *Service) GetCountryProfile(ctx context.Context, req *referencev1.GetCountryProfileRequest) (*referencev1.GetCountryProfileResponse, error) {
	return s.referenceSvc.GetCountryProfile(ctx, req)
}

// ListCountriesByRegion delegates to the reference domain.
func (s *Service) ListCountriesByRegion(ctx context.Context, req *referencev1.ListCountriesByRegionRequest) (*referencev1.ListCountriesByRegionResponse, error) {
	return s.referenceSvc.ListCountriesByRegion(ctx, req)
}

// GetCountryDefaults delegates to the reference domain.
func (s *Service) GetCountryDefaults(ctx context.Context, req *referencev1.GetCountryDefaultsRequest) (*referencev1.GetCountryDefaultsResponse, error) {
	return s.referenceSvc.GetCountryDefaults(ctx, req)
}

// GetDataInfo delegates to the reference domain.
func (s *Service) GetDataInfo(ctx context.Context, req *referencev1.GetDataInfoRequest) (*referencev1.GetDataInfoResponse, error) {
	return s.referenceSvc.GetDataInfo(ctx, req)
}
