package user_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	testkitv1 "github.com/servekit/testkit-service/gen/testkit/v1"
	"github.com/servekit/testkit-service/internal/service/user"
	userv1 "github.com/servekit/user-service/gen/user/v1"
)

// --- admin / RBAC stub overrides ---
//
// Each override records the downstream request (so tests assert the mapping
// forwarded correctly) and returns a canned response. Uncovered RPCs fall
// through to userv1.UnimplementedUserServiceServer (return Unimplemented).

func (s *stubUserClient) GetUser(_ context.Context, req *userv1.GetUserRequest) (*userv1.User, error) {
	s.gotGetUser = req
	if s.adminUser != nil {
		return s.adminUser, nil
	}
	return fullUser(req.GetUserId()), nil
}

func (s *stubUserClient) DisableUser(_ context.Context, req *userv1.DisableUserRequest) (*userv1.User, error) {
	s.gotDisableUser = req
	st := userv1.UserStatus_USER_STATUS_ACTIVE
	if req.GetDisable() {
		st = userv1.UserStatus_USER_STATUS_DISABLED
	}
	return &userv1.User{Id: req.GetUserId(), Status: st}, nil
}

func (s *stubUserClient) CreateUser(_ context.Context, req *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error) {
	s.gotCreateUser = req
	u := fullUser(1)
	u.Status = userv1.UserStatus_USER_STATUS_PENDING_REVIEW // admin-created accounts start pending
	u.UserType = req.GetUserType()
	return &userv1.CreateUserResponse{User: u}, nil
}

func (s *stubUserClient) ListUsers(_ context.Context, req *userv1.ListUsersRequest) (*userv1.ListUsersResponse, error) {
	s.gotListUsers = req
	return &userv1.ListUsersResponse{Users: s.pagedUsers}, nil
}

func (s *stubUserClient) ListUsersPaged(_ context.Context, req *userv1.ListUsersPagedRequest) (*userv1.ListUsersPagedResponse, error) {
	s.gotListUsersPaged = req
	return &userv1.ListUsersPagedResponse{Users: s.pagedUsers, Total: s.pagedTotal, TotalPages: s.pagedTotalPages}, nil
}

func (s *stubUserClient) GetLoginLogs(_ context.Context, req *userv1.GetLoginLogsRequest) (*userv1.GetLoginLogsResponse, error) {
	s.gotGetLoginLogs = req
	return &userv1.GetLoginLogsResponse{Logs: s.loginLogs, Total: int32(len(s.loginLogs))}, nil
}

func (s *stubUserClient) CreateRole(_ context.Context, req *userv1.CreateRoleRequest) (*userv1.Role, error) {
	s.gotCreateRole = req
	if s.createdRole != nil {
		return s.createdRole, nil
	}
	return &userv1.Role{Id: 1, Name: req.GetName()}, nil
}

func (s *stubUserClient) ListRoles(_ context.Context, req *userv1.ListRolesRequest) (*userv1.ListRolesResponse, error) {
	s.gotListRoles = req
	return &userv1.ListRolesResponse{Roles: s.listedRoles, NextCursor: s.rolesCursor, Total: s.rolesTotal}, nil
}

func (s *stubUserClient) CreateGroup(_ context.Context, req *userv1.CreateGroupRequest) (*userv1.Group, error) {
	s.gotCreateGroup = req
	return &userv1.Group{Id: 7, Name: req.GetName(), Description: req.GetDescription(), ParentId: req.GetParentId(), MemberCount: 3}, nil
}

func (s *stubUserClient) ListGroupMembers(_ context.Context, req *userv1.ListGroupMembersRequest) (*userv1.ListGroupMembersResponse, error) {
	s.gotListGroupMembers = req
	return &userv1.ListGroupMembersResponse{}, nil
}

func (s *stubUserClient) AssignRole(_ context.Context, req *userv1.AssignRoleRequest) (*emptypb.Empty, error) {
	s.gotAssignRole = req
	return &emptypb.Empty{}, nil
}

// --- Pattern: admin target-ID forward (GetUser / DisableUser) ---
//
// Admin RPCs forward target user_id from the request and read NOTHING from ctx.

func TestGetUser_ForwardsTargetUserID_NoCtxInjection(t *testing.T) {
	stub := &stubUserClient{}
	svc, _ := newSvc(t, stub, false)

	// Background ctx (no user_id) is fine — admin RPCs don't read caller identity.
	resp, err := svc.GetUser(context.Background(), &testkitv1.GetUserRequest{UserId: 5})
	require.NoError(t, err)
	require.Equal(t, int64(5), resp.GetId())                // mapped back through toTestkitUser
	require.Equal(t, int64(5), stub.gotGetUser.GetUserId()) // forwarded to downstream
	require.Equal(t, testkitv1.UserStatus_USER_STATUS_ACTIVE, resp.GetStatus())
}

