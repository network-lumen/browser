import { ref } from "vue";

export type AppSettings = {
  localGatewayBase: string;
  ipfsApiBase: string;
};

export const DEFAULT_APP_SETTINGS: AppSettings = Object.freeze({
  localGatewayBase: "http://127.0.0.1:8080",
  ipfsApiBase: "http://127.0.0.1:5001",
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

function mergeSettings(partial: Partial<AppSettings> | null | undefined): AppSettings {
  const cur = appSettingsState.value;
  const p = partial || {};
  return {
    localGatewayBase: normalizeBaseUrl(
      String(p.localGatewayBase ?? cur.localGatewayBase),
      DEFAULT_APP_SETTINGS.localGatewayBase,
    ),
    ipfsApiBase: normalizeBaseUrl(
      String(p.ipfsApiBase ?? cur.ipfsApiBase),
      DEFAULT_APP_SETTINGS.ipfsApiBase,
    ),
  };
}

export async function initAppSettings(): Promise<void> {
  const lum: any = (window as any)?.lumen;
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
  const lum: any = (window as any)?.lumen;
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

export function getIpfsApiBase(): string {
  return String(appSettingsState.value.ipfsApiBase || DEFAULT_APP_SETTINGS.ipfsApiBase).replace(/\/+$/, "");
}

