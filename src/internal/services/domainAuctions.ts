import { useInternalLumen } from '../../composables/useInternalLumen';
import type {
  AuctionList,
  AuctionRow,
  DomainLifecycleStatus
} from '../../types/domainAuctions';

/**
 * Domain auctions and renewals, for the renderer.
 *
 * The main process owns every decision here: which names are in their auction
 * window, what the standing bid is, and what the chain would accept. This file
 * only maps that answer onto typed rows and formats the few numbers the page
 * shows, so that a status shown next to a name and the button offered beside it
 * cannot come from two different readings of `expire_at`.
 */

const ULMN_PER_LMN = 1_000_000;

const EMPTY_LIST: AuctionList = {
  rows: [],
  truncated: false,
  bidFeeUlmn: 0,
  graceDays: 0,
  auctionDays: 0,
  scannedDomains: 0
};

const STATUSES: readonly DomainLifecycleStatus[] = ['active', 'grace', 'auction', 'free'];

/** An unrecognised status reads as `free`, which offers nothing and claims nothing. */
export function toLifecycleStatus(input: unknown): DomainLifecycleStatus {
  const value = String(input ?? '').trim() as DomainLifecycleStatus;
  return STATUSES.includes(value) ? value : 'free';
}

function toSeconds(input: unknown): number {
  const n = typeof input === 'number' ? input : parseInt(String(input ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * A ulmn integer string as LMN, for display.
 *
 * Kept out of `Number` until after the split: a bid is an integer of up to
 * 2^64, and the fractional part of one that large is gone by the time a float
 * has held it. Trailing zeroes are trimmed so a whole number of LMN reads as
 * "12 LMN" rather than "12.000000 LMN".
 */
export function formatUlmn(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!/^[0-9]+$/.test(raw)) return '';
  const padded = raw.padStart(7, '0');
  const whole = padded.slice(0, -6).replace(/^0+(?=\d)/, '');
  const fraction = padded.slice(-6).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** LMN typed by a person, as the ulmn integer string the chain compares. */
export function toUlmn(input: unknown): string {
  const raw = String(input ?? '').trim().replace(',', '.');
  if (!/^\d*\.?\d*$/.test(raw) || raw === '' || raw === '.') return '';
  const [whole = '', fraction = ''] = raw.split('.');
  // More precision than the denom has is refused rather than rounded: rounding
  // a bid down is how it loses to the one it was meant to beat.
  if (fraction.length > 6) return '';
  const combined = `${whole}${fraction.padEnd(6, '0')}`.replace(/^0+(?=\d)/, '');
  return combined === '' ? '0' : combined;
}

/**
 * The smallest bid the chain would accept: strictly more than the standing one.
 *
 * `Bid` also enforces a floor of one year's registration price, which is quoted
 * per name and is not known here - the dialog states it separately rather than
 * this pretending to know it.
 */
export function minimumNextBidUlmn(currentUlmn: unknown): string {
  const raw = String(currentUlmn ?? '').trim();
  if (!/^[0-9]+$/.test(raw)) return '';
  return (BigInt(raw) + 1n).toString();
}

function mapRow(raw: Record<string, unknown>): AuctionRow | null {
  const name = String(raw?.name ?? '').trim();
  if (!name) return null;
  const highestBidUlmn = String(raw?.highestBidUlmn ?? '').trim();
  return {
    name,
    status: toLifecycleStatus(raw?.status),
    owner: String(raw?.owner ?? '').trim(),
    expireAtSeconds: toSeconds(raw?.expireAtSeconds) || null,
    auctionStartSeconds: toSeconds(raw?.auctionStartSeconds) || null,
    auctionEndSeconds: toSeconds(raw?.auctionEndSeconds) || null,
    highestBidUlmn: /^[0-9]+$/.test(highestBidUlmn) ? highestBidUlmn : '',
    bidder: String(raw?.bidder ?? '').trim(),
    open: raw?.open === true,
    settleable: raw?.settleable === true
  };
}

/**
 * Every auction worth showing. Throws nothing: a missing bridge or a node that
 * refused reads as an empty list, which the page draws as "no auctions" rather
 * than as a broken tab.
 */
export async function loadAuctions(): Promise<AuctionList> {
  const dns = useInternalLumen()?.dns;
  if (typeof dns?.listAuctions !== 'function') return EMPTY_LIST;

  const res = await dns.listAuctions();
  if (!res || res.ok === false) return EMPTY_LIST;

  const rows = (Array.isArray(res.data) ? res.data : [])
    .map((row: Record<string, unknown>) => mapRow(row))
    .filter((row: AuctionRow | null): row is AuctionRow => !!row);

  const params = (res.params || {}) as Record<string, unknown>;
  return {
    rows,
    truncated: res.truncated === true,
    bidFeeUlmn: toSeconds(params.bidFeeUlmn),
    graceDays: toSeconds(params.graceDays),
    auctionDays: toSeconds(params.auctionDays),
    scannedDomains: toSeconds(res.scannedDomains)
  };
}

/** LMN with its unit, or a dash where there is no number to show. */
export function lmnLabel(ulmn: unknown): string {
  const value = formatUlmn(ulmn);
  return value ? `${value} LMN` : '-';
}

export { ULMN_PER_LMN };
