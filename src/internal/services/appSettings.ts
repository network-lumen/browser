import { ref } from "vue";
import { useInternalLumen } from '../../composables/useInternalLumen';
import {
  DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
  normalizeSecuritySessionTimeoutMs,
} from "./securitySessionTimeout";
import type { IpfsConnectivityMode, AppSettings } from "../../types/settings";

export type { IpfsConnectivityMode, AppSettings };

export const BYTES_PER_GIB = 1024 * 1024 * 1024;
export const DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB = 10;
const MAX_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB = Math.floor(Number.MAX_SAFE_INTEGER / BYTES_PER_GIB);

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  localGatewayBase: "http://127.0.0.1:8080",
  ipfsApiBase: "http://127.0.0.1:5001",
  ipfsConnectivityMode: "normal",
  localDriveMaxUploadSizeGb: DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
  showSexualContent: false,
  showViolentContent: false,
  showDisturbingImagery: false,
  securitySessionTimeoutMs: DEFAULT_SECURITY_SESSION_TIMEOUT_MS,
});

export const appSettingsState = ref<AppSettings>({ ...DEFAULT_APP_SETTINGS });

function normalizeBaseUrl(input: string, fallback: string): string {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    u.hash = "";
    u.search = "";
    const out = u.toString().replace(/\/+$/, "");
    return out || fallback;
  } catch {
    return fallback;
  }
}

function normalizeIpfsConnectivityMode(
  input: unknown,
  fallback: IpfsConnectivityMode = DEFAULT_APP_SETTINGS.ipfsConnectivityMode,
): IpfsConnectivityMode {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "light" || value === "normal" || value === "high") {
    return value;
  }
  return fallback;
}

function normalizeLocalDriveMaxUploadSizeGb(
  input: unknown,
  fallback = DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB,
): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  const normalized = Math.trunc(n);
  if (normalized < 1) return fallback;
  return Math.min(normalized, MAX_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB);
}

function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  const cur = appSettingsState.value;
  const p = partial || {};
  const hasSecuritySessionTimeoutMs = Object.prototype.hasOwnProperty.call(
    p,
    "securitySessionTimeoutMs",
  );
  return {
    localGatewayBase: normalizeBaseUrl(
      String(p.localGatewayBase ?? cur.localGatewayBase),
      DEFAULT_APP_SETTINGS.localGatewayBase,
    ),
    ipfsApiBase: normalizeBaseUrl(
      String(p.ipfsApiBase ?? cur.ipfsApiBase),
      DEFAULT_APP_SETTINGS.ipfsApiBase,
    ),
    ipfsConnectivityMode: normalizeIpfsConnectivityMode(
      p.ipfsConnectivityMode ?? cur.ipfsConnectivityMode,
      DEFAULT_APP_SETTINGS.ipfsConnectivityMode,
    ),
    localDriveMaxUploadSizeGb: normalizeLocalDriveMaxUploadSizeGb(
      p.localDriveMaxUploadSizeGb ?? cur.localDriveMaxUploadSizeGb,
      DEFAULT_APP_SETTINGS.localDriveMaxUploadSizeGb,
    ),
    showSexualContent: Boolean(p.showSexualContent ?? cur.showSexualContent),
    showViolentContent: Boolean(p.showViolentContent ?? cur.showViolentContent),
    showDisturbingImagery: Boolean(p.showDisturbingImagery ?? cur.showDisturbingImagery),
    securitySessionTimeoutMs: normalizeSecuritySessionTimeoutMs(
      hasSecuritySessionTimeoutMs ? p.securitySessionTimeoutMs : cur.securitySessionTimeoutMs,
      DEFAULT_APP_SETTINGS.securitySessionTimeoutMs,
    ),
  };
}

export async function initAppSettings(): Promise<void> {
  const lum: any = useInternalLumen();
  if (!lum || typeof lum.settingsGetAll !== "function") return;
  try {
    const res = await lum.settingsGetAll();
    if (res?.ok && res?.settings) {
      appSettingsState.value = mergeSettings(res.settings);
    }
    if (typeof lum.settingsOnChanged === "function") {
      lum.settingsOnChanged((next: any) => {
        appSettingsState.value = mergeSettings(next);
      });
    }
  } catch {
    // ignore
  }
}

export async function setAppSettings(partial: Partial<AppSettings>): Promise<{ ok: boolean; settings?: AppSettings; error?: string }> {
  const lum: any = useInternalLumen();
  if (!lum || typeof lum.settingsSet !== "function") {
    appSettingsState.value = mergeSettings(partial);
    return { ok: false, error: "settings_unavailable" };
  }
  const normalized = mergeSettings(partial);
  const res = await lum.settingsSet(normalized).catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
  if (res?.ok && res?.settings) {
    appSettingsState.value = mergeSettings(res.settings);
    return { ok: true, settings: appSettingsState.value };
  }
  return { ok: false, error: String(res?.error || "settings_set_failed") };
}

export function getLocalGatewayBase(): string {
  return String(appSettingsState.value.localGatewayBase || DEFAULT_APP_SETTINGS.localGatewayBase).replace(/\/+$/, "");
}

