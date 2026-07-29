// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 此处后端没有提供注释 POST /api/v1/auth/login */
export async function login(
  body: API.v1LoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** Logout revokes the caller's current session. session_id is NOT in the
request — it is read from the authenticated context (set by the auth
interceptor from the JWT). POST /api/v1/auth/logout */
export async function logout(options?: { [key: string]: any }) {
  return request<Record<string, any>>("/api/v1/auth/logout", {
    method: "POST",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/password-reset */
export async function resetPassword(
  body: API.v1ResetPasswordRequest,
  options?: { [key: string]: any }
) {
  return request<Record<string, any>>("/api/v1/auth/password-reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/refresh */
export async function refreshSession(
  body: API.v1RefreshSessionRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/auth/register */
export async function register(
  body: API.v1RegisterRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/captcha/send */
export async function sendVerificationCode(
  body: API.v1SendVerificationCodeRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1SendVerificationCodeResponse>("/api/v1/captcha/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** ---- Identity (P2) ---- GET /api/v1/identities */
export async function listIdentities(options?: { [key: string]: any }) {
  return request<API.v1ListIdentitiesResponse>("/api/v1/identities", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/identities */
export async function bindIdentity(
  body: API.v1BindIdentityRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1Identity>("/api/v1/identities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/identities/${param0} */
export async function unbindIdentity(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UnbindIdentityParams,
  options?: { [key: string]: any }
) {
  const { identityId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/identities/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/identities/oauth */
export async function bindOAuthIdentity(
  body: API.v1BindOAuthIdentityRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1BindOAuthIdentityResponse>("/api/v1/identities/oauth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** ---- Profile (P2) ---- GET /api/v1/profile */
export async function getProfile(options?: { [key: string]: any }) {
  return request<API.v1User>("/api/v1/profile", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/profile */
export async function updateProfile(
  body: API.v1UpdateProfileRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1User>("/api/v1/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/profile/password */
export async function changePassword(
  body: API.v1ChangePasswordRequest,
  options?: { [key: string]: any }
) {
  return request<Record<string, any>>("/api/v1/profile/password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups */
export async function listGroups(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupsParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListGroupsResponse>("/api/v1/rbac/groups", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** ---- RBAC-Group (P2) ---- POST /api/v1/rbac/groups */
export async function createGroup(
  body: API.v1CreateGroupRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1Group>("/api/v1/rbac/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0} */
export async function getGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetGroupParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<API.v1Group>(`/api/v1/rbac/groups/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/groups/${param0} */
export async function updateGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateGroupParams,
  body: API.TestkitServiceUpdateGroupBody,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<API.v1Group>(`/api/v1/rbac/groups/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0} */
export async function deleteGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteGroupParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0}/members */
export async function listGroupMembers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupMembersParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<API.v1ListGroupMembersResponse>(
    `/api/v1/rbac/groups/${param0}/members`,
    {
      method: "GET",
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/rbac/groups/${param0}/members */
export async function addGroupMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AddGroupMemberParams,
  body: API.TestkitServiceAddGroupMemberBody,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/members`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0}/members/${param1} */
export async function removeGroupMember(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RemoveGroupMemberParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, userId: param1, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/v1/rbac/groups/${param0}/members/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 GET /api/v1/rbac/groups/${param0}/roles */
export async function listGroupRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListGroupRolesParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<API.v1ListGroupRolesResponse>(
    `/api/v1/rbac/groups/${param0}/roles`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/rbac/groups/${param0}/roles */
export async function addGroupRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AddGroupRoleParams,
  body: API.TestkitServiceAddGroupRoleBody,
  options?: { [key: string]: any }
) {
  const { groupId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/groups/${param0}/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/groups/${param0}/roles/${param1} */
export async function removeGroupRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RemoveGroupRoleParams,
  options?: { [key: string]: any }
) {
  const { groupId: param0, roleId: param1, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/v1/rbac/groups/${param0}/roles/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permission-groups */
export async function listPermissionGroups(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListPermissionGroupsParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListPermissionGroupsResponse>(
    "/api/v1/rbac/permission-groups",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/rbac/permission-groups */
export async function createPermissionGroup(
  body: API.v1CreatePermissionGroupRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1PermissionGroup>("/api/v1/rbac/permission-groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permission-groups/${param0} */
export async function getPermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetPermissionGroupParams,
  options?: { [key: string]: any }
) {
  const { permissionGroupId: param0, ...queryParams } = params;
  return request<API.v1PermissionGroup>(
    `/api/v1/rbac/permission-groups/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/permission-groups/${param0} */
export async function updatePermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdatePermissionGroupParams,
  body: API.TestkitServiceUpdatePermissionGroupBody,
  options?: { [key: string]: any }
) {
  const { permissionGroupId: param0, ...queryParams } = params;
  return request<API.v1PermissionGroup>(
    `/api/v1/rbac/permission-groups/${param0}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/permission-groups/${param0} */
export async function deletePermissionGroup(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeletePermissionGroupParams,
  options?: { [key: string]: any }
) {
  const { permissionGroupId: param0, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/v1/rbac/permission-groups/${param0}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** ---- RBAC-Permission (P2) ---- GET /api/v1/rbac/permissions */
export async function listPermissions(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListPermissionsParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListPermissionsResponse>("/api/v1/rbac/permissions", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/rbac/permissions */
export async function createPermission(
  body: API.v1CreatePermissionRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1Permission>("/api/v1/rbac/permissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/permissions/${param0} */
export async function getPermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetPermissionParams,
  options?: { [key: string]: any }
) {
  const { permissionId: param0, ...queryParams } = params;
  return request<API.v1Permission>(`/api/v1/rbac/permissions/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/permissions/${param0} */
export async function updatePermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdatePermissionParams,
  body: API.TestkitServiceUpdatePermissionBody,
  options?: { [key: string]: any }
) {
  const { permissionId: param0, ...queryParams } = params;
  return request<API.v1Permission>(`/api/v1/rbac/permissions/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/permissions/${param0} */
export async function deletePermission(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeletePermissionParams,
  options?: { [key: string]: any }
) {
  const { permissionId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/permissions/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/roles */
export async function listRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListRolesParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListRolesResponse>("/api/v1/rbac/roles", {
    method: "GET",
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** ---- RBAC-Role (P2) ---- POST /api/v1/rbac/roles */
export async function createRole(
  body: API.v1CreateRoleRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1Role>("/api/v1/rbac/roles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/roles/${param0} */
export async function getRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetRoleParams,
  options?: { [key: string]: any }
) {
  const { roleId: param0, ...queryParams } = params;
  return request<API.v1Role>(`/api/v1/rbac/roles/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 PUT /api/v1/rbac/roles/${param0} */
export async function updateRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.UpdateRoleParams,
  body: API.TestkitServiceUpdateRoleBody,
  options?: { [key: string]: any }
) {
  const { roleId: param0, ...queryParams } = params;
  return request<API.v1Role>(`/api/v1/rbac/roles/${param0}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/roles/${param0} */
export async function deleteRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DeleteRoleParams,
  options?: { [key: string]: any }
) {
  const { roleId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/roles/${param0}`, {
    method: "DELETE",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/rbac/users/${param0}/roles */
export async function listUserRoles(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUserRolesParams,
  options?: { [key: string]: any }
) {
  const { userId: param0, ...queryParams } = params;
  return request<API.v1ListUserRolesResponse>(
    `/api/v1/rbac/users/${param0}/roles`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/rbac/users/${param0}/roles */
export async function assignRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.AssignRoleParams,
  body: API.TestkitServiceAssignRoleBody,
  options?: { [key: string]: any }
) {
  const { userId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/rbac/users/${param0}/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 DELETE /api/v1/rbac/users/${param0}/roles/${param1} */
export async function revokeRole(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeRoleParams,
  options?: { [key: string]: any }
) {
  const { userId: param0, roleId: param1, ...queryParams } = params;
  return request<Record<string, any>>(
    `/api/v1/rbac/users/${param0}/roles/${param1}`,
    {
      method: "DELETE",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** ---- Session (P2) ---- GET /api/v1/sessions */
export async function listSessions(options?: { [key: string]: any }) {
  return request<API.v1ListSessionsResponse>("/api/v1/sessions", {
    method: "GET",
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/sessions/${param0} */
export async function getSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetSessionParams,
  options?: { [key: string]: any }
) {
  const { sessionId: param0, ...queryParams } = params;
  return request<API.v1GetSessionResponse>(`/api/v1/sessions/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/${param0}/revoke */
export async function revokeSession(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.RevokeSessionParams,
  options?: { [key: string]: any }
) {
  const { sessionId: param0, ...queryParams } = params;
  return request<Record<string, any>>(`/api/v1/sessions/${param0}/revoke`, {
    method: "POST",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/sessions/exchange */
export async function exchangeSessionCode(
  body: API.v1ExchangeSessionCodeRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1ExchangeSessionCodeResponse>(
    "/api/v1/sessions/exchange",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/sessions/issue-code */
export async function issueSessionCode(
  body: API.v1IssueSessionCodeRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1IssueSessionCodeResponse>(
    "/api/v1/sessions/issue-code",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 POST /api/v1/sessions/revoke-all */
export async function revokeAllSessions(options?: { [key: string]: any }) {
  return request<Record<string, any>>("/api/v1/sessions/revoke-all", {
    method: "POST",
    ...(options || {}),
  });
}

/** ---- Social (P2) ---- GET /api/v1/social/${param0}/url */
export async function getOAuthUrl(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetOAuthURLParams,
  options?: { [key: string]: any }
) {
  const { provider: param0, ...queryParams } = params;
  return request<API.v1GetOAuthURLResponse>(`/api/v1/social/${param0}/url`, {
    method: "GET",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/login */
export async function socialLogin(
  body: API.v1SocialLoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1SocialLoginResponse>("/api/v1/social/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/miniprogram */
export async function miniProgramLogin(
  body: API.v1MiniProgramLoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1SocialLoginResponse>("/api/v1/social/miniprogram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/social/miniprogram/phone */
export async function miniProgramPhoneLogin(
  body: API.v1MiniProgramPhoneLoginRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1SocialLoginResponse>(
    "/api/v1/social/miniprogram/phone",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 此处后端没有提供注释 GET /api/v1/users */
export async function listUsers(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUsersParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListUsersResponse>("/api/v1/users", {
    method: "GET",
    params: {
      // status has a default value: USER_STATUS_UNSPECIFIED
      status: "USER_STATUS_UNSPECIFIED",

      // gender has a default value: GENDER_UNSPECIFIED
      gender: "GENDER_UNSPECIFIED",
      // registerSource has a default value: IDENTITY_PROVIDER_UNSPECIFIED
      registerSource: "IDENTITY_PROVIDER_UNSPECIFIED",
      // registerDevice has a default value: DEVICE_TYPE_UNSPECIFIED
      registerDevice: "DEVICE_TYPE_UNSPECIFIED",

      // userType has a default value: USER_TYPE_UNSPECIFIED
      userType: "USER_TYPE_UNSPECIFIED",
      // orderBy has a default value: USER_SORT_FIELD_UNSPECIFIED
      orderBy: "USER_SORT_FIELD_UNSPECIFIED",
      ...params,
    },
    ...(options || {}),
  });
}

/** ---- Admin-Users (P2) ---- POST /api/v1/users */
export async function createUser(
  body: API.v1CreateUserRequest,
  options?: { [key: string]: any }
) {
  return request<API.v1CreateUserResponse>("/api/v1/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/${param0} */
export async function getUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetUserParams,
  options?: { [key: string]: any }
) {
  const { userId: param0, ...queryParams } = params;
  return request<API.v1User>(`/api/v1/users/${param0}`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 POST /api/v1/users/${param0}/disable */
export async function disableUser(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.DisableUserParams,
  body: API.TestkitServiceDisableUserBody,
  options?: { [key: string]: any }
) {
  const { userId: param0, ...queryParams } = params;
  return request<API.v1User>(`/api/v1/users/${param0}/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    params: { ...queryParams },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/login-logs */
export async function getLoginLogs(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.GetLoginLogsParams,
  options?: { [key: string]: any }
) {
  return request<API.v1GetLoginLogsResponse>("/api/v1/users/login-logs", {
    method: "GET",
    params: {
      // provider has a default value: IDENTITY_PROVIDER_UNSPECIFIED
      provider: "IDENTITY_PROVIDER_UNSPECIFIED",

      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/v1/users/paged */
export async function listUsersPaged(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.ListUsersPagedParams,
  options?: { [key: string]: any }
) {
  return request<API.v1ListUsersPagedResponse>("/api/v1/users/paged", {
    method: "GET",
    params: {
      // status has a default value: USER_STATUS_UNSPECIFIED
      status: "USER_STATUS_UNSPECIFIED",

      // gender has a default value: GENDER_UNSPECIFIED
      gender: "GENDER_UNSPECIFIED",
      // registerSource has a default value: IDENTITY_PROVIDER_UNSPECIFIED
      registerSource: "IDENTITY_PROVIDER_UNSPECIFIED",
      // registerDevice has a default value: DEVICE_TYPE_UNSPECIFIED
      registerDevice: "DEVICE_TYPE_UNSPECIFIED",
      // userType has a default value: USER_TYPE_UNSPECIFIED
      userType: "USER_TYPE_UNSPECIFIED",

      // orderBy has a default value: USER_SORT_FIELD_UNSPECIFIED
      orderBy: "USER_SORT_FIELD_UNSPECIFIED",

      ...params,
    },
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /ping */
export async function ping(options?: { [key: string]: any }) {
  return request<API.v1Pong>("/ping", {
    method: "GET",
    ...(options || {}),
  });
}
