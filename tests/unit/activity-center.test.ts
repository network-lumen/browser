import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activityControls,
  activityItems,
  cancelActivity,
  clearActivityHistory,
  initActivityCenter,
  pauseActivity,
  resumeActivity,
  runningActivityCount,
  stopActivityCenter,
} from '../../src/internal/services/activityCenter';
import { uploadActivities } from '../../src/internal/common/upload';
import { STORAGE_KEYS } from '../../src/internal/services/storage';
import type { ActivityItem } from '../../src/types/activityCenter';

/**
 * The one feed behind the navbar activity panel.
 *
 * It merges three sources that had nothing in common before - Drive uploads,
 * managed pin jobs, gateway propagation - and only ever reads them. The parts
 * worth pinning are the merge rules: a finished entry moves out of the live
 * list and into history exactly once, the badge counts only what is actually
 * running, and the controls offered per entry differ by kind because only a
 * pin job can be paused.
 */

const item = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  id: 'pin:1', kind: 'pin', status: 'running', title: 'x', detail: '',
  percent: null, startedAt: 0, updatedAt: 0, finishedAt: 0, handle: '1', ...over,
});

function bridge(api: Record<string, unknown>) {
  (window as any).lumen = api;
}

beforeEach(() => {
  localStorage.clear();
  stopActivityCenter();
  clearActivityHistory();
  for (const key of Object.keys(uploadActivities)) delete (uploadActivities as any)[key];
});

afterEach(() => {
  stopActivityCenter();
  delete (window as any).lumen;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('activityControls', () => {
  it('offers pause only for a running pin job', () => {
    expect(activityControls(item({ kind: 'pin', status: 'running' })).pause).toBe(true);
    expect(activityControls(item({ kind: 'upload', status: 'running' })).pause).toBe(false);
    expect(activityControls(item({ kind: 'propagation', status: 'running' })).pause).toBe(false);
  });

  it('offers resume only for a paused pin job', () => {
    expect(activityControls(item({ status: 'paused' })).resume).toBe(true);
    expect(activityControls(item({ status: 'running' })).resume).toBe(false);
  });

  it('offers cancel for the two kinds that can be stopped', () => {
    expect(activityControls(item({ kind: 'pin' })).cancel).toBe(true);
    expect(activityControls(item({ kind: 'propagation' })).cancel).toBe(true);
    // An upload is cancelled from DrivePage's own panel, not from here.
    expect(activityControls(item({ kind: 'upload' })).cancel).toBe(false);
  });

  it('offers nothing at all once an entry is finished', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(activityControls(item({ status }))).toEqual({ pause: false, resume: false, cancel: false });
    }
  });
});

describe('the controls act on the right channel', () => {
  it('pauses, resumes and cancels a pin job by its handle', () => {
    const ipfsPinPause = vi.fn();
    const ipfsPinResume = vi.fn();
    const ipfsPinCancel = vi.fn();
    bridge({ ipfsPinPause, ipfsPinResume, ipfsPinCancel });

    pauseActivity(item({ handle: 'job-7' }));
    resumeActivity(item({ handle: 'job-7' }));
    cancelActivity(item({ handle: 'job-7' }));

    expect(ipfsPinPause).toHaveBeenCalledWith('job-7');
    expect(ipfsPinResume).toHaveBeenCalledWith('job-7');
    expect(ipfsPinCancel).toHaveBeenCalledWith('job-7');
  });

  it('ignores pause and resume for anything that is not a pin job', () => {
    const ipfsPinPause = vi.fn();
    const ipfsPinResume = vi.fn();
    bridge({ ipfsPinPause, ipfsPinResume });
    pauseActivity(item({ kind: 'upload' }));
    resumeActivity(item({ kind: 'propagation' }));
    expect(ipfsPinPause).not.toHaveBeenCalled();
    expect(ipfsPinResume).not.toHaveBeenCalled();
  });

  it('cancels propagation through its own channel', () => {
    const ipfsCancelPublicGatewayPropagation = vi.fn();
    bridge({ ipfsCancelPublicGatewayPropagation });
    cancelActivity(item({ kind: 'propagation' }));
    expect(ipfsCancelPublicGatewayPropagation).toHaveBeenCalled();
  });

  it('does nothing rather than throwing when the bridge is absent', () => {
    delete (window as any).lumen;
    expect(() => pauseActivity(item())).not.toThrow();
    expect(() => cancelActivity(item({ kind: 'propagation' }))).not.toThrow();
  });
});

