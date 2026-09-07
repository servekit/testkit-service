package pkg

import (
	"context"
	"fmt"

	commonv1 "github.com/servekit/api/gen/go/common/v1"
	referencev1 "github.com/servekit/api/gen/go/reference/v1"
	testkitv1 "github.com/servekit/api/gen/go/testkit/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

// Client is a gRPC client for testkit-service shaped like *Handler: it implements
// the generated testkitv1.TestkitServiceServer interface (unary methods without
// grpc.CallOption), so a consumer can hold either backend behind the
// provider-defined Service interface — module mode passes the *Handler, grpc
// mode passes the *Client — with no per-consumer adapter.
//
// The UnimplementedTestkitServiceServer embed satisfies the interface's
// mustEmbed guard; every RPC below shadows it with a real delegation. When a
// new RPC is added to the proto, add its delegation here — until then grpc
// mode returns codes.Unimplemented for it.
type Client struct {
	testkitv1.UnimplementedTestkitServiceServer

	conn *grpc.ClientConn
	cli  testkitv1.TestkitServiceClient
}

// Compile-time assertion: *Client and *Handler expose the same interface.
var _ testkitv1.TestkitServiceServer = (*Client)(nil)

// NewClient dials testkit-service at addr using insecure credentials by default.
// Pass additional DialOptions (e.g., credentials) to override.
func NewClient(addr string, opts ...grpc.DialOption) (*Client, error) {
	dialOpts := append([]grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}, opts...)
	conn, err := grpc.NewClient(addr, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}
	return &Client{conn: conn, cli: testkitv1.NewTestkitServiceClient(conn)}, nil
}

// Close releases the underlying gRPC connection.
func (c *Client) Close() error { return c.conn.Close() }

// Ping delegates to the remote testkit-service.
func (c *Client) Ping(ctx context.Context, in *emptypb.Empty) (*commonv1.Pong, error) {
	return c.cli.Ping(ctx, in)
}

// Login delegates to the remote testkit-service.
func (c *Client) Login(ctx context.Context, in *testkitv1.LoginRequest) (*testkitv1.TokenResponse, error) {
	return c.cli.Login(ctx, in)
}

// Register delegates to the remote testkit-service.
func (c *Client) Register(ctx context.Context, in *testkitv1.RegisterRequest) (*testkitv1.TokenResponse, error) {
	return c.cli.Register(ctx, in)
}

// SendVerificationCode delegates to the remote testkit-service.
func (c *Client) SendVerificationCode(ctx context.Context, in *testkitv1.SendVerificationCodeRequest) (*testkitv1.SendVerificationCodeResponse, error) {
	return c.cli.SendVerificationCode(ctx, in)
}

// Logout delegates to the remote testkit-service.
func (c *Client) Logout(ctx context.Context, in *emptypb.Empty) (*emptypb.Empty, error) {
	return c.cli.Logout(ctx, in)
}

// GetProfile delegates to the remote testkit-service.
func (c *Client) GetProfile(ctx context.Context, in *testkitv1.GetProfileRequest) (*testkitv1.User, error) {
	return c.cli.GetProfile(ctx, in)
}

// UpdateProfile delegates to the remote testkit-service.
func (c *Client) UpdateProfile(ctx context.Context, in *testkitv1.UpdateProfileRequest) (*testkitv1.User, error) {
	return c.cli.UpdateProfile(ctx, in)
}

// ChangePassword delegates to the remote testkit-service.
func (c *Client) ChangePassword(ctx context.Context, in *testkitv1.ChangePasswordRequest) (*emptypb.Empty, error) {
	return c.cli.ChangePassword(ctx, in)
}

// ResetPassword delegates to the remote testkit-service.
func (c *Client) ResetPassword(ctx context.Context, in *testkitv1.ResetPasswordRequest) (*emptypb.Empty, error) {
	return c.cli.ResetPassword(ctx, in)
}

