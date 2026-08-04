import { useInternalLumen } from '../../composables/useInternalLumen';
import { safeString } from './coerce';
import type { ExtensionInstallResult, InstalledExtension } from '../../types/extension';

export type { InstalledExtension };

/**
 * Shared access to the Chrome-extension host (`window.lumen.extensions`).
 *
 * Six pages talk to it — the extensions manager, the extension viewer, the
 * popup host, and the three webview hosts (web, IPFS, domain sites). They each
 * used to carry their own copy of the same defensive plumbing. The projection
 * of the extension list stays with the caller (each screen needs different
 * fields); everything below the projection lives here.
 */

function extensionsApi(): any | null {
  try {
    return useInternalLumen()?.extensions ?? null;
  } catch {
    return null;
  }
}

/**
 * Raw entries as reported by the host.
 *
 * Returns `null` — not `[]` — when the host is unavailable or answers with a
 * failure, so callers keep whatever list they already had instead of blanking
 * the UI on a transient error.
 */
export async function listInstalledExtensions(): Promise<any[] | null> {
  try {
    const api = extensionsApi();
    if (!api || typeof api.listExtensions !== 'function') return null;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return null;
    return Array.isArray(result.extensions) ? result.extensions : [];
  } catch {
    return null;
  }
}

/** Shapes one raw host entry; `null` when it carries no usable id. */
export function normalizeInstalledExtension(entry: any): InstalledExtension | null {
  const id = safeString(entry?.id);
  if (!id) return null;
  return {
    id,
    runtimeId: safeString(entry?.runtimeId),
    name: safeString(entry?.name || 'Extension') || 'Extension',
    enabled: !!entry?.enabled,
    launchUrl: safeString(entry?.launchUrl)
  };
}

/** The installed list in its normalized form, or `null` when unavailable. */
export async function fetchInstalledExtensions(): Promise<InstalledExtension[] | null> {
  const raw = await listInstalledExtensions();
  if (!raw) return null;
  return raw
    .map((entry) => normalizeInstalledExtension(entry))
    .filter((entry): entry is InstalledExtension => entry !== null);
}

/** Replaces the entry sharing `entry.id`, appending it when it is new. */
export function upsertExtension(
  list: InstalledExtension[],
  entry: InstalledExtension | null
): InstalledExtension[] {
  if (!entry) return list;
  return [...list.filter((item) => item.id !== entry.id), entry];
}

export function findExtensionByRuntimeId(
  list: InstalledExtension[],
  runtimeId: string
): InstalledExtension | null {
  const target = safeString(runtimeId);
  if (!target) return null;
  return list.find((entry) => safeString(entry.runtimeId) === target) ?? null;
}

/**
 * Turns a Lumen tab id into the numeric tab id the `chrome.tabs` shim has to
 * report. Numeric ids pass through; anything else is hashed into a stable
 * number well above the range Electron itself hands out.
 */
export function toSyntheticTabId(raw: string): number {
  const text = safeString(raw);
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 1) return Math.trunc(numeric);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  }
  return 1000 + (hash % 900000);
}

/** `chrome-extension://<runtimeId>/popup.html` -> `<runtimeId>`. */
export function getRuntimeIdFromExtensionUrl(rawUrl: string): string {
  try {
    return safeString(new URL(safeString(rawUrl)).hostname);
  } catch {
    return '';
  }
}

export function isChromeWebStoreUrl(raw: string): boolean {
  try {
    const host = safeString(new URL(safeString(raw)).hostname).toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

/**
 * Asks the host to install a Chrome Web Store extension. Failures are reported
 * back to the caller and logged under `logContext`, which names the screen the
 * request came from.
 */
export async function installExtensionFromChromeWebStore(
  input: string,
  logContext: string
): Promise<ExtensionInstallResult> {
  try {
    const api = extensionsApi();
    if (!api || typeof api.installFromChromeWebStore !== 'function') {
      return { ok: false, error: 'extensions_unavailable' };
    }
    const result = await api.installFromChromeWebStore(input);
    if (!result || result.ok === false) {
      const error = safeString(result?.error) || 'unknown_error';
      console.warn(`[${logContext}][extensions] install from store failed:`, error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (error: any) {
    const message = safeString(error?.message) || safeString(error) || 'unknown_error';
    console.warn(`[${logContext}][extensions] install from store failed:`, message);
    return { ok: false, error: message };
  }
}
