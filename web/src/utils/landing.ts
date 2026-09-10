/**
 * Post-login landing route by user type (tenant platform spec §7.2):
 *   PLATFORM     → /dashboard  (cross-tenant back-office)
 *   TENANT_ADMIN → /tenant     (租户管理 self-service home — the phase ④
 *                fix for phase ①'s /profile dead angle)
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
    return "/tenant";
  }
  return "/profile";
}
