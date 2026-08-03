/** Delay between two attempts, and how many attempts before giving up. */
const RETRY_DELAY_MS = 50;
const DEFAULT_ATTEMPTS = 40;

/**
 * Reads a `<webview>`'s web contents id, or `null` while its guest has not
 * attached yet (or if the element is gone). Never throws.
 */
export function getWebviewWebContentsId(webview: any): number | null {
  if (!webview || typeof webview.getWebContentsId !== 'function') return null;
  try {
    const id = webview.getWebContentsId();
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Points the find bar at a tab's webview. Returns the id that was registered,
 * so callers can tell "registered" from "not ready yet".
 *
 * Registering `null` is meaningful: it clears the tab's target rather than
 * leaving the previous page's one in place.
 */
export function registerWebviewFindTarget(
  register: ((tabId: string, webContentsId: number | null) => void) | null | undefined,
  rawTabId: unknown,
  webContentsId: number | null
): number | null {
  const tabId = String(rawTabId || '').trim();
  if (!tabId || typeof register !== 'function') return null;
  try {
    register(tabId, webContentsId);
  } catch {
    // The provider is injected; a missing/failing one must not break the page.
  }
  return webContentsId;
}

/**
 * Retries a registration that needs a `<webview>`'s web contents id.
 *
 * An Electron `<webview>` only exposes `getWebContentsId()` once its guest has
 * attached, which happens some frames after `dom-ready`. Every page hosting a
 * webview polls for it the same way — to register the find-bar target, and on
 * personal-site pages the devtools target too. Only the reason to give up early
 * differs between them, which is what `shouldRetry` carries.
 *
 * @param register Attempts the registration; returns the id, or `null` while unavailable.
 * @param shouldRetry Optional per-page guard — retrying stops as soon as it returns `false`.
 */
export function retryWebviewRegistration(
  register: () => number | null,
  shouldRetry?: () => boolean,
  attempts: number = DEFAULT_ATTEMPTS
): void {
  if (register() != null) return;
  if (attempts <= 0) return;
  if (shouldRetry && !shouldRetry()) return;
  window.setTimeout(() => {
    retryWebviewRegistration(register, shouldRetry, attempts - 1);
  }, RETRY_DELAY_MS);
}
