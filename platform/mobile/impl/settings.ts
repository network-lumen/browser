/**
 * The mobile port of `electron/ipc/settings.cjs` and `electron/settings.cjs`.
 *
 * Same document, same defaults, same normalisation - it just lives in
 * Preferences instead of a file. The gateway and private-cloud members are
 * here too, because the settings screen reads them on mount and a rejecting
 * stub would leave it half-drawn.
 */

import type { Settings } from '../../../src/types/platformBridge';
import { SETTINGS_KEY, readDoc, writeDoc } from './storage';

export const DEFAULT_SECURITY_SESSION_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Defaults differ from the desktop's in one place, deliberately: the local
 * gateway and IPFS API point at 127.0.0.1, which on a phone is the phone
 * itself, where nothing is listening. They stay in the document so the shape
 * matches, but nothing on this target should be dialling them.
 */
const DEFAULT_SETTINGS: Record<string, unknown> = Object.freeze({
  localGatewayBase: 'http://127.0.0.1:8088',
  lumenNetwork: 'mainnet',
  ipfsApiBase: 'http://127.0.0.1:5001',
  ipfsConnectivityMode: 'normal',
  localDriveMaxUploadSizeGb: 5,
  showSexualContent: false,
  showViolentContent: false,
  showDisturbingImagery: false,
  securitySessionTimeoutMs: DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
  securityPasswordEnabled: false,
  securityPasswordHash: null
});

let cached: Settings | null = null;

/**
 * Drops the in-memory copy so the next read comes from storage.
 *
 * The cache is safe in the app - one process, one writer - but it outlives the
 * storage it mirrors, so anything that wipes Preferences underneath it has to
 * say so. Tests do exactly that between cases.
 */
export function resetSettingsCache(): void {
  cached = null;
}

/** Subscribers of `settingsOnChanged`. */
const listeners = new Set<(settings: Settings) => void>();

export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  const disk = (await readDoc<Settings>(SETTINGS_KEY)) ?? {};
  cached = { ...DEFAULT_SETTINGS, ...disk };
  return cached;
}

export async function setSettings(partial: Settings): Promise<Settings> {
  const next = { ...(await getSettings()), ...partial };
  cached = next;
  await writeDoc(SETTINGS_KEY, next);
  for (const fn of listeners) {
    try {
      fn(next);
    } catch {
      // A throwing subscriber must not stop the others from hearing about it.
    }
  }
  return next;
}

export async function getSessionTimeoutMs(): Promise<number> {
  const value = Number((await getSettings()).securitySessionTimeoutMs);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SECURITY_SESSION_TIMEOUT_MS;
}

export const SETTINGS_MEMBERS = {
  settingsGetAll: async () => ({ ok: true, settings: await getSettings() }),

  settingsSet: async (partial: Settings) => ({ ok: true, settings: await setSettings(partial) }),

  settingsOnChanged: (callback: (settings: Settings) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  settingsLoadGateways: async () => ({ ok: true, gateways: [] as unknown[] }),

  settingsAddGateway: async () => ({ ok: false, error: 'not_supported_on_mobile' }),

  settingsUpdateGateway: async () => ({ ok: false, error: 'not_supported_on_mobile' }),

  settingsDeleteGateway: async () => ({ ok: false, error: 'not_supported_on_mobile' }),

  settingsLoadPrivateCloudConfig: async () => ({ ok: true, config: null }),

  settingsSavePrivateCloudConfig: async () => ({ ok: false, error: 'not_supported_on_mobile' }),

  clipboardWriteText: async (text: string) => {
    try {
      await navigator.clipboard.writeText(String(text ?? ''));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
};
