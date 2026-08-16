import { describe, expect, it } from 'vitest';
import { readPinJobSnapshot } from '../../src/internal/services/pinJobs';

/**
 * Reading a managed pin job out of what the main process sends back.
 *
 * The status list is the reason this matters more than its length suggests: a
 * status added on the main side has to be recognised here, or a running job
 * stops looking active and the UI declares it finished while it is still
 * going. There used to be two copies of this list to forget.
 */

describe('the active statuses', () => {
  it('counts every status the main process uses for work in progress', () => {
    for (const status of ['queued', 'running', 'retry_waiting']) {
      expect(readPinJobSnapshot({ status })?.active).toBe(true);
    }
  });

  it('counts a finished or stopped job as inactive', () => {
    for (const status of ['done', 'failed', 'cancelled', 'paused']) {
      expect(readPinJobSnapshot({ status })?.active).toBe(false);
    }
  });

  it('matches regardless of case, since the status crosses a boundary', () => {
    expect(readPinJobSnapshot({ status: 'RUNNING' })?.active).toBe(true);
    expect(readPinJobSnapshot({ status: 'Retry_Waiting' })?.active).toBe(true);
  });

  it('treats an unrecognised status as inactive rather than guessing', () => {
    expect(readPinJobSnapshot({ status: 'something_new' })?.active).toBe(false);
    expect(readPinJobSnapshot({ status: '' })?.active).toBe(false);
  });
});

describe('the progress fields', () => {
  it('reads the numbers it is given', () => {
    const snapshot = readPinJobSnapshot({
      id: 'job-1',
      status: 'running',
      progressText: 'Pinning…',
      progressCurrent: 5,
      progressTotal: 10,
      progressPercent: 50,
      progressUnit: 'blocks',
    });
    expect(snapshot).toMatchObject({
      id: 'job-1',
      progressText: 'Pinning…',
      progressCurrent: 5,
      progressTotal: 10,
      progressPercent: 50,
      progressUnit: 'blocks',
    });
  });

  it('reads numeric strings, which is how they arrive over IPC', () => {
    expect(readPinJobSnapshot({ status: 'running', progressCurrent: '7' })?.progressCurrent).toBe(7);
  });

  it('gives null for a progress field that is absent or unreadable', () => {
    // Absent as often as set, so null lets a caller leave its own state alone
    // instead of resetting a bar to zero on every poll.
    const snapshot = readPinJobSnapshot({ status: 'running' });
    expect(snapshot?.progressCurrent).toBeNull();
    expect(snapshot?.progressTotal).toBeNull();
    expect(snapshot?.progressPercent).toBeNull();
    expect(readPinJobSnapshot({ status: 'running', progressPercent: 'nope' })?.progressPercent).toBeNull();
    expect(readPinJobSnapshot({ status: 'running', progressPercent: Infinity })?.progressPercent).toBeNull();
  });

  it('keeps a zero, which is a real progress value and not a missing one', () => {
    expect(readPinJobSnapshot({ status: 'queued', progressCurrent: 0 })?.progressCurrent).toBe(0);
  });

  it('gives empty strings rather than undefined for the text fields', () => {
    const snapshot = readPinJobSnapshot({ status: 'running' });
    expect(snapshot?.id).toBe('');
    expect(snapshot?.progressText).toBe('');
    expect(snapshot?.progressUnit).toBe('');
  });
});

describe('when there is no job', () => {
  it('returns null so callers can leave their state alone', () => {
    for (const nothing of [null, undefined, '', 0, false, 'a string', 42]) {
      expect(readPinJobSnapshot(nothing)).toBeNull();
    }
  });

  it('accepts an empty object as a job with nothing known about it', () => {
    expect(readPinJobSnapshot({})).toMatchObject({ id: '', status: '', active: false });
  });
});
