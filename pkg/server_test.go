// Edge-auth wiring smoke over a real listener: HTTP request → usauth edge
// middleware → tenant gate → grpc-gateway transcoding →
// TrustedIdentityUnary → handler ctx. This mirrors NewServer's wiring
// (pkg/server.go) with the domain services stubbed out, pinning the
// end-to-end contract the frontend depends on — including the phase ④
// trusted x-tenant-key injection crossing the transcode boundary.
package pkg_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	portalv1 "github.com/servekit/api/gen/go/portal/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	pb "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
	userservice "github.com/servekit/user-service/pkg"
	usauth "github.com/servekit/user-service/pkg/auth"
	usclientinfo "github.com/servekit/user-service/pkg/clientinfo"

	"github.com/servekit/testkit-service/internal/tenantgate"
)

// fakeSessions backs the edge middleware: sess-7 → user 7 (END_USER),
// sess-8 → user 8 (TENANT_ADMIN, bound to ten_alpha via stubPortal).
type fakeSessions struct{}

func (fakeSessions) GetSession(_ context.Context, req *pb.GetSessionRequest) (*pb.GetSessionResponse, error) {
	switch req.GetSessionId() {
	case "sess-7":
		return &pb.GetSessionResponse{UserId: 7, UserType: pb.UserType_USER_TYPE_END_USER}, nil
	case "sess-8":
		return &pb.GetSessionResponse{
			UserId:    8,
			UserType:  pb.UserType_USER_TYPE_TENANT_ADMIN,
			TenantKey: "ten_platform",
		}, nil
	}
	return nil, errors.New("session invalid")
}

// stubPortal backs the tenant gate: user 8 is bound to ten_alpha only.
type stubPortal struct{}

func (stubPortal) WhoAmI(_ context.Context, _ *emptypb.Empty) (*portalv1.WhoAmIResponse, error) {
	return &portalv1.WhoAmIResponse{
		UserId:      8,
		Memberships: []*portalv1.TenantMembership{{TenantKey: "ten_alpha", TenantName: "Alpha"}},
	}, nil
}

func (stubPortal) ListTenants(_ context.Context, _ *portalv1.ListTenantsRequest) (*portalv1.ListTenantsResponse, error) {
	return &portalv1.ListTenantsResponse{
		Tenants: []*portalv1.TenantInfo{{TenantKey: "ten_alpha"}, {TenantKey: "ten_beta"}},
	}, nil
}

// stubTestkit implements just the three RPCs the smoke drives; everything
// else stays Unimplemented. Login captures the incoming metadata so the test
// can assert client info crossed the transcode boundary; GetProfile captures
// it to assert the gate's trusted tenant key did too — and then makes a REAL
// downstream gRPC hop through the production user-service Client, so the
// tests can assert the injected key also survives leaving this process.
type stubTestkit struct {
	testkitv1.UnimplementedTestkitServiceServer

	loginMD   metadata.MD
	profileMD metadata.MD

	// hop is the downstream user-service client GetProfile calls; hopStub is
	// the capture backend it dials. Both nil disables the hop.
	hop     *userservice.Client
	hopStub *captureUserStub
}

func (*stubTestkit) Ping(context.Context, *emptypb.Empty) (*commonv1.Pong, error) {
	return &commonv1.Pong{Status: "SERVING"}, nil
}

func (s *stubTestkit) Login(ctx context.Context, _ *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		s.loginMD = md
	}
	// The bearer token is the session id — mirroring the auth domain's
	// toTokenResponse after the JWT removal.
	return &testkitv1.TokenResponse{Token: "sess-7", SessionId: "sess-7"}, nil
}

func (s *stubTestkit) GetProfile(ctx context.Context, _ *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		s.profileMD = md
	}
	actor, err := grpcx.MustActorFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	if s.hop != nil {
		// The grpc-mode BFF shape: the handler ctx (gate-injected key lifted
		// by the unary chain) flows into a downstream Client call.
		if _, err := s.hop.Ping(ctx, &emptypb.Empty{}); err != nil {
			return nil, err
		}
	}
	return &testkitv1.User{Id: actor.GetUserId()}, nil
}

// captureUserStub is the downstream user-service stand-in: Ping records the
// incoming metadata — the wire-path view the real user-service would see.
type captureUserStub struct {
	pb.UnimplementedUserServiceServer

	mu sync.Mutex
	md metadata.MD
}