// ListIdentities delegates to the remote testkit-service.
func (c *Client) ListIdentities(ctx context.Context, in *testkitv1.ListIdentitiesRequest) (*testkitv1.ListIdentitiesResponse, error) {
	return c.cli.ListIdentities(ctx, in)
}

// BindIdentity delegates to the remote testkit-service.
func (c *Client) BindIdentity(ctx context.Context, in *testkitv1.BindIdentityRequest) (*testkitv1.Identity, error) {
	return c.cli.BindIdentity(ctx, in)
}

// BindOAuthIdentity delegates to the remote testkit-service.
func (c *Client) BindOAuthIdentity(ctx context.Context, in *testkitv1.BindOAuthIdentityRequest) (*testkitv1.BindOAuthIdentityResponse, error) {
	return c.cli.BindOAuthIdentity(ctx, in)
}

// UnbindIdentity delegates to the remote testkit-service.
func (c *Client) UnbindIdentity(ctx context.Context, in *testkitv1.UnbindIdentityRequest) (*emptypb.Empty, error) {
	return c.cli.UnbindIdentity(ctx, in)
}

// ListSessions delegates to the remote testkit-service.
func (c *Client) ListSessions(ctx context.Context, in *testkitv1.ListSessionsRequest) (*testkitv1.ListSessionsResponse, error) {
	return c.cli.ListSessions(ctx, in)
}

// RevokeSession delegates to the remote testkit-service.
func (c *Client) RevokeSession(ctx context.Context, in *testkitv1.RevokeSessionRequest) (*emptypb.Empty, error) {
	return c.cli.RevokeSession(ctx, in)
}

// RevokeAllSessions delegates to the remote testkit-service.
func (c *Client) RevokeAllSessions(ctx context.Context, in *testkitv1.RevokeAllSessionsRequest) (*emptypb.Empty, error) {
	return c.cli.RevokeAllSessions(ctx, in)
}

// GetSession delegates to the remote testkit-service.
func (c *Client) GetSession(ctx context.Context, in *testkitv1.GetSessionRequest) (*testkitv1.GetSessionResponse, error) {
	return c.cli.GetSession(ctx, in)
}

// IssueSessionCode delegates to the remote testkit-service.
func (c *Client) IssueSessionCode(ctx context.Context, in *testkitv1.IssueSessionCodeRequest) (*testkitv1.IssueSessionCodeResponse, error) {
	return c.cli.IssueSessionCode(ctx, in)
}

// ExchangeSessionCode delegates to the remote testkit-service.
func (c *Client) ExchangeSessionCode(ctx context.Context, in *testkitv1.ExchangeSessionCodeRequest) (*testkitv1.ExchangeSessionCodeResponse, error) {
	return c.cli.ExchangeSessionCode(ctx, in)
}

// GetOAuthURL delegates to the remote testkit-service.
func (c *Client) GetOAuthURL(ctx context.Context, in *testkitv1.GetOAuthURLRequest) (*testkitv1.GetOAuthURLResponse, error) {
	return c.cli.GetOAuthURL(ctx, in)
}

// SocialLogin delegates to the remote testkit-service.
func (c *Client) SocialLogin(ctx context.Context, in *testkitv1.SocialLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return c.cli.SocialLogin(ctx, in)
}

// MiniProgramLogin delegates to the remote testkit-service.
func (c *Client) MiniProgramLogin(ctx context.Context, in *testkitv1.MiniProgramLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return c.cli.MiniProgramLogin(ctx, in)
}

// MiniProgramPhoneLogin delegates to the remote testkit-service.
func (c *Client) MiniProgramPhoneLogin(ctx context.Context, in *testkitv1.MiniProgramPhoneLoginRequest) (*testkitv1.SocialLoginResponse, error) {
	return c.cli.MiniProgramPhoneLogin(ctx, in)
}

// CreateUser delegates to the remote testkit-service.
func (c *Client) CreateUser(ctx context.Context, in *testkitv1.CreateUserRequest) (*testkitv1.CreateUserResponse, error) {
	return c.cli.CreateUser(ctx, in)
}

