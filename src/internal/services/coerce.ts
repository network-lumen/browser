/**
 * Defensive coercion of untrusted input into a usable value.
 *
 * Everything crossing an app boundary — IPC replies, webview messages, chain
 * responses, `localStorage` — arrives as `any`. These helpers narrow it without
 * ever throwing, so callers can stay linear instead of guarding each field.
 */

/**
 * Upper bound applied to untrusted strings so a hostile payload can't blow up
 * the UI.
 *
 * 4096, where the main process's `electron/utils/strings.cjs` uses 2048. The
 * two are separate implementations by necessity - this is bundled TypeScript
 * and cannot require a `.cjs` from the other process - and the difference is
 * live here: about half the calls in `src/` omit the argument, while every
 * call on the main-process side passes one. Lowering it to match would start
 * truncating strings that reach the UI today.
 */
const DEFAULT_MAX_LENGTH = 4096;

/** Trimmed string, capped in length. Returns `''` for anything unusable. */
export function safeString(value: unknown, maxLen: number = DEFAULT_MAX_LENGTH): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/**
 * The readable part of anything thrown, for showing to a user.
 *
 * A `catch` binding is `unknown`, and what actually arrives varies: an `Error`,
 * a rejected IPC reply, a bare string, sometimes `undefined`. Call sites used
 * to spell this out inline, which forced the binding to be annotated `any` and
 * so gave up type-checking for the whole block.
 *
 * Objects yield their `message` and never `String(obj)` - a plain object would
 * otherwise reach the user as `[object Object]`, which the inline form did.
 * Primitives yield themselves, so a thrown string survives instead of being
 * flattened into the fallback.
 */
export function errorMessage(error: unknown, fallback = ''): string {
  if (error && typeof error === 'object') {
    const message = safeString((error as { message?: unknown }).message);
    if (message) return message;
  } else {
    const raw = safeString(error);
    if (raw) return raw;
  }
  return fallback;
}

/**
 * `decodeURIComponent` that returns its input instead of throwing.
 *
 * A lone `%` or a truncated escape is a URIError, and URLs reaching this app
 * come from users typing, from pages navigating and from IPNS records - none
 * of which owe us well-formed percent-encoding. Three files had written this
 * out identically.
 */
export function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Finite number, or `null` when the input can't be read as one. */
export function safeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Restricts a value to `[min, max]`. Anything unparseable becomes `min`, so
 * callers never have to test for NaN separately.
 */
export function clamp(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n <= min) return min;
  if (n >= max) return max;
  return n;
}

/** Number forced into the `0..1` range; anything unparseable becomes `0`. */
export function clamp01(value: unknown): number {
  return clamp(value, 0, 1);
}

/**
 * Percentage forced into `0..100`. Does not round — call sites that want whole
 * percents round first, so the rounding stays visible where it matters.
 */
export function clampPercent(value: unknown): number {
  return clamp(value, 0, 100);
}

/**
 * Hex-encodes raw bytes, two lowercase digits per byte.
 *
 * Used for digests, so the two call sites disagreed on case: Tendermint tx
 * hashes are uppercase, the thumbnail cache keys are lowercase.
 */
export function bytesToHex(data: ArrayBuffer | Uint8Array, uppercase = false): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i]!.toString(16).padStart(2, '0');
  return uppercase ? out.toUpperCase() : out;
}

/**
 * UTF-8 decodes a `Uint8Array`/byte array; passes strings through unchanged.
 *
 * Uses `ArrayBuffer.isView` rather than `instanceof Uint8Array`, which is only
 * true for a view built by *this* realm. Bytes here arrive over the
 * contextBridge from the preload, and a typed array that crossed a realm
 * boundary failed the `instanceof` test and decoded to `''` - not an error, an
 * empty string, which a caller renders as blank content rather than reporting.
 */
export function bytesToText(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : Array.isArray(data)
        ? new Uint8Array(data)
        : null;
    return bytes ? new TextDecoder().decode(bytes) : '';
  } catch {
    return '';
  }
}
