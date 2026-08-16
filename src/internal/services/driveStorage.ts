/**
 * Layout of the Drive's per-profile `localStorage`.
 *
 * The Drive page, the IPFS viewer, the site-modal host and the upload helper
 * all read and write the same browser storage. They each used to re-declare the
 * key prefixes and the `<prefix>:<profileId>` convention, so a typo in one of
 * them would quietly split a profile's Drive in two. The key builders live here
 * and nowhere else; the prefixes themselves come from the app-wide registry in
 * `storage.ts`.
 */

import { STORAGE_KEYS, profileScopedKey, readString, writeString } from './storage';

/** Saved Drive entries for a profile. */
export function driveFilesKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveFiles, profileId);
}

/** User-chosen display names, keyed by CID. */
export function driveLocalNamesKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveLocalNames, profileId);
}

/** Pending HLS transcode queue for a profile. */
export function driveHlsQueueKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveHlsQueue, profileId);
}

/** Monotonic counter bumped on every local Drive mutation, used by backup export. */
function driveBackupSeqKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveBackupSeq, profileId);
}

export function driveBackupLastExportAtKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveBackupLastExportAt, profileId);
}

export function driveBackupLastImportAtKey(profileId: string): string {
  return profileScopedKey(STORAGE_KEYS.driveBackupLastImportAt, profileId);
}

/** Current value of the backup counter, `0` when it was never written. */
export function readDriveBackupSeq(profileId: string): number {
  const current = Number.parseInt(readString(driveBackupSeqKey(profileId)) || '0', 10);
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

function writeBackupSeq(profileId: string, value: number): void {
  writeString(driveBackupSeqKey(profileId), String(value));
}

/** Increments the backup counter and returns its new value. */
export function nextDriveBackupSeq(profileId: string): number {
  const next = readDriveBackupSeq(profileId) + 1;
  writeBackupSeq(profileId, next);
  return next;
}

/** Moves the counter forward to `nextSeq`, never backwards (used after an import). */
export function bumpDriveBackupSeq(profileId: string, nextSeq: number): void {
  const base = readDriveBackupSeq(profileId);
  writeBackupSeq(profileId, Number.isFinite(nextSeq) && nextSeq > base ? Math.floor(nextSeq) : base);
}
