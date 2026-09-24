/**
 * "Save to Drive", which on this target answered `unsupported_on_mobile`.
 *
 * The pages do not call `pin/add` directly. They start a MANAGED JOB and then
 * watch it: `ipfsPinStart` hands back an id, `ipfsPinWait` resolves when it is
 * over, `ipfsPinPause` / `ipfsPinResume` / `ipfsPinCancel` steer it, and
 * `ipfsOnPinProgress` reports every change. That shape comes from the desktop,
 * where the pin runs as a child process that can be killed and restarted.
 *
 * WHAT DIFFERS HERE, AND WHY IT IS NOT PRETENDED OTHERWISE:
 *
 *  - There is no child process to kill. A request through the native HTTP
 *    bridge cannot be aborted, so "pause" and "cancel" mark the job and stop
 *    caring about the answer. The pin may well finish in the background; that
 *    is harmless for a pause, since resuming re-issues it and kubo continues
 *    from the blocks it already has, and for a cancel the pin is undone when
 *    the request lands.
 *
 *  - There is no incremental progress. `pin/add?progress=true` streams NDJSON,
 *    and the native bridge hands over one body at the end, so there is nothing
 *    to read while it runs. The job therefore reports a status and no
 *    percentage, rather than a number invented to fill the bar.
 */

import type {
  PinJobDeps,
  PinJobRecord,
  PinJobSnapshotPayload,
  PinJobStatus
} from '../../../src/types/pinJob';

/** Every job this session has seen, by id. */
const jobs = new Map<string, PinJobRecord>();

const listeners = new Set<(payload: unknown) => void>();

/** Statuses nothing can move away from. */
const FINAL: PinJobStatus[] = ['completed', 'cancelled'];

let counter = 0;

function nextId(): string {
  counter += 1;
  return `pin_${Date.now().toString(36)}_${counter}`;
}

export function snapshot(job: PinJobRecord): PinJobSnapshotPayload {
  return {
    id: job.id,
    cid: job.cid,
    name: job.name,
    status: job.status,
    error: job.error,
    progressText: job.progressText,
    progressCurrent: null,
    progressTotal: null,
    progressPercent: null,
    progressUnit: '',
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function emit(job: PinJobRecord): void {
  const payload = { job: snapshot(job) };
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // One bad subscriber must not stop the others hearing about the job.
    }
  }
}

