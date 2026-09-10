// Package tenantgate is the testkit console door's tenant gate (spec
// 2026-09-10-tenant-platform-design.md §5.3/§8.2/§8.3, phase ④ T2).
//
// testkit is one of the two doors external traffic enters through. After the
// phase ④ switch it holds NO per-service app credentials: the verified actor
// plus (for the management plane) an explicit tenant choice are exchanged for
// a trusted x-tenant-key that every downstream service accepts on both its
// admin and data planes (the ③ dual-stack trusted half — the only half once
// the window closes).
//
// The §5.3 behavior matrix this package enforces:
//
//	Actor          | Injection
//	---------------+----------------------------------------------------------
//	TENANT_ADMIN   | explicit choice ∈ binding set (portal tenant_members);
//	               | a single binding may be omitted and defaults to itself
//	PLATFORM       | explicit choice = any registered tenant (drill-down view);
//	               | omitted = cross-tenant view, no injection
//	END_USER/none  | management plane denied (fail closed)
//
// Membership data comes from the portal admin listener (internal-only
// :19099; testkit is its sole legal caller) via WhoAmI (TENANT_ADMIN binding
// sets) and ListTenants (the registry backing PLATFORM drill-downs). Both are
// served from an in-process TTL cache (~30s): tenant_members changes are
// infrequent, so convergence within one TTL window is acceptable and no
// invalidation hooks are wired (deliberate — see the resolver docs).
package tenantgate

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	portalv1 "github.com/servekit/api/gen/go/portal/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/tenantctx"
)

// ConsoleTenantKey is the reserved console directory (spec §5.1): the literal
// ten_platform directory every console identity — platform staff and tenant
// admins alike — signs into. Anonymous public traffic (login, register,
// captcha, file links, raw telemetry ingest) operates as this directory: the
// user-service credential surfaces resolve the directory from the injected
// key, and the resource-owning surfaces (link tokens, ingest tokens) carry
// their own domain credentials on top of the transport identity.
const ConsoleTenantKey = "ten_platform"

// HTTP header names. The client-facing explicit choice travels as the plain
// X-Tenant-Choice header (the phase ④ web switcher sends it on every
// management-plane request); both it and the trusted key also exist in the
// grpc-gateway wire form (Grpc-Metadata-*), which transcoding forwards into
// gRPC metadata — hence the unconditional strip of all four forms below.
const (
	// HeaderTenantChoice is the plain client form of the explicit choice.
	HeaderTenantChoice = "X-Tenant-Choice"
	// WireTenantChoiceHeader is the grpc-gateway wire form of the choice.
	WireTenantChoiceHeader = "Grpc-Metadata-X-Tenant-Choice"
	// WireTenantKeyHeader is the grpc-gateway wire form of the trusted key —
	// the door's injection output, mirroring grpcx.WireActorHeader.
	WireTenantKeyHeader = "Grpc-Metadata-X-Tenant-Key"
	// PlainTenantKeyHeader is a plain-form inbound copy clients must never
	// be able to smuggle through the door.
	PlainTenantKeyHeader = "X-Tenant-Key"
)

// Sentinel errors. Policy denials (the *Err family below except ErrPortal)
// answer 403 at the door; ErrPortal wraps transport failures and answers 503.
// Everything fails closed: an unresolved request is never forwarded with a
// guess.
var (
	// ErrNoActor: a management-plane resolution without a verified actor.
	ErrNoActor = errors.New("tenantgate: no verified actor")
	// ErrUserTypeDenied: END_USER / unknown user types have no management
	// plane (spec §7.2); admin surfaces also refuse them downstream — this
	// is the door's fail-closed re-denial.
	ErrUserTypeDenied = errors.New("tenantgate: user type has no management plane")
	// ErrChoiceRequired: several bindings (or none) and no explicit choice.
	ErrChoiceRequired = errors.New("tenantgate: explicit tenant choice required")
	// ErrChoiceNotBound: the explicit choice is outside the binding set.
	ErrChoiceNotBound = errors.New("tenantgate: tenant choice outside binding set")
	// ErrChoiceUnknownTenant: a PLATFORM drill-down naming an unregistered
	// tenant (also keeps lazy tenant provisioning from minting ghost rows).
	ErrChoiceUnknownTenant = errors.New("tenantgate: tenant choice not in registry")
	// ErrPortal: the portal admin call failed (wrapped cause).
	ErrPortal = errors.New("tenantgate: portal unavailable")
)

