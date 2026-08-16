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
