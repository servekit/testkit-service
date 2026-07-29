package adapter_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	userv1 "github.com/servekit/user-service/gen/user/v1"

	"github.com/servekit/testkit-service/internal/adapter"
)

// stubSessionCaller is a minimal SessionCaller for the resolver test.
type stubSessionCaller struct {
	userID int64
	err    error
}

func (s stubSessionCaller) GetSession(_ context.Context, req *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &userv1.GetSessionResponse{UserId: s.userID}, nil
}

func TestNewSessionResolver_OK(t *testing.T) {
	resolve := adapter.NewSessionResolver(stubSessionCaller{userID: 42})
	uid, err := resolve(context.Background(), "sess-1")
	require.NoError(t, err)
	require.Equal(t, int64(42), uid)
}

func TestNewSessionResolver_DownstreamError(t *testing.T) {
	// A downstream error surfaces wrapped via %w so the interceptor (and
	// callers) can inspect it; the resolver itself does not normalize.
	downstream := status.Error(codes.NotFound, "no such session")
	resolve := adapter.NewSessionResolver(stubSessionCaller{err: downstream})
	_, err := resolve(context.Background(), "sess-x")
	require.Error(t, err)
	require.ErrorIs(t, err, downstream)
}