// PortalAdmin is the portal seam the gate consumes: WhoAmI answers a
// TENANT_ADMIN's binding set, ListTenants the registry backing PLATFORM
// drill-downs. Satisfied by portal-service's pkg Service (module *Handler /
// grpc *Client) — both RPCs are actor-forwarded, so the caller's ctx must
// carry the verified actor (grpcx.WithActor), which the HTTP edge middleware
// guarantees.
type PortalAdmin interface {
	WhoAmI(ctx context.Context, in *emptypb.Empty) (*portalv1.WhoAmIResponse, error)
	ListTenants(ctx context.Context, in *portalv1.ListTenantsRequest) (*portalv1.ListTenantsResponse, error)
}

// DefaultTTL bounds membership/registry staleness. tenant_members and the
// tenant registry change infrequently; a revoke/add converges within one
// window. No invalidation hooks are wired (deliberate: TTL convergence is
// the designed behavior, documented here and in the spec's cache note).
const DefaultTTL = 30 * time.Second

type cachedBindings struct {
	keys      []string
	expiresAt time.Time
}

type cachedRegistry struct {
	keys      map[string]struct{}
	expiresAt time.Time
}

// Resolver implements the §5.3 matrix against the portal seam with an
// in-process TTL cache. Safe for concurrent use.
type Resolver struct {
	portal PortalAdmin
	ttl    time.Duration
	now    func() time.Time // injectable clock (tests)

	mu       sync.Mutex
	bindings map[int64]cachedBindings // actor user_id → binding set
	registry cachedRegistry           // PLATFORM drill-down validation
}

// NewResolver constructs a Resolver over the portal seam with DefaultTTL.
func NewResolver(portal PortalAdmin) *Resolver {
	return &Resolver{
		portal:   portal,
		ttl:      DefaultTTL,
		now:      time.Now,
		bindings: make(map[int64]cachedBindings),
	}
}

// Resolve returns the trusted tenant key the request operates as ("" = no
// injection — PLATFORM cross-view), or a sentinel error. actor nil and
// END_USER/unknown types are denied (fail closed). Portal transport failures
// wrap ErrPortal and are never cached.
func (r *Resolver) Resolve(ctx context.Context, actor *commonv1.RequestActor, choice string) (string, error) {
	if actor == nil {
		return "", ErrNoActor
	}
	switch userv1.UserType(actor.GetUserType()) {
	case userv1.UserType_USER_TYPE_TENANT_ADMIN:
		keys, bErr := r.bindingSet(ctx, actor.GetUserId())
		if bErr != nil {
			return "", bErr
		}
		if choice == "" {
			if len(keys) != 1 {
				// Zero bindings: nothing to default to. Several: the
				// switcher must say which (spec §5.3).
				return "", ErrChoiceRequired
			}
			return keys[0], nil
		}
		if !containsKey(keys, choice) {
			return "", ErrChoiceNotBound
		}
		return choice, nil

	case userv1.UserType_USER_TYPE_PLATFORM:
		if choice == "" {
			return "", nil // cross-tenant view, no injection
		}
		known, err := r.registered(ctx, choice)
		if err != nil {
			return "", err
		}
		if !known {
			return "", ErrChoiceUnknownTenant
		}
		return choice, nil

	default: // END_USER / UNSPECIFIED / unknown values: fail closed
		return "", ErrUserTypeDenied
	}
}

// bindingSet returns the actor's binding set from the cache, refetching via
// WhoAmI on a miss or expiry.
func (r *Resolver) bindingSet(ctx context.Context, userID int64) ([]string, error) {
	r.mu.Lock()
	if c, ok := r.bindings[userID]; ok && r.now().Before(c.expiresAt) {
		keys := c.keys
		r.mu.Unlock()
		return keys, nil
	}
	r.mu.Unlock()

	resp, err := r.portal.WhoAmI(ctx, &emptypb.Empty{})
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrPortal, err)
	}
	keys := make([]string, 0, len(resp.GetMemberships()))
	for _, m := range resp.GetMemberships() {
		if m.GetTenantKey() != "" {
			keys = append(keys, m.GetTenantKey())
		}
	}

	r.mu.Lock()
	r.bindings[userID] = cachedBindings{keys: keys, expiresAt: r.now().Add(r.ttl)}
	r.mu.Unlock()
	return keys, nil
}

// registered reports whether key exists in the tenant registry, refetching
// via ListTenants on a miss or expiry.
func (r *Resolver) registered(ctx context.Context, key string) (bool, error) {
	r.mu.Lock()
	if r.registry.keys != nil && r.now().Before(r.registry.expiresAt) {
		_, known := r.registry.keys[key]
		r.mu.Unlock()
		return known, nil
	}
	r.mu.Unlock()

	resp, err := r.portal.ListTenants(ctx, &portalv1.ListTenantsRequest{})
	if err != nil {
		return false, fmt.Errorf("%w: %w", ErrPortal, err)
	}
	keys := make(map[string]struct{}, len(resp.GetTenants()))
	for _, t := range resp.GetTenants() {
		if t.GetTenantKey() != "" {
			keys[t.GetTenantKey()] = struct{}{}
		}
	}

	r.mu.Lock()
	r.registry = cachedRegistry{keys: keys, expiresAt: r.now().Add(r.ttl)}
	r.mu.Unlock()
	_, known := keys[key]
	return known, nil
}

