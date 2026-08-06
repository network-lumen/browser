import { describe, expect, it } from 'vitest';
import {
  countHlsQueue,
  hlsQueueHasPendingItems,
  hlsQueueIsPaused,
  hlsQueueSummaryText,
  parseStoredHlsQueue,
  serializeHlsQueue,
} from '../../src/internal/services/hlsQueue';
import type { HlsQueueItem } from '../../src/types/drivePage';

const item = (over: Partial<HlsQueueItem> = {}): HlsQueueItem => ({
  id: 'a',
  file: { cid: 'bafy', name: 'clip.mp4', size: 10 },
  status: 'queued',
  ...over,
});

describe('restoring a queue from storage', () => {
  it('parks anything still in flight rather than resuming it', () => {
    // A conversion interrupted by a restart must not start again on its own -
    // it is the one status the user has to opt back into.
    for (const status of ['queued', 'converting', 'nonsense', '', null, undefined]) {
      const [restored] = parseStoredHlsQueue([{ id: '1', file: item().file, status }]);
      expect(restored.status).toBe('paused');
    }
  });

  it('keeps the statuses that are already settled', () => {
    for (const status of ['done', 'failed', 'cancelled'] as const) {
      const [restored] = parseStoredHlsQueue([{ id: '1', file: item().file, status }]);
      expect(restored.status).toBe(status);
    }
  });

  it('drops entries with no usable file instead of restoring a blank row', () => {
    const restored = parseStoredHlsQueue([
      { id: '1', file: { cid: '', name: 'x' }, status: 'done' },
      { id: '2', file: { cid: 'bafy', name: '' }, status: 'done' },
      { id: '3', status: 'done' },
      { id: '4', file: item().file, status: 'done' },
    ]);
    expect(restored.map((r) => r.id)).toEqual(['4']);
  });

  it('survives a payload that is not a list at all', () => {
    for (const junk of [null, undefined, 'nope', 42, {}]) {
      expect(parseStoredHlsQueue(junk)).toEqual([]);
    }
  });

  it('mints an id when one is missing, so rows stay addressable', () => {
    const [restored] = parseStoredHlsQueue([{ file: item().file, status: 'done' }]);
    expect(restored.id).toMatch(/^hlsq-/);
  });

  it('only carries an error for the statuses that can explain one', () => {
    const kept = parseStoredHlsQueue([{ id: '1', file: item().file, status: 'failed', error: 'boom' }]);
    expect(kept[0].error).toBe('boom');

    const dropped = parseStoredHlsQueue([{ id: '1', file: item().file, status: 'done', error: 'boom' }]);
    expect(dropped[0].error).toBeUndefined();
  });

  it('round-trips through serialize without drifting', () => {
    const original = [item({ id: '1', status: 'done' }), item({ id: '2', status: 'failed', error: 'no' })];
    expect(parseStoredHlsQueue(serializeHlsQueue(original))).toEqual(original);
  });
});

describe('reading the state of a queue', () => {
  it('counts each status separately', () => {
    const counts = countHlsQueue([
      item({ status: 'queued' }),
      item({ status: 'converting' }),
      item({ status: 'paused' }),
      item({ status: 'done' }),
      item({ status: 'failed' }),
      item({ status: 'cancelled' }),
    ]);
    expect(counts).toEqual({ active: 2, paused: 1, done: 1, failed: 1, cancelled: 1 });
  });

  it('is only paused as a whole when nothing is still moving', () => {
    expect(hlsQueueIsPaused([item({ status: 'paused' })])).toBe(true);
    expect(hlsQueueIsPaused([item({ status: 'paused' }), item({ status: 'queued' })])).toBe(false);
    expect(hlsQueueIsPaused([item({ status: 'done' })])).toBe(false);
    expect(hlsQueueIsPaused([])).toBe(false);
  });

  it('treats paused work as still pending', () => {
    expect(hlsQueueHasPendingItems([item({ status: 'paused' })])).toBe(true);
    expect(hlsQueueHasPendingItems([item({ status: 'done' }), item({ status: 'failed' })])).toBe(false);
  });

  it('names only the counts that are non-zero', () => {
    expect(hlsQueueSummaryText(countHlsQueue([item({ status: 'done' })]))).toBe('1 done');
    expect(hlsQueueSummaryText(countHlsQueue([]))).toBe('');
    expect(
      hlsQueueSummaryText(countHlsQueue([item({ status: 'queued' }), item({ status: 'failed' })]))
    ).toBe('1 active • 1 failed');
  });
});
