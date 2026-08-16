import { describe, expect, it } from 'vitest';
import {
  hlsQueueItemStyle,
  hlsQueueStatusLabel,
  hlsQueueStatusTextStyle,
  nextHlsQueueItemId,
  normalizeStoredHlsQueueStatus,
  sanitizeStoredHlsQueueFile,
} from '../../src/internal/services/hlsQueue';
import type { HlsQueueItemStatus } from '../../src/types/drivePage';

/**
 * The half of the HLS queue that hls-queue.test.ts does not cover: ids,
 * restoring from storage, and how a status is drawn.
 *
 * The restore rule is the one that matters. Anything unrecognised comes back
 * as "paused" rather than "queued", so a queue reloaded after a restart waits
 * for the user instead of quietly starting to transcode a video on its own.
 */

const ALL: HlsQueueItemStatus[] = ['queued', 'converting', 'paused', 'done', 'cancelled', 'failed'];

describe('nextHlsQueueItemId', () => {
  it('is prefixed, so an id is recognisable in storage', () => {
    expect(nextHlsQueueItemId().startsWith('hlsq-')).toBe(true);
  });

  it('does not repeat within a millisecond', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nextHlsQueueItemId()));
    expect(ids.size).toBe(200);
  });
});

describe('normalizeStoredHlsQueueStatus', () => {
  it('restores the three settled statuses as they were', () => {
    expect(normalizeStoredHlsQueueStatus('done')).toBe('done');
    expect(normalizeStoredHlsQueueStatus('failed')).toBe('failed');
    expect(normalizeStoredHlsQueueStatus('cancelled')).toBe('cancelled');
  });

  it('restores anything unfinished as paused, never as queued', () => {
    // Coming back as "queued" would have the app start transcoding on its own
    // the moment it reopens.
    for (const status of ['queued', 'converting', 'paused', '', 'nonsense', null, undefined, 42]) {
      expect(normalizeStoredHlsQueueStatus(status)).toBe('paused');
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeStoredHlsQueueStatus('  DONE  ')).toBe('done');
  });
});

describe('sanitizeStoredHlsQueueFile', () => {
  it('keeps a well-formed entry', () => {
    expect(sanitizeStoredHlsQueueFile({
      cid: 'bafy1', name: 'clip.mp4', size: 1024, uploadedAt: 1700000000000, type: 'file',
    })).toMatchObject({ cid: 'bafy1', name: 'clip.mp4', size: 1024, type: 'file' });
  });

  it('drops an entry that could not be acted on', () => {
    // Without a cid there is nothing to fetch; without a name, nothing to show.
    expect(sanitizeStoredHlsQueueFile({ name: 'clip.mp4' })).toBeNull();
    expect(sanitizeStoredHlsQueueFile({ cid: 'bafy1' })).toBeNull();
    expect(sanitizeStoredHlsQueueFile({ cid: '  ', name: '  ' })).toBeNull();
    expect(sanitizeStoredHlsQueueFile(null)).toBeNull();
  });

  it('reads a size of zero rather than NaN', () => {
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', size: 'big' })?.size).toBe(0);
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', size: -5 })?.size).toBe(0);
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n' })?.size).toBe(0);
  });

  it('leaves an unusable timestamp absent instead of showing 1970', () => {
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', uploadedAt: 0 })?.uploadedAt).toBeUndefined();
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', uploadedAt: 'x' })?.uploadedAt).toBeUndefined();
  });

  it('accepts only the two real types', () => {
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', type: 'dir' })?.type).toBe('dir');
    expect(sanitizeStoredHlsQueueFile({ cid: 'c', name: 'n', type: 'symlink' })?.type).toBeUndefined();
  });
});

describe('how a status is drawn', () => {
  it('labels every status, with no gaps', () => {
    for (const status of ALL) {
      expect(hlsQueueStatusLabel(status)).toBeTruthy();
    }
    expect(hlsQueueStatusLabel('done')).toBe('Done');
    expect(hlsQueueStatusLabel('converting')).toBe('Converting');
  });

  it('leaves a queued item unstyled, so only what is happening stands out', () => {
    expect(hlsQueueItemStyle('queued')).toEqual({});
    expect(hlsQueueStatusTextStyle('queued')).toEqual({});
    expect(hlsQueueStatusTextStyle('done')).toEqual({});
  });

  it('tints the statuses that need attention', () => {
    expect(hlsQueueItemStyle('failed').borderColor).toContain('--color-error');
    expect(hlsQueueItemStyle('done').background).toContain('--color-success');
    expect(hlsQueueStatusTextStyle('failed')).toEqual({ color: 'var(--color-error)' });
    expect(hlsQueueStatusTextStyle('cancelled')).toEqual({ color: 'var(--color-warning)' });
  });

  it('only ever names CSS variables, never a literal colour', () => {
    // The design system owns the palette; a hex here would escape both themes.
    for (const status of ALL) {
      for (const value of Object.values({ ...hlsQueueItemStyle(status), ...hlsQueueStatusTextStyle(status) })) {
        expect(value).toContain('--color-');
        expect(value).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      }
    }
  });
});
