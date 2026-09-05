// Package auth implements testkit's auth domain: it forwards each auth RPC to
// the embedded user-service and, for login-class RPCs, returns the
// user-service session id as the bearer token (an opaque session token —
// there is no JWT layer).
//
// This is the ONLY package in testkit-service that imports both testkitv1 and a
// downstream gen (userv1) — it is the testkit-msg ↔ user-msg mapping boundary
// (design spec v2 §3.3/§3.4). pkg/handler and the testkit proto see only
// testkitv1; the downstream user handler is reached exclusively through the
// userservice.Service seam injected here.
//
// The enums in testkit.proto mirror user-service name-for-name and
// number-for-number, so every enum conversion below is a plain int cast
// (userv1.LoginMethod(req.GetMethod())) — no string table. Field names line up
// 1:1 with user-service; the only transformation is the curation (testkit
// omits caller-identity + internal fields) and the int-cast on enums.
package auth

import (
	"context"
	"errors"

	"google.golang.org/protobuf/types/known/emptypb"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	userservice "github.com/servekit/user-service/pkg"
)

// Service implements the auth domain. It holds the user-service client it
// forwards to.
type Service struct {
	user userservice.Service
}

// Option configures a Service.
type Option func(*Service)

// WithUserClient injects the user-service client. Required before any RPC call
// (a nil client is a wiring bug surfaces as a nil-dereference on first use).
func WithUserClient(c userservice.Service) Option { return func(s *Service) { s.user = c } }

// New constructs the auth service. The user client is supplied via
// WithUserClient (the service root wires the embedded user handler; tests
// wire a stub).
func New(opts ...Option) *Service {
	s := &Service{}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Login forwards to user-service and, on success, returns the new session id
// as the bearer token. The session id is what the frontend holds.
func (s *Service) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	resp, err := s.user.Login(ctx, toUserLoginRequest(req))
	if err != nil {
		return nil, err
	}
	return s.toTokenResponse(ctx, resp.GetSessionId(), resp.GetUser(), resp.GetIsNew(), resp.GetReturnTo())
}

// Register forwards to user-service and returns the new session id as the
// bearer token. Same shape as Login.
func (s *Service) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
	resp, err := s.user.Register(ctx, toUserRegisterRequest(req))
	if err != nil {
		return nil, err
	}
	// RegisterResponse carries no is_new/return_to — those are LoginResponse
	// (social/code-login) fields; a fresh registration is is_new by definition.
	return s.toTokenResponse(ctx, resp.GetSessionId(), resp.GetUser(), true, "")
}

// SendVerificationCode forwards to user-service and returns the captcha_id that
// binds the generated code to this flow (must be passed back to Register/Login).
func (s *Service) SendVerificationCode(ctx context.Context, req *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
	resp, err := s.user.SendVerificationCode(ctx, toUserCodeRequest(req))
	if err != nil {
		return nil, err
	}
	return &testkitv1.SendVerificationCodeResponse{CaptchaId: resp.GetCaptchaId()}, nil
}

// Logout revokes the caller's current session. The session id is read from the
// authenticated context by the handler (auth.SessionIDFromCtx) — it never
// appears in a request message — and passed in here.
func (s *Service) Logout(ctx context.Context, sessionID string) (*emptypb.Empty, error) {
	if sessionID == "" {
		return nil, errors.New("auth: logout requires a session id in context")
	}
	return s.user.Logout(ctx, &userv1.LogoutRequest{SessionId: sessionID})
}

// RefreshSession refreshes the caller's session at user-service and returns
// the same session id as the bearer token. user-service's RefreshSession
// returns Empty (the session id is unchanged; only its TTL is extended — and
// the edge middleware's GetSession already slides it on every request, so
// this mostly updates PG's last_active_at), so the session id returned is the
// one carried on the request (populated by the handler from the authenticated
// context when the body omits it).
func (s *Service) RefreshSession(ctx context.Context, req *testkitv1.RefreshSessionRequest) (*testkitv1.TokenResponse, error) {
	sessionID := req.GetSessionId()
	if sessionID == "" {
		return nil, errors.New("auth: refresh requires a session id in context")
	}
	if _, err := s.user.RefreshSession(ctx, &userv1.RefreshSessionRequest{SessionId: sessionID}); err != nil {
		return nil, err
	}
	// No user payload comes back from RefreshSession; return only the token.
	return s.toTokenResponse(ctx, sessionID, nil, false, "")
}

