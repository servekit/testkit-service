// Package user adapts user-service to testkit's internal needs. The UserService
// interface is testkit's seam over user-service: the user/auth/dashboard domains
// reach the downstream exclusively through it. Mirrors user-service's thirdcall
// pattern.
package user

import (
	"context"

	"google.golang.org/protobuf/types/known/emptypb"

	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// UserService is the subset of user-service testkit forwards (auth + user +
// dashboard domains, and the session resolver). Methods take/return
// user-service proto verbatim; Close releases the backend.
type UserService interface {
	Register(context.Context, *userv1.RegisterRequest) (*userv1.RegisterResponse, error)
	Login(context.Context, *userv1.LoginRequest) (*userv1.LoginResponse, error)
	Logout(context.Context, *userv1.LogoutRequest) (*emptypb.Empty, error)
	RefreshSession(context.Context, *userv1.RefreshSessionRequest) (*emptypb.Empty, error)
	GetOAuthURL(context.Context, *userv1.GetOAuthURLRequest) (*userv1.GetOAuthURLResponse, error)
	SocialLogin(context.Context, *userv1.SocialLoginRequest) (*userv1.LoginResponse, error)
	MiniProgramLogin(context.Context, *userv1.MiniProgramLoginRequest) (*userv1.LoginResponse, error)
	MiniProgramPhoneLogin(context.Context, *userv1.MiniProgramPhoneLoginRequest) (*userv1.LoginResponse, error)
	GetProfile(context.Context, *userv1.GetProfileRequest) (*userv1.User, error)
	UpdateProfile(context.Context, *userv1.UpdateProfileRequest) (*userv1.User, error)
	ChangePassword(context.Context, *userv1.ChangePasswordRequest) (*emptypb.Empty, error)
	ResetPassword(context.Context, *userv1.ResetPasswordRequest) (*emptypb.Empty, error)
	ListIdentities(context.Context, *userv1.ListIdentitiesRequest) (*userv1.ListIdentitiesResponse, error)
	BindIdentity(context.Context, *userv1.BindIdentityRequest) (*userv1.Identity, error)
	BindOAuthIdentity(context.Context, *userv1.BindOAuthIdentityRequest) (*userv1.BindOAuthIdentityResponse, error)
	UnbindIdentity(context.Context, *userv1.UnbindIdentityRequest) (*emptypb.Empty, error)
	SendVerificationCode(context.Context, *userv1.SendVerificationCodeRequest) (*userv1.SendVerificationCodeResponse, error)
	ListSessions(context.Context, *userv1.ListSessionsRequest) (*userv1.ListSessionsResponse, error)
	RevokeSession(context.Context, *userv1.RevokeSessionRequest) (*emptypb.Empty, error)
	RevokeAllSessions(context.Context, *userv1.RevokeAllSessionsRequest) (*emptypb.Empty, error)
	GetSession(context.Context, *userv1.GetSessionRequest) (*userv1.GetSessionResponse, error)
	IssueSessionCode(context.Context, *userv1.IssueSessionCodeRequest) (*userv1.IssueSessionCodeResponse, error)
	ExchangeSessionCode(context.Context, *userv1.ExchangeSessionCodeRequest) (*userv1.ExchangeSessionCodeResponse, error)
	CreateUser(context.Context, *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error)
	GetUser(context.Context, *userv1.GetUserRequest) (*userv1.User, error)
	ListUsers(context.Context, *userv1.ListUsersRequest) (*userv1.ListUsersResponse, error)
	ListUsersPaged(context.Context, *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error)
	DisableUser(context.Context, *userv1.DisableUserRequest) (*userv1.User, error)
	GetLoginLogs(context.Context, *userv1.GetLoginLogsRequest) (*userv1.GetLoginLogsResponse, error)
	CreateGroup(context.Context, *userv1.CreateGroupRequest) (*userv1.Group, error)
	GetGroup(context.Context, *userv1.GetGroupRequest) (*userv1.Group, error)
	UpdateGroup(context.Context, *userv1.UpdateGroupRequest) (*userv1.Group, error)
	ListGroups(context.Context, *userv1.ListGroupsRequest) (*userv1.ListGroupsResponse, error)
	DeleteGroup(context.Context, *userv1.DeleteGroupRequest) (*emptypb.Empty, error)
	AddGroupMember(context.Context, *userv1.AddGroupMemberRequest) (*emptypb.Empty, error)
	RemoveGroupMember(context.Context, *userv1.RemoveGroupMemberRequest) (*emptypb.Empty, error)
	ListGroupMembers(context.Context, *userv1.ListGroupMembersRequest) (*userv1.ListGroupMembersResponse, error)
	CreateRole(context.Context, *userv1.CreateRoleRequest) (*userv1.Role, error)
	UpdateRole(context.Context, *userv1.UpdateRoleRequest) (*userv1.Role, error)
	DeleteRole(context.Context, *userv1.DeleteRoleRequest) (*emptypb.Empty, error)
	ListRoles(context.Context, *userv1.ListRolesRequest) (*userv1.ListRolesResponse, error)
	GetRole(context.Context, *userv1.GetRoleRequest) (*userv1.Role, error)
	ListPermissions(context.Context, *userv1.ListPermissionsRequest) (*userv1.ListPermissionsResponse, error)
	CreatePermission(context.Context, *userv1.CreatePermissionRequest) (*userv1.Permission, error)
	GetPermission(context.Context, *userv1.GetPermissionRequest) (*userv1.Permission, error)
	UpdatePermission(context.Context, *userv1.UpdatePermissionRequest) (*userv1.Permission, error)
	DeletePermission(context.Context, *userv1.DeletePermissionRequest) (*emptypb.Empty, error)
	CreatePermissionGroup(context.Context, *userv1.CreatePermissionGroupRequest) (*userv1.PermissionGroup, error)
	GetPermissionGroup(context.Context, *userv1.GetPermissionGroupRequest) (*userv1.PermissionGroup, error)
	UpdatePermissionGroup(context.Context, *userv1.UpdatePermissionGroupRequest) (*userv1.PermissionGroup, error)
	DeletePermissionGroup(context.Context, *userv1.DeletePermissionGroupRequest) (*emptypb.Empty, error)
	ListPermissionGroups(context.Context, *userv1.ListPermissionGroupsRequest) (*userv1.ListPermissionGroupsResponse, error)
	AddGroupRole(context.Context, *userv1.AddGroupRoleRequest) (*emptypb.Empty, error)
	RemoveGroupRole(context.Context, *userv1.RemoveGroupRoleRequest) (*emptypb.Empty, error)
	ListGroupRoles(context.Context, *userv1.ListGroupRolesRequest) (*userv1.ListGroupRolesResponse, error)
	AssignRole(context.Context, *userv1.AssignRoleRequest) (*emptypb.Empty, error)
	RevokeRole(context.Context, *userv1.RevokeRoleRequest) (*emptypb.Empty, error)
	ListUserRoles(context.Context, *userv1.ListUserRolesRequest) (*userv1.ListUserRolesResponse, error)
	Close() error
}

var (
	_ UserService = (*moduleUser)(nil)
	_ UserService = (*grpcUser)(nil)
)
