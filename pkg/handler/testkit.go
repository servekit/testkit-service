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

// --- User-domain RPCs (P2: admin-users + RBAC management) ---
//
// Thin delegates to the user domain. Admin/RBAC RPCs carry their target
// resource IDs (user_id / group_id / role_id / permission_id ...) in the
// request — no ctx user_id injection. No RBAC enforcement this stage (decision
// 4): these are pure CRUD forwards; login state + identity are handled by the
// interceptor and downstream user-service applies business validation.

// --- Admin-Users (P2) ---

// CreateUser creates a user as an administrator (PENDING_REVIEW until activated).
func (h *Handler) CreateUser(ctx context.Context, req *testkitv1.CreateUserRequest) (*testkitv1.CreateUserResponse, error) {
	return h.svc.User().CreateUser(ctx, req)
}

// GetUser returns a user by target ID (admin view).
func (h *Handler) GetUser(ctx context.Context, req *testkitv1.GetUserRequest) (*testkitv1.User, error) {
	return h.svc.User().GetUser(ctx, req)
}

// ListUsers returns cursor-paginated users with rich filters.
func (h *Handler) ListUsers(ctx context.Context, req *testkitv1.ListUsersRequest) (*testkitv1.ListUsersResponse, error) {
	return h.svc.User().ListUsers(ctx, req)
}

// ListUsersPaged returns offset-paginated users for admin UIs.
func (h *Handler) ListUsersPaged(ctx context.Context, req *testkitv1.ListUsersPagedRequest) (*testkitv1.ListUsersPagedResponse, error) {
	return h.svc.User().ListUsersPaged(ctx, req)
}

// DisableUser toggles a target user between ACTIVE and DISABLED.
func (h *Handler) DisableUser(ctx context.Context, req *testkitv1.DisableUserRequest) (*testkitv1.User, error) {
	return h.svc.User().DisableUser(ctx, req)
}

// GetLoginLogs returns login audit logs, optionally filtered by target user_id.
func (h *Handler) GetLoginLogs(ctx context.Context, req *testkitv1.GetLoginLogsRequest) (*testkitv1.GetLoginLogsResponse, error) {
	return h.svc.User().GetLoginLogs(ctx, req)
}

// --- RBAC-Group (P2) ---

// CreateGroup creates a user group.
func (h *Handler) CreateGroup(ctx context.Context, req *testkitv1.CreateGroupRequest) (*testkitv1.Group, error) {
	return h.svc.User().CreateGroup(ctx, req)
}

// GetGroup returns a group by target ID.
func (h *Handler) GetGroup(ctx context.Context, req *testkitv1.GetGroupRequest) (*testkitv1.Group, error) {
	return h.svc.User().GetGroup(ctx, req)
}

// UpdateGroup updates a target group's name and description.
func (h *Handler) UpdateGroup(ctx context.Context, req *testkitv1.UpdateGroupRequest) (*testkitv1.Group, error) {
	return h.svc.User().UpdateGroup(ctx, req)
}

// ListGroups returns cursor-paginated groups.
func (h *Handler) ListGroups(ctx context.Context, req *testkitv1.ListGroupsRequest) (*testkitv1.ListGroupsResponse, error) {
	return h.svc.User().ListGroups(ctx, req)
}

// DeleteGroup removes a target group.
func (h *Handler) DeleteGroup(ctx context.Context, req *testkitv1.DeleteGroupRequest) (*emptypb.Empty, error) {
	return h.svc.User().DeleteGroup(ctx, req)
}

// AddGroupMember adds a target user to a target group.
func (h *Handler) AddGroupMember(ctx context.Context, req *testkitv1.AddGroupMemberRequest) (*emptypb.Empty, error) {
	return h.svc.User().AddGroupMember(ctx, req)
}

// RemoveGroupMember removes a target user from a target group.
func (h *Handler) RemoveGroupMember(ctx context.Context, req *testkitv1.RemoveGroupMemberRequest) (*emptypb.Empty, error) {
	return h.svc.User().RemoveGroupMember(ctx, req)
}

// ListGroupMembers returns members of a target group.
func (h *Handler) ListGroupMembers(ctx context.Context, req *testkitv1.ListGroupMembersRequest) (*testkitv1.ListGroupMembersResponse, error) {
	return h.svc.User().ListGroupMembers(ctx, req)
}

// AddGroupRole grants a target role to a target group.
func (h *Handler) AddGroupRole(ctx context.Context, req *testkitv1.AddGroupRoleRequest) (*emptypb.Empty, error) {
	return h.svc.User().AddGroupRole(ctx, req)
}

// RemoveGroupRole revokes a target role from a target group.
func (h *Handler) RemoveGroupRole(ctx context.Context, req *testkitv1.RemoveGroupRoleRequest) (*emptypb.Empty, error) {
	return h.svc.User().RemoveGroupRole(ctx, req)
}

