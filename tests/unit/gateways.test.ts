import { describe, expect, it } from 'vitest';
import {
  OPTIMISTIC_PIN_TTL_MS,
  addOptimisticPin,
  deriveGatewayStatus,
  encodeGatewayPath,
  isSubscriptionExpired,
  formatRegionsLabel,
  gatewayDisplayName,
  reconcileOptimisticPins,
  removeOptimisticPin,
} from '../../src/internal/services/gateways';
import type { GatewayView, SubscriptionView } from '../../src/types/drivePage';

const gw = (over: Partial<GatewayView> = {}) => ({ id: 'g1', ...over }) as GatewayView;
const sub = (status: string) => ({ status }) as SubscriptionView;

describe('naming a gateway', () => {
  it('prefers the endpoint, then the operator, then the bare id', () => {
    expect(gatewayDisplayName(gw({ endpoint: 'https://gw.example' }))).toBe('https://gw.example');
    expect(gatewayDisplayName(gw({ operator: 'alice' }))).toBe('Gateway · alice');
    expect(gatewayDisplayName(gw())).toBe('Gateway #g1');
  });
});

describe('deriving a status from subscriptions', () => {
  it('lets one live subscription carry the gateway', () => {
    expect(deriveGatewayStatus([sub('expired'), sub('ACTIVE')])).toBe('active');
  });

  it('falls back to pending before off', () => {
    expect(deriveGatewayStatus([sub('expired'), sub('pending_payment')])).toBe('pending');
    expect(deriveGatewayStatus([sub('expired')])).toBe('off');
    expect(deriveGatewayStatus([])).toBe('off');
  });

  it('reads a lapsed contract as expired even while the chain calls it active', () => {
    const now = 1_000_000;
    const lapsed = { status: 'contract_status_active', expiresAt: now - 1 } as SubscriptionView;
    const live = { status: 'contract_status_active', expiresAt: now + 1 } as SubscriptionView;

    expect(deriveGatewayStatus([lapsed], now)).toBe('expired');
    expect(deriveGatewayStatus([lapsed, live], now)).toBe('active');
  });
});

describe('spotting a lapsed subscription', () => {
  const now = 1_000_000;

  it('goes by the paid period, not the on-chain status', () => {
    expect(isSubscriptionExpired({ status: 'contract_status_active', expiresAt: now - 1 } as SubscriptionView, now)).toBe(true);
    expect(isSubscriptionExpired({ status: 'contract_status_active', expiresAt: now + 1 } as SubscriptionView, now)).toBe(false);
  });

  it('says nothing about contracts with no end date, or already cancelled', () => {
    expect(isSubscriptionExpired(sub('active'), now)).toBe(false);
    expect(isSubscriptionExpired({ status: 'contract_status_canceled', expiresAt: now - 1 } as SubscriptionView, now)).toBe(false);
  });
});

describe('encoding a gateway path', () => {
  it('encodes each segment but keeps the separators', () => {
    expect(encodeGatewayPath('/a b/c#d')).toBe('a%20b/c%23d');
  });

  it('drops leading and repeated slashes', () => {
    expect(encodeGatewayPath('///a//b')).toBe('a/b');
    expect(encodeGatewayPath('')).toBe('');
  });
});

describe('labelling regions', () => {
  it('summarises past the cap instead of listing everything', () => {
    expect(formatRegionsLabel(['eu', 'us'])).toBe('eu · us');
    expect(formatRegionsLabel(['eu', 'us', 'ap'])).toBe('eu · us +1');
    expect(formatRegionsLabel(['eu', 'us', 'ap'], 1)).toBe('eu +2');
  });

  it('survives junk input', () => {
    expect(formatRegionsLabel(null)).toBe('');
    expect(formatRegionsLabel([' ', ''])).toBe('');
  });
});

describe('optimistic pins', () => {
  const now = 1_000_000;

  it('forgets a pin once the gateway reports it', () => {
    const pins = addOptimisticPin({}, 'bafy', now);
    const settled = reconcileOptimisticPins(pins, ['bafy'], { now });
    expect(settled.pins).toEqual({});
    expect(settled.displayed).toEqual(['bafy']);
  });

  it('stops claiming a pin that was never confirmed in time', () => {
    // Without this a pin that silently failed would sit in the list looking
    // successful for the rest of the session.
    const pins = addOptimisticPin({}, 'bafy', now);
    const stale = reconcileOptimisticPins(pins, [], { now: now + OPTIMISTIC_PIN_TTL_MS + 1 });
    expect(stale.pins).toEqual({});
    expect(stale.displayed).toEqual([]);

    const fresh = reconcileOptimisticPins(pins, [], { now: now + OPTIMISTIC_PIN_TTL_MS });
    expect(fresh.displayed).toEqual(['bafy']);
  });

  it('draws unconfirmed pins above the confirmed ones', () => {
    const pins = addOptimisticPin({}, 'new', now);
    expect(reconcileOptimisticPins(pins, ['old1', 'old2'], { now }).displayed).toEqual([
      'new',
      'old1',
      'old2',
    ]);
  });

  it('discards entries with an unusable timestamp', () => {
    const settled = reconcileOptimisticPins(
      { good: now, bad: NaN as number, worse: 'soon' as unknown as number },
      [],
      { now }
    );
    expect(settled.pending).toEqual(['good']);
  });

  it('de-duplicates and cleans the server list', () => {
    expect(reconcileOptimisticPins({}, ['a', ' a ', '', 'b'], { now }).displayed).toEqual(['a', 'b']);
  });

  it('adds and removes without mutating the map it was given', () => {
    const original = addOptimisticPin({}, 'bafy', now);
    const removed = removeOptimisticPin(original, 'bafy');
    expect(original).toEqual({ bafy: now });
    expect(removed).toEqual({});
  });

  it('ignores blank cids on the way in and out', () => {
    expect(addOptimisticPin({}, '   ', now)).toEqual({});
    expect(removeOptimisticPin({ bafy: now }, 'missing')).toEqual({ bafy: now });
  });
});
