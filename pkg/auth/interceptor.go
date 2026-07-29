// Package auth implements the testkit-service authentication interceptor.
//
// It is the gRPC-side authentication gate for every non-public RPC. The flow
// (design spec §5.2):
//
//  1. Skip the whitelist of public method names (Login, Register, ...).
//  2. Extract the bearer token from gRPC metadata (grpcx.BearerTokenFromCtx).
//  3. Verify the HS256 JWT and read its session_id (internal/jwt).
//  4. Exchange the session_id for a user_id via the SessionResolver (backed by
//     user-service GetSession) — this is the stateful check that makes logout
//     / revocation immediate.
//  5. Inject user_id (grpcx.UserIDKey) and session_id (this package's key) into
//     the handler ctx.
//
// On any failure along this path the interceptor returns xcodes.ErrUnauthorized
// (category Unauthorized, 401) so clients see a single shape: "your token is no
// longer good — re-authenticate." grpcx maps the category to gRPC's
// Unauthenticated status code; grpc-gateway maps that to HTTP 401.
//
// This package depends only on internal/jwt and go-common — it does NOT import
// any downstream gen. The SessionResolver func is the narrow seam that bridges
// to user-service; see internal/adapter for the concrete resolver.
package auth

import (
	"context"
	"errors"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr/xcodes"
	"github.com/servekit/testkit-service/internal/jwt"
	"google.golang.org/grpc"
)

// sessionIDKeyType is an unexported context-key type, preventing collisions
// with keys defined elsewhere (idiomatic Go context-key pattern).
type sessionIDKeyType struct{}

// sessionIDKey holds the verified session id for the current request. Handlers
// read it via SessionIDFromCtx (e.g. Logout/RefreshSession need it to target
// the right session).
var sessionIDKey = sessionIDKeyType{}

// SessionResolver maps a verified session id to the caller's user id. The
// concrete implementation calls user-service GetSession; defining it as a func
// here keeps this package free of downstream gen and trivial to stub in tests.
type SessionResolver func(ctx context.Context, sessionID string) (int64, error)

// Interceptor is the configured JWT → session → user_id authentication gate.
// Construct once with NewInterceptor and install its Unary method in the
// grpcx interceptor chain.
type Interceptor struct {
	jwtMgr  *jwt.Manager
	resolve SessionResolver
	public  map[string]struct{}
}

// Option configures an Interceptor.
type Option func(*Interceptor)

// WithPublicMethods marks RPC full-method names (e.g.
// "/testkit.v1.TestKitService/Login") that skip authentication. These are the
// RPCs callable pre-login: Login, Register, SendVerificationCode,
// RefreshSession, Ping, plus health checks (design spec §3.5).
func WithPublicMethods(methods ...string) Option {
	return func(i *Interceptor) {
		for _, m := range methods {
			i.public[m] = struct{}{}
		}
	}
}

// NewInterceptor constructs the authentication interceptor. jwtMgr and resolve
// must be non-nil; this is a startup-wiring precondition (a nil dependency is a
// bug in the assembler, not a runtime condition to mask).
func NewInterceptor(jwtMgr *jwt.Manager, resolve SessionResolver, opts ...Option) *Interceptor {
	i := &Interceptor{
		jwtMgr:  jwtMgr,
		resolve: resolve,
		public:  make(map[string]struct{}),
	}
	for _, o := range opts {
		o(i)
	}
	return i
}

// Unary returns the gRPC UnaryServerInterceptor. It does NOT implement
// StreamServerInterceptor — P1 testkit exposes only unary RPCs.
func (i *Interceptor) Unary() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if _, ok := i.public[info.FullMethod]; ok {
			return handler(ctx, req)
		}

		token, err := grpcx.BearerTokenFromCtx(ctx)
		if err != nil {
			return nil, xcodes.ErrUnauthorized.New()
		}

		sessionID, err := i.jwtMgr.Verify(token)
		if err != nil {
			return nil, xcodes.ErrUnauthorized.New()
		}

		userID, err := i.resolve(ctx, sessionID)
		if err != nil {
			// Normalize resolver failures (session revoked, user-service down,
			// malformed response) to ErrUnauthorized: fail closed at the trust
			// boundary rather than leaking the downstream error shape.
			return nil, xcodes.ErrUnauthorized.New()
		}

		ctx = context.WithValue(ctx, grpcx.UserIDKey, userID)
		ctx = context.WithValue(ctx, sessionIDKey, sessionID)
		return handler(ctx, req)
	}
}

// SessionIDFromCtx returns the verified session id injected by the interceptor.
// It errors when called outside an authenticated RPC (e.g. a public handler, or
// in a test without the interceptor in the chain).
func SessionIDFromCtx(ctx context.Context) (string, error) {
	sid, ok := ctx.Value(sessionIDKey).(string)
	if !ok {
		return "", errors.New("auth: session id not found in context")
	}
	return sid, nil
}
