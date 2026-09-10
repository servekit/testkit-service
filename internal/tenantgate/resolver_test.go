package tenantgate

// Resolver behavior-matrix tests (spec 2026-09-10-tenant-platform-design.md
// §5.3, phase ④ T2): the §5.3 table decides which trusted tenant key (if
// any) an actor's request operates as. The portal seam is stubbed; the TTL
// cache is driven by an injectable clock so expiry is deterministic.

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	portalv1 "github.com/servekit/api/gen/go/portal/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
)

// stubPortal records calls and serves scripted responses.
type stubPortal struct {
	whoAmIErr     error
	listTenantsEr error

	memberships []string // current binding set (WhoAmI)
	tenants     []string // current registry (ListTenants)

	whoAmICalls     int
	listTenantsCall int
}

func (s *stubPortal) WhoAmI(_ context.Context, _ *emptypb.Empty) (*portalv1.WhoAmIResponse, error) {
	s.whoAmICalls++
	if s.whoAmIErr != nil {
		return nil, s.whoAmIErr
	}
	resp := &portalv1.WhoAmIResponse{UserId: 42}
	for _, k := range s.memberships {
		resp.Memberships = append(resp.GetMemberships(), &portalv1.TenantMembership{TenantKey: k, TenantName: k})
	}
	return resp, nil
}

func (s *stubPortal) ListTenants(_ context.Context, _ *portalv1.ListTenantsRequest) (*portalv1.ListTenantsResponse, error) {
	s.listTenantsCall++
	if s.listTenantsEr != nil {
		return nil, s.listTenantsEr
	}
	resp := &portalv1.ListTenantsResponse{}
	for _, k := range s.tenants {
		resp.Tenants = append(resp.GetTenants(), &portalv1.TenantInfo{TenantKey: k})
	}
	return resp, nil
}

func actorOf(t userv1.UserType) *commonv1.RequestActor {
	return &commonv1.RequestActor{UserId: 42, SessionId: "s1", TenantKey: "ten_platform", UserType: int32(t)}
}

func newTestResolver(portal PortalAdmin) *Resolver {
	r := NewResolver(portal)
	r.ttl = 30 * time.Second
	return r
}

// --- TENANT_ADMIN row ---

func TestResolve_TenantAdmin_MultiBinding_ExplicitChoiceInSet(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha", "ten_beta"}}
	r := newTestResolver(portal)

	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_beta")
	require.NoError(t, err)
	require.Equal(t, "ten_beta", key)
}

func TestResolve_TenantAdmin_MultiBinding_OmittedChoiceDenied(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha", "ten_beta"}}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.ErrorIs(t, err, ErrChoiceRequired)
}

func TestResolve_TenantAdmin_OutOfRangeChoiceDenied(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha", "ten_beta"}}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_gamma")
	require.ErrorIs(t, err, ErrChoiceNotBound)
}

func TestResolve_TenantAdmin_SingleBinding_OmissionDefaults(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha"}}
	r := newTestResolver(portal)

	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.NoError(t, err)
	require.Equal(t, "ten_alpha", key)

	// Explicit pick of the sole binding also works.
	key, err = r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_alpha")
	require.NoError(t, err)
	require.Equal(t, "ten_alpha", key)
}

func TestResolve_TenantAdmin_ZeroBindingsDenied(t *testing.T) {
	portal := &stubPortal{}
	r := newTestResolver(portal)

	// No binding: an omitted choice has nothing to default to...
	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.ErrorIs(t, err, ErrChoiceRequired)
	// ...and an explicit one can never be in the (empty) set.
	_, err = r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_alpha")
	require.ErrorIs(t, err, ErrChoiceNotBound)
}

// --- PLATFORM row ---

func TestResolve_Platform_ExplicitChoiceDrillsIntoKnownTenant(t *testing.T) {
	portal := &stubPortal{tenants: []string{"ten_alpha", "ten_beta"}}
	r := newTestResolver(portal)

	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_PLATFORM), "ten_alpha")
	require.NoError(t, err)
	require.Equal(t, "ten_alpha", key)
}

func TestResolve_Platform_ExplicitChoiceUnknownTenantDenied(t *testing.T) {
	portal := &stubPortal{tenants: []string{"ten_alpha"}}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_PLATFORM), "ten_ghost")
	require.ErrorIs(t, err, ErrChoiceUnknownTenant)
}

func TestResolve_Platform_OmittedChoiceIsCrossView(t *testing.T) {
	portal := &stubPortal{tenants: []string{"ten_alpha"}}
	r := newTestResolver(portal)

	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_PLATFORM), "")
	require.NoError(t, err)
	require.Empty(t, key, "cross-tenant view injects nothing")
	require.Zero(t, portal.listTenantsCall, "cross-view must not touch the registry")
}

