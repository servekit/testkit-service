// Package bffscope holds the door-side half of the management-plane
// tenant clamp shared by the BFF admin forwards (tenant platform phase ④
// T5). It mirrors internal/service/portal's scopeTenantKey: a TENANT_ADMIN
// caller's tenant-naming admin requests are overwritten with the trusted
// key the tenant gate injected — the validated choice IS the tenant, so a
// foreign tenant_key in the body is replaced, never trusted. PLATFORM
// callers keep their drill-down target as given.
//
// The downstream services re-derive the scope server-side (phase ④ T5
// closure); this clamp is the BFF's defense-in-depth mirror — the web
// forms never send a foreign key, but a crafted console request must not
// be able to.
package bffscope

import (
	"context"

	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
	"github.com/servekit/go-common/xerr/xcodes"
)

// TenantKey aligns a request's tenant_key field with the trusted key the
// tenant gate injected for TENANT_ADMIN callers. PLATFORM callers (and
// their drill-down targets) pass through untouched; a TENANT_ADMIN whose
// choice never resolved fails closed rather than trusting the body.
func TenantKey(ctx context.Context, tenantKey *string) error {
	actor, ok := grpcx.ActorFromCtx(ctx)
	if !ok {
		return xcodes.ErrForbidden.New()
	}
	if userv1.UserType(actor.GetUserType()) != userv1.UserType_USER_TYPE_TENANT_ADMIN {
		return nil
	}
	key, ok := tenantctx.TenantKeyFromCtx(ctx)
	if !ok || key == "" {
		// A TENANT_ADMIN with no resolved key means the request bypassed
		// the door's choice resolution (multi-binding admins without a
		// choice are 403'd at the gate; single bindings default). Fail
		// closed rather than trust the body.
		return xcodes.ErrForbidden.New("tenant choice unresolved")
	}
	*tenantKey = key
	return nil
}