// GetUser delegates to the remote testkit-service.
func (c *Client) GetUser(ctx context.Context, in *testkitv1.GetUserRequest) (*testkitv1.User, error) {
	return c.cli.GetUser(ctx, in)
}

// ListUsers delegates to the remote testkit-service.
func (c *Client) ListUsers(ctx context.Context, in *testkitv1.ListUsersRequest) (*testkitv1.ListUsersResponse, error) {
	return c.cli.ListUsers(ctx, in)
}

// ListUsersPaged delegates to the remote testkit-service.
func (c *Client) ListUsersPaged(ctx context.Context, in *testkitv1.ListUsersPagedRequest) (*testkitv1.ListUsersPagedResponse, error) {
	return c.cli.ListUsersPaged(ctx, in)
}

// DisableUser delegates to the remote testkit-service.
func (c *Client) DisableUser(ctx context.Context, in *testkitv1.DisableUserRequest) (*testkitv1.User, error) {
	return c.cli.DisableUser(ctx, in)
}

// GetLoginLogs delegates to the remote testkit-service.
func (c *Client) GetLoginLogs(ctx context.Context, in *testkitv1.GetLoginLogsRequest) (*testkitv1.GetLoginLogsResponse, error) {
	return c.cli.GetLoginLogs(ctx, in)
}

// CreateGroup delegates to the remote testkit-service.
func (c *Client) CreateGroup(ctx context.Context, in *testkitv1.CreateGroupRequest) (*testkitv1.Group, error) {
	return c.cli.CreateGroup(ctx, in)
}

// GetGroup delegates to the remote testkit-service.
func (c *Client) GetGroup(ctx context.Context, in *testkitv1.GetGroupRequest) (*testkitv1.Group, error) {
	return c.cli.GetGroup(ctx, in)
}

// UpdateGroup delegates to the remote testkit-service.
func (c *Client) UpdateGroup(ctx context.Context, in *testkitv1.UpdateGroupRequest) (*testkitv1.Group, error) {
	return c.cli.UpdateGroup(ctx, in)
}

// ListGroups delegates to the remote testkit-service.
func (c *Client) ListGroups(ctx context.Context, in *testkitv1.ListGroupsRequest) (*testkitv1.ListGroupsResponse, error) {
	return c.cli.ListGroups(ctx, in)
}

// DeleteGroup delegates to the remote testkit-service.
func (c *Client) DeleteGroup(ctx context.Context, in *testkitv1.DeleteGroupRequest) (*emptypb.Empty, error) {
	return c.cli.DeleteGroup(ctx, in)
}

// AddGroupMember delegates to the remote testkit-service.
func (c *Client) AddGroupMember(ctx context.Context, in *testkitv1.AddGroupMemberRequest) (*emptypb.Empty, error) {
	return c.cli.AddGroupMember(ctx, in)
}

// RemoveGroupMember delegates to the remote testkit-service.
func (c *Client) RemoveGroupMember(ctx context.Context, in *testkitv1.RemoveGroupMemberRequest) (*emptypb.Empty, error) {
	return c.cli.RemoveGroupMember(ctx, in)
}

// ListGroupMembers delegates to the remote testkit-service.
func (c *Client) ListGroupMembers(ctx context.Context, in *testkitv1.ListGroupMembersRequest) (*testkitv1.ListGroupMembersResponse, error) {
	return c.cli.ListGroupMembers(ctx, in)
}

// AddGroupRole delegates to the remote testkit-service.
func (c *Client) AddGroupRole(ctx context.Context, in *testkitv1.AddGroupRoleRequest) (*emptypb.Empty, error) {
	return c.cli.AddGroupRole(ctx, in)
}

// RemoveGroupRole delegates to the remote testkit-service.
func (c *Client) RemoveGroupRole(ctx context.Context, in *testkitv1.RemoveGroupRoleRequest) (*emptypb.Empty, error) {
	return c.cli.RemoveGroupRole(ctx, in)
}

