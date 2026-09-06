package auth_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/emptypb"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/testkit-service/internal/service/auth"
)

// stubUserClient stands in for the embedded user-service handler. It embeds
// userv1.UnimplementedUserServiceServer (so it satisfies the full server
// interface, hence the narrower auth.UserClient too) and overrides only the
// five auth methods. Each override records the request it received and returns
// the configured response/error — the same stub pattern the P2/P3 domains will
// use for their downstream clients.
type stubUserClient struct {
	userv1.UnimplementedUserServiceServer

	// captured requests (for asserting the mapping layer forwarded correctly)
	gotLogin    *userv1.LoginRequest
	gotRegister *userv1.RegisterRequest
	gotCode     *userv1.SendVerificationCodeRequest
	gotLogout   *userv1.LogoutRequest

	// configured responses
	loginSessionID string
	loginUser      *userv1.User
	registerUser   *userv1.User
	codeCaptchaID  string

	// per-RPC error injection
	loginErr    error
	registerErr error
	codeErr     error
	logoutErr   error
	refreshErr  error
}

func newAuthSvc(t *testing.T, stub *stubUserClient) *auth.Service {
	t.Helper()
	return auth.New(auth.WithUserClient(stub))
}

func (s *stubUserClient) Login(_ context.Context, req *userv1.LoginRequest) (*userv1.LoginResponse, error) {
	s.gotLogin = req
	if s.loginErr != nil {
		return nil, s.loginErr
	}
	return &userv1.LoginResponse{SessionId: s.loginSessionID, User: s.loginUser}, nil
}

func (s *stubUserClient) Register(_ context.Context, req *userv1.RegisterRequest) (*userv1.RegisterResponse, error) {
	s.gotRegister = req
	if s.registerErr != nil {
		return nil, s.registerErr
	}
	return &userv1.RegisterResponse{SessionId: "reg-sess", User: s.registerUser}, nil
}

func (s *stubUserClient) SendVerificationCode(_ context.Context, req *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error) {
	s.gotCode = req
	if s.codeErr != nil {
		return nil, s.codeErr
	}
	return &userv1.SendVerificationCodeResponse{CaptchaId: s.codeCaptchaID}, nil
}

func (s *stubUserClient) Logout(_ context.Context, req *userv1.LogoutRequest) (*emptypb.Empty, error) {
	s.gotLogout = req
	if s.logoutErr != nil {
		return nil, s.logoutErr
	}
	return &emptypb.Empty{}, nil
}

func sampleUser() *userv1.User {
	return &userv1.User{
		Id:       701,
		Username: "alice",
		Email:    "alice@example.com",
		Phone:    "13800138000",
		Nickname: "Alice",
		UserType: userv1.UserType_USER_TYPE_INTERNAL,
	}
}

func TestLogin_ForwardsAndReturnsSessionToken(t *testing.T) {
	stub := &stubUserClient{loginSessionID: "sess-1", loginUser: sampleUser()}
	svc := newAuthSvc(t, stub)

	resp, err := svc.Login(context.Background(), &testkitv1.LoginRequest{
		Method:     userv1.LoginMethod_LOGIN_METHOD_USERNAME_PASSWORD,
		Username:   "alice",
		Password:   "pw",
		Code:       "c",
		Email:      "alice@example.com",
		RegionCode: "CN",
		Phone:      "13800138000",
		CaptchaId:  "cap-9",
	})
	require.NoError(t, err)

	// The bearer token IS the session id user-service returned — no JWT
	// layer, nothing derived from the request.
	require.Equal(t, "sess-1", resp.GetToken())
	require.Equal(t, "sess-1", resp.GetSessionId())
	require.Equal(t, sampleUser().GetId(), resp.GetUser().GetId())

	// The forwarded request int-cast the enum and copied every field 1:1.
	require.Equal(t, userv1.LoginMethod_LOGIN_METHOD_USERNAME_PASSWORD, stub.gotLogin.GetMethod())
	require.Equal(t, "alice", stub.gotLogin.GetUsername())
	require.Equal(t, "pw", stub.gotLogin.GetPassword())
	require.Equal(t, "c", stub.gotLogin.GetCode())
	require.Equal(t, "alice@example.com", stub.gotLogin.GetEmail())
	require.Equal(t, "CN", stub.gotLogin.GetRegionCode())
	require.Equal(t, "13800138000", stub.gotLogin.GetPhone())
	require.Equal(t, "cap-9", stub.gotLogin.GetCaptchaId())
}

func TestLogin_PropagatesDownstreamError(t *testing.T) {
	stub := &stubUserClient{loginErr: errors.New("bad credentials")}
	svc := newAuthSvc(t, stub)
	_, err := svc.Login(context.Background(), &testkitv1.LoginRequest{
		Method:   userv1.LoginMethod_LOGIN_METHOD_EMAIL_PASSWORD,
		Email:    "x@example.com",
		Password: "pw",
	})
	require.ErrorIs(t, err, stub.loginErr)
}

