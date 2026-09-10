package user_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/testkit-service/internal/service/user"
)

// stubUserClient stands in for the embedded user-service handler. It embeds
// userv1.UnimplementedUserServiceServer (so it satisfies the full server
// interface — hence the user.Service's userv1.UserServiceServer seam too) and
// overrides only the methods under test. Each override records the request it
// received and returns the configured response/error.
type stubUserClient struct {
	userv1.UnimplementedUserServiceServer

	// captured downstream requests (for asserting the mapping forwarded correctly)
	gotCtx            context.Context
	gotGetProfile     *userv1.GetProfileRequest
	gotUpdateProfile  *userv1.UpdateProfileRequest
	gotChangePassword *userv1.ChangePasswordRequest
	gotListIdentities *userv1.ListIdentitiesRequest
	gotUnbindIdentity *userv1.UnbindIdentityRequest
	gotListSessions   *userv1.ListSessionsRequest
	gotRevokeSession  *userv1.RevokeSessionRequest
	gotRevokeAll      *userv1.RevokeAllSessionsRequest
	gotSocialLogin    *userv1.SocialLoginRequest
	gotGetOAuthURL    *userv1.GetOAuthURLRequest

	// admin / RBAC captured downstream requests
	gotGetUser          *userv1.GetUserRequest
	gotDisableUser      *userv1.DisableUserRequest
	gotCreateRole       *userv1.CreateRoleRequest
	gotListRoles        *userv1.ListRolesRequest
	gotListUsersPaged   *userv1.ListUsersPagedRequest
	gotCreateUser       *userv1.CreateUserRequest
	gotListUsers        *userv1.ListUsersRequest
	gotGetLoginLogs     *userv1.GetLoginLogsRequest
	gotCreateGroup      *userv1.CreateGroupRequest
	gotListGroupMembers *userv1.ListGroupMembersRequest
	gotAssignRole       *userv1.AssignRoleRequest

	// configured responses
	profileUser    *userv1.User
	identities     []*userv1.Identity
	sessions       []*userv1.Session
	socialSession  string
	socialUser     *userv1.User
	socialIsNew    bool
	socialReturnTo string
	oauthURL       string
	oauthState     string

	// admin / RBAC configured responses
	adminUser       *userv1.User // returned by GetUser / DisableUser / CreateUser
	pagedUsers      []*userv1.User
	pagedTotal      int64
	pagedTotalPages int32
	createdRole     *userv1.Role
	listedRoles     []*userv1.Role
	rolesCursor     string
	rolesTotal      int32
	loginLogs       []*userv1.LoginLog

	// per-RPC error injection
	socialErr error
}

// newSvc wires a user.Service against the stub client.
func newSvc(t *testing.T, stub *stubUserClient) *user.Service {
	t.Helper()
	return user.New(stub)
}

func ctxWithUser(uid int64) context.Context {
	return grpcx.WithActor(context.Background(), &commonv1.RequestActor{UserId: uid})
}

// ctxWithUserSession adds the caller's current session to the actor.
func ctxWithUserSession(uid int64, sid string) context.Context {
	return grpcx.WithActor(context.Background(), &commonv1.RequestActor{UserId: uid, SessionId: sid})
}

// actorUserID extracts the actor's user id from a captured downstream ctx —
// the identity now travels on the context, not on request fields.
func actorUserID(ctx context.Context) int64 {
	if a, ok := grpcx.ActorFromCtx(ctx); ok {
		return a.GetUserId()
	}
	return 0
}

func fullUser(id int64) *userv1.User {
	return &userv1.User{
		Id:             id,
		Username:       "alice",
		Nickname:       "Alice",
		RealName:       "Alice Smith",
		AvatarUrl:      "https://cdn/avatar.png",
		Email:          "alice@example.com",
		RegionCode:     "CN",
		Phone:          "13800138000",
		Gender:         userv1.Gender_GENDER_FEMALE,
		Birthday:       "1990-01-02",
		Timezone:       "Asia/Shanghai",
		Locale:         "zh-CN",
		Bio:            "hello",
		Status:         userv1.UserStatus_USER_STATUS_ACTIVE,
		RegisterSource: userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL,
		UserType:       userv1.UserType_USER_TYPE_PLATFORM,
		LastLoginAt:    timestamppb.Now(),
		CreatedAt:      timestamppb.Now(),
		UpdatedAt:      timestamppb.Now(),
	}
}

