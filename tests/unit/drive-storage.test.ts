import { beforeEach, describe, expect, it } from 'vitest';
import {
  bumpDriveBackupSeq,
  driveBackupLastExportAtKey,
  driveBackupLastImportAtKey,
  driveFilesKey,
  driveHlsQueueKey,
  driveLocalNamesKey,
  nextDriveBackupSeq,
  readDriveBackupSeq,
} from '../../src/internal/services/driveStorage';

/**
 * Where a profile's Drive lives in `localStorage`.
 *
 * Four call sites used to re-declare these prefixes and the
 * `<prefix>:<profileId>` convention, so a typo in one would have split a
 * profile's Drive in two without any error. The counter is the other half:
 * backup export compares it to decide whether local state has moved on, so it
 * must only ever go forward - an import that rewound it would make the next
 * export believe nothing had changed.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('the per-profile keys', () => {
  it('scope every key to the profile', () => {
    for (const build of [driveFilesKey, driveLocalNamesKey, driveHlsQueueKey,
      driveBackupLastExportAtKey, driveBackupLastImportAtKey]) {
      expect(build('p1')).not.toBe(build('p2'));
      expect(build('p1').endsWith(':p1')).toBe(true);
    }
  });

  it('keeps the four areas apart for one profile', () => {
    const keys = [driveFilesKey('p1'), driveLocalNamesKey('p1'), driveHlsQueueKey('p1'),
      driveBackupLastExportAtKey('p1'), driveBackupLastImportAtKey('p1')];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sends a profile-less session to its own bucket', () => {
    expect(driveFilesKey('')).toContain(':guest');
  });
});

describe('the backup counter', () => {
  it('starts at zero when it was never written', () => {
    expect(readDriveBackupSeq('p1')).toBe(0);
  });

  it('increments and returns the new value', () => {
    expect(nextDriveBackupSeq('p1')).toBe(1);
    expect(nextDriveBackupSeq('p1')).toBe(2);
    expect(readDriveBackupSeq('p1')).toBe(2);
  });

  it('counts each profile separately', () => {
    nextDriveBackupSeq('p1');
    nextDriveBackupSeq('p1');
    expect(readDriveBackupSeq('p2')).toBe(0);
  });

  it('moves forward on a bump to a higher value', () => {
    nextDriveBackupSeq('p1');
    bumpDriveBackupSeq('p1', 10);
    expect(readDriveBackupSeq('p1')).toBe(10);
  });

  it('refuses to move backwards, which is the whole point of the bump', () => {
    // Restoring an older backup must not convince the next export that
    // nothing has changed since.
    bumpDriveBackupSeq('p1', 10);
    bumpDriveBackupSeq('p1', 3);
    expect(readDriveBackupSeq('p1')).toBe(10);
  });

  it('ignores a bump to something unreadable', () => {
    bumpDriveBackupSeq('p1', 5);
    for (const junk of [NaN, Infinity, -1, undefined, null, 'seven']) {
      bumpDriveBackupSeq('p1', junk as never);
    }
    expect(readDriveBackupSeq('p1')).toBe(5);
  });

  it('floors a fractional bump rather than storing a decimal', () => {
    bumpDriveBackupSeq('p1', 7.9);
    expect(readDriveBackupSeq('p1')).toBe(7);
  });

  it('reads a corrupted counter as zero instead of NaN', () => {
    localStorage.setItem(driveBackupLastExportAtKey('p1'), 'x');
    localStorage.setItem(`lumen:driveBackup:seq:v1:p1`, 'not a number');
    expect(readDriveBackupSeq('p1')).toBe(0);
    // And the next increment starts cleanly from there.
    expect(nextDriveBackupSeq('p1')).toBe(1);
  });

  it('reads a negative stored counter as zero', () => {
    localStorage.setItem(`lumen:driveBackup:seq:v1:p1`, '-5');
    expect(readDriveBackupSeq('p1')).toBe(0);
  });
});
