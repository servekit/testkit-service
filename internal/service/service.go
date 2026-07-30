// Package service contains testkit-service business logic.
//
// Layering: this file is the runtime surface — the Service struct, Start/Stop,
// Ping, and one-line facade accessors (one per domain). All construction +
// dependency injection lives in init.go. Business logic lives in SUBPACKAGES
// (internal/service/<domain>/). handler calls service.X; service.X is a one-line
// facade that calls s.<domain>.X in the subpackage.
//
// testkit is a single-process BFF: it embeds gid/message/storage/user-service
// (module mode, in-process) or dials them (grpc mode), decided per downstream by
// cfg.ThirdParty.<svc>.Mode. Each downstream is reached exclusively through the
// thirdcall interface (internal/thirdcall/<svc>).
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"github.com/servekit/go-common/lifecycle"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
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
	"github.com/servekit/testkit-service/internal/version"
	pkauth "github.com/servekit/testkit-service/pkg/auth"
	"github.com/servekit/testkit-service/pkg/config"
	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// Service holds testkit-service runtime state: the four downstream thirdcall
// clients plus the six domain services. Construction + DI is in init.go.
type Service struct {
	cfg   *config.Config
	mgr   *lifecycle.Manager
	redis *redis.Client
	db    *gorm.DB

	// The four embedded downstreams (thirdcall interfaces: full RPC method set
	// + Close). Built + lifecycle-registered in init.go.
	gid     thirdcallgid.GIDService
	message thirdcallmessage.MessageService
	storage thirdcallstorage.StorageService
	user    thirdcalluser.UserService

	auth         *auth.Service
	userSvc      *user.Service
	storageSvc   *storage.Service
	messageSvc   *message.Service
	gidSvc       *gidsvc.Service
	dashboardSvc *dashboardsvc.Service

	startedAt int64
}

// Start starts all owned components concurrently.
func (s *Service) Start() error { return s.mgr.Start() }

// Stop stops all owned components in reverse registration order.
func (s *Service) Stop() error { return s.mgr.Stop() }

// Ping is a health-check RPC. Returns only public, non-sensitive info.
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

// --- accessors ---

// DB returns the shared PostgreSQL pool (used by the unified migrator).
func (s *Service) DB() *gorm.DB { return s.db }

// SessionResolver builds the auth-interceptor seam from the embedded
// user-service: session_id -> user_id via GetSession. This is testkit's wiring
// decision (how it uses user-service), not user-service's transport concern —
// hence it lives on the service root, not in internal/thirdcall/user. pkg/auth
// (aliased pkauth here to avoid clashing with the internal/service/auth domain)
// stays gen-free.
func (s *Service) SessionResolver() pkauth.SessionResolver {
	return func(ctx context.Context, sessionID string) (int64, error) {
		resp, err := s.user.GetSession(ctx, &userv1.GetSessionRequest{SessionId: sessionID})
		if err != nil {
			return 0, fmt.Errorf("user get-session %q: %w", sessionID, err)
		}
		return resp.GetUserId(), nil
	}
}

func (s *Service) Auth() *auth.Service              { return s.auth }
func (s *Service) User() *user.Service              { return s.userSvc }
func (s *Service) Storage() *storage.Service        { return s.storageSvc }
func (s *Service) Message() *message.Service        { return s.messageSvc }
func (s *Service) Gid() *gidsvc.Service             { return s.gidSvc }
func (s *Service) Dashboard() *dashboardsvc.Service { return s.dashboardSvc }
