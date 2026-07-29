// Package auth implements testkit's auth domain: it forwards each auth RPC to
// the embedded user-service and, for login-class RPCs, issues a testkit-owned
// JWT carrying the session id user-service returns.
//
// This is the ONLY package in testkit-service that imports both testkitv1 and a
// downstream gen (userv1) — it is the testkit-msg ↔ user-msg mapping boundary
// (design spec v2 §3.3/§3.4). pkg/handler and the testkit proto see only
// testkitv1; the downstream user handler is reached exclusively through the
// UserClient seam declared here.
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
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/jwt"
	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// UserClient is the subset of the embedded user-service handler the auth domain
// needs. The real *userhandler.Handler satisfies it (it implements the full
// userv1.UserServiceServer); tests stub it by embedding
// userv1.UnimplementedUserServiceServer and overriding the five methods.
//
// Declared locally (not aliased from thirdcall) so this package does not import
// pkg/thirdcall or the concrete handler type — the mapping boundary stays
// narrow and stub-friendly.
type UserClient interface {
	Login(ctx context.Context, req *userv1.LoginRequest) (*userv1.LoginResponse, error)
	Register(ctx context.Context, req *userv1.RegisterRequest) (*userv1.RegisterResponse, error)
	SendVerificationCode(ctx context.Context, req *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error)
	Logout(ctx context.Context, req *userv1.LogoutRequest) (*emptypb.Empty, error)
	RefreshSession(ctx context.Context, req *userv1.RefreshSessionRequest) (*emptypb.Empty, error)
}

// Service implements the auth domain. It holds the JWT manager (testkit is the
// sole signer) and the user-service client it forwards to.
type Service struct {
	jwt  *jwt.Manager
	user UserClient
}

// Option configures a Service.
type Option func(*Service)

// WithUserClient injects the user-service client. Required before any RPC call
// (a nil client is a wiring bug surfaces as a nil-dereference on first use).
func WithUserClient(c UserClient) Option { return func(s *Service) { s.user = c } }

// New constructs the auth service. jwtMgr must be non-nil; the user client is
// supplied via WithUserClient (the service root wires the embedded user
// handler; tests wire a stub).
func New(jwtMgr *jwt.Manager, opts ...Option) *Service {
	s := &Service{jwt: jwtMgr}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Login forwards to user-service and, on success, issues a testkit JWT over the
// returned session id. The JWT (not the session id) is what the frontend holds.
func (s *Service) Login(ctx context.Context, req *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	resp, err := s.user.Login(ctx, toUserLoginRequest(req))
	if err != nil {
		return nil, err
	}
	return s.toTokenResponse(ctx, resp.GetSessionId(), resp.GetUser())
}

// Register forwards to user-service and issues a testkit JWT over the new
// session id. Same shape as Login.
func (s *Service) Register(ctx context.Context, req *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
	resp, err := s.user.Register(ctx, toUserRegisterRequest(req))
	if err != nil {
		return nil, err
	}
	return s.toTokenResponse(ctx, resp.GetSessionId(), resp.GetUser())
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

// RefreshSession refreshes the caller's session at user-service and re-issues a
// testkit JWT over the same session id. user-service's RefreshSession returns
// Empty (the session id is unchanged; only its TTL is extended), so the session
// id signed into the new JWT is the one carried on the request (populated by
// the handler from the authenticated context when the body omits it).
func (s *Service) RefreshSession(ctx context.Context, req *testkitv1.RefreshSessionRequest) (*testkitv1.TokenResponse, error) {
	sessionID := req.GetSessionId()
	if sessionID == "" {
		return nil, errors.New("auth: refresh requires a session id in context")
	}
	if _, err := s.user.RefreshSession(ctx, &userv1.RefreshSessionRequest{SessionId: sessionID}); err != nil {
		return nil, err
	}
	// No user payload comes back from RefreshSession; return only the new token.
	return s.toTokenResponse(ctx, sessionID, nil)
}

// toTokenResponse signs a JWT over sessionID and pairs it with the curated user
// view. A nil user (RefreshSession has no user payload) yields a token-only
// response; the frontend already has the user from the prior login.
func (s *Service) toTokenResponse(_ context.Context, sessionID string, u *userv1.User) (*testkitv1.TokenResponse, error) {
	if sessionID == "" {
		return nil, errors.New("auth: user-service returned an empty session id")
	}
	token, err := s.jwt.Sign(sessionID)
	if err != nil {
		return nil, fmt.Errorf("auth: sign jwt: %w", err)
	}
	return &testkitv1.TokenResponse{
		Token: token,
		User:  toTestkitUser(u),
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
	}
}

func toUserCodeRequest(r *testkitv1.SendVerificationCodeRequest) *userv1.SendVerificationCodeRequest {
	return &userv1.SendVerificationCodeRequest{
		Email:      r.GetEmail(),
		Channel:    userv1.VerificationChannel(r.GetChannel()),
		Purpose:    userv1.VerificationPurpose(r.GetPurpose()),
		RegionCode: r.GetRegionCode(),
		Phone:      r.GetPhone(),
		SenderId:   r.GetSenderId(),
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
		UserType: testkitv1.UserType(u.GetUserType()),
	}
}
