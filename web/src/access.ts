/**
 * Two-track frontend access (design spec §3.5).
 *
 * This is a FRONTEND route/menu split driven by UserType — NOT RBAC. Backend
 * admin endpoints do login-state + identity injection only this phase; RBAC is
 * CRUD-only and arrives later (OPA). The split:
 *   - canUser:    any logged-in user (incl. internal) → self-service pages
 *   - canInternal: UserType = USER_TYPE_INTERNAL      → back-office pages
 * Source of truth is the session stored at login (see pages/User/Login).
 */

const USER_TYPE_INTERNAL = 'USER_TYPE_INTERNAL';

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
  const loggedIn =
    !!localStorage.getItem('testkit_token') && !!user;
  return {
    canUser: loggedIn,
    canInternal: loggedIn && user?.userType === USER_TYPE_INTERNAL,
  };
}
