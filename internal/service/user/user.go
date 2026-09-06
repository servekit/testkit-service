// Package user implements testkit's user domain: it forwards each user RPC
// (profile / identity / session / social self-service + admin-users management
// + RBAC group/role/permission management) to the embedded user-service and,
// for social-login RPCs, returns the user-service session id as the bearer
// token (an opaque session token — there is no JWT layer).
//
// This is the ONLY package in testkit-service that imports both testkitv1 and a
// downstream gen (userv1) — it is the testkit-msg ↔ user-msg mapping boundary
// (design spec v2 §3.3/§3.4). pkg/handler and the testkit proto see only
// testkitv1; the downstream user handler is reached exclusively through the
// userservice.Service seam held here.
//
// Curation rules (v2 §3.2):
//   - "My" RPCs (GetProfile / UpdateProfile / ChangePassword / ListIdentities /
//     BindIdentity / BindOAuthIdentity / UnbindIdentity / ListSessions /
//     RevokeAllSessions) drop the caller's user_id from the request — it is read
//     from the authenticated context (grpcx.GetUserIDFromCtx, injected by the
//     P1 auth interceptor) and injected into the downstream request.
//   - Target resource IDs stay in the request. For self-service RPCs these are
//     UnbindIdentity.identity_id and the session_id on
//     RevokeSession/GetSession/IssueSessionCode. For the admin and RBAC RPCs
//     below they are the target user_id (GetUser/DisableUser/GetLoginLogs/
//     AssignRole/RevokeRole/AddGroupMember/RemoveGroupMember), group_id,
//     role_id, permission_id, and permission_group_id. These describe WHAT is
//     acted on, not WHO is calling, so no ctx injection happens for them.
//   - Public RPCs (ResetPassword, GetOAuthURL, and the social-login RPCs) take
//     no caller identity at all.
//
// The admin + RBAC RPCs do NO RBAC enforcement this stage (decision 4:
// user-service RBAC is CRUD-only for now; enforcement is deferred to a future
// OPA integration). They are pure CRUD forwards — login state + identity
// injection are handled by the interceptor, and downstream user-service applies
// its own business validation.
//
// Social login (SocialLogin / MiniProgramLogin / MiniProgramPhoneLogin) consumes
// the session_id returned by user-service and returns it as the bearer token
// alongside {user, is_new, return_to} — the token IS the session id.
// GetOAuthURL is a plain forward (public, no session). This mirrors the P1
// auth domain's Login shape (design §3.3, decision 5) but lives in the user
// domain.
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

	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/servekit/go-common/grpcx"
	"github.com/servekit/go-common/xerr/xcodes"

	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"
	userv1 "github.com/servekit/api/gen/go/user/v1"
	userservice "github.com/servekit/user-service/pkg"
	usauth "github.com/servekit/user-service/pkg/auth"
)

// Service implements testkit's user domain. The user field is typed as the
// userservice.Service interface — the in-process wrapper and gRPC client
// both satisfy it; test stubs embed userv1.UnimplementedUserServiceServer,
// override the methods under test, and add a no-op Close (Task 2).
type Service struct {
	user userservice.Service
}

// Option configures a Service (for test injection).
type Option func(*Service)

// WithUserClient overrides the embedded user client (tests).
func WithUserClient(c userservice.Service) Option {
	return func(s *Service) { s.user = c }
}