// toTokenResponse pairs the session id — which IS the bearer token — with the
// curated user view. A nil user (RefreshSession has no user payload) yields a
// token-only response; the frontend already has the user from the prior login.
// session_id / is_new / return_to mirror the downstream response so testers
// can target the session directly.
func (s *Service) toTokenResponse(_ context.Context, sessionID string, u *userv1.User, isNew bool, returnTo string) (*testkitv1.TokenResponse, error) {
	if sessionID == "" {
		return nil, errors.New("auth: user-service returned an empty session id")
	}
	return &testkitv1.TokenResponse{
		Token:     sessionID,
		User:      toTestkitUser(u),
		SessionId: sessionID,
		IsNew:     isNew,
		ReturnTo:  returnTo,
	}, nil
}

// --- converters: testkit DTO ↔ user-service proto ---
//
// Enums are mirrored same-name/same-number between testkit.proto and
// user-service, so each is a plain int cast. Field names line up 1:1.

func toUserLoginRequest(r *testkitv1.LoginRequest) *userv1.LoginRequest {
	return &userv1.LoginRequest{
		Method:     userv1.LoginMethod(r.GetMethod()),
		Username:   r.GetUsername(),
		Password:   r.GetPassword(),
		Code:       r.GetCode(),
		Email:      r.GetEmail(),
		RegionCode: r.GetRegionCode(),
		Phone:      r.GetPhone(),
		CaptchaId:  r.GetCaptchaId(),
	}
}

func toUserRegisterRequest(r *testkitv1.RegisterRequest) *userv1.RegisterRequest {
	return &userv1.RegisterRequest{
		Provider:   userv1.IdentityProvider(r.GetProvider()),
		Email:      r.GetEmail(),
		Code:       r.GetCode(),
		Username:   r.GetUsername(),
		Nickname:   r.GetNickname(),
		Password:   r.GetPassword(),
		RegionCode: r.GetRegionCode(),
		Phone:      r.GetPhone(),
		CaptchaId:  r.GetCaptchaId(),
		Gender:     userv1.Gender(r.GetGender()),
		Timezone:   r.GetTimezone(),
		Locale:     r.GetLocale(),
	}
}

func toUserCodeRequest(r *testkitv1.SendVerificationCodeRequest) *userv1.SendVerificationCodeRequest {
	return &userv1.SendVerificationCodeRequest{
		Email:           r.GetEmail(),
		Channel:         userv1.VerificationChannel(r.GetChannel()),
		Purpose:         userv1.VerificationPurpose(r.GetPurpose()),
		RegionCode:      r.GetRegionCode(),
		Phone:           r.GetPhone(),
		SenderId:        r.GetSenderId(),
		SmsTemplateId:   r.GetSmsTemplateId(),
		SmsCodeParamKey: r.GetSmsCodeParamKey(),
		SmsContent:      r.GetSmsContent(),
		EmailSubject:    r.GetEmailSubject(),
		EmailBody:       r.GetEmailBody(),
		EmailHtmlBody:   r.GetEmailHtmlBody(),
		SignName:        r.GetSignName(),
	}
}

// toTestkitUser curates a user-service User down to the frontend view. nil input
// yields nil output (RefreshSession has no user payload). user_type is int-cast
// like the other enums.
func toTestkitUser(u *userv1.User) *testkitv1.User {
	if u == nil {
		return nil
	}
	return &testkitv1.User{
		Id:       u.GetId(),
		Username: u.GetUsername(),
		Email:    u.GetEmail(),
		Phone:    u.GetPhone(),
		Nickname: u.GetNickname(),
		UserType: userv1.UserType(u.GetUserType()),
	}
}
