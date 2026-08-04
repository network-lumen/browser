import type {
  DateInput,
  FormatBytesOptions,
  FormatDateOptions,
  FormatDecimalOptions,
  FormatDenomOptions,
  FormatNumberOptions,
  TruncateMiddleOptions
} from '../../types/format';

export type { DateInput };

/**
 * Display formatting shared by every page. Each helper takes the raw value plus
 * the few knobs that genuinely differ between call sites (decimals, placeholder
 * for missing data, `Intl` overrides) so that pages configure a single
 * implementation instead of re-deriving one.
 */

/** The UI is English-only; dates are pinned to en-US so they read the same everywhere. */
const DATE_LOCALE = 'en-US';

/** Micro-denominated chain amounts: 1 LMN = 1_000_000 ulmn. */
const MICRO_UNIT = 1_000_000;

const EM_DASH = '—';

/**
 * Normalizes any of the timestamp shapes the app deals with into a `Date`.
 * Epoch values below 1e12 are read as seconds (chain timestamps) rather than
 * milliseconds. Returns `null` for missing or unparseable input.
 */
function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  let candidate: Date;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    candidate = new Date(toEpochMs(value));
  } else {
    const raw = String(value).trim();
    if (!raw) return null;
    candidate = /^\d+$/.test(raw) ? new Date(toEpochMs(Number(raw))) : new Date(raw);
  }
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

/** Epoch values below 1e12 are seconds (chain timestamps), above are milliseconds. */
function toEpochMs(value: number): number {
  return value < 1e12 ? value * 1000 : value;
}

/** Date only, e.g. `Aug 3, 2026`. */
export function formatDate(value: DateInput, options: FormatDateOptions = {}): string {
  const { empty = EM_DASH, locale = DATE_LOCALE, intl } = options;
  const date = toDate(value);
  if (!date) return empty;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...intl
  });
}

/** Date and time, e.g. `Aug 3, 2026, 03:45 PM`. */
export function formatDateTime(value: DateInput, options: FormatDateOptions = {}): string {
  const { empty = EM_DASH, locale = DATE_LOCALE, intl } = options;
  const date = toDate(value);
  if (!date) return empty;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...intl
  });
}

/**
 * Clock time only, e.g. `3:45 PM`. Unlike the date helpers this follows the
 * system locale, so a 24-hour region keeps its 24-hour clock.
 */
export function formatTimeOfDay(value: DateInput, options: FormatDateOptions = {}): string {
  const { empty = EM_DASH, locale, intl } = options;
  const date = toDate(value);
  if (!date) return empty;
  return date.toLocaleString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...intl
  });
}

/** Thousands-separated integer, e.g. `1,204,915`. */
export function formatNumber(
  value: number | string | null | undefined,
  options: FormatNumberOptions = {}
): string {
  const { empty = EM_DASH, locale, intl } = options;
  if (value == null || (typeof value === 'string' && !value.trim())) return empty;
  const n = Number(value);
  if (!Number.isFinite(n)) return empty;
  return new Intl.NumberFormat(locale, intl).format(n);
}

/** Fixed-precision decimal, trailing zeros trimmed by default (`1.500000` -> `1.5`). */
export function formatDecimal(
  value: number | string | null | undefined,
  options: FormatDecimalOptions = {}
): string {
  const { decimals = 6, trimTrailingZeros = true, empty = EM_DASH } = options;
  if (value == null || (typeof value === 'string' && !value.trim())) return empty;
  const n = Number(value);
  if (!Number.isFinite(n)) return empty;
  const fixed = n.toFixed(decimals);
  return trimTrailingZeros ? fixed.replace(/\.?0+$/, '') : fixed;
}

/** Micro-denominated chain amount (ulmn) rendered as its display unit (LMN). */
export function formatMicroAmount(
  value: number | string | null | undefined,
  options: FormatDecimalOptions = {}
): string {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return options.empty ?? EM_DASH;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return options.empty ?? EM_DASH;
  return formatDecimal(n / MICRO_UNIT, options);
}

/** `ulmn` -> `LMN`, `ulumen` -> `LUMEN`, `utoken` -> `TOKEN`. */
export function formatDenom(denom: string, options: FormatDenomOptions = {}): string {
  const raw = String(denom || '');
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'ulmn') return 'LMN';
  if (lower === 'ulumen') return 'LUMEN';
  if (lower.startsWith('u')) return raw.slice(1).toUpperCase();
  return options.uppercaseFallback ? raw.toUpperCase() : raw;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];

/** Human-readable byte size, e.g. `1.5 MB`. */
export function formatBytes(
  bytes: number | null | undefined,
  options: FormatBytesOptions = {}
): string {
  const { decimals = 1, empty = EM_DASH } = options;
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return empty;
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : decimals)} ${BYTE_UNITS[unit]}`;
}

/**
 * Elides the middle of a long identifier (address, hash, CID), e.g.
 * `lmn1abc...x9f2`. Values already short enough to gain nothing are returned
 * untouched.
 */
export function truncateMiddle(value: string, options: TruncateMiddleOptions = {}): string {
  const { start = 10, end = 8, separator = '...', empty = '' } = options;
  const raw = String(value || '').trim();
  if (!raw) return empty;
  if (raw.length <= start + end + separator.length) return raw;
  return `${raw.slice(0, start)}${separator}${raw.slice(-end)}`;
}
