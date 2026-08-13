import type { GatewayView, OptimisticPins, SubscriptionView } from '../../types/drivePage';
import { t } from '../../stores/i18nStore';

/**
 * Reading a gateway, and remembering what has been pinned to one before the
 * server admits it.
 *
 * The page around this is orchestration - selecting a gateway, opening its
 * details, refreshing four different views of it - and stays where it is. What
 * moved here is the part with no refs in it: how a gateway is named, what its
 * subscriptions add up to, and the optimistic-pin bookkeeping, which was the
 * only real model in the pile and had never been testable.
 */

/** Endpoint if there is one, otherwise the operator, otherwise the bare id. */
export function gatewayDisplayName(gw: GatewayView): string {
  if (gw.endpoint) return gw.endpoint;
  if (gw.operator) return t('Gateway · {operator}', { operator: gw.operator });
  return t('Gateway #{id}', { id: gw.id });
}

/**
 * True once a subscription's paid months have run out.
 *
 * Nothing on chain flips for this: the contract keeps reporting
 * `CONTRACT_STATUS_ACTIVE` until its operator claims the payment, which can be
 * months late or never. A plan that stopped covering storage in February will
 * still call itself active in August, which is exactly how an upload ends up
 * failing against a subscription the UI swore was fine.
 */
export function isSubscriptionExpired(sub: SubscriptionView, now: number = Date.now()): boolean {
  const expiresAt = Number(sub?.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  const status = String(sub?.status || '').toLowerCase();
  if (status.includes('cancel')) return false;
  return expiresAt <= now;
}

/**
 * One live subscription makes the gateway active; a subscription that only
 * looks active because nobody closed it reads as expired; otherwise pending
 * beats off.
 */
export function deriveGatewayStatus(
  subs: SubscriptionView[],
  now: number = Date.now()
): 'active' | 'pending' | 'expired' | 'off' {
  const live = subs.filter((s) => !isSubscriptionExpired(s, now));
  const normalized = live.map((s) => String(s.status || '').toLowerCase());
  if (normalized.some((s) => s.includes('active'))) return 'active';
  if (normalized.some((s) => s.includes('pending'))) return 'pending';
  if (subs.some((s) => isSubscriptionExpired(s, now))) return 'expired';
  return 'off';
}

/** Encodes each segment separately, so the slashes stay slashes. */
export function encodeGatewayPath(path: string): string {
  const cleaned = String(path || '').replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function normalizeRegions(input: string[] | null | undefined): string[] {
  return (Array.isArray(input) ? input : []).map((r) => String(r || '').trim()).filter(Boolean);
}

export function formatRegionsTitle(input: string[] | null | undefined): string {
  return normalizeRegions(input).join(', ');
}

export function formatRegionsLabel(input: string[] | null | undefined, max = 2): string {
  const regions = normalizeRegions(input);
  if (!regions.length) return '';
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : 2;
  if (regions.length <= cap) return regions.join(' · ');
  return `${regions.slice(0, cap).join(' · ')} +${regions.length - cap}`;
}

// ---------------------------------------------------------------------------
// Optimistic pins
//
// A pin is shown as soon as it is requested, before the gateway reports it, so
// the list does not appear to swallow the action. Each one is remembered with
// the time it was made, and forgotten once the server confirms it or once it
// has waited too long - otherwise a pin that silently failed would sit in the
// list looking successful forever.
// ---------------------------------------------------------------------------

/** How long a pin may claim to exist before the gateway has confirmed it. */
export const OPTIMISTIC_PIN_TTL_MS = 2 * 60 * 1000;

export function addOptimisticPin(
  pins: OptimisticPins,
  cid: string,
  now: number = Date.now()
): OptimisticPins {
  const key = String(cid || '').trim();
  if (!key) return pins;
  return { ...pins, [key]: now };
}

export function removeOptimisticPin(pins: OptimisticPins, cid: string): OptimisticPins {
  const key = String(cid || '').trim();
  if (!key || !(key in pins)) return pins;
  const next = { ...pins };
  delete next[key];
  return next;
}

/**
 * Settles what the page remembered against what the gateway actually reports.
 *
 * Returns the pins still worth remembering and, separately, the order to draw:
 * unconfirmed pins first so a just-requested one appears at the top, then the
 * server's own list.
 */
export function reconcileOptimisticPins(
  pins: OptimisticPins,
  serverCids: string[],
  options: { now?: number; ttlMs?: number } = {}
): { pins: OptimisticPins; pending: string[]; displayed: string[] } {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? OPTIMISTIC_PIN_TTL_MS;
  const server = Array.from(new Set(serverCids.map((c) => String(c || '').trim()).filter(Boolean)));
  const serverSet = new Set(server);

  const kept: OptimisticPins = {};
  const pending: string[] = [];
  for (const [cid, timestamp] of Object.entries(pins || {})) {
    const key = String(cid || '').trim();
    if (!key) continue;
    if (serverSet.has(key)) continue;
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;
    if (now - timestamp > ttlMs) continue;
    kept[key] = timestamp;
    pending.push(key);
  }

  return { pins: kept, pending, displayed: [...pending, ...server] };
}
