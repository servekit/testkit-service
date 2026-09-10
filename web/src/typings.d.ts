// Convenience aliases over the generated types. @umijs/openapi preserves the
// swagger `v1` prefix on generated type names (e.g. API.v1User, API.v1TokenResponse),
// but the application refers to the clean names API.User / API.TokenResponse /
// API.LoginRequest. This file namespace-merges with the generated
// src/services/testkit/typings.d.ts, so the aliases track the generator output
// automatically — regenerate-safe, no hand-maintenance.
declare namespace API {
  // --- Entities (regenerate-safe aliases over generated v1* types) ---
  type User = v1User;
  type Role = v1Role;
  type Group = v1Group;
  type Permission = v1Permission;
  type PermissionGroup = v1PermissionGroup;
  type Session = v1Session;
  type Identity = v1Identity;
  type LoginLog = v1LoginLog;
  type UserRole = v1UserRole;
  type GroupMember = v1GroupMember;

  // --- Request/response aliases used in page forms ---
  type TokenResponse = v1TokenResponse;
  type LoginRequest = v1LoginRequest;
  type UpdateProfileRequest = v1UpdateProfileRequest;
  type ChangePasswordRequest = v1ChangePasswordRequest;
  type BindIdentityRequest = v1BindIdentityRequest;
  type CreateRoleRequest = v1CreateRoleRequest;
  type CreateGroupRequest = v1CreateGroupRequest;
  type CreatePermissionRequest = v1CreatePermissionRequest;
  type CreatePermissionGroupRequest = v1CreatePermissionGroupRequest;
  type CreateUserRequest = v1CreateUserRequest;

  // --- Phase ④ tenant platform (portal admin forwards) ---
  type TenantInfo = v1TenantInfo;
  type ApiKeyInfo = v1ApiKeyInfo;
  type TenantMember = v1TenantMember;
  type TenantMembership = v1TenantMembership;
  type WhoAmIResponse = v1WhoAmIResponse;
  type MyCapabilitiesResponse = v1MyCapabilitiesResponse;
  type ListTenantsResponse = v1ListTenantsResponse;
  type ListApiKeysResponse = v1ListApiKeysResponse;
  type CreateApiKeyResponse = v1CreateApiKeyResponse;
  type RotateApiKeySecretResponse = v1RotateApiKeySecretResponse;
  type SetCapabilityResponse = v1SetCapabilityResponse;
  type ListTenantMembersResponse = v1ListTenantMembersResponse;
}
