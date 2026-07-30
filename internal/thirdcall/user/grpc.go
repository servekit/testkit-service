package user

import (
	"context"
	"fmt"

	"google.golang.org/protobuf/types/known/emptypb"

	userv1 "github.com/servekit/user-service/gen/user/v1"
	userservice "github.com/servekit/user-service/pkg"
)

type grpcUser struct {
	client *userservice.Client
}

// NewGRPC dials user-service at target and returns a UserService over gRPC.
func NewGRPC(target string) (UserService, error) {
	c, err := userservice.NewClient(target)
	if err != nil {
		return nil, fmt.Errorf("dial user-service %q: %w", target, err)
	}
	return &grpcUser{client: c}, nil
}

func (g *grpcUser) Register(ctx context.Context, r *userv1.RegisterRequest) (*userv1.RegisterResponse, error) {
	return g.client.Register(ctx, r)
}
func (g *grpcUser) Login(ctx context.Context, r *userv1.LoginRequest) (*userv1.LoginResponse, error) {
	return g.client.Login(ctx, r)
}
func (g *grpcUser) Logout(ctx context.Context, r *userv1.LogoutRequest) (*emptypb.Empty, error) {
	return g.client.Logout(ctx, r)
}
func (g *grpcUser) RefreshSession(ctx context.Context, r *userv1.RefreshSessionRequest) (*emptypb.Empty, error) {
	return g.client.RefreshSession(ctx, r)
}
func (g *grpcUser) GetOAuthURL(ctx context.Context, r *userv1.GetOAuthURLRequest) (*userv1.GetOAuthURLResponse, error) {
	return g.client.GetOAuthURL(ctx, r)
}
func (g *grpcUser) SocialLogin(ctx context.Context, r *userv1.SocialLoginRequest) (*userv1.LoginResponse, error) {
	return g.client.SocialLogin(ctx, r)
}
func (g *grpcUser) MiniProgramLogin(ctx context.Context, r *userv1.MiniProgramLoginRequest) (*userv1.LoginResponse, error) {
	return g.client.MiniProgramLogin(ctx, r)
}
func (g *grpcUser) MiniProgramPhoneLogin(ctx context.Context, r *userv1.MiniProgramPhoneLoginRequest) (*userv1.LoginResponse, error) {
	return g.client.MiniProgramPhoneLogin(ctx, r)
}
func (g *grpcUser) GetProfile(ctx context.Context, r *userv1.GetProfileRequest) (*userv1.User, error) {
	return g.client.GetProfile(ctx, r)
}
func (g *grpcUser) UpdateProfile(ctx context.Context, r *userv1.UpdateProfileRequest) (*userv1.User, error) {
	return g.client.UpdateProfile(ctx, r)
}
func (g *grpcUser) ChangePassword(ctx context.Context, r *userv1.ChangePasswordRequest) (*emptypb.Empty, error) {
	return g.client.ChangePassword(ctx, r)
}
func (g *grpcUser) ResetPassword(ctx context.Context, r *userv1.ResetPasswordRequest) (*emptypb.Empty, error) {
	return g.client.ResetPassword(ctx, r)
}
func (g *grpcUser) ListIdentities(ctx context.Context, r *userv1.ListIdentitiesRequest) (*userv1.ListIdentitiesResponse, error) {
	return g.client.ListIdentities(ctx, r)
}
func (g *grpcUser) BindIdentity(ctx context.Context, r *userv1.BindIdentityRequest) (*userv1.Identity, error) {
	return g.client.BindIdentity(ctx, r)
}
func (g *grpcUser) BindOAuthIdentity(ctx context.Context, r *userv1.BindOAuthIdentityRequest) (*userv1.BindOAuthIdentityResponse, error) {
	return g.client.BindOAuthIdentity(ctx, r)
}
func (g *grpcUser) UnbindIdentity(ctx context.Context, r *userv1.UnbindIdentityRequest) (*emptypb.Empty, error) {
	return g.client.UnbindIdentity(ctx, r)
}
func (g *grpcUser) SendVerificationCode(ctx context.Context, r *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error) {
	return g.client.SendVerificationCode(ctx, r)
}
func (g *grpcUser) ListSessions(ctx context.Context, r *userv1.ListSessionsRequest) (*userv1.ListSessionsResponse, error) {
	return g.client.ListSessions(ctx, r)
}
func (g *grpcUser) RevokeSession(ctx context.Context, r *userv1.RevokeSessionRequest) (*emptypb.Empty, error) {
	return g.client.RevokeSession(ctx, r)
}
func (g *grpcUser) RevokeAllSessions(ctx context.Context, r *userv1.RevokeAllSessionsRequest) (*emptypb.Empty, error) {
	return g.client.RevokeAllSessions(ctx, r)
}
func (g *grpcUser) GetSession(ctx context.Context, r *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error) {
	return g.client.GetSession(ctx, r)
}
func (g *grpcUser) IssueSessionCode(ctx context.Context, r *userv1.IssueSessionCodeRequest) (*userv1.IssueSessionCodeResponse, error) {
	return g.client.IssueSessionCode(ctx, r)
}
func (g *grpcUser) ExchangeSessionCode(ctx context.Context, r *userv1.ExchangeSessionCodeRequest) (*userv1.ExchangeSessionCodeResponse, error) {
	return g.client.ExchangeSessionCode(ctx, r)
}
func (g *grpcUser) CreateUser(ctx context.Context, r *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error) {
	return g.client.CreateUser(ctx, r)
}
func (g *grpcUser) GetUser(ctx context.Context, r *userv1.GetUserRequest) (*userv1.User, error) {
	return g.client.GetUser(ctx, r)
}
func (g *grpcUser) ListUsers(ctx context.Context, r *userv1.ListUsersRequest) (*userv1.ListUsersResponse, error) {
	return g.client.ListUsers(ctx, r)
}
func (g *grpcUser) ListUsersPaged(ctx context.Context, r *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error) {
	return g.client.ListUsersPaged(ctx, r)
}
func (g *grpcUser) DisableUser(ctx context.Context, r *userv1.DisableUserRequest) (*userv1.User, error) {
	return g.client.DisableUser(ctx, r)
}
func (g *grpcUser) GetLoginLogs(ctx context.Context, r *userv1.GetLoginLogsRequest) (*userv1.GetLoginLogsResponse, error) {
	return g.client.GetLoginLogs(ctx, r)
}
func (g *grpcUser) CreateGroup(ctx context.Context, r *userv1.CreateGroupRequest) (*userv1.Group, error) {
	return g.client.CreateGroup(ctx, r)
}
func (g *grpcUser) GetGroup(ctx context.Context, r *userv1.GetGroupRequest) (*userv1.Group, error) {
	return g.client.GetGroup(ctx, r)
}
func (g *grpcUser) UpdateGroup(ctx context.Context, r *userv1.UpdateGroupRequest) (*userv1.Group, error) {
	return g.client.UpdateGroup(ctx, r)
}
func (g *grpcUser) ListGroups(ctx context.Context, r *userv1.ListGroupsRequest) (*userv1.ListGroupsResponse, error) {
	return g.client.ListGroups(ctx, r)
}
func (g *grpcUser) DeleteGroup(ctx context.Context, r *userv1.DeleteGroupRequest) (*emptypb.Empty, error) {
	return g.client.DeleteGroup(ctx, r)
}
func (g *grpcUser) AddGroupMember(ctx context.Context, r *userv1.AddGroupMemberRequest) (*emptypb.Empty, error) {
	return g.client.AddGroupMember(ctx, r)
}
func (g *grpcUser) RemoveGroupMember(ctx context.Context, r *userv1.RemoveGroupMemberRequest) (*emptypb.Empty, error) {
	return g.client.RemoveGroupMember(ctx, r)
}
func (g *grpcUser) ListGroupMembers(ctx context.Context, r *userv1.ListGroupMembersRequest) (*userv1.ListGroupMembersResponse, error) {
	return g.client.ListGroupMembers(ctx, r)
}
func (g *grpcUser) CreateRole(ctx context.Context, r *userv1.CreateRoleRequest) (*userv1.Role, error) {
	return g.client.CreateRole(ctx, r)
}
func (g *grpcUser) UpdateRole(ctx context.Context, r *userv1.UpdateRoleRequest) (*userv1.Role, error) {
	return g.client.UpdateRole(ctx, r)
}
func (g *grpcUser) DeleteRole(ctx context.Context, r *userv1.DeleteRoleRequest) (*emptypb.Empty, error) {
	return g.client.DeleteRole(ctx, r)
}
func (g *grpcUser) ListRoles(ctx context.Context, r *userv1.ListRolesRequest) (*userv1.ListRolesResponse, error) {
	return g.client.ListRoles(ctx, r)
}
func (g *grpcUser) GetRole(ctx context.Context, r *userv1.GetRoleRequest) (*userv1.Role, error) {
	return g.client.GetRole(ctx, r)
}
func (g *grpcUser) ListPermissions(ctx context.Context, r *userv1.ListPermissionsRequest) (*userv1.ListPermissionsResponse, error) {
	return g.client.ListPermissions(ctx, r)
}
func (g *grpcUser) CreatePermission(ctx context.Context, r *userv1.CreatePermissionRequest) (*userv1.Permission, error) {
	return g.client.CreatePermission(ctx, r)
}
func (g *grpcUser) GetPermission(ctx context.Context, r *userv1.GetPermissionRequest) (*userv1.Permission, error) {
	return g.client.GetPermission(ctx, r)
}
func (g *grpcUser) UpdatePermission(ctx context.Context, r *userv1.UpdatePermissionRequest) (*userv1.Permission, error) {
	return g.client.UpdatePermission(ctx, r)
}
func (g *grpcUser) DeletePermission(ctx context.Context, r *userv1.DeletePermissionRequest) (*emptypb.Empty, error) {
	return g.client.DeletePermission(ctx, r)
}
func (g *grpcUser) CreatePermissionGroup(ctx context.Context, r *userv1.CreatePermissionGroupRequest) (*userv1.PermissionGroup, error) {
	return g.client.CreatePermissionGroup(ctx, r)
}
func (g *grpcUser) GetPermissionGroup(ctx context.Context, r *userv1.GetPermissionGroupRequest) (*userv1.PermissionGroup, error) {
	return g.client.GetPermissionGroup(ctx, r)
}
func (g *grpcUser) UpdatePermissionGroup(ctx context.Context, r *userv1.UpdatePermissionGroupRequest) (*userv1.PermissionGroup, error) {
	return g.client.UpdatePermissionGroup(ctx, r)
}
func (g *grpcUser) DeletePermissionGroup(ctx context.Context, r *userv1.DeletePermissionGroupRequest) (*emptypb.Empty, error) {
	return g.client.DeletePermissionGroup(ctx, r)
}
func (g *grpcUser) ListPermissionGroups(ctx context.Context, r *userv1.ListPermissionGroupsRequest) (*userv1.ListPermissionGroupsResponse, error) {
	return g.client.ListPermissionGroups(ctx, r)
}
func (g *grpcUser) AddGroupRole(ctx context.Context, r *userv1.AddGroupRoleRequest) (*emptypb.Empty, error) {
	return g.client.AddGroupRole(ctx, r)
}
func (g *grpcUser) RemoveGroupRole(ctx context.Context, r *userv1.RemoveGroupRoleRequest) (*emptypb.Empty, error) {
	return g.client.RemoveGroupRole(ctx, r)
}
func (g *grpcUser) ListGroupRoles(ctx context.Context, r *userv1.ListGroupRolesRequest) (*userv1.ListGroupRolesResponse, error) {
	return g.client.ListGroupRoles(ctx, r)
}
func (g *grpcUser) AssignRole(ctx context.Context, r *userv1.AssignRoleRequest) (*emptypb.Empty, error) {
	return g.client.AssignRole(ctx, r)
}
func (g *grpcUser) RevokeRole(ctx context.Context, r *userv1.RevokeRoleRequest) (*emptypb.Empty, error) {
	return g.client.RevokeRole(ctx, r)
}
func (g *grpcUser) ListUserRoles(ctx context.Context, r *userv1.ListUserRolesRequest) (*userv1.ListUserRolesResponse, error) {
	return g.client.ListUserRoles(ctx, r)
}

func (g *grpcUser) Close() error { return g.client.Close() }
