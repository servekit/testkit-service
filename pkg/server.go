// Package pkg is the public surface of testkit-service. It wires internal
// pieces into a runnable gRPC + grpc-gateway server (Server) and a gRPC client
// (Client) for testkit-service — a terminal, user-facing BFF with no downstream
// embedder. Callers that need to talk to testkit over gRPC use this package's
// Client; operators run Server. Nothing here is injectable into another
// service.
package pkg

import (
	"context"
	"errors"
	"net/http"

	"buf.build/go/protovalidate"
	protovalidate_middleware "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/protovalidate"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/grpc"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/signalx"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/auth"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/handler"

	"github.com/servekit/telemetry-service/pkg/ingesthttp"
)

// Compile-time assertion: *Server satisfies signalx.Service.
var _ signalx.Service = (*Server)(nil)

// Server wraps a gRPC + HTTP gateway server for the testkit service.
//
// Holds grpcSrv (gRPC + gateway transports) and hdl (the Handler, which
// itself wraps the underlying *service.Service and exposes Start/Stop).
// There's no separate svc field — Handler is the single handle for both
// RPC dispatch and lifecycle.
type Server struct {
	grpcSrv *grpcx.Server
	hdl     *handler.Handler
}

// NewServer constructs a Server with all dependencies wired.
//
// The gRPC server runs a three-interceptor chain (outermost first):
//   - grpcx.ErrorInterceptor: maps *xerr.Error returned by inner layers to
//     gRPC status codes (Unauthorized → Unauthenticated/401, NotFound → 404,
//     BadRequest → InvalidArgument/400, ...). It MUST sit outside the auth
//     gate: the auth interceptor returns xcodes.ErrUnauthorized (an *xerr.Error
//     that has no GRPCStatus method), so without ErrorInterceptor wrapping it,
//     auth rejections would surface to clients as codes.Unknown.
//   - auth.Interceptor (pkg/auth): the JWT authentication gate. Skips the
//     public whitelist (Ping/Login/Register/SendVerificationCode + the health
//     check), then for every other RPC verifies the bearer JWT, resolves
//     session→user via the embedded user-service GetSession, and injects
//     user_id + session_id into the handler ctx.
//   - protovalidate.UnaryServerInterceptor: enforces (buf.validate.field)
//     rules declared in testkit.proto.
//
// The HTTP gateway auto-registers via testkitv1.RegisterTestkitServiceHandlerFromEndpoint
// when cfg.Server.GatewayAddr is non-empty. grpc-gateway forwards the HTTP
// Authorization header to gRPC metadata under the unprefixed "authorization"
// key by default (verified in grpc-gateway runtime/context.go), so no custom
// header matcher is needed (design decision 4).
func NewServer(cfg *config.Config) (*Server, error) {
	svc, err := service.New(cfg)
	if err != nil {
		return nil, err
	}

	hdl := handler.New(svc)

	// Auth gate (design spec §5.2): a JWT manager + a session→user_id resolver
	// bridged to the embedded user-service GetSession. The manager is stateless
	// (HS256 secret + ttl from cfg); service.New built its own identical
	// manager for the auth domain's signing path — two stateless instances off
	// the same config interoperate freely.
	jwtMgr, err := jwt.NewManager(cfg.JWT.Secret, cfg.JWT.TTL)
	if err != nil {
		return nil, err
	}
	resolver := svc.SessionResolver()
	authIntercept := auth.NewInterceptor(
		jwtMgr,
		resolver,
		auth.WithPublicMethods(
			"/testkit.v1.TestkitService/Ping",
			"/testkit.v1.TestkitService/Login",
			"/testkit.v1.TestkitService/Register",
			"/testkit.v1.TestkitService/SendVerificationCode",
			// Public self-service flows (P2): password reset is code-based
			// (no caller identity), and social login starts before the caller
			// has a session — GetOAuthURL kicks off OAuth, the three login
			// RPCs complete it and mint the first JWT. "My" RPCs (GetProfile /
			// ListSessions / ...) stay PROTECTED — they need the caller's
			// user_id injected from a verified JWT.
			"/testkit.v1.TestkitService/ResetPassword",
			"/testkit.v1.TestkitService/GetOAuthURL",
			"/testkit.v1.TestkitService/SocialLogin",
			"/testkit.v1.TestkitService/MiniProgramLogin",
			"/testkit.v1.TestkitService/MiniProgramPhoneLogin",
			// File-link recipients are anonymous external users (links
			// embedded in sent emails) — the link token is the credential.
			"/testkit.v1.TestkitService/GetFileLinkDownload",
			// grpcx auto-registers grpc.health.v1.Health; health probes carry
			// no token, so the Check RPC must stay public.
			"/grpc.health.v1.Health/Check",
			// RefreshSession is intentionally PROTECTED — a deviation from
			// design §3.5's whitelist: testkit's JWT is itself the session
			// carrier (there is no separate refresh token), so the frontend
			// must refresh proactively before expiry. The interceptor validates
			// the session and injects session_id, which RefreshSession reuses
			// as the target when the request omits it.
		),
	)

	validator, err := protovalidate.New()
	if err != nil {
		return nil, err
	}

	grpcSrv := grpcx.New(
		&grpcx.ServerConfig{
			GRPCAddr:    cfg.Server.GRPCAddr,
			GatewayAddr: cfg.Server.GatewayAddr,
		},
		func(gs *grpc.Server) {
			testkitv1.RegisterTestkitServiceServer(gs, hdl)
		},
		registerGateway(svc),
		// Chain order is outermost-first (grpc.ChainUnaryInterceptor).
		// ErrorInterceptor wraps the auth gate so its *xerr.Error rejections
		// (and protovalidate's) are translated to gRPC status / HTTP codes.
		// Auth runs before protovalidate so unauthenticated requests are
		// rejected without paying for request-body validation.
		grpcx.ErrorInterceptor,
		authIntercept.Unary(),
		protovalidate_middleware.UnaryServerInterceptor(validator),
	)

	return &Server{grpcSrv: grpcSrv, hdl: hdl}, nil
}

