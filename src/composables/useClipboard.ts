import { useInternalLumen } from './useInternalLumen';
import { useToast } from './useToast';

/**
 * Copies text to the system clipboard. `navigator.clipboard.writeText` can
 * silently reject in Electron depending on window focus/origin, so this
 * falls back to the main-process clipboard bridge (`window.lumen.clipboardWriteText`)
 * when the browser API fails.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Electron pages can deny navigator.clipboard depending on origin and focus.
  }
  try {
    const lumen = useInternalLumen();
    if (typeof lumen?.clipboardWriteText === 'function') {
      const result = await lumen.clipboardWriteText(text);
      return result === true || result?.ok === true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Copy, then say so. Pages kept re-wrapping `copyToClipboard` with the same
 * success/failure toast pair and only differed in wording, so the wording is
 * the argument and the behaviour is here.
 *
 * Returns whether the copy worked, for callers that also change state on it.
 */
export async function copyToClipboardWithToast(
  text: string,
  successMessage = 'Copied to clipboard',
  failureMessage = 'Failed to copy to clipboard'
): Promise<boolean> {
  const toast = useToast();
  const ok = await copyToClipboard(text);
  toast.show(ok ? successMessage : failureMessage, ok ? 'success' : 'error');
  return ok;
}
