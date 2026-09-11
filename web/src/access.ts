/**
 * Three-track frontend access driven by UserType (tenant platform spec §7.2):
 *   - canUser:        any logged-in user → self-service pages (/profile)
 *   - canPlatform:    USER_TYPE_PLATFORM in the CROSS-TENANT view (no drilled
 *                     choice) → all back-office pages
 *   - canTenantAdmin: USER_TYPE_TENANT_ADMIN (own-tenant pages) — PLATFORM is
 *                     always included; a PLATFORM admin with a drilled tenant
 *                     choice sees the narrowed tenant view ONLY (⑤ 验收：
 *                     切换器选租户后菜单收敛，回「跨租户（全部）」恢复全量)
 * Source of truth is the session stored at login (pages/User/Login) and the
 * switcher's persisted choice (utils/tenantChoice) — both read synchronously
 * so the switcher's write + reload recomputes the menu.
 */
import { readTenantChoice } from '@/utils/tenantChoice';

const USER_TYPE_PLATFORM = 'USER_TYPE_PLATFORM';
const USER_TYPE_TENANT_ADMIN = 'USER_TYPE_TENANT_ADMIN';

function readUser(): API.User | undefined {
  try {
    const raw = localStorage.getItem('testkit_user');
    return raw ? (JSON.parse(raw) as API.User) : undefined;
  } catch {
    return undefined;
  }
}

export default function access(): Record<string, boolean> {
  const user = readUser();
  const loggedIn = !!localStorage.getItem('testkit_token') && !!user;
  const type = user?.userType;
  // A drilled choice narrows a PLATFORM session to the tenant view. The
  // choice is only ever non-empty for TENANT_ADMIN (binding default) and
  // drilling PLATFORM (switcher); it is cleared on login/logout.
  const drilled =
    type === USER_TYPE_PLATFORM && readTenantChoice() !== '';
  return {
    canUser: loggedIn,
    canPlatform: loggedIn && type === USER_TYPE_PLATFORM && !drilled,
    canTenantAdmin: loggedIn && (type === USER_TYPE_TENANT_ADMIN || type === USER_TYPE_PLATFORM),
  };
}
