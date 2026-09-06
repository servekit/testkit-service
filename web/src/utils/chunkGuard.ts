/**
 * Self-heal for stale SPA deploys.
 *
 * umi lazy-loads every route as a content-hashed chunk. When the web image is
 * rebuilt, old chunk URLs vanish; a tab still running a previous build (or a
 * heuristically cached index.html) gets 404s on navigation — "Loading chunk
 * NNNN failed". A single forced reload pulls the new index.html and fixes it,
 * so: listen for resource-load failures on script/link tags and reload.
 *
 * The cooldown timestamp keeps this loop-proof: at most one forced reload per
 * window, so a genuinely broken build stays on its error page instead of
 * spinning, while a later stale tab can still self-heal.
 */

const RELOADED_AT_KEY = 'testkit_chunk_reloaded_at';
const RELOAD_COOLDOWN_MS = 30_000;

function isStaleResource(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !('tagName' in el)) {
    return false;
  }
  return el.tagName === 'SCRIPT' || el.tagName === 'LINK';
}

function withinCooldown(): boolean {
  const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
  return Date.now() - last < RELOAD_COOLDOWN_MS;
}

/** Installs the global listener. Call once at app bootstrap, before render. */
export function installChunkReloadGuard(): void {
  window.addEventListener(
    'error',
    (event) => {
      // Resource-load errors don't bubble; only capture sees them, and they
      // carry the failing element as target instead of an Error.
      if (event instanceof ErrorEvent || !isStaleResource(event.target)) {
        return;
      }
      if (withinCooldown()) {
        return;
      }
      sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
      window.location.reload();
    },
    true,
  );
}
