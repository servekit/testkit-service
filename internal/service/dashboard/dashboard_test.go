package dashboard_test

import (
	"context"
	"errors"
	"testing"

	"github.com/servekit/go-common/grpcx"
	messagev1 "github.com/servekit/message-service/gen/message/v1"
	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/dashboard"
	userv1 "github.com/servekit/user-service/gen/user/v1"
	"github.com/stretchr/testify/require"
)

// --- stubs implement dashboard's thirdcall seams (thirdcall{user,storage,
// message}.{User,Storage,Message}Service). Each embeds the downstream's
// Unimplemented*Server (so it satisfies the full RPC method set) and overrides
// only the method(s) the dashboard exercises, plus Close for the lifecycle
// seam. ---

type stubUser struct {
	userv1.UnimplementedUserServiceServer

	total         int64
	receivedCount bool
	receivedSize  int32
	err           error
}

func (s *stubUser) ListUsersPaged(_ context.Context, req *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.receivedCount = req.GetCount()
	s.receivedSize = req.GetPageSize()
	return &userv1.ListUsersPagedResponse{Total: s.total}, nil
}

func (s *stubUser) Close() error { return nil }

type stubStorage struct {
	storagev1.UnimplementedStorageServiceServer

	quota         *storagev1.QuotaInfo
	receivedOwner *storagev1.Owner
	err           error
}

func (s *stubStorage) GetMyQuota(ctx context.Context, req *storagev1.GetMyQuotaRequest) (*storagev1.QuotaInfo, error) {
	if s.err != nil {
		return nil, s.err
	}
	s.receivedOwner = req.GetOwner()
	return s.quota, nil
}

func (s *stubStorage) Close() error { return nil }

type stubMessage struct {
	messagev1.UnimplementedMessageServiceServer

	email *messagev1.EmailStatsResponse
	sms   *messagev1.SMSStatsResponse
	err   error
}

func (s *stubMessage) GetEmailStats(ctx context.Context, req *messagev1.GetEmailStatsRequest) (*messagev1.EmailStatsResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.email, nil
}

func (s *stubMessage) GetSMSStats(ctx context.Context, req *messagev1.GetSMSStatsRequest) (*messagev1.SMSStatsResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.sms, nil
}

func (s *stubMessage) Close() error { return nil }

func ctxWithUser(id int64) context.Context {
	return context.WithValue(context.Background(), grpcx.UserIDKey, id)
}

func TestGetDashboard_AssemblesAllFour(t *testing.T) {
	userStub := &stubUser{total: 1234}
	svc := dashboard.New(
		userStub,
		&stubStorage{quota: &storagev1.QuotaInfo{TotalBytes: 1000, UsedBytes: 400, AvailableBytes: 600, FileCount: 9}},
		&stubMessage{
			email: &messagev1.EmailStatsResponse{
				Total: 50, Sent: 48, Failed: 2, SuccessRate: 96,
				Vendors: []*messagev1.EmailVendorStats{
					{Vendor: messagev1.EmailVendor_EMAIL_VENDOR_ALIYUN, Total: 50, Sent: 48, Failed: 2},
				},
			},
			sms: &messagev1.SMSStatsResponse{Total: 10, Sent: 9, Failed: 1, SuccessRate: 90},
		},
	)

	resp, err := svc.GetDashboard(ctxWithUser(77), &testkitv1.GetDashboardRequest{})
	require.NoError(t, err)

	require.Equal(t, int64(50), resp.GetEmailStats().GetTotal())
	require.Equal(t, float64(96), resp.GetEmailStats().GetSuccessRate())
	require.Len(t, resp.GetEmailStats().GetVendors(), 1)
	require.Equal(t, testkitv1.EmailVendor_EMAIL_VENDOR_ALIYUN, resp.GetEmailStats().GetVendors()[0].GetVendor())
	require.Equal(t, int64(10), resp.GetSmsStats().GetTotal())
	require.Equal(t, int64(1000), resp.GetQuota().GetTotalBytes())
	require.Equal(t, int32(9), resp.GetQuota().GetFileCount())
	require.Equal(t, int64(1234), resp.GetUsers().GetTotal())

	// The dashboard only needs the user count: it asks for a single-row,
	// count-only page (no reason to materialize the user list).
	require.True(t, userStub.receivedCount)
	require.Equal(t, int32(1), userStub.receivedSize)
}

func TestGetDashboard_InjectsOwnerFromCtx(t *testing.T) {
	storage := &stubStorage{quota: &storagev1.QuotaInfo{}}
	svc := dashboard.New(
		&stubUser{total: 1},
		storage,
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(ctxWithUser(99), &testkitv1.GetDashboardRequest{})
	require.NoError(t, err)
	require.NotNil(t, storage.receivedOwner)
	require.Equal(t, storagev1.OwnerType_OWNER_TYPE_USER, storage.receivedOwner.GetOwnerType())
	require.Equal(t, int64(99), storage.receivedOwner.GetOwnerId())
}

func TestGetDashboard_FailFast_OnAnyUpstreamError(t *testing.T) {
	boom := errors.New("upstream down")
	svc := dashboard.New(
		&stubUser{err: boom},
		&stubStorage{quota: &storagev1.QuotaInfo{}},
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(ctxWithUser(1), &testkitv1.GetDashboardRequest{})
	require.ErrorIs(t, err, boom)
}

func TestGetDashboard_NoCallerID_ReturnsUnauthenticated(t *testing.T) {
	svc := dashboard.New(
		&stubUser{},
		&stubStorage{quota: &storagev1.QuotaInfo{}},
		&stubMessage{email: &messagev1.EmailStatsResponse{}, sms: &messagev1.SMSStatsResponse{}},
	)

	_, err := svc.GetDashboard(context.Background(), &testkitv1.GetDashboardRequest{})
	require.Error(t, err) // ErrCallerUnresolved — defensive; auth interceptor normally guarantees user_id
}
