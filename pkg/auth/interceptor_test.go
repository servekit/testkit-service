package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr"
	"github.com/servekit/go-common/xerr/xcodes"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/servekit/testkit-service/internal/jwt"
	"github.com/servekit/testkit-service/pkg/auth"
)

// stubResolver is a stand-in for the user-service GetSession bridge. It maps a
// session id to a user id, or returns an error when told to.
type stubResolver struct {
	userID int64
	err    error
}

func (s stubResolver) asResolver() auth.SessionResolver {
	return func(_ context.Context, sessionID string) (int64, error) {
		if s.err != nil {
			return 0, s.err
		}
		if sessionID == "missing" {
			return 0, errors.New("session not found")
		}
		return s.userID, nil
	}
}

const (
	publicMethod    = "/testkit.v1.TestKitService/Ping"
	protectedMethod = "/testkit.v1.TestKitService/Protected"
)

func newManager(t *testing.T) *jwt.Manager {
	t.Helper()
	m, err := jwt.NewManager("test-secret", time.Hour)
	require.NoError(t, err)
	return m
}

func withBearer(ctx context.Context, token string) context.Context {
	return metadata.NewIncomingContext(ctx, metadata.Pairs("authorization", "Bearer "+token))
}

// requireUnauthorized asserts the error maps to the predefined ErrUnauthorized
// code (category Unauthorized, 401) — the single shape clients see for any
// auth-path failure.
func requireUnauthorized(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	var xe *xerr.Error
	require.ErrorAs(t, err, &xe)
	require.Equal(t, xerr.CategoryUnauthorized, xe.Category())
	require.ErrorIs(t, err, xcodes.ErrUnauthorized.New())
}

func TestInterceptor_PublicMethod_PassesWithoutToken(t *testing.T) {
	ic := auth.NewInterceptor(newManager(t), stubResolver{}.asResolver(),
		auth.WithPublicMethods(publicMethod))

	info := &grpc.UnaryServerInfo{FullMethod: publicMethod}
	resp, err := ic.Unary()(context.Background(), nil, info, func(_ context.Context, _ any) (any, error) {
		return "pong", nil
	})
	require.NoError(t, err)
	require.Equal(t, "pong", resp)
}

func TestInterceptor_ValidToken_InjectsUserAndSession(t *testing.T) {
	m := newManager(t)
	const sid = "sess-42"
	tok, err := m.Sign(sid)
	require.NoError(t, err)

	ic := auth.NewInterceptor(m, stubResolver{userID: 7}.asResolver(),
		auth.WithPublicMethods(publicMethod))

	var (
		gotUserID    int64
		gotSessionID string
	)
	handler := func(ctx context.Context, _ any) (any, error) {
		uid, uerr := grpcx.GetUserIDFromCtx(ctx)
		require.NoError(t, uerr)
		gotUserID = uid

		s, serr := auth.SessionIDFromCtx(ctx)
		require.NoError(t, serr)
		gotSessionID = s
		return "ok", nil
	}

	info := &grpc.UnaryServerInfo{FullMethod: protectedMethod}
	_, err = ic.Unary()(withBearer(context.Background(), tok), nil, info, handler)
	require.NoError(t, err)
	require.Equal(t, int64(7), gotUserID)
	require.Equal(t, sid, gotSessionID)
}

func TestInterceptor_Rejections(t *testing.T) {
	m := newManager(t)
	validTok, err := m.Sign("sess-ok")
	require.NoError(t, err)

	expiredMgr, err := jwt.NewManager("test-secret", -time.Hour)
	require.NoError(t, err)
	expiredTok, err := expiredMgr.Sign("sess-expired")
	require.NoError(t, err)

	otherMgr, err := jwt.NewManager("other-secret", time.Hour)
	require.NoError(t, err)
	badSigTok, err := otherMgr.Sign("sess-other")
	require.NoError(t, err)

	tests := []struct {
		name    string
		ctx     context.Context
		resolve auth.SessionResolver
	}{
		{
			name:    "no metadata on protected method",
			ctx:     context.Background(),
			resolve: stubResolver{userID: 1}.asResolver(),
		},
		{
			name:    "missing authorization header",
			ctx:     metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-other", "v")),
			resolve: stubResolver{userID: 1}.asResolver(),
		},
		{
			name:    "malformed token",
			ctx:     withBearer(context.Background(), "not-a-jwt"),
			resolve: stubResolver{userID: 1}.asResolver(),
		},
		{
			name:    "expired token",
			ctx:     withBearer(context.Background(), expiredTok),
			resolve: stubResolver{userID: 1}.asResolver(),
		},
		{
			name:    "bad signature",
			ctx:     withBearer(context.Background(), badSigTok),
			resolve: stubResolver{userID: 1}.asResolver(),
		},
		{
			name:    "resolver returns error (session revoked)",
			ctx:     withBearer(context.Background(), validTok),
			resolve: stubResolver{err: errors.New("user-service down")}.asResolver(),
		},
		{
			name: "resolver cannot resolve session id",
			ctx: func() context.Context {
				t2, e := jwt.NewManager("test-secret", time.Hour)
				require.NoError(t, e)
				tk, e := t2.Sign("missing")
				require.NoError(t, e)
				return withBearer(context.Background(), tk)
			}(),
			resolve: stubResolver{userID: 9}.asResolver(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ic := auth.NewInterceptor(m, tt.resolve, auth.WithPublicMethods(publicMethod))
			info := &grpc.UnaryServerInfo{FullMethod: protectedMethod}
			called := false
			_, err := ic.Unary()(tt.ctx, nil, info, func(context.Context, any) (any, error) {
				called = true
				return nil, nil
			})
			requireUnauthorized(t, err)
			require.False(t, called, "handler must not run on auth failure")
		})
	}
}

func TestSessionIDFromCtx_Missing(t *testing.T) {
	_, err := auth.SessionIDFromCtx(context.Background())
	require.Error(t, err)
}
