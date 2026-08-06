import { describe, expect, it } from 'vitest';
import {
  DRIVE_BACKUP_SNAPSHOT_TYPE,
  MAX_BACKUP_FILES,
  MAX_BACKUP_NAMES,
  buildDriveBackupSnapshot,
  driveBackupFriendlyError,
  normalizeBackupFiles,
  normalizeBackupNames,
  readDriveBackupSnapshot,
  summarizeDriveBackupSnapshot,
} from '../../src/internal/services/driveBackup';

const build = (over: Partial<Parameters<typeof buildDriveBackupSnapshot>[0]> = {}) =>
  buildDriveBackupSnapshot({
    seq: 3,
    walletAddress: 'lumen1abc',
    files: [{ cid: 'bafy', name: 'a.txt', size: 10 }],
    localNames: { bafy: 'A file' },
    favourites: ['lumen://one'],
    shortcutEntries: [],
    createdAt: 1000,
    ...over,
  });

describe('the snapshot format', () => {
  it('reads back exactly what was written', () => {
    // The point of the shared normalisation: export and import cannot drift.
    const snapshot = build();
    const read = readDriveBackupSnapshot(snapshot);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.files).toEqual(snapshot.drive.files);
    expect(read.localNames).toEqual(snapshot.drive.localNames);
    expect(read.favourites).toEqual(snapshot.favourites);
    expect(read.seq).toBe(3);
  });

  it('caps files identically in both directions', () => {
    const many = Array.from({ length: MAX_BACKUP_FILES + 50 }, (_, i) => ({
      cid: `cid${i}`,
      name: `f${i}`,
      size: 1,
    }));
    expect(build({ files: many }).drive.files).toHaveLength(MAX_BACKUP_FILES);

    const read = readDriveBackupSnapshot({
      type: DRIVE_BACKUP_SNAPSHOT_TYPE,
      version: 2,
      drive: { files: many, localNames: {} },
    });
    expect(read.ok && read.files).toHaveLength(MAX_BACKUP_FILES);
  });

  it('caps names identically in both directions', () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < MAX_BACKUP_NAMES + 20; i++) many[`cid${i}`] = `name${i}`;
    expect(Object.keys(build({ localNames: many }).drive.localNames)).toHaveLength(MAX_BACKUP_NAMES);
  });
});

describe('normalising what goes in a backup', () => {
  it('drops files with no cid and names the nameless', () => {
    expect(normalizeBackupFiles([{ cid: '', name: 'x' }, { cid: 'bafy' }])).toEqual([
      { cid: 'bafy', name: 'Unknown', size: 0 },
    ]);
  });

  it('refuses a negative or unreadable size rather than storing it', () => {
    expect(normalizeBackupFiles([{ cid: 'a', size: -5 }])[0].size).toBe(0);
    expect(normalizeBackupFiles([{ cid: 'a', size: 'big' }])[0].size).toBe(0);
  });

  it('keeps only the entry types it understands', () => {
    expect(normalizeBackupFiles([{ cid: 'a', type: 'dir' }])[0].type).toBe('dir');
    expect(normalizeBackupFiles([{ cid: 'a', type: 'symlink' }])[0].type).toBeUndefined();
  });

  it('does not store "Unknown" as if it were a real name', () => {
    // It is what the Drive shows when it has no name, so keeping it would turn
    // a missing name into a permanent one.
    expect(normalizeBackupNames({ a: 'Unknown', b: 'unknown', c: 'Real' })).toEqual({ c: 'Real' });
  });

  it('survives junk in place of a name map', () => {
    for (const junk of [null, undefined, [], 'nope', 7]) {
      expect(normalizeBackupNames(junk)).toEqual({});
    }
  });

  it('de-duplicates favourites', () => {
    expect(build({ favourites: ['a', ' a ', '', 'b'] }).favourites).toEqual(['a', 'b']);
  });
});

