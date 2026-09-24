import type { ComputedRef, Ref } from 'vue';

export type PinJobOptions = {
  /** The host's own "something is happening" flag - each names it differently. */
  busy: Ref<boolean>;
  /** Where a failed resume is shown, if the host shows one. */
  error?: Ref<string>;
  /** Called after a successful resume. Each host waits for completion its own way. */
  onResumed?: (jobId: string) => void;
};

export type PinJobHandle = {
  jobId: Ref<string>;
  status: Ref<string>;
  progressText: Ref<string>;
  progressCurrent: Ref<number | null>;
  progressTotal: Ref<number | null>;
  progressPercent: Ref<number | null>;
  progressUnit: Ref<string>;
  waitJobId: Ref<string>;
  isRunning: ComputedRef<boolean>;
  canPause: ComputedRef<boolean>;
  canResume: ComputedRef<boolean>;
  canStop: ComputedRef<boolean>;
  statusLabel: ComputedRef<string>;
  progressCounter: ComputedRef<string>;
  clear: () => void;
  apply: (job: unknown) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
};

/** A managed pin job as the renderer needs it, read from the main-process record. */
export type PinJobSnapshot = {
  id: string;
  status: string;
  progressText: string;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressPercent: number | null;
  progressUnit: string;
  /** True while the job is queued, running or waiting to retry. */
  active: boolean;
};

/**
 * A managed pin job on the mobile target, where the work is an HTTP request
 * rather than a child process - see platform/mobile/impl/pin-jobs.ts for what
 * that changes about pausing and cancelling.
 */
export type PinJobStatus =
  | 'queued'
  | 'running'
  | 'retry_waiting'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'cancelled';

export interface PinJobRecord {
  id: string;
  cid: string;
  name: string;
  status: PinJobStatus;
  error: string;
  progressText: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Bumped whenever the job is steered, so the answer to a request already in
   * flight can be recognised as belonging to an attempt nobody awaits.
   */
  generation: number;
  waiters: Array<() => void>;
}

export interface PinJobSnapshotPayload {
  id: string;
  cid: string;
  name: string;
  status: PinJobStatus;
  error: string;
  progressText: string;
  progressCurrent: number | null;
  progressTotal: number | null;
  progressPercent: number | null;
  progressUnit: string;
  createdAt: number;
  updatedAt: number;
}

/** What the mobile pin-job manager needs from the node to do its work. */
export interface PinJobDeps {
  /** Pins the CID, resolving when the node says it is done. */
  pin: (cid: string) => Promise<{ ok: boolean; error?: string }>;
  /** Removes a pin, for a job cancelled while its request was in flight. */
  unpin: (cid: string) => Promise<unknown>;
}