// ListGroupRoles delegates to the remote testkit-service.
func (c *Client) ListGroupRoles(ctx context.Context, in *testkitv1.ListGroupRolesRequest) (*testkitv1.ListGroupRolesResponse, error) {
	return c.cli.ListGroupRoles(ctx, in)
}

// CreateRole delegates to the remote testkit-service.
func (c *Client) CreateRole(ctx context.Context, in *testkitv1.CreateRoleRequest) (*testkitv1.Role, error) {
	return c.cli.CreateRole(ctx, in)
}

// GetRole delegates to the remote testkit-service.
func (c *Client) GetRole(ctx context.Context, in *testkitv1.GetRoleRequest) (*testkitv1.Role, error) {
	return c.cli.GetRole(ctx, in)
}

// UpdateRole delegates to the remote testkit-service.
func (c *Client) UpdateRole(ctx context.Context, in *testkitv1.UpdateRoleRequest) (*testkitv1.Role, error) {
	return c.cli.UpdateRole(ctx, in)
}

// DeleteRole delegates to the remote testkit-service.
func (c *Client) DeleteRole(ctx context.Context, in *testkitv1.DeleteRoleRequest) (*emptypb.Empty, error) {
	return c.cli.DeleteRole(ctx, in)
}

// ListRoles delegates to the remote testkit-service.
func (c *Client) ListRoles(ctx context.Context, in *testkitv1.ListRolesRequest) (*testkitv1.ListRolesResponse, error) {
	return c.cli.ListRoles(ctx, in)
}

// AssignRole delegates to the remote testkit-service.
func (c *Client) AssignRole(ctx context.Context, in *testkitv1.AssignRoleRequest) (*emptypb.Empty, error) {
	return c.cli.AssignRole(ctx, in)
}

// RevokeRole delegates to the remote testkit-service.
func (c *Client) RevokeRole(ctx context.Context, in *testkitv1.RevokeRoleRequest) (*emptypb.Empty, error) {
	return c.cli.RevokeRole(ctx, in)
}

// ListUserRoles delegates to the remote testkit-service.
func (c *Client) ListUserRoles(ctx context.Context, in *testkitv1.ListUserRolesRequest) (*testkitv1.ListUserRolesResponse, error) {
	return c.cli.ListUserRoles(ctx, in)
}

// ListPermissions delegates to the remote testkit-service.
func (c *Client) ListPermissions(ctx context.Context, in *testkitv1.ListPermissionsRequest) (*testkitv1.ListPermissionsResponse, error) {
	return c.cli.ListPermissions(ctx, in)
}

// CreatePermission delegates to the remote testkit-service.
func (c *Client) CreatePermission(ctx context.Context, in *testkitv1.CreatePermissionRequest) (*testkitv1.Permission, error) {
	return c.cli.CreatePermission(ctx, in)
}

// GetPermission delegates to the remote testkit-service.
func (c *Client) GetPermission(ctx context.Context, in *testkitv1.GetPermissionRequest) (*testkitv1.Permission, error) {
	return c.cli.GetPermission(ctx, in)
}

// UpdatePermission delegates to the remote testkit-service.
func (c *Client) UpdatePermission(ctx context.Context, in *testkitv1.UpdatePermissionRequest) (*testkitv1.Permission, error) {
	return c.cli.UpdatePermission(ctx, in)
}

// DeletePermission delegates to the remote testkit-service.
func (c *Client) DeletePermission(ctx context.Context, in *testkitv1.DeletePermissionRequest) (*emptypb.Empty, error) {
	return c.cli.DeletePermission(ctx, in)
}

// CreatePermissionGroup delegates to the remote testkit-service.
func (c *Client) CreatePermissionGroup(ctx context.Context, in *testkitv1.CreatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return c.cli.CreatePermissionGroup(ctx, in)
}

// GetPermissionGroup delegates to the remote testkit-service.
func (c *Client) GetPermissionGroup(ctx context.Context, in *testkitv1.GetPermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return c.cli.GetPermissionGroup(ctx, in)
}