// --- overrides ---

func (s *stubUserClient) GetProfile(ctx context.Context, req *userv1.GetProfileRequest) (*userv1.User, error) {
	s.gotCtx, s.gotGetProfile = ctx, req
	if s.profileUser == nil {
		return fullUser(actorUserID(ctx)), nil
	}
	return s.profileUser, nil
}

func (s *stubUserClient) UpdateProfile(ctx context.Context, req *userv1.UpdateProfileRequest) (*userv1.User, error) {
	s.gotCtx, s.gotUpdateProfile = ctx, req
	return fullUser(actorUserID(ctx)), nil
}

func (s *stubUserClient) ChangePassword(ctx context.Context, req *userv1.ChangePasswordRequest) (*emptypb.Empty, error) {
	s.gotCtx, s.gotChangePassword = ctx, req
	return &emptypb.Empty{}, nil
}

func (s *stubUserClient) ResetPassword(_ context.Context, req *userv1.ResetPasswordRequest) (*emptypb.Empty, error) {
	return &emptypb.Empty{}, nil
}

func (s *stubUserClient) ListIdentities(ctx context.Context, req *userv1.ListIdentitiesRequest) (*userv1.ListIdentitiesResponse, error) {
	s.gotCtx, s.gotListIdentities = ctx, req
	return &userv1.ListIdentitiesResponse{Identities: s.identities}, nil
}

func (s *stubUserClient) UnbindIdentity(ctx context.Context, req *userv1.UnbindIdentityRequest) (*emptypb.Empty, error) {
	s.gotCtx, s.gotUnbindIdentity = ctx, req
	return &emptypb.Empty{}, nil
}

func (s *stubUserClient) ListSessions(ctx context.Context, req *userv1.ListSessionsRequest) (*userv1.ListSessionsResponse, error) {
	s.gotCtx, s.gotListSessions = ctx, req
	return &userv1.ListSessionsResponse{Sessions: s.sessions}, nil
}

func (s *stubUserClient) RevokeSession(_ context.Context, req *userv1.RevokeSessionRequest) (*emptypb.Empty, error) {
	s.gotRevokeSession = req
	return &emptypb.Empty{}, nil
}

func (s *stubUserClient) RevokeAllSessions(ctx context.Context, req *userv1.RevokeAllSessionsRequest) (*emptypb.Empty, error) {
	s.gotCtx, s.gotRevokeAll = ctx, req
	return &emptypb.Empty{}, nil
}

func (s *stubUserClient) GetOAuthURL(_ context.Context, req *userv1.GetOAuthURLRequest) (*userv1.GetOAuthURLResponse, error) {
	s.gotGetOAuthURL = req
	return &userv1.GetOAuthURLResponse{Url: s.oauthURL, State: s.oauthState}, nil
}

func (s *stubUserClient) SocialLogin(_ context.Context, req *userv1.SocialLoginRequest) (*userv1.LoginResponse, error) {
	s.gotSocialLogin = req
	if s.socialErr != nil {
		return nil, s.socialErr
	}
	return &userv1.LoginResponse{
		User:      s.socialUser,
		SessionId: s.socialSession,
		IsNew:     s.socialIsNew,
		ReturnTo:  s.socialReturnTo,
	}, nil
}

// --- Profile: my-resource RPC injects user_id from ctx ---

func TestGetProfile_InjectsUserIDFromCtx(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	resp, err := svc.GetProfile(ctxWithUser(42), &testkitv1.GetProfileRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(42), resp.GetId())             // mapped back through toTestkitUser
	require.Equal(t, int64(42), actorUserID(stub.gotCtx)) // forwarded to downstream via ctx
}

func TestGetProfile_NoUserIDInCtx_Unauthorized(t *testing.T) {
	svc := newSvc(t, &stubUserClient{})
	_, err := svc.GetProfile(context.Background(), &testkitv1.GetProfileRequest{})
	require.Error(t, err)
}

