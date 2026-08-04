import { computed, ref } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { uploadActivities } from '../common/upload';
import { STORAGE_KEYS, readJson, writeJson } from './storage';
import { clampPercent } from './coerce';
import type {
  ActivityItem,
  ActivityStatus,
  PersistedActivityEntry,
  RawPinJob,
  RawPropagationProgress
} from '../../types/activityCenter';

export type { ActivityItem };

/**
 * Single feed behind the navbar activity panel.
 *
 * It merges the three long-running things the app does — Drive uploads, managed
 * pin jobs and public-gateway propagation — which until now had no common
 * surface: uploads were an in-memory object polled by DrivePage, pin jobs were
 * durable but unreadable from the UI, and propagation reported progress nobody
 * displayed.
 *
 * This module only ever *reads* those sources. DrivePage keeps its own upload
 * panel and its own polling, untouched.
 */

/** Uploads live in a plain object mutated in place, so they have to be polled. */
const UPLOAD_POLL_MS = 700;
/** Finished entries kept in `localStorage`, newest first. */
const MAX_HISTORY = 100;

const liveUploads = ref<ActivityItem[]>([]);
const livePins = ref<ActivityItem[]>([]);
const livePropagations = ref<ActivityItem[]>([]);
const history = ref<PersistedActivityEntry[]>([]);

let started = false;
let uploadTimer: number | null = null;
let disposers: (() => void)[] = [];

function isFinal(status: ActivityStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/** `null` means "no ratio available", which renders an indeterminate bar. */
function percentOrNull(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return clampPercent(n);
}

// --- history -----------------------------------------------------------------

function loadHistory(): void {
  const raw = readJson<PersistedActivityEntry[]>(STORAGE_KEYS.activityHistory, []);
  history.value = Array.isArray(raw) ? raw.slice(0, MAX_HISTORY) : [];
}

function remember(item: ActivityItem): void {
  if (!isFinal(item.status)) return;
  if (history.value.some((entry) => entry.id === item.id)) return;
  const entry: PersistedActivityEntry = {
    id: item.id,
    kind: item.kind,
    status: item.status,
    title: item.title,
    detail: item.detail,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt || Date.now()
  };
  history.value = [entry, ...history.value].slice(0, MAX_HISTORY);
  writeJson(STORAGE_KEYS.activityHistory, history.value);
}

export function clearActivityHistory(): void {
  history.value = [];
  writeJson(STORAGE_KEYS.activityHistory, history.value);
}

// --- uploads -----------------------------------------------------------------

function readUploads(): void {
  const next: ActivityItem[] = [];
  for (const [key, activity] of Object.entries(uploadActivities)) {
    if (!activity) continue;
    const cancelling = Number(activity.uploadingCanceling || 0);
    const status: ActivityStatus = cancelling === 2 ? 'cancelled' : 'running';
    const now = Date.now();
    next.push({
      id: `upload:${key}`,
      kind: 'upload',
      status,
      title: String(activity.uploadingFile || 'Upload'),
      detail: cancelling === 1 ? 'Cancelling…' : 'Uploading to your local node',
      percent: percentOrNull(activity.uploadingPercent),
      startedAt: now,
      updatedAt: now,
      finishedAt: status === 'cancelled' ? now : 0,
      handle: key
    });
  }
  liveUploads.value = next;
}

// --- pin jobs ----------------------------------------------------------------

function pinStatus(raw: string): ActivityStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'failed') return 'failed';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'paused') return 'paused';
  return 'running';
}

function toPinItem(job: RawPinJob): ActivityItem | null {
  const id = String(job?.id || '').trim();
  if (!id) return null;
  const status = pinStatus(String(job?.status || ''));
  const retries = Number(job?.retryCount || 0);
  const detail =
    String(job?.error || '') ||
    String(job?.progressText || '') ||
    (retries > 0 ? `Retried ${retries}×` : 'Saving content from the network');
  return {
    id: `pin:${id}`,
    kind: 'pin',
    status,
    title: String(job?.name || job?.target || 'Pinned content'),
    detail,
    percent: percentOrNull(job?.progressPercent),
    startedAt: Number(job?.createdAt || 0) || Date.now(),
    updatedAt: Number(job?.updatedAt || 0) || Date.now(),
    finishedAt: Number(job?.completedAt || 0) || 0,
    handle: id
  };
}

async function refreshPins(): Promise<void> {
  try {
    const api: any = useInternalLumen();
    if (typeof api?.ipfsPinJobs !== 'function') return;
    const res = await api.ipfsPinJobs();
    if (!res || res.ok === false) return;
    const jobs: RawPinJob[] = Array.isArray(res.jobs) ? res.jobs : [];
    livePins.value = jobs
      .map((job) => toPinItem(job))
      .filter((item): item is ActivityItem => item !== null);
    for (const item of livePins.value) remember(item);
  } catch {
    // The panel is best-effort; a failed refresh keeps the previous list.
  }
}