// UpdatePermissionGroup delegates to the remote testkit-service.
func (c *Client) UpdatePermissionGroup(ctx context.Context, in *testkitv1.UpdatePermissionGroupRequest) (*testkitv1.PermissionGroup, error) {
	return c.cli.UpdatePermissionGroup(ctx, in)
}

// DeletePermissionGroup delegates to the remote testkit-service.
func (c *Client) DeletePermissionGroup(ctx context.Context, in *testkitv1.DeletePermissionGroupRequest) (*emptypb.Empty, error) {
	return c.cli.DeletePermissionGroup(ctx, in)
}

// ListPermissionGroups delegates to the remote testkit-service.
func (c *Client) ListPermissionGroups(ctx context.Context, in *testkitv1.ListPermissionGroupsRequest) (*testkitv1.ListPermissionGroupsResponse, error) {
	return c.cli.ListPermissionGroups(ctx, in)
}

// GenerateUploadURL delegates to the remote testkit-service.
func (c *Client) GenerateUploadURL(ctx context.Context, in *testkitv1.GenerateUploadURLRequest) (*testkitv1.GenerateUploadURLResponse, error) {
	return c.cli.GenerateUploadURL(ctx, in)
}

// GetSTSCredential delegates to the remote testkit-service.
func (c *Client) GetSTSCredential(ctx context.Context, in *testkitv1.GetSTSCredentialRequest) (*testkitv1.GetSTSCredentialResponse, error) {
	return c.cli.GetSTSCredential(ctx, in)
}

// BatchGetSTSCredential delegates to the remote testkit-service.
func (c *Client) BatchGetSTSCredential(ctx context.Context, in *testkitv1.BatchGetSTSCredentialRequest) (*testkitv1.BatchGetSTSCredentialResponse, error) {
	return c.cli.BatchGetSTSCredential(ctx, in)
}

// ConfirmUpload delegates to the remote testkit-service.
func (c *Client) ConfirmUpload(ctx context.Context, in *testkitv1.ConfirmUploadRequest) (*testkitv1.ConfirmUploadResponse, error) {
	return c.cli.ConfirmUpload(ctx, in)
}

// CancelUpload delegates to the remote testkit-service.
func (c *Client) CancelUpload(ctx context.Context, in *testkitv1.CancelUploadRequest) (*emptypb.Empty, error) {
	return c.cli.CancelUpload(ctx, in)
}

// GenerateDownloadURL delegates to the remote testkit-service.
func (c *Client) GenerateDownloadURL(ctx context.Context, in *testkitv1.GenerateDownloadURLRequest) (*testkitv1.GenerateDownloadURLResponse, error) {
	return c.cli.GenerateDownloadURL(ctx, in)
}

// GenerateProcessURL delegates to the remote testkit-service.
func (c *Client) GenerateProcessURL(ctx context.Context, in *testkitv1.GenerateProcessURLRequest) (*testkitv1.GenerateProcessURLResponse, error) {
	return c.cli.GenerateProcessURL(ctx, in)
}

// GenerateCDNURL delegates to the remote testkit-service.
func (c *Client) GenerateCDNURL(ctx context.Context, in *testkitv1.GenerateCDNURLRequest) (*testkitv1.GenerateCDNURLResponse, error) {
	return c.cli.GenerateCDNURL(ctx, in)
}

// ListMyFiles delegates to the remote testkit-service.
func (c *Client) ListMyFiles(ctx context.Context, in *testkitv1.ListMyFilesRequest) (*testkitv1.ListMyFilesResponse, error) {
	return c.cli.ListMyFiles(ctx, in)
}

// ListMyFilesPaged delegates to the remote testkit-service.
func (c *Client) ListMyFilesPaged(ctx context.Context, in *testkitv1.ListMyFilesPagedRequest) (*testkitv1.ListMyFilesPagedResponse, error) {
	return c.cli.ListMyFilesPaged(ctx, in)
}

