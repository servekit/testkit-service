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
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/config"
	"github.com/servekit/testkit-service/pkg/handler"
	usauth "github.com/servekit/user-service/pkg/auth"
	usclientinfo "github.com/servekit/user-service/pkg/clientinfo"

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
// Authentication is edge-first: the HTTP gateway is wrapped by the
// user-service auth middleware (user-service pkg/auth), which verifies the
// bearer token — a user-service session id, validate-on-use so every request
// slides the session TTL — against the embedded user-service and answers 401
// in HTTP before the request reaches transcoding. On success it writes the
// serialized verified actor into the single trusted Grpc-Metadata-X-Actor
// header, which grpc-gateway forwards as gRPC metadata; the gRPC chain below
// only lifts that actor into the handler ctx.
//
// The gRPC server runs a three-interceptor chain (outermost first):
//   - grpcx.ErrorInterceptor: maps *xerr.Error returned by inner layers to
//     gRPC status codes (Unauthorized → Unauthenticated/401, NotFound → 404,
//     BadRequest → InvalidArgument/400, ...).
//   - grpcx.TrustedActorUnary: copies the trusted x-actor metadata set by
//     the edge middleware into the handler ctx as the RequestActor. It
//     performs NO verification — the gRPC port is internal-only (nginx
//     exposes only the gateway), the same trusted-network posture as the
//     other embedded services. Requests without actor metadata pass
//     through; handlers that need identity enforce its presence themselves.
//   - protovalidate.UnaryServerInterceptor: enforces (buf.validate.field)
//     rules declared in testkit.proto.
//
// The HTTP gateway auto-registers via testkitv1.RegisterTestkitServiceHandlerFromEndpoint
// when cfg.Server.GatewayAddr is non-empty. grpc-gateway forwards the HTTP
// Authorization header to gRPC metadata under the unprefixed "authorization"
// key by default (verified in grpc-gateway runtime/context.go), and custom
// headers under the Grpc-Metadata- prefix — which is how the middleware's
// actor header crosses the transcode boundary.
func NewServer(cfg *config.Config) (*Server, error) {
	svc, err := service.New(cfg)
	if err != nil {
		return nil, err
	}

	hdl := handler.New(svc)

	// Edge auth middleware over the whole gateway surface: transcoded RPC
	// routes, the telemetry raw-ingest routes, and /metrics. The public list
	// mirrors the proto's google.api.http annotations of the public RPCs plus
	// the raw routes the gateway hosts (which carry their own credentials —
	// HMAC for ingest, none for metrics).
	edgeAuth := usauth.NewMiddleware(
		svc.UserService(),
		usauth.WithPublicPaths(
			"/ping",
			"/api/v1/auth/login",
			"/api/v1/auth/register",
			"/api/v1/captcha/send",
			// Static region directory — region pickers render pre-login
			// (the register page needs dial codes before any session exists).
			"/api/v1/region-codes",
			// Timezone/language directories for the same pre-login register
			// form's pickers — static reference data, nothing sensitive.
			"/api/v1/reference/timezones",
			"/api/v1/reference/languages",
			// Password reset is code-based (no caller identity).
			"/api/v1/auth/password-reset",
			// Raw routes with their own credentials (never session-gated).
			"/v1/collect/events",
			"/metrics",
		),
		usauth.WithPublicPrefixes(
			// Social login starts before the caller has a session —
			// GetOAuthURL/{provider}/url plus the three login completions
			// (social/login, social/miniprogram, social/miniprogram/phone)
			// are the only routes under /api/v1/social/.
			"/api/v1/social/",
			// File-link recipients are anonymous external users (links
			// embedded in sent emails) — the link token is the credential.
			"/api/v1/links/",
			// Telemetry raw ingestion: HMAC over the raw body bytes.
			"/v1/e/",
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
			// clientinfo sits OUTSIDE the auth middleware so it stamps every
			// request — login is a public route, and client capture at login
			// (session rows, login logs) is exactly what it exists for.
			GatewayWrap: func(next http.Handler) http.Handler {
				return usclientinfo.Wrap(edgeAuth.Wrap(next))
			},
		},
		func(gs *grpc.Server) {
			testkitv1.RegisterTestkitServiceServer(gs, hdl)
		},
		registerGateway(svc),
		// Chain order is outermost-first (grpc.ChainUnaryInterceptor).
		// ErrorInterceptor maps *xerr.Error rejections (and protovalidate's)
		// to gRPC status / HTTP codes.
		grpcx.ErrorInterceptor,
		grpcx.TrustedActorUnary(),
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
		// The internal hop carries the BFF's ak/sk (business identity); the
		// end-user contract (token in path / bearer) is unchanged.
		ingestOpts := svc.Telemetry().IngestHTTPOptions()
		if err := mux.HandlePath(http.MethodPost, "/v1/e/{token}/events", func(w http.ResponseWriter, r *http.Request, params map[string]string) {
			ingesthttp.Endpoint(backend, params["token"], ingestOpts).ServeHTTP(w, r)
		}); err != nil {
			return err
		}
		if err := mux.HandlePath(http.MethodPost, "/v1/collect/events", func(w http.ResponseWriter, r *http.Request, _ map[string]string) {
			ingesthttp.Bearer(backend, ingestOpts).ServeHTTP(w, r)
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