func (s *captureUserStub) Ping(ctx context.Context, _ *emptypb.Empty) (*commonv1.Pong, error) {
	s.mu.Lock()
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		s.md = md
	}
	s.mu.Unlock()
	return &commonv1.Pong{Status: "SERVING"}, nil
}

// captured returns the recorded incoming metadata.
func (s *captureUserStub) captured() metadata.MD {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.md
}

func freeAddr(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := lis.Addr().String()
	require.NoError(t, lis.Close())
	return addr
}

func newSmokeServer(t *testing.T) (*stubTestkit, string) {
	t.Helper()
	grpcAddr := freeAddr(t)
	gwAddr := freeAddr(t)

	// Downstream stand-in: a real gRPC server the stub handler hops to via
	// the production user-service Client, so the smoke can prove identity
	// survives leaving this process (the grpc-mode shape).
	backend := &captureUserStub{}
	blis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	bgs := grpc.NewServer()
	pb.RegisterUserServiceServer(bgs, backend)
	go func() { _ = bgs.Serve(blis) }()
	t.Cleanup(bgs.Stop)
	hop, err := userservice.NewClient(blis.Addr().String())
	require.NoError(t, err)
	t.Cleanup(func() { _ = hop.Close() })

	// Same middleware shape as NewServer: the public routes of the real
	// wiring, reduced to the ones this smoke exercises, plus the tenant gate
	// inside the edge middleware exactly as NewServer mounts it.
	edgeAuth := usauth.NewMiddleware(fakeSessions{},
		usauth.WithPublicPaths("/ping", "/api/v1/auth/login"),
	)
	gate := tenantgate.NewGate(tenantgate.NewResolver(stubPortal{}))
	stub := &stubTestkit{hop: hop, hopStub: backend}

	srv := grpcx.New(
		&grpcx.ServerConfig{
			GRPCAddr:    grpcAddr,
			GatewayAddr: gwAddr,
			GatewayWrap: func(next http.Handler) http.Handler {
				return usclientinfo.Wrap(edgeAuth.Wrap(gate.Wrap(next)))
			},
		},
		func(gs *grpc.Server) {
			testkitv1.RegisterTestkitServiceServer(gs, stub)
		},
		func(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
			return testkitv1.RegisterTestkitServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)
		},
		// Chain mirrors NewServer's, including the trusted-tenant-key lift:
		// the gate's wire header crossed the transcode as incoming metadata;
		// the lift turns it into the ctx value the downstream Clients'
		// ForwardTenantKeyUnary reads for further real gRPC hops.
		grpcx.ErrorInterceptor,
		grpcx.TrustedActorUnary(),
		tenantctx.TrustedTenantKeyUnary(),
	)
	require.NoError(t, srv.Start())
	t.Cleanup(func() { _ = srv.Stop() })
	return stub, gwAddr
}

// mdValue returns the first value for key, case-insensitively: the gateway's
// annotation leaves canonical casing on metadata keys.
func mdValue(md metadata.MD, key string) string {
	for k, vals := range md {
		if len(vals) > 0 && strings.EqualFold(k, key) {
			return vals[0]
		}
	}
	return ""
}

func get(t *testing.T, url, bearer string, hdr map[string]string) (*http.Response, string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	require.NoError(t, err)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	return resp, string(body)
}