// GetMyFile delegates to the remote testkit-service.
func (c *Client) GetMyFile(ctx context.Context, in *testkitv1.GetMyFileRequest) (*testkitv1.FileInfo, error) {
	return c.cli.GetMyFile(ctx, in)
}

// UpdateMyFile delegates to the remote testkit-service.
func (c *Client) UpdateMyFile(ctx context.Context, in *testkitv1.UpdateMyFileRequest) (*testkitv1.FileInfo, error) {
	return c.cli.UpdateMyFile(ctx, in)
}

// DeleteMyFile delegates to the remote testkit-service.
func (c *Client) DeleteMyFile(ctx context.Context, in *testkitv1.DeleteMyFileRequest) (*emptypb.Empty, error) {
	return c.cli.DeleteMyFile(ctx, in)
}

// BatchDeleteMyFiles delegates to the remote testkit-service.
func (c *Client) BatchDeleteMyFiles(ctx context.Context, in *testkitv1.BatchDeleteMyFilesRequest) (*testkitv1.BatchDeleteMyFilesResponse, error) {
	return c.cli.BatchDeleteMyFiles(ctx, in)
}

// GetMyQuota delegates to the remote testkit-service.
func (c *Client) GetMyQuota(ctx context.Context, in *emptypb.Empty) (*testkitv1.QuotaInfo, error) {
	return c.cli.GetMyQuota(ctx, in)
}

// ListMyAuditLogs delegates to the remote testkit-service.
func (c *Client) ListMyAuditLogs(ctx context.Context, in *testkitv1.ListMyAuditLogsRequest) (*testkitv1.ListMyAuditLogsResponse, error) {
	return c.cli.ListMyAuditLogs(ctx, in)
}

// AdminListFiles delegates to the remote testkit-service.
func (c *Client) AdminListFiles(ctx context.Context, in *testkitv1.AdminListFilesRequest) (*testkitv1.AdminListFilesResponse, error) {
	return c.cli.AdminListFiles(ctx, in)
}

// AdminGetFile delegates to the remote testkit-service.
func (c *Client) AdminGetFile(ctx context.Context, in *testkitv1.AdminGetFileRequest) (*testkitv1.AdminFileInfo, error) {
	return c.cli.AdminGetFile(ctx, in)
}

// AdminDeleteFile delegates to the remote testkit-service.
func (c *Client) AdminDeleteFile(ctx context.Context, in *testkitv1.AdminDeleteFileRequest) (*emptypb.Empty, error) {
	return c.cli.AdminDeleteFile(ctx, in)
}

// AdminGetQuota delegates to the remote testkit-service.
func (c *Client) AdminGetQuota(ctx context.Context, in *testkitv1.AdminGetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	return c.cli.AdminGetQuota(ctx, in)
}

// AdminSetQuota delegates to the remote testkit-service.
func (c *Client) AdminSetQuota(ctx context.Context, in *testkitv1.AdminSetQuotaRequest) (*testkitv1.QuotaInfo, error) {
	return c.cli.AdminSetQuota(ctx, in)
}

// AdminGetStats delegates to the remote testkit-service.
func (c *Client) AdminGetStats(ctx context.Context, in *testkitv1.AdminGetStatsRequest) (*testkitv1.AdminGetStatsResponse, error) {
	return c.cli.AdminGetStats(ctx, in)
}

// AdminListProviders delegates to the remote testkit-service.
func (c *Client) AdminListProviders(ctx context.Context, in *emptypb.Empty) (*testkitv1.AdminListProvidersResponse, error) {
	return c.cli.AdminListProviders(ctx, in)
}

// AdminListBuckets delegates to the remote testkit-service.
func (c *Client) AdminListBuckets(ctx context.Context, in *emptypb.Empty) (*testkitv1.AdminListBucketsResponse, error) {
	return c.cli.AdminListBuckets(ctx, in)
}

