declare namespace API {
  type AddGroupMemberParams = {
    /** path */
    groupId: string;
  };

  type AddGroupRoleParams = {
    /** path */
    groupId: string;
  };

  type AdminDeleteAppParams = {
    appKey: string;
  };

  type AdminDeleteBucketParams = {
    name: string;
  };

  type AdminDeleteFileParams = {
    fileId: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type AdminDeleteProviderParams = {
    name: string;
  };

  type AdminGetAppParams = {
    appKey: string;
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
      | "AUDIT_ACTION_UPLOAD_SESSION_GC"
      | "AUDIT_ACTION_ADMIN_CREATE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_UPDATE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_DELETE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_UPSERT_BUCKET"
      | "AUDIT_ACTION_ADMIN_DELETE_BUCKET"
      | "AUDIT_ACTION_ADMIN_UPDATE_SETTINGS"
      | "AUDIT_ACTION_ADMIN_CREATE_APP"
      | "AUDIT_ACTION_ADMIN_UPDATE_APP"
      | "AUDIT_ACTION_ADMIN_DELETE_APP"
      | "AUDIT_ACTION_ADMIN_ROTATE_APP_SECRET";
    targetType?:
      | "AUDIT_LOG_TARGET_TYPE_UNSPECIFIED"
      | "AUDIT_LOG_TARGET_TYPE_FILE"
      | "AUDIT_LOG_TARGET_TYPE_QUOTA"
      | "AUDIT_LOG_TARGET_TYPE_OWNER"
      | "AUDIT_LOG_TARGET_TYPE_PROVIDER"
      | "AUDIT_LOG_TARGET_TYPE_BUCKET"
      | "AUDIT_LOG_TARGET_TYPE_SETTINGS"
      | "AUDIT_LOG_TARGET_TYPE_APP";
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

  type AdminRotateAppSecretParams = {
    appKey: string;
  };

  type AdminUpdateAppParams = {
    appKey: string;
  };

  type AdminUpdateProviderParams = {
    name: string;
  };

  type AdminUpsertBucketParams = {
    name: string;
  };

  type AssignRoleParams = {
    /** target user (path) */
    userId: string;
  };

  type CreateFileLinkParams = {
    fileId: string;
  };

  type CreateSigningKeyParams = {
    appKey: string;
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
    appKey: string;
  };

  type GetAppStatsParams = {
    appKey: string;
    days?: number;
  };

  type GetCountriesParams = {
    regionCodes?: string[];
    locale?: string;
  };

  type GetCountryDefaultsParams = {
    regionCode: string;
    locale?: string;
  };

  type GetCountryProfileParams = {
    regionCode: string;
    locale?: string;
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
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address.
 - EMAIL_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL"
      | "EMAIL_SCENE_TEST";
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
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number.
 - SMS_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE"
      | "SMS_SCENE_TEST";
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

  type LicenseDeleteAppParams = {
    appKey: string;
  };

  type LicenseGetAppParams = {
    appKey: string;
  };

  type LicenseRotateAppSecretParams = {
    appKey: string;
  };

  type LicenseUpdateAppParams = {
    appKey: string;
  };

  type licenseV1CreateAppRequest = {
    /** app_key pattern: lowercase letter followed by lowercase alphanumerics
and dashes. Optional; empty = server-generated. */
    appKey?: string;
    name?: string;
  };

  type licenseV1CreateAppResponse = {
    app?: v1LicenseAppInfo;
    /** app_secret convenience echo (also visible via ListApps/GetApp). */
    appSecret?: string;
  };

  type licenseV1GetAppResponse = {
    app?: v1LicenseAppInfo;
  };

  type licenseV1ListAppsResponse = {
    apps?: v1LicenseAppInfo[];
  };

  type licenseV1RotateAppSecretResponse = {
    app?: v1LicenseAppInfo;
    /** app_secret convenience echo (also visible via ListApps/GetApp). */
    appSecret?: string;
  };

  type licenseV1UpdateAppResponse = {
    app?: v1LicenseAppInfo;
  };

  type ListCountriesByRegionParams = {
    groupCode: string;
    locale?: string;
  };

  type ListCountriesParams = {
    locale?: string;
  };

  type ListCurrenciesParams = {
    locale?: string;
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
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address.
 - EMAIL_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL"
      | "EMAIL_SCENE_TEST";
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
    /** app_key filter (mirror of message-service ListEmailsByCursorRequest.app_key). */
    appKey?: string;
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
 - EMAIL_SCENE_VERIFY_EMAIL: Verify ownership of an email address.
 - EMAIL_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "EMAIL_SCENE_UNSPECIFIED"
      | "EMAIL_SCENE_LOGIN_CODE"
      | "EMAIL_SCENE_FORGOT_PASSWORD"
      | "EMAIL_SCENE_REGISTER"
      | "EMAIL_SCENE_CHANGE_PASSWORD"
      | "EMAIL_SCENE_BIND_ACCOUNT"
      | "EMAIL_SCENE_NOTIFICATION"
      | "EMAIL_SCENE_VERIFY_EMAIL"
      | "EMAIL_SCENE_TEST";
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
    /** app_key filters by the calling app recorded on each record (mirror of
message-service ListEmailsRequest.app_key). */
    appKey?: string;
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

  type ListLanguagesParams = {
    locale?: string;
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
      | "AUDIT_ACTION_UPLOAD_SESSION_GC"
      | "AUDIT_ACTION_ADMIN_CREATE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_UPDATE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_DELETE_PROVIDER"
      | "AUDIT_ACTION_ADMIN_UPSERT_BUCKET"
      | "AUDIT_ACTION_ADMIN_DELETE_BUCKET"
      | "AUDIT_ACTION_ADMIN_UPDATE_SETTINGS"
      | "AUDIT_ACTION_ADMIN_CREATE_APP"
      | "AUDIT_ACTION_ADMIN_UPDATE_APP"
      | "AUDIT_ACTION_ADMIN_DELETE_APP"
      | "AUDIT_ACTION_ADMIN_ROTATE_APP_SECRET";
    targetType?:
      | "AUDIT_LOG_TARGET_TYPE_UNSPECIFIED"
      | "AUDIT_LOG_TARGET_TYPE_FILE"
      | "AUDIT_LOG_TARGET_TYPE_QUOTA"
      | "AUDIT_LOG_TARGET_TYPE_OWNER"
      | "AUDIT_LOG_TARGET_TYPE_PROVIDER"
      | "AUDIT_LOG_TARGET_TYPE_BUCKET"
      | "AUDIT_LOG_TARGET_TYPE_SETTINGS"
      | "AUDIT_LOG_TARGET_TYPE_APP";
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

  type ListPoliciesParams = {
    /** app_id 0 = all apps. */
    appId?: string;
    channel?:
      | "TEMPLATE_CHANNEL_UNSPECIFIED"
      | "TEMPLATE_CHANNEL_EMAIL"
      | "TEMPLATE_CHANNEL_SMS";
  };

  type ListRegionGroupsParams = {
    locale?: string;
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
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number.
 - SMS_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE"
      | "SMS_SCENE_TEST";
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
    /** app_key filter (mirror of message-service ListSMSByCursorRequest.app_key). */
    appKey?: string;
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
 - SMS_SCENE_VERIFY_PHONE: Verify ownership of a phone number.
 - SMS_SCENE_TEST: Ops-console test send (message admin UI). */
    scene?:
      | "SMS_SCENE_UNSPECIFIED"
      | "SMS_SCENE_LOGIN_CODE"
      | "SMS_SCENE_FORGOT_PASSWORD"
      | "SMS_SCENE_REGISTER"
      | "SMS_SCENE_CHANGE_PASSWORD"
      | "SMS_SCENE_BIND_ACCOUNT"
      | "SMS_SCENE_VERIFY_PHONE"
      | "SMS_SCENE_TEST";
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
    /** app_key filter (mirror of message-service ListSMSRequest.app_key). */
    appKey?: string;
  };

  type ListTimezonesParams = {
    locale?: string;
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

  type MessageDeleteAppParams = {
    id: string;
  };

  type MessageDeleteChannelAccountParams = {
    id: string;
  };

  type MessageDeletePolicyParams = {
    id: string;
  };

  type MessageDeleteSignatureParams = {
    id: string;
  };

  type MessageDeleteTemplateParams = {
    id: string;
  };

  type MessageGetAppParams = {
    id: string;
  };

  type MessageListTemplatesParams = {
    /** app_id 0 = all templates (shared + every app's). */
    appId?: string;
    channel?:
      | "TEMPLATE_CHANNEL_UNSPECIFIED"
      | "TEMPLATE_CHANNEL_EMAIL"
      | "TEMPLATE_CHANNEL_SMS";
  };

  type MessageRotateAppSecretParams = {
    id: string;
  };

  type MessageUpdateAppParams = {
    id: string;
  };

  type MessageUpdateChannelAccountParams = {
    id: string;
  };

  type MessageUpdatePolicyParams = {
    id: string;
  };

  type MessageUpdateSignatureParams = {
    id: string;
  };

  type MessageUpdateTemplateParams = {
    id: string;
  };

  type messagingV1CreateAppRequest = {
    /** app_key optionally carries a caller-chosen slug (e.g. "testkit").
Empty = the server generates one ("app_" + 8 random chars). Unique and
immutable after creation either way. */
    appKey?: string;
    name?: string;
    smsDailyLimit?: string;
    emailDailyLimit?: string;
  };

  type messagingV1CreateAppResponse = {
    app?: v1MessageAppInfo;
    appSecret?: string;
  };

  type messagingV1GetAppResponse = {
    app?: v1MessageAppInfo;
  };

  type messagingV1ListAppsResponse = {
    apps?: v1MessageAppInfo[];
  };

  type messagingV1RotateAppSecretResponse = {
    app?: v1MessageAppInfo;
    appSecret?: string;
  };

  type messagingV1UpdateAppResponse = {
    app?: v1MessageAppInfo;
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
    appKey: string;
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
    appKey: string;
    keyId: string;
  };

  type RevokeTokenParams = {
    appKey: string;
    prefix: string;
  };

  type RotateAppSecretParams = {
    appKey: string;
  };

  type RotateTokenParams = {
    appKey: string;
  };

  type rpcStatus = {
    code?: number;
    message?: string;
    details?: protobufAny[];
  };

  type SetVersionBlockedParams = {
    appKey: string;
    version: string;
  };

  type ShowKeyParams = {
    keyId: string;
  };

  type ShowTrialParams = {
    fingerprintId: string;
    module?: "MODULE_UNSPECIFIED" | "MODULE_DOWNLOADS" | "MODULE_TOOLS";
  };

  type storageV1BucketInfo = {
    name?: string;
    provider?: string;
    acl?: v1BucketACL;
    vendor?: v1Vendor;
    cdn?: v1CDNConfig;
  };

  type storageV1ProviderInfo = {
    name?: string;
    vendor?: v1Vendor;
    endpoint?: string;
    region?: string;
    /** disabled providers are skipped for new uploads (existing objects stay
readable through their buckets... until the provider is deleted). */
    disabled?: boolean;
    /** sts_enabled reports whether role_arn is configured (STS credentials
available for direct browser uploads). */
    stsEnabled?: boolean;
    /** bucket_count is the number of buckets bound to this provider. */
    bucketCount?: number;
  };

  type telemetryV1App = {
    /** uuid */
    id?: string;
    /** app_key is the machine identity and the "ak" half of the platform-wide
ak/sk pair: minted server-side on creation ("tel_" + 8 base36 chars,
collision-checked; a caller-chosen key is accepted when non-empty),
unique, immutable. The admin surface keys every per-app route by it. */
    appKey?: string;
    name?: string;
    /** optional operator contact */
    email?: string;
    /** drop unknown versions instead of auto-registering */
    strictVersions?: boolean;
    authMode?: v1AuthMode;
    /** while set+future: hmac apps still accept unsigned batches */
    authGraceUntil?: string;
    /** per device */
    ratePerMinute?: number;
    /** per device */
    ratePerDay?: number;
    /** events_raw TTL (≥ partition horizon) */
    rawRetentionDays?: number;
    /** Per-app daily ingestion budget (events/day, attempts counted). Exceeding
it drops the batch's events silently with a 204 and fires the
app_budget_exceeded metric — the bounded-garbage abuse backstop that
per-device limits cannot provide (spec §4.6 #1). */
    dailyEventBudget?: string;
    /** Disabled apps fail every ingest call immediately (401) — the operator
kill-switch; tokens and signing keys stay in place for re-enable. */
    disabled?: boolean;
    /** app_secret is the business-identity credential (the "sk" half of the
platform-wide ak/sk pair; app_key is the "ak"). Required by the
gRPC/module ingest surface — backend callers present it as x-app-key /
x-app-secret metadata; the raw client endpoints (/v1/e/…) keep using
the ingest token instead. Echoed on every read — internal-trust
posture, same convention as the messaging/storage/license apps. */
    appSecret?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type telemetryV1ListAppsResponse = {
    apps?: telemetryV1App[];
  };

  type telemetryV1RotateAppSecretResponse = {
    app?: telemetryV1App;
    /** app_secret convenience echo (also visible via ListApps/GetApp). */
    appSecret?: string;
  };

  type TestkitServiceAddGroupMemberBody = {
    /** target member (kept) */
    userId?: string;
    role?: string;
  };

  type TestkitServiceAddGroupRoleBody = {
    roleId?: string;
  };

  type TestkitServiceAdminRotateAppSecretBody = true;

  type TestkitServiceAdminUpdateAppBody = {
    name?: string;
    disabled?: boolean;
    /** bucket_id 0 rebinds the app to the default bucket. */
    bucketId?: string;
  };

  type TestkitServiceAdminUpdateProviderBody = {
    endpoint?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    /** role_arn is replace-on-present: explicitly sending an empty value
disables STS. */
    roleArn?: string;
    domainId?: string;
    disabled?: boolean;
  };

  type TestkitServiceAdminUpsertBucketBody = {
    provider?: string;
    acl?: v1BucketACL;
    cdn?: v1CDNConfig;
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

  type TestkitServiceLicenseRotateAppSecretBody = true;

  type TestkitServiceLicenseUpdateAppBody = {
    name?: string;
    disabled?: boolean;
  };

  type TestkitServiceMessageRotateAppSecretBody = true;

  type TestkitServiceMessageUpdateAppBody = {
    name?: string;
    disabled?: boolean;
    smsDailyLimit?: string;
    emailDailyLimit?: string;
  };

  type TestkitServiceMessageUpdateChannelAccountBody = {
    remark?: string;
    disabled?: boolean;
    credentials?: v1ChannelAccountCredentials;
  };

  type TestkitServiceMessageUpdatePolicyBody = {
    disabled?: boolean;
    templateId?: string;
    /** routes replaces the CN/email chain (required, non-empty). */
    routes?: v1RouteRule[];
    /** intl_routes replaces the intl chain (required field for SMS policies —
send an empty list to disable intl; ignored for email). */
    intlRoutes?: v1RouteRule[];
  };

  type TestkitServiceMessageUpdateSignatureBody = {
    remark?: string;
    disabled?: boolean;
    accountIds?: v1AccountIds;
  };

  type TestkitServiceMessageUpdateTemplateBody = {
    template?: v1TemplateInfo;
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

  type TestkitServiceRotateAppSecretBody = true;

  type TestkitServiceRotateTokenBody = true;

  type TestkitServiceSetVersionBlockedBody = {
    blocked?: boolean;
  };

  type TestkitServiceUnbindIdentityBody = {
    /** Empty for OAuth identities (session is the proof).

user_id injected from ctx */
    code?: string;
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
    disabled?: boolean;
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

  type testkitV1App = {
    id?: string;
    appKey?: string;
    name?: string;
    email?: string;
    strictVersions?: boolean;
    authMode?: v1AuthMode;
    authGraceUntil?: string;
    ratePerMinute?: number;
    ratePerDay?: number;
    rawRetentionDays?: number;
    dailyEventBudget?: string;
    disabled?: boolean;
    appSecret?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type testkitV1BucketInfo = {
    name?: string;
    provider?: string;
    acl?: v1BucketACL;
    vendor?: v1Vendor;
    cdn?: v1CDNConfig;
  };

  type testkitV1CreateAppRequest = {
    /** app_key optional; empty = server-generated. */
    appKey?: string;
    name?: string;
    email?: string;
  };

  type testkitV1CreateAppResponse = {
    app?: testkitV1App;
    token?: string;
  };

  type testkitV1GetAppResponse = {
    app?: testkitV1App;
    tokens?: v1IngestTokenInfo[];
    signingKeys?: v1TelemetrySigningKeyInfo[];
    rules?: v1EventRule[];
    versions?: v1VersionInfo[];
  };

  type testkitV1ProviderInfo = {
    name?: string;
    vendor?: v1Vendor;
    endpoint?: string;
    region?: string;
    disabled?: boolean;
    stsEnabled?: boolean;
    bucketCount?: number;
  };

  type testkitV1UpdateAppResponse = {
    app?: testkitV1App;
  };

  type UnbindIdentityParams = {
    /** target identity */
    identityId: string;
  };

  type UnrevokeKeyParams = {
    keyId: string;
  };

  type UpdateAppParams = {
    appKey: string;
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

  type v1AccountIds = {
    ids?: string[];
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

  type v1AdminCreateAppRequest = {
    /** app_key pattern: lowercase letter followed by lowercase alphanumerics
and dashes. Optional; empty = server-generated. */
    appKey?: string;
    name?: string;
    /** key_prefix namespaces the app's objects; globally unique, immutable,
must end with '/'. */
    keyPrefix?: string;
    /** bucket_id: 0 = the platform default bucket. */
    bucketId?: string;
  };

  type v1AdminCreateAppResponse = {
    app?: v1StorageAppInfo;
    /** app_secret convenience echo (also visible via AdminListApps/GetApp). */
    appSecret?: string;
  };

  type v1AdminCreateProviderRequest = {
    /** name uniquely identifies the provider (referenced by buckets).
Immutable after creation. */
    name?: string;
    vendor?: v1Vendor;
    endpoint?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    /** role_arn enables STS (GetSTSCredential) for this provider; empty =
STS unavailable. */
    roleArn?: string;
    /** domain_id is the Huawei Cloud account UID; required for
VENDOR_HUAWEI_OBS, unused otherwise. */
    domainId?: string;
  };

  type v1AdminCreateProviderResponse = {
    provider?: storageV1ProviderInfo;
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

  type v1AdminGetAppResponse = {
    app?: v1StorageAppInfo;
  };

  type v1AdminGetSettingsResponse = {
    settings?: v1StorageSettings;
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

  type v1AdminListAppsResponse = {
    apps?: v1StorageAppInfo[];
  };

  type v1AdminListAuditLogsResponse = {
    logs?: v1AuditLogEntry[];
    totalCount?: number;
    nextPageToken?: string;
  };

  type v1AdminListBucketsResponse = {
    buckets?: testkitV1BucketInfo[];
  };

  type v1AdminListFilesResponse = {
    files?: v1AdminFileInfo[];
    totalCount?: number;
    nextPageToken?: string;
  };

  type v1AdminListProvidersResponse = {
    providers?: testkitV1ProviderInfo[];
  };

  type v1AdminRotateAppSecretResponse = {
    app?: v1StorageAppInfo;
    /** app_secret convenience echo (also visible via AdminListApps/GetApp). */
    appSecret?: string;
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

  type v1AdminUpdateAppResponse = {
    app?: v1StorageAppInfo;
  };

  type v1AdminUpdateProviderResponse = {
    provider?: storageV1ProviderInfo;
  };

  type v1AdminUpdateSettingsRequest = {
    defaultBucket?: string;
    /** public_bucket may be explicitly set to "" to reject PUBLIC uploads. */
    publicBucket?: string;
  };

  type v1AdminUpdateSettingsResponse = {
    settings?: v1StorageSettings;
  };

  type v1AdminUpsertBucketResponse = {
    bucket?: storageV1BucketInfo;
  };

  type v1AliyunSmsCredentials = {
    accessKeyId?: string;
    accessKeySecret?: string;
    /** region_id defaults to "cn-hangzhou" server-side when empty. */
    regionId?: string;
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
    | "AUDIT_ACTION_UPLOAD_SESSION_GC"
    | "AUDIT_ACTION_ADMIN_CREATE_PROVIDER"
    | "AUDIT_ACTION_ADMIN_UPDATE_PROVIDER"
    | "AUDIT_ACTION_ADMIN_DELETE_PROVIDER"
    | "AUDIT_ACTION_ADMIN_UPSERT_BUCKET"
    | "AUDIT_ACTION_ADMIN_DELETE_BUCKET"
    | "AUDIT_ACTION_ADMIN_UPDATE_SETTINGS"
    | "AUDIT_ACTION_ADMIN_CREATE_APP"
    | "AUDIT_ACTION_ADMIN_UPDATE_APP"
    | "AUDIT_ACTION_ADMIN_DELETE_APP"
    | "AUDIT_ACTION_ADMIN_ROTATE_APP_SECRET";

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
    | "AUDIT_LOG_TARGET_TYPE_OWNER"
    | "AUDIT_LOG_TARGET_TYPE_PROVIDER"
    | "AUDIT_LOG_TARGET_TYPE_BUCKET"
    | "AUDIT_LOG_TARGET_TYPE_SETTINGS"
    | "AUDIT_LOG_TARGET_TYPE_APP";

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
    dialCode?: string;
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

  type v1BucketStats = {
    bucket?: string;
    objectCount?: string;
    totalBytes?: string;
    fileCount?: string;
  };

  type v1ByteplusSmsCredentials = {
    accessKey?: string;
    secretKey?: string;
    smsAccount?: string;
    /** region defaults to "ap-singapore-1" server-side when empty. */
    region?: string;
  };

  type v1CancelUploadRequest = {
    uploadToken?: string;
    /** request_id is optional; recorded in audit logs for traceability
(mirror of storage-service *Request.request_id). */
    requestId?: string;
  };

  type v1CDNConfig = {
    domain?: string;
    authKey?: string;
    keyPairId?: string;
  };

  type v1ChangePasswordRequest = {
    oldPassword?: string;
    newPassword?: string;
  };

  type v1ChannelAccountCredentials = {
    aliyunSms?: v1AliyunSmsCredentials;
    tencentSms?: v1TencentSmsCredentials;
    volcengineSms?: v1VolcengineSmsCredentials;
    byteplusSms?: v1ByteplusSmsCredentials;
    huaweiSms?: v1HuaweiSmsCredentials;
    smtp?: v1SmtpEmailCredentials;
  };

  type v1ChannelAccountInfo = {
    id?: string;
    /** name uniquely identifies the account (referenced by policies), e.g.
"aliyun-main". Unique across all vendors. */
    name?: string;
    disabled?: boolean;
    remark?: string;
    smsVendor?: v1SmsVendor;
    emailVendor?: v1EmailVendor;
    credentials?: v1ChannelAccountCredentials;
    createdAt?: string;
    updatedAt?: string;
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

  type v1Country = {
    /** ISO 3166-1 alpha-2, e.g. "CN" */
    regionCode?: string;
    /** alpha-3, e.g. "CHN" */
    alpha3?: string;
    /** ITU E.164 with "+", e.g. "+86" */
    dialCode?: string;
    /** regional-indicator pair, e.g. "🇨🇳" */
    flagEmoji?: string;
    /** display name in the request locale */
    name?: string;
    /** libphonenumber example, e.g. "+86 138 0013 8000"; */
    exampleNumber?: string;
    /** "" when the metadata has none — use as a phone
input placeholder / format hint official languages, most-spoken first */
    languageTags?: string[];
  };

  type v1CreateChannelAccountRequest = {
    /** name uniquely identifies the account across vendors (referenced by
policies). Immutable after creation. */
    name?: string;
    remark?: string;
    credentials?: v1ChannelAccountCredentials;
  };

  type v1CreateChannelAccountResponse = {
    account?: v1ChannelAccountInfo;
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

  type v1CreatePolicyRequest = {
    appId?: string;
    scene?: v1PolicyScene;
    templateId?: string;
    /** routes is the ordered chain for EMAIL and CN-domestic SMS. */
    routes?: v1RouteRule[];
    /** intl_routes is the ordered chain for international SMS. Optional: an
SMS policy with no intl chain rejects non-CN destinations at send time. */
    intlRoutes?: v1RouteRule[];
  };

  type v1CreatePolicyResponse = {
    policy?: v1PolicyInfo;
  };

  type v1CreateRoleRequest = {
    name?: string;
    description?: string;
    permissionIds?: string[];
    permissionGroupIds?: string[];
  };

  type v1CreateSignatureRequest = {
    /** name is the signature string itself (CN, e.g. "XX科技") or the intl
sender ID (e.g. "MyApp"). Unique. Immutable after creation. */
    name?: string;
    remark?: string;
    /** account_ids lists the channel accounts the signature is registered on
(报备). Full replace on every update; at least one binding required. */
    accountIds?: string[];
  };

  type v1CreateSignatureResponse = {
    signature?: v1SignatureInfo;
  };

  type v1CreateSigningKeyResponse = {
    keyId?: string;
    secret?: string;
  };

  type v1CreateTemplateRequest = {
    appId?: string;
    template?: v1TemplateInfo;
  };

  type v1CreateTemplateResponse = {
    template?: v1TemplateInfo;
  };

  type v1CreateUserRequest = {
    userType?: v1UserType;
    username?: string;
    nickname?: string;
    realName?: string;
    email?: string;
    dialCode?: string;
    phone?: string;
    password?: string;
    gender?: v1Gender;
    timezone?: string;
    locale?: string;
  };

  type v1CreateUserResponse = {
    user?: v1User;
  };

  type v1Currency = {
    /** e.g. "CNY" */
    code?: string;
    /** e.g. "¥" */
    symbol?: string;
    /** 0 (JPY) / 2 (CNY) / 3 (BHD) */
    minorUnits?: number;
    /** current official users */
    regionCodes?: string[];
    /** display name in the request locale */
    name?: string;
    /** issuer flag, e.g. "🇨🇳" — derived from the */
    flagEmoji?: string;
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
    /** app_key identifies the calling app (authenticated sender identity). */
    appKey?: string;
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
    | "EMAIL_SCENE_VERIFY_EMAIL"
    | "EMAIL_SCENE_TEST";

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

  type v1EmailTemplateContent = {
    subject?: string;
    textBody?: string;
    htmlBody?: string;
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

  type v1GetAppStatsResponse = {
    days?: v1DailyStat[];
    drops?: Record<string, any>;
    sigFails?: Record<string, any>;
  };

  type v1GetCountriesResponse = {
    /** request order */
    countries?: v1Country[];
    /** unknown alpha-2 codes, request order */
    missingRegions?: string[];
    dataVersion?: string;
  };

  type v1GetCountryDefaultsResponse = {
    /** primary IANA zone, e.g. "Asia/Shanghai" */
    timezoneId?: string;
    /** display name in the request locale */
    timezoneName?: string;
    /** first currently-valid currency, e.g. "CNY" */
    currencyCode?: string;
    currencyName?: string;
    currencySymbol?: string;
    /** most-spoken official language, e.g. "zh-Hans" */
    languageTag?: string;
    languageName?: string;
    /** "+86" */
    dialCode?: string;
    /** "+86 138 0013 8000" */
    exampleNumber?: string;
    dataVersion?: string;
  };

  type v1GetCountryProfileResponse = {
    country?: v1Country;
    /** The country's group chain, continent first then sub-regions
(e.g. Asia -> Eastern Asia). Empty for territories outside the
served hierarchy (e.g. Antarctica sits under the unserved world root). */
    regionGroups?: v1RegionGroup[];
    /** Official (incl. de facto official) languages, most-spoken first
(CLDR territoryInfo); e.g. zh-Hans for CN. */
    languages?: v1Language[];
    /** currently valid in this country */
    currencies?: v1Currency[];
    /** IANA zones covering this country */
    timezones?: v1Timezone[];
    dataVersion?: string;
  };

  type v1GetDataInfoResponse = {
    dataVersion?: string;
    locales?: string[];
    regionCount?: number;
    timezoneCount?: number;
    languageCount?: number;
    currencyCount?: number;
    regionGroupCount?: number;
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
    loginMethod?: v1LoginMethod;
    loginProvider?: v1IdentityProvider;
  };

  type v1GetSTSCredentialRequest = {
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

  type v1HuaweiSmsCredentials = {
    appKey?: string;
    appSecret?: string;
    /** sign is the default signature bound to the Huawei app (Huawei carries
the sign on the account, not per request). */
    sign?: string;
    /** endpoint defaults to
"https://smsapi.cn-north-4.myhuaweicloud.com" server-side when empty. */
    endpoint?: string;
    region?: string;
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

  type v1Language = {
    /** e.g. "zh-Hans" */
    tag?: string;
    /** the language's name in the request locale */
    name?: string;
    /** endonym — the language's own name for itself */
    nativeName?: string;
  };

  type v1LicenseAppInfo = {
    id?: string;
    /** app_key identifies the app on every data-plane call; unique, immutable. */
    appKey?: string;
    /** app_secret is the data-plane credential. Echoed on every read —
internal-trust posture, same convention as the messaging/storage apps;
the ops console is the intended reader. */
    appSecret?: string;
    name?: string;
    /** disabled apps fail every data-plane call immediately. */
    disabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1ListChannelAccountsResponse = {
    accounts?: v1ChannelAccountInfo[];
  };

  type v1ListCountriesByRegionResponse = {
    countries?: v1Country[];
    dataVersion?: string;
  };

  type v1ListCountriesResponse = {
    /** name-sorted in the request locale */
    countries?: v1Country[];
    /** generation stamp, e.g. "2026-09-06" */
    dataVersion?: string;
  };

  type v1ListCurrenciesResponse = {
    currencies?: v1Currency[];
    dataVersion?: string;
  };

  type v1ListEmailsByCursorResponse = {
    records?: v1EmailRecord[];
    total?: number;
    nextPageToken?: string;
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

  type v1ListLanguagesResponse = {
    languages?: v1Language[];
    dataVersion?: string;
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

  type v1ListPoliciesResponse = {
    policies?: v1PolicyInfo[];
  };

  type v1ListRegionCodesResponse = {
    regionCodes?: v1RegionCode[];
  };

  type v1ListRegionGroupsResponse = {
    /** top level first, then depth */
    regionGroups?: v1RegionGroup[];
    dataVersion?: string;
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

  type v1ListSignaturesResponse = {
    signatures?: v1SignatureInfo[];
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

  type v1ListTemplatesResponse = {
    templates?: v1TemplateInfo[];
  };

  type v1ListTimezonesResponse = {
    timezones?: v1Timezone[];
    dataVersion?: string;
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

  type v1LoginFailReason =
    | "LOGIN_FAIL_REASON_UNSPECIFIED"
    | "LOGIN_FAIL_REASON_WRONG_PASSWORD"
    | "LOGIN_FAIL_REASON_WRONG_CODE"
    | "LOGIN_FAIL_REASON_VERIFY_FAILED";

  type v1LoginLog = {
    id?: string;
    userId?: string;
    provider?: v1IdentityProvider;
    action?: v1LoginAction;
    success?: boolean;
    failReason?: v1LoginFailReason;
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
    /** The credential subject of the attempt (see user.v1). */
    target?: string;
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
    dialCode?: string;
    phone?: string;
    /** captcha_id returned by SendVerificationCode; required for code-based login. */
    captchaId?: string;
  };

  type v1MessageAppInfo = {
    id?: string;
    /** app_key is the public credential identifier passed in x-app-key
metadata (e.g. "testkit"). Unique. */
    appKey?: string;
    /** app_secret echoes the stored secret (internal-trust posture: plaintext
at rest, internal-network transport — the ops console needs to copy
credentials for service configuration, so it is list-visible rather
than show-once). */
    appSecret?: string;
    name?: string;
    /** disabled apps fail every send with ErrAppUnauthorized. */
    disabled?: boolean;
    /** Daily send-attempt caps (0 = unlimited). Counts attempts, not
deliveries; protects vendor accounts from runaway loops. */
    smsDailyLimit?: string;
    emailDailyLimit?: string;
    createdAt?: string;
    updatedAt?: string;
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

  type v1ParsePhoneRequest = {
    raw?: string;
    /** alpha-2; disambiguates local-format input; empty = international format only */
    defaultRegion?: string;
  };

  type v1ParsePhoneResponse = {
    isValid?: boolean;
    /** canonical E.164 when parseable */
    e164?: string;
    /** inferred alpha-2, "" when unknown */
    regionCode?: string;
    /** e.g. "+86", "" when unknown */
    dialCode?: string;
    nationalNumber?: string;
    /** E.123 international display form */
    formattedInternational?: string;
    type?: v1PhoneType;
    /** set when is_valid=false */
    errorReason?: string;
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

  type v1PhoneType =
    | "PHONE_TYPE_UNSPECIFIED"
    | "PHONE_TYPE_MOBILE"
    | "PHONE_TYPE_FIXED_LINE"
    | "PHONE_TYPE_FIXED_LINE_OR_MOBILE"
    | "PHONE_TYPE_TOLL_FREE"
    | "PHONE_TYPE_PREMIUM_RATE"
    | "PHONE_TYPE_SHARED_COST"
    | "PHONE_TYPE_VOIP"
    | "PHONE_TYPE_PERSONAL_NUMBER"
    | "PHONE_TYPE_PAGER"
    | "PHONE_TYPE_UAN"
    | "PHONE_TYPE_VOICE_MAIL"
    | "PHONE_TYPE_UNKNOWN";

  type v1PolicyInfo = {
    id?: string;
    appId?: string;
    channel?: v1TemplateChannel;
    emailScene?: v1EmailScene;
    smsScene?: v1SmsScene;
    /** template_id references the template rendered for every send of this
policy. Its channel must match. */
    templateId?: string;
    /** routes is the ordered route chain for EMAIL and for CN-domestic SMS. */
    routes?: v1RouteRule[];
    /** intl_routes is the ordered route chain for international SMS
(destination country != CN). Unused for email. */
    intlRoutes?: v1RouteRule[];
    disabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1PolicyScene = {
    emailScene?: v1EmailScene;
    smsScene?: v1SmsScene;
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

  type v1RegionCode = {
    code?: string;
    dialCode?: string;
    nameZh?: string;
    nameEn?: string;
  };

  type v1RegionGroup = {
    /** UN M49, e.g. "142" (Asia) */
    groupCode?: string;
    /** "" for top level */
    parentCode?: string;
    /** direct members; recurse client-side */
    regionCodes?: string[];
    /** e.g. "亚洲" / "Asia" */
    name?: string;
  };

  type v1RegisterRequest = {
    provider?: v1IdentityProvider;
    email?: string;
    code?: string;
    username?: string;
    nickname?: string;
    password?: string;
    dialCode?: string;
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
    dialCode?: string;
    phone?: string;
  };

  type v1ResetTrialResponse = {
    reset?: boolean;
  };

  type v1ResolveCodesRequest = {
    locale?: string;
    regionCodes?: string[];
    timezoneIds?: string[];
    languageTags?: string[];
    currencyCodes?: string[];
  };

  type v1ResolveCodesResponse = {
    countries?: v1Country[];
    timezones?: v1Timezone[];
    languages?: v1Language[];
    currencies?: v1Currency[];
    missingRegions?: string[];
    missingTimezones?: string[];
    missingLanguages?: string[];
    missingCurrencies?: string[];
    dataVersion?: string;
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

  type v1RouteRule = {
    /** account_id references a channel account (the vendor pool entry). */
    accountId?: string;
    /** signature_id references the signature used with that account.
Required for SMS routes (0 is invalid); unused for email routes. */
    signatureId?: string;
    /** weight >= 1; higher weight = higher start probability. Default 1. */
    weight?: number;
  };

  type v1SendEmailRequest = {
    to?: v1EmailAddress[];
    cc?: v1EmailAddress[];
    bcc?: v1EmailAddress[];
    replyTo?: v1EmailAddress;
    scene?: v1EmailScene;
    /** TemplateParams render {{param}} placeholders — in the policy template
(template mode) or in the free-form content below. */
    templateParams?: Record<string, any>;
    idempotencyKey?: string;
    attachments?: v1EmailAttachment[];
    /** Free-form content: subject non-empty → content comes from these fields
({{param}} still rendered); subject empty → policy template renders. */
    subject?: string;
    body?: string;
    htmlBody?: string;
  };

  type v1SendResponse = {
    id?: string;
    status?: v1MessageStatus;
    emailVendor?: v1EmailVendor;
    smsVendor?: v1SmsVendor;
  };

  type v1SendSMSRequest = {
    dialCode?: string;
    phone?: string;
    scene?: v1SmsScene;
    /** TemplateParams feed the policy template's {{param}} placeholders. */
    templateParams?: Record<string, any>;
    idempotencyKey?: string;
    /** Free-form international SMS content ({{param}} rendered with
template_params; CN destinations reject it — vendor templates only). */
    content?: string;
  };

  type v1SendVerificationCodeRequest = {
    email?: string;
    channel?: v1VerificationChannel;
    purpose?: v1VerificationPurpose;
    dialCode?: string;
    phone?: string;
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
    loginMethod?: v1LoginMethod;
    loginTarget?: string;
    device?: string;
    loginProvider?: v1IdentityProvider;
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

  type v1SignatureInfo = {
    id?: string;
    /** name is the signature string itself (e.g. "XX科技") or the intl
sender ID (e.g. "MyApp"). Unique. */
    name?: string;
    disabled?: boolean;
    remark?: string;
    /** account_ids lists the channel accounts this signature is registered on. */
    accountIds?: string[];
    createdAt?: string;
    updatedAt?: string;
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

  type v1SmsContentTemplate = {
    content?: string;
  };

  type v1SMSRecord = {
    id?: string;
    vendor?: v1SmsVendor;
    account?: string;
    scene?: v1SmsScene;
    status?: v1MessageStatus;
    regionCode?: string;
    phone?: string;
    /** app_key identifies the calling app (authenticated sender identity). */
    appKey?: string;
    content?: string;
    templateId?: string;
    templateParams?: Record<string, any>;
    errorMessage?: string;
    attempts?: number;
    sentAt?: string;
    createdAt?: string;
    updatedAt?: string;
    /** sign_name is the SMS signature / intl sender ID the policy route used. */
    signName?: string;
  };

  type v1SmsScene =
    | "SMS_SCENE_UNSPECIFIED"
    | "SMS_SCENE_LOGIN_CODE"
    | "SMS_SCENE_FORGOT_PASSWORD"
    | "SMS_SCENE_REGISTER"
    | "SMS_SCENE_CHANGE_PASSWORD"
    | "SMS_SCENE_BIND_ACCOUNT"
    | "SMS_SCENE_VERIFY_PHONE"
    | "SMS_SCENE_TEST";

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

  type v1SmsVendorCodesContent = {
    codes?: v1VendorTemplateCode[];
  };

  type v1SmsVendorStats = {
    vendor?: v1SmsVendor;
    total?: string;
    sent?: string;
    failed?: string;
  };

  type v1SmtpEmailCredentials = {
    brand?: v1EmailVendor;
    host?: string;
    /** port defaults to 587 server-side when zero. */
    port?: number;
    username?: string;
    password?: string;
    fromAddress?: string;
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

  type v1StorageAppInfo = {
    id?: string;
    /** app_key identifies the app on every data-plane call (x-app-key metadata);
immutable after creation. */
    appKey?: string;
    name?: string;
    /** key_prefix namespaces every object the app writes. Global unique,
immutable, must end with '/'. All key composition is plain concatenation. */
    keyPrefix?: string;
    /** bucket_id selects the app's private bucket; 0 = the platform default
bucket. PUBLIC uploads always land in the public bucket regardless.
Changing buckets only affects new uploads. */
    bucketId?: string;
    /** disabled apps fail every data-plane call immediately. */
    disabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
    /** app_secret is the data-plane credential (x-app-secret metadata). Echoed
on every read — internal-trust posture, same convention as messaging
apps; the ops console is the intended reader. */
    appSecret?: string;
  };

  type v1StorageSettings = {
    /** default_bucket receives uploads that do not specify a bucket. */
    defaultBucket?: string;
    /** public_bucket receives visibility=PUBLIC uploads; empty = PUBLIC
uploads are rejected. */
    publicBucket?: string;
  };

  type v1TelemetrySigningKeyInfo = {
    keyId?: string;
    revoked?: boolean;
    createdAt?: string;
    lastUsedAt?: string;
  };

  type v1TemplateChannel =
    | "TEMPLATE_CHANNEL_UNSPECIFIED"
    | "TEMPLATE_CHANNEL_EMAIL"
    | "TEMPLATE_CHANNEL_SMS";

  type v1TemplateInfo = {
    id?: string;
    appId?: string;
    name?: string;
    channel?: v1TemplateChannel;
    kind?: v1TemplateKind;
    params?: v1TemplateParamSpec[];
    disabled?: boolean;
    email?: v1EmailTemplateContent;
    vendorCodes?: v1SmsVendorCodesContent;
    smsContent?: v1SmsContentTemplate;
    createdAt?: string;
    updatedAt?: string;
  };

  type v1TemplateKind =
    | "TEMPLATE_KIND_UNSPECIFIED"
    | "TEMPLATE_KIND_EMAIL_RENDER"
    | "TEMPLATE_KIND_SMS_VENDOR_CODES"
    | "TEMPLATE_KIND_SMS_CONTENT";

  type v1TemplateParamSpec = {
    name?: string;
    /** required params must be present in template_params on every send. */
    required?: boolean;
    description?: string;
  };

  type v1TencentSmsCredentials = {
    secretId?: string;
    secretKey?: string;
    smsSdkAppId?: string;
    /** region defaults to "ap-guangzhou" server-side when empty. */
    region?: string;
    /** endpoint is optional (e.g. a dedicated intl endpoint). */
    endpoint?: string;
  };

  type v1Timezone = {
    /** canonical, e.g. "Asia/Shanghai" */
    id?: string;
    /** backward links, e.g. "PRC"; input */
    aliases?: string[];
    /** normalization only — never in pickers ISO alpha-2 members */
    regionCodes?: string[];
    /** CLDR exemplar city in the request locale */
    name?: string;
  };

  type v1TokenResponse = {
    token?: string;
    user?: v1User;
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

  type v1UpdateChannelAccountResponse = {
    account?: v1ChannelAccountInfo;
  };

  type v1UpdateKeyResponse = {
    key?: v1KeyInfo;
  };

  type v1UpdatePolicyResponse = {
    policy?: v1PolicyInfo;
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
    /** ISO 4217 alpha-3; "" leaves the stored value untouched. */
    defaultCurrency?: string;
    /** The user's country/region (ISO 3166-1 alpha-2); "" leaves it untouched. */
    regionCode?: string;
  };

  type v1UpdateSignatureResponse = {
    signature?: v1SignatureInfo;
  };

  type v1UpdateTemplateResponse = {
    template?: v1TemplateInfo;
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
    /** Derived from region_code at read time, never stored — mirrors
user.v1.User.dial_code. */
    dialCode?: string;
    /** ISO 4217 alpha-3, "" = unset. */
    defaultCurrency?: string;
    /** Reserved for MFA; false until an MFA flow exists. */
    mfaEnabled?: boolean;
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

  type v1VendorTemplateCode = {
    vendor?: v1SmsVendor;
    templateCode?: string;
  };

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

  type v1VolcengineSmsCredentials = {
    accessKey?: string;
    secretKey?: string;
    smsAccount?: string;
    /** region defaults to "cn-north-1" server-side when empty. */
    region?: string;
  };
}