func TestEdgeAuth_EndToEnd(t *testing.T) {
	stub, gw := newSmokeServer(t)
	waitReachable(t, "http://"+gw+"/ping")

	t.Run("public ping without token", func(t *testing.T) {
		resp, body := get(t, "http://"+gw+"/ping", "", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Contains(t, body, "SERVING")
	})

	t.Run("protected route without token rejected at the edge", func(t *testing.T) {
		resp, _ := get(t, "http://"+gw+"/api/v1/profile", "", nil)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("invalid session rejected at the edge", func(t *testing.T) {
		resp, _ := get(t, "http://"+gw+"/api/v1/profile", "not-a-session", nil)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("login returns session id as token and captures client info", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, "http://"+gw+"/api/v1/auth/login",
			strings.NewReader(`{"method":"LOGIN_METHOD_EMAIL_PASSWORD","email":"a@b.c","password":"x"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "smoke-agent/1.0 (test)")
		// The edge proxy's view: the real client first, proxy chain behind.
		req.Header.Set("X-Forwarded-For", "203.0.113.9, 10.0.0.2")
		resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		require.NoError(t, err)
		body, rerr := io.ReadAll(resp.Body)
		require.NoError(t, rerr)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var tok struct {
			Token     string `json:"token"`
			SessionID string `json:"sessionId"`
		}
		require.NoError(t, json.Unmarshal(body, &tok))
		require.Equal(t, "sess-7", tok.Token)
		require.Equal(t, "sess-7", tok.SessionID)

		// The clientinfo middleware stamped the caller environment at the
		// edge; it must arrive server-side as metadata — this is the pipe
		// user-service reads via clientinfo.FromCtx at login.
		require.Equal(t, "203.0.113.9", mdValue(stub.loginMD, "x-client-ip"))
		require.Contains(t, mdValue(stub.loginMD, "x-client-ua"), "smoke-agent/1.0")
	})

	t.Run("valid session reaches handler with verified identity", func(t *testing.T) {
		resp, body := get(t, "http://"+gw+"/api/v1/profile", "sess-7", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		// protojson emits int64 as a string; GetProfile echoes the ctx user id.
		require.Contains(t, body, `"id":"7"`)
	})

	t.Run("spoofed actor header is stripped", func(t *testing.T) {
		spoofed, err := grpcx.MarshalActor(&commonv1.RequestActor{UserId: 666})
		require.NoError(t, err)
		resp, body := get(t, "http://"+gw+"/api/v1/profile", "sess-7",
			map[string]string{grpcx.WireActorHeader: spoofed})
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Contains(t, body, `"id":"7"`)
		require.NotContains(t, body, "666")
	})

	t.Run("tenant gate injects trusted key across the transcode boundary", func(t *testing.T) {
		// TENANT_ADMIN bound to exactly ten_alpha: no explicit choice
		// defaults to it, and the injected key must arrive server-side as
		// x-tenant-key incoming metadata (the module-mode credential gates
		// read exactly this).
		resp, _ := get(t, "http://"+gw+"/api/v1/profile", "sess-8", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "ten_alpha", mdValue(stub.profileMD, tenantctx.HeaderTenantKey))
	})

	t.Run("injected tenant key survives a real downstream gRPC hop", func(t *testing.T) {
		// ④ grpc-mode wire path: gate injects ten_alpha → grpc-gateway
		// transcode carries it as incoming metadata → the unary chain lifts
		// it into the handler ctx value → the downstream user-service Client
		// forwards it on a REAL gRPC hop. The module-mode half (metadata read
		// in-process) is the subtest above; this one proves the key leaves
		// the process — without the lift+forward pair the remote
		// tenant-resolver sees no tenant identity and fails closed.
		resp, _ := get(t, "http://"+gw+"/api/v1/profile", "sess-8", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, "ten_alpha", mdValue(stub.hopStub.captured(), tenantctx.HeaderTenantKey),
			"the gate-injected key must reach the downstream service over the wire")
	})

	t.Run("tenant gate strips smuggled tenant key", func(t *testing.T) {
		// END_USER carrying both a smuggled trusted key and a switcher
		// choice: the choice is refused outright (fail closed)...
		resp, _ := get(t, "http://"+gw+"/api/v1/profile", "sess-7",
			map[string]string{
				tenantgate.WireTenantKeyHeader:  "ten_victim",
				tenantgate.HeaderTenantChoice:   "ten_victim",
				tenantgate.PlainTenantKeyHeader: "ten_victim",
			})
		require.Equal(t, http.StatusForbidden, resp.StatusCode)

		// ...and without the choice the smuggled keys never survive the door.
		resp, body := get(t, "http://"+gw+"/api/v1/profile", "sess-7",
			map[string]string{tenantgate.WireTenantKeyHeader: "ten_victim"})
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Contains(t, body, `"id":"7"`)
		require.Empty(t, mdValue(stub.profileMD, tenantctx.HeaderTenantKey))
	})

	t.Run("tenant gate injects console directory on public routes", func(t *testing.T) {
		// Login is public (no session yet): the credential surface behind it
		// operates in the reserved console directory.
		req, err := http.NewRequest(http.MethodPost, "http://"+gw+"/api/v1/auth/login",
			strings.NewReader(`{"method":"LOGIN_METHOD_EMAIL_PASSWORD","email":"a@b.c","password":"x"}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
		require.NoError(t, err)
		_, rerr := io.ReadAll(resp.Body)
		require.NoError(t, rerr)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Equal(t, tenantgate.ConsoleTenantKey, mdValue(stub.loginMD, tenantctx.HeaderTenantKey))
	})
}

// waitReachable polls until the gateway answers (Start serves in background
// goroutines).
func waitReachable(t *testing.T, url string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("gateway not reachable at %s", url)
}