function setStatus(job: PinJobRecord, status: PinJobStatus, error = ''): void {
  job.status = status;
  job.error = error;
  job.updatedAt = Date.now();
  job.progressText = status === 'running' ? 'Saving…' : '';
  emit(job);

  // Anything waiting on this job is woken only once it is over, or paused -
  // a paused job is not going to resolve on its own.
  if (FINAL.includes(status) || status === 'failed' || status === 'paused') {
    const waiters = job.waiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}

/**
 * Runs the pin and records what became of it.
 *
 * `run` is passed in rather than imported so this module stays free of the
 * RPC, which is what makes it testable without a node.
 */
async function execute(
  job: PinJobRecord,
  run: (cid: string) => Promise<{ ok: boolean; error?: string }>,
  undo: (cid: string) => Promise<unknown>
): Promise<void> {
  const generation = job.generation;
  setStatus(job, 'running');

  let result: { ok: boolean; error?: string };
  try {
    result = await run(job.cid);
  } catch (e) {
    result = { ok: false, error: String(e instanceof Error ? e.message : e) };
  }

  // The job moved on while the request was in flight - a pause, a cancel, or a
  // resume that started a newer attempt. Whatever came back belongs to a run
  // nobody is waiting for any more.
  if (job.generation !== generation) return;

  if (job.status === 'cancelled') {
    // The pin may have landed anyway, and the user said no: take it back out.
    if (result.ok) await undo(job.cid).catch(() => null);
    return;
  }
  if (job.status === 'paused') return;

  if (result.ok) setStatus(job, 'completed');
  else setStatus(job, 'failed', result.error || 'pin_failed');
}

/** The bridge members, built around one set of dependencies. */
export function createPinJobMembers(deps: PinJobDeps) {
  const start = (input: { cidOrPath?: string; name?: string } | string) => {
    const cid = String(
      typeof input === 'string' ? input : (input?.cidOrPath ?? '')
    ).trim();
    if (!cid) return { ok: false, error: 'missing_cid' };

    const now = Date.now();
    const job: PinJobRecord = {
      id: nextId(),
      cid,
      name: String((typeof input === 'object' && input?.name) || '').trim(),
      status: 'queued',
      error: '',
      progressText: '',
      createdAt: now,
      updatedAt: now,
      generation: 0,
      waiters: []
    };
    jobs.set(job.id, job);

    void execute(job, deps.pin, deps.unpin);
    return { ok: true, job: snapshot(job) };
  };

  const find = (jobId: unknown): PinJobRecord | null =>
    jobs.get(String(jobId ?? '').trim()) ?? null;

  return {
    ipfsPinStart: async (input: { cidOrPath?: string; name?: string } | string) => start(input),

    ipfsPinGet: async (jobId: string) => {
      const job = find(jobId);
      return job ? { ok: true, job: snapshot(job) } : { ok: false, error: 'pin_job_not_found' };
    },

    ipfsPinJobs: async () => ({
      ok: true,
      jobs: [...jobs.values()].map(snapshot)
    }),

    ipfsPinPause: async (jobId: string) => {
      const job = find(jobId);
      if (!job) return { ok: false, error: 'pin_job_not_found' };
      if (FINAL.includes(job.status)) {
        return { ok: false, error: 'pin_job_finished', job: snapshot(job) };
      }
      // A newer generation means the answer to the request still in flight is
      // no longer this job's business.
      job.generation += 1;
      setStatus(job, 'paused');
      return { ok: true, job: snapshot(job) };
    },

    ipfsPinResume: async (jobId: string) => {
      const job = find(jobId);
      if (!job) return { ok: false, error: 'pin_job_not_found' };
      if (FINAL.includes(job.status)) {
        return { ok: false, error: 'pin_job_finished', job: snapshot(job) };
      }
      job.generation += 1;
      // kubo continues from the blocks it already has, so this costs only what
      // is still missing.
      void execute(job, deps.pin, deps.unpin);
      return { ok: true, job: snapshot(job) };
    },

    ipfsPinCancel: async (jobId: string) => {
      const job = find(jobId);
      if (!job) return { ok: false, error: 'pin_job_not_found' };
      if (FINAL.includes(job.status)) {
        return { ok: false, error: 'pin_job_finished', job: snapshot(job) };
      }
      // The generation is deliberately NOT bumped here, unlike pause and
      // resume. A cancelled job still needs the answer to the request already
      // in flight: if the pin lands anyway, that is the moment to take it back
      // out, and a stale generation would discard the very result that says
      // there is something to undo.
      setStatus(job, 'cancelled', 'user_cancelled');
      return { ok: true, job: snapshot(job) };
    },

    /**
     * Resolves when the job is over. `timeoutMs` of 0 means "however long it
     * takes", which is what the save modal passes.
     */
    ipfsPinWait: async (jobId: string, options?: { timeoutMs?: number }) => {
      const job = find(jobId);
      if (!job) return { ok: false, error: 'pin_job_not_found' };

      const timeoutMs = Number(options?.timeoutMs ?? 0) || 0;
      if (!FINAL.includes(job.status) && job.status !== 'failed' && job.status !== 'paused') {
        await new Promise<void>((resolve) => {
          job.waiters.push(resolve);
          if (timeoutMs > 0) setTimeout(resolve, timeoutMs);
        });
      }

      if (job.status === 'completed') return { ok: true, job: snapshot(job) };
      if (job.status === 'cancelled') {
        return { ok: false, cancelled: true, error: 'user_cancelled', job: snapshot(job) };
      }
      return { ok: false, error: job.error || 'pin_incomplete', job: snapshot(job) };
    },

    ipfsOnPinProgress: (callback: (payload: unknown) => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
}

/** Test seam: the registry is module state, and a test needs it empty. */
export function resetPinJobs(): void {
  jobs.clear();
  listeners.clear();
  counter = 0;
}