// ListGroupRoles returns roles granted to a target group.
func (h *Handler) ListGroupRoles(ctx context.Context, req *testkitv1.ListGroupRolesRequest) (*testkitv1.ListGroupRolesResponse, error) {
	return h.svc.User().ListGroupRoles(ctx, req)
}

// --- RBAC-Role (P2) ---

// CreateRole creates a role with permissions and/or permission groups.
func (h *Handler) CreateRole(ctx context.Context, req *testkitv1.CreateRoleRequest) (*testkitv1.Role, error) {
	return h.svc.User().CreateRole(ctx, req)
}

// GetRole returns a role by target ID.
func (h *Handler) GetRole(ctx context.Context, req *testkitv1.GetRoleRequest) (*testkitv1.Role, error) {
	return h.svc.User().GetRole(ctx, req)
}

// UpdateRole updates a target role and replaces its permission sets.
func (h *Handler) UpdateRole(ctx context.Context, req *testkitv1.UpdateRoleRequest) (*testkitv1.Role, error) {
	return h.svc.User().UpdateRole(ctx, req)
}

// DeleteRole removes a target role.
func (h *Handler) DeleteRole(ctx context.Context, req *testkitv1.DeleteRoleRequest) (*emptypb.Empty, error) {
	return h.svc.User().DeleteRole(ctx, req)
}

// ListRoles returns cursor-paginated roles.
func (h *Handler) ListRoles(ctx context.Context, req *testkitv1.ListRolesRequest) (*testkitv1.ListRolesResponse, error) {
	return h.svc.User().ListRoles(ctx, req)
}

// AssignRole grants a target role to a target user.
func (h *Handler) AssignRole(ctx context.Context, req *testkitv1.AssignRoleRequest) (*emptypb.Empty, error) {
	return h.svc.User().AssignRole(ctx, req)
}

// RevokeRole revokes a directly-assigned role from a target user.
func (h *Handler) RevokeRole(ctx context.Context, req *testkitv1.RevokeRoleRequest) (*emptypb.Empty, error) {
	return h.svc.User().RevokeRole(ctx, req)
}

// ListUserRoles returns roles for a target user (direct + group-inherited).
func (h *Handler) ListUserRoles(ctx context.Context, req *testkitv1.ListUserRolesRequest) (*testkitv1.ListUserRolesResponse, error) {
	return h.svc.User().ListUserRoles(ctx, req)
}

// --- RBAC-Permission (P2) ---

// ListPermissions returns cursor-paginated permissions.
func (h *Handler) ListPermissions(ctx context.Context, req *testkitv1.ListPermissionsRequest) (*testkitv1.ListPermissionsResponse, error) {
	return h.svc.User().ListPermissions(ctx, req)
}

// CreatePermission adds a new resource:action permission.
func (h *Handler) CreatePermission(ctx context.Context, req *testkitv1.CreatePermissionRequest) (*testkitv1.Permission, error) {
	return h.svc.User().CreatePermission(ctx, req)
}

// GetPermission returns a permission by target ID.
func (h *Handler) GetPermission(ctx context.Context, req *testkitv1.GetPermissionRequest) (*testkitv1.Permission, error) {
	return h.svc.User().GetPermission(ctx, req)
}

// UpdatePermission updates a target permission.
func (h *Handler) UpdatePermission(ctx context.Context, req *testkitv1.UpdatePermissionRequest) (*testkitv1.Permission, error) {
	return h.svc.User().UpdatePermission(ctx, req)
}

// DeletePermission removes a target permission.
func (h *Handler) DeletePermission(ctx context.Context, req *testkitv1.DeletePermissionRequest) (*emptypb.Empty, error) {
	return h.svc.User().DeletePermission(ctx, req)
}

// CreatePermissionGroup creates a named bundle of permissions.
func (h *Handler) CreatePermissionGroup(ctx context.Context, req *testkitv1.CreatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return h.svc.User().CreatePermissionGroup(ctx, req)
}

// GetPermissionGroup returns a permission group by target ID.
func (h *Handler) GetPermissionGroup(ctx context.Context, req *testkitv1.GetPermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return h.svc.User().GetPermissionGroup(ctx, req)
}

// UpdatePermissionGroup updates a target permission group and replaces its perms.
func (h *Handler) UpdatePermissionGroup(ctx context.Context, req *testkitv1.UpdatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return h.svc.User().UpdatePermissionGroup(ctx, req)
}

// DeletePermissionGroup removes a target permission group.
func (h *Handler) DeletePermissionGroup(ctx context.Context, req *testkitv1.DeletePermissionGroupRequest) (*emptypb.Empty, error) {
	return h.svc.User().DeletePermissionGroup(ctx, req)
}

// ListPermissionGroups returns cursor-paginated permission groups.
func (h *Handler) ListPermissionGroups(ctx context.Context, req *testkitv1.ListPermissionGroupsRequest) (*testkitv1.ListPermissionGroupsResponse, error) {
	return h.svc.User().ListPermissionGroups(ctx, req)
}
