import { t } from '../../stores/i18nStore';
import type {
  DriveBackupReadResult,
  DriveBackupShortcutEntry,
  DriveBackupSnapshotSummary,
  DriveBackupSnapshotV2,
} from '../../types/drivePage';
import type { DriveFile } from '../../types/upload';

/**
 * The Drive backup snapshot format: what goes into one, and what comes back
 * out of one.
 *
 * Both directions were written separately in DrivePage, and they normalised
 * identically - the same seven fields per file, the same rejection of names
 * reading "unknown", the same 500 and 5000 caps - once on the way out and once
 * on the way in. A format defined twice is a format that can disagree with
 * itself: raising the file cap on export while leaving the import alone would
 * have silently dropped the extra files at restore, on a feature whose whole
 * job is not to lose anything.
 *
 * Writing and reading now share the normalisation, so the cap is one number.
 */

export const DRIVE_BACKUP_SNAPSHOT_TYPE = 'lumen.driveBackup.snapshot';

/** Deliberately generous: this is a guard against a runaway file, not a quota. */
export const MAX_BACKUP_FILES = 500;
export const MAX_BACKUP_NAMES = 5000;

export function normalizeBackupFiles(raw: unknown): DriveFile[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: DriveFile[] = [];
  for (const entry of list) {
    const file = entry as any;
    const cid = String(file?.cid || '').trim();
    if (!cid) continue;

    const sizeRaw = Number(file?.size);
    const uploadedAtRaw = Number(file?.uploadedAt);
    const uploadedAt = Number.isFinite(uploadedAtRaw) ? uploadedAtRaw : undefined;
    const type = file?.type === 'dir' ? 'dir' : file?.type === 'file' ? 'file' : undefined;
    const rootCid = String(file?.rootCid || '').trim() || undefined;
    const relPath = String(file?.relPath || '').trim() || undefined;

    out.push({
      cid,
      name: String(file?.name || '').trim() || 'Unknown',
      size: Number.isFinite(sizeRaw) && sizeRaw >= 0 ? sizeRaw : 0,
      ...(uploadedAt != null ? { uploadedAt } : {}),
      ...(type ? { type } : {}),
      ...(rootCid ? { rootCid } : {}),
      ...(relPath ? { relPath } : {}),
    } as DriveFile);

    if (out.length >= MAX_BACKUP_FILES) break;
  }
  return out;
}

/**
 * "Unknown" is what the Drive shows when it has no name for a CID, so storing
 * it would turn a missing name into a real one.
 */
export function normalizeBackupNames(raw: unknown): Record<string, string> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const cid = String(key || '').trim();
    const name = String(value || '').trim();
    if (!cid || !name || name.toLowerCase() === 'unknown') continue;
    out[cid] = name;
    if (Object.keys(out).length >= MAX_BACKUP_NAMES) break;
  }
  return out;
}

function normalizeUrls(raw: unknown): string[] {
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  return Array.from(new Set(list.map((u) => String(u || '').trim()).filter(Boolean)));
}

export function buildDriveBackupSnapshot(input: {
  seq: number;
  walletAddress: string;
  files: unknown;
  localNames: unknown;
  favourites: unknown;
  shortcutEntries: DriveBackupShortcutEntry[];
  createdAt?: number;
}): DriveBackupSnapshotV2 {
  return {
    type: DRIVE_BACKUP_SNAPSHOT_TYPE,
    version: 2,
    createdAt: input.createdAt ?? Date.now(),
    seq: input.seq,
    walletAddress: input.walletAddress,
    drive: {
      files: normalizeBackupFiles(input.files),
      localNames: normalizeBackupNames(input.localNames),
    },
    favourites: normalizeUrls(input.favourites),
    shortcutEntries: input.shortcutEntries.map((entry) => ({
      id: entry.id,
      url: entry.url,
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.pinned ? { pinned: true } : {}),
      ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
      ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
    })),
  };
}

/**
 * Validates and normalises a snapshot without applying it - the caller decides
 * what to do with the result, since writing it touches storage and the view.
 *
 * `shortcutEntries` comes back null rather than empty for a version 1 snapshot,
 * which predates them: null means "this backup has nothing to say about
 * shortcuts, keep the plain favourites", where an empty list would mean "this
 * backup says there are none" and wipe them.
 */
export function readDriveBackupSnapshot(snap: unknown): DriveBackupReadResult {
  const candidate = snap as any;
  if (
    !candidate ||
    candidate.type !== DRIVE_BACKUP_SNAPSHOT_TYPE ||
    ![1, 2].includes(Number(candidate.version))
  ) {
    return { ok: false, error: 'invalid_snapshot' };
  }

  const seq = Number(candidate.seq);
  return {
    ok: true,
    files: normalizeBackupFiles(candidate.drive?.files),
    localNames: normalizeBackupNames(candidate.drive?.localNames),
    favourites: normalizeUrls(candidate.favourites),
    shortcutEntries: Array.isArray(candidate.shortcutEntries)
      ? (candidate.shortcutEntries as DriveBackupShortcutEntry[])
      : null,
    ...(Number.isFinite(seq) && seq > 0 ? { seq } : {}),
  };
}

/**
 * What to tell the user before they overwrite their Drive with a backup.
 *
 * `rollback` and `walletMismatch` are the two questions worth raising: an older
 * snapshot than the one already applied would undo work, and a snapshot made
 * under a different wallet belongs to someone else's Drive.
 */
export function summarizeDriveBackupSnapshot(
  snap: unknown,
  context: { localSeq: number; currentWallet: string; source?: string }
): DriveBackupSnapshotSummary {
  const candidate = snap as any;
  const seq = Number(candidate?.seq) || 0;
  const walletAddress = String(candidate?.walletAddress || '').trim();
  const localSeq = Number(context.localSeq) || 0;
  const currentWallet = String(context.currentWallet || '').trim();

  return {
    source: String(context.source || '').trim(),
    createdAt: Number(candidate?.createdAt) || 0,
    seq,
    walletAddress,
    filesCount: Array.isArray(candidate?.drive?.files) ? candidate.drive.files.length : 0,
    favCount: Array.isArray(candidate?.shortcutEntries)
      ? candidate.shortcutEntries.length
      : Array.isArray(candidate?.favourites)
        ? candidate.favourites.length
        : 0,
    localSeq,
    rollback: !!seq && !!localSeq && seq < localSeq,
    walletMismatch:
      !!walletAddress && !!currentWallet && walletAddress.toLowerCase() !== currentWallet.toLowerCase(),
  };
}

export function driveBackupFriendlyError(code: string): string {
  const raw = String(code || '').trim();
  if (!raw) return t('Backup failed');
  if (raw === 'missing_password') return t('Password required.');
  if (raw === 'weak_password') return t('Password too short (min 8 characters).');
  if (raw === 'decrypt_failed') return t('Wrong password or corrupted backup file.');
  if (raw === 'invalid_envelope') return t('Invalid backup file.');
  if (raw === 'invalid_snapshot') return t('Invalid snapshot.');
  return raw.replace(/_/g, ' ');
}
