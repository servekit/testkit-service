package tenantgate

// HTTP gate middleware tests (spec §8.2/§8.3): the testkit gateway is one of
// the two doors. It must strip inbound tenant headers before anything is
// trusted, resolve the §5.3 injection from the verified actor (set upstream
// by the edge session middleware), and plant the trusted key where both
// transcode-path and raw-mount handlers can read it.

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
)

// capture records what the wrapped handler observed.
type capture struct {
	called   bool
	wireKey  string // Grpc-Metadata-X-Tenant-Key header value seen downstream
	ctxKey   string // tenantctx value on the request context ("" when absent)
	ctxKeyOK bool
	incoming metadata.MD
	// Leftovers of the headers the gate must strip (all must be empty).
	leftoverChoice     string
	leftoverWireChoice string
	leftoverPlainKey   string
}

func newGate(portal PortalAdmin) *Gate {
	return NewGate(newTestResolver(portal))
}

// serveGate drives one request through the gate and reports what the wrapped
// handler saw. The actor (when set) is planted on the request context exactly
// as the edge session middleware does.
func serveGate(t *testing.T, g *Gate, actor *commonv1.RequestActor, header map[string]string) (*httptest.ResponseRecorder, *capture) {
	t.Helper()

	cap := &capture{}
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cap.called = true
		cap.wireKey = r.Header.Get(WireTenantKeyHeader)
		cap.incoming, _ = metadata.FromIncomingContext(r.Context())
		cap.ctxKey, cap.ctxKeyOK = tenantctx.TenantKeyFromCtx(r.Context())
		cap.leftoverChoice = r.Header.Get(HeaderTenantChoice)
		cap.leftoverWireChoice = r.Header.Get(WireTenantChoiceHeader)
		cap.leftoverPlainKey = r.Header.Get(PlainTenantKeyHeader)
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/some/rpc", nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	if actor != nil {
		req = req.WithContext(grpcx.WithActor(req.Context(), actor))
	}

	rec := httptest.NewRecorder()
	g.Wrap(next).ServeHTTP(rec, req)
	return rec, cap
}

func TestGate_StripsInboundTenantHeaders(t *testing.T) {
	// PLATFORM cross-view with smuggled tenant headers (no choice): nothing
	// may be injected, and every inbound tenant header (plain + grpc-gateway
	// wire forms) must be gone downstream. Smuggled CHOICE headers are
	// asserted in the drill-down/anonymous tests, where the value matters.
	g := newGate(&stubPortal{tenants: []string{"ten_alpha"}})

	rec, cap := serveGate(t, g, platformActor(), map[string]string{
		WireTenantKeyHeader:  "ten_smuggled",
		PlainTenantKeyHeader: "ten_smuggled",
	})
	require.Equal(t, http.StatusOK, rec.Code)
	require.True(t, cap.called)
	require.Empty(t, cap.wireKey, "cross-view injects nothing")
	require.Empty(t, cap.incoming.Get(tenantctx.HeaderTenantKey))
	require.False(t, cap.ctxKeyOK)
}

func TestGate_TenantAdmin_SingleBinding_InjectsTrustedKey(t *testing.T) {
	g := newGate(&stubPortal{memberships: []string{"ten_alpha"}})

	rec, cap := serveGate(t, g, tenantAdminActor(), nil)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "ten_alpha", cap.wireKey, "wire header must carry the trusted key for grpc-gateway")
	require.Equal(t, []string{"ten_alpha"}, cap.incoming.Get(tenantctx.HeaderTenantKey), "raw-mount handlers read incoming metadata from r.Context()")
	require.True(t, cap.ctxKeyOK)
	require.Equal(t, "ten_alpha", cap.ctxKey)
}

func TestGate_TenantAdmin_MultiBinding_OmittedChoiceForbidden(t *testing.T) {
	g := newGate(&stubPortal{memberships: []string{"ten_alpha", "ten_beta"}})

	rec, cap := serveGate(t, g, tenantAdminActor(), nil)
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, cap.called, "denied requests never reach the handler")
}