// registerGateway builds the gateway registration closure: testkit's own
// transcoded RPC surface first, then the two faces testkit hosts on behalf
// of its gRPC-only backends:
//   - the telemetry raw ingestion endpoints (telemetry pkg/ingesthttp —
//     HMAC covers the raw body bytes, so these can never ride transcoding);
//   - /metrics: promhttp off the default registry. In module mode the
//     embedded telemetry's collector_* counters self-register into this
//     process at init, so one endpoint exposes both testkit and telemetry
//     metrics.
func registerGateway(svc *service.Service) grpcx.RegisterGatewayFunc {
	return func(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
		if err := testkitv1.RegisterTestkitServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
			return err
		}
		// Ingestion routes are the gateway's own registration; grpc-gateway
		// resolves the token path parameter and hands it to the
		// routing-agnostic endpoint handler (no inner mux re-matching).
		backend := svc.Telemetry().Backend()
		if err := mux.HandlePath(http.MethodPost, "/v1/e/{token}/events", func(w http.ResponseWriter, r *http.Request, params map[string]string) {
			ingesthttp.Endpoint(backend, params["token"]).ServeHTTP(w, r)
		}); err != nil {
			return err
		}
		if err := mux.HandlePath(http.MethodPost, "/v1/collect/events", func(w http.ResponseWriter, r *http.Request, _ map[string]string) {
			ingesthttp.Bearer(backend).ServeHTTP(w, r)
		}); err != nil {
			return err
		}
		return mux.HandlePath(http.MethodGet, "/metrics", func(w http.ResponseWriter, r *http.Request, _ map[string]string) {
			promhttp.Handler().ServeHTTP(w, r)
		})
	}
}

// Start starts service internals and the gRPC + HTTP gateway without blocking.
//
// On partial failure, started components are rolled back via Stop.
func (s *Server) Start() error {
	if err := s.hdl.Start(); err != nil {
		return err
	}
	if err := s.grpcSrv.Start(); err != nil {
		return errors.Join(err, s.hdl.Stop())
	}
	return nil
}

// Stop gracefully stops the gRPC + HTTP gateway and service internals.
// Errors from each component are aggregated via errors.Join.
func (s *Server) Stop() error {
	return errors.Join(s.grpcSrv.Stop(), s.hdl.Stop())
}
