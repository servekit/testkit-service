package adapter_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	gidv1 "github.com/servekit/gid-service/gen/gid/v1"
	messagev1 "github.com/servekit/message-service/gen/message/v1"
	msgthirdcall "github.com/servekit/message-service/pkg/thirdcall"
	storthirdcall "github.com/servekit/storage-service/pkg/thirdcall"
	usrthirdcall "github.com/servekit/user-service/pkg/thirdcall"

	"github.com/servekit/testkit-service/internal/adapter"
)

// Compile-time assertions that the adapters structurally satisfy every
// downstream's thirdcall interface. This is the whole point of the adapter:
// user, storage, and message each declare their OWN pkg/thirdcall.GIDService
// (identical NextID(ctx)(int64, error) shape, distinct Go types), and
// user-service declares its own MessageService. One *adapter.GIDAdapter /
// *adapter.MessageAdapter satisfies all of them via Go structural typing, so
// testkit shares a single gid handler and message handler across downstreams.
var (
	_ msgthirdcall.GIDService     = (*adapter.GIDAdapter)(nil)
	_ storthirdcall.GIDService    = (*adapter.GIDAdapter)(nil)
	_ usrthirdcall.GIDService     = (*adapter.GIDAdapter)(nil)
	_ usrthirdcall.MessageService = (*adapter.MessageAdapter)(nil)
)

// stubGIDCaller implements adapter.GIDCaller without a real gid handler.
type stubGIDCaller struct {
	id  int64
	err error
}

func (s *stubGIDCaller) NextID(_ context.Context, _ *gidv1.NextIDRequest) (*gidv1.NextIDResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &gidv1.NextIDResponse{Id: s.id}, nil
}

func TestGIDAdapter_NextID(t *testing.T) {
	a := adapter.NewGIDAdapter(&stubGIDCaller{id: 42})
	id, err := a.NextID(context.Background())
	require.NoError(t, err)
	require.Equal(t, int64(42), id)
}

func TestGIDAdapter_NextID_PropagatesError(t *testing.T) {
	want := errors.New("gid unavailable")
	a := adapter.NewGIDAdapter(&stubGIDCaller{err: want})
	id, err := a.NextID(context.Background())
	require.ErrorIs(t, err, want)
	require.Equal(t, int64(0), id)
}

// stubMessageCaller implements adapter.MessageCaller without a real message
// handler. SendEmail/SendSMS echo an id so we can assert forwarding.
type stubMessageCaller struct{}

func (stubMessageCaller) SendEmail(_ context.Context, req *messagev1.SendEmailRequest) (*messagev1.SendResponse, error) {
	return &messagev1.SendResponse{Id: 11}, nil
}

func (stubMessageCaller) SendSMS(_ context.Context, req *messagev1.SendSMSRequest) (*messagev1.SendResponse, error) {
	return &messagev1.SendResponse{Id: 22}, nil
}

func TestMessageAdapter_ForwardsAndCloses(t *testing.T) {
	a := adapter.NewMessageAdapter(stubMessageCaller{})

	emailResp, err := a.SendEmail(context.Background(), &messagev1.SendEmailRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(11), emailResp.GetId())

	smsResp, err := a.SendSMS(context.Background(), &messagev1.SendSMSRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(22), smsResp.GetId())

	// Close is a no-op (lifecycle owned by testkit, not user-service).
	require.NoError(t, a.Close())
}
