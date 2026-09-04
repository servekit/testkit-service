// Package dashboard implements testkit's global dashboard: a fail-fast
// concurrent fan-in over the message/storage/user domains that assembles a
// single aggregated snapshot. It is the design spec §10 "聚合型" (aggregation)
// reference example.
//
// This is the only testkit domain package that imports message/storage/user
// gen (messagev1/storagev1/userv1) — the mapping-layer boundary from v2 §3.1.
// handler and the testkit proto see only testkitv1.
package dashboard

import (
	"context"

	"github.com/servekit/go-common/grpcx"
	"golang.org/x/sync/errgroup"

	messagev1 "github.com/servekit/message-service/gen/message/v1"
	storagev1 "github.com/servekit/storage-service/gen/storage/v1"
	userv1 "github.com/servekit/user-service/gen/user/v1"

	messageservice "github.com/servekit/message-service/pkg"
	storageservice "github.com/servekit/storage-service/pkg"
	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/pkg/xcodes"
	userservice "github.com/servekit/user-service/pkg"
)

// Service implements the dashboard aggregation domain.
type Service struct {
	user    userservice.Service
	storage storageservice.Service
	message messageservice.Service
}

// New constructs the dashboard service. The three clients are the embedded
// downstream handlers (thirdcall interfaces). Order: user, storage, message.
func New(user userservice.Service, storage storageservice.Service, message messageservice.Service) *Service {
	return &Service{user: user, storage: storage, message: message}
}

// GetDashboard fans out to message/storage/user concurrently (fail-fast via
// errgroup.WithContext — first error wins, peer calls are canceled via the
// derived ctx) and assembles the aggregated response. The caller's Owner for
// GetMyQuota is injected from ctx (v2 §3.2 rule 1); it is never present in the
// request. Downstream xerr surfaces unchanged (§9 passthrough).
func (s *Service) GetDashboard(ctx context.Context, _ *testkitv1.GetDashboardRequest) (*testkitv1.DashboardResponse, error) {
	userID, err := grpcx.GetUserIDFromCtx(ctx)
	if err != nil {
		// Defensive: the auth interceptor guarantees user_id on protected RPCs.
		return nil, xcodes.ErrCallerUnresolved.New()
	}

	var (
		emailStats *messagev1.EmailStatsResponse
		smsStats   *messagev1.SMSStatsResponse
		quota      *storagev1.QuotaInfo
		users      *userv1.ListUsersPagedResponse
	)

	// errgroup.WithContext cancels peer calls on first error → fail-fast. Each
	// closure assigns its result into the shared vars above; gctx is respected
	// so a failing peer propagates cancellation to the others.
	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() (e error) {
		emailStats, e = s.message.GetEmailStats(gctx, &messagev1.GetEmailStatsRequest{})
		return e
	})
	g.Go(func() (e error) {
		smsStats, e = s.message.GetSMSStats(gctx, &messagev1.GetSMSStatsRequest{})
		return e
	})
	g.Go(func() (e error) {
		quota, e = s.storage.GetMyQuota(gctx, &storagev1.GetMyQuotaRequest{
			Owner: &storagev1.Owner{
				OwnerType: storagev1.OwnerType_OWNER_TYPE_USER,
				OwnerId:   userID,
			},
		})
		return e
	})
	g.Go(func() (e error) {
		// count=true with page_size=1 fetches just the total — the dashboard
		// summary needs the user count, not any user rows.
		users, e = s.user.ListUsersPaged(gctx, &userv1.ListUsersPagedRequest{Page: 1, PageSize: 1, Count: true})
		return e
	})

	if err := g.Wait(); err != nil {
		return nil, err // xerr passthrough — surfaces first upstream failure
	}

	return &testkitv1.DashboardResponse{
		EmailStats: emailStatsFromMessage(emailStats),
		SmsStats:   smsStatsFromMessage(smsStats),
		Quota:      quotaFromStorage(quota),
		Users:      usersSummaryFromUser(users),
	}, nil
}

// --- converters (testkit DTO ← downstream proto); enums mirror message.proto
// so the cast is a plain int32 → enum ---

func emailStatsFromMessage(r *messagev1.EmailStatsResponse) *testkitv1.EmailStats {
	if r == nil {
		return nil
	}
	vendors := make([]*testkitv1.EmailVendorStats, 0, len(r.GetVendors()))
	for _, v := range r.GetVendors() {
		vendors = append(vendors, &testkitv1.EmailVendorStats{
			Vendor: testkitv1.EmailVendor(v.GetVendor()), // int cast — enums mirror message.proto
			Total:  v.GetTotal(),
			Sent:   v.GetSent(),
			Failed: v.GetFailed(),
		})
	}
	return &testkitv1.EmailStats{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     vendors,
	}
}

func smsStatsFromMessage(r *messagev1.SMSStatsResponse) *testkitv1.SMSStats {
	if r == nil {
		return nil
	}
	vendors := make([]*testkitv1.SmsVendorStats, 0, len(r.GetVendors()))
	for _, v := range r.GetVendors() {
		vendors = append(vendors, &testkitv1.SmsVendorStats{
			Vendor: testkitv1.SmsVendor(v.GetVendor()),
			Total:  v.GetTotal(),
			Sent:   v.GetSent(),
			Failed: v.GetFailed(),
		})
	}
	return &testkitv1.SMSStats{
		Total:       r.GetTotal(),
		Sent:        r.GetSent(),
		Failed:      r.GetFailed(),
		SuccessRate: r.GetSuccessRate(),
		Vendors:     vendors,
	}
}

func quotaFromStorage(q *storagev1.QuotaInfo) *testkitv1.MyQuota {
	if q == nil {
		return nil
	}
	return &testkitv1.MyQuota{
		TotalBytes:     q.GetTotalBytes(),
		UsedBytes:      q.GetUsedBytes(),
		AvailableBytes: q.GetAvailableBytes(),
		FileCount:      q.GetFileCount(),
	}
}

func usersSummaryFromUser(r *userv1.ListUsersPagedResponse) *testkitv1.UsersSummary {
	if r == nil {
		return nil
	}
	return &testkitv1.UsersSummary{Total: r.GetTotal()}
}
