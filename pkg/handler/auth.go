// P1 auth RPCs: login/register/verification-code/logout/refresh — thin delegates to internal/service/auth.
package handler

import (
	"context"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	usauth "github.com/servekit/user-service/pkg/auth"

	"google.golang.org/protobuf/types/known/emptypb"
)

// --- Auth RPCs (P1) ---
//
// Each is a thin delegate to the auth domain (internal/service/auth). The
// handler holds no auth logic; the only non-delegate work is reading the
// session_id out of the authenticated context for Logout —
// session_id never appears in a request message (design spec §3.2.1).

// Login authenticates against user-service and returns the session id as the
// bearer token.
func (h *Handler) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	return h.svc.Auth().Login(ctx, req)
}

// Register creates an identity at user-service and returns the session id as
// the bearer token.
func (h *Handler) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
	return h.svc.Auth().Register(ctx, req)
}

// SendVerificationCode requests a one-time code from user-service.
func (h *Handler) SendVerificationCode(ctx context.Context, req *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
	return h.svc.Auth().SendVerificationCode(ctx, req)
}

// Logout revokes the caller's current session. session_id is read from the
// authenticated context (injected from the edge middleware's trusted
// identity) — the request body is empty.
func (h *Handler) Logout(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	sessionID, err := usauth.SessionIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return h.svc.Auth().Logout(ctx, sessionID)
}