func TestGate_TenantAdmin_MultiBinding_ChoicelessBootstrapRoutePasses(t *testing.T) {
	// The switcher's bootstrap (spec §5.3): WhoAmI must be callable by a
	// multi-binding TENANT_ADMIN BEFORE any choice exists — it is how they
	// learn the binding set to choose from. The route is actor-scoped, so
	// it crosses with NO injection (portal answers memberships only).
	g := newGate(&stubPortal{memberships: []string{"ten_alpha", "ten_beta"}})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/portal/whoami", nil)
	rec := httptest.NewRecorder()
	called := false
	var ctxKey string
	ctxKeyOK := false
	g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		ctxKey, ctxKeyOK = tenantctx.TenantKeyFromCtx(r.Context())
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req.WithContext(grpcx.WithActor(req.Context(), tenantAdminActor())))

	require.Equal(t, http.StatusOK, rec.Code)
	require.True(t, called)
	require.False(t, ctxKeyOK, "bootstrap route injects nothing")
	require.Empty(t, ctxKey)
}

func TestGate_TenantAdmin_ZeroBindings_ChoicelessBootstrapRoutePasses(t *testing.T) {
	// A revoked-everywhere admin can still see their (now empty) binding
	// set; every other management-plane call stays 403.
	g := newGate(&stubPortal{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/portal/whoami", nil)
	rec := httptest.NewRecorder()
	called := false
	g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req.WithContext(grpcx.WithActor(req.Context(), tenantAdminActor())))

	require.Equal(t, http.StatusOK, rec.Code)
	require.True(t, called)
}

func TestGate_TenantAdmin_BootstrapRoute_OutOfRangeChoiceStillForbidden(t *testing.T) {
	// The exemption is choice-less only: a smuggled out-of-range choice on
	// the bootstrap route is still refused.
	g := newGate(&stubPortal{memberships: []string{"ten_alpha"}})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/portal/whoami", nil)
	req.Header.Set(HeaderTenantChoice, "ten_other")
	rec := httptest.NewRecorder()
	called := false
	g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req.WithContext(grpcx.WithActor(req.Context(), tenantAdminActor())))

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, called)
}

func TestGate_TenantAdmin_OtherChoicelessEmptyRoutesStayForbidden(t *testing.T) {
	// The exemption is route-scoped: MyCapabilities (and everything else)
	// keeps the blanket choice rule for multi-binding admins.
	g := newGate(&stubPortal{memberships: []string{"ten_alpha", "ten_beta"}})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/portal/capabilities", nil)
	rec := httptest.NewRecorder()
	called := false
	g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rec, req.WithContext(grpcx.WithActor(req.Context(), tenantAdminActor())))

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, called)
}

func TestGate_TenantAdmin_OutOfRangeChoiceForbidden(t *testing.T) {
	g := newGate(&stubPortal{memberships: []string{"ten_alpha"}})

	rec, cap := serveGate(t, g, tenantAdminActor(), map[string]string{HeaderTenantChoice: "ten_other"})
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, cap.called)
}

func TestGate_Platform_DrilldownInjects(t *testing.T) {
	g := newGate(&stubPortal{tenants: []string{"ten_alpha", "ten_beta"}})

	rec, cap := serveGate(t, g, platformActor(), map[string]string{
		HeaderTenantChoice:  "ten_beta",
		WireTenantKeyHeader: "ten_smuggled",
	})
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "ten_beta", cap.wireKey)
	require.True(t, cap.ctxKeyOK)
	require.Equal(t, "ten_beta", cap.ctxKey)
	// The client's choice and any smuggled key never survive the door.
	require.Empty(t, cap.leftoverChoice)
	require.Empty(t, cap.leftoverWireChoice)
	require.Empty(t, cap.leftoverPlainKey)
}

func TestGate_Platform_UnknownDrilldownForbidden(t *testing.T) {
	g := newGate(&stubPortal{tenants: []string{"ten_alpha"}})

	rec, cap := serveGate(t, g, platformActor(), map[string]string{HeaderTenantChoice: "ten_ghost"})
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, cap.called)
}

func TestGate_EndUser_ChoiceForbidden(t *testing.T) {
	// Fail-closed re-denial: the console's management affordance (the tenant
	// switcher) is not available to END_USERs even before the ③ service-side
	// admin branches get a chance to refuse.
	g := newGate(&stubPortal{})

	rec, cap := serveGate(t, g, endUserActor(), map[string]string{HeaderTenantChoice: "ten_alpha"})
	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, cap.called)
}

func TestGate_EndUser_NoChoicePassesWithoutInjection(t *testing.T) {
	// Self-service (profile et al.) keeps working: no injection, request
	// proceeds; management-plane RPCs are refused downstream by the ③
	// actor.user_type branches.
	g := newGate(&stubPortal{})

	rec, cap := serveGate(t, g, endUserActor(), nil)
	require.Equal(t, http.StatusOK, rec.Code)
	require.True(t, cap.called)
	require.Empty(t, cap.wireKey)
	require.False(t, cap.ctxKeyOK)
}

