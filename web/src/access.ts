/**
 * Three-track frontend access driven by UserType (tenant platform spec §7.2):
 *   - canUser:        any logged-in user → self-service pages (/profile)
 *   - canPlatform:    USER_TYPE_PLATFORM → all back-office pages (cross-tenant view)
 *   - canTenantAdmin: USER_TYPE_TENANT_ADMIN → own-tenant admin pages (phase ④)
 * Source of truth is the session stored at login (pages/User/Login).
 */
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
  return {
    canUser: loggedIn,
    canPlatform: loggedIn && type === USER_TYPE_PLATFORM,
    canTenantAdmin: loggedIn && (type === USER_TYPE_TENANT_ADMIN || type === USER_TYPE_PLATFORM),
  };
}