// New constructs the user-domain service. userClient is the embedded
// user-service handler (userservice.Service).
func New(userClient userservice.Service, opts ...Option) *Service {
	s := &Service{user: userClient}
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

// ListSessions lists the CALLER's active sessions, flagging the one the
// caller is currently using. user_id is injected from ctx; the current
// session id likewise comes from the edge middleware's trusted identity.
func (s *Service) ListSessions(ctx context.Context, req *testkitv1.ListSessionsRequest) (*testkitv1.ListSessionsResponse, error) {
	userID, err := userIDFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	currentSID, _ := usauth.SessionIDFromCtx(ctx) // absent outside gateway calls

	resp, err := s.user.ListSessions(ctx, &userv1.ListSessionsRequest{
		UserId:   userID,
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
		Status:   userv1.SessionStatus(req.GetStatus()),
	})
	if err != nil {
		return nil, err
	}
	sessions := make([]*testkitv1.Session, 0, len(resp.GetSessions()))
	for _, sess := range resp.GetSessions() {
		ts := toTestkitSession(sess)
		ts.Current = ts.Id == currentSID
		sessions = append(sessions, ts)
	}
	return &testkitv1.ListSessionsResponse{Sessions: sessions, NextCursor: resp.GetNextCursor()}, nil
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
// user-service, then return the session_id as the bearer token (decision 5 —
// social login returns the session token in the USER domain, mirroring the
// auth domain's Login). GetOAuthURL is a plain public forward (no session).

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

// SocialLogin completes an OAuth login. user-service returns a session_id,
// which is returned as the bearer token.
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
// Same session-token shape as SocialLogin.
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
// Same session-token shape as SocialLogin.
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

// socialToTokenResponse is the shared social-login response builder: the
// session_id user-service returned becomes the bearer token, paired with the
// curated user view + the new-user / return_to hints.
func (s *Service) socialToTokenResponse(resp *userv1.LoginResponse) (*testkitv1.SocialLoginResponse, error) {
	sessionID := resp.GetSessionId()
	if sessionID == "" {
		return nil, errors.New("user: social login returned an empty session id")
	}
	return &testkitv1.SocialLoginResponse{
		Token:     sessionID,
		User:      toTestkitUser(resp.GetUser()),
		IsNew:     resp.GetIsNew(),
		ReturnTo:  resp.GetReturnTo(),
		SessionId: sessionID,
	}, nil
}

// --- Admin-Users (P2 Task 3 / Task 4 / Task 10) ---
//
// Admin RPCs forward target resource IDs (user_id) straight from the request —
// no ctx injection. The caller is an operator acting on a target user, not the
// user themselves (design §3.2). No RBAC enforcement this stage (decision 4):
// pure CRUD forwards; downstream user-service applies its own business checks.

// GetUser returns a user by target ID (admin view). user_id is the target, not
// the caller — no ctx injection.
func (s *Service) GetUser(ctx context.Context, req *testkitv1.GetUserRequest) (*testkitv1.User, error) {
	resp, err := s.user.GetUser(ctx, &userv1.GetUserRequest{UserId: req.GetUserId()})
	if err != nil {
		return nil, err
	}
	return toTestkitUser(resp), nil
}

// DisableUser toggles a target user between ACTIVE and DISABLED.
func (s *Service) DisableUser(ctx context.Context, req *testkitv1.DisableUserRequest) (*testkitv1.User, error) {
	resp, err := s.user.DisableUser(ctx, &userv1.DisableUserRequest{
		UserId:  req.GetUserId(),
		Disable: req.GetDisable(),
		Reason:  req.GetReason(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitUser(resp), nil
}

// CreateUser creates a user as an administrator (the account starts in
// PENDING_REVIEW and is activated by the user calling ChangePassword).
func (s *Service) CreateUser(ctx context.Context, req *testkitv1.CreateUserRequest) (*testkitv1.CreateUserResponse, error) {
	resp, err := s.user.CreateUser(ctx, toUserCreateUserRequest(req))
	if err != nil {
		return nil, err
	}
	return &testkitv1.CreateUserResponse{User: toTestkitUser(resp.GetUser())}, nil
}

// ListUsers returns cursor-paginated users with rich filters (stable iteration
// under concurrent writes).
func (s *Service) ListUsers(ctx context.Context, req *testkitv1.ListUsersRequest) (*testkitv1.ListUsersResponse, error) {
	resp, err := s.user.ListUsers(ctx, toUserListUsersRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListUsersResponse(resp), nil
}

// ListUsersPaged returns offset-paginated users with an optional total count,
// for admin UIs that need page numbers + totals.
func (s *Service) ListUsersPaged(ctx context.Context, req *testkitv1.ListUsersPagedRequest) (*testkitv1.ListUsersPagedResponse, error) {
	resp, err := s.user.ListUsersPaged(ctx, ToUserListUsersPagedRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitListUsersPagedResponse(resp), nil
}

// GetLoginLogs returns login audit logs, optionally filtered by a target
// user_id (0 = unfiltered).
func (s *Service) GetLoginLogs(ctx context.Context, req *testkitv1.GetLoginLogsRequest) (*testkitv1.GetLoginLogsResponse, error) {
	resp, err := s.user.GetLoginLogs(ctx, toUserGetLoginLogsRequest(req))
	if err != nil {
		return nil, err
	}
	return toTestkitGetLoginLogsResponse(resp), nil
}

// --- RBAC-Group (P2 Task 11) ---
//
// Groups are organizational units; members inherit the group's roles. group_id
// and target user_id/role_id are target resource IDs carried on the request.

// CreateGroup creates a user group (optionally nested under parent_id).
func (s *Service) CreateGroup(ctx context.Context, req *testkitv1.CreateGroupRequest) (*testkitv1.Group, error) {
	resp, err := s.user.CreateGroup(ctx, &userv1.CreateGroupRequest{
		Name:        req.GetName(),
		Description: req.GetDescription(),
		ParentId:    req.GetParentId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitGroup(resp), nil
}

// GetGroup returns a group by target ID.
func (s *Service) GetGroup(ctx context.Context, req *testkitv1.GetGroupRequest) (*testkitv1.Group, error) {
	resp, err := s.user.GetGroup(ctx, &userv1.GetGroupRequest{GroupId: req.GetGroupId()})
	if err != nil {
		return nil, err
	}
	return toTestkitGroup(resp), nil
}

// UpdateGroup updates a target group's name and description.
func (s *Service) UpdateGroup(ctx context.Context, req *testkitv1.UpdateGroupRequest) (*testkitv1.Group, error) {
	resp, err := s.user.UpdateGroup(ctx, &userv1.UpdateGroupRequest{
		GroupId:     req.GetGroupId(),
		Name:        req.GetName(),
		Description: req.GetDescription(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitGroup(resp), nil
}

// ListGroups returns cursor-paginated groups filtered by status.
func (s *Service) ListGroups(ctx context.Context, req *testkitv1.ListGroupsRequest) (*testkitv1.ListGroupsResponse, error) {
	resp, err := s.user.ListGroups(ctx, &userv1.ListGroupsRequest{
		Status:   req.GetStatus(),
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitListGroupsResponse(resp), nil
}

// DeleteGroup removes a target group. Members keep their user records.
func (s *Service) DeleteGroup(ctx context.Context, req *testkitv1.DeleteGroupRequest) (*emptypb.Empty, error) {
	return s.user.DeleteGroup(ctx, &userv1.DeleteGroupRequest{GroupId: req.GetGroupId()})
}

// AddGroupMember adds a target user to a target group with an in-group role.
func (s *Service) AddGroupMember(ctx context.Context, req *testkitv1.AddGroupMemberRequest) (*emptypb.Empty, error) {
	return s.user.AddGroupMember(ctx, &userv1.AddGroupMemberRequest{
		GroupId: req.GetGroupId(),
		UserId:  req.GetUserId(),
		Role:    req.GetRole(),
	})
}

// RemoveGroupMember removes a target user from a target group.
func (s *Service) RemoveGroupMember(ctx context.Context, req *testkitv1.RemoveGroupMemberRequest) (*emptypb.Empty, error) {
	return s.user.RemoveGroupMember(ctx, &userv1.RemoveGroupMemberRequest{
		GroupId: req.GetGroupId(),
		UserId:  req.GetUserId(),
	})
}

// ListGroupMembers returns members of a target group, optionally filtered by
// in-group role.
func (s *Service) ListGroupMembers(ctx context.Context, req *testkitv1.ListGroupMembersRequest) (*testkitv1.ListGroupMembersResponse, error) {
	resp, err := s.user.ListGroupMembers(ctx, &userv1.ListGroupMembersRequest{
		GroupId:  req.GetGroupId(),
		Role:     req.GetRole(),
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitListGroupMembersResponse(resp), nil
}

// AddGroupRole grants a target role to a target group (members inherit it).
func (s *Service) AddGroupRole(ctx context.Context, req *testkitv1.AddGroupRoleRequest) (*emptypb.Empty, error) {
	return s.user.AddGroupRole(ctx, &userv1.AddGroupRoleRequest{
		GroupId: req.GetGroupId(),
		RoleId:  req.GetRoleId(),
	})
}

// RemoveGroupRole revokes a target role from a target group.
func (s *Service) RemoveGroupRole(ctx context.Context, req *testkitv1.RemoveGroupRoleRequest) (*emptypb.Empty, error) {
	return s.user.RemoveGroupRole(ctx, &userv1.RemoveGroupRoleRequest{
		GroupId: req.GetGroupId(),
		RoleId:  req.GetRoleId(),
	})
}

// ListGroupRoles returns roles granted to a target group.
func (s *Service) ListGroupRoles(ctx context.Context, req *testkitv1.ListGroupRolesRequest) (*testkitv1.ListGroupRolesResponse, error) {
	resp, err := s.user.ListGroupRoles(ctx, &userv1.ListGroupRolesRequest{GroupId: req.GetGroupId()})
	if err != nil {
		return nil, err
	}
	roles := make([]*testkitv1.Role, 0, len(resp.GetRoles()))
	for _, r := range resp.GetRoles() {
		roles = append(roles, toTestkitRole(r))
	}
	return &testkitv1.ListGroupRolesResponse{Roles: roles}, nil
}

// --- RBAC-Role (P2 Task 5 / Task 12) ---
//
// Roles are named bundles of permissions, assignable to users (AssignRole) or
// groups (AddGroupRole above). role_id and target user_id are target resource
// IDs carried on the request.

// CreateRole creates a role with permissions and/or permission groups.
func (s *Service) CreateRole(ctx context.Context, req *testkitv1.CreateRoleRequest) (*testkitv1.Role, error) {
	resp, err := s.user.CreateRole(ctx, &userv1.CreateRoleRequest{
		Name:               req.GetName(),
		Description:        req.GetDescription(),
		PermissionIds:      req.GetPermissionIds(),
		PermissionGroupIds: req.GetPermissionGroupIds(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitRole(resp), nil
}

// GetRole returns a role by target ID, including its permissions + groups.
func (s *Service) GetRole(ctx context.Context, req *testkitv1.GetRoleRequest) (*testkitv1.Role, error) {
	resp, err := s.user.GetRole(ctx, &userv1.GetRoleRequest{RoleId: req.GetRoleId()})
	if err != nil {
		return nil, err
	}
	return toTestkitRole(resp), nil
}

// UpdateRole updates a target role and FULLY REPLACES its permission sets —
// pass the complete intended list, not deltas.
func (s *Service) UpdateRole(ctx context.Context, req *testkitv1.UpdateRoleRequest) (*testkitv1.Role, error) {
	resp, err := s.user.UpdateRole(ctx, &userv1.UpdateRoleRequest{
		RoleId:             req.GetRoleId(),
		Name:               req.GetName(),
		Description:        req.GetDescription(),
		PermissionIds:      req.GetPermissionIds(),
		PermissionGroupIds: req.GetPermissionGroupIds(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitRole(resp), nil
}

// DeleteRole removes a target role (cascades to user/group assignments).
func (s *Service) DeleteRole(ctx context.Context, req *testkitv1.DeleteRoleRequest) (*emptypb.Empty, error) {
	return s.user.DeleteRole(ctx, &userv1.DeleteRoleRequest{RoleId: req.GetRoleId()})
}

// ListRoles returns cursor-paginated roles.
func (s *Service) ListRoles(ctx context.Context, req *testkitv1.ListRolesRequest) (*testkitv1.ListRolesResponse, error) {
	resp, err := s.user.ListRoles(ctx, &userv1.ListRolesRequest{
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitListRolesResponse(resp), nil
}

// AssignRole grants a target role directly to a target user.
func (s *Service) AssignRole(ctx context.Context, req *testkitv1.AssignRoleRequest) (*emptypb.Empty, error) {
	return s.user.AssignRole(ctx, &userv1.AssignRoleRequest{
		UserId: req.GetUserId(),
		RoleId: req.GetRoleId(),
	})
}

// RevokeRole revokes a directly-assigned target role from a target user.
func (s *Service) RevokeRole(ctx context.Context, req *testkitv1.RevokeRoleRequest) (*emptypb.Empty, error) {
	return s.user.RevokeRole(ctx, &userv1.RevokeRoleRequest{
		UserId: req.GetUserId(),
		RoleId: req.GetRoleId(),
	})
}

// ListUserRoles returns roles for a target user (direct + group-inherited).
func (s *Service) ListUserRoles(ctx context.Context, req *testkitv1.ListUserRolesRequest) (*testkitv1.ListUserRolesResponse, error) {
	resp, err := s.user.ListUserRoles(ctx, &userv1.ListUserRolesRequest{UserId: req.GetUserId()})
	if err != nil {
		return nil, err
	}
	roles := make([]*testkitv1.UserRole, 0, len(resp.GetRoles()))
	for _, r := range resp.GetRoles() {
		roles = append(roles, toTestkitUserRole(r))
	}
	return &testkitv1.ListUserRolesResponse{Roles: roles}, nil
}

// --- RBAC-Permission (P2 Task 13) ---
//
// Permissions are resource:action catalog entries; permission groups are named
// bundles. permission_id / permission_group_id are target resource IDs.

// ListPermissions returns cursor-paginated permissions.
func (s *Service) ListPermissions(ctx context.Context, req *testkitv1.ListPermissionsRequest) (*testkitv1.ListPermissionsResponse, error) {
	resp, err := s.user.ListPermissions(ctx, &userv1.ListPermissionsRequest{
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitListPermissionsResponse(resp), nil
}

// CreatePermission adds a new resource:action permission (custom only).
func (s *Service) CreatePermission(ctx context.Context, req *testkitv1.CreatePermissionRequest) (*testkitv1.Permission, error) {
	resp, err := s.user.CreatePermission(ctx, &userv1.CreatePermissionRequest{
		Resource:    req.GetResource(),
		Action:      req.GetAction(),
		Description: req.GetDescription(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitPermission(resp), nil
}

// GetPermission returns a permission by target ID.
func (s *Service) GetPermission(ctx context.Context, req *testkitv1.GetPermissionRequest) (*testkitv1.Permission, error) {
	resp, err := s.user.GetPermission(ctx, &userv1.GetPermissionRequest{PermissionId: req.GetPermissionId()})
	if err != nil {
		return nil, err
	}
	return toTestkitPermission(resp), nil
}

// UpdatePermission updates a target permission's resource/action/description.
func (s *Service) UpdatePermission(ctx context.Context, req *testkitv1.UpdatePermissionRequest) (*testkitv1.Permission, error) {
	resp, err := s.user.UpdatePermission(ctx, &userv1.UpdatePermissionRequest{
		PermissionId: req.GetPermissionId(),
		Resource:     req.GetResource(),
		Action:       req.GetAction(),
		Description:  req.GetDescription(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitPermission(resp), nil
}

// DeletePermission removes a target permission (custom only).
func (s *Service) DeletePermission(ctx context.Context, req *testkitv1.DeletePermissionRequest) (*emptypb.Empty, error) {
	return s.user.DeletePermission(ctx, &userv1.DeletePermissionRequest{PermissionId: req.GetPermissionId()})
}

// CreatePermissionGroup creates a named bundle of permissions (custom only).
func (s *Service) CreatePermissionGroup(ctx context.Context, req *testkitv1.CreatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	resp, err := s.user.CreatePermissionGroup(ctx, &userv1.CreatePermissionGroupRequest{
		Name:          req.GetName(),
		Description:   req.GetDescription(),
		PermissionIds: req.GetPermissionIds(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitPermissionGroup(resp), nil
}

// GetPermissionGroup returns a permission group by target ID.
func (s *Service) GetPermissionGroup(ctx context.Context, req *testkitv1.GetPermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	resp, err := s.user.GetPermissionGroup(ctx, &userv1.GetPermissionGroupRequest{
		PermissionGroupId: req.GetPermissionGroupId(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitPermissionGroup(resp), nil
}

// UpdatePermissionGroup updates a target group and FULLY REPLACES its
// permission set — pass the complete list, not deltas.
func (s *Service) UpdatePermissionGroup(ctx context.Context, req *testkitv1.UpdatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	resp, err := s.user.UpdatePermissionGroup(ctx, &userv1.UpdatePermissionGroupRequest{
		PermissionGroupId: req.GetPermissionGroupId(),
		Name:              req.GetName(),
		Description:       req.GetDescription(),
		PermissionIds:     req.GetPermissionIds(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitPermissionGroup(resp), nil
}

// DeletePermissionGroup removes a target permission group (custom only).
func (s *Service) DeletePermissionGroup(ctx context.Context, req *testkitv1.DeletePermissionGroupRequest) (*emptypb.Empty, error) {
	return s.user.DeletePermissionGroup(ctx, &userv1.DeletePermissionGroupRequest{
		PermissionGroupId: req.GetPermissionGroupId(),
	})
}

// ListPermissionGroups returns cursor-paginated permission groups.
func (s *Service) ListPermissionGroups(ctx context.Context, req *testkitv1.ListPermissionGroupsRequest) (*testkitv1.ListPermissionGroupsResponse, error) {
	resp, err := s.user.ListPermissionGroups(ctx, &userv1.ListPermissionGroupsRequest{
		PageSize: req.GetPageSize(),
		Cursor:   req.GetCursor(),
	})
	if err != nil {
		return nil, err
	}
	return toTestkitListPermissionGroupsResponse(resp), nil
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
		Gender:         userv1.Gender(u.GetGender()),
		Birthday:       u.GetBirthday(),
		Timezone:       u.GetTimezone(),
		Locale:         u.GetLocale(),
		Bio:            u.GetBio(),
		Status:         userv1.UserStatus(u.GetStatus()),
		RegisterSource: userv1.IdentityProvider(u.GetRegisterSource()),
		UserType:       userv1.UserType(u.GetUserType()),
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
		Provider:    userv1.IdentityProvider(i.GetProvider()),
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
		DeviceType:   userv1.DeviceType(s.GetDeviceType()),
		Os:           s.GetOs(),
		Browser:      s.GetBrowser(),
		Country:      s.GetCountry(),
		City:         s.GetCity(),
		CreatedAt:    s.GetCreatedAt(),
		LastActiveAt: s.GetLastActiveAt(),
		Current:      s.GetCurrent(),
		Status:       userv1.SessionStatus(s.GetStatus()),
	}
}

// --- Admin-Users converters ---

func toUserCreateUserRequest(r *testkitv1.CreateUserRequest) *userv1.CreateUserRequest {
	return &userv1.CreateUserRequest{
		UserType:   userv1.UserType(r.GetUserType()),
		Username:   r.GetUsername(),
		Nickname:   r.GetNickname(),
		RealName:   r.GetRealName(),
		Email:      r.GetEmail(),
		RegionCode: r.GetRegionCode(),
		Phone:      r.GetPhone(),
		Password:   r.GetPassword(),
		Gender:     userv1.Gender(r.GetGender()),
		Timezone:   r.GetTimezone(),
		Locale:     r.GetLocale(),
	}
}

func toUserListUsersRequest(r *testkitv1.ListUsersRequest) *userv1.ListUsersRequest {
	return &userv1.ListUsersRequest{
		Status:           userv1.UserStatus(r.GetStatus()),
		Nickname:         r.GetNickname(),
		PageSize:         r.GetPageSize(),
		Cursor:           r.GetCursor(),
		Gender:           userv1.Gender(r.GetGender()),
		RegisterSource:   userv1.IdentityProvider(r.GetRegisterSource()),
		RegisterDevice:   userv1.DeviceType(r.GetRegisterDevice()),
		Locale:           r.GetLocale(),
		Timezone:         r.GetTimezone(),
		RegisterIp:       r.GetRegisterIp(),
		LastLoginIp:      r.GetLastLoginIp(),
		CreatedAtStart:   r.GetCreatedAtStart(),
		CreatedAtEnd:     r.GetCreatedAtEnd(),
		LastLoginAtStart: r.GetLastLoginAtStart(),
		LastLoginAtEnd:   r.GetLastLoginAtEnd(),
		UserIds:          r.GetUserIds(),
		Email:            r.GetEmail(),
		RegionCode:       r.GetRegionCode(),
		Phone:            r.GetPhone(),
		Username:         r.GetUsername(),
		UserType:         userv1.UserType(r.GetUserType()),
		OrderBy:          userv1.UserSortField(r.GetOrderBy()),
		Descending:       r.GetDescending(),
	}
}

// ToUserListUsersPagedRequest maps the testkit paged-list request to userv1.
// Exported so the field-by-field mapping can be exercised directly by table-
// driven tests (guards against drift as user-service evolves). This is the only
// exported converter in the package.
func ToUserListUsersPagedRequest(r *testkitv1.ListUsersPagedRequest) *userv1.ListUsersPagedRequest {
	return &userv1.ListUsersPagedRequest{
		Status:           userv1.UserStatus(r.GetStatus()),
		Nickname:         r.GetNickname(),
		Gender:           userv1.Gender(r.GetGender()),
		RegisterSource:   userv1.IdentityProvider(r.GetRegisterSource()),
		RegisterDevice:   userv1.DeviceType(r.GetRegisterDevice()),
		UserType:         userv1.UserType(r.GetUserType()),
		Locale:           r.GetLocale(),
		Timezone:         r.GetTimezone(),
		RegisterIp:       r.GetRegisterIp(),
		LastLoginIp:      r.GetLastLoginIp(),
		CreatedAtStart:   r.GetCreatedAtStart(),
		CreatedAtEnd:     r.GetCreatedAtEnd(),
		LastLoginAtStart: r.GetLastLoginAtStart(),
		LastLoginAtEnd:   r.GetLastLoginAtEnd(),
		UserIds:          r.GetUserIds(),
		Email:            r.GetEmail(),
		RegionCode:       r.GetRegionCode(),
		Phone:            r.GetPhone(),
		Username:         r.GetUsername(),
		OrderBy:          userv1.UserSortField(r.GetOrderBy()),
		Descending:       r.GetDescending(),
		Page:             r.GetPage(),
		PageSize:         r.GetPageSize(),
		Count:            r.GetCount(),
	}
}

func toUserGetLoginLogsRequest(r *testkitv1.GetLoginLogsRequest) *userv1.GetLoginLogsRequest {
	return &userv1.GetLoginLogsRequest{
		UserId:   r.GetUserId(),
		Provider: userv1.IdentityProvider(r.GetProvider()),
		Success:  r.Success, // optional: nil = both outcomes
		Action:   userv1.LoginAction(r.GetAction()),
		Method:   userv1.LoginMethod(r.GetMethod()),
		Username: r.GetUsername(),
		PageSize: r.GetPageSize(),
		Cursor:   r.GetCursor(),
	}
}

func toTestkitListUsersResponse(r *userv1.ListUsersResponse) *testkitv1.ListUsersResponse {
	if r == nil {
		return nil
	}
	users := make([]*testkitv1.User, 0, len(r.GetUsers()))
	for _, u := range r.GetUsers() {
		users = append(users, toTestkitUser(u))
	}
	return &testkitv1.ListUsersResponse{Users: users, NextCursor: r.GetNextCursor()}
}

func toTestkitListUsersPagedResponse(r *userv1.ListUsersPagedResponse) *testkitv1.ListUsersPagedResponse {
	if r == nil {
		return nil
	}
	users := make([]*testkitv1.User, 0, len(r.GetUsers()))
	for _, u := range r.GetUsers() {
		users = append(users, toTestkitUser(u))
	}
	return &testkitv1.ListUsersPagedResponse{
		Users:      users,
		Total:      r.GetTotal(),
		TotalPages: r.GetTotalPages(),
	}
}

func toTestkitGetLoginLogsResponse(r *userv1.GetLoginLogsResponse) *testkitv1.GetLoginLogsResponse {
	if r == nil {
		return nil
	}
	logs := make([]*testkitv1.LoginLog, 0, len(r.GetLogs()))
	for _, l := range r.GetLogs() {
		logs = append(logs, toTestkitLoginLog(l))
	}
	return &testkitv1.GetLoginLogsResponse{
		Logs:       logs,
		NextCursor: r.GetNextCursor(),
		Total:      r.GetTotal(),
	}
}

// toTestkitLoginLog curates a user-service LoginLog into the frontend view.
// provider/action/device_type are int-cast (mirrored same-number enums).
func toTestkitLoginLog(l *userv1.LoginLog) *testkitv1.LoginLog {
	if l == nil {
		return nil
	}
	return &testkitv1.LoginLog{
		Id:         l.GetId(),
		UserId:     l.GetUserId(),
		Provider:   userv1.IdentityProvider(l.GetProvider()),
		Action:     userv1.LoginAction(l.GetAction()),
		Success:    l.GetSuccess(),
		FailReason: l.GetFailReason(),
		Ip:         l.GetIp(),
		Method:     userv1.LoginMethod(l.GetMethod()),
		Target:     l.GetTarget(),
		Username:   l.GetUsername(),
		DeviceType: userv1.DeviceType(l.GetDeviceType()),
		Os:         l.GetOs(),
		Browser:    l.GetBrowser(),
		Country:    l.GetCountry(),
		City:       l.GetCity(),
		CreatedAt:  l.GetCreatedAt(),
	}
}

// --- RBAC converters ---
//
// Group/Role/Permission/PermissionGroup/GroupMember/UserRole each mirror
// user-service field-for-field (enums int-cast). Roles and permission groups
// carry nested permissions, mapped recursively.

func toTestkitGroup(g *userv1.Group) *testkitv1.Group {
	if g == nil {
		return nil
	}
	return &testkitv1.Group{
		Id:          g.GetId(),
		Name:        g.GetName(),
		Description: g.GetDescription(),
		ParentId:    g.GetParentId(),
		Status:      g.GetStatus(),
		MemberCount: g.GetMemberCount(),
		CreatedAt:   g.GetCreatedAt(),
		UpdatedAt:   g.GetUpdatedAt(),
	}
}

func toTestkitGroupMember(m *userv1.GroupMember) *testkitv1.GroupMember {
	if m == nil {
		return nil
	}
	return &testkitv1.GroupMember{
		UserId:    m.GetUserId(),
		Nickname:  m.GetNickname(),
		AvatarUrl: m.GetAvatarUrl(),
		Role:      m.GetRole(),
		CreatedAt: m.GetCreatedAt(),
	}
}

// toTestkitRole maps a role, recursing into its nested permissions and
// permission groups (both reuse toTestkitPermission / toTestkitPermissionGroup).
func toTestkitRole(r *userv1.Role) *testkitv1.Role {
	if r == nil {
		return nil
	}
	perms := make([]*testkitv1.Permission, 0, len(r.GetPermissions()))
	for _, p := range r.GetPermissions() {
		perms = append(perms, toTestkitPermission(p))
	}
	groups := make([]*testkitv1.PermissionGroup, 0, len(r.GetPermGroups()))
	for _, g := range r.GetPermGroups() {
		groups = append(groups, toTestkitPermissionGroup(g))
	}
	return &testkitv1.Role{
		Id:          r.GetId(),
		Name:        r.GetName(),
		Description: r.GetDescription(),
		IsBuiltin:   r.GetIsBuiltin(),
		Permissions: perms,
		PermGroups:  groups,
		CreatedAt:   r.GetCreatedAt(),
		UpdatedAt:   r.GetUpdatedAt(),
	}
}

func toTestkitPermission(p *userv1.Permission) *testkitv1.Permission {
	if p == nil {
		return nil
	}
	return &testkitv1.Permission{
		Id:          p.GetId(),
		Resource:    p.GetResource(),
		Action:      p.GetAction(),
		Description: p.GetDescription(),
		IsBuiltin:   p.GetIsBuiltin(),
	}
}

// toTestkitPermissionGroup maps a permission group, recursing into its nested
// permissions.
func toTestkitPermissionGroup(g *userv1.PermissionGroup) *testkitv1.PermissionGroup {
	if g == nil {
		return nil
	}
	perms := make([]*testkitv1.Permission, 0, len(g.GetPermissions()))
	for _, p := range g.GetPermissions() {
		perms = append(perms, toTestkitPermission(p))
	}
	return &testkitv1.PermissionGroup{
		Id:          g.GetId(),
		Name:        g.GetName(),
		Description: g.GetDescription(),
		Permissions: perms,
		IsBuiltin:   g.GetIsBuiltin(),
	}
}

func toTestkitUserRole(r *userv1.UserRole) *testkitv1.UserRole {
	if r == nil {
		return nil
	}
	return &testkitv1.UserRole{
		Id:        r.GetId(),
		RoleId:    r.GetRoleId(),
		RoleName:  r.GetRoleName(),
		Source:    r.GetSource(),
		CreatedAt: r.GetCreatedAt(),
	}
}

func toTestkitListGroupsResponse(r *userv1.ListGroupsResponse) *testkitv1.ListGroupsResponse {
	if r == nil {
		return nil
	}
	groups := make([]*testkitv1.Group, 0, len(r.GetGroups()))
	for _, g := range r.GetGroups() {
		groups = append(groups, toTestkitGroup(g))
	}
	return &testkitv1.ListGroupsResponse{
		Groups:     groups,
		NextCursor: r.GetNextCursor(),
		Total:      r.GetTotal(),
	}
}

func toTestkitListGroupMembersResponse(r *userv1.ListGroupMembersResponse) *testkitv1.ListGroupMembersResponse {
	if r == nil {
		return nil
	}
	members := make([]*testkitv1.GroupMember, 0, len(r.GetMembers()))
	for _, m := range r.GetMembers() {
		members = append(members, toTestkitGroupMember(m))
	}
	return &testkitv1.ListGroupMembersResponse{
		Members:    members,
		NextCursor: r.GetNextCursor(),
		Total:      r.GetTotal(),
	}
}

func toTestkitListRolesResponse(r *userv1.ListRolesResponse) *testkitv1.ListRolesResponse {
	if r == nil {
		return nil
	}
	roles := make([]*testkitv1.Role, 0, len(r.GetRoles()))
	for _, rl := range r.GetRoles() {
		roles = append(roles, toTestkitRole(rl))
	}
	return &testkitv1.ListRolesResponse{
		Roles:      roles,
		NextCursor: r.GetNextCursor(),
		Total:      r.GetTotal(),
	}
}

func toTestkitListPermissionsResponse(r *userv1.ListPermissionsResponse) *testkitv1.ListPermissionsResponse {
	if r == nil {
		return nil
	}
	perms := make([]*testkitv1.Permission, 0, len(r.GetPermissions()))
	for _, p := range r.GetPermissions() {
		perms = append(perms, toTestkitPermission(p))
	}
	return &testkitv1.ListPermissionsResponse{
		Permissions: perms,
		NextCursor:  r.GetNextCursor(),
		Total:       r.GetTotal(),
	}
}

func toTestkitListPermissionGroupsResponse(r *userv1.ListPermissionGroupsResponse) *testkitv1.ListPermissionGroupsResponse {
	if r == nil {
		return nil
	}
	groups := make([]*testkitv1.PermissionGroup, 0, len(r.GetGroups()))
	for _, g := range r.GetGroups() {
		groups = append(groups, toTestkitPermissionGroup(g))
	}
	return &testkitv1.ListPermissionGroupsResponse{
		Groups:     groups,
		NextCursor: r.GetNextCursor(),
		Total:      r.GetTotal(),
	}
}