// AdminSoftDeleteOwnerFiles delegates to the remote testkit-service.
func (c *Client) AdminSoftDeleteOwnerFiles(ctx context.Context, in *testkitv1.AdminSoftDeleteOwnerFilesRequest) (*testkitv1.AdminSoftDeleteOwnerFilesResponse, error) {
	return c.cli.AdminSoftDeleteOwnerFiles(ctx, in)
}

// AdminDeleteOwner delegates to the remote testkit-service.
func (c *Client) AdminDeleteOwner(ctx context.Context, in *testkitv1.AdminDeleteOwnerRequest) (*testkitv1.AdminDeleteOwnerResponse, error) {
	return c.cli.AdminDeleteOwner(ctx, in)
}

// AdminListAuditLogs delegates to the remote testkit-service.
func (c *Client) AdminListAuditLogs(ctx context.Context, in *testkitv1.AdminListAuditLogsRequest) (*testkitv1.AdminListAuditLogsResponse, error) {
	return c.cli.AdminListAuditLogs(ctx, in)
}

// SendEmail delegates to the remote testkit-service.
func (c *Client) SendEmail(ctx context.Context, in *testkitv1.SendEmailRequest) (*testkitv1.SendResponse, error) {
	return c.cli.SendEmail(ctx, in)
}

// SendSMS delegates to the remote testkit-service.
func (c *Client) SendSMS(ctx context.Context, in *testkitv1.SendSMSRequest) (*testkitv1.SendResponse, error) {
	return c.cli.SendSMS(ctx, in)
}

// GetEmail delegates to the remote testkit-service.
func (c *Client) GetEmail(ctx context.Context, in *testkitv1.GetEmailRequest) (*testkitv1.EmailRecord, error) {
	return c.cli.GetEmail(ctx, in)
}

// ListEmails delegates to the remote testkit-service.
func (c *Client) ListEmails(ctx context.Context, in *testkitv1.ListEmailsRequest) (*testkitv1.ListEmailsResponse, error) {
	return c.cli.ListEmails(ctx, in)
}

// ListEmailsByCursor delegates to the remote testkit-service.
func (c *Client) ListEmailsByCursor(ctx context.Context, in *testkitv1.ListEmailsByCursorRequest) (*testkitv1.ListEmailsByCursorResponse, error) {
	return c.cli.ListEmailsByCursor(ctx, in)
}

// GetEmailStats delegates to the remote testkit-service.
func (c *Client) GetEmailStats(ctx context.Context, in *testkitv1.GetEmailStatsRequest) (*testkitv1.EmailStatsResponse, error) {
	return c.cli.GetEmailStats(ctx, in)
}


// GetSMS delegates to the remote testkit-service.
func (c *Client) GetSMS(ctx context.Context, in *testkitv1.GetSMSRequest) (*testkitv1.SMSRecord, error) {
	return c.cli.GetSMS(ctx, in)
}

// ListSMS delegates to the remote testkit-service.
func (c *Client) ListSMS(ctx context.Context, in *testkitv1.ListSMSRequest) (*testkitv1.ListSMSResponse, error) {
	return c.cli.ListSMS(ctx, in)
}

// ListSMSByCursor delegates to the remote testkit-service.
func (c *Client) ListSMSByCursor(ctx context.Context, in *testkitv1.ListSMSByCursorRequest) (*testkitv1.ListSMSByCursorResponse, error) {
	return c.cli.ListSMSByCursor(ctx, in)
}

// GetSMSStats delegates to the remote testkit-service.
func (c *Client) GetSMSStats(ctx context.Context, in *testkitv1.GetSMSStatsRequest) (*testkitv1.SMSStatsResponse, error) {
	return c.cli.GetSMSStats(ctx, in)
}

// ListSMSRegions delegates to the remote testkit-service.
func (c *Client) ListSMSRegions(ctx context.Context, in *testkitv1.ListSMSRegionsRequest) (*testkitv1.ListSMSRegionsResponse, error) {
	return c.cli.ListSMSRegions(ctx, in)
}


