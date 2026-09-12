import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const lifecycle = require_('../../electron/chain/domainLifecycle.cjs');

const {
  SECONDS_PER_DAY,
  toSeconds,
  lifecycleWindows,
  lifecycleStatus,
  describeLifecycle,
  isAuctionOpen,
  isAuctionSettleable,
  canRenew
} = lifecycle;

/**
 * Where a domain is in its life.
 *
 * This module is a copy of `lifecycleStatus` in x/dns/keeper/keeper.go, held in
 * the browser because the chain's own queries do not answer the question: the
 * `Resolve` handler declares a `status` field and returns only the owner. So
 * these tests are written against the Go, boundary for boundary - an off-by-one
 * here does not fail loudly, it offers a bid the chain will refuse after
 * charging for the gas.
 */

/** The values mainnet actually runs, read from /lumen/dns/v1/params. */
const GRACE_DAYS = 7;
const AUCTION_DAYS = 7;

const EXPIRE = 1_800_000_000;
const GRACE_END = EXPIRE + GRACE_DAYS * SECONDS_PER_DAY;
const AUCTION_END = GRACE_END + AUCTION_DAYS * SECONDS_PER_DAY;

const statusAt = (now: number, expire: number = EXPIRE) =>
  lifecycleStatus(now, expire, GRACE_DAYS, AUCTION_DAYS);

describe('toSeconds', () => {
  it('reads the decimal strings the LCD returns for uint64', () => {
    expect(toSeconds('1800000000')).toBe(1_800_000_000);
    expect(toSeconds(1_800_000_000)).toBe(1_800_000_000);
  });

  it('reads anything unusable as 0 rather than as a number', () => {
    // A missing field must not read as an expiry in 1970, which would put
    // every live domain into auction at once.
    for (const bad of [null, undefined, '', '   ', 'abc', {}, [], NaN, -1, 0, '-5']) {
      expect(toSeconds(bad)).toBe(0);
    }
  });

  it('floors a fractional value instead of carrying it into arithmetic', () => {
    expect(toSeconds(10.9)).toBe(10);
  });
});

describe('lifecycleStatus', () => {
  it('is active up to the last second before expiry', () => {
    expect(statusAt(EXPIRE - 86_400)).toBe('active');
    expect(statusAt(EXPIRE - 1)).toBe('active');
  });

  it('turns to grace exactly at expiry, not a second before', () => {
    // The Go reads `if now < expire { active }`, so `now == expire` is grace.
    expect(statusAt(EXPIRE)).toBe('grace');
  });

  it('stays in grace to the last second of the grace window', () => {
    expect(statusAt(GRACE_END - 1)).toBe('grace');
  });

  it('opens the auction exactly where grace ends', () => {
    expect(statusAt(GRACE_END)).toBe('auction');
    expect(statusAt(AUCTION_END - 1)).toBe('auction');
  });

  it('is free once the auction window has closed', () => {
    expect(statusAt(AUCTION_END)).toBe('free');
    expect(statusAt(AUCTION_END + 86_400)).toBe('free');
  });

  it('calls a domain with no expiry free, whatever the time is', () => {
    expect(statusAt(0, 0)).toBe('free');
    expect(statusAt(EXPIRE, 0)).toBe('free');
  });

  it('collapses grace and auction when both params are zero', () => {
    // Governance can set either to 0. The windows then have no width, and an
    // expired domain goes straight to free with nothing to bid on.
    expect(lifecycleStatus(EXPIRE - 1, EXPIRE, 0, 0)).toBe('active');
    expect(lifecycleStatus(EXPIRE, EXPIRE, 0, 0)).toBe('free');
  });

  it('goes from grace straight to free when only auction_days is zero', () => {
    expect(lifecycleStatus(GRACE_END - 1, EXPIRE, GRACE_DAYS, 0)).toBe('grace');
    expect(lifecycleStatus(GRACE_END, EXPIRE, GRACE_DAYS, 0)).toBe('free');
  });
});

describe('lifecycleWindows', () => {
  it('opens the auction where the grace period closes', () => {
    // `Bid` builds its auction row with `start = expire_at + grace_days*86400`.
    // If these two ever disagree the UI shows a countdown to a window the chain
    // does not have.
    const w = lifecycleWindows(EXPIRE, GRACE_DAYS, AUCTION_DAYS);
    expect(w).toEqual({
      expireAt: EXPIRE,
      graceEnd: GRACE_END,
      auctionStart: GRACE_END,
      auctionEnd: AUCTION_END
    });
  });

  it('returns zeroes for a domain that has no expiry', () => {
    expect(lifecycleWindows(0, GRACE_DAYS, AUCTION_DAYS)).toEqual({
      expireAt: 0,
      graceEnd: 0,
      auctionStart: 0,
      auctionEnd: 0
    });
  });
});

describe('describeLifecycle', () => {
  it('reports the status alongside the boundaries it was derived from', () => {
    expect(describeLifecycle(GRACE_END + 60, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toEqual({
      status: 'auction',
      expireAt: EXPIRE,
      graceEnd: GRACE_END,
      auctionStart: GRACE_END,
      auctionEnd: AUCTION_END
    });
  });
});

describe('isAuctionOpen', () => {
  it('is true only inside the window the chain accepts a bid in', () => {
    expect(isAuctionOpen(GRACE_END - 1, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
    expect(isAuctionOpen(GRACE_END, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
    expect(isAuctionOpen(AUCTION_END - 1, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
    expect(isAuctionOpen(AUCTION_END, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
  });
});

describe('isAuctionSettleable', () => {
  it('is false until the auction window has closed', () => {
    // `Settle` refuses with "auction not finished yet" while now < auctionEnd.
    expect(isAuctionSettleable(AUCTION_END - 1, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
    expect(isAuctionSettleable(AUCTION_END, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
  });

  it('is false for a domain that was never registered', () => {
    expect(isAuctionSettleable(AUCTION_END, 0, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
  });
});

describe('canRenew', () => {
  it('allows an owner to extend early, and to rescue a domain in grace', () => {
    expect(canRenew(EXPIRE - 86_400, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
    expect(canRenew(EXPIRE, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
  });

  it('still allows it mid-auction, where the owner has not changed yet', () => {
    // The auction moves the name only when `Settle` runs, so until then the
    // owner renewing is the owner the chain still recognises.
    expect(canRenew(GRACE_END, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(true);
  });

  it('refuses once the domain is free, where renewing buys back nothing', () => {
    // The row keeps the old owner, so `Renew` would be accepted and charged
    // while anyone else can register the name underneath it.
    expect(canRenew(AUCTION_END, EXPIRE, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
    expect(canRenew(EXPIRE, 0, GRACE_DAYS, AUCTION_DAYS)).toBe(false);
  });
});