describe('reading an untrusted snapshot', () => {
  it('rejects anything that is not a snapshot of a known version', () => {
    for (const junk of [null, {}, 'nope', { type: 'other', version: 2 }]) {
      expect(readDriveBackupSnapshot(junk)).toEqual({ ok: false, error: 'invalid_snapshot' });
    }
    expect(readDriveBackupSnapshot({ type: DRIVE_BACKUP_SNAPSHOT_TYPE, version: 3 }).ok).toBe(false);
  });

  it('accepts both versions that have shipped', () => {
    for (const version of [1, 2]) {
      expect(readDriveBackupSnapshot({ type: DRIVE_BACKUP_SNAPSHOT_TYPE, version }).ok).toBe(true);
    }
  });

  it('reports no shortcuts rather than an empty list for a v1 backup', () => {
    // Null means "this backup has nothing to say about shortcuts"; an empty
    // list would mean "there are none" and wipe the ones already there.
    const v1 = readDriveBackupSnapshot({ type: DRIVE_BACKUP_SNAPSHOT_TYPE, version: 1 });
    expect(v1.ok && v1.shortcutEntries).toBeNull();

    const v2 = readDriveBackupSnapshot({
      type: DRIVE_BACKUP_SNAPSHOT_TYPE,
      version: 2,
      shortcutEntries: [],
    });
    expect(v2.ok && v2.shortcutEntries).toEqual([]);
  });

  it('ignores a sequence number that cannot be trusted', () => {
    for (const seq of [0, -1, NaN, 'soon', undefined]) {
      const read = readDriveBackupSnapshot({ type: DRIVE_BACKUP_SNAPSHOT_TYPE, version: 2, seq });
      expect(read.ok && read.seq).toBeUndefined();
    }
  });
});

describe('warning before a restore', () => {
  const ctx = { localSeq: 5, currentWallet: 'lumen1abc' };

  it('flags a snapshot older than what is already applied', () => {
    expect(summarizeDriveBackupSnapshot({ seq: 4 }, ctx).rollback).toBe(true);
    expect(summarizeDriveBackupSnapshot({ seq: 5 }, ctx).rollback).toBe(false);
    expect(summarizeDriveBackupSnapshot({ seq: 6 }, ctx).rollback).toBe(false);
  });

  it('does not cry rollback when either side has no sequence', () => {
    expect(summarizeDriveBackupSnapshot({ seq: 4 }, { ...ctx, localSeq: 0 }).rollback).toBe(false);
    expect(summarizeDriveBackupSnapshot({}, ctx).rollback).toBe(false);
  });

  it('flags another wallet, case-insensitively', () => {
    expect(summarizeDriveBackupSnapshot({ walletAddress: 'lumen1XYZ' }, ctx).walletMismatch).toBe(true);
    expect(summarizeDriveBackupSnapshot({ walletAddress: 'LUMEN1ABC' }, ctx).walletMismatch).toBe(false);
    expect(summarizeDriveBackupSnapshot({ walletAddress: '' }, ctx).walletMismatch).toBe(false);
  });

  it('counts shortcuts in preference to plain favourites', () => {
    const summary = summarizeDriveBackupSnapshot(
      { shortcutEntries: [1, 2, 3], favourites: ['a'] },
      ctx
    );
    expect(summary.favCount).toBe(3);
    expect(summarizeDriveBackupSnapshot({ favourites: ['a'] }, ctx).favCount).toBe(1);
  });
});

describe('explaining a failure', () => {
  it('translates the codes it knows', () => {
    expect(driveBackupFriendlyError('decrypt_failed')).toBe('Wrong password or corrupted backup file.');
    expect(driveBackupFriendlyError('')).toBe('Backup failed');
  });

  it('makes an unknown code readable rather than showing raw snake_case', () => {
    expect(driveBackupFriendlyError('some_new_failure')).toBe('some new failure');
  });
});
