package gid_test

import (
	"context"
	"testing"

	gidv1 "github.com/servekit/api/gen/go/gid/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/gid"
	"github.com/stretchr/testify/require"
)

// stubClient stands in for the gid dependency without a real handler. It
// embeds gidv1.UnimplementedGidServiceServer so it satisfies the full
// gidservice.Service; each overridden method returns the canned value its
// fields hold, and untested methods fall through to Unimplemented.
type stubClient struct {
	gidv1.UnimplementedGidServiceServer
	nextID     int64
	ids        []int64
	decomposed *gidv1.DecomposeResponse
}

func (s *stubClient) NextID(ctx context.Context, req *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error) {
	return &gidv1.NextIDResponse{Id: s.nextID}, nil
}

func (s *stubClient) BatchNextID(ctx context.Context, req *gidv1.BatchNextIDRequest) (*gidv1.BatchNextIDResponse, error) {
	return &gidv1.BatchNextIDResponse{Ids: s.ids}, nil
}

func (s *stubClient) Decompose(ctx context.Context, req *gidv1.DecomposeRequest) (*gidv1.DecomposeResponse, error) {
	return s.decomposed, nil
}

func TestNextID_MapsResponse(t *testing.T) {
	svc := gid.New(&stubClient{nextID: 42})
	resp, err := svc.NextID(context.Background(), &testkitv1.NextIDRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(42), resp.GetId())
}

func TestBatchNextID_MapsResponse(t *testing.T) {
	svc := gid.New(&stubClient{ids: []int64{1, 2, 3}})
	resp, err := svc.BatchNextID(context.Background(), &testkitv1.BatchNextIDRequest{Count: 3})
	require.NoError(t, err)
	require.Equal(t, []int64{1, 2, 3}, resp.GetIds())
}

func TestDecompose_MapsAllFields(t *testing.T) {
	in := &gidv1.DecomposeResponse{
		Time:        1700000000000,
		Sequence:    5,
		MachineId:   7,
		GeneratedAt: "2026-07-29T00:00:00Z",
	}
	svc := gid.New(&stubClient{decomposed: in})
	resp, err := svc.Decompose(context.Background(), &testkitv1.DecomposeRequest{Id: 999})
	require.NoError(t, err)
	require.Equal(t, in.Time, resp.GetTime())
	require.Equal(t, in.Sequence, resp.GetSequence())
	require.Equal(t, in.MachineId, resp.GetMachineId())
	require.Equal(t, in.GeneratedAt, resp.GetGeneratedAt())
}

func TestDecompose_NilDownstreamResponse(t *testing.T) {
	svc := gid.New(&stubClient{})
	resp, err := svc.Decompose(context.Background(), &testkitv1.DecomposeRequest{Id: 1})
	require.NoError(t, err)
	require.Nil(t, resp)
}
