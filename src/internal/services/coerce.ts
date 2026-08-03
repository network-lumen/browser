/**
 * Defensive coercion of untrusted input into a usable value.
 *
 * Everything crossing an app boundary — IPC replies, webview messages, chain
 * responses, `localStorage` — arrives as `any`. These helpers narrow it without
 * ever throwing, so callers can stay linear instead of guarding each field.
 */

/** Upper bound applied to untrusted strings so a hostile payload can't blow up the UI. */
const DEFAULT_MAX_LENGTH = 4096;

/** Trimmed string, capped in length. Returns `''` for anything unusable. */
export function safeString(value: unknown, maxLen: number = DEFAULT_MAX_LENGTH): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/** Finite number, or `null` when the input can't be read as one. */
export function safeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Number forced into the `0..1` range; anything unparseable becomes `0`. */
export function clamp01(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** UTF-8 decodes a `Uint8Array`/byte array; passes strings through unchanged. */
export function bytesToText(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    const bytes = data instanceof Uint8Array
      ? data
      : Array.isArray(data)
        ? new Uint8Array(data)
        : null;
    return bytes ? new TextDecoder().decode(bytes) : '';
  } catch {
    return '';
  }
}