func TestDisableUser_ForwardsTargetIDAndDisableFlag(t *testing.T) {
	stub := &stubUserClient{}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.DisableUser(context.Background(), &testkitv1.DisableUserRequest{
		UserId: 9, Disable: true, Reason: "spam",
	})
	require.NoError(t, err)

	// Target id + disable flag + reason forwarded; status mapped back.
	require.Equal(t, int64(9), stub.gotDisableUser.GetUserId())
	require.True(t, stub.gotDisableUser.GetDisable())
	require.Equal(t, "spam", stub.gotDisableUser.GetReason())
	require.Equal(t, int64(9), resp.GetId())
	require.Equal(t, testkitv1.UserStatus_USER_STATUS_DISABLED, resp.GetStatus())
}

// --- Pattern: admin create forwards all fields + enum int-cast ---

func TestCreateUser_ForwardsAllFields_AndEnumIntCast(t *testing.T) {
	stub := &stubUserClient{}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.CreateUser(context.Background(), &testkitv1.CreateUserRequest{
		UserType:   testkitv1.UserType_USER_TYPE_INTERNAL,
		Username:   "bob",
		Nickname:   "Bob",
		RealName:   "Bob Q",
		Email:      "bob@example.com",
		RegionCode: "US",
		Phone:      "+1555000",
		Password:   "secret123",
		Gender:     testkitv1.Gender_GENDER_MALE,
		Timezone:   "UTC",
		Locale:     "en",
	})
	require.NoError(t, err)

	// Every scalar forwarded 1:1.
	got := stub.gotCreateUser
	require.Equal(t, "bob", got.GetUsername())
	require.Equal(t, "Bob", got.GetNickname())
	require.Equal(t, "Bob Q", got.GetRealName())
	require.Equal(t, "bob@example.com", got.GetEmail())
	require.Equal(t, "US", got.GetRegionCode())
	require.Equal(t, "+1555000", got.GetPhone())
	require.Equal(t, "secret123", got.GetPassword())
	require.Equal(t, "UTC", got.GetTimezone())
	require.Equal(t, "en", got.GetLocale())
	// Enums int-cast (mirrored same-number).
	require.Equal(t, userv1.UserType_USER_TYPE_INTERNAL, got.GetUserType())
	require.Equal(t, userv1.Gender_GENDER_MALE, got.GetGender())

	// Response wraps the curated user.
	require.NotNil(t, resp.GetUser())
	require.Equal(t, testkitv1.UserType_USER_TYPE_INTERNAL, resp.GetUser().GetUserType())
}

// --- Pattern: paginated list mapping (ListUsersPaged) ---

func TestListUsersPaged_MapsPaginationAndUsers(t *testing.T) {
	stub := &stubUserClient{
		pagedUsers:      []*userv1.User{fullUser(1), fullUser(2)},
		pagedTotal:      42,
		pagedTotalPages: 3,
	}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.ListUsersPaged(context.Background(), &testkitv1.ListUsersPagedRequest{
		Page: 2, PageSize: 20, Count: true,
	})
	require.NoError(t, err)

	require.Len(t, resp.GetUsers(), 2)
	require.Equal(t, int64(42), resp.GetTotal())
	require.Equal(t, int32(3), resp.GetTotalPages())
	require.Equal(t, int64(1), resp.GetUsers()[0].GetId()) // each user curated via toTestkitUser
	// Pagination params forwarded.
	require.Equal(t, int32(2), stub.gotListUsersPaged.GetPage())
	require.Equal(t, int32(20), stub.gotListUsersPaged.GetPageSize())
	require.True(t, stub.gotListUsersPaged.GetCount())
}

// --- Converter spot-check: ToUserListUsersPagedRequest covers every field ---
//
// Drives the one exported converter directly: a fully-populated testkit request
// must map field-by-field (enum int-cast, repeated + timestamp filters carried).
// Guards against field drift as user-service evolves.