describe('pin jobs', () => {
  it('reads the jobs the main process reports', async () => {
    bridge({
      ipfsPinJobs: async () => ({
        ok: true,
        jobs: [{ id: 'j1', status: 'running', name: 'My file', progressPercent: 42 }],
      }),
    });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBeGreaterThan(0));
    expect(activityItems.value[0]).toMatchObject({
      id: 'pin:j1', kind: 'pin', status: 'running', title: 'My file', percent: 42,
    });
  });

  it('drops a job with no id, which nothing could act on', async () => {
    bridge({ ipfsPinJobs: async () => ({ ok: true, jobs: [{ status: 'running' }] }) });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value).toEqual([]));
  });

  it('moves a finished job out of the live list and into history', async () => {
    bridge({
      ipfsPinJobs: async () => ({
        ok: true,
        jobs: [{ id: 'j1', status: 'completed', name: 'Done', completedAt: 123 }],
      }),
    });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    const [entry] = activityItems.value;
    expect(entry.status).toBe('completed');
    // History entries show a full bar and expose no handle to act on.
    expect(entry.percent).toBe(100);
    expect(entry.handle).toBe('');
  });

  it('remembers a finished job only once', async () => {
    bridge({
      ipfsPinJobs: async () => ({ ok: true, jobs: [{ id: 'j1', status: 'failed' }] }),
    });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    stopActivityCenter();
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
  });

  it('keeps the previous list when a refresh fails', async () => {
    let ok = true;
    bridge({
      ipfsPinJobs: async () => (ok
        ? { ok: true, jobs: [{ id: 'j1', status: 'running' }] }
        : { ok: false, error: 'daemon down' }),
    });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    ok = false;
    expect(activityItems.value).toHaveLength(1);
  });
});

describe('uploads', () => {
  it('polls the in-memory upload object, which is mutated in place', async () => {
    vi.useFakeTimers();
    bridge({});
    initActivityCenter();
    (uploadActivities as any)['file-1'] = {
      uploadingFile: 'video.mp4', uploadingPercent: 30, uploadingCanceling: 0,
    };
    await vi.advanceTimersByTimeAsync(800);
    expect(activityItems.value[0]).toMatchObject({
      id: 'upload:file-1', kind: 'upload', title: 'video.mp4', percent: 30, status: 'running',
    });
  });

  it('reports a cancel in progress differently from a finished one', async () => {
    vi.useFakeTimers();
    bridge({});
    initActivityCenter();
    (uploadActivities as any)['f'] = { uploadingFile: 'a', uploadingCanceling: 1 };
    await vi.advanceTimersByTimeAsync(800);
    expect(activityItems.value[0]).toMatchObject({ status: 'running', detail: 'Cancelling…' });
  });

  it('clamps a percentage that arrives out of range', async () => {
    vi.useFakeTimers();
    bridge({});
    initActivityCenter();
    (uploadActivities as any)['f'] = { uploadingFile: 'a', uploadingPercent: 480 };
    await vi.advanceTimersByTimeAsync(800);
    expect(activityItems.value[0].percent).toBe(100);
  });

  it('shows an indeterminate bar when there is no percentage at all', async () => {
    vi.useFakeTimers();
    bridge({});
    initActivityCenter();
    (uploadActivities as any)['f'] = { uploadingFile: 'a' };
    await vi.advanceTimersByTimeAsync(800);
    expect(activityItems.value[0].percent).toBeNull();
  });
});

