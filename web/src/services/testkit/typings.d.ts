declare namespace API {
  type AddGroupMemberParams = {
    /** path */
    groupId: string;
  };

  type AddGroupRoleParams = {
    /** path */
    groupId: string;
  };

  type AssignRoleParams = {
    /** target user (path) */
    userId: string;
  };

  type DeleteGroupParams = {
    groupId: string;
  };

  type DeletePermissionGroupParams = {
    permissionGroupId: string;
  };

  type DeletePermissionParams = {
    permissionId: string;
  };

  type DeleteRoleParams = {
    roleId: string;
  };

  type DisableUserParams = {
    /** target user (kept) */
    userId: string;
  };

  type GetGroupParams = {
    groupId: string;
  };

  type GetLoginLogsParams = {
    /** optional filter (0 = all); kept */
    userId?: string;
    /**  - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
    provider?:
      | "IDENTITY_PROVIDER_UNSPECIFIED"
      | "IDENTITY_PROVIDER_EMAIL"
      | "IDENTITY_PROVIDER_PHONE"
      | "IDENTITY_PROVIDER_GITHUB"
      | "IDENTITY_PROVIDER_GOOGLE"
      | "IDENTITY_PROVIDER_WECHAT"
      | "IDENTITY_PROVIDER_APPLE"
      | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
      | "IDENTITY_PROVIDER_ADMIN";
    success?: boolean;
    pageSize?: number;
    cursor?: string;
  };

  type GetOAuthURLParams = {
    provider:
      | "IDENTITY_PROVIDER_UNSPECIFIED"
      | "IDENTITY_PROVIDER_EMAIL"
      | "IDENTITY_PROVIDER_PHONE"
      | "IDENTITY_PROVIDER_GITHUB"
      | "IDENTITY_PROVIDER_GOOGLE"
      | "IDENTITY_PROVIDER_WECHAT"
      | "IDENTITY_PROVIDER_APPLE"
      | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
      | "IDENTITY_PROVIDER_ADMIN";
    returnTo?: string;
    state?: string;
  };

  type GetPermissionGroupParams = {
    permissionGroupId: string;
  };

  type GetPermissionParams = {
    permissionId: string;
  };

  type GetRoleParams = {
    roleId: string;
  };

  type GetSessionParams = {
    sessionId: string;
  };

  type GetUserParams = {
    /** target user (kept) */
    userId: string;
  };

  type ListGroupMembersParams = {
    /** path */
    groupId: string;
    role?: string;
    pageSize?: number;
    cursor?: string;
  };

  type ListGroupRolesParams = {
    groupId: string;
  };

  type ListGroupsParams = {
    status?: string;
    pageSize?: number;
    cursor?: string;
  };

  type ListPermissionGroupsParams = {
    pageSize?: number;
    cursor?: string;
  };

  type ListPermissionsParams = {
    pageSize?: number;
    cursor?: string;
  };

  type ListRolesParams = {
    pageSize?: number;
    cursor?: string;
  };

  type ListUserRolesParams = {
    userId: string;
  };

  type ListUsersPagedParams = {
    status?:
      | "USER_STATUS_UNSPECIFIED"
      | "USER_STATUS_ACTIVE"
      | "USER_STATUS_DISABLED"
      | "USER_STATUS_PENDING_REVIEW";
    nickname?: string;
    gender?:
      | "GENDER_UNSPECIFIED"
      | "GENDER_MALE"
      | "GENDER_FEMALE"
      | "GENDER_OTHER"
      | "GENDER_UNKNOWN";
    /**  - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
    registerSource?:
      | "IDENTITY_PROVIDER_UNSPECIFIED"
      | "IDENTITY_PROVIDER_EMAIL"
      | "IDENTITY_PROVIDER_PHONE"
      | "IDENTITY_PROVIDER_GITHUB"
      | "IDENTITY_PROVIDER_GOOGLE"
      | "IDENTITY_PROVIDER_WECHAT"
      | "IDENTITY_PROVIDER_APPLE"
      | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
      | "IDENTITY_PROVIDER_ADMIN";
    registerDevice?:
      | "DEVICE_TYPE_UNSPECIFIED"
      | "DEVICE_TYPE_WEB"
      | "DEVICE_TYPE_IOS"
      | "DEVICE_TYPE_ANDROID"
      | "DEVICE_TYPE_API";
    /**  - USER_TYPE_NORMAL: External end user (default).
 - USER_TYPE_INTERNAL: Platform internal user (staff, operations, etc.). */
    userType?:
      | "USER_TYPE_UNSPECIFIED"
      | "USER_TYPE_NORMAL"
      | "USER_TYPE_INTERNAL";
    locale?: string;
    timezone?: string;
    registerIp?: string;
    lastLoginIp?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
    lastLoginAtStart?: string;
    lastLoginAtEnd?: string;
    userIds?: string[];
    email?: string;
    regionCode?: string;
    phone?: string;
    username?: string;
    orderBy?:
      | "USER_SORT_FIELD_UNSPECIFIED"
      | "USER_SORT_FIELD_ID"
      | "USER_SORT_FIELD_CREATED_AT"
      | "USER_SORT_FIELD_UPDATED_AT"
      | "USER_SORT_FIELD_LAST_LOGIN_AT";
    descending?: boolean;
    page?: number;
    pageSize?: number;
    count?: boolean;
  };

  type ListUsersParams = {
    status?:
      | "USER_STATUS_UNSPECIFIED"
      | "USER_STATUS_ACTIVE"
      | "USER_STATUS_DISABLED"
      | "USER_STATUS_PENDING_REVIEW";
    nickname?: string;
    pageSize?: number;
    cursor?: string;
    gender?:
      | "GENDER_UNSPECIFIED"
      | "GENDER_MALE"
      | "GENDER_FEMALE"
      | "GENDER_OTHER"
      | "GENDER_UNKNOWN";
    /**  - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
    registerSource?:
      | "IDENTITY_PROVIDER_UNSPECIFIED"
      | "IDENTITY_PROVIDER_EMAIL"
      | "IDENTITY_PROVIDER_PHONE"
      | "IDENTITY_PROVIDER_GITHUB"
      | "IDENTITY_PROVIDER_GOOGLE"
      | "IDENTITY_PROVIDER_WECHAT"
      | "IDENTITY_PROVIDER_APPLE"
      | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
      | "IDENTITY_PROVIDER_ADMIN";
    registerDevice?:
      | "DEVICE_TYPE_UNSPECIFIED"
      | "DEVICE_TYPE_WEB"
      | "DEVICE_TYPE_IOS"
      | "DEVICE_TYPE_ANDROID"
      | "DEVICE_TYPE_API";
    locale?: string;
    timezone?: string;
    registerIp?: string;
    lastLoginIp?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
    lastLoginAtStart?: string;
    lastLoginAtEnd?: string;
    userIds?: string[];
    email?: string;
    regionCode?: string;
    phone?: string;
    username?: string;
    /**  - USER_TYPE_NORMAL: External end user (default).
 - USER_TYPE_INTERNAL: Platform internal user (staff, operations, etc.). */
    userType?:
      | "USER_TYPE_UNSPECIFIED"
      | "USER_TYPE_NORMAL"
      | "USER_TYPE_INTERNAL";
    orderBy?:
      | "USER_SORT_FIELD_UNSPECIFIED"
      | "USER_SORT_FIELD_ID"
      | "USER_SORT_FIELD_CREATED_AT"
      | "USER_SORT_FIELD_UPDATED_AT"
      | "USER_SORT_FIELD_LAST_LOGIN_AT";
    descending?: boolean;
  };

  type protobufAny = {
    "@type"?: string;
  };

  type RemoveGroupMemberParams = {
    groupId: string;
    userId: string;
  };

  type RemoveGroupRoleParams = {
    groupId: string;
    roleId: string;
  };

  type RevokeRoleParams = {
    userId: string;
    roleId: string;
  };

  type RevokeSessionParams = {
    sessionId: string;
  };

  type rpcStatus = {
    code?: number;
    message?: string;
    details?: protobufAny[];
  };

  type TestkitServiceAddGroupMemberBody = {
    /** target member (kept) */
    userId?: string;
    role?: string;
  };

  type TestkitServiceAddGroupRoleBody = {
    roleId?: string;
  };

  type TestkitServiceAssignRoleBody = {
    roleId?: string;
  };

  type TestkitServiceDisableUserBody = {
    disable?: boolean;
    reason?: string;
  };

  type TestkitServiceUpdateGroupBody = {
    name?: string;
    description?: string;
  };

  type TestkitServiceUpdatePermissionBody = {
    resource?: string;
    action?: string;
    description?: string;
  };

  type TestkitServiceUpdatePermissionGroupBody = {
    name?: string;
    description?: string;
    permissionIds?: string[];
  };

  type TestkitServiceUpdateRoleBody = {
    name?: string;
    description?: string;
    permissionIds?: string[];
    permissionGroupIds?: string[];
  };

  type UnbindIdentityParams = {
    /** target identity */
    identityId: string;
    /** user_id injected from ctx */
    code?: string;
  };

  type UpdateGroupParams = {
    groupId: string;
  };

  type UpdatePermissionGroupParams = {
    permissionGroupId: string;
  };

  type UpdatePermissionParams = {
    permissionId: string;
  };

  type UpdateRoleParams = {
    roleId: string;
  };

  type v1BindIdentityRequest = {
    provider?: v1IdentityProvider;
    email?: string;
    code?: string;
    password?: string;
    regionCode?: string;
    phone?: string;
  };

  type v1BindOAuthIdentityRequest = {
    provider?: v1IdentityProvider;
    code?: string;
    state?: string;
  };

  type v1BindOAuthIdentityResponse = {
    identity?: v1Identity;
  };

  type v1ChangePasswordRequest = {
    oldPassword?: string;
    newPassword?: string;
  };

  type v1CreateGroupRequest = {
    name?: string;
    description?: string;
    parentId?: string;
  };

  type v1CreatePermissionGroupRequest = {
    name?: string;
    description?: string;
    permissionIds?: string[];
  };

  type v1CreatePermissionRequest = {
    resource?: string;
    action?: string;
    description?: string;
  };

  type v1CreateRoleRequest = {
    name?: string;
    description?: string;
    permissionIds?: string[];
    permissionGroupIds?: string[];
  };

  type v1CreateUserRequest = {
    userType?: v1UserType;
    username?: string;
    nickname?: string;
    realName?: string;
    email?: string;
    regionCode?: string;
    phone?: string;
    password?: string;
    gender?: v1Gender;
    timezone?: string;
    locale?: string;
  };

  type v1CreateUserResponse = {
    user?: v1User;
  };

  type v1DeviceType =
    | "DEVICE_TYPE_UNSPECIFIED"
    | "DEVICE_TYPE_WEB"
    | "DEVICE_TYPE_IOS"
    | "DEVICE_TYPE_ANDROID"
    | "DEVICE_TYPE_API";

  type v1ExchangeSessionCodeRequest = {
    code?: string;
  };

  type v1ExchangeSessionCodeResponse = {
    sessionId?: string;
    userId?: string;
  };

  type v1Gender =
    | "GENDER_UNSPECIFIED"
    | "GENDER_MALE"
    | "GENDER_FEMALE"
    | "GENDER_OTHER"
    | "GENDER_UNKNOWN";

  type v1GetLoginLogsResponse = {
    logs?: v1LoginLog[];
    nextCursor?: string;
    total?: number;
  };

  type v1GetOAuthURLResponse = {
    url?: string;
    state?: string;
  };

  type v1GetSessionResponse = {
    userId?: string;
    expiresAt?: string;
    createdAt?: string;
    ip?: string;
    userAgent?: string;
    os?: string;
    browser?: string;
    loginMethod?: string;
  };

  type v1Group = {
    id?: string;
    name?: string;
    description?: string;
    parentId?: string;
    status?: string;
    memberCount?: number;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1GroupMember = {
    userId?: string;
    nickname?: string;
    avatarUrl?: string;
    role?: string;
    createdAt?: string;
  };

  type v1Identity = {
    id?: string;
    provider?: v1IdentityProvider;
    providerUid?: string;
    verified?: boolean;
    createdAt?: string;
  };

  type v1IdentityProvider =
    | "IDENTITY_PROVIDER_UNSPECIFIED"
    | "IDENTITY_PROVIDER_EMAIL"
    | "IDENTITY_PROVIDER_PHONE"
    | "IDENTITY_PROVIDER_GITHUB"
    | "IDENTITY_PROVIDER_GOOGLE"
    | "IDENTITY_PROVIDER_WECHAT"
    | "IDENTITY_PROVIDER_APPLE"
    | "IDENTITY_PROVIDER_WECHAT_MINIPROGRAM"
    | "IDENTITY_PROVIDER_ADMIN";

  type v1IssueSessionCodeRequest = {
    sessionId?: string;
  };

  type v1IssueSessionCodeResponse = {
    code?: string;
  };

  type v1ListGroupMembersResponse = {
    members?: v1GroupMember[];
    nextCursor?: string;
    total?: number;
  };

  type v1ListGroupRolesResponse = {
    roles?: v1Role[];
  };

  type v1ListGroupsResponse = {
    groups?: v1Group[];
    nextCursor?: string;
    total?: number;
  };

  type v1ListIdentitiesResponse = {
    identities?: v1Identity[];
  };

  type v1ListPermissionGroupsResponse = {
    groups?: v1PermissionGroup[];
    nextCursor?: string;
    total?: number;
  };

  type v1ListPermissionsResponse = {
    permissions?: v1Permission[];
    nextCursor?: string;
    total?: number;
  };

  type v1ListRolesResponse = {
    roles?: v1Role[];
    nextCursor?: string;
    total?: number;
  };

  type v1ListSessionsResponse = {
    sessions?: v1Session[];
  };

  type v1ListUserRolesResponse = {
    roles?: v1UserRole[];
  };

  type v1ListUsersPagedResponse = {
    users?: v1User[];
    total?: string;
    totalPages?: number;
  };

  type v1ListUsersResponse = {
    users?: v1User[];
    nextCursor?: string;
  };

  type v1LoginAction =
    | "LOGIN_ACTION_UNSPECIFIED"
    | "LOGIN_ACTION_LOGIN"
    | "LOGIN_ACTION_REGISTER"
    | "LOGIN_ACTION_SOCIAL_LOGIN"
    | "LOGIN_ACTION_SOCIAL_REGISTER"
    | "LOGIN_ACTION_BIND"
    | "LOGIN_ACTION_UNBIND";

  type v1LoginLog = {
    id?: string;
    userId?: string;
    provider?: v1IdentityProvider;
    action?: v1LoginAction;
    success?: boolean;
    failReason?: string;
    ip?: string;
    deviceType?: v1DeviceType;
    os?: string;
    browser?: string;
    country?: string;
    city?: string;
    createdAt?: string;
  };

  type v1LoginMethod =
    | "LOGIN_METHOD_UNSPECIFIED"
    | "LOGIN_METHOD_EMAIL_PASSWORD"
    | "LOGIN_METHOD_PHONE_PASSWORD"
    | "LOGIN_METHOD_PHONE_CODE"
    | "LOGIN_METHOD_EMAIL_CODE"
    | "LOGIN_METHOD_USERNAME_PASSWORD";

  type v1LoginRequest = {
    method?: v1LoginMethod;
    username?: string;
    password?: string;
    code?: string;
    email?: string;
    regionCode?: string;
    phone?: string;
    /** captcha_id returned by SendVerificationCode; required for code-based login. */
    captchaId?: string;
  };

  type v1MiniProgramLoginRequest = {
    code?: string;
    nickname?: string;
    avatarUrl?: string;
  };

  type v1MiniProgramPhoneLoginRequest = {
    loginCode?: string;
    phoneCode?: string;
    nickname?: string;
    avatarUrl?: string;
  };

  type v1Permission = {
    id?: string;
    resource?: string;
    action?: string;
    description?: string;
    isBuiltin?: boolean;
  };

  type v1PermissionGroup = {
    id?: string;
    name?: string;
    description?: string;
    permissions?: v1Permission[];
    isBuiltin?: boolean;
  };

  type v1Pong = {
    /** service name, e.g. "demo-service" */
    service?: string;
    /** semantic version (ldflags; "dev" by default) */
    version?: string;
    /** short commit hash (ldflags or VCS-embedded) */
    gitCommit?: string;
    /** git branch (ldflags) */
    gitBranch?: string;
    /** build time, RFC3339 UTC (ldflags) */
    buildTime?: string;
    /** Go toolchain version (runtime, not injected) */
    goVersion?: string;
    /** "SERVING" when serving normally */
    status?: string;
    /** server time, Unix millis */
    now?: string;
    /** process start time, Unix millis (client computes uptime) */
    startedAt?: string;
  };

  type v1RefreshSessionRequest = {
    sessionId?: string;
  };

  type v1RegisterRequest = {
    provider?: v1IdentityProvider;
    email?: string;
    code?: string;
    username?: string;
    nickname?: string;
    password?: string;
    regionCode?: string;
    phone?: string;
    /** captcha_id returned by SendVerificationCode; required to verify the code. */
    captchaId?: string;
  };

  type v1ResetPasswordRequest = {
    email?: string;
    code?: string;
    newPassword?: string;
    regionCode?: string;
    phone?: string;
  };

  type v1Role = {
    id?: string;
    name?: string;
    description?: string;
    isBuiltin?: boolean;
    permissions?: v1Permission[];
    permGroups?: v1PermissionGroup[];
    createdAt?: string;
    updatedAt?: string;
  };

  type v1SendVerificationCodeRequest = {
    email?: string;
    channel?: v1VerificationChannel;
    purpose?: v1VerificationPurpose;
    regionCode?: string;
    phone?: string;
    /** sender_id is the audit actor triggering this send (user id, service name,
platform identifier, ...). user-service is stateless and passes it through
verbatim; for unauthenticated flows (register/login) the frontend supplies
a platform identifier (e.g. the target email/phone or "testkit-web"). */
    senderId?: string;
  };

  type v1SendVerificationCodeResponse = {
    captchaId?: string;
  };

  type v1Session = {
    id?: string;
    ip?: string;
    deviceType?: v1DeviceType;
    os?: string;
    browser?: string;
    country?: string;
    city?: string;
    createdAt?: string;
    lastActiveAt?: string;
    current?: boolean;
  };

  type v1SocialLoginRequest = {
    provider?: v1IdentityProvider;
    code?: string;
    state?: string;
  };

  type v1SocialLoginResponse = {
    token?: string;
    user?: v1User;
    isNew?: boolean;
    /** meaningful only for SocialLogin (OAuth callback flow) */
    returnTo?: string;
  };

  type v1TokenResponse = {
    token?: string;
    user?: v1User;
  };

  type v1UpdateProfileRequest = {
    username?: string;
    nickname?: string;
    realName?: string;
    avatarUrl?: string;
    gender?: v1Gender;
    birthday?: string;
    timezone?: string;
    locale?: string;
    bio?: string;
  };

  type v1User = {
    id?: string;
    username?: string;
    nickname?: string;
    realName?: string;
    avatarUrl?: string;
    email?: string;
    regionCode?: string;
    phone?: string;
    gender?: v1Gender;
    /** YYYY-MM-DD */
    birthday?: string;
    timezone?: string;
    locale?: string;
    bio?: string;
    status?: v1UserStatus;
    registerSource?: v1IdentityProvider;
    userType?: v1UserType;
    lastLoginAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1UserRole = {
    id?: string;
    roleId?: string;
    roleName?: string;
    /** "direct" | "group:<group_name>" */
    source?: string;
    createdAt?: string;
  };

  type v1UserSortField =
    | "USER_SORT_FIELD_UNSPECIFIED"
    | "USER_SORT_FIELD_ID"
    | "USER_SORT_FIELD_CREATED_AT"
    | "USER_SORT_FIELD_UPDATED_AT"
    | "USER_SORT_FIELD_LAST_LOGIN_AT";

  type v1UserStatus =
    | "USER_STATUS_UNSPECIFIED"
    | "USER_STATUS_ACTIVE"
    | "USER_STATUS_DISABLED"
    | "USER_STATUS_PENDING_REVIEW";

  type v1UserType =
    | "USER_TYPE_UNSPECIFIED"
    | "USER_TYPE_NORMAL"
    | "USER_TYPE_INTERNAL";

  type v1VerificationChannel =
    | "VERIFICATION_CHANNEL_UNSPECIFIED"
    | "VERIFICATION_CHANNEL_EMAIL"
    | "VERIFICATION_CHANNEL_SMS";

  type v1VerificationPurpose =
    | "VERIFICATION_PURPOSE_UNSPECIFIED"
    | "VERIFICATION_PURPOSE_REGISTER"
    | "VERIFICATION_PURPOSE_LOGIN"
    | "VERIFICATION_PURPOSE_VERIFY_EMAIL"
    | "VERIFICATION_PURPOSE_VERIFY_PHONE"
    | "VERIFICATION_PURPOSE_PASSWORD_RESET"
    | "VERIFICATION_PURPOSE_BIND";
}
