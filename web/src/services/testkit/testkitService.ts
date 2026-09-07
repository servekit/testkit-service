// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max'

/** 此处后端没有提供注释 GET /api/v1/admin/audit-logs */
export async function adminListAuditLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminListAuditLogsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminListAuditLogsResponse>('/api/v1/admin/audit-logs', {
  method: 'GET',
    params: {
        // action has a default value: AUDIT_ACTION_UNSPECIFIED
          'action': 'AUDIT_ACTION_UNSPECIFIED',
        // targetType has a default value: AUDIT_LOG_TARGET_TYPE_UNSPECIFIED
          'targetType': 'AUDIT_LOG_TARGET_TYPE_UNSPECIFIED',
        // status has a default value: AUDIT_LOG_STATUS_UNSPECIFIED
          'status': 'AUDIT_LOG_STATUS_UNSPECIFIED',
        
        // ownerType has a default value: OWNER_TYPE_UNSPECIFIED
          'ownerType': 'OWNER_TYPE_UNSPECIFIED',
        
        
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- Admin (owner_type+owner_id = query/op target via body/query, not path) ---- GET /api/v1/admin/files */
export async function adminListFiles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminListFilesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminListFilesResponse>('/api/v1/admin/files', {
  method: 'GET',
    params: {
        // ownerType has a default value: OWNER_TYPE_UNSPECIFIED
          'ownerType': 'OWNER_TYPE_UNSPECIFIED',
        
        
        
        
        // orderBy has a default value: SORT_FIELD_UNSPECIFIED
          'orderBy': 'SORT_FIELD_UNSPECIFIED',
        
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/files/${param0} */
export async function adminGetFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminGetFileParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1AdminFileInfo>(`/api/v1/admin/files/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/admin/files/${param0} */
export async function adminDeleteFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminDeleteFileParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/admin/files/${param0}`, {
  method: 'DELETE',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/storage/buckets */
export async function adminListBuckets(
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminListBucketsResponse>('/api/v1/admin/storage/buckets', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/admin/storage/buckets/${param0} */
export async function adminUpsertBucket(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUpsertBucketParams
    ,body: API.TestkitServiceAdminUpsertBucketBody,
  options ?: {[key: string]: any}
) {
  const { 'name': param0, 
  ...queryParams
  } = params;
  return request<API.v1AdminUpsertBucketResponse>(`/api/v1/admin/storage/buckets/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/admin/storage/buckets/${param0} */
export async function adminDeleteBucket(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminDeleteBucketParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'name': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/admin/storage/buckets/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/admin/storage/owners${delete} */
export async function adminDeleteOwner(body: API.v1AdminDeleteOwnerRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminDeleteOwnerResponse>(`/api/v1/admin/storage/owners:delete`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/admin/storage/owners${softDeleteFiles} */
export async function adminSoftDeleteOwnerFiles(body: API.v1AdminSoftDeleteOwnerFilesRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminSoftDeleteOwnerFilesResponse>(`/api/v1/admin/storage/owners:softDeleteFiles`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/storage/providers */
export async function adminListProviders(
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminListProvidersResponse>('/api/v1/admin/storage/providers', {
  method: 'GET',
    ...(options || {}),
  });
}

/** Provider / bucket / settings management (1:1 forwards to
storage-service admin RPCs; the live registry rebuilds immediately). POST /api/v1/admin/storage/providers */
export async function adminCreateProvider(body: API.v1AdminCreateProviderRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminCreateProviderResponse>('/api/v1/admin/storage/providers', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/admin/storage/providers/${param0} */
export async function adminUpdateProvider(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminUpdateProviderParams
    ,body: API.TestkitServiceAdminUpdateProviderBody,
  options ?: {[key: string]: any}
) {
  const { 'name': param0, 
  ...queryParams
  } = params;
  return request<API.v1AdminUpdateProviderResponse>(`/api/v1/admin/storage/providers/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/admin/storage/providers/${param0} */
export async function adminDeleteProvider(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminDeleteProviderParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'name': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/admin/storage/providers/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/storage/quota */
export async function adminGetQuota(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminGetQuotaParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1QuotaInfo>('/api/v1/admin/storage/quota', {
  method: 'GET',
    params: {
        // ownerType has a default value: OWNER_TYPE_UNSPECIFIED
          'ownerType': 'OWNER_TYPE_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/admin/storage/quota */
export async function adminSetQuota(body: API.v1AdminSetQuotaRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1QuotaInfo>('/api/v1/admin/storage/quota', {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/storage/settings */
export async function adminGetSettings(
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminGetSettingsResponse>('/api/v1/admin/storage/settings', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/admin/storage/settings */
export async function adminUpdateSettings(body: API.v1AdminUpdateSettingsRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminUpdateSettingsResponse>('/api/v1/admin/storage/settings', {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/admin/storage/stats */
export async function adminGetStats(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AdminGetStatsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1AdminGetStatsResponse>('/api/v1/admin/storage/stats', {
  method: 'GET',
    params: {
        // ownerType has a default value: OWNER_TYPE_UNSPECIFIED
          'ownerType': 'OWNER_TYPE_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/login */
export async function login(body: API.v1LoginRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1TokenResponse>('/api/v1/auth/login', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** Logout revokes the caller's current session. session_id is NOT in the
request — it is read from the authenticated context (set by the edge
auth middleware from the verified session token). POST /api/v1/auth/logout */
export async function logout(
  options ?: {[key: string]: any}
) {
  return request<Record<string, any>>('/api/v1/auth/logout', {
  method: 'POST',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/password-reset */
export async function resetPassword(body: API.v1ResetPasswordRequest,
  options ?: {[key: string]: any}
) {
  return request<Record<string, any>>('/api/v1/auth/password-reset', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/register */
export async function register(body: API.v1RegisterRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1TokenResponse>('/api/v1/auth/register', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/captcha/send */
export async function sendVerificationCode(body: API.v1SendVerificationCodeRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SendVerificationCodeResponse>('/api/v1/captcha/send', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** ---- Dashboard (P5, aggregated) ---- GET /api/v1/dashboard */
export async function getDashboard(
  options ?: {[key: string]: any}
) {
  return request<API.v1DashboardResponse>('/api/v1/dashboard', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/emails */
export async function listEmails(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListEmailsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListEmailsResponse>('/api/v1/emails', {
  method: 'GET',
    params: {
        // vendor has a default value: EMAIL_VENDOR_UNSPECIFIED
          'vendor': 'EMAIL_VENDOR_UNSPECIFIED',
        // scene has a default value: EMAIL_SCENE_UNSPECIFIED
          'scene': 'EMAIL_SCENE_UNSPECIFIED',
        // status has a default value: MESSAGE_STATUS_UNSPECIFIED
          'status': 'MESSAGE_STATUS_UNSPECIFIED',
        
        
        
        
        
        // sortField has a default value: SORT_FIELD_UNSPECIFIED
          'sortField': 'SORT_FIELD_UNSPECIFIED',
        // sortDirection has a default value: SORT_DIRECTION_UNSPECIFIED
          'sortDirection': 'SORT_DIRECTION_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** Email records. GET /api/v1/emails/${param0} */
export async function getEmail(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetEmailParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1EmailRecord>(`/api/v1/emails/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/emails${cursor} */
export async function listEmailsByCursor(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListEmailsByCursorParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListEmailsByCursorResponse>(`/api/v1/emails:cursor`, {
  method: 'GET',
    params: {
        // vendor has a default value: EMAIL_VENDOR_UNSPECIFIED
          'vendor': 'EMAIL_VENDOR_UNSPECIFIED',
        // scene has a default value: EMAIL_SCENE_UNSPECIFIED
          'scene': 'EMAIL_SCENE_UNSPECIFIED',
        // status has a default value: MESSAGE_STATUS_UNSPECIFIED
          'status': 'MESSAGE_STATUS_UNSPECIFIED',
        
        
        
        // sortField has a default value: SORT_FIELD_UNSPECIFIED
          'sortField': 'SORT_FIELD_UNSPECIFIED',
        // sortDirection has a default value: SORT_DIRECTION_UNSPECIFIED
          'sortDirection': 'SORT_DIRECTION_UNSPECIFIED',
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/emails${stats} */
export async function getEmailStats(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetEmailStatsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1EmailStatsResponse>(`/api/v1/emails:stats`, {
  method: 'GET',
    params: {
        // vendor has a default value: EMAIL_VENDOR_UNSPECIFIED
          'vendor': 'EMAIL_VENDOR_UNSPECIFIED',
        // scene has a default value: EMAIL_SCENE_UNSPECIFIED
          'scene': 'EMAIL_SCENE_UNSPECIFIED',
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- My Files (owner from ctx) ---- GET /api/v1/files */
export async function listMyFiles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListMyFilesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListMyFilesResponse>('/api/v1/files', {
  method: 'GET',
    params: {
        
        
        
        // orderBy has a default value: SORT_FIELD_UNSPECIFIED
          'orderBy': 'SORT_FIELD_UNSPECIFIED',
        
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/files/${param0} */
export async function getMyFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetMyFileParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1FileInfo>(`/api/v1/files/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/files/${param0} */
export async function deleteMyFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteMyFileParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/files/${param0}`, {
  method: 'DELETE',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/v1/files/${param0} */
export async function updateMyFile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateMyFileParams
    ,body: API.TestkitServiceUpdateMyFileBody,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1FileInfo>(`/api/v1/files/${param0}`, {
  method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** ---- Sharing (anonymous download surface for external links) ----
CreateFileLink mints / renews an anonymous link token (owner from ctx). POST /api/v1/files/${param0}/links */
export async function createFileLink(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.CreateFileLinkParams
    ,body: API.TestkitServiceCreateFileLinkBody,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1CreateFileLinkResponse>(`/api/v1/files/${param0}/links`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/${param0}${cdnUrl} */
export async function generateCdnurl(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GenerateCDNURLParams
    ,body: API.TestkitServiceGenerateCDNURLBody,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1GenerateCDNURLResponse>(`/api/v1/files/${param0}:cdnUrl`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** ---- Download / Process (owner from ctx) ---- POST /api/v1/files/${param0}${downloadUrl} */
export async function generateDownloadUrl(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GenerateDownloadURLParams
    ,body: API.TestkitServiceGenerateDownloadURLBody,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1GenerateDownloadURLResponse>(`/api/v1/files/${param0}:downloadUrl`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/${param0}${processUrl} */
export async function generateProcessUrl(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GenerateProcessURLParams
    ,body: API.TestkitServiceGenerateProcessURLBody,
  options ?: {[key: string]: any}
) {
  const { 'fileId': param0, 
  ...queryParams
  } = params;
  return request<API.v1GenerateProcessURLResponse>(`/api/v1/files/${param0}:processUrl`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/sts */
export async function getStsCredential(body: API.v1GetSTSCredentialRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1GetSTSCredentialResponse>('/api/v1/files/sts', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/sts${batch} */
export async function batchGetStsCredential(body: API.v1BatchGetSTSCredentialRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1BatchGetSTSCredentialResponse>(`/api/v1/files/sts:batch`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** ---- Upload (owner from ctx) ---- POST /api/v1/files/uploads */
export async function generateUploadUrl(body: API.v1GenerateUploadURLRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1GenerateUploadURLResponse>('/api/v1/files/uploads', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/uploads${cancel} */
export async function cancelUpload(body: API.v1CancelUploadRequest,
  options ?: {[key: string]: any}
) {
  return request<Record<string, any>>(`/api/v1/files/uploads:cancel`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files/uploads${confirm} */
export async function confirmUpload(body: API.v1ConfirmUploadRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1ConfirmUploadResponse>(`/api/v1/files/uploads:confirm`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/files${batchDelete} */
export async function batchDeleteMyFiles(body: API.v1BatchDeleteMyFilesRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1BatchDeleteMyFilesResponse>(`/api/v1/files:batchDelete`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/files${page} */
export async function listMyFilesPaged(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListMyFilesPagedParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListMyFilesPagedResponse>(`/api/v1/files:page`, {
  method: 'GET',
    params: {
        
        
        
        
        
        // orderBy has a default value: SORT_FIELD_UNSPECIFIED
          'orderBy': 'SORT_FIELD_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/gid/batch */
export async function batchNextId(body: API.v1BatchNextIDRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1BatchNextIDResponse>('/api/v1/gid/batch', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/gid/decompose/${param0} */
export async function decompose(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DecomposeParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1DecomposeResponse>(`/api/v1/gid/decompose/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** ---- GID debug (P5) ---- GET /api/v1/gid/next */
export async function nextId(
  options ?: {[key: string]: any}
) {
  return request<API.v1NextIDResponse>('/api/v1/gid/next', {
  method: 'GET',
    ...(options || {}),
  });
}

/** ---- Identity (P2) ---- GET /api/v1/identities */
export async function listIdentities(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListIdentitiesResponse>('/api/v1/identities', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/identities */
export async function bindIdentity(body: API.v1BindIdentityRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1Identity>('/api/v1/identities', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/identities/${param0}${unbind} */
export async function unbindIdentity(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UnbindIdentityParams
    ,body: API.TestkitServiceUnbindIdentityBody,
  options ?: {[key: string]: any}
) {
  const { 'identityId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/identities/${param0}:unbind`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/identities/oauth */
export async function bindOAuthIdentity(body: API.v1BindOAuthIdentityRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1BindOAuthIdentityResponse>('/api/v1/identities/oauth', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/activate */
export async function activate(body: API.v1ActivateRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1ActivateResponse>('/api/v1/license/activate', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/admin/keys */
export async function listKeys(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListKeysParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListKeysResponse>('/api/v1/license/admin/keys', {
  method: 'GET',
    params: {
        // status has a default value: KEY_STATUS_UNSPECIFIED
          'status': 'KEY_STATUS_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/admin/keys */
export async function createKey(body: API.v1CreateKeyRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreateKeyResponse>('/api/v1/license/admin/keys', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/admin/keys/${param0} */
export async function showKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ShowKeyParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ShowKeyResponse>(`/api/v1/license/admin/keys/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/license/admin/keys/${param0} */
export async function deleteKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteKeyParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1DeleteKeyResponse>(`/api/v1/license/admin/keys/${param0}`, {
  method: 'DELETE',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PATCH /api/v1/license/admin/keys/${param0} */
export async function updateKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateKeyParams
    ,body: API.TestkitServiceUpdateKeyBody,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1UpdateKeyResponse>(`/api/v1/license/admin/keys/${param0}`, {
  method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/admin/keys/${param0}/devices */
export async function listKeyDevices(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListKeyDevicesParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ListKeyDevicesResponse>(`/api/v1/license/admin/keys/${param0}/devices`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/license/admin/keys/${param0}/devices/${param1} */
export async function kickDevice(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.KickDeviceParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 'deviceToken': param1, 
  ...queryParams
  } = params;
  return request<API.v1KickDeviceResponse>(`/api/v1/license/admin/keys/${param0}/devices/${param1}`, {
  method: 'DELETE',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/license/admin/keys/${param0}/grants/${param1} */
export async function grantModule(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GrantModuleParams
    ,body: API.TestkitServiceGrantModuleBody,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 'module': param1, 
  ...queryParams
  } = params;
  return request<API.v1GrantModuleResponse>(`/api/v1/license/admin/keys/${param0}/grants/${param1}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/license/admin/keys/${param0}/grants/${param1} */
export async function revokeModule(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeModuleParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 'module': param1, 
  ...queryParams
  } = params;
  return request<API.v1RevokeModuleResponse>(`/api/v1/license/admin/keys/${param0}/grants/${param1}`, {
  method: 'DELETE',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/admin/keys/${param0}/revoke */
export async function revokeKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeKeyParams
    ,body: API.TestkitServiceRevokeKeyBody,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1RevokeKeyResponse>(`/api/v1/license/admin/keys/${param0}/revoke`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/admin/keys/${param0}/unrevoke */
export async function unrevokeKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UnrevokeKeyParams
    ,body: API.TestkitServiceUnrevokeKeyBody,
  options ?: {[key: string]: any}
) {
  const { 'keyId': param0, 
  ...queryParams
  } = params;
  return request<API.v1UnrevokeKeyResponse>(`/api/v1/license/admin/keys/${param0}/unrevoke`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/admin/signing/pubkey */
export async function showPubKey(
  options ?: {[key: string]: any}
) {
  return request<API.v1ShowPubKeyResponse>('/api/v1/license/admin/signing/pubkey', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/admin/trials/${param0} */
export async function showTrial(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ShowTrialParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'fingerprintId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ShowTrialResponse>(`/api/v1/license/admin/trials/${param0}`, {
  method: 'GET',
    params: {
        // module has a default value: MODULE_UNSPECIFIED
          'module': 'MODULE_UNSPECIFIED',...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/admin/trials/${param0}/${param1}/reset */
export async function resetTrial(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ResetTrialParams
    ,body: API.TestkitServiceResetTrialBody,
  options ?: {[key: string]: any}
) {
  const { 'fingerprintId': param0, 'module': param1, 
  ...queryParams
  } = params;
  return request<API.v1ResetTrialResponse>(`/api/v1/license/admin/trials/${param0}/${param1}/reset`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/deactivate */
export async function deactivate(body: API.v1DeactivateRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1DeactivateResponse>('/api/v1/license/deactivate', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/license/healthz */
export async function health(
  options ?: {[key: string]: any}
) {
  return request<API.v1HealthResponse>('/api/v1/license/healthz', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/license/trial/start */
export async function trialStart(body: API.v1TrialStartRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1TrialStartResponse>('/api/v1/license/trial/start', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** GetFileLinkDownload is the anonymous backend for file links embedded in
emails etc. — the token IS the credential, no login required. GET /api/v1/links/${param0}/download */
export async function getFileLinkDownload(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetFileLinkDownloadParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'linkToken': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetFileLinkDownloadResponse>(`/api/v1/links/${param0}/download`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/accounts */
export async function messageListChannelAccounts(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListChannelAccountsResponse>('/api/v1/message/admin/accounts', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/accounts */
export async function messageCreateChannelAccount(body: API.v1CreateChannelAccountRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreateChannelAccountResponse>('/api/v1/message/admin/accounts', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/message/admin/accounts/${param0} */
export async function messageUpdateChannelAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageUpdateChannelAccountParams
    ,body: API.TestkitServiceMessageUpdateChannelAccountBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1UpdateChannelAccountResponse>(`/api/v1/message/admin/accounts/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/message/admin/accounts/${param0} */
export async function messageDeleteChannelAccount(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageDeleteChannelAccountParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/message/admin/accounts/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/apps */
export async function messageListApps(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListAppsResponse>('/api/v1/message/admin/apps', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/apps */
export async function messageCreateApp(body: API.messagingV1CreateAppRequest,
  options ?: {[key: string]: any}
) {
  return request<API.messagingV1CreateAppResponse>('/api/v1/message/admin/apps', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/apps/${param0} */
export async function messageGetApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageGetAppParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.messagingV1GetAppResponse>(`/api/v1/message/admin/apps/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/message/admin/apps/${param0} */
export async function messageUpdateApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageUpdateAppParams
    ,body: API.TestkitServiceMessageUpdateAppBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.messagingV1UpdateAppResponse>(`/api/v1/message/admin/apps/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/message/admin/apps/${param0} */
export async function messageDeleteApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageDeleteAppParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/message/admin/apps/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/apps/${param0}/secret${rotate} */
export async function messageRotateAppSecret(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageRotateAppSecretParams
    ,body: API.TestkitServiceMessageRotateAppSecretBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1RotateAppSecretResponse>(`/api/v1/message/admin/apps/${param0}/secret:rotate`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/policies */
export async function listPolicies(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListPoliciesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListPoliciesResponse>('/api/v1/message/admin/policies', {
  method: 'GET',
    params: {
        
        // channel has a default value: TEMPLATE_CHANNEL_UNSPECIFIED
          'channel': 'TEMPLATE_CHANNEL_UNSPECIFIED',...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/policies */
export async function messageCreatePolicy(body: API.v1CreatePolicyRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreatePolicyResponse>('/api/v1/message/admin/policies', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/message/admin/policies/${param0} */
export async function messageUpdatePolicy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageUpdatePolicyParams
    ,body: API.TestkitServiceMessageUpdatePolicyBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1UpdatePolicyResponse>(`/api/v1/message/admin/policies/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/message/admin/policies/${param0} */
export async function messageDeletePolicy(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageDeletePolicyParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/message/admin/policies/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/signatures */
export async function messageListSignatures(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListSignaturesResponse>('/api/v1/message/admin/signatures', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/signatures */
export async function messageCreateSignature(body: API.v1CreateSignatureRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreateSignatureResponse>('/api/v1/message/admin/signatures', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/message/admin/signatures/${param0} */
export async function messageUpdateSignature(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageUpdateSignatureParams
    ,body: API.TestkitServiceMessageUpdateSignatureBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1UpdateSignatureResponse>(`/api/v1/message/admin/signatures/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/message/admin/signatures/${param0} */
export async function messageDeleteSignature(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageDeleteSignatureParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/message/admin/signatures/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/message/admin/templates */
export async function messageListTemplates(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageListTemplatesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListTemplatesResponse>('/api/v1/message/admin/templates', {
  method: 'GET',
    params: {
        
        // channel has a default value: TEMPLATE_CHANNEL_UNSPECIFIED
          'channel': 'TEMPLATE_CHANNEL_UNSPECIFIED',...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/message/admin/templates */
export async function messageCreateTemplate(body: API.v1CreateTemplateRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreateTemplateResponse>('/api/v1/message/admin/templates', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/message/admin/templates/${param0} */
export async function messageUpdateTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageUpdateTemplateParams
    ,body: API.TestkitServiceMessageUpdateTemplateBody,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1UpdateTemplateResponse>(`/api/v1/message/admin/templates/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/message/admin/templates/${param0} */
export async function messageDeleteTemplate(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.MessageDeleteTemplateParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/message/admin/templates/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** Send (app credentials injected from config). POST /api/v1/messages${email} */
export async function sendEmail(body: API.v1SendEmailRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SendResponse>(`/api/v1/messages:email`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/messages${sms} */
export async function sendSms(body: API.v1SendSMSRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SendResponse>(`/api/v1/messages:sms`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** ---- Profile (P2) ---- GET /api/v1/profile */
export async function getProfile(
  options ?: {[key: string]: any}
) {
  return request<API.v1User>('/api/v1/profile', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/profile */
export async function updateProfile(body: API.v1UpdateProfileRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1User>('/api/v1/profile', {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/profile/password */
export async function changePassword(body: API.v1ChangePasswordRequest,
  options ?: {[key: string]: any}
) {
  return request<Record<string, any>>('/api/v1/profile/password', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups */
export async function listGroups(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListGroupsResponse>('/api/v1/rbac/groups', {
  method: 'GET',
    params: {
        
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- RBAC-Group (P2) ---- POST /api/v1/rbac/groups */
export async function createGroup(body: API.v1CreateGroupRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1Group>('/api/v1/rbac/groups', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0} */
export async function getGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetGroupParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Group>(`/api/v1/rbac/groups/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/groups/${param0} */
export async function updateGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateGroupParams
    ,body: API.TestkitServiceUpdateGroupBody,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Group>(`/api/v1/rbac/groups/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0} */
export async function deleteGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteGroupParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0}/members */
export async function listGroupMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupMembersParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ListGroupMembersResponse>(`/api/v1/rbac/groups/${param0}/members`, {
  method: 'GET',
    params: {
        
        
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/groups/${param0}/members */
export async function addGroupMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AddGroupMemberParams
    ,body: API.TestkitServiceAddGroupMemberBody,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/members`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0}/members/${param1} */
export async function removeGroupMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RemoveGroupMemberParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 'userId': param1, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/members/${param1}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0}/roles */
export async function listGroupRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupRolesParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ListGroupRolesResponse>(`/api/v1/rbac/groups/${param0}/roles`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/groups/${param0}/roles */
export async function addGroupRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AddGroupRoleParams
    ,body: API.TestkitServiceAddGroupRoleBody,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/roles`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0}/roles/${param1} */
export async function removeGroupRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RemoveGroupRoleParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupId': param0, 'roleId': param1, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/roles/${param1}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permission-groups */
export async function listPermissionGroups(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListPermissionGroupsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListPermissionGroupsResponse>('/api/v1/rbac/permission-groups', {
  method: 'GET',
    params: {
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/permission-groups */
export async function createPermissionGroup(body: API.v1CreatePermissionGroupRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1PermissionGroup>('/api/v1/rbac/permission-groups', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permission-groups/${param0} */
export async function getPermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetPermissionGroupParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'permissionGroupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1PermissionGroup>(`/api/v1/rbac/permission-groups/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/permission-groups/${param0} */
export async function updatePermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdatePermissionGroupParams
    ,body: API.TestkitServiceUpdatePermissionGroupBody,
  options ?: {[key: string]: any}
) {
  const { 'permissionGroupId': param0, 
  ...queryParams
  } = params;
  return request<API.v1PermissionGroup>(`/api/v1/rbac/permission-groups/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/permission-groups/${param0} */
export async function deletePermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeletePermissionGroupParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'permissionGroupId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/permission-groups/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** ---- RBAC-Permission (P2) ---- GET /api/v1/rbac/permissions */
export async function listPermissions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListPermissionsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListPermissionsResponse>('/api/v1/rbac/permissions', {
  method: 'GET',
    params: {
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/permissions */
export async function createPermission(body: API.v1CreatePermissionRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1Permission>('/api/v1/rbac/permissions', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permissions/${param0} */
export async function getPermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetPermissionParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'permissionId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Permission>(`/api/v1/rbac/permissions/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/permissions/${param0} */
export async function updatePermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdatePermissionParams
    ,body: API.TestkitServiceUpdatePermissionBody,
  options ?: {[key: string]: any}
) {
  const { 'permissionId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Permission>(`/api/v1/rbac/permissions/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/permissions/${param0} */
export async function deletePermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeletePermissionParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'permissionId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/permissions/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/roles */
export async function listRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListRolesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListRolesResponse>('/api/v1/rbac/roles', {
  method: 'GET',
    params: {
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- RBAC-Role (P2) ---- POST /api/v1/rbac/roles */
export async function createRole(body: API.v1CreateRoleRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1Role>('/api/v1/rbac/roles', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/roles/${param0} */
export async function getRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetRoleParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'roleId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Role>(`/api/v1/rbac/roles/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/roles/${param0} */
export async function updateRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateRoleParams
    ,body: API.TestkitServiceUpdateRoleBody,
  options ?: {[key: string]: any}
) {
  const { 'roleId': param0, 
  ...queryParams
  } = params;
  return request<API.v1Role>(`/api/v1/rbac/roles/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/roles/${param0} */
export async function deleteRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteRoleParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'roleId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/roles/${param0}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/users/${param0}/roles */
export async function listUserRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUserRolesParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'userId': param0, 
  ...queryParams
  } = params;
  return request<API.v1ListUserRolesResponse>(`/api/v1/rbac/users/${param0}/roles`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/users/${param0}/roles */
export async function assignRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AssignRoleParams
    ,body: API.TestkitServiceAssignRoleBody,
  options ?: {[key: string]: any}
) {
  const { 'userId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/users/${param0}/roles`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/users/${param0}/roles/${param1} */
export async function revokeRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeRoleParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'userId': param0, 'roleId': param1, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/rbac/users/${param0}/roles/${param1}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/reference/codes${resolve} */
export async function resolveCodes(body: API.v1ResolveCodesRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1ResolveCodesResponse>(`/api/v1/reference/codes:resolve`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/countries */
export async function listCountries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListCountriesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListCountriesResponse>('/api/v1/reference/countries', {
  method: 'GET',
    params: {
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/countries/${param0}/defaults */
export async function getCountryDefaults(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetCountryDefaultsParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'regionCode': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetCountryDefaultsResponse>(`/api/v1/reference/countries/${param0}/defaults`, {
  method: 'GET',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/countries/${param0}/profile */
export async function getCountryProfile(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetCountryProfileParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'regionCode': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetCountryProfileResponse>(`/api/v1/reference/countries/${param0}/profile`, {
  method: 'GET',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** Batch subset lookup: ?countryCodes=AC&countryCodes=CN (comma-separated
also accepted by the gateway). GET /api/v1/reference/countries${batch} */
export async function getCountries(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetCountriesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1GetCountriesResponse>(`/api/v1/reference/countries:batch`, {
  method: 'GET',
    params: {
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/currencies */
export async function listCurrencies(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListCurrenciesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListCurrenciesResponse>('/api/v1/reference/currencies', {
  method: 'GET',
    params: {
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/data-info */
export async function getDataInfo(
  options ?: {[key: string]: any}
) {
  return request<API.v1GetDataInfoResponse>('/api/v1/reference/data-info', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/languages */
export async function listLanguages(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListLanguagesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListLanguagesResponse>('/api/v1/reference/languages', {
  method: 'GET',
    params: {
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/reference/phone${parse} */
export async function parsePhone(body: API.v1ParsePhoneRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1ParsePhoneResponse>(`/api/v1/reference/phone:parse`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/region-groups */
export async function listRegionGroups(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListRegionGroupsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListRegionGroupsResponse>('/api/v1/reference/region-groups', {
  method: 'GET',
    params: {
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/region-groups/${param0}/countries */
export async function listCountriesByRegion(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListCountriesByRegionParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'groupCode': param0, 
  ...queryParams
  } = params;
  return request<API.v1ListCountriesByRegionResponse>(`/api/v1/reference/region-groups/${param0}/countries`, {
  method: 'GET',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/reference/timezones */
export async function listTimezones(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListTimezonesParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListTimezonesResponse>('/api/v1/reference/timezones', {
  method: 'GET',
    params: {
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/region-codes */
export async function listRegionCodes(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListRegionCodesResponse>('/api/v1/region-codes', {
  method: 'GET',
    ...(options || {}),
  });
}

/** ---- Session (P2) ---- GET /api/v1/sessions */
export async function listSessions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListSessionsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListSessionsResponse>('/api/v1/sessions', {
  method: 'GET',
    params: {
        
        
        // status has a default value: SESSION_STATUS_UNSPECIFIED
          'status': 'SESSION_STATUS_UNSPECIFIED',...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sessions/${param0} */
export async function getSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetSessionParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'sessionId': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetSessionResponse>(`/api/v1/sessions/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/${param0}/revoke */
export async function revokeSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeSessionParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'sessionId': param0, 
  ...queryParams
  } = params;
  return request<Record<string, any>>(`/api/v1/sessions/${param0}/revoke`, {
  method: 'POST',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/exchange */
export async function exchangeSessionCode(body: API.v1ExchangeSessionCodeRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1ExchangeSessionCodeResponse>('/api/v1/sessions/exchange', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/issue-code */
export async function issueSessionCode(body: API.v1IssueSessionCodeRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1IssueSessionCodeResponse>('/api/v1/sessions/issue-code', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/revoke-all */
export async function revokeAllSessions(
  options ?: {[key: string]: any}
) {
  return request<Record<string, any>>('/api/v1/sessions/revoke-all', {
  method: 'POST',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sms */
export async function listSms(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListSMSParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListSMSResponse>('/api/v1/sms', {
  method: 'GET',
    params: {
        // vendor has a default value: SMS_VENDOR_UNSPECIFIED
          'vendor': 'SMS_VENDOR_UNSPECIFIED',
        // scene has a default value: SMS_SCENE_UNSPECIFIED
          'scene': 'SMS_SCENE_UNSPECIFIED',
        // status has a default value: MESSAGE_STATUS_UNSPECIFIED
          'status': 'MESSAGE_STATUS_UNSPECIFIED',
        
        
        
        
        
        
        // sortField has a default value: SORT_FIELD_UNSPECIFIED
          'sortField': 'SORT_FIELD_UNSPECIFIED',
        // sortDirection has a default value: SORT_DIRECTION_UNSPECIFIED
          'sortDirection': 'SORT_DIRECTION_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** SMS records. GET /api/v1/sms/${param0} */
export async function getSms(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetSMSParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'id': param0, 
  ...queryParams
  } = params;
  return request<API.v1SMSRecord>(`/api/v1/sms/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sms${cursor} */
export async function listSmsByCursor(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListSMSByCursorParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListSMSByCursorResponse>(`/api/v1/sms:cursor`, {
  method: 'GET',
    params: {
        // vendor has a default value: SMS_VENDOR_UNSPECIFIED
          'vendor': 'SMS_VENDOR_UNSPECIFIED',
        // scene has a default value: SMS_SCENE_UNSPECIFIED
          'scene': 'SMS_SCENE_UNSPECIFIED',
        // status has a default value: MESSAGE_STATUS_UNSPECIFIED
          'status': 'MESSAGE_STATUS_UNSPECIFIED',
        
        
        
        
        // sortField has a default value: SORT_FIELD_UNSPECIFIED
          'sortField': 'SORT_FIELD_UNSPECIFIED',
        // sortDirection has a default value: SORT_DIRECTION_UNSPECIFIED
          'sortDirection': 'SORT_DIRECTION_UNSPECIFIED',
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sms${regions} */
export async function listSmsRegions(
  options ?: {[key: string]: any}
) {
  return request<API.v1ListSMSRegionsResponse>(`/api/v1/sms:regions`, {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sms${stats} */
export async function getSmsStats(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetSMSStatsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1SMSStatsResponse>(`/api/v1/sms:stats`, {
  method: 'GET',
    params: {
        // vendor has a default value: SMS_VENDOR_UNSPECIFIED
          'vendor': 'SMS_VENDOR_UNSPECIFIED',
        // scene has a default value: SMS_SCENE_UNSPECIFIED
          'scene': 'SMS_SCENE_UNSPECIFIED',
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- Social (P2) ---- GET /api/v1/social/${param0}/url */
export async function getOAuthUrl(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetOAuthURLParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'provider': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetOAuthURLResponse>(`/api/v1/social/${param0}/url`, {
  method: 'GET',
    params: {
        
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/login */
export async function socialLogin(body: API.v1SocialLoginRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SocialLoginResponse>('/api/v1/social/login', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/miniprogram */
export async function miniProgramLogin(body: API.v1MiniProgramLoginRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SocialLoginResponse>('/api/v1/social/miniprogram', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/miniprogram/phone */
export async function miniProgramPhoneLogin(body: API.v1MiniProgramPhoneLoginRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1SocialLoginResponse>('/api/v1/social/miniprogram/phone', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/storage/audit-logs */
export async function listMyAuditLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListMyAuditLogsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListMyAuditLogsResponse>('/api/v1/storage/audit-logs', {
  method: 'GET',
    params: {
        // action has a default value: AUDIT_ACTION_UNSPECIFIED
          'action': 'AUDIT_ACTION_UNSPECIFIED',
        // targetType has a default value: AUDIT_LOG_TARGET_TYPE_UNSPECIFIED
          'targetType': 'AUDIT_LOG_TARGET_TYPE_UNSPECIFIED',
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** ---- My Quota / Audit (owner from ctx) ---- GET /api/v1/storage/quota */
export async function getMyQuota(
  options ?: {[key: string]: any}
) {
  return request<API.v1QuotaInfo>('/api/v1/storage/quota', {
  method: 'GET',
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/telemetry/admin/apps */
export async function createApp(body: API.testkitV1CreateAppRequest,
  options ?: {[key: string]: any}
) {
  return request<API.testkitV1CreateAppResponse>('/api/v1/telemetry/admin/apps', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/telemetry/admin/apps/${param0} */
export async function getApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetAppParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.testkitV1GetAppResponse>(`/api/v1/telemetry/admin/apps/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/telemetry/admin/apps/${param0} */
export async function updateApp(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateAppParams
    ,body: API.TestkitServiceUpdateAppBody,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.testkitV1UpdateAppResponse>(`/api/v1/telemetry/admin/apps/${param0}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/telemetry/admin/apps/${param0}/events */
export async function replaceEventRules(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ReplaceEventRulesParams
    ,body: API.TestkitServiceReplaceEventRulesBody,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.v1ReplaceEventRulesResponse>(`/api/v1/telemetry/admin/apps/${param0}/events`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/telemetry/admin/apps/${param0}/signing-keys */
export async function createSigningKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.CreateSigningKeyParams
    ,body: API.TestkitServiceCreateSigningKeyBody,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.v1CreateSigningKeyResponse>(`/api/v1/telemetry/admin/apps/${param0}/signing-keys`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/telemetry/admin/apps/${param0}/signing-keys/${param1} */
export async function revokeSigningKey(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeSigningKeyParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 'keyId': param1, 
  ...queryParams
  } = params;
  return request<API.v1RevokeSigningKeyResponse>(`/api/v1/telemetry/admin/apps/${param0}/signing-keys/${param1}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/telemetry/admin/apps/${param0}/stats */
export async function getAppStats(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetAppStatsParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.v1GetAppStatsResponse>(`/api/v1/telemetry/admin/apps/${param0}/stats`, {
  method: 'GET',
    params: {
        ...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/telemetry/admin/apps/${param0}/tokens */
export async function rotateToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RotateTokenParams
    ,body: API.TestkitServiceRotateTokenBody,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 
  ...queryParams
  } = params;
  return request<API.v1RotateTokenResponse>(`/api/v1/telemetry/admin/apps/${param0}/tokens`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/telemetry/admin/apps/${param0}/tokens/${param1} */
export async function revokeToken(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeTokenParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 'prefix': param1, 
  ...queryParams
  } = params;
  return request<API.v1RevokeTokenResponse>(`/api/v1/telemetry/admin/apps/${param0}/tokens/${param1}`, {
  method: 'DELETE',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/telemetry/admin/apps/${param0}/versions/${param1} */
export async function setVersionBlocked(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.SetVersionBlockedParams
    ,body: API.TestkitServiceSetVersionBlockedBody,
  options ?: {[key: string]: any}
) {
  const { 'slug': param0, 'version': param1, 
  ...queryParams
  } = params;
  return request<API.v1SetVersionBlockedResponse>(`/api/v1/telemetry/admin/apps/${param0}/versions/${param1}`, {
  method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/telemetry/ingest */
export async function ingest(body: API.v1IngestRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1IngestResponse>('/api/v1/telemetry/ingest', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users */
export async function listUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUsersParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListUsersResponse>('/api/v1/users', {
  method: 'GET',
    params: {
        // status has a default value: USER_STATUS_UNSPECIFIED
          'status': 'USER_STATUS_UNSPECIFIED',
        
        
        
        // gender has a default value: GENDER_UNSPECIFIED
          'gender': 'GENDER_UNSPECIFIED',
        // registerSource has a default value: IDENTITY_PROVIDER_UNSPECIFIED
          'registerSource': 'IDENTITY_PROVIDER_UNSPECIFIED',
        // registerDevice has a default value: DEVICE_TYPE_UNSPECIFIED
          'registerDevice': 'DEVICE_TYPE_UNSPECIFIED',
        
        
        
        
        
        
        
        
        
        
        
        
        
        // userType has a default value: USER_TYPE_UNSPECIFIED
          'userType': 'USER_TYPE_UNSPECIFIED',
        // orderBy has a default value: USER_SORT_FIELD_UNSPECIFIED
          'orderBy': 'USER_SORT_FIELD_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** ---- Admin-Users (P2) ---- POST /api/v1/users */
export async function createUser(body: API.v1CreateUserRequest,
  options ?: {[key: string]: any}
) {
  return request<API.v1CreateUserResponse>('/api/v1/users', {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/${param0} */
export async function getUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetUserParams
    ,
  options ?: {[key: string]: any}
) {
  const { 'userId': param0, 
  ...queryParams
  } = params;
  return request<API.v1User>(`/api/v1/users/${param0}`, {
  method: 'GET',
    params: {...queryParams,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/users/${param0}/disable */
export async function disableUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DisableUserParams
    ,body: API.TestkitServiceDisableUserBody,
  options ?: {[key: string]: any}
) {
  const { 'userId': param0, 
  ...queryParams
  } = params;
  return request<API.v1User>(`/api/v1/users/${param0}/disable`, {
  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    params: {...queryParams,},
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/login-logs */
export async function getLoginLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetLoginLogsParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1GetLoginLogsResponse>('/api/v1/users/login-logs', {
  method: 'GET',
    params: {
        
        // provider has a default value: IDENTITY_PROVIDER_UNSPECIFIED
          'provider': 'IDENTITY_PROVIDER_UNSPECIFIED',
        
        
        
        // action has a default value: LOGIN_ACTION_UNSPECIFIED
          'action': 'LOGIN_ACTION_UNSPECIFIED',
        // method has a default value: LOGIN_METHOD_UNSPECIFIED
          'method': 'LOGIN_METHOD_UNSPECIFIED',
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/paged */
export async function listUsersPaged(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUsersPagedParams
    ,
  options ?: {[key: string]: any}
) {
  return request<API.v1ListUsersPagedResponse>('/api/v1/users/paged', {
  method: 'GET',
    params: {
        // status has a default value: USER_STATUS_UNSPECIFIED
          'status': 'USER_STATUS_UNSPECIFIED',
        
        // gender has a default value: GENDER_UNSPECIFIED
          'gender': 'GENDER_UNSPECIFIED',
        // registerSource has a default value: IDENTITY_PROVIDER_UNSPECIFIED
          'registerSource': 'IDENTITY_PROVIDER_UNSPECIFIED',
        // registerDevice has a default value: DEVICE_TYPE_UNSPECIFIED
          'registerDevice': 'DEVICE_TYPE_UNSPECIFIED',
        // userType has a default value: USER_TYPE_UNSPECIFIED
          'userType': 'USER_TYPE_UNSPECIFIED',
        
        
        
        
        
        
        
        
        
        
        
        
        
        // orderBy has a default value: USER_SORT_FIELD_UNSPECIFIED
          'orderBy': 'USER_SORT_FIELD_UNSPECIFIED',
        
        
        
        ...params,},
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /ping */
export async function ping(
  options ?: {[key: string]: any}
) {
  return request<API.v1Pong>('/ping', {
  method: 'GET',
    ...(options || {}),
  });
}