func TestToUserListUsersPagedRequest_CoversAllFields(t *testing.T) {
	start := timestamppb.Now()
	end := timestamppb.Now()
	llStart := timestamppb.Now()
	llEnd := timestamppb.Now()

	got := user.ToUserListUsersPagedRequest(&testkitv1.ListUsersPagedRequest{
		Status:           testkitv1.UserStatus_USER_STATUS_DISABLED,
		Nickname:         "n",
		Gender:           testkitv1.Gender_GENDER_MALE,
		RegisterSource:   testkitv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB,
		RegisterDevice:   testkitv1.DeviceType_DEVICE_TYPE_WEB,
		UserType:         testkitv1.UserType_USER_TYPE_INTERNAL,
		Locale:           "zh",
		Timezone:         "UTC",
		RegisterIp:       "1.1.1.1",
		LastLoginIp:      "2.2.2.2",
		CreatedAtStart:   start,
		CreatedAtEnd:     end,
		LastLoginAtStart: llStart,
		LastLoginAtEnd:   llEnd,
		UserIds:          []int64{9, 10},
		Email:            "a@b.c",
		RegionCode:       "CN",
		Phone:            "13800000000",
		Username:         "u",
		OrderBy:          testkitv1.UserSortField_USER_SORT_FIELD_ID,
		Descending:       true,
		Page:             2,
		PageSize:         50,
		Count:            false,
	})

	// Scalars.
	require.Equal(t, "n", got.GetNickname())
	require.Equal(t, "zh", got.GetLocale())
	require.Equal(t, "UTC", got.GetTimezone())
	require.Equal(t, "1.1.1.1", got.GetRegisterIp())
	require.Equal(t, "2.2.2.2", got.GetLastLoginIp())
	require.Equal(t, "a@b.c", got.GetEmail())
	require.Equal(t, "CN", got.GetRegionCode())
	require.Equal(t, "13800000000", got.GetPhone())
	require.Equal(t, "u", got.GetUsername())
	// Enums int-cast.
	require.Equal(t, userv1.UserStatus_USER_STATUS_DISABLED, got.GetStatus())
	require.Equal(t, userv1.Gender_GENDER_MALE, got.GetGender())
	require.Equal(t, userv1.IdentityProvider_IDENTITY_PROVIDER_GITHUB, got.GetRegisterSource())
	require.Equal(t, userv1.DeviceType_DEVICE_TYPE_WEB, got.GetRegisterDevice())
	require.Equal(t, userv1.UserType_USER_TYPE_INTERNAL, got.GetUserType())
	require.Equal(t, userv1.UserSortField_USER_SORT_FIELD_ID, got.GetOrderBy())
	// Repeated + timestamps + pagination carried by reference.
	require.Equal(t, []int64{9, 10}, got.GetUserIds())
	require.Same(t, start, got.GetCreatedAtStart())
	require.Same(t, end, got.GetCreatedAtEnd())
	require.Same(t, llStart, got.GetLastLoginAtStart())
	require.Same(t, llEnd, got.GetLastLoginAtEnd())
	require.Equal(t, int32(2), got.GetPage())
	require.Equal(t, int32(50), got.GetPageSize())
	require.False(t, got.GetCount())
	require.True(t, got.GetDescending())
}

// --- Pattern: RBAC create + cursor list (CreateRole / ListRoles) ---

func TestCreateRole_ForwardsPermissionIDs_AndMapsNestedPerms(t *testing.T) {
	stub := &stubUserClient{createdRole: &userv1.Role{
		Id: 1, Name: "editor", Description: "d", IsBuiltin: false,
		Permissions: []*userv1.Permission{{Id: 10, Resource: "doc", Action: "edit", IsBuiltin: false}},
		PermGroups:  []*userv1.PermissionGroup{{Id: 20, Name: "g", Permissions: []*userv1.Permission{{Id: 100}}}},
	}}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.CreateRole(context.Background(), &testkitv1.CreateRoleRequest{
		Name:               "editor",
		Description:        "d",
		PermissionIds:      []int64{10, 11},
		PermissionGroupIds: []int64{20},
	})
	require.NoError(t, err)

	// Request forwarded (permission + group IDs carried).
	require.Equal(t, "editor", stub.gotCreateRole.GetName())
	require.Equal(t, []int64{10, 11}, stub.gotCreateRole.GetPermissionIds())
	require.Equal(t, []int64{20}, stub.gotCreateRole.GetPermissionGroupIds())

	// Response: role mapped, nested permissions + permission groups recursed.
	require.Equal(t, "editor", resp.GetName())
	require.False(t, resp.GetIsBuiltin())
	require.Len(t, resp.GetPermissions(), 1)
	require.Equal(t, int64(10), resp.GetPermissions()[0].GetId())
	require.Equal(t, "doc", resp.GetPermissions()[0].GetResource())
	require.Len(t, resp.GetPermGroups(), 1)
	require.Equal(t, int64(20), resp.GetPermGroups()[0].GetId())
	require.Len(t, resp.GetPermGroups()[0].GetPermissions(), 1) // group recurses into its perms
	require.Equal(t, int64(100), resp.GetPermGroups()[0].GetPermissions()[0].GetId())
}

