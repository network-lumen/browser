import { useInternalLumen } from './useInternalLumen';

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
