// Package user implements testkit's user domain: it forwards each self-service
// user RPC (profile / identity / session / social) to the embedded user-service
// and, for social-login RPCs, issues a testkit-owned JWT carrying the session id
// user-service returns.
//
// This is the ONLY package in testkit-service that imports both testkitv1 and a
// downstream gen (userv1) — it is the testkit-msg ↔ user-msg mapping boundary
// (design spec v2 §3.3/§3.4). pkg/handler and the testkit proto see only
// testkitv1; the downstream user handler is reached exclusively through the
// userv1.UserServiceServer seam held here.
//
// Curation rules (v2 §3.2):
//   - "My" RPCs (GetProfile / UpdateProfile / ChangePassword / ListIdentities /
//     BindIdentity / BindOAuthIdentity / UnbindIdentity / ListSessions /
//     RevokeAllSessions) drop the caller's user_id from the request — it is read
//     from the authenticated context (grpcx.GetUserIDFromCtx, injected by the
//     P1 auth interceptor) and injected into the downstream request.
//   - Target resource IDs (UnbindIdentity.identity_id, RevokeSession.session_id,
//     GetSession.session_id, IssueSessionCode.session_id) stay in the request.
//   - Public RPCs (ResetPassword, GetOAuthURL, and the social-login RPCs) take
//     no caller identity at all.
//
// Social login (SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin) consumes
// the session_id returned by user-service, signs a JWT over it via the shared
// *jwt.Manager, and returns {token, user, is_new, return_to} — the session_id
// itself never reaches the frontend. GetOAuthURL is a plain forward (public,
// no JWT). This mirrors the P1 auth domain's Login shape (design §3.3, decision
// 5) but lives in the user domain.
//
// The enums in testkit.proto mirror user-service name-for-name and
// number-for-number, so every enum conversion below is a plain int cast
// (userv1.Gender(req.GetGender())) — no string table. Field names line up
// 1:1 with user-service; the only transformation is the curation (testkit
// omits caller-identity + internal fields) and the int-cast on enums.
package user

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr/xcodes"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/jwt"
	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// Service implements testkit's user domain. The user field is typed as the full
// userv1.UserServiceServer — *userhandler.Handler (internal/thirdcall/user)
// satisfies it; test stubs embed userv1.UnimplementedUserServiceServer and
// override only the methods under test (decision 3 — a deliberate departure
// from the P1 auth domain's small hand-written interface, since the user domain
// touches 18 methods and a hand-written list would be verbose and brittle).
type Service struct {
	user userv1.UserServiceServer
	jwt  *jwt.Manager // non-nil in production; required for social-login RPCs
}

// Option configures a Service (for test injection).
type Option func(*Service)

// WithUserClient overrides the embedded user client (tests).
func WithUserClient(c userv1.UserServiceServer) Option {
	return func(s *Service) { s.user = c }
}

// New constructs the user-domain service. userClient is the embedded
// user-service handler (userv1.UserServiceServer); jwtMgr is the shared JWT
// manager used to mint tokens for social login (the same instance the auth
// domain and the auth interceptor use). jwtMgr may be nil when the caller does
// not exercise social-login RPCs (e.g. unit tests of profile/identity/session).
func New(userClient userv1.UserServiceServer, jwtMgr *jwt.Manager, opts ...Option) *Service {
	s := &Service{user: userClient, jwt: jwtMgr}
	for _, o := range opts {
		o(s)
	}
	return s
}

// --- Profile (P2 Task 2 / Task 6) ---

// GetProfile returns the CALLER's profile. user_id is injected from ctx.
func (s *Service) GetProfile(ctx context.Context, _ *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.GetProfile(ctx, &userv1.GetProfileRequest{UserId: userID})
	if err != nil {
		return nil, err
	}
	return toTestkitUser(resp), nil
}

// UpdateProfile updates the CALLER's profile. user_id is injected from ctx.
func (s *Service) UpdateProfile(ctx context.Context, req *testkitv1.UpdateProfileRequest) (*testkitv1.User, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.UpdateProfile(ctx, toUserUpdateProfileRequest(req, userID))
	if err != nil {
		return nil, err
	}
	return toTestkitUser(resp), nil
}

// ChangePassword verifies the caller's old password and sets a new one. user_id
// is injected from ctx.
func (s *Service) ChangePassword(ctx context.Context, req *testkitv1.ChangePasswordRequest) (*emptypb.Empty, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return s.user.ChangePassword(ctx, &userv1.ChangePasswordRequest{
		UserId:      userID,
		OldPassword: req.GetOldPassword(),
		NewPassword: req.GetNewPassword(),
	})
}

