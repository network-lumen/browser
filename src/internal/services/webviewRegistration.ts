/** Delay between two attempts, and how many attempts before giving up. */
const RETRY_DELAY_MS = 50;
const DEFAULT_ATTEMPTS = 40;

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
