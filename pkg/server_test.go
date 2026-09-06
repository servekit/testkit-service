// Edge-auth wiring smoke over a real listener: HTTP request → usauth edge
// middleware → grpc-gateway transcoding → TrustedIdentityUnary → handler ctx.
// This mirrors NewServer's wiring (pkg/server.go) with the domain services
// stubbed out, pinning the end-to-end contract the frontend depends on.
package pkg_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	pb "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	usauth "github.com/servekit/user-service/pkg/auth"
	usclientinfo "github.com/servekit/user-service/pkg/clientinfo"
)

// fakeSessions backs the edge middleware: sess-7 → user 7.
type fakeSessions struct{}

func (fakeSessions) GetSession(_ context.Context, req *pb.GetSessionRequest) (*pb.GetSessionResponse, error) {
	if req.GetSessionId() == "sess-7" {
		return &pb.GetSessionResponse{UserId: 7}, nil
	}
	return nil, errors.New("session invalid")
}

// stubTestkit implements just the three RPCs the smoke drives; everything
// else stays Unimplemented. Login captures the incoming metadata so the test
// can assert client info crossed the transcode boundary.
type stubTestkit struct {
	testkitv1.UnimplementedTestkitServiceServer

	loginMD metadata.MD
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

func (stubTestkit) GetProfile(ctx context.Context, _ *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
	uid, err := grpcx.GetUserIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return &testkitv1.User{Id: uid}, nil
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

	// Same middleware shape as NewServer: the public routes of the real
	// wiring, reduced to the ones this smoke exercises.
	edgeAuth := usauth.NewMiddleware(fakeSessions{},
		usauth.WithPublicPaths("/ping", "/api/v1/auth/login"),
	)
	stub := &stubTestkit{}

	srv := grpcx.New(
		&grpcx.ServerConfig{
			GRPCAddr:    grpcAddr,
			GatewayAddr: gwAddr,
			GatewayWrap: func(next http.Handler) http.Handler {
				return usclientinfo.Wrap(edgeAuth.Wrap(next))
			},
		},
		func(gs *grpc.Server) {
			testkitv1.RegisterTestkitServiceServer(gs, stub)
		},
		func(ctx context.Context, mux *runtime.ServeMux, endpoint string, opts []grpc.DialOption) error {
			return testkitv1.RegisterTestkitServiceHandlerFromEndpoint(ctx, mux, endpoint, opts)
		},
		grpcx.ErrorInterceptor,
		usauth.TrustedIdentityUnary(),
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

	t.Run("spoofed identity header is stripped", func(t *testing.T) {
		resp, body := get(t, "http://"+gw+"/api/v1/profile", "sess-7",
			map[string]string{"Grpc-Metadata-X-User-Id": "666"})
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.Contains(t, body, `"id":"7"`)
		require.NotContains(t, body, "666")
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
