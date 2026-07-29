// Package handler implements testkit.v1.TestkitServiceServer as a thin shim over
// internal/service. Each method is a one-line delegation — service takes the
// proto request directly (convert at the store boundary, not here).
//
// Handlers hold NO business logic and NO conversion logic. Anything beyond
// `return h.svc.X(ctx, req)` belongs in internal/service.
//
// Handler also implements signalx.Service (Start/Stop) by delegating to the
// underlying Service, so in-process module users manage lifecycle via the same
// object they call RPC methods on.
package handler

import (
	"context"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service"
	"github.com/servekit/testkit-service/pkg/auth"

	"google.golang.org/protobuf/types/known/emptypb"
)

// Handler implements testkit.v1.TestkitServiceServer. It holds no mutable
// state — the embedded *service.Service owns all business state and lifecycle.
type Handler struct {
	testkitv1.UnimplementedTestkitServiceServer

	svc *service.Service
}

// New constructs a Handler wrapping svc.
func New(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// Compile-time assertion: Handler implements the gRPC server interface.
var _ testkitv1.TestkitServiceServer = (*Handler)(nil)

// Start starts service-internal components (background goroutines for owned
// resources like cron, message consumers, etc.).
func (h *Handler) Start() error { return h.svc.Start() }

// Stop releases resources owned by the service. After Stop, the Handler must
// not be used.
func (h *Handler) Stop() error { return h.svc.Stop() }

// Ping is a health-check RPC, always generated so the grpc-gateway has at
// least one HTTP endpoint and pkg/server.go can always register the gateway
// handler. (A proto service with zero RPCs produces no HandlerFromEndpoint,
// which would silently disable the HTTP gateway.)
func (h *Handler) Ping(ctx context.Context, _ *emptypb.Empty) (*testkitv1.Pong, error) {
	return h.svc.Ping(ctx)
}

// --- Auth RPCs (P1) ---
//
// Each is a thin delegate to the auth domain (internal/service/auth). The
// handler holds no auth logic; the only non-delegate work is reading the
// session_id out of the authenticated context for Logout/RefreshSession —
// session_id never appears in a request message (design spec §3.2.1).

// Login authenticates against user-service and returns a freshly-issued JWT.
func (h *Handler) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	return h.svc.Auth().Login(ctx, req)
}

// Register creates an identity at user-service and returns a JWT.
func (h *Handler) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
	return h.svc.Auth().Register(ctx, req)
}

// SendVerificationCode requests a one-time code from user-service.
func (h *Handler) SendVerificationCode(ctx context.Context, req *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
	return h.svc.Auth().SendVerificationCode(ctx, req)
}

// Logout revokes the caller's current session. session_id is read from the
// authenticated context (injected by the auth interceptor from the JWT) — the
// request body is empty.
func (h *Handler) Logout(ctx context.Context, _ *emptypb.Empty) (*emptypb.Empty, error) {
	sessionID, err := auth.SessionIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return h.svc.Auth().Logout(ctx, sessionID)
}

// RefreshSession extends the caller's session and re-issues a JWT. When the
// request omits session_id it is derived from the authenticated context.
func (h *Handler) RefreshSession(ctx context.Context, req *testkitv1.RefreshSessionRequest) (*testkitv1.TokenResponse, error) {
	if req.GetSessionId() == "" {
		sid, err := auth.SessionIDFromCtx(ctx)
		if err != nil {
			return nil, err
		}
		req.SessionId = sid
	}
	return h.svc.Auth().RefreshSession(ctx, req)
}

// --- User-domain RPCs (P2: profile / identity / session / social) ---
//
// Each is a thin delegate to the user domain (internal/service/user). The
// handler holds no user logic; the only non-delegate work remains the
// session_id read for the auth RPCs above. "My" RPCs read the caller's user_id
// from ctx inside the domain service; target IDs (identity_id, session_id) and
// public RPCs (ResetPassword, social) carry their own request fields.

// GetProfile returns the caller's own profile (user_id injected from ctx).
func (h *Handler) GetProfile(ctx context.Context, req *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
	return h.svc.User().GetProfile(ctx, req)
}

// UpdateProfile updates the caller's own profile (user_id injected from ctx).
func (h *Handler) UpdateProfile(ctx context.Context, req *testkitv1.UpdateProfileRequest) (*testkitv1.User, error) {
	return h.svc.User().UpdateProfile(ctx, req)
}