func TestListRoles_MapsCursorResponse(t *testing.T) {
	stub := &stubUserClient{
		listedRoles: []*userv1.Role{{Id: 1, Name: "admin", IsBuiltin: true}},
		rolesCursor: "cur-1",
		rolesTotal:  1,
	}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.ListRoles(context.Background(), &testkitv1.ListRolesRequest{PageSize: 10})
	require.NoError(t, err)

	require.Len(t, resp.GetRoles(), 1)
	require.Equal(t, "cur-1", resp.GetNextCursor())
	require.Equal(t, int32(1), resp.GetTotal())
	require.True(t, resp.GetRoles()[0].GetIsBuiltin()) // mapped through toTestkitRole
	// page_size forwarded.
	require.Equal(t, int32(10), stub.gotListRoles.GetPageSize())
}

// --- Spot-check: GetLoginLogs maps logs + int-casts LoginAction/DeviceType ---

func TestGetLoginLogs_MapsLogs_AndEnumIntCast(t *testing.T) {
	stub := &stubUserClient{loginLogs: []*userv1.LoginLog{{
		Id: 1, UserId: 5, Provider: userv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL,
		Action: userv1.LoginAction_LOGIN_ACTION_LOGIN, Success: true, Ip: "1.2.3.4",
		DeviceType: userv1.DeviceType_DEVICE_TYPE_WEB, Os: "macOS", Browser: "Chrome",
		Country: "CN", City: "Shanghai", CreatedAt: timestamppb.Now(),
	}}}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.GetLoginLogs(context.Background(), &testkitv1.GetLoginLogsRequest{
		UserId: 5, PageSize: 20,
	})
	require.NoError(t, err)

	require.Len(t, resp.GetLogs(), 1)
	l := resp.GetLogs()[0]
	require.Equal(t, int64(1), l.GetId())
	require.Equal(t, int64(5), l.GetUserId())
	require.Equal(t, testkitv1.IdentityProvider_IDENTITY_PROVIDER_EMAIL, l.GetProvider())
	require.Equal(t, testkitv1.LoginAction_LOGIN_ACTION_LOGIN, l.GetAction()) // enum int-cast
	require.Equal(t, testkitv1.DeviceType_DEVICE_TYPE_WEB, l.GetDeviceType())
	require.Equal(t, "macOS", l.GetOs())
	require.Equal(t, int32(1), resp.GetTotal())
	// user_id filter forwarded (target ID, optional).
	require.Equal(t, int64(5), stub.gotGetLoginLogs.GetUserId())
}

// --- Spot-check: group + member + assignment forwards ---

func TestCreateGroup_ForwardsFields_AndMapsGroup(t *testing.T) {
	stub := &stubUserClient{}
	svc, _ := newSvc(t, stub, false)

	resp, err := svc.CreateGroup(context.Background(), &testkitv1.CreateGroupRequest{
		Name: "eng", Description: "engineering", ParentId: 2,
	})
	require.NoError(t, err)

	require.Equal(t, "eng", stub.gotCreateGroup.GetName())
	require.Equal(t, "engineering", stub.gotCreateGroup.GetDescription())
	require.Equal(t, int64(2), stub.gotCreateGroup.GetParentId())

	// Group mapped through toTestkitGroup.
	require.Equal(t, int64(7), resp.GetId())
	require.Equal(t, "eng", resp.GetName())
	require.Equal(t, int64(2), resp.GetParentId())
	require.Equal(t, int32(3), resp.GetMemberCount())
}

func TestAssignRole_ForwardsTargetUserAndRole(t *testing.T) {
	stub := &stubUserClient{}
	svc, _ := newSvc(t, stub, false)

	_, err := svc.AssignRole(context.Background(), &testkitv1.AssignRoleRequest{UserId: 4, RoleId: 8})
	require.NoError(t, err)

	// Both IDs are target resource IDs, forwarded as-is.
	require.Equal(t, int64(4), stub.gotAssignRole.GetUserId())
	require.Equal(t, int64(8), stub.gotAssignRole.GetRoleId())
}

// --- Spot-check: same-number enum int-cast for the P2 enums the admin/RBAC
// converters rely on (LoginAction + UserSortField pin the log/list mappings). ---

func TestEnumIntCast_AdminRBACEnums(t *testing.T) {
	tests := []struct {
		name    string
		testkit int32
		want    int32
	}{
		{"LoginAction LOGIN", int32(testkitv1.LoginAction_LOGIN_ACTION_LOGIN), int32(userv1.LoginAction_LOGIN_ACTION_LOGIN)},
		{"UserSortField ID", int32(testkitv1.UserSortField_USER_SORT_FIELD_ID), int32(userv1.UserSortField_USER_SORT_FIELD_ID)},
		{"UserSortField CREATED_AT", int32(testkitv1.UserSortField_USER_SORT_FIELD_CREATED_AT), int32(userv1.UserSortField_USER_SORT_FIELD_CREATED_AT)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, tt.testkit)
		})
	}
}
