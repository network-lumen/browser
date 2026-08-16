import type { HlsQueueItem, HlsQueueItemStatus } from '../../types/drivePage';
import type { DriveFile } from '../../types/upload';
import { t } from '../../stores/i18nStore';

/**
 * The HLS conversion queue: what an item is, how it survives a restart, and
 * how it reads.
 *
 * This is the part of the queue that holds still. Running a conversion is not
 * here - that drives a dozen refs, an abort controller and a progress bar, and
 * pushing it behind a function signature would mean handing all of them across
 * the boundary, which is not a service but the page wearing a hat. What lives
 * here is the model: the shape of a stored item, the statuses it can hold, the
 * counts derived from a list, the words and colours each status shows.
 *
 * Splitting it this way is what makes the persistence testable at all - the
 * restore path had to be reasoned about through five refs before.
 */

export function nextHlsQueueItemId(): string {
  return `hlsq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Anything unrecognised restores as "paused" rather than "queued": a queue
 * reloaded after a restart should wait for the user rather than start
 * converting on its own.
 */
export function normalizeStoredHlsQueueStatus(rawStatus: unknown): HlsQueueItemStatus {
  const status = String(rawStatus || '').trim().toLowerCase();
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'cancelled';
  return 'paused';
}

export function sanitizeStoredHlsQueueFile(raw: any): DriveFile | null {
  const cid = String(raw?.cid || '').trim();
  const name = String(raw?.name || '').trim();
  if (!cid || !name) return null;

  const size = Number(raw?.size);
  const uploadedAt = Number(raw?.uploadedAt);
  const type = raw?.type === 'dir' ? 'dir' : raw?.type === 'file' ? 'file' : undefined;
  const rootCid = String(raw?.rootCid || '').trim();
  const relPath = String(raw?.relPath || '').trim();

  return {
    cid,
    name,
    size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    uploadedAt: Number.isFinite(uploadedAt) && uploadedAt > 0 ? Math.round(uploadedAt) : undefined,
    type,
    rootCid: rootCid || undefined,
    relPath: relPath || undefined,
  };
}

/** An error is only worth keeping for the statuses that can explain one. */
export function serializeHlsQueue(items: HlsQueueItem[]): unknown[] {
  return items.map((item) => ({
    id: item.id,
    file: item.file,
    status: item.status,
    error: item.status === 'failed' || item.status === 'cancelled' ? item.error : undefined,
  }));
}

export function parseStoredHlsQueue(parsed: unknown): HlsQueueItem[] {
  const items = Array.isArray(parsed) ? parsed : [];
  const restored: HlsQueueItem[] = [];
  for (const raw of items) {
    const file = sanitizeStoredHlsQueueFile((raw as any)?.file);
    if (!file) continue;
    const status = normalizeStoredHlsQueueStatus((raw as any)?.status);
    restored.push({
      id: String((raw as any)?.id || nextHlsQueueItemId()),
      file,
      status,
      error:
        status === 'failed' || status === 'cancelled'
          ? String((raw as any)?.error || '').trim() || undefined
          : undefined,
    });
  }
  return restored;
}

export function hlsQueueHasPendingItems(items: HlsQueueItem[]): boolean {
  return items.some(
    (item) => item.status === 'queued' || item.status === 'converting' || item.status === 'paused'
  );
}

/** Paused as a whole: something is waiting and nothing is still moving. */
export function hlsQueueIsPaused(items: HlsQueueItem[]): boolean {
  return (
    items.some((item) => item.status === 'paused') &&
    !items.some((item) => item.status === 'queued' || item.status === 'converting')
  );
}

export function countHlsQueue(items: HlsQueueItem[]) {
  const of = (...statuses: HlsQueueItemStatus[]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  return {
    active: of('queued', 'converting'),
    paused: of('paused'),
    done: of('done'),
    failed: of('failed'),
    cancelled: of('cancelled'),
  };
}

export function hlsQueueSummaryText(counts: ReturnType<typeof countHlsQueue>): string {
  const parts: string[] = [];
  if (counts.active) parts.push(t('{count} active', { count: counts.active }));
  if (counts.paused) parts.push(t('{count} paused', { count: counts.paused }));
  if (counts.done) parts.push(t('{count} done', { count: counts.done }));
  if (counts.failed) parts.push(t('{count} failed', { count: counts.failed }));
  if (counts.cancelled) parts.push(t('{count} cancelled', { count: counts.cancelled }));
  return parts.join(' • ');
}

export function hlsQueueStatusLabel(status: HlsQueueItemStatus): string {
  if (status === 'queued') return t('Queued');
  if (status === 'converting') return t('Converting');
  if (status === 'paused') return t('Paused');
  if (status === 'done') return t('Done');
  if (status === 'cancelled') return t('Cancelled');
  return t('Failed');
}

const STATUS_TINTS: Partial<Record<HlsQueueItemStatus, string>> = {
  converting: '--color-primary',
  done: '--color-success',
  paused: '--color-primary',
  failed: '--color-error',
  cancelled: '--color-warning',
};

export function hlsQueueItemStyle(status: HlsQueueItemStatus): Record<string, string> {
  const tint = STATUS_TINTS[status];
  if (!tint) return {};
  return {
    borderColor: `rgba(var(${tint}-rgb), 0.25)`,
    background: `rgba(var(${tint}-rgb), 0.06)`,
  };
}

export function hlsQueueStatusTextStyle(status: HlsQueueItemStatus): Record<string, string> {
  if (status === 'failed') return { color: 'var(--color-error)' };
  if (status === 'paused') return { color: 'var(--color-primary)' };
  if (status === 'cancelled') return { color: 'var(--color-warning)' };
  return {};
}
