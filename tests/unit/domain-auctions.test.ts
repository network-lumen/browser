import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatUlmn,
  lmnLabel,
  loadAuctions,
  minimumNextBidUlmn,
  toLifecycleStatus,
  toUlmn
} from '../../src/internal/services/domainAuctions';

/**
 * Auctions, for the renderer.
 *
 * The amounts are the part worth testing hardest. A bid is a uint64 the chain
 * compares as an integer, and the whole file exists to keep it a string: a bid
 * that loses its last digits to a float loses the auction, and does so after
 * the bid fee has been paid.
 */

function bridge(dns: Record<string, unknown> | null) {
  (window as any).lumen = dns ? { dns } : {};
}

beforeEach(() => {
  bridge(null);
});

describe('formatUlmn', () => {
  it('places the decimal point without going through a float', () => {
    expect(formatUlmn('1000000')).toBe('1');
    expect(formatUlmn('1500000')).toBe('1.5');
    expect(formatUlmn('50000')).toBe('0.05');
    expect(formatUlmn('1')).toBe('0.000001');
    expect(formatUlmn('0')).toBe('0');
  });

  it('keeps every digit of an amount a float would have rounded', () => {
    // 2^63-ish in ulmn: past Number.MAX_SAFE_INTEGER, so a float loses the end.
    expect(formatUlmn('9223372036854775807')).toBe('9223372036854.775807');
    expect(formatUlmn('9007199254740993000001')).toBe('9007199254740993.000001');
  });

  it('returns nothing for anything that is not a whole ulmn amount', () => {
    for (const bad of ['', '   ', 'abc', '1.5', '-1', null, undefined, {}]) {
      expect(formatUlmn(bad)).toBe('');
    }
  });
});

describe('toUlmn', () => {
  it('reads what a person types into the integer the chain compares', () => {
    expect(toUlmn('1')).toBe('1000000');
    expect(toUlmn('1.5')).toBe('1500000');
    expect(toUlmn('0.05')).toBe('50000');
    expect(toUlmn('0.000001')).toBe('1');
    expect(toUlmn('.5')).toBe('500000');
    expect(toUlmn('007')).toBe('7000000');
  });

  it('accepts a comma, which is the decimal separator on most of the locales', () => {
    expect(toUlmn('1,5')).toBe('1500000');
  });

  it('refuses more precision than the denom has rather than rounding it away', () => {
    // Rounding 1.0000005 down to 1 LMN is how a bid meant to beat the standing
    // one arrives equal to it and is refused.
    expect(toUlmn('1.0000005')).toBe('');
  });

  it('refuses anything that is not a number', () => {
    for (const bad of ['', '.', 'abc', '1.2.3', '-1', null, undefined]) {
      expect(toUlmn(bad)).toBe('');
    }
  });

  it('round-trips through formatUlmn', () => {
    for (const typed of ['1', '1.5', '0.05', '123.456789']) {
      expect(formatUlmn(toUlmn(typed))).toBe(typed);
    }
  });
});

describe('minimumNextBidUlmn', () => {
  it('is one ulmn more than the standing bid, in full precision', () => {
    expect(minimumNextBidUlmn('1000000')).toBe('1000001');
    // The chain reads `!bidAmt.GT(curAmt)` as a refusal, so equal is not enough.
    expect(minimumNextBidUlmn('9223372036854775807')).toBe('9223372036854775808');
  });

  it('has no answer when nothing has been bid yet', () => {
    expect(minimumNextBidUlmn('')).toBe('');
    expect(minimumNextBidUlmn(null)).toBe('');
  });
});

describe('toLifecycleStatus', () => {
  it('passes through the four the chain has', () => {
    expect(toLifecycleStatus('active')).toBe('active');
    expect(toLifecycleStatus('grace')).toBe('grace');
    expect(toLifecycleStatus('auction')).toBe('auction');
    expect(toLifecycleStatus('free')).toBe('free');
  });

  it('reads anything else as free, which offers no action', () => {
    expect(toLifecycleStatus('pending')).toBe('free');
    expect(toLifecycleStatus(undefined)).toBe('free');
  });
});

describe('lmnLabel', () => {
  it('names the unit, and shows a dash where there is no amount', () => {
    expect(lmnLabel('1500000')).toBe('1.5 LMN');
    expect(lmnLabel('')).toBe('-');
  });
});

describe('loadAuctions', () => {
  it('is an empty list when the bridge is not there', async () => {
    await expect(loadAuctions()).resolves.toMatchObject({ rows: [], truncated: false });
  });

  it('is an empty list when the node refused, not a thrown error', async () => {
    bridge({ listAuctions: vi.fn().mockResolvedValue({ ok: false, error: 'http_503' }) });
    await expect(loadAuctions()).resolves.toMatchObject({ rows: [] });
  });

  it('maps the rows and the params the main process computed', async () => {
    bridge({
      listAuctions: vi.fn().mockResolvedValue({
        ok: true,
        truncated: true,
        scannedDomains: 53,
        params: { graceDays: 7, auctionDays: 7, bidFeeUlmn: 50_000 },
        data: [
          {
            name: 'ai.lmn',
            status: 'auction',
            owner: 'lmn1owner',
            expireAtSeconds: 1_800_000_000,
            auctionStartSeconds: 1_800_604_800,
            auctionEndSeconds: 1_801_209_600,
            highestBidUlmn: '2500000',
            bidder: 'lmn1bidder',
            open: true,
            settleable: false
          }
        ]
      })
    });

    const list = await loadAuctions();
    expect(list.truncated).toBe(true);
    expect(list.bidFeeUlmn).toBe(50_000);
    expect(list.scannedDomains).toBe(53);
    expect(list.rows).toEqual([
      {
        name: 'ai.lmn',
        status: 'auction',
        owner: 'lmn1owner',
        expireAtSeconds: 1_800_000_000,
        auctionStartSeconds: 1_800_604_800,
        auctionEndSeconds: 1_801_209_600,
        highestBidUlmn: '2500000',
        bidder: 'lmn1bidder',
        open: true,
        settleable: false
      }
    ]);
  });

  it('drops a row with no name, and reads a junk bid as no bid', async () => {
    bridge({
      listAuctions: vi.fn().mockResolvedValue({
        ok: true,
        data: [
          { name: '', status: 'auction' },
          { name: 'x.lmn', status: 'auction', highestBidUlmn: 'not-a-number' }
        ]
      })
    });

    const list = await loadAuctions();
    expect(list.rows).toHaveLength(1);
    expect(list.rows[0].highestBidUlmn).toBe('');
    // Absent flags are false, never assumed open: an auction drawn as open
    // offers a bid the chain refuses after charging for the gas.
    expect(list.rows[0].open).toBe(false);
    expect(list.rows[0].settleable).toBe(false);
  });
});
