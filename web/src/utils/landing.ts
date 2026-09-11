/**
 * Post-login landing route by user type (tenant platform spec §7.2):
 *   PLATFORM     → /dashboard  (cross-tenant back-office)
 *   TENANT_ADMIN → /tenant/credentials (ak/sk self-service home — ⑥ 验收
 *                后 租户管理 区为平台专属，租户管理员的落点是顶级密钥页)
 *   END_USER     → /profile    (personal self-service)
 *
 * Shared by Login (post-submit + already-authenticated visitor), Register,
 * and anywhere that needs "send this user to their home".
 */
export function postLoginTarget(userType?: string): string {
  if (userType === "USER_TYPE_PLATFORM") {
    return "/dashboard";
  }
  if (userType === "USER_TYPE_TENANT_ADMIN") {
    return "/tenant/credentials";
  }
  return "/profile";
}
