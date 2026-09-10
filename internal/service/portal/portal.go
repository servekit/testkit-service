// Package portal forwards testkit's phase ④ tenant-console surface to the
// portal admin service — the tenant registry behind the internal-only :19099
// listener of which testkit is the sole legal caller. The RPCs are 1:1
// forwards of the portal.v1 contract: testkit's proto reuses the portal.v1
// request/response types directly (no mirrored DTOs), like the message/
// license/user app forwards.
//
// What this layer adds beyond the pass-through is the door's half of the
// spec §7.2 contract (portal keeps its own actor branches as the authority):
//
//   - PLATFORM-only surfaces (tenants + members) are refused here for every
//     other actor type, so a TENANT_ADMIN never even reaches portal with a
//     registry write.
//   - Tenant-naming api-key RPCs (ListApiKeys/CreateApiKey) override the
//     request's tenant_key with the trusted key the tenant gate injected
//     for TENANT_ADMIN callers — the validated choice IS the tenant, so a
//     tenant admin cannot name a foreign tenant even by crafting the body.
//     PLATFORM callers keep their drill-down target as given.
//
// WhoAmI/MyCapabilities are actor-scoped (memberships / capability union)
// and ride whatever injection the gate resolved — or none, for the
// choiceless WhoAmI bootstrap route.
package portal

import (
	"context"

	portalv1 "github.com/servekit/api/gen/go/portal/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
	"github.com/servekit/go-common/xerr/xcodes"
	portalservice "github.com/servekit/portal-service/pkg"
	"google.golang.org/protobuf/types/known/emptypb"
)

// Service forwards the portal admin console RPCs to the portal backend
// (module or grpc mode — the pkg.Service interface covers both).
type Service struct {
	client portalservice.Service
}

// New constructs the portal-domain forwarder.
func New(client portalservice.Service) *Service {
	return &Service{client: client}
}

// WhoAmI echoes the verified actor's tenant memberships. Actor-scoped — no
// tenant_key involved; it is the switcher's bootstrap call (spec §5.3) and
// the gate lets it cross choiceless with no injection.
func (s *Service) WhoAmI(ctx context.Context, _ *emptypb.Empty) (*portalv1.WhoAmIResponse, error) {
	return s.client.WhoAmI(ctx, &emptypb.Empty{})
}

// MyCapabilities answers the enabled capability services across the caller's
// bound tenants (the union). Actor-scoped like WhoAmI.
func (s *Service) MyCapabilities(ctx context.Context, _ *emptypb.Empty) (*portalv1.MyCapabilitiesResponse, error) {
	return s.client.MyCapabilities(ctx, &emptypb.Empty{})
}

// ListApiKeys returns a tenant's credential rows — never the secret. For a
// TENANT_ADMIN the tenant_key is replaced with the trusted injected key (the
// validated choice); PLATFORM keeps its drill-down target.
func (s *Service) ListApiKeys(ctx context.Context, req *portalv1.ListApiKeysRequest) (*portalv1.ListApiKeysResponse, error) {
	if err := scopeTenantKey(ctx, &req.TenantKey); err != nil {
		return nil, err
	}
	return s.client.ListApiKeys(ctx, req)
}

// CreateApiKey mints a credential pair; the plaintext secret crosses exactly
// once in the response. Same tenant-key scoping as ListApiKeys.
func (s *Service) CreateApiKey(ctx context.Context, req *portalv1.CreateApiKeyRequest) (*portalv1.CreateApiKeyResponse, error) {
	if err := scopeTenantKey(ctx, &req.TenantKey); err != nil {
		return nil, err
	}
	return s.client.CreateApiKey(ctx, req)
}

// RotateApiKeySecret invalidates the key's current secret and answers the new
// plaintext exactly once. access_key-scoped — portal authorizes the key's
// tenant against the actor after the row load.
func (s *Service) RotateApiKeySecret(ctx context.Context, req *portalv1.RotateApiKeySecretRequest) (*portalv1.RotateApiKeySecretResponse, error) {
	return s.client.RotateApiKeySecret(ctx, req)
}

// DisableApiKey toggles a key; a disabled key fails authentication
// immediately. access_key-scoped like RotateApiKeySecret.
func (s *Service) DisableApiKey(ctx context.Context, req *portalv1.DisableApiKeyRequest) (*emptypb.Empty, error) {
	return s.client.DisableApiKey(ctx, req)
}

// ListTenants answers the whole registry (PLATFORM drill-downs + the switcher
// dropdown). PLATFORM only — refused at the door, re-checked at portal.
func (s *Service) ListTenants(ctx context.Context, req *portalv1.ListTenantsRequest) (*portalv1.ListTenantsResponse, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.ListTenants(ctx, req)
}

// SetCapability flips one capability service of a tenant. PLATFORM only.
func (s *Service) SetCapability(ctx context.Context, req *portalv1.SetCapabilityRequest) (*portalv1.SetCapabilityResponse, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.SetCapability(ctx, req)
}

// DisableTenant toggles a tenant; a disabled tenant fails every tenant-scoped
// surface immediately. PLATFORM only.
func (s *Service) DisableTenant(ctx context.Context, req *portalv1.DisableTenantRequest) (*emptypb.Empty, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.DisableTenant(ctx, req)
}

// ListTenantMembers answers a tenant's console operators. PLATFORM only.
func (s *Service) ListTenantMembers(ctx context.Context, req *portalv1.ListTenantMembersRequest) (*portalv1.ListTenantMembersResponse, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.ListTenantMembers(ctx, req)
}

// AddTenantMember binds an existing console account to a tenant. PLATFORM only.
func (s *Service) AddTenantMember(ctx context.Context, req *portalv1.AddTenantMemberRequest) (*emptypb.Empty, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.AddTenantMember(ctx, req)
}

// RemoveTenantMember unbinds a console operator (idempotent). PLATFORM only.
func (s *Service) RemoveTenantMember(ctx context.Context, req *portalv1.RemoveTenantMemberRequest) (*emptypb.Empty, error) {
	if err := requirePlatform(ctx); err != nil {
		return nil, err
	}
	return s.client.RemoveTenantMember(ctx, req)
}

// requirePlatform refuses the registry/membership surfaces for every actor
// type but PLATFORM — the door-side mirror of portal's requirePlatform
// (spec §7.2; portal re-checks). A missing actor fails closed.
func requirePlatform(ctx context.Context) error {
	actor, ok := grpcx.ActorFromCtx(ctx)
	if !ok || userv1.UserType(actor.GetUserType()) != userv1.UserType_USER_TYPE_PLATFORM {
		return xcodes.ErrForbidden.New("platform operators only")
	}
	return nil
}

// scopeTenantKey aligns a request's tenant_key with the trusted key the
// tenant gate injected for TENANT_ADMIN callers: the choice they sent (and
// the door validated against their binding set) IS the tenant — any foreign
// tenant_key in the body is overwritten, not trusted. PLATFORM callers name
// their drill-down target freely; other actor types never reach here with an
// injection to read (the gate denies their management-plane requests).
func scopeTenantKey(ctx context.Context, tenantKey *string) error {
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