func containsKey(keys []string, want string) bool {
	for _, k := range keys {
		if k == want {
			return true
		}
	}
	return false
}

// Gate is the HTTP edge middleware form of the door (spec §8.2): strip
// inbound tenant headers, resolve the §5.3 injection from the verified actor
// the session middleware planted on the request context, and plant the
// trusted key for both the transcode path (wire header) and raw-mount
// handlers (request-context metadata).
type Gate struct {
	resolver *Resolver
}

// NewGate constructs the gate over a resolver.
func NewGate(resolver *Resolver) *Gate {
	return &Gate{resolver: resolver}
}

// Wrap mounts the gate around next. Per request:
//
//  1. Strip every inbound form of x-tenant-key / x-tenant-choice (spoofing
//     defense — the door is the only legal writer of the trusted key; the
//     choice never crosses the boundary at all).
//  2. CORS preflights pass through (no credentials to resolve).
//  3. No actor (public route — the session middleware already 401'd every
//     non-public anonymous request): operate as the reserved console
//     directory.
//  4. Otherwise resolve per the §5.3 matrix. Policy denials answer 403,
//     portal unavailability 503; nothing is forwarded unresolved.
//  5. A resolved key is planted in all three views (wire header for
//     grpc-gateway transcoding, incoming+outgoing metadata and the ctx value
//     on the request context for the raw HTTP mounts). A PLATFORM cross-view
//     injects nothing.
func (g *Gate) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The tenant headers are this middleware's output (key) or its
		// private input (choice) only. Drop inbound copies unconditionally
		// — both plain and Grpc-Metadata- wire forms — so a client can
		// never smuggle a tenant past the door.
		choice := r.Header.Get(HeaderTenantChoice)
		r.Header.Del(HeaderTenantChoice)
		r.Header.Del(WireTenantChoiceHeader)
		r.Header.Del(WireTenantKeyHeader)
		r.Header.Del(PlainTenantKeyHeader)

		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		actor, ok := grpcx.ActorFromCtx(r.Context())
		if !ok {
			// Public path (the edge session middleware 401s the rest):
			// anonymous traffic operates as the console directory.
			r = withTrustedRequest(r, ConsoleTenantKey)
			next.ServeHTTP(w, r)
			return
		}

		// Only the management-plane actor types resolve an injection.
		// END_USER / unknown types have no management plane (spec §7.2):
		// the door denies their use of the switcher (fail-closed
		// re-denial — the ③ actor.user_type branches refuse the admin
		// RPCs themselves), while choice-less requests keep the
		// self-service plane with no injection.
		var key string
		switch userv1.UserType(actor.GetUserType()) {
		case userv1.UserType_USER_TYPE_TENANT_ADMIN, userv1.UserType_USER_TYPE_PLATFORM:
			resolved, err := g.resolver.Resolve(r.Context(), actor, choice)
			if err != nil {
				if errors.Is(err, ErrPortal) {
					http.Error(w, "tenant gate unavailable", http.StatusServiceUnavailable)
					return
				}
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			key = resolved
		default:
			if choice != "" {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		if key != "" {
			r = withTrustedRequest(r, key)
		}
		next.ServeHTTP(w, r)
	})
}

// withTrustedRequest plants the resolved key in all three consumption views:
// the grpc-gateway wire header (transcoded requests carry it as x-tenant-key
// metadata into the gRPC chain) and, on the request context, incoming
// metadata (module-mode downstream credential gates read it directly),
// outgoing metadata (real gRPC hops forward it without needing a dial
// interceptor), and the tenantctx value (raw in-process readers).
func withTrustedRequest(r *http.Request, key string) *http.Request {
	r.Header.Set(WireTenantKeyHeader, key)
	return r.WithContext(withTrustedTenant(r.Context(), key))
}

// withTrustedTenant plants the trusted key on ctx as incoming metadata
// (merged over any existing keys), outgoing metadata, and the tenantctx
// value. The door-side mirror of the services' internal appauth.WithTenant.
func withTrustedTenant(ctx context.Context, key string) context.Context {
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		md = md.Copy()
		md.Set(tenantctx.HeaderTenantKey, key)
		ctx = metadata.NewIncomingContext(ctx, md)
	} else {
		ctx = metadata.NewIncomingContext(ctx, metadata.Pairs(tenantctx.HeaderTenantKey, key))
	}
	ctx = tenantctx.WithTenantKey(ctx, key)
	return metadata.AppendToOutgoingContext(ctx, tenantctx.HeaderTenantKey, key)
}