describe('the badge', () => {
  it('counts only what is still running', async () => {
    bridge({
      ipfsPinJobs: async () => ({
        ok: true,
        jobs: [
          { id: 'a', status: 'running' },
          { id: 'b', status: 'paused' },
          { id: 'c', status: 'completed' },
        ],
      }),
    });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(3));
    expect(runningActivityCount.value).toBe(1);
  });

  it('is zero with nothing going on', () => {
    expect(runningActivityCount.value).toBe(0);
  });
});

describe('history', () => {
  it('survives a restart', async () => {
    localStorage.setItem(STORAGE_KEYS.activityHistory, JSON.stringify([
      { id: 'pin:old', kind: 'pin', status: 'completed', title: 'Earlier', detail: '', startedAt: 1, finishedAt: 2 },
    ]));
    bridge({ ipfsPinJobs: async () => ({ ok: true, jobs: [] }) });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    expect(activityItems.value[0].title).toBe('Earlier');
  });

  it('survives a corrupted store', async () => {
    localStorage.setItem(STORAGE_KEYS.activityHistory, '{not json');
    bridge({ ipfsPinJobs: async () => ({ ok: true, jobs: [] }) });
    expect(() => initActivityCenter()).not.toThrow();
    await vi.waitFor(() => expect(activityItems.value).toEqual([]));
  });

  it('can be cleared', async () => {
    localStorage.setItem(STORAGE_KEYS.activityHistory, JSON.stringify([
      { id: 'pin:old', kind: 'pin', status: 'completed', title: 'Earlier', detail: '', startedAt: 1, finishedAt: 2 },
    ]));
    bridge({ ipfsPinJobs: async () => ({ ok: true, jobs: [] }) });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    clearActivityHistory();
    expect(activityItems.value).toEqual([]);
  });

  it('does not show a past entry that is also running now', async () => {
    // The same id in both lists would draw the row twice.
    localStorage.setItem(STORAGE_KEYS.activityHistory, JSON.stringify([
      { id: 'pin:j1', kind: 'pin', status: 'completed', title: 'Old', detail: '', startedAt: 1, finishedAt: 2 },
    ]));
    bridge({ ipfsPinJobs: async () => ({ ok: true, jobs: [{ id: 'j1', status: 'running', name: 'Now' }] }) });
    initActivityCenter();
    await vi.waitFor(() => expect(activityItems.value.length).toBe(1));
    expect(activityItems.value[0].title).toBe('Now');
  });
});

describe('starting and stopping', () => {
  it('is idempotent, since every component showing the panel calls it', async () => {
    const ipfsPinJobs = vi.fn(async () => ({ ok: true, jobs: [] }));
    bridge({ ipfsPinJobs });
    initActivityCenter();
    initActivityCenter();
    initActivityCenter();
    await vi.waitFor(() => expect(ipfsPinJobs).toHaveBeenCalled());
    expect(ipfsPinJobs).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes what it subscribed to', () => {
    const dispose = vi.fn();
    bridge({
      ipfsPinJobs: async () => ({ ok: true, jobs: [] }),
      ipfsOnPinProgress: () => dispose,
      ipfsOnPublicGatewayPropagationProgress: () => dispose,
    });
    initActivityCenter();
    stopActivityCenter();
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it('does not throw when a disposer does', () => {
    bridge({
      ipfsPinJobs: async () => ({ ok: true, jobs: [] }),
      ipfsOnPinProgress: () => () => { throw new Error('already gone'); },
    });
    initActivityCenter();
    expect(() => stopActivityCenter()).not.toThrow();
  });

  it('starts with no bridge at all', () => {
    delete (window as any).lumen;
    expect(() => initActivityCenter()).not.toThrow();
  });
});
