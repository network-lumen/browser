import { t } from '../stores/i18nStore';
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
 * Copy, then say so.
 *
 * The wording is deliberately not an argument. Nine call sites each wrote
 * their own pair - "Address copied!", "Ugly domain URL copied.", "Failed to
 * copy domain URL" - which is nine ways of saying one of two things, and the
 * user already knows what they clicked. Naming the thing back at them adds
 * nothing and guarantees the phrasings drift.
 *
 * Returns whether the copy worked, for callers that also change state on it.
 */
export async function copyToClipboardWithToast(text: string): Promise<boolean> {
  const toast = useToast();
  const ok = await copyToClipboard(text);
  toast.show(ok ? 'Copied' : t('Failed to copy'), ok ? 'success' : 'error');
  return ok;
}