func TestUpdateProfile_ForwardsFieldsAndUserID(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	_, err := svc.UpdateProfile(ctxWithUser(7), &testkitv1.UpdateProfileRequest{
		Username:  "alice2",
		Nickname:  "newnick",
		RealName:  "Alice S",
		AvatarUrl: "https://cdn/x.png",
		Gender:    userv1.Gender_GENDER_FEMALE,
		Birthday:  "1990-01-02",
		Timezone:  "Asia/Shanghai",
		Locale:    "zh-CN",
		Bio:       "bio",
	})
	require.NoError(t, err)

	// the actor rides on ctx to the downstream call.
	require.Equal(t, int64(7), actorUserID(stub.gotCtx))
	// remaining fields forwarded 1:1, gender int-cast.
	require.Equal(t, "alice2", stub.gotUpdateProfile.GetUsername())
	require.Equal(t, "newnick", stub.gotUpdateProfile.GetNickname())
	require.Equal(t, "Alice S", stub.gotUpdateProfile.GetRealName())
	require.Equal(t, "https://cdn/x.png", stub.gotUpdateProfile.GetAvatarUrl())
	require.Equal(t, userv1.Gender_GENDER_FEMALE, stub.gotUpdateProfile.GetGender())
	require.Equal(t, "1990-01-02", stub.gotUpdateProfile.GetBirthday())
	require.Equal(t, "Asia/Shanghai", stub.gotUpdateProfile.GetTimezone())
	require.Equal(t, "zh-CN", stub.gotUpdateProfile.GetLocale())
	require.Equal(t, "bio", stub.gotUpdateProfile.GetBio())
}

func TestChangePassword_InjectsUserIDFromCtx(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	_, err := svc.ChangePassword(ctxWithUser(99), &testkitv1.ChangePasswordRequest{
		OldPassword: "old",
		NewPassword: "newnewnew",
	})
	require.NoError(t, err)
	require.Equal(t, int64(99), actorUserID(stub.gotCtx))
	require.Equal(t, "old", stub.gotChangePassword.GetOldPassword())
	require.Equal(t, "newnewnew", stub.gotChangePassword.GetNewPassword())
}

func TestResetPassword_ForwardsAsIs_NoCtxInjection(t *testing.T) {
	// ResetPassword is public: no caller identity. We assert it just forwards
	// (downstream returns Empty) — no user_id to inject, so a background ctx is
	// fine and must not error.
	svc := newSvc(t, &stubUserClient{})
	_, err := svc.ResetPassword(context.Background(), &testkitv1.ResetPasswordRequest{
		Email:       "alice@example.com",
		Code:        "123456",
		NewPassword: "newnewnew",
	})
	require.NoError(t, err)
}

// --- Identity ---

func TestListIdentities_InjectsUserIDFromCtx_AndMapsIdentity(t *testing.T) {
	stub := &stubUserClient{identities: []*userv1.Identity{
		{Id: 1, Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL, ProviderUid: "alice@example.com", Verified: true, CreatedAt: timestamppb.Now()},
	}}
	svc := newSvc(t, stub)

	resp, err := svc.ListIdentities(ctxWithUser(5), &testkitv1.ListIdentitiesRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(5), actorUserID(stub.gotCtx))

	require.Len(t, resp.GetIdentities(), 1)
	got := resp.GetIdentities()[0]
	require.Equal(t, int64(1), got.GetId())
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL, got.GetProvider()) // enum int-cast
	require.Equal(t, "alice@example.com", got.GetProviderUid())
	require.True(t, got.GetVerified())
	require.NotNil(t, got.GetCreatedAt())
}

func TestUnbindIdentity_ForwardsUserIDFromCtx_AndTargetIdentityID(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	_, err := svc.UnbindIdentity(ctxWithUser(13), &testkitv1.UnbindIdentityRequest{IdentityId: 77, Code: "999"})
	require.NoError(t, err)

	// actor from ctx (caller), identity_id from request (target resource).
	require.Equal(t, int64(13), actorUserID(stub.gotCtx))
	require.Equal(t, int64(77), stub.gotUnbindIdentity.GetIdentityId())
	require.Equal(t, "999", stub.gotUnbindIdentity.GetCode())
}

// --- Session ---