func TestGate_Anonymous_InjectsConsoleDirectory(t *testing.T) {
	// Public routes (login/register/captcha/links/raw ingest) carry no
	// actor; the edge middleware already 401'd every non-public anonymous
	// request. They operate in the reserved console directory — the login
	// surface resolves its directory from the injected key.
	g := newGate(&stubPortal{})

	rec, cap := serveGate(t, g, nil, nil)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, ConsoleTenantKey, cap.wireKey)
	require.True(t, cap.ctxKeyOK)
	require.Equal(t, ConsoleTenantKey, cap.ctxKey)
}

func TestGate_Anonymous_SmuggledChoiceIgnored(t *testing.T) {
	g := newGate(&stubPortal{})

	rec, cap := serveGate(t, g, nil, map[string]string{
		HeaderTenantChoice:     "ten_victim",
		WireTenantChoiceHeader: "ten_victim",
		WireTenantKeyHeader:    "ten_victim",
		PlainTenantKeyHeader:   "ten_victim",
	})
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, ConsoleTenantKey, cap.wireKey, "anonymous traffic is pinned to the console directory, never to a client-supplied key")
	require.Empty(t, cap.leftoverChoice)
	require.Empty(t, cap.leftoverWireChoice)
	require.Empty(t, cap.leftoverPlainKey)
}

func TestGate_OptionsPreflightPassesThrough(t *testing.T) {
	g := newGate(&stubPortal{})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/some/rpc", nil)
	req.Header.Set(HeaderTenantChoice, "ten_x")
	rec := httptest.NewRecorder()
	called := false
	g.Wrap(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	})).ServeHTTP(rec, req)
	require.Equal(t, http.StatusNoContent, rec.Code)
	require.True(t, called)
}

func TestGate_PortalUnavailableAnswersServiceUnavailable(t *testing.T) {
	portal := &stubPortal{whoAmIErr: context.DeadlineExceeded}
	g := newGate(portal)

	rec, cap := serveGate(t, g, tenantAdminActor(), nil)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	require.False(t, cap.called)
}

func TestGate_CacheSharedAcrossRequests(t *testing.T) {
	portal := &stubPortal{memberships: []string{"ten_alpha"}}
	g := newGate(portal)

	for i := 0; i < 3; i++ {
		rec, cap := serveGate(t, g, tenantAdminActor(), nil)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "ten_alpha", cap.wireKey)
	}
	require.Equal(t, 1, portal.whoAmICalls, "requests share the resolver's TTL cache")
}

func TestWithTrustedTenant_PlantsAllThreeViews(t *testing.T) {
	// Module-mode downstream gates read incoming metadata; gRPC-mode hops
	// read outgoing metadata; raw in-process readers use the ctx value. The
	// door must set all three.
	ctx := withTrustedTenant(context.Background(), "ten_alpha")

	md, ok := metadata.FromIncomingContext(ctx)
	require.True(t, ok)
	require.Equal(t, []string{"ten_alpha"}, md.Get(tenantctx.HeaderTenantKey))

	omd, ok := metadata.FromOutgoingContext(ctx)
	require.True(t, ok)
	require.Equal(t, []string{"ten_alpha"}, omd.Get(tenantctx.HeaderTenantKey))

	k, ok := tenantctx.TenantKeyFromCtx(ctx)
	require.True(t, ok)
	require.Equal(t, "ten_alpha", k)
}

func TestWithTrustedTenant_MergesExistingIncomingMetadata(t *testing.T) {
	ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs("x-app-key", "clientinfo-survivor"))
	ctx = withTrustedTenant(ctx, "ten_beta")

	md, _ := metadata.FromIncomingContext(ctx)
	require.Equal(t, []string{"ten_beta"}, md.Get(tenantctx.HeaderTenantKey))
	require.Equal(t, []string{"clientinfo-survivor"}, md.Get("x-app-key"), "pre-existing incoming keys survive the merge")
}

func platformActor() *commonv1.RequestActor {
	return actorOf(userv1.UserType_USER_TYPE_PLATFORM)
}

func tenantAdminActor() *commonv1.RequestActor {
	return actorOf(userv1.UserType_USER_TYPE_TENANT_ADMIN)
}

func endUserActor() *commonv1.RequestActor {
	return actorOf(userv1.UserType_USER_TYPE_END_USER)
}
