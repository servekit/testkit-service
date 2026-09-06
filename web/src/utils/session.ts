/**
 * Client-side session teardown, shared by the layout avatar menu and the
 * Profile page's logout button.
 *
 * Order matters: revoke the session server-side FIRST (the logout RPC carries
 * the Bearer token, so the backend knows which session to revoke), then clear
 * local state. A failed revoke — e.g. the session already expired and the
 * request layer's 401 handler took over — must not block local cleanup, so
 * the error is swallowed and the redirect always happens.
 */
import { logout } from '@/services/testkit/testkitService';

export async function endSession(): Promise<void> {
  try {
    await logout();
  } catch {
    // Session already invalid server-side / network gone. The request layer's
    // 401 handler has already cleared storage and redirected on auth failures;
    // the cleanup below is still correct for every other error shape.
  }
  localStorage.removeItem('testkit_token');
  localStorage.removeItem('testkit_user');
  // Full navigation (not history.push): remounts the app so getInitialState
  // drops the stale currentUser and ProLayout no longer shows the old chip.
  window.location.href = '/user/login';
}