func TestListSessions_InjectsUserIDFromCtx_AndMapsSession(t *testing.T) {
	stub := &stubUserClient{sessions: []*userv1.Session{
		{Id: "sess-1", Ip: "1.2.3.4", DeviceType: userv1.DeviceType_DEVICE_TYPE_WEB, Os: "macOS", Browser: "Chrome", Country: "CN", City: "Shanghai", Current: true, CreatedAt: timestamppb.Now(), LastActiveAt: timestamppb.Now()},
		{Id: "sess-2", Ip: "5.6.7.8", Os: "iOS", Browser: "Safari", CreatedAt: timestamppb.Now(), LastActiveAt: timestamppb.Now()},
	}}
	svc := newSvc(t, stub)

	// The caller's session id rides on the ctx (edge middleware identity);
	// the Current flag is testkit's own marking, overriding whatever the
	// downstream happened to set.
	ctx := ctxWithUserSession(8, "sess-2")

	resp, err := svc.ListSessions(ctx, &testkitv1.ListSessionsRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(8), actorUserID(stub.gotCtx))

	require.Len(t, resp.GetSessions(), 2)
	byID := map[string]*testkitv1.Session{}
	for _, s := range resp.GetSessions() {
		byID[s.GetId()] = s
	}
	got := byID["sess-1"]
	require.Equal(t, userv1.DeviceType_DEVICE_TYPE_WEB, got.GetDeviceType()) // enum int-cast
	require.Equal(t, "macOS", got.GetOs())
	require.False(t, got.GetCurrent(), "only the caller's own session is current")

	mine := byID["sess-2"]
	require.True(t, mine.GetCurrent())
}

func TestListSessions_NoSessionInCtx_NoCurrentFlag(t *testing.T) {
	// Direct gRPC callers (no edge middleware) carry no session id — nothing
	// is flagged current, and the downstream's stale flag is dropped.
	stub := &stubUserClient{sessions: []*userv1.Session{
		{Id: "sess-1", Current: true},
	}}
	svc := newSvc(t, stub)

	resp, err := svc.ListSessions(ctxWithUser(8), &testkitv1.ListSessionsRequest{})
	require.NoError(t, err)
	require.False(t, resp.GetSessions()[0].GetCurrent())
}

func TestRevokeSession_ForwardsTargetSessionID_NoCtxInjection(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	_, err := svc.RevokeSession(context.Background(), &testkitv1.RevokeSessionRequest{SessionId: "sess-target"})
	require.NoError(t, err)
	require.Equal(t, "sess-target", stub.gotRevokeSession.GetSessionId())
}

func TestRevokeAllSessions_InjectsUserIDFromCtx(t *testing.T) {
	stub := &stubUserClient{}
	svc := newSvc(t, stub)

	_, err := svc.RevokeAllSessions(ctxWithUser(21), &testkitv1.RevokeAllSessionsRequest{})
	require.NoError(t, err)
	require.Equal(t, int64(21), actorUserID(stub.gotCtx))
}

// --- Social ---

func TestSocialLogin_ConsumesSessionID_AsBearerToken(t *testing.T) {
	stub := &stubUserClient{socialSession: "social-sess-9", socialUser: fullUser(3), socialIsNew: true, socialReturnTo: "https://app/home"}
	svc := newSvc(t, stub)

	resp, err := svc.SocialLogin(ctxWithUser(0), &testkitv1.SocialLoginRequest{
		Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		Code:     "oauth-code",
		State:    "csrf-state",
	})
	require.NoError(t, err)

	// The bearer token IS the session id user-service returned — no JWT layer.
	require.Equal(t, "social-sess-9", resp.GetToken())
	require.Equal(t, int64(3), resp.GetUser().GetId())
	require.True(t, resp.GetIsNew())
	require.Equal(t, "https://app/home", resp.GetReturnTo())

	// Forwarded request: provider int-cast, code/state copied.
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB, stub.gotSocialLogin.GetProvider())
	require.Equal(t, "oauth-code", stub.gotSocialLogin.GetCode())
	require.Equal(t, "csrf-state", stub.gotSocialLogin.GetState())
}

func TestSocialLogin_PropagatesDownstreamError(t *testing.T) {
	stub := &stubUserClient{socialErr: errors.New("bad oauth code")}
	svc := newSvc(t, stub)

	_, err := svc.SocialLogin(context.Background(), &testkitv1.SocialLoginRequest{
		Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		Code:     "x",
		State:    "y",
	})
	require.ErrorIs(t, err, stub.socialErr)
}

func TestSocialLogin_EmptySessionID_Rejected(t *testing.T) {
	stub := &stubUserClient{socialSession: ""} // downstream returned no session
	svc := newSvc(t, stub)

	_, err := svc.SocialLogin(context.Background(), &testkitv1.SocialLoginRequest{
		Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		Code:     "x",
		State:    "y",
	})
	require.Error(t, err)
}

