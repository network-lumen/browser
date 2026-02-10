import { computed, ref } from 'vue';
import pkg from '../../../package.json';
import { addToast } from '../../stores/toastStore';

type LatestPayload = {
  version: string;
  channel: string;
  platform: string;
  kind: string;
  release: any;
  blocked?: boolean;
  blockedReason?: string | null;
  blockedMessage?: string | null;
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

const latest = ref<LatestPayload | null>(null);
const shouldPrompt = ref(false);
const busy = ref(false);
const updateProgress = ref<any | null>(null);
const initialized = ref(false);
let unsub: null | (() => void) = null;
let unsubProgress: null | (() => void) = null;
let lastBlockedToastKey = '';

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

function evaluatePrompt() {
  const info = latest.value;
  const currentVersion = getCurrentVersion();
  if (!info || !info.version || !currentVersion) {
    shouldPrompt.value = false;
    return;
  }
  if ((info as any).blocked) {
    shouldPrompt.value = false;
    return;
  }
  if (info.version === currentVersion) {
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

function maybeToastBlocked(info: LatestPayload | null) {
  if (!info || !(info as any).blocked) return;
  const v = String(info.version || '').trim();
  const reason = String((info as any).blockedReason || '').trim();
  if (!v) return;
  const key = `${v}|${reason}`;
  if (key === lastBlockedToastKey) return;
  lastBlockedToastKey = key;

  const msg = String((info as any).blockedMessage || '').trim() || 'This version seems unstable on your system. Please try again later.';
  try {
    addToast('warning', msg);
  } catch {
    // ignore toast failures
  }
}

function updateLatest(payload: LatestPayload | null) {
  latest.value = payload;
  maybeToastBlocked(payload);
  evaluatePrompt();
}

async function fetchSnapshot() {
  try {
    const api = (window as any).lumen?.release;
    if (!api) return;

    // `getLatestInfo()` is backed by the main-process watcher cache. On cold start (or if the first
    // poll failed), the cache can be empty until the next polling tick.
    // To keep UX snappy, do a best-effort `pollNow()` once when the cache is empty.
    const currentVersion = getCurrentVersion();
    let info = await api.getLatestInfo?.();
    if (!info || !info.version) {
      info = await api.pollNow?.();
    } else if (currentVersion && String(info.version) === currentVersion) {
      // If the watcher cache says "same version", it can still be stale (e.g. the first poll happened
      // before the newest release propagated). Do a single best-effort refresh on startup.
      info = (await api.pollNow?.()) || info;
    }

    if (info && info.version) updateLatest(info);
  } catch {
    // ignore
  }
}

function handleReleaseEvent(payload: any) {
  if (!payload || !payload.version) return;
  // A new version should override any old snooze.
  writeSnoozeUntil(0);
  updateLatest(payload);
}

function handleProgressEvent(payload: any) {
  if (!payload || typeof payload !== 'object') return;
  updateProgress.value = payload;
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
  try {
    unsubProgress = (window as any).lumen?.release?.onUpdateProgress?.(handleProgressEvent) || null;
  } catch {
    unsubProgress = null;
  }
}

async function openExternalAndSnooze(url: string) {
  await (window as any).lumen?.release?.openExternal?.(url);
  // External install flow: avoid re-prompting immediately, but don't permanently skip.
  writeSnoozeUntil(Date.now() + REMIND_INTERVAL_MS);
  evaluatePrompt();
}

async function updateNow() {
  if (!latest.value) return;
  const url = latest.value.downloadUrl;
  if (!url) return;
  busy.value = true;
  try {
    const sha256Hex = latest.value.artifact?.sha256Hex || null;
    const sizeBytes = latest.value.artifact?.size ?? null;
    const api = (window as any).lumen?.release?.downloadAndInstall;
    if (typeof api === 'function') {
      updateProgress.value = { stage: 'starting' };
      const res = await api({ url, sha256Hex, sizeBytes, silent: false, label: latest.value.version });
      if (res && res.ok === false) {
        const err = String(res.error || '').trim();
        if (err === 'unsupported_platform') {
          updateProgress.value = null;
          await openExternalAndSnooze(url);
          return;
        }
        throw new Error(err || 'Update failed');
      }
      // If we reach here, the installer was launched; the app will quit shortly.
      shouldPrompt.value = false;
      return;
    } else {
      updateProgress.value = null;
      await openExternalAndSnooze(url);
    }
  } catch (e: any) {
    updateProgress.value = { stage: 'error', error: String(e?.message || e || 'Update failed') };
  } finally {
    busy.value = false;
  }
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
    busy: computed(() => busy.value),
    updateProgress: computed(() => updateProgress.value),
    clearUpdateProgress: () => {
      updateProgress.value = null;
    }
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
