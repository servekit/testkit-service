/**
 * The tenant switcher's locally-persisted choice (tenant platform spec §5.3).
 *
 * The choice is the EXPLICIT tenant a management-plane request operates as:
 *   - TENANT_ADMIN: one of their portal bindings (multi-binding admins must
 *     send it on every request; a single binding may omit it and the door
 *     defaults it — the app still persists it so the switcher has one code
 *     path);
 *   - PLATFORM: the drill-down tenant, or empty = the cross-tenant view.
 *
 * localStorage is the source of truth so the umi request interceptor can
 * read it synchronously on every call (the door strips the header and
 * converts it into the trusted x-tenant-key server-side; it never crosses
 * into the services). Switching writes here and reloads the app — the
 * session (bearer token) is untouched: 切换租户不换会话、不重登录.
 *
 * Cleared wherever the session identity changes (logout, 401 handler) so a
 * stale choice from a previous user can never ride a fresh login.
 */
export const TENANT_CHOICE_STORAGE_KEY = "testkit_tenant_choice";

/** The current choice; "" = none (PLATFORM cross-view / TENANT_ADMIN default). */
export function readTenantChoice(): string {
  try {
    return localStorage.getItem(TENANT_CHOICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Persist the choice ("" = explicitly none, e.g. PLATFORM cross-view). */
export function writeTenantChoice(key: string): void {
  try {
    localStorage.setItem(TENANT_CHOICE_STORAGE_KEY, key);
  } catch {
    // Private-mode storage failures are non-fatal: the switcher keeps
    // working per-load, it just won't survive a refresh.
  }
}

/** Drop the stored choice (logout / session loss / user switch). */
export function clearTenantChoice(): void {
  try {
    localStorage.removeItem(TENANT_CHOICE_STORAGE_KEY);
  } catch {
    // see writeTenantChoice
  }
}

/**
 * Validate + normalize the stored choice against a binding set (TENANT_ADMIN
 * bootstrap): returns the stored key when still bound, the first binding as
 * a fresh default otherwise (and persists that default so the very next
 * management request already carries it).
 */
export function ensureTenantChoice(memberships: API.TenantMembership[]): string {
  const stored = readTenantChoice();
  const keys = memberships.map((m) => m.tenantKey ?? "").filter(Boolean);
  if (keys.includes(stored)) {
    return stored;
  }
  const fallback = keys[0] ?? "";
  writeTenantChoice(fallback);
  return fallback;
}