// --- END_USER / no actor rows ---

func TestResolve_EndUserDenied(t *testing.T) {
	r := newTestResolver(&stubPortal{})

	for _, choice := range []string{"", "ten_alpha"} {
		_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_END_USER), choice)
		require.ErrorIs(t, err, ErrUserTypeDenied, "choice=%q", choice)
	}
}

func TestResolve_UnknownUserTypeDenied(t *testing.T) {
	r := newTestResolver(&stubPortal{})

	_, err := r.Resolve(context.Background(), &commonv1.RequestActor{UserId: 42, UserType: 99}, "")
	require.ErrorIs(t, err, ErrUserTypeDenied)
}

func TestResolve_NoActorDenied(t *testing.T) {
	r := newTestResolver(&stubPortal{})

	_, err := r.Resolve(context.Background(), nil, "")
	require.ErrorIs(t, err, ErrNoActor)
}

// --- portal failures pass through (fail closed, never cached) ---

func TestResolve_PortalErrorSurfacesUncached(t *testing.T) {
	portal := &stubPortal{whoAmIErr: status.Error(codes.Unavailable, "portal down")}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.ErrorIs(t, err, ErrPortal)

	// A failed fetch must not poison the cache: the next call retries.
	portal.whoAmIErr = nil
	portal.memberships = []string{"ten_alpha"}
	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.NoError(t, err)
	require.Equal(t, "ten_alpha", key)
}

// --- TTL cache ---

func TestCache_BindingSetCachedWithinTTL(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha"}}
	r := newTestResolver(portal)
	now := time.Now()
	r.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
		require.NoError(t, err)
		require.Equal(t, "ten_alpha", key)
	}
	require.Equal(t, 1, portal.whoAmICalls, "binding set must be served from cache within the TTL")

	now = now.Add(2 * r.ttl)
	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.NoError(t, err)
	require.Equal(t, 2, portal.whoAmICalls, "expired entry refetches")
}

func TestCache_MembershipRemovalConvergesAfterTTL(t *testing.T) {
	// The brief's invalidation story: tenant_members changes converge via
	// TTL (no invalidation hooks by design — documented ~30s staleness).
	portal := &stubPortal{memberships: []string{"ten_alpha", "ten_beta"}}
	r := newTestResolver(portal)
	now := time.Now()
	r.now = func() time.Time { return now }

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_beta")
	require.NoError(t, err)

	// Membership removed server-side; within the TTL the stale set still
	// admits (documented staleness window)...
	portal.memberships = []string{"ten_alpha"}
	_, err = r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_beta")
	require.NoError(t, err, "stale-but-unexpired cache entry still admits")

	// ...after the TTL the removal is enforced.
	now = now.Add(2 * r.ttl)
	_, err = r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "ten_beta")
	require.ErrorIs(t, err, ErrChoiceNotBound)
}

func TestCache_TenantRegistryCachedWithinTTL(t *testing.T) {
	portal := &stubPortal{tenants: []string{"ten_alpha"}}
	r := newTestResolver(portal)
	now := time.Now()
	r.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_PLATFORM), "ten_alpha")
		require.NoError(t, err)
		require.Equal(t, "ten_alpha", key)
	}
	require.Equal(t, 1, portal.listTenantsCall)

	now = now.Add(2 * r.ttl)
	portal.tenants = []string{"ten_alpha", "ten_new"}
	key, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_PLATFORM), "ten_new")
	require.NoError(t, err)
	require.Equal(t, "ten_new", key)
	require.Equal(t, 2, portal.listTenantsCall)
}

func TestCache_BindingsKeyedByActor(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha"}}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.NoError(t, err)

	// A different actor must not be served actor 42's cached entry.
	other := &commonv1.RequestActor{UserId: 7, UserType: int32(userv1.UserType_USER_TYPE_TENANT_ADMIN)}
	_, err = r.Resolve(context.Background(), other, "")
	require.NoError(t, err)
	require.Equal(t, 2, portal.whoAmICalls, "binding sets are cached per actor, not globally")
}

// Portal errors that are not classification failures must wrap ErrPortal so
// the middleware can answer 503 instead of 403.
func TestResolve_PortalErrorWrapsSentinel(t *testing.T) {
	portal := &stubPortal{whoAmIErr: errors.New("boom")}
	r := newTestResolver(portal)

	_, err := r.Resolve(context.Background(), actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN), "")
	require.ErrorIs(t, err, ErrPortal)
	require.NotErrorIs(t, err, ErrChoiceRequired, "transport failure is not a policy denial")
}