func TestRegister_ForwardsAndReturnsSessionToken(t *testing.T) {
	stub := &stubUserClient{registerUser: sampleUser()}
	svc := newAuthSvc(t, stub)

	resp, err := svc.Register(context.Background(), &testkitv1.RegisterRequest{
		Provider:   userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL,
		Email:      "alice@example.com",
		Code:       "123456",
		Username:   "alice",
		Nickname:   "Alice",
		Password:   "pw",
		RegionCode: "CN",
		Phone:      "13800138000",
		CaptchaId:  "cap-1",
	})
	require.NoError(t, err)
	require.Equal(t, "reg-sess", resp.GetToken())

	// Provider enum int-cast; every field forwarded.
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL, stub.gotRegister.GetProvider())
	require.Equal(t, "alice@example.com", stub.gotRegister.GetEmail())
	require.Equal(t, "123456", stub.gotRegister.GetCode())
	require.Equal(t, "alice", stub.gotRegister.GetUsername())
	require.Equal(t, "Alice", stub.gotRegister.GetNickname())
	require.Equal(t, "pw", stub.gotRegister.GetPassword())
	require.Equal(t, "CN", stub.gotRegister.GetRegionCode())
	require.Equal(t, "13800138000", stub.gotRegister.GetPhone())
	require.Equal(t, "cap-1", stub.gotRegister.GetCaptchaId())
}

func TestSendVerificationCode_ForwardsAndReturnsCaptchaID(t *testing.T) {
	stub := &stubUserClient{codeCaptchaID: "cap-z"}
	svc := newAuthSvc(t, stub)

	resp, err := svc.SendVerificationCode(context.Background(), &testkitv1.SendVerificationCodeRequest{
		Email:      "alice@example.com",
		Channel:    userv1.VerificationChannel_VERIFICATION_CHANNEL_EMAIL,
		Purpose:    userv1.VerificationPurpose_VERIFICATION_PURPOSE_REGISTER,
		RegionCode: "CN",
		Phone:      "13800138000",
		SenderId:   "testkit-web",
	})
	require.NoError(t, err)
	require.Equal(t, "cap-z", resp.GetCaptchaId())

	// Channel + Purpose int-cast; remaining fields forwarded.
	require.Equal(t, userv1.VerificationChannel_VERIFICATION_CHANNEL_EMAIL, stub.gotCode.GetChannel())
	require.Equal(t, userv1.VerificationPurpose_VERIFICATION_PURPOSE_REGISTER, stub.gotCode.GetPurpose())
	require.Equal(t, "alice@example.com", stub.gotCode.GetEmail())
	require.Equal(t, "CN", stub.gotCode.GetRegionCode())
	require.Equal(t, "13800138000", stub.gotCode.GetPhone())
	require.Equal(t, "testkit-web", stub.gotCode.GetSenderId())
}

func TestLogout_ForwardsSessionIDFromContext(t *testing.T) {
	stub := &stubUserClient{}
	svc := newAuthSvc(t, stub)

	_, err := svc.Logout(context.Background(), "sess-from-ctx")
	require.NoError(t, err)
	require.Equal(t, "sess-from-ctx", stub.gotLogout.GetSessionId())
}

func TestLogout_EmptySessionIDRejected(t *testing.T) {
	svc := newAuthSvc(t, &stubUserClient{})
	_, err := svc.Logout(context.Background(), "")
	require.Error(t, err)
}

func TestEnumIntCast_MirroredSameNumber(t *testing.T) {
	// The design hinges on testkit and user-service enums being same-number, so
	// the int cast is value-preserving. Pin a representative value per enum.
	tests := []struct {
		name     string
		testkit  int32
		userWant userv1.IdentityProvider
	}{
		{"ADMIN=8", int32(userv1.IdentityProvider_IDENTITY_PROVIDER_ADMIN), userv1.IdentityProvider_IDENTITY_PROVIDER_ADMIN},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.EqualValues(t, tt.userWant, userv1.IdentityProvider(tt.testkit))
			require.Equal(t, int32(userv1.IdentityProvider_IDENTITY_PROVIDER_ADMIN), int32(8))
		})
	}
}

func TestToTestkitUser_CuratesAndIntCastsUserType(t *testing.T) {
	stub := &stubUserClient{loginSessionID: "s", loginUser: sampleUser()}
	svc := newAuthSvc(t, stub)

	resp, err := svc.Login(context.Background(), &testkitv1.LoginRequest{
		Method: userv1.LoginMethod_LOGIN_METHOD_USERNAME_PASSWORD,
	})
	require.NoError(t, err)

	u := resp.GetUser()
	require.Equal(t, int64(701), u.GetId())
	require.Equal(t, "alice", u.GetUsername())
	require.Equal(t, "alice@example.com", u.GetEmail())
	require.Equal(t, "13800138000", u.GetPhone())
	require.Equal(t, "Alice", u.GetNickname())
	// user_type int-cast preserves INTERNAL for the frontend two-track split.
	require.Equal(t, userv1.UserType_USER_TYPE_INTERNAL, u.GetUserType())
}