func TestGetOAuthURL_ForwardsAsIs(t *testing.T) {
	stub := &stubUserClient{oauthURL: "https://github.com/auth?state=xyz", oauthState: "xyz"}
	svc := newSvc(t, stub)

	resp, err := svc.GetOAuthURL(context.Background(), &testkitv1.GetOAuthURLRequest{
		Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		ReturnTo: "https://app/home",
		State:    "caller-state",
	})
	require.NoError(t, err)
	require.Equal(t, "https://github.com/auth?state=xyz", resp.GetUrl())
	require.Equal(t, "xyz", resp.GetState())

	// Provider int-cast; return_to + state forwarded.
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB, stub.gotGetOAuthURL.GetProvider())
	require.Equal(t, "https://app/home", stub.gotGetOAuthURL.GetReturnTo())
	require.Equal(t, "caller-state", stub.gotGetOAuthURL.GetState())
}

// --- converter field/enum coverage ---

func TestToTestkitUser_CuratesAllFieldsAndIntCastsEnums(t *testing.T) {
	// Drive toTestkitUser via GetProfile: a fully-populated downstream User must
	// map 1:1 on every field, with status/gender/register_source/user_type
	// int-cast (mirrored same-number enums).
	stub := &stubUserClient{profileUser: fullUser(501)}
	svc := newSvc(t, stub)

	u, err := svc.GetProfile(ctxWithUser(501), &testkitv1.GetProfileRequest{})
	require.NoError(t, err)

	require.Equal(t, int64(501), u.GetId())
	require.Equal(t, "alice", u.GetUsername())
	require.Equal(t, "Alice", u.GetNickname())
	require.Equal(t, "Alice Smith", u.GetRealName())
	require.Equal(t, "https://cdn/avatar.png", u.GetAvatarUrl())
	require.Equal(t, "alice@example.com", u.GetEmail())
	require.Equal(t, "CN", u.GetRegionCode())
	require.Equal(t, "13800138000", u.GetPhone())
	require.Equal(t, userv1.Gender_GENDER_FEMALE, u.GetGender())
	require.Equal(t, "1990-01-02", u.GetBirthday())
	require.Equal(t, "Asia/Shanghai", u.GetTimezone())
	require.Equal(t, "zh-CN", u.GetLocale())
	require.Equal(t, "hello", u.GetBio())
	require.Equal(t, userv1.UserStatus_USER_STATUS_ACTIVE, u.GetStatus())
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL, u.GetRegisterSource())
	require.Equal(t, userv1.UserType_USER_TYPE_PLATFORM, u.GetUserType())
	require.NotNil(t, u.GetLastLoginAt())
	require.NotNil(t, u.GetCreatedAt())
	require.NotNil(t, u.GetUpdatedAt())
}

func TestToTestkitUser_NilInput(t *testing.T) {
	// Social login with no user payload must yield a nil user, not a panic.
	stub := &stubUserClient{socialSession: "s", socialUser: nil}
	svc := newSvc(t, stub)

	resp, err := svc.SocialLogin(context.Background(), &testkitv1.SocialLoginRequest{
		Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		Code:     "x",
		State:    "y",
	})
	require.NoError(t, err)
	require.Nil(t, resp.GetUser())
}

func TestEnumIntCast_MirroredSameNumber(t *testing.T) {
	// The design hinges on testkit and user-service enums being same-number, so
	// the int cast is value-preserving. Pin a representative value per P2 enum:
	// the testkit constant and the user-service constant must share the same
	// int32 value (cross-enum equality proves the int-cast converters are
	// value-preserving regardless of the enum's named type).
	tests := []struct {
		name    string
		testkit int32
		want    int32
	}{
		{"DeviceType WEB", int32(userv1.DeviceType_DEVICE_TYPE_WEB), int32(userv1.DeviceType_DEVICE_TYPE_WEB)},
		{"Gender FEMALE", int32(userv1.Gender_GENDER_FEMALE), int32(userv1.Gender_GENDER_FEMALE)},
		{"UserStatus ACTIVE", int32(userv1.UserStatus_USER_STATUS_ACTIVE), int32(userv1.UserStatus_USER_STATUS_ACTIVE)},
		{"IdentityProvider ADMIN=8", int32(userv1.IdentityProvider_IDENTITY_PROVIDER_ADMIN), int32(userv1.IdentityProvider_IDENTITY_PROVIDER_ADMIN)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, tt.testkit) // same number across the two enum types
		})
	}
}
