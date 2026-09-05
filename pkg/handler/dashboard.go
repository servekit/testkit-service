// P5 dashboard RPC: aggregated cross-service stats — delegate to internal/service/dashboard.
package handler

import (
	"context"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// --- Dashboard (P5, aggregated) ---

// GetDashboard returns an aggregated snapshot (email/sms stats, the caller's
// storage quota, and the user count) fanned out across the downstreams.
func (h *Handler) GetDashboard(ctx context.Context, req *testkitv1.GetDashboardRequest) (*testkitv1.DashboardResponse, error) {
	return h.svc.Dashboard().GetDashboard(ctx, req)
}