// ResetPassword is public (code-based, no caller identity). Forwards as-is.
func (s *Service) ResetPassword(ctx context.Context, req *testkitv1.ResetPasswordRequest) (*emptypb.Empty, error) {
	return s.user.ResetPassword(ctx, &userv1.ResetPasswordRequest{
		Email:       req.GetEmail(),
		Code:        req.GetCode(),
		NewPassword: req.GetNewPassword(),
		RegionCode:  req.GetRegionCode(),
		Phone:       req.GetPhone(),
	})
}

// --- Identity (P2 Task 7) ---

// ListIdentities lists the CALLER's bound identities. user_id is injected from ctx.
func (s *Service) ListIdentities(ctx context.Context, _ *testkitv1.ListIdentitiesRequest) (*testkitv1.ListIdentitiesResponse, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.ListIdentities(ctx, &userv1.ListIdentitiesRequest{UserId: userID})
	if err != nil {
		return nil, err
	}
	identities := make([]*testkitv1.Identity, 0, len(resp.GetIdentities()))
	for _, id := range resp.GetIdentities() {
		identities = append(identities, toTestkitIdentity(id))
	}
	return &testkitv1.ListIdentitiesResponse{Identities: identities}, nil
}

// BindIdentity binds an email/phone identity to the CALLER. user_id is injected
// from ctx.
func (s *Service) BindIdentity(ctx context.Context, req *testkitv1.BindIdentityRequest) (*testkitv1.Identity, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.BindIdentity(ctx, &userv1.BindIdentityRequest{
		UserId:     userID,
		Provider:   userv1.IdentityProvider(req.GetProvider()),
		Email:      req.GetEmail(),
		Code:       req.GetCode(),
		Password:   req.GetPassword(),
		RegionCode: req.GetRegionCode(),
		Phone:      req.GetPhone(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitIdentity(resp), nil
}

// BindOAuthIdentity binds an OAuth identity to the CALLER. user_id is injected
// from ctx.
func (s *Service) BindOAuthIdentity(ctx context.Context, req *testkitv1.BindOAuthIdentityRequest) (*testkitv1.BindOAuthIdentityResponse, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.BindOAuthIdentity(ctx, &userv1.BindOAuthIdentityRequest{
		UserId:   userID,
		Provider: userv1.IdentityProvider(req.GetProvider()),
		Code:     req.GetCode(),
		State:    req.GetState(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.BindOAuthIdentityResponse{Identity: toTestkitIdentity(resp.GetIdentity())}, nil
}

// UnbindIdentity removes a target identity from the CALLER. user_id is injected
// from ctx; identity_id is the target resource ID carried on the request.
func (s *Service) UnbindIdentity(ctx context.Context, req *testkitv1.UnbindIdentityRequest) (*emptypb.Empty, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return s.user.UnbindIdentity(ctx, &userv1.UnbindIdentityRequest{
		UserId:     userID,
		IdentityId: req.GetIdentityId(),
		Code:       req.GetCode(),
	})
}

// --- Session (P2 Task 8) ---

// ListSessions lists the CALLER's active sessions. user_id is injected from ctx.
func (s *Service) ListSessions(ctx context.Context, _ *testkitv1.ListSessionsRequest) (*testkitv1.ListSessionsResponse, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := s.user.ListSessions(ctx, &userv1.ListSessionsRequest{UserId: userID})
	if err != nil {
		return nil, err
	}
	sessions := make([]*testkitv1.Session, 0, len(resp.GetSessions()))
	for _, sess := range resp.GetSessions() {
		sessions = append(sessions, toTestkitSession(sess))
	}
	return &testkitv1.ListSessionsResponse{Sessions: sessions}, nil
}

// RevokeSession revokes a target session. session_id is the target resource ID
// carried on the request (no ctx injection — the caller may be acting on a
// specific session other than their current one).
func (s *Service) RevokeSession(ctx context.Context, req *testkitv1.RevokeSessionRequest) (*emptypb.Empty, error) {
	return s.user.RevokeSession(ctx, &userv1.RevokeSessionRequest{SessionId: req.GetSessionId()})
}

// RevokeAllSessions revokes every session owned by the CALLER. user_id is
// injected from ctx.
func (s *Service) RevokeAllSessions(ctx context.Context, _ *testkitv1.RevokeAllSessionsRequest) (*emptypb.Empty, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return s.user.RevokeAllSessions(ctx, &userv1.RevokeAllSessionsRequest{UserId: userID})
}

// GetSession fetches a target session. session_id is the target resource ID.
func (s *Service) GetSession(ctx context.Context, req *testkitv1.GetSessionRequest) (*testkitv1.GetSessionResponse, error) {
	resp, err := s.user.GetSession(ctx, &userv1.GetSessionRequest{SessionId: req.GetSessionId()})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GetSessionResponse{
		UserId:      resp.GetUserId(),
		ExpiresAt:   resp.GetExpiresAt(),
		CreatedAt:   resp.GetCreatedAt(),
		Ip:          resp.GetIp(),
		UserAgent:   resp.GetUserAgent(),
		Os:          resp.GetOs(),
		Browser:     resp.GetBrowser(),
		LoginMethod: resp.GetLoginMethod(),
	}, nil
}

// IssueSessionCode mints a one-time code for a target session. session_id is the
// target resource ID (used by the OAuth callback service / BFF).
func (s *Service) IssueSessionCode(ctx context.Context, req *testkitv1.IssueSessionCodeRequest) (*testkitv1.IssueSessionCodeResponse, error) {
	resp, err := s.user.IssueSessionCode(ctx, &userv1.IssueSessionCodeRequest{SessionId: req.GetSessionId()})
	if err != nil {
		return nil, err
	}
	return &testkitv1.IssueSessionCodeResponse{Code: resp.GetCode()}, nil
}

// ExchangeSessionCode redeems a one-time session code. Returns the underlying
// session_id + user_id (used by the OAuth callback service / BFF).
func (s *Service) ExchangeSessionCode(ctx context.Context, req *testkitv1.ExchangeSessionCodeRequest) (*testkitv1.ExchangeSessionCodeResponse, error) {
	resp, err := s.user.ExchangeSessionCode(ctx, &userv1.ExchangeSessionCodeRequest{Code: req.GetCode()})
	if err != nil {
		return nil, err
	}
	return &testkitv1.ExchangeSessionCodeResponse{
		SessionId: resp.GetSessionId(),
		UserId:    resp.GetUserId(),
	}, nil
}

// --- Social (P2 Task 9) ---
//
// SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin forward to
// user-service, then consume the returned session_id to mint a testkit JWT
// (decision 5 — social login issues JWT in the USER domain, mirroring the auth
// domain's Login). GetOAuthURL is a plain public forward (no JWT).

// GetOAuthURL returns the provider authorization URL. Public (no caller
// identity, no JWT).
func (s *Service) GetOAuthURL(ctx context.Context, req *testkitv1.GetOAuthURLRequest) (*testkitv1.GetOAuthURLResponse, error) {
	resp, err := s.user.GetOAuthURL(ctx, &userv1.GetOAuthURLRequest{
		Provider: userv1.IdentityProvider(req.GetProvider()),
		ReturnTo: req.GetReturnTo(),
		State:    req.GetState(),
	})
	if err != nil {
		return nil, err
	}
	return &testkitv1.GetOAuthURLResponse{Url: resp.GetUrl(), State: resp.GetState()}, nil
}

// SocialLogin completes an OAuth login. user-service returns a session_id;
// testkit signs a JWT over it and returns it (never the session_id).
func (s *Service) SocialLogin(ctx context.Context, req *testkitv1.SocialLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	resp, err := s.user.SocialLogin(ctx, &userv1.SocialLoginRequest{
		Provider: userv1.IdentityProvider(req.GetProvider()),
		Code:     req.GetCode(),
		State:    req.GetState(),
	})
	if err != nil {
		return nil, err
	}
	return s.socialToTokenResponse(resp)
}

// MiniProgramLogin completes a WeChat mini-program login (code flow). Same
// session_id → JWT shape as SocialLogin.
func (s *Service) MiniProgramLogin(ctx context.Context, req *testkitv1.MiniProgramLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	resp, err := s.user.MiniProgramLogin(ctx, &userv1.MiniProgramLoginRequest{
		Code:      req.GetCode(),
		Nickname:  req.GetNickname(),
		AvatarUrl: req.GetAvatarUrl(),
	})
	if err != nil {
		return nil, err
	}
	return s.socialToTokenResponse(resp)
}

// MiniProgramPhoneLogin completes a WeChat mini-program phone login. Same
// session_id → JWT shape as SocialLogin.
func (s *Service) MiniProgramPhoneLogin(ctx context.Context, req *testkitv1.MiniProgramPhoneLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	resp, err := s.user.MiniProgramPhoneLogin(ctx, &userv1.MiniProgramPhoneLoginRequest{
		LoginCode: req.GetLoginCode(),
		PhoneCode: req.GetPhoneCode(),
		Nickname:  req.GetNickname(),
		AvatarUrl: req.GetAvatarUrl(),
	})
	if err != nil {
		return nil, err
	}
	return s.socialToTokenResponse(resp)
}

// socialToTokenResponse is the shared social-login response builder: it signs a
// JWT over the session_id user-service returned and pairs it with the curated
// user view + the new-user / return_to hints. The session_id itself is never
// surfaced to the frontend — it lives only inside the JWT.
func (s *Service) socialToTokenResponse(resp *userv1.LoginResponse) (*testkitv1.SocialLoginResponse, error) {
	sessionID := resp.GetSessionId()
	if sessionID == "" {
		return nil, errors.New("user: social login returned an empty session id")
	}
	if s.jwt == nil {
		// Wiring bug: user.New was called without a JWT manager but a social
		// login RPC was exercised. Surfaced as a 500.
		return nil, xcodes.ErrInternal.New("user: jwt manager not configured for social login")
	}
	token, err := s.jwt.Sign(sessionID)
	if err != nil {
		return nil, fmt.Errorf("user: sign jwt: %w", err)
	}
	return &testkitv1.SocialLoginResponse{
		Token:    token,
		User:     toTestkitUser(resp.GetUser()),
		IsNew:    resp.GetIsNew(),
		ReturnTo: resp.GetReturnTo(),
	}, nil
}

// userIDFromCtx reads the caller's user_id (injected by the P1 auth
// interceptor) and maps the missing-ctx case to a 401. Used by every "my"
// resource RPC.
func userIDFromCtx(ctx context.Context) (int64, error) {
	uid, err := grpcx.GetUserIDFromCtx(ctx)
	if err != nil {
		return 0, xcodes.ErrUnauthorized.Wrap(err)
	}
	return uid, nil
}

// --- converters: testkit DTO ↔ user-service proto ---
//
// Enums are mirrored same-name/same-number between testkit.proto and
// user-service, so each is a plain int cast. Field names line up 1:1.

func toUserUpdateProfileRequest(r *testkitv1.UpdateProfileRequest, userID int64) *userv1.UpdateProfileRequest {
	return &userv1.UpdateProfileRequest{
		UserId:    userID,
		Username:  r.GetUsername(),
		Nickname:  r.GetNickname(),
		RealName:  r.GetRealName(),
		AvatarUrl: r.GetAvatarUrl(),
		Gender:    userv1.Gender(r.GetGender()),
		Birthday:  r.GetBirthday(),
		Timezone:  r.GetTimezone(),
		Locale:    r.GetLocale(),
		Bio:       r.GetBio(),
	}
}

// toTestkitUser curates a user-service User into the frontend view. nil input
// yields nil output.
func toTestkitUser(u *userv1.User) *testkitv1.User {
	if u == nil {
		return nil
	}
	return &testkitv1.User{
		Id:             u.GetId(),
		Username:       u.GetUsername(),
		Nickname:       u.GetNickname(),
		RealName:       u.GetRealName(),
		AvatarUrl:      u.GetAvatarUrl(),
		Email:          u.GetEmail(),
		RegionCode:     u.GetRegionCode(),
		Phone:          u.GetPhone(),
		Gender:         testkitv1.Gender(u.GetGender()),
		Birthday:       u.GetBirthday(),
		Timezone:       u.GetTimezone(),
		Locale:         u.GetLocale(),
		Bio:            u.GetBio(),
		Status:         testkitv1.UserStatus(u.GetStatus()),
		RegisterSource: testkitv1.IdentityProvider(u.GetRegisterSource()),
		UserType:       testkitv1.UserType(u.GetUserType()),
		LastLoginAt:    u.GetLastLoginAt(),
		CreatedAt:      u.GetCreatedAt(),
		UpdatedAt:      u.GetUpdatedAt(),
	}
}

// toTestkitIdentity curates a user-service Identity into the frontend view. nil
// input yields nil output.
func toTestkitIdentity(i *userv1.Identity) *testkitv1.Identity {
	if i == nil {
		return nil
	}
	return &testkitv1.Identity{
		Id:          i.GetId(),
		Provider:    testkitv1.IdentityProvider(i.GetProvider()),
		ProviderUid: i.GetProviderUid(),
		Verified:    i.GetVerified(),
		CreatedAt:   i.GetCreatedAt(),
	}
}

// toTestkitSession curates a user-service Session into the frontend view. nil
// input yields nil output. device_type is int-cast like the other enums.
func toTestkitSession(s *userv1.Session) *testkitv1.Session {
	if s == nil {
		return nil
	}
	return &testkitv1.Session{
		Id:           s.GetId(),
		Ip:           s.GetIp(),
		DeviceType:   testkitv1.DeviceType(s.GetDeviceType()),
		Os:           s.GetOs(),
		Browser:      s.GetBrowser(),
		Country:      s.GetCountry(),
		City:         s.GetCity(),
		CreatedAt:    s.GetCreatedAt(),
		LastActiveAt: s.GetLastActiveAt(),
		Current:      s.GetCurrent(),
	}
}
