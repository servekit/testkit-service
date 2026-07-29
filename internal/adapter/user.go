package adapter

import (
	"context"
	"fmt"

	userv1 "github.com/servekit/user-service/gen/user/v1"

	"github.com/servekit/testkit-service/pkg/auth"
)

// SessionCaller is the minimal shape the session resolver needs from the shared
// in-process user handler: its GetSession RPC. The real *user handler satisfies
// it; tests use a stub. Declared as an interface so this package does not import
// the concrete handler type (same pattern as GIDCaller / MessageCaller).
type SessionCaller interface {
	GetSession(ctx context.Context, req *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error)
}

// NewSessionResolver adapts a user handler's GetSession to the auth.SessionResolver
// seam consumed by pkg/auth's interceptor. It is the single bridge between the
// user-service gen types and the authentication boundary: pkg/auth stays free of
// downstream gen, and this package (already a sanctioned gen importer, design
// spec §3.4) owns the translation.
//
// The returned func performs no auth decision of its own — it merely resolves a
// session id to a user id, surfacing any downstream error for the interceptor to
// normalize to ErrUnauthorized.
func NewSessionResolver(c SessionCaller) auth.SessionResolver {
	return func(ctx context.Context, sessionID string) (int64, error) {
		resp, err := c.GetSession(ctx, &userv1.GetSessionRequest{SessionId: sessionID})
		if err != nil {
			return 0, fmt.Errorf("user get-session %q: %w", sessionID, err)
		}
		return resp.GetUserId(), nil
	}
}
