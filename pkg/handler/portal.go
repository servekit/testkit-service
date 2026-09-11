// Phase ④ portal admin console forwards — one-line delegations over the
// portal domain (internal/service/portal), which adds the door's actor-type
// re-checks and trusted tenant-key scoping on top of the 1:1 portal.v1
// pass-throughs.

package handler

import (
	"context"

	portalv1 "github.com/servekit/api/gen/go/portal/v1"

	"google.golang.org/protobuf/types/known/emptypb"
)

// PortalWhoAmI forwards the switcher's bootstrap call (binding set).
func (h *Handler) PortalWhoAmI(ctx context.Context, _ *emptypb.Empty) (*portalv1.WhoAmIResponse, error) {
	return h.svc.PortalAdmin().WhoAmI(ctx, nil)
}

// PortalMyCapabilities forwards the enabled-capabilities union.
func (h *Handler) PortalMyCapabilities(ctx context.Context, _ *emptypb.Empty) (*portalv1.MyCapabilitiesResponse, error) {
	return h.svc.PortalAdmin().MyCapabilities(ctx, nil)
}

// PortalListApiKeys forwards a tenant's credential listing.
func (h *Handler) PortalListApiKeys(ctx context.Context, req *portalv1.ListApiKeysRequest) (*portalv1.ListApiKeysResponse, error) {
	return h.svc.PortalAdmin().ListApiKeys(ctx, req)
}

// PortalCreateApiKey forwards credential minting (secret shown once).
func (h *Handler) PortalCreateApiKey(ctx context.Context, req *portalv1.CreateApiKeyRequest) (*portalv1.CreateApiKeyResponse, error) {
	return h.svc.PortalAdmin().CreateApiKey(ctx, req)
}

// PortalRotateApiKeySecret forwards secret rotation (new secret shown once).
func (h *Handler) PortalRotateApiKeySecret(ctx context.Context, req *portalv1.RotateApiKeySecretRequest) (*portalv1.RotateApiKeySecretResponse, error) {
	return h.svc.PortalAdmin().RotateApiKeySecret(ctx, req)
}

// PortalDisableApiKey forwards the key kill-switch toggle.
func (h *Handler) PortalDisableApiKey(ctx context.Context, req *portalv1.DisableApiKeyRequest) (*emptypb.Empty, error) {
	return h.svc.PortalAdmin().DisableApiKey(ctx, req)
}

// PortalListTenants forwards the tenant registry listing.
func (h *Handler) PortalListTenants(ctx context.Context, req *portalv1.ListTenantsRequest) (*portalv1.ListTenantsResponse, error) {
	return h.svc.PortalAdmin().ListTenants(ctx, req)
}

// PortalCreateTenant forwards tenant creation (initial ak/sk + optional
// bootstrap admin, both shown exactly once).
func (h *Handler) PortalCreateTenant(ctx context.Context, req *portalv1.CreateTenantRequest) (*portalv1.CreateTenantResponse, error) {
	return h.svc.PortalAdmin().CreateTenant(ctx, req)
}

// PortalUpdateTenant forwards name/remark edits.
func (h *Handler) PortalUpdateTenant(ctx context.Context, req *portalv1.UpdateTenantRequest) (*portalv1.UpdateTenantResponse, error) {
	return h.svc.PortalAdmin().UpdateTenant(ctx, req)
}

// PortalSetCapability forwards one capability toggle.
func (h *Handler) PortalSetCapability(ctx context.Context, req *portalv1.SetCapabilityRequest) (*portalv1.SetCapabilityResponse, error) {
	return h.svc.PortalAdmin().SetCapability(ctx, req)
}

// PortalDisableTenant forwards the tenant kill-switch toggle.
func (h *Handler) PortalDisableTenant(ctx context.Context, req *portalv1.DisableTenantRequest) (*emptypb.Empty, error) {
	return h.svc.PortalAdmin().DisableTenant(ctx, req)
}

// PortalDeleteTenant forwards the soft delete (disable-first at portal).
func (h *Handler) PortalDeleteTenant(ctx context.Context, req *portalv1.DeleteTenantRequest) (*emptypb.Empty, error) {
	return h.svc.PortalAdmin().DeleteTenant(ctx, req)
}

// PortalListTenantMembers forwards a tenant's console-operator listing.
func (h *Handler) PortalListTenantMembers(ctx context.Context, req *portalv1.ListTenantMembersRequest) (*portalv1.ListTenantMembersResponse, error) {
	return h.svc.PortalAdmin().ListTenantMembers(ctx, req)
}

// PortalAddTenantMember forwards a console-operator binding.
func (h *Handler) PortalAddTenantMember(ctx context.Context, req *portalv1.AddTenantMemberRequest) (*emptypb.Empty, error) {
	return h.svc.PortalAdmin().AddTenantMember(ctx, req)
}

// PortalRemoveTenantMember forwards a console-operator unbinding.
func (h *Handler) PortalRemoveTenantMember(ctx context.Context, req *portalv1.RemoveTenantMemberRequest) (*emptypb.Empty, error) {
	return h.svc.PortalAdmin().RemoveTenantMember(ctx, req)
}