// --- propagation -------------------------------------------------------------

function toPropagationItem(payload: RawPropagationProgress): ActivityItem | null {
  const cid = String(payload?.cid || '').trim();
  if (!cid) return null;
  const total = Number(payload?.total || 0);
  const completed = Number(payload?.completed || 0);
  const stage = String(payload?.stage || '').trim();
  const done = stage === 'done' || (total > 0 && completed >= total);
  const now = Date.now();
  return {
    id: `propagation:${cid}`,
    kind: 'propagation',
    status: done ? 'completed' : 'running',
    title: cid,
    detail: total
      ? `${Number(payload?.succeeded || 0)}/${total} public gateways`
      : 'Contacting public gateways…',
    percent: total > 0 ? percentOrNull((completed / total) * 100) : null,
    startedAt: now,
    updatedAt: now,
    finishedAt: done ? now : 0,
    handle: cid
  };
}

function mergePropagation(payload: RawPropagationProgress): void {
  const item = toPropagationItem(payload);
  if (!item) return;
  const existing = livePropagations.value.find((x) => x.id === item.id);
  if (existing) item.startedAt = existing.startedAt;
  livePropagations.value = [item, ...livePropagations.value.filter((x) => x.id !== item.id)];
  remember(item);
}

// --- public surface ----------------------------------------------------------

/** Live entries first (newest update first), then the persisted history. */
export const activityItems = computed<ActivityItem[]>(() => {
  const live = [...liveUploads.value, ...livePins.value, ...livePropagations.value]
    .filter((item) => !isFinal(item.status))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const liveIds = new Set(live.map((item) => item.id));
  const past: ActivityItem[] = history.value
    .filter((entry) => !liveIds.has(entry.id))
    .map((entry) => ({
      ...entry,
      percent: entry.status === 'completed' ? 100 : null,
      updatedAt: entry.finishedAt,
      handle: ''
    }));

  return [...live, ...past];
});

/** Entries still in flight — drives the navbar badge. */
export const runningActivityCount = computed(
  () => activityItems.value.filter((item) => item.status === 'running').length
);

export function pauseActivity(item: ActivityItem): void {
  if (item.kind !== 'pin') return;
  void (useInternalLumen() as any)?.ipfsPinPause?.(item.handle);
  void refreshPins();
}

export function resumeActivity(item: ActivityItem): void {
  if (item.kind !== 'pin') return;
  void (useInternalLumen() as any)?.ipfsPinResume?.(item.handle);
  void refreshPins();
}

export function cancelActivity(item: ActivityItem): void {
  const api: any = useInternalLumen();
  if (item.kind === 'pin') {
    void api?.ipfsPinCancel?.(item.handle);
    void refreshPins();
    return;
  }
  if (item.kind === 'propagation') {
    void api?.ipfsCancelPublicGatewayPropagation?.();
  }
}

/** Whether this entry exposes each control. Only pin jobs are resumable. */
export function activityControls(item: ActivityItem): {
  pause: boolean;
  resume: boolean;
  cancel: boolean;
} {
  if (isFinal(item.status)) return { pause: false, resume: false, cancel: false };
  return {
    pause: item.kind === 'pin' && item.status === 'running',
    resume: item.kind === 'pin' && item.status === 'paused',
    cancel: item.kind === 'pin' || item.kind === 'propagation'
  };
}

/** Idempotent: safe to call from every component that shows the panel. */
export function initActivityCenter(): void {
  if (started) return;
  started = true;

  loadHistory();
  void refreshPins();

  readUploads();
  uploadTimer = window.setInterval(readUploads, UPLOAD_POLL_MS);

  const api: any = useInternalLumen();
  if (typeof api?.ipfsOnPinProgress === 'function') {
    disposers.push(api.ipfsOnPinProgress(() => void refreshPins()));
  }
  if (typeof api?.ipfsOnPublicGatewayPropagationProgress === 'function') {
    disposers.push(
      api.ipfsOnPublicGatewayPropagationProgress((payload: RawPropagationProgress) =>
        mergePropagation(payload || {})
      )
    );
  }
}

/** Only needed by tests and hot reload; the panel lives for the app's lifetime. */
export function stopActivityCenter(): void {
  if (uploadTimer != null) window.clearInterval(uploadTimer);
  uploadTimer = null;
  for (const dispose of disposers) {
    try {
      dispose();
    } catch {
      // ignore
    }
  }
  disposers = [];
  started = false;
}
