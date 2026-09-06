declare namespace API {
  type AddGroupMemberParams = {
    /** path */
    groupId: string;
  };

  type AddGroupRoleParams = {
    /** path */
    groupId: string;
  };

  type AdminDeleteFileParams = {
    fileId: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type AdminGetFileParams = {
    fileId: string;
  };

  type AdminGetQuotaParams = {
    ownerType?:
      | "OWNER_TYPE_UNSPECIFIED"
      | "OWNER_TYPE_USER"
      | "OWNER_TYPE_SYSTEM"
      | "OWNER_TYPE_GROUP"
      | "OWNER_TYPE_BUSINESS"
      | "OWNER_TYPE_SERVICE";
    ownerId?: string;
  };

  type AdminGetStatsParams = {
    /** 0 = all */
    ownerType?:
      | "OWNER_TYPE_UNSPECIFIED"
      | "OWNER_TYPE_USER"
      | "OWNER_TYPE_SYSTEM"
      | "OWNER_TYPE_GROUP"
      | "OWNER_TYPE_BUSINESS"
      | "OWNER_TYPE_SERVICE";
    /** 0 = all */
    ownerId?: string;
  };

  type AdminListAuditLogsParams = {
    action?:
      | "AUDIT_ACTION_UNSPECIFIED"
      | "AUDIT_ACTION_UPLOAD"
      | "AUDIT_ACTION_UPDATE"
      | "AUDIT_ACTION_DELETE"
      | "AUDIT_ACTION_BATCH_DELETE"
      | "AUDIT_ACTION_ADMIN_DELETE"
      | "AUDIT_ACTION_ADMIN_SET_QUOTA"
      | "AUDIT_ACTION_ADMIN_SOFT_DELETE_OWNER"
      | "AUDIT_ACTION_ADMIN_DELETE_OWNER"
      | "AUDIT_ACTION_SET_OWNER_QUOTA"
      | "AUDIT_ACTION_ADD_OWNER_QUOTA"
      | "AUDIT_ACTION_UPLOAD_SESSION_CREATE"
      | "AUDIT_ACTION_UPLOAD_SESSION_CONFIRM"
      | "AUDIT_ACTION_UPLOAD_SESSION_CANCEL"
      | "AUDIT_ACTION_UPLOAD_SESSION_GC";
    targetType?:
      | "AUDIT_LOG_TARGET_TYPE_UNSPECIFIED"
      | "AUDIT_LOG_TARGET_TYPE_FILE"
      | "AUDIT_LOG_TARGET_TYPE_QUOTA"
      | "AUDIT_LOG_TARGET_TYPE_OWNER";
    status?:
      | "AUDIT_LOG_STATUS_UNSPECIFIED"
      | "AUDIT_LOG_STATUS_SUCCESS"
      | "AUDIT_LOG_STATUS_FAILED";
    /** filter: search logs by trace id */
    requestId?: string;
    ownerType?:
      | "OWNER_TYPE_UNSPECIFIED"
      | "OWNER_TYPE_USER"
      | "OWNER_TYPE_SYSTEM"
      | "OWNER_TYPE_GROUP"
      | "OWNER_TYPE_BUSINESS"
      | "OWNER_TYPE_SERVICE";
    ownerId?: string;
    targetId?: string;
    startTime?: string;
    endTime?: string;
    pageSize?: number;
    pageToken?: string;
  };

  type AdminListFilesParams = {
    ownerType?:
      | "OWNER_TYPE_UNSPECIFIED"
      | "OWNER_TYPE_USER"
      | "OWNER_TYPE_SYSTEM"
      | "OWNER_TYPE_GROUP"
      | "OWNER_TYPE_BUSINESS"
      | "OWNER_TYPE_SERVICE";
    ownerId?: string;
    pathPrefix?: string;
    extension?: string;
    contentTypePrefix?: string;
    orderBy?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    descending?: boolean;
    pageSize?: number;
    pageToken?: string;
    provider?: string;
    bucket?: string;
  };

  type AssignRoleParams = {
    /** target user (path) */
    userId: string;
  };

  type CreateFileLinkParams = {
    fileId: string;
  };

  type CreateSigningKeyParams = {
    slug: string;
  };

  type DecomposeParams = {
    id: string;
  };

  type DeleteGroupParams = {
    groupId: string;
  };

  type DeleteKeyParams = {
    keyId: string;
    confirm?: boolean;
  };

  type DeleteMyFileParams = {
    fileId: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
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

  type GenerateCDNURLParams = {
    fileId: string;
  };

  type GenerateDownloadURLParams = {
    fileId: string;
  };

  type GenerateProcessURLParams = {
    fileId: string;
  };

  type GetAppParams = {
    slug: string;
  };

  type GetAppStatsParams = {
    slug: string;
    days?: number;
  };

  type GetEmailParams = {
    id: string;
  };

  type GetEmailStatsParams = {
    /**  - EMAIL_VENDOR_ALIYUN: Aliyun DirectMail.
 - EMAIL_VENDOR_TENCENT: Tencent SES.
 - EMAIL_VENDOR_NETEASE: NetEase EasyMail. */
    vendor?:
      | "EMAIL_VENDOR_UNSPECIFIED"
      | "EMAIL_VENDOR_ALIYUN"
      | "EMAIL_VENDOR_TENCENT"
      | "EMAIL_VENDOR_NETEASE";
    /**  - EMAIL_SCENE_LOGIN_CODE: One-time login verification code.
 - EMAIL_SCENE_FORGOT_PASSWORD: Password reset link / code.
 - EMAIL_SCENE_REGISTER: Registration verification code.
 - EMAIL_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - EMAIL_SCENE_BIND_ACCOUNT: Bind a new email/identity to an account.
 - EMAIL_SCENE_NOTIFICATION: Generic transactional notification.
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address. */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL";
    startTime?: string;
    endTime?: string;
  };

  type GetFileLinkDownloadParams = {
    linkToken: string;
  };

  type GetGroupParams = {
    groupId: string;
  };

  type GetLoginLogsParams = {
    /** optional filter (0 = all); kept */
    userId?: string;
    /**  - IDENTITY_PROVIDER_WECHAT: WeChat web OAuth (redirect-based).
 - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
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
    /** optional: presence distinguishes "filter failed attempts" (false) from
"no filter" — a plain proto3 bool cannot tell those apart. */
    success?: boolean;
    pageSize?: number;
    cursor?: string;
    /** optional filter (0 = all)

 - LOGIN_ACTION_LOGIN: Successful password Login.
 - LOGIN_ACTION_REGISTER: Register RPC or code-login auto-register.
 - LOGIN_ACTION_SOCIAL_LOGIN: SocialLogin on an existing user.
 - LOGIN_ACTION_SOCIAL_REGISTER: SocialLogin / MiniProgramLogin on a new user.
 - LOGIN_ACTION_BIND: BindIdentity (planned).
 - LOGIN_ACTION_UNBIND: UnbindIdentity (planned). */
    action?:
      | "LOGIN_ACTION_UNSPECIFIED"
      | "LOGIN_ACTION_LOGIN"
      | "LOGIN_ACTION_REGISTER"
      | "LOGIN_ACTION_SOCIAL_LOGIN"
      | "LOGIN_ACTION_SOCIAL_REGISTER"
      | "LOGIN_ACTION_BIND"
      | "LOGIN_ACTION_UNBIND";
    /** optional filter (0 = all)

 - LOGIN_METHOD_PHONE_CODE: Auto-registers on missing identity.
 - LOGIN_METHOD_EMAIL_CODE: Auto-registers on missing identity. */
    method?:
      | "LOGIN_METHOD_UNSPECIFIED"
      | "LOGIN_METHOD_EMAIL_PASSWORD"
      | "LOGIN_METHOD_PHONE_PASSWORD"
      | "LOGIN_METHOD_PHONE_CODE"
      | "LOGIN_METHOD_EMAIL_CODE"
      | "LOGIN_METHOD_USERNAME_PASSWORD";
    /** Alternative to user_id: resolve the username server-side. user_id wins
when both are set; an unknown username yields an empty page. */
    username?: string;
  };

  type GetMyFileParams = {
    fileId: string;
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

  type GetSMSParams = {
    id: string;
  };

  type GetSMSStatsParams = {
    /**  - SMS_VENDOR_ALIYUN: Aliyun (domestic + intl SendMessageToGlobe).
 - SMS_VENDOR_TENCENT: Tencent Cloud SMS (domestic + intl via SdkAppid).
 - SMS_VENDOR_VOLCENGINE: ByteDance Volcengine SMS.
 - SMS_VENDOR_BYTEPLUS: Byteplus (intl-only, template-based).
 - SMS_VENDOR_HUAWEI: Huawei Cloud SMS. */
    vendor?:
      | "SMS_VENDOR_UNSPECIFIED"
      | "SMS_VENDOR_ALIYUN"
      | "SMS_VENDOR_TENCENT"
      | "SMS_VENDOR_VOLCENGINE"
      | "SMS_VENDOR_BYTEPLUS"
      | "SMS_VENDOR_HUAWEI";
    /**  - SMS_SCENE_LOGIN_CODE: One-time login verification code.
 - SMS_SCENE_FORGOT_PASSWORD: Password reset code.
 - SMS_SCENE_REGISTER: Registration verification code.
 - SMS_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - SMS_SCENE_BIND_ACCOUNT: Bind a new phone to an account.
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number. */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE";
    startTime?: string;
    endTime?: string;
  };

  type GetUserParams = {
    /** target user (kept) */
    userId: string;
  };

  type GrantModuleParams = {
    keyId: string;
    module: "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";
  };

  type KickDeviceParams = {
    keyId: string;
    deviceToken: string;
    reason?: string;
  };

  type ListEmailsByCursorParams = {
    /**  - EMAIL_VENDOR_ALIYUN: Aliyun DirectMail.
 - EMAIL_VENDOR_TENCENT: Tencent SES.
 - EMAIL_VENDOR_NETEASE: NetEase EasyMail. */
    vendor?:
      | "EMAIL_VENDOR_UNSPECIFIED"
      | "EMAIL_VENDOR_ALIYUN"
      | "EMAIL_VENDOR_TENCENT"
      | "EMAIL_VENDOR_NETEASE";
    /**  - EMAIL_SCENE_LOGIN_CODE: One-time login verification code.
 - EMAIL_SCENE_FORGOT_PASSWORD: Password reset link / code.
 - EMAIL_SCENE_REGISTER: Registration verification code.
 - EMAIL_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - EMAIL_SCENE_BIND_ACCOUNT: Bind a new email/identity to an account.
 - EMAIL_SCENE_NOTIFICATION: Generic transactional notification.
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address. */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL";
    /**  - MESSAGE_STATUS_UNSPECIFIED: UNSPECIFIED — never persisted.
 - MESSAGE_STATUS_PENDING: PENDING — send in progress. Reserved for future async-send flow;
the sync flow does NOT write PENDING (currently unused).
 - MESSAGE_STATUS_SENT: SENT — the vendor synchronously accepted the send request.
For SMS: vendor API returned OK; does NOT mean handset received
         (async delivery is not tracked yet).
For email: SMTP server accepted the message.
 - MESSAGE_STATUS_FAILED: FAILED — the vendor rejected the request, network/transport failed,
or context was cancelled. error_message carries the last error. */
    status?:
      | "MESSAGE_STATUS_UNSPECIFIED"
      | "MESSAGE_STATUS_PENDING"
      | "MESSAGE_STATUS_SENT"
      | "MESSAGE_STATUS_FAILED";
    target?: string;
    startTime?: string;
    endTime?: string;
    sortField?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    sortDirection?:
      | "SORT_DIRECTION_UNSPECIFIED"
      | "SORT_DIRECTION_ASC"
      | "SORT_DIRECTION_DESC";
    pageSize?: number;
    pageToken?: string;
    includeTotal?: boolean;
    /** sender_id filter (mirror of message-service ListEmailsByCursorRequest.sender_id). */
    senderId?: string;
  };

  type ListEmailsParams = {
    /**  - EMAIL_VENDOR_ALIYUN: Aliyun DirectMail.
 - EMAIL_VENDOR_TENCENT: Tencent SES.
 - EMAIL_VENDOR_NETEASE: NetEase EasyMail. */
    vendor?:
      | "EMAIL_VENDOR_UNSPECIFIED"
      | "EMAIL_VENDOR_ALIYUN"
      | "EMAIL_VENDOR_TENCENT"
      | "EMAIL_VENDOR_NETEASE";
    /**  - EMAIL_SCENE_LOGIN_CODE: One-time login verification code.
 - EMAIL_SCENE_FORGOT_PASSWORD: Password reset link / code.
 - EMAIL_SCENE_REGISTER: Registration verification code.
 - EMAIL_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - EMAIL_SCENE_BIND_ACCOUNT: Bind a new email/identity to an account.
 - EMAIL_SCENE_NOTIFICATION: Generic transactional notification.
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address. */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL";
    /**  - MESSAGE_STATUS_UNSPECIFIED: UNSPECIFIED — never persisted.
 - MESSAGE_STATUS_PENDING: PENDING — send in progress. Reserved for future async-send flow;
the sync flow does NOT write PENDING (currently unused).
 - MESSAGE_STATUS_SENT: SENT — the vendor synchronously accepted the send request.
For SMS: vendor API returned OK; does NOT mean handset received
         (async delivery is not tracked yet).
For email: SMTP server accepted the message.
 - MESSAGE_STATUS_FAILED: FAILED — the vendor rejected the request, network/transport failed,
or context was cancelled. error_message carries the last error. */
    status?:
      | "MESSAGE_STATUS_UNSPECIFIED"
      | "MESSAGE_STATUS_PENDING"
      | "MESSAGE_STATUS_SENT"
      | "MESSAGE_STATUS_FAILED";
    target?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
    sortField?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    sortDirection?:
      | "SORT_DIRECTION_UNSPECIFIED"
      | "SORT_DIRECTION_ASC"
      | "SORT_DIRECTION_DESC";
    /** sender_id filters by the calling service label recorded on each record
(mirror of message-service ListEmailsRequest.sender_id). */
    senderId?: string;
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

  type ListKeyDevicesParams = {
    keyId: string;
  };

  type ListKeysParams = {
    status?:
      | "KEY_STATUS_UNSPECIFIED"
      | "KEY_STATUS_ACTIVE"
      | "KEY_STATUS_REVOKED";
    limit?: number;
  };

  type ListMyAuditLogsParams = {
    action?:
      | "AUDIT_ACTION_UNSPECIFIED"
      | "AUDIT_ACTION_UPLOAD"
      | "AUDIT_ACTION_UPDATE"
      | "AUDIT_ACTION_DELETE"
      | "AUDIT_ACTION_BATCH_DELETE"
      | "AUDIT_ACTION_ADMIN_DELETE"
      | "AUDIT_ACTION_ADMIN_SET_QUOTA"
      | "AUDIT_ACTION_ADMIN_SOFT_DELETE_OWNER"
      | "AUDIT_ACTION_ADMIN_DELETE_OWNER"
      | "AUDIT_ACTION_SET_OWNER_QUOTA"
      | "AUDIT_ACTION_ADD_OWNER_QUOTA"
      | "AUDIT_ACTION_UPLOAD_SESSION_CREATE"
      | "AUDIT_ACTION_UPLOAD_SESSION_CONFIRM"
      | "AUDIT_ACTION_UPLOAD_SESSION_CANCEL"
      | "AUDIT_ACTION_UPLOAD_SESSION_GC";
    targetType?:
      | "AUDIT_LOG_TARGET_TYPE_UNSPECIFIED"
      | "AUDIT_LOG_TARGET_TYPE_FILE"
      | "AUDIT_LOG_TARGET_TYPE_QUOTA"
      | "AUDIT_LOG_TARGET_TYPE_OWNER";
    startTime?: string;
    endTime?: string;
    pageSize?: number;
    pageToken?: string;
  };

  type ListMyFilesPagedParams = {
    page?: number;
    pageSize?: number;
    pathPrefix?: string;
    extension?: string;
    contentTypePrefix?: string;
    orderBy?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    descending?: boolean;
  };

  type ListMyFilesParams = {
    pathPrefix?: string;
    extension?: string;
    contentTypePrefix?: string;
    orderBy?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    descending?: boolean;
    pageSize?: number;
    pageToken?: string;
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

  type ListSessionsParams = {
    /** History pages are cursor-based; the first call (empty cursor) also
returns the LIVE sessions ahead of the history (see user.v1). */
    pageSize?: number;
    cursor?: string;
    /** Optional status filter (see user.v1): ACTIVE = live rows only;
REVOKED/EXPIRED page the matching tombstones.

 - SESSION_STATUS_ACTIVE: in Redis; the sliding window is alive
 - SESSION_STATUS_REVOKED: explicit logout / revoke (revoked_at set)
 - SESSION_STATUS_EXPIRED: not in Redis, not revoked — TTL lapsed or evicted by the max-sessions cap */
    status?:
      | "SESSION_STATUS_UNSPECIFIED"
      | "SESSION_STATUS_ACTIVE"
      | "SESSION_STATUS_REVOKED"
      | "SESSION_STATUS_EXPIRED";
  };

  type ListSMSByCursorParams = {
    /**  - SMS_VENDOR_ALIYUN: Aliyun (domestic + intl SendMessageToGlobe).
 - SMS_VENDOR_TENCENT: Tencent Cloud SMS (domestic + intl via SdkAppid).
 - SMS_VENDOR_VOLCENGINE: ByteDance Volcengine SMS.
 - SMS_VENDOR_BYTEPLUS: Byteplus (intl-only, template-based).
 - SMS_VENDOR_HUAWEI: Huawei Cloud SMS. */
    vendor?:
      | "SMS_VENDOR_UNSPECIFIED"
      | "SMS_VENDOR_ALIYUN"
      | "SMS_VENDOR_TENCENT"
      | "SMS_VENDOR_VOLCENGINE"
      | "SMS_VENDOR_BYTEPLUS"
      | "SMS_VENDOR_HUAWEI";
    /**  - SMS_SCENE_LOGIN_CODE: One-time login verification code.
 - SMS_SCENE_FORGOT_PASSWORD: Password reset code.
 - SMS_SCENE_REGISTER: Registration verification code.
 - SMS_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - SMS_SCENE_BIND_ACCOUNT: Bind a new phone to an account.
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number. */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE";
    /**  - MESSAGE_STATUS_UNSPECIFIED: UNSPECIFIED — never persisted.
 - MESSAGE_STATUS_PENDING: PENDING — send in progress. Reserved for future async-send flow;
the sync flow does NOT write PENDING (currently unused).
 - MESSAGE_STATUS_SENT: SENT — the vendor synchronously accepted the send request.
For SMS: vendor API returned OK; does NOT mean handset received
         (async delivery is not tracked yet).
For email: SMTP server accepted the message.
 - MESSAGE_STATUS_FAILED: FAILED — the vendor rejected the request, network/transport failed,
or context was cancelled. error_message carries the last error. */
    status?:
      | "MESSAGE_STATUS_UNSPECIFIED"
      | "MESSAGE_STATUS_PENDING"
      | "MESSAGE_STATUS_SENT"
      | "MESSAGE_STATUS_FAILED";
    regionCode?: string;
    phone?: string;
    startTime?: string;
    endTime?: string;
    sortField?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    sortDirection?:
      | "SORT_DIRECTION_UNSPECIFIED"
      | "SORT_DIRECTION_ASC"
      | "SORT_DIRECTION_DESC";
    pageSize?: number;
    pageToken?: string;
    includeTotal?: boolean;
    /** sender_id filter (mirror of message-service ListSMSByCursorRequest.sender_id). */
    senderId?: string;
  };

  type ListSMSParams = {
    /**  - SMS_VENDOR_ALIYUN: Aliyun (domestic + intl SendMessageToGlobe).
 - SMS_VENDOR_TENCENT: Tencent Cloud SMS (domestic + intl via SdkAppid).
 - SMS_VENDOR_VOLCENGINE: ByteDance Volcengine SMS.
 - SMS_VENDOR_BYTEPLUS: Byteplus (intl-only, template-based).
 - SMS_VENDOR_HUAWEI: Huawei Cloud SMS. */
    vendor?:
      | "SMS_VENDOR_UNSPECIFIED"
      | "SMS_VENDOR_ALIYUN"
      | "SMS_VENDOR_TENCENT"
      | "SMS_VENDOR_VOLCENGINE"
      | "SMS_VENDOR_BYTEPLUS"
      | "SMS_VENDOR_HUAWEI";
    /**  - SMS_SCENE_LOGIN_CODE: One-time login verification code.
 - SMS_SCENE_FORGOT_PASSWORD: Password reset code.
 - SMS_SCENE_REGISTER: Registration verification code.
 - SMS_SCENE_CHANGE_PASSWORD: Confirmation of password change.
 - SMS_SCENE_BIND_ACCOUNT: Bind a new phone to an account.
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number. */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE";
    /**  - MESSAGE_STATUS_UNSPECIFIED: UNSPECIFIED — never persisted.
 - MESSAGE_STATUS_PENDING: PENDING — send in progress. Reserved for future async-send flow;
the sync flow does NOT write PENDING (currently unused).
 - MESSAGE_STATUS_SENT: SENT — the vendor synchronously accepted the send request.
For SMS: vendor API returned OK; does NOT mean handset received
         (async delivery is not tracked yet).
For email: SMTP server accepted the message.
 - MESSAGE_STATUS_FAILED: FAILED — the vendor rejected the request, network/transport failed,
or context was cancelled. error_message carries the last error. */
    status?:
      | "MESSAGE_STATUS_UNSPECIFIED"
      | "MESSAGE_STATUS_PENDING"
      | "MESSAGE_STATUS_SENT"
      | "MESSAGE_STATUS_FAILED";
    regionCode?: string;
    phone?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
    sortField?:
      | "SORT_FIELD_UNSPECIFIED"
      | "SORT_FIELD_CREATED_AT"
      | "SORT_FIELD_FILENAME"
      | "SORT_FIELD_SIZE";
    sortDirection?:
      | "SORT_DIRECTION_UNSPECIFIED"
      | "SORT_DIRECTION_ASC"
      | "SORT_DIRECTION_DESC";
    /** sender_id filter (mirror of message-service ListSMSRequest.sender_id). */
    senderId?: string;
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
    /**  - IDENTITY_PROVIDER_WECHAT: WeChat web OAuth (redirect-based).
 - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
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
    /**  - DEVICE_TYPE_API: Machine-to-machine / direct API token (no UA). */
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
    /**  - USER_SORT_FIELD_ID: Default: snowflake id ascending. */
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
    /**  - IDENTITY_PROVIDER_WECHAT: WeChat web OAuth (redirect-based).
 - IDENTITY_PROVIDER_ADMIN: Audit tag for CreateUser; not a login method. */
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
    /**  - DEVICE_TYPE_API: Machine-to-machine / direct API token (no UA). */
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
    /**  - USER_SORT_FIELD_ID: Default: snowflake id ascending. */
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

  type protobufNullValue = "NULL_VALUE";

  type RemoveGroupMemberParams = {
    groupId: string;
    userId: string;
  };

  type RemoveGroupRoleParams = {
    groupId: string;
    roleId: string;
  };

  type ReplaceEventRulesParams = {
    slug: string;
  };

  type ResetTrialParams = {
    fingerprintId: string;
    module: "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";
  };

  type RevokeKeyParams = {
    keyId: string;
  };

  type RevokeModuleParams = {
    keyId: string;
    module: "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";
    reason?: string;
  };

  type RevokeRoleParams = {
    userId: string;
    roleId: string;
  };

  type RevokeSessionParams = {
    sessionId: string;
  };

  type RevokeSigningKeyParams = {
    slug: string;
    keyId: string;
  };

  type RevokeTokenParams = {
    slug: string;
    prefix: string;
  };

  type RotateTokenParams = {
    slug: string;
  };

  type rpcStatus = {
    code?: number;
    message?: string;
    details?: protobufAny[];
  };

  type SetVersionBlockedParams = {
    slug: string;
    version: string;
  };

  type ShowKeyParams = {
    keyId: string;
  };

  type ShowTrialParams = {
    fingerprintId: string;
    module?: "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";
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

  type TestkitServiceCreateFileLinkBody = {
    /** retention_ttl_seconds, when > 0, (re)sets the retention window
(renewal keeps the token stable). 0 keeps the current value. */
    retentionTtlSeconds?: number;
  };

  type TestkitServiceCreateSigningKeyBody = {
    keyId?: string;
  };

  type TestkitServiceDisableUserBody = {
    disable?: boolean;
    reason?: string;
  };

  type TestkitServiceGenerateCDNURLBody = {
    /** empty = plain download URL */
    ops?: v1ImageProcessOp[];
    ttl?: string;
    /** unsigned permanent URL for public resources */
    public?: boolean;
    filename?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type TestkitServiceGenerateDownloadURLBody = {
    ttlSeconds?: number;
    /** overrides response-content-disposition filename */
    filename?: string;
  };

  type TestkitServiceGenerateProcessURLBody = {
    ops?: v1ImageProcessOp[];
    ttlSeconds?: number;
  };

  type TestkitServiceGrantModuleBody = {
    kind?: v1EntitlementKind;
    durationDays?: number;
    expiresAt?: string;
  };

  type TestkitServiceReplaceEventRulesBody = {
    rules?: v1EventRule[];
  };

  type TestkitServiceResetTrialBody = {
    reason?: string;
  };

  type TestkitServiceRevokeKeyBody = {
    reason?: string;
  };

  type TestkitServiceRotateTokenBody = true;

  type TestkitServiceSetVersionBlockedBody = {
    blocked?: boolean;
  };

  type TestkitServiceUnrevokeKeyBody = true;

  type TestkitServiceUpdateAppBody = {
    name?: string;
    email?: string;
    strictVersions?: boolean;
    authMode?: v1AuthMode;
    authGraceUntil?: string;
    clearAuthGrace?: boolean;
    ratePerMinute?: number;
    ratePerDay?: number;
    rawRetentionDays?: number;
    dailyEventBudget?: string;
  };

  type TestkitServiceUpdateGroupBody = {
    name?: string;
    description?: string;
  };

  type TestkitServiceUpdateKeyBody = {
    label?: string;
    slots?: number;
  };

  type TestkitServiceUpdateMyFileBody = {
    filename?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
    clearMetadata?: boolean;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
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

  type UnrevokeKeyParams = {
    keyId: string;
  };

  type UpdateAppParams = {
    slug: string;
  };

  type UpdateGroupParams = {
    groupId: string;
  };

  type UpdateKeyParams = {
    keyId: string;
  };

  type UpdateMyFileParams = {
    fileId: string;
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

  type v1ActivateRequest = {
    key?: string;
    licenseKey?: string;
    fingerprintId?: string;
    deviceToken?: string;
    evictDeviceToken?: string;
  };

  type v1ActivateResponse = {
    payload?: string;
    signature?: string;
    slots?: v1SlotSummary;
  };

  type v1AdminDeleteOwnerRequest = {
    ownerType?: v1OwnerType;
    ownerId?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1AdminDeleteOwnerResponse = {
    filesDeleted?: string;
    bytesReleased?: string;
  };

  type v1AdminFileInfo = {
    id?: string;
    ownerType?: v1OwnerType;
    ownerId?: string;
    filename?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
    isPublic?: boolean;
    objectId?: string;
    size?: string;
    contentType?: string;
    extension?: string;
    md5?: string;
    provider?: string;
    bucket?: string;
    objectKey?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1AdminGetStatsResponse = {
    /** deduped physical files */
    totalObjects?: string;
    /** file references */
    totalFiles?: string;
    /** actual cloud storage used (deduped) */
    physicalBytes?: string;
    /** sum of used_bytes (user quota only) */
    logicalBytes?: string;
    ownerStats?: v1OwnerStats[];
    providerStats?: v1ProviderStats[];
    bucketStats?: v1BucketStats[];
  };

  type v1AdminListAuditLogsResponse = {
    logs?: v1AuditLogEntry[];
    totalCount?: number;
    nextPageToken?: string;
  };

  type v1AdminListBucketsResponse = {
    buckets?: v1BucketInfo[];
  };

  type v1AdminListFilesResponse = {
    files?: v1AdminFileInfo[];
    totalCount?: number;
    nextPageToken?: string;
  };

  type v1AdminListProvidersResponse = {
    providers?: v1ProviderInfo[];
  };

  type v1AdminSetQuotaRequest = {
    ownerType?: v1OwnerType;
    ownerId?: string;
    totalBytes?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1AdminSoftDeleteOwnerFilesRequest = {
    ownerType?: v1OwnerType;
    ownerId?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1AdminSoftDeleteOwnerFilesResponse = {
    filesDeleted?: string;
    bytesReleased?: string;
  };

  type v1App = {
    id?: string;
    slug?: string;
    name?: string;
    email?: string;
    strictVersions?: boolean;
    authMode?: v1AuthMode;
    authGraceUntil?: string;
    ratePerMinute?: number;
    ratePerDay?: number;
    rawRetentionDays?: number;
    dailyEventBudget?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1AuditAction =
    | "AUDIT_ACTION_UNSPECIFIED"
    | "AUDIT_ACTION_UPLOAD"
    | "AUDIT_ACTION_UPDATE"
    | "AUDIT_ACTION_DELETE"
    | "AUDIT_ACTION_BATCH_DELETE"
    | "AUDIT_ACTION_ADMIN_DELETE"
    | "AUDIT_ACTION_ADMIN_SET_QUOTA"
    | "AUDIT_ACTION_ADMIN_SOFT_DELETE_OWNER"
    | "AUDIT_ACTION_ADMIN_DELETE_OWNER"
    | "AUDIT_ACTION_SET_OWNER_QUOTA"
    | "AUDIT_ACTION_ADD_OWNER_QUOTA"
    | "AUDIT_ACTION_UPLOAD_SESSION_CREATE"
    | "AUDIT_ACTION_UPLOAD_SESSION_CONFIRM"
    | "AUDIT_ACTION_UPLOAD_SESSION_CANCEL"
    | "AUDIT_ACTION_UPLOAD_SESSION_GC";

  type v1AuditLogEntry = {
    id?: string;
    action?: v1AuditAction;
    ownerType?: v1OwnerType;
    ownerId?: string;
    targetType?: v1AuditLogTargetType;
    targetId?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    status?: v1AuditLogStatus;
    errorMessage?: string;
    requestId?: string;
    createdAt?: string;
  };

  type v1AuditLogStatus =
    | "AUDIT_LOG_STATUS_UNSPECIFIED"
    | "AUDIT_LOG_STATUS_SUCCESS"
    | "AUDIT_LOG_STATUS_FAILED";

  type v1AuditLogTargetType =
    | "AUDIT_LOG_TARGET_TYPE_UNSPECIFIED"
    | "AUDIT_LOG_TARGET_TYPE_FILE"
    | "AUDIT_LOG_TARGET_TYPE_QUOTA"
    | "AUDIT_LOG_TARGET_TYPE_OWNER";

  type v1AuthMode =
    | "AUTH_MODE_UNSPECIFIED"
    | "AUTH_MODE_NONE"
    | "AUTH_MODE_HMAC";

  type v1BatchDeleteMyFilesRequest = {
    fileIds?: string[];
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1BatchDeleteMyFilesResponse = {
    deletedCount?: number;
    failedIds?: string[];
  };

  type v1BatchGetSTSCredentialRequest = {
    files?: v1UploadFileMeta[];
    bucket?: string;
    ttl?: string;
    allowedExtensions?: string[];
    visibility?: v1Visibility;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1BatchGetSTSCredentialResponse = {
    accessKey?: string;
    secretKey?: string;
    securityToken?: string;
    endpoint?: string;
    bucket?: string;
    expiresAt?: string;
    /** ordered to match request.files */
    items?: v1UploadCredentialItem[];
  };

  type v1BatchNextIDRequest = {
    count?: number;
  };

  type v1BatchNextIDResponse = {
    ids?: string[];
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

  type v1BucketACL =
    | "BUCKET_ACL_UNSPECIFIED"
    | "BUCKET_ACL_PRIVATE"
    | "BUCKET_ACL_PUBLIC_READ"
    | "BUCKET_ACL_PUBLIC_READ_WRITE";

  type v1BucketInfo = {
    name?: string;
    provider?: string;
    keyPrefix?: string;
    acl?: v1BucketACL;
    vendor?: v1Vendor;
  };

  type v1BucketStats = {
    bucket?: string;
    objectCount?: string;
    totalBytes?: string;
    fileCount?: string;
  };

  type v1CancelUploadRequest = {
    uploadToken?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1ChangePasswordRequest = {
    oldPassword?: string;
    newPassword?: string;
  };

  type v1ConfirmUploadRequest = {
    uploadToken?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1ConfirmUploadResponse = {
    fileId?: string;
    fileInfo?: v1FileInfo;
  };

  type v1CreateAppRequest = {
    slug?: string;
    name?: string;
    email?: string;
  };

  type v1CreateAppResponse = {
    app?: v1App;
    token?: string;
  };

  type v1CreateFileLinkResponse = {
    linkToken?: string;
    /** unix seconds, 0 = permanent */
    retainUntil?: string;
  };

  type v1CreateGroupRequest = {
    name?: string;
    description?: string;
    parentId?: string;
  };

  type v1CreateKeyRequest = {
    label?: string;
    slots?: number;
    grants?: v1EntitlementInput[];
  };

  type v1CreateKeyResponse = {
    key?: v1KeyInfo;
    plaintextKey?: string;
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

  type v1CreateSigningKeyResponse = {
    keyId?: string;
    secret?: string;
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

  type v1DailyStat = {
    day?: string;
    devices?: string;
    events?: string;
  };

  type v1DashboardResponse = {
    emailStats?: v1EmailStats;
    smsStats?: v1SMSStats;
    quota?: v1MyQuota;
    users?: v1UsersSummary;
  };

  type v1DeactivateRequest = {
    key?: string;
    licenseKey?: string;
    deviceToken?: string;
  };

  type v1DeactivateResponse = {
    released?: boolean;
  };

  type v1DecomposeResponse = {
    time?: string;
    sequence?: string;
    machineId?: string;
    /** ISO8601 timestamp */
    generatedAt?: string;
  };

  type v1DeleteKeyResponse = true;

  type v1DeviceSlotInfo = {
    deviceToken?: string;
    fingerprintId?: string;
    firstSeenAt?: string;
    lastSeenAt?: string;
    name?: string;
  };

  type v1DeviceType =
    | "DEVICE_TYPE_UNSPECIFIED"
    | "DEVICE_TYPE_WEB"
    | "DEVICE_TYPE_IOS"
    | "DEVICE_TYPE_ANDROID"
    | "DEVICE_TYPE_API";

  type v1EmailAddress = {
    email?: string;
    displayName?: string;
  };

  type v1EmailAttachment = {
    filename?: string;
    url?: string;
    content?: string;
    inline?: boolean;
    mimeType?: string;
    sizeBytes?: string;
  };

  type v1EmailRecord = {
    id?: string;
    vendor?: v1EmailVendor;
    account?: string;
    scene?: v1EmailScene;
    status?: v1MessageStatus;
    target?: v1EmailAddress;
    /** read-only echo (testkit's sends echo cfg.Message.SenderID) */
    senderId?: string;
    cc?: v1EmailAddress[];
    bcc?: v1EmailAddress[];
    subject?: string;
    content?: string;
    htmlBody?: string;
    replyTo?: v1EmailAddress;
    templateId?: string;
    templateParams?: Record<string, any>;
    errorMessage?: string;
    attempts?: number;
    sentAt?: string;
    createdAt?: string;
    updatedAt?: string;
    attachments?: v1EmailAttachment[];
  };

  type v1EmailScene =
    | "EMAIL_SCENE_UNSPECIFIED"
    | "EMAIL_SCENE_LOGIN_CODE"
    | "EMAIL_SCENE_FORGOT_PASSWORD"
    | "EMAIL_SCENE_REGISTER"
    | "EMAIL_SCENE_CHANGE_PASSWORD"
    | "EMAIL_SCENE_BIND_ACCOUNT"
    | "EMAIL_SCENE_NOTIFICATION"
    | "EMAIL_SCENE_VERIFY_EMAIL";

  type v1EmailStats = {
    total?: string;
    sent?: string;
    failed?: string;
    /** success_rate in [0, 100]; -1 means "no data" (total == 0). */
    successRate?: number;
    vendors?: v1EmailVendorStats[];
  };

  type v1EmailStatsResponse = {
    total?: string;
    sent?: string;
    failed?: string;
    /** [0,100]; -1 = no data */
    successRate?: number;
    vendors?: v1EmailVendorStats[];
  };

  type v1EmailVendor =
    | "EMAIL_VENDOR_UNSPECIFIED"
    | "EMAIL_VENDOR_ALIYUN"
    | "EMAIL_VENDOR_TENCENT"
    | "EMAIL_VENDOR_NETEASE";

  type v1EmailVendorStats = {
    vendor?: v1EmailVendor;
    total?: string;
    sent?: string;
    failed?: string;
  };

  type v1EntitlementInfo = {
    module?: v1Module;
    kind?: v1EntitlementKind;
    expiresAt?: string;
    grantedAt?: string;
  };

  type v1EntitlementInput = {
    module?: v1Module;
    kind?: v1EntitlementKind;
    durationDays?: number;
    expiresAt?: string;
  };

  type v1EntitlementKind =
    | "ENTITLEMENT_KIND_UNSPECIFIED"
    | "ENTITLEMENT_KIND_PERPETUAL"
    | "ENTITLEMENT_KIND_SUBSCRIPTION"
    | "ENTITLEMENT_KIND_TRIAL";

  type v1EventRule = {
    eventName?: string;
    allowProps?: string[];
    mapProp?: string;
  };

  type v1ExchangeSessionCodeRequest = {
    code?: string;
  };

  type v1ExchangeSessionCodeResponse = {
    sessionId?: string;
    userId?: string;
  };

  type v1FileInfo = {
    id?: string;
    filename?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
    isPublic?: boolean;
    ownerType?: v1OwnerType;
    size?: string;
    contentType?: string;
    extension?: string;
    md5?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1Gender =
    | "GENDER_UNSPECIFIED"
    | "GENDER_MALE"
    | "GENDER_FEMALE"
    | "GENDER_OTHER"
    | "GENDER_UNKNOWN";

  type v1GenerateCDNURLResponse = {
    url?: string;
    expiresAt?: string;
  };

  type v1GenerateDownloadURLResponse = {
    downloadUrl?: string;
    expiresAt?: string;
  };

  type v1GenerateProcessURLResponse = {
    url?: string;
    expiresAt?: string;
  };

  type v1GenerateUploadURLRequest = {
    filename?: string;
    size?: string;
    md5?: string;
    contentType?: string;
    bucket?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
    vendor?: v1Vendor;
    visibility?: v1Visibility;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1GenerateUploadURLResponse = {
    instant?: boolean;
    fileId?: string;
    fileInfo?: v1FileInfo;
    uploadToken?: string;
    uploadUrl?: string;
    objectKey?: string;
    headers?: Record<string, any>;
  };

  type v1GetAppResponse = {
    app?: v1App;
    tokens?: v1IngestTokenInfo[];
    signingKeys?: v1TelemetrySigningKeyInfo[];
    rules?: v1EventRule[];
    versions?: v1VersionInfo[];
  };

  type v1GetAppStatsResponse = {
    days?: v1DailyStat[];
    drops?: Record<string, any>;
    sigFails?: Record<string, any>;
  };

  type v1GetFileLinkDownloadResponse = {
    /** expired = true: render an "attachment expired" page, download_url empty. */
    expired?: boolean;
    filename?: string;
    sizeBytes?: string;
    /** freshly presigned short-TTL URL */
    downloadUrl?: string;
    /** unix seconds, 0 = permanent */
    retainUntil?: string;
  };

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

  type v1GetSTSCredentialRequest = {
    bucket?: string;
    maxSize?: string;
    filename?: string;
    md5?: string;
    contentType?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
    vendor?: v1Vendor;
    ttl?: string;
    allowedExtensions?: string[];
    visibility?: v1Visibility;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1GetSTSCredentialResponse = {
    instant?: boolean;
    fileId?: string;
    fileInfo?: v1FileInfo;
    uploadToken?: string;
    accessKey?: string;
    secretKey?: string;
    securityToken?: string;
    endpoint?: string;
    bucket?: string;
    objectKey?: string;
    expiresAt?: string;
  };

  type v1GrantModuleResponse = {
    entitlement?: v1EntitlementInfo;
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

  type v1HealthChecks = {
    db?: boolean;
    signing?: boolean;
  };

  type v1HealthResponse = {
    status?: string;
    checks?: v1HealthChecks;
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

  type v1ImageFormat =
    | "IMAGE_FORMAT_UNSPECIFIED"
    | "IMAGE_FORMAT_JPG"
    | "IMAGE_FORMAT_PNG"
    | "IMAGE_FORMAT_WEBP"
    | "IMAGE_FORMAT_GIF"
    | "IMAGE_FORMAT_BMP"
    | "IMAGE_FORMAT_HEIC"
    | "IMAGE_FORMAT_AVIF";

  type v1ImageProcessOp = {
    type?: v1ImageProcessType;
    width?: number;
    height?: number;
    format?: v1ImageFormat;
    quality?: number;
    resizeMode?: v1ImageResizeMode;
    watermarkText?: string;
    rotateDegrees?: number;
  };

  type v1ImageProcessType =
    | "IMAGE_PROCESS_TYPE_UNSPECIFIED"
    | "IMAGE_PROCESS_TYPE_RESIZE"
    | "IMAGE_PROCESS_TYPE_CROP"
    | "IMAGE_PROCESS_TYPE_QUALITY"
    | "IMAGE_PROCESS_TYPE_FORMAT"
    | "IMAGE_PROCESS_TYPE_WATERMARK"
    | "IMAGE_PROCESS_TYPE_ROTATE";

  type v1ImageResizeMode =
    | "IMAGE_RESIZE_MODE_UNSPECIFIED"
    | "IMAGE_RESIZE_MODE_FIT"
    | "IMAGE_RESIZE_MODE_FILL"
    | "IMAGE_RESIZE_MODE_PAD";

  type v1IngestRequest = {
    token?: string;
    body?: string;
    signature?: string;
  };

  type v1IngestResponse = {
    httpCode?: number;
    errorCode?: string;
    duplicate?: boolean;
    accepted?: number;
    dropped?: number;
    drops?: Record<string, any>;
  };

  type v1IngestTokenInfo = {
    prefix?: string;
    revoked?: boolean;
    createdAt?: string;
    lastUsedAt?: string;
  };

  type v1IssueSessionCodeRequest = {
    sessionId?: string;
  };

  type v1IssueSessionCodeResponse = {
    code?: string;
  };

  type v1ItemError = {
    index?: number;
    code?: string;
    message?: string;
  };

  type v1KeyInfo = {
    licenseId?: string;
    keyPrefix?: string;
    label?: string;
    maxSlots?: number;
    usedSlots?: number;
    status?: v1KeyStatus;
    createdAt?: string;
    revokedAt?: string;
    entitlements?: v1EntitlementInfo[];
    devices?: v1DeviceSlotInfo[];
  };

  type v1KeyStatus =
    | "KEY_STATUS_UNSPECIFIED"
    | "KEY_STATUS_ACTIVE"
    | "KEY_STATUS_REVOKED";

  type v1KickDeviceResponse = {
    kicked?: boolean;
  };

  type v1ListEmailsByCursorResponse = {
    records?: v1EmailRecord[];
    total?: number;
    nextPageToken?: string;
  };

  type v1ListEmailSendersResponse = {
    senderIds?: string[];
  };

  type v1ListEmailsResponse = {
    records?: v1EmailRecord[];
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
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

  type v1ListKeyDevicesResponse = {
    devices?: v1DeviceSlotInfo[];
  };

  type v1ListKeysResponse = {
    keys?: v1KeyInfo[];
  };

  type v1ListMyAuditLogsResponse = {
    logs?: v1AuditLogEntry[];
    totalCount?: number;
    nextPageToken?: string;
  };

  type v1ListMyFilesPagedResponse = {
    files?: v1FileInfo[];
    totalCount?: string;
    page?: number;
    totalPages?: number;
    hasMore?: boolean;
  };

  type v1ListMyFilesResponse = {
    files?: v1FileInfo[];
    nextPageToken?: string;
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
    nextCursor?: string;
  };

  type v1ListSMSByCursorResponse = {
    records?: v1SMSRecord[];
    total?: number;
    nextPageToken?: string;
  };

  type v1ListSMSRegionsResponse = {
    regionCodes?: string[];
  };

  type v1ListSMSResponse = {
    records?: v1SMSRecord[];
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
  };

  type v1ListSMSSendersResponse = {
    senderIds?: string[];
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
    method?: v1LoginMethod;
    /** Denormalized at read time for list views; empty when user_id no longer
resolves (see user.v1). */
    username?: string;
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

  type v1MessageStatus =
    | "MESSAGE_STATUS_UNSPECIFIED"
    | "MESSAGE_STATUS_PENDING"
    | "MESSAGE_STATUS_SENT"
    | "MESSAGE_STATUS_FAILED";

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

  type v1Module = "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";

  type v1MyQuota = {
    totalBytes?: string;
    usedBytes?: string;
    availableBytes?: string;
    fileCount?: number;
  };

  type v1NextIDResponse = {
    id?: string;
  };

  type v1OwnerStats = {
    ownerType?: v1OwnerType;
    fileCount?: string;
    totalBytes?: string;
  };

  type v1OwnerType =
    | "OWNER_TYPE_UNSPECIFIED"
    | "OWNER_TYPE_USER"
    | "OWNER_TYPE_SYSTEM"
    | "OWNER_TYPE_GROUP"
    | "OWNER_TYPE_BUSINESS"
    | "OWNER_TYPE_SERVICE";

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
    /** service name, e.g. "user-service" */
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

  type v1ProviderInfo = {
    name?: string;
    vendor?: v1Vendor;
    endpoint?: string;
    region?: string;
  };

  type v1ProviderStats = {
    provider?: string;
    objectCount?: string;
    totalBytes?: string;
  };

  type v1QuotaInfo = {
    totalBytes?: string;
    usedBytes?: string;
    availableBytes?: string;
    fileCount?: number;
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
    gender?: v1Gender;
    timezone?: string;
    locale?: string;
  };

  type v1ReplaceEventRulesResponse = {
    rules?: v1EventRule[];
  };

  type v1ResetPasswordRequest = {
    email?: string;
    code?: string;
    newPassword?: string;
    regionCode?: string;
    phone?: string;
  };

  type v1ResetTrialResponse = {
    reset?: boolean;
  };

  type v1RevokeKeyResponse = {
    key?: v1KeyInfo;
  };

  type v1RevokeModuleResponse = true;

  type v1RevokeSigningKeyResponse = true;

  type v1RevokeTokenResponse = true;

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

  type v1RotateTokenResponse = {
    token?: string;
  };

  type v1SendEmailRequest = {
    to?: v1EmailAddress[];
    cc?: v1EmailAddress[];
    bcc?: v1EmailAddress[];
    subject?: string;
    body?: string;
    htmlBody?: string;
    replyTo?: v1EmailAddress;
    vendor?: v1EmailVendor;
    account?: string;
    templateId?: string;
    templateParams?: Record<string, any>;
    scene?: v1EmailScene;
    /** sender_id NOT exposed — BFF fills from cfg.Message.SenderID (decision 1). */
    idempotencyKey?: string;
    from?: v1EmailAddress;
    attachments?: v1EmailAttachment[];
  };

  type v1SendResponse = {
    id?: string;
    status?: v1MessageStatus;
    emailVendor?: v1EmailVendor;
    smsVendor?: v1SmsVendor;
  };

  type v1SendSMSRequest = {
    regionCode?: string;
    phone?: string;
    content?: string;
    templateId?: string;
    templateParams?: Record<string, any>;
    vendor?: v1SmsVendor;
    account?: string;
    scene?: v1SmsScene;
    /** sender_id NOT exposed — BFF fills from cfg.Message.SenderID (decision 1). */
    idempotencyKey?: string;
    signName?: string;
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
    /** ---- Delivery templates (mirror user-service SendVerificationCodeRequest
1:1 — field numbers match). Required per channel by user-service's
validateDeliverySpec: EMAIL needs email_subject + email_body ({code}
placeholder substituted by user-service); SMS+CN needs sms_template_id +
sign_name (domestic vendors reject raw content); SMS international needs
exactly one of sms_template_id / sms_content. */
    smsTemplateId?: string;
    smsCodeParamKey?: string;
    smsContent?: string;
    emailSubject?: string;
    emailBody?: string;
    signName?: string;
    emailHtmlBody?: string;
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
    status?: v1SessionStatus;
  };

  type v1SessionStatus =
    | "SESSION_STATUS_UNSPECIFIED"
    | "SESSION_STATUS_ACTIVE"
    | "SESSION_STATUS_REVOKED"
    | "SESSION_STATUS_EXPIRED";

  type v1SetVersionBlockedResponse = true;

  type v1ShowKeyResponse = {
    key?: v1KeyInfo;
  };

  type v1ShowPubKeyResponse = {
    activeKeyId?: string;
    keys?: v1SigningKeyInfo[];
  };

  type v1ShowTrialResponse = {
    trials?: v1TrialInfo[];
  };

  type v1SigningKeyInfo = {
    keyId?: string;
    publicKeyB64?: string;
  };

  type v1SlotSummary = {
    used?: number;
    max?: number;
    devices?: v1DeviceSlotInfo[];
  };

  type v1SMSRecord = {
    id?: string;
    vendor?: v1SmsVendor;
    account?: string;
    scene?: v1SmsScene;
    status?: v1MessageStatus;
    regionCode?: string;
    phone?: string;
    senderId?: string;
    content?: string;
    templateId?: string;
    templateParams?: Record<string, any>;
    errorMessage?: string;
    attempts?: number;
    sentAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1SmsScene =
    | "SMS_SCENE_UNSPECIFIED"
    | "SMS_SCENE_LOGIN_CODE"
    | "SMS_SCENE_FORGOT_PASSWORD"
    | "SMS_SCENE_REGISTER"
    | "SMS_SCENE_CHANGE_PASSWORD"
    | "SMS_SCENE_BIND_ACCOUNT"
    | "SMS_SCENE_VERIFY_PHONE";

  type v1SMSStats = {
    total?: string;
    sent?: string;
    failed?: string;
    successRate?: number;
    vendors?: v1SmsVendorStats[];
  };

  type v1SMSStatsResponse = {
    total?: string;
    sent?: string;
    failed?: string;
    successRate?: number;
    vendors?: v1SmsVendorStats[];
  };

  type v1SmsVendor =
    | "SMS_VENDOR_UNSPECIFIED"
    | "SMS_VENDOR_ALIYUN"
    | "SMS_VENDOR_TENCENT"
    | "SMS_VENDOR_VOLCENGINE"
    | "SMS_VENDOR_BYTEPLUS"
    | "SMS_VENDOR_HUAWEI";

  type v1SmsVendorStats = {
    vendor?: v1SmsVendor;
    total?: string;
    sent?: string;
    failed?: string;
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
    sessionId?: string;
  };

  type v1SortDirection =
    | "SORT_DIRECTION_UNSPECIFIED"
    | "SORT_DIRECTION_ASC"
    | "SORT_DIRECTION_DESC";

  type v1SortField =
    | "SORT_FIELD_UNSPECIFIED"
    | "SORT_FIELD_CREATED_AT"
    | "SORT_FIELD_FILENAME"
    | "SORT_FIELD_SIZE";

  type v1TelemetrySigningKeyInfo = {
    keyId?: string;
    revoked?: boolean;
    createdAt?: string;
    lastUsedAt?: string;
  };

  type v1TokenResponse = {
    token?: string;
    user?: v1User;
    /** session_id mirrors downstream Login/Register/SocialLogin responses so
testers can target a specific session (RevokeSession / GetSession)
without decoding the JWT. */
    sessionId?: string;
    /** is_new: this login auto-registered the account (code-login/OAuth paths). */
    isNew?: boolean;
    /** return_to: business URL recorded at GetOAuthURL time (OAuth flows only;
empty for password/code logins). */
    returnTo?: string;
  };

  type v1TrialInfo = {
    fingerprintId?: string;
    module?: v1Module;
    startedAt?: string;
    expiresAt?: string;
    firstDeviceToken?: string;
  };

  type v1TrialStartRequest = {
    module?: string;
    fingerprintId?: string;
    deviceToken?: string;
    licenseKey?: string;
  };

  type v1TrialStartResponse = {
    payload?: string;
    signature?: string;
    alreadyStarted?: boolean;
  };

  type v1UnrevokeKeyResponse = {
    key?: v1KeyInfo;
  };

  type v1UpdateAppResponse = {
    app?: v1App;
  };

  type v1UpdateKeyResponse = {
    key?: v1KeyInfo;
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

  type v1UploadCredentialItem = {
    token?: v1UploadTokenInfo;
    error?: v1ItemError;
  };

  type v1UploadFileMeta = {
    md5?: string;
    size?: string;
    filename?: string;
    contentType?: string;
    filePath?: string;
    description?: string;
    metadata?: Record<string, any>;
  };

  type v1UploadTokenInfo = {
    uploadToken?: string;
    expiresAt?: string;
    /** non-zero when MD5 dedup hit (instant upload) */
    fileId?: string;
    objectKey?: string;
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

  type v1UsersSummary = {
    total?: string;
  };

  type v1UserStatus =
    | "USER_STATUS_UNSPECIFIED"
    | "USER_STATUS_ACTIVE"
    | "USER_STATUS_DISABLED"
    | "USER_STATUS_PENDING_REVIEW";

  type v1UserType =
    | "USER_TYPE_UNSPECIFIED"
    | "USER_TYPE_NORMAL"
    | "USER_TYPE_INTERNAL";

  type v1Vendor =
    | "VENDOR_UNSPECIFIED"
    | "VENDOR_ALIYUN_OSS"
    | "VENDOR_AWS_S3"
    | "VENDOR_S3_COMPATIBLE"
    | "VENDOR_TENCENT_COS"
    | "VENDOR_HUAWEI_OBS"
    | "VENDOR_VOLCENGINE_TOS";

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

  type v1VersionInfo = {
    version?: string;
    blocked?: boolean;
    seenCount?: string;
    lastSeenAt?: string;
  };

  type v1Visibility =
    | "VISIBILITY_UNSPECIFIED"
    | "VISIBILITY_PUBLIC"
    | "VISIBILITY_PRIVATE";
}