// NextID delegates to the remote testkit-service.
func (c *Client) NextID(ctx context.Context, in *testkitv1.NextIDRequest) (*testkitv1.NextIDResponse, error) {
	return c.cli.NextID(ctx, in)
}

// BatchNextID delegates to the remote testkit-service.
func (c *Client) BatchNextID(ctx context.Context, in *testkitv1.BatchNextIDRequest) (*testkitv1.BatchNextIDResponse, error) {
	return c.cli.BatchNextID(ctx, in)
}

// Decompose delegates to the remote testkit-service.
func (c *Client) Decompose(ctx context.Context, in *testkitv1.DecomposeRequest) (*testkitv1.DecomposeResponse, error) {
	return c.cli.Decompose(ctx, in)
}

// GetDashboard delegates to the remote testkit-service.
func (c *Client) GetDashboard(ctx context.Context, in *testkitv1.GetDashboardRequest) (*testkitv1.DashboardResponse, error) {
	return c.cli.GetDashboard(ctx, in)
}

// ListCountries delegates to the remote testkit-service.
func (c *Client) ListCountries(ctx context.Context, in *referencev1.ListCountriesRequest) (*referencev1.ListCountriesResponse, error) {
	return c.cli.ListCountries(ctx, in)
}

// ListTimezones delegates to the remote testkit-service.
func (c *Client) ListTimezones(ctx context.Context, in *referencev1.ListTimezonesRequest) (*referencev1.ListTimezonesResponse, error) {
	return c.cli.ListTimezones(ctx, in)
}

// ListLanguages delegates to the remote testkit-service.
func (c *Client) ListLanguages(ctx context.Context, in *referencev1.ListLanguagesRequest) (*referencev1.ListLanguagesResponse, error) {
	return c.cli.ListLanguages(ctx, in)
}

// ListCurrencies delegates to the remote testkit-service.
func (c *Client) ListCurrencies(ctx context.Context, in *referencev1.ListCurrenciesRequest) (*referencev1.ListCurrenciesResponse, error) {
	return c.cli.ListCurrencies(ctx, in)
}

// ListRegionGroups delegates to the remote testkit-service.
func (c *Client) ListRegionGroups(ctx context.Context, in *referencev1.ListRegionGroupsRequest) (*referencev1.ListRegionGroupsResponse, error) {
	return c.cli.ListRegionGroups(ctx, in)
}

// ParsePhone delegates to the remote testkit-service.
func (c *Client) ParsePhone(ctx context.Context, in *referencev1.ParsePhoneRequest) (*referencev1.ParsePhoneResponse, error) {
	return c.cli.ParsePhone(ctx, in)
}

// ResolveCodes delegates to the remote testkit-service.
func (c *Client) ResolveCodes(ctx context.Context, in *referencev1.ResolveCodesRequest) (*referencev1.ResolveCodesResponse, error) {
	return c.cli.ResolveCodes(ctx, in)
}

// GetCountryProfile delegates to the remote testkit-service.
func (c *Client) GetCountryProfile(ctx context.Context, in *referencev1.GetCountryProfileRequest) (*referencev1.GetCountryProfileResponse, error) {
	return c.cli.GetCountryProfile(ctx, in)
}

// ListCountriesByRegion delegates to the remote testkit-service.
func (c *Client) ListCountriesByRegion(ctx context.Context, in *referencev1.ListCountriesByRegionRequest) (*referencev1.ListCountriesByRegionResponse, error) {
	return c.cli.ListCountriesByRegion(ctx, in)
}

// GetCountryDefaults delegates to the remote testkit-service.
func (c *Client) GetCountryDefaults(ctx context.Context, in *referencev1.GetCountryDefaultsRequest) (*referencev1.GetCountryDefaultsResponse, error) {
	return c.cli.GetCountryDefaults(ctx, in)
}

// GetDataInfo delegates to the remote testkit-service.
func (c *Client) GetDataInfo(ctx context.Context, in *referencev1.GetDataInfoRequest) (*referencev1.GetDataInfoResponse, error) {
	return c.cli.GetDataInfo(ctx, in)
}
