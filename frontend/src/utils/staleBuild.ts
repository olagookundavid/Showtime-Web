// Recovering from a stale build: a tab opened before a deploy still points at
// the old chunk filenames, which the deploy removed, so the first lazy route it
// opens fails to load. The fix is a reload, which fetches the new index.html.
//
// Two places react to that failure, and they must agree on one rule:
//   - main.tsx, on Vite's `vite:preloadError`, reloads automatically.
//   - ErrorBoundary catches the same error a moment later (Vite re-throws it;
//     cancelling the event would hand React.lazy an empty module instead).
// While a reload is already underway the boundary shows the loader, not the
// "this page has changed" dialog — the user has nothing to do yet.

const REFRESH_KEY = "sffl_refresh_attempt_at";

// A refresh in the last minute that didn't help means reloading again won't
// either: stop and let the user decide, instead of looping.
const REFRESH_WINDOW_MS = 60_000;

let reloadPending = false;

export const isStaleBuildError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    error.message.includes("Failed to fetch dynamically imported module") ||
    error.message.includes("Importing a module script failed") ||
    error.message.includes("error loading dynamically imported module")
  );
};

export const recordRefreshAttempt = (): void => {
  try {
    sessionStorage.setItem(REFRESH_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the attempt goes unrecorded.
  }
};

export const clearRefreshAttempt = (): void => {
  try {
    sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
};

export const didRecentRefresh = (): boolean => {
  try {
    const at = parseInt(sessionStorage.getItem(REFRESH_KEY) ?? "", 10);
    return !isNaN(at) && Date.now() - at < REFRESH_WINDOW_MS;
  } catch {
    return false;
  }
};

// True from the moment reloadForNewBuild starts a reload until the page unloads.
export const isReloadPending = (): boolean => reloadPending;

// Reloads to pick up the new build, at most once per REFRESH_WINDOW_MS.
// Returns whether a reload is now underway. When sessionStorage is blocked the
// attempt can't be recorded across the reload, so it never auto-reloads there —
// that could loop forever — and leaves it to the dialog.
export const reloadForNewBuild = (): boolean => {
  if (reloadPending) return true;
  if (didRecentRefresh()) return false;
  recordRefreshAttempt();
  if (!didRecentRefresh()) return false;
  reloadPending = true;
  window.location.reload();
  return true;
};
