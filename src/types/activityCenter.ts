/** What produced an activity entry. */
export type ActivityKind = 'upload' | 'pin' | 'propagation';

/**
 * Normalized lifecycle shared by the three sources. `paused` only ever comes
 * from pin jobs, which are the only resumable kind.
 */
export type ActivityStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** One row in the activity panel, whatever its source. */
export interface ActivityItem {
  /** Stable across updates: `<kind>:<source id>`. */
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  /** Primary label — file name, pin name, or CID. */
  title: string;
  /** Secondary line: gateway counts, retry notice, error message. */
  detail: string;
  /** 0-100, or `null` when the source cannot report a ratio. */
  percent: number | null;
  startedAt: number;
  updatedAt: number;
  /** Set once the entry reaches a final status, for the persisted history. */
  finishedAt: number;
  /** Source id to hand back to pause/resume/cancel (pin job id, upload key). */
  handle: string;
}

/** Subset of `ActivityItem` kept in `localStorage` once an entry is finished. */
export interface PersistedActivityEntry {
  id: string;
  kind: ActivityKind;
  status: ActivityStatus;
  title: string;
  detail: string;
  startedAt: number;
  finishedAt: number;
}

/** Raw pin-job snapshot as returned by `window.lumen.ipfsPinJobs()`. */
export interface RawPinJob {
  id?: string;
  target?: string;
  name?: string;
  status?: string;
  progressText?: string;
  progressPercent?: number | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  progressUnit?: string;
  error?: string;
  retryCount?: number;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
}

/** Payload of the `ipfs:publicGatewayPropagationProgress` event. */
export interface RawPropagationProgress {
  stage?: string;
  cid?: string;
  total?: number;
  completed?: number;
  succeeded?: number;
  failed?: number;
  timedOut?: number;
  skippedOffline?: number;
}
