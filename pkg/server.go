// Package pkg is the public surface of testkit-service. It wires internal pieces
// into a runnable gRPC/HTTP server, a gRPC client, and an in-process module
// entry point. Downstream services that depend on testkit-service should import
// this package — not internal/*.
package pkg

import (
	"errors"

	"buf.build/go/protovalidate"
	protovalidate_middleware "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/protovalidate"
	"google.golang.org/grpc"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/signalx"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/adapter"
	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/auth"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/handler"
	"github.com/servekit/testkit-service/pkg/option"
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

// ServerOption configures a Server instance.
type ServerOption func(*serverOptions)

type serverOptions struct {
	serviceOpts []option.Option
}

// WithServiceOptions forwards options to the service layer.
func WithServiceOptions(opts ...option.Option) ServerOption {
	return func(o *serverOptions) { o.serviceOpts = append(o.serviceOpts, opts...) }
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
func NewServer(cfg *config.Config, opts ...ServerOption) (*Server, error) {
	var so serverOptions
	for _, opt := range opts {
		opt(&so)
	}

	svc, err := service.New(cfg, so.serviceOpts...)
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
	resolver := adapter.NewSessionResolver(svc.UserHandler())
	authIntercept := auth.NewInterceptor(
		jwtMgr,
		resolver,
		auth.WithPublicMethods(
			"/testkit.v1.TestkitService/Ping",
			"/testkit.v1.TestkitService/Login",
			"/testkit.v1.TestkitService/Register",
			"/testkit.v1.TestkitService/SendVerificationCode",
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
		testkitv1.RegisterTestkitServiceHandlerFromEndpoint,
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
