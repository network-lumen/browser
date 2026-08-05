import { safeString } from './coerce';
import type { PinJobSnapshot } from '../../types/pinJob';

/**
 * Reading a managed pin job out of what the main process sends back.
 *
 * `LumenSiteModalHost` (the site's "save to Drive" modal) and `IpfsPage` (the
 * same action from the viewer) each held an identical copy of this, differing
 * only in the names of the refs they poured it into. The parsing is what is
 * shared; where the values land is not, so only the parsing moved.
 *
 * The list below is the reason this matters more than the line count suggests:
 * a status added on the main side has to be recognised here or a job silently
 * stops looking active, and there were two places to forget.
 */
const ACTIVE_STATUSES = ['queued', 'running', 'retry_waiting'];

/** A finite number, or null - progress fields are absent as often as they are set. */
function progressNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Returns null when there is no job to read, so callers can leave their state alone. */
export function readPinJobSnapshot(job: unknown): PinJobSnapshot | null {
  if (!job || typeof job !== 'object') return null;
  const raw = job as Record<string, unknown>;
  const status = safeString(raw.status);

  return {
    id: safeString(raw.id),
    status,
    progressText: safeString(raw.progressText),
    progressCurrent: progressNumber(raw.progressCurrent),
    progressTotal: progressNumber(raw.progressTotal),
    progressPercent: progressNumber(raw.progressPercent),
    progressUnit: safeString(raw.progressUnit),
    active: ACTIVE_STATUSES.includes(status.toLowerCase())
  };
}