// ChangePassword verifies the caller's old password and sets a new one.
func (h *Handler) ChangePassword(ctx context.Context, req *testkitv1.ChangePasswordRequest) (*emptypb.Empty, error) {
	return h.svc.User().ChangePassword(ctx, req)
}

// ResetPassword is a public, code-based password reset (no caller identity).
func (h *Handler) ResetPassword(ctx context.Context, req *testkitv1.ResetPasswordRequest) (*emptypb.Empty, error) {
	return h.svc.User().ResetPassword(ctx, req)
}

// ListIdentities lists the caller's bound identities.
func (h *Handler) ListIdentities(ctx context.Context, req *testkitv1.ListIdentitiesRequest) (*testkitv1.ListIdentitiesResponse, error) {
	return h.svc.User().ListIdentities(ctx, req)
}

// BindIdentity binds an email/phone identity to the caller.
func (h *Handler) BindIdentity(ctx context.Context, req *testkitv1.BindIdentityRequest) (*testkitv1.Identity, error) {
	return h.svc.User().BindIdentity(ctx, req)
}

// BindOAuthIdentity binds an OAuth identity to the caller.
func (h *Handler) BindOAuthIdentity(ctx context.Context, req *testkitv1.BindOAuthIdentityRequest) (*testkitv1.BindOAuthIdentityResponse, error) {
	return h.svc.User().BindOAuthIdentity(ctx, req)
}

// UnbindIdentity removes a target identity from the caller.
func (h *Handler) UnbindIdentity(ctx context.Context, req *testkitv1.UnbindIdentityRequest) (*emptypb.Empty, error) {
	return h.svc.User().UnbindIdentity(ctx, req)
}

// ListSessions lists the caller's active sessions.
func (h *Handler) ListSessions(ctx context.Context, req *testkitv1.ListSessionsRequest) (*testkitv1.ListSessionsResponse, error) {
	return h.svc.User().ListSessions(ctx, req)
}

// RevokeSession revokes a target session.
func (h *Handler) RevokeSession(ctx context.Context, req *testkitv1.RevokeSessionRequest) (*emptypb.Empty, error) {
	return h.svc.User().RevokeSession(ctx, req)
}

// RevokeAllSessions revokes every session owned by the caller.
func (h *Handler) RevokeAllSessions(ctx context.Context, req *testkitv1.RevokeAllSessionsRequest) (*emptypb.Empty, error) {
	return h.svc.User().RevokeAllSessions(ctx, req)
}

// GetSession fetches a target session.
func (h *Handler) GetSession(ctx context.Context, req *testkitv1.GetSessionRequest) (*testkitv1.GetSessionResponse, error) {
	return h.svc.User().GetSession(ctx, req)
}

// IssueSessionCode mints a one-time code for a target session.
func (h *Handler) IssueSessionCode(ctx context.Context, req *testkitv1.IssueSessionCodeRequest) (*testkitv1.IssueSessionCodeResponse, error) {
	return h.svc.User().IssueSessionCode(ctx, req)
}

// ExchangeSessionCode redeems a one-time session code.
func (h *Handler) ExchangeSessionCode(ctx context.Context, req *testkitv1.ExchangeSessionCodeRequest) (*testkitv1.ExchangeSessionCodeResponse, error) {
	return h.svc.User().ExchangeSessionCode(ctx, req)
}

// GetOAuthURL returns the provider authorization URL (public, no JWT).
func (h *Handler) GetOAuthURL(ctx context.Context, req *testkitv1.GetOAuthURLRequest) (*testkitv1.GetOAuthURLResponse, error) {
	return h.svc.User().GetOAuthURL(ctx, req)
}

// SocialLogin completes an OAuth login and returns a testkit-issued JWT.
func (h *Handler) SocialLogin(ctx context.Context, req *testkitv1.SocialLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return h.svc.User().SocialLogin(ctx, req)
}

// MiniProgramLogin completes a WeChat mini-program code login.
func (h *Handler) MiniProgramLogin(ctx context.Context, req *testkitv1.MiniProgramLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return h.svc.User().MiniProgramLogin(ctx, req)
}

// MiniProgramPhoneLogin completes a WeChat mini-program phone login.
func (h *Handler) MiniProgramPhoneLogin(ctx context.Context, req *testkitv1.MiniProgramPhoneLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return h.svc.User().MiniProgramPhoneLogin(ctx, req)
}
