import { computed, ref } from 'vue';
import pkg from '../../../package.json';

type LatestPayload = {
  version: string;
  channel: string;
  platform: string;
  kind: string;
  release: any;
  artifact: {
    platform: string;
    kind: string;
    size?: number | null;
    sha256Hex?: string | null;
    urls?: string[];
    cid?: string | null;
  };
  downloadUrl: string | null;
};

const REMIND_INTERVAL_MS = 10 * 60 * 1000;
const STORAGE_SNOOZE_UNTIL = 'lumen:release:snoozeUntil';
const STORAGE_SKIP_VERSION = 'lumen:release:skipVersion';

const latest = ref<LatestPayload | null>(null);
const shouldPrompt = ref(false);
const busy = ref(false);
const initialized = ref(false);
let unsub: null | (() => void) = null;

function getCurrentVersion(): string {
  return String((pkg as any)?.version || '');
}

function readSnoozeUntil(): number {
  try {
    const raw = localStorage.getItem(STORAGE_SNOOZE_UNTIL);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeSnoozeUntil(ts: number) {
  try {
    localStorage.setItem(STORAGE_SNOOZE_UNTIL, String(ts || 0));
  } catch {}
}

function readSkipVersion(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_SKIP_VERSION);
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}

function writeSkipVersion(v: string | null) {
  try {
    if (!v) localStorage.removeItem(STORAGE_SKIP_VERSION);
    else localStorage.setItem(STORAGE_SKIP_VERSION, String(v));
  } catch {}
}

function evaluatePrompt() {
  const info = latest.value;
  const currentVersion = getCurrentVersion();
  if (!info || !info.version || !currentVersion) {
    shouldPrompt.value = false;
    return;
  }
  if (info.version === currentVersion) {
    shouldPrompt.value = false;
    return;
  }
  const skipVersion = readSkipVersion();
  if (skipVersion && skipVersion === info.version) {
    shouldPrompt.value = false;
    return;
  }
  const snoozeUntil = readSnoozeUntil();
  if (snoozeUntil && Date.now() < snoozeUntil) {
    shouldPrompt.value = false;
    return;
  }
  shouldPrompt.value = true;
}

function updateLatest(payload: LatestPayload | null) {
  latest.value = payload;
  evaluatePrompt();
}

async function fetchSnapshot() {
  try {
    const info = await (window as any).lumen?.release?.getLatestInfo?.();
    if (info && info.version) updateLatest(info);
  } catch {
    // ignore
  }
}

function handleReleaseEvent(payload: any) {
  if (!payload || !payload.version) return;
  // A new version should override any old skip/snooze.
  writeSkipVersion(null);
  writeSnoozeUntil(0);
  updateLatest(payload);
}

async function initReleaseUpdates() {
  if (initialized.value) return;
  initialized.value = true;
  await fetchSnapshot();
  try {
    unsub = (window as any).lumen?.release?.onUpdateAvailable?.(handleReleaseEvent) || null;
  } catch {
    unsub = null;
  }
}

async function updateNow() {
  if (!latest.value) return;
  const url = latest.value.downloadUrl;
  if (!url) return;
  busy.value = true;
  try {
    await (window as any).lumen?.release?.openExternal?.(url);
  } catch {
    // ignore
  } finally {
    busy.value = false;
  }
  writeSkipVersion(latest.value.version);
  shouldPrompt.value = false;
}

function remindLater() {
  if (!latest.value) return;
  writeSnoozeUntil(Date.now() + REMIND_INTERVAL_MS);
  evaluatePrompt();
}

export function useReleaseUpdates() {
  void initReleaseUpdates();
  return {
    latest,
    shouldPrompt,
    currentVersion: computed(() => getCurrentVersion()),
    updateNow,
    remindLater,
    busy: computed(() => busy.value)
  };
}

export function formatReleaseSize(size?: number | null) {
  if (!size) return '';
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

