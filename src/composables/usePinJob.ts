import { t } from '../stores/i18nStore';
import { computed, ref } from 'vue';
import { useInternalLumen } from './useInternalLumen';
import { readPinJobSnapshot } from '../internal/services/pinJobs';
import type { PinJobOptions, PinJobHandle } from '../types/pinJob';

/**
 * The state and controls of one managed pin job.
 *
 * Saving to Drive is offered from two places - the site-facing modal in
 * `LumenSiteModalHost` and the viewer in `IpfsPage` - and each held its own
 * copy of this: eight refs, six computeds and four actions, identical but for
 * a `save` prefix on every name. An earlier pass extracted the parsing into
 * `services/pinJobs` and left the rest, on the grounds that where the values
 * land is not shared. That was true of a plain module; a composable owns its
 * own refs, so the state can move too.
 *
 * What genuinely differs stays with the caller: each has its own name for
 * "busy", its own place to show an error, and its own idea of what to do once
 * a paused job resumes.
 */
export function usePinJob(options: PinJobOptions): PinJobHandle {
  const jobId = ref('');
  const status = ref('');
  const progressText = ref('');
  const progressCurrent = ref<number | null>(null);
  const progressTotal = ref<number | null>(null);
  const progressPercent = ref<number | null>(null);
  const progressUnit = ref('');
  /** Guards against two waiters on one job when resume is clicked twice. */
  const waitJobId = ref('');

  const normalizedStatus = computed(() => String(status.value || '').trim().toLowerCase());

  const isRunning = computed(() =>
    ['queued', 'running', 'retry_waiting'].includes(normalizedStatus.value)
  );
  const canPause = computed(() => !!jobId.value && isRunning.value);
  const canResume = computed(
    () => !!jobId.value && ['paused', 'failed'].includes(normalizedStatus.value)
  );
  /**
   * Stoppable until it has finished one way or the other - a failed or paused
   * job can still be abandoned, which is why this is not the negation of
   * `isRunning`.
   */
  const canStop = computed(
    () => !!jobId.value && !['completed', 'cancelled'].includes(normalizedStatus.value)
  );

  const STATUS_LABELS: Record<string, string> = {
    queued: t('Queued'),
    running: t('Saving…'),
    retry_waiting: t('Retrying'),
    paused: t('Paused'),
    failed: t('Failed'),
    completed: t('Completed'),
    cancelled: t('Stopped'),
  };

  /** Falls back to the caller's own busy flag: a job exists before it has a status. */
  const statusLabel = computed(
    () => STATUS_LABELS[normalizedStatus.value] || (options.busy.value ? 'Saving' : 'Idle')
  );

  /** "12/40 files", or "12 files", or "60%", or nothing - in that order of preference. */
  const progressCounter = computed(() => {
    const unit = String(progressUnit.value || '').trim();
    const suffix = unit ? ` ${unit}` : '';
    const current = Number.isFinite(progressCurrent.value as number) ? String(progressCurrent.value) : '';
    const total = Number.isFinite(progressTotal.value as number) ? String(progressTotal.value) : '';

    if (current && total) return `${current}/${total}${suffix}`;
    if (current) return `${current}${suffix}`;
    if (Number.isFinite(progressPercent.value as number)) {
      return `${(progressPercent.value as number).toFixed(0)}%`;
    }
    return '';
  });

  function clear() {
    jobId.value = '';
    status.value = '';
    progressText.value = '';
    progressCurrent.value = null;
    progressTotal.value = null;
    progressPercent.value = null;
    progressUnit.value = '';
    waitJobId.value = '';
  }

  /** Ignores a reply with no job in it, leaving whatever is on screen alone. */
  function apply(job: unknown) {
    const snapshot = readPinJobSnapshot(job);
    if (!snapshot) return;

    jobId.value = snapshot.id;
    status.value = snapshot.status;
    progressText.value = snapshot.progressText;
    progressCurrent.value = snapshot.progressCurrent;
    progressTotal.value = snapshot.progressTotal;
    progressPercent.value = snapshot.progressPercent;
    progressUnit.value = snapshot.progressUnit;
    options.busy.value = snapshot.active;
  }

  async function pause() {
    const api: any = useInternalLumen();
    if (!jobId.value || !api?.ipfsPinPause) return;
    apply((await api.ipfsPinPause(jobId.value).catch(() => null))?.job);
  }

  async function cancel() {
    const api: any = useInternalLumen();
    if (!jobId.value || !api?.ipfsPinCancel) return;
    apply((await api.ipfsPinCancel(jobId.value).catch(() => null))?.job);
  }

  /**
   * Resuming hands back to the caller: one waits on the job alone, the other
   * needs the CID and name it is saving under, so the waiting is theirs.
   */
  async function resume() {
    const api: any = useInternalLumen();
    if (!jobId.value || !api?.ipfsPinResume) return;

    if (options.error) options.error.value = '';
    const res = await api.ipfsPinResume(jobId.value).catch(() => null);

    if (res?.job) {
      apply(res.job);
      options.onResumed?.(String(res.job.id || ''));
      return;
    }
    if (res?.error && options.error) options.error.value = String(res.error);
  }

  return {
    jobId,
    status,
    progressText,
    progressCurrent,
    progressTotal,
    progressPercent,
    progressUnit,
    waitJobId,
    isRunning,
    canPause,
    canResume,
    canStop,
    statusLabel,
    progressCounter,
    clear,
    apply,
    pause,
    resume,
    cancel,
  };
}
