// P5 gid RPCs: snowflake id issue/debug — thin delegates to internal/service/gid.
package handler

import (
	"context"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
)

// --- P5 RPCs (gid debug + aggregated dashboard) ---
//
// Thin delegates. The gid RPCs forward 1:1 to gid-service via the gid domain;
// GetDashboard fans out across message/storage/user inside the dashboard domain
// (the caller's user_id for GetMyQuota is read from ctx there). All four are
// authenticated (not on the public whitelist).

// --- GID debug (P5) ---

// NextID generates a single unique id (1:1 forward to gid-service).
func (h *Handler) NextID(ctx context.Context, req *testkitv1.NextIDRequest) (*testkitv1.NextIDResponse, error) {
	return h.svc.Gid().NextID(ctx, req)
}

// BatchNextID generates a batch of unique ids (1:1 forward to gid-service).
func (h *Handler) BatchNextID(ctx context.Context, req *testkitv1.BatchNextIDRequest) (*testkitv1.BatchNextIDResponse, error) {
	return h.svc.Gid().BatchNextID(ctx, req)
}

// Decompose parses an id into its snowflake components (1:1 forward to gid-service).
func (h *Handler) Decompose(ctx context.Context, req *testkitv1.DecomposeRequest) (*testkitv1.DecomposeResponse, error) {
	return h.svc.Gid().Decompose(ctx, req)
}
