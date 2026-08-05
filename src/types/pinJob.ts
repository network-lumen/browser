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
