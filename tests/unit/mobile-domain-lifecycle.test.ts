import { describe, expect, it } from 'vitest';
import {
  isAuctionOpen,
  isAuctionSettleable,
  lifecycleStatus,
  lifecycleWindows,
  toSeconds
} from '../../platform/mobile/impl/domain-lifecycle';

/**
 * The mobile lifecycle rule against the desktop's, over the same table.
 *
 * Both are copies of `lifecycleStatus` in x/dns/keeper/keeper.go, and a copy
 * of a rule is exactly the kind of thing that drifts silently. What drifting
 * costs here is concrete: the badge an owner reads on their domain and the
 * auction list a bidder acts on would disagree about whether a name is in
 * grace, and one of the two would be inviting a transaction the chain refuses.
 *
 * So this does not restate the rule - it runs both implementations and
 * compares. If the desktop copy changes with the chain and this one does not,
 * these fail.
 */
const desktop = require('../../electron/chain/domainLifecycle.cjs');

const DAY = 24 * 3600;
const EXPIRE = 1_800_000_000;

/** Every interesting instant relative to a domain expiring at EXPIRE. */
const MOMENTS = [
  { label: 'long before expiry', now: EXPIRE - 90 * DAY },
  { label: 'a second before expiry', now: EXPIRE - 1 },
  { label: 'the instant it expires', now: EXPIRE },
  { label: 'inside grace', now: EXPIRE + 3 * DAY },
  { label: 'the instant grace ends', now: EXPIRE + 30 * DAY },
  { label: 'inside the auction', now: EXPIRE + 33 * DAY },
  { label: 'the instant the auction ends', now: EXPIRE + 37 * DAY },
  { label: 'long after', now: EXPIRE + 400 * DAY }
];

/** Params as the LCD sends them, as numbers, and missing altogether. */
const PARAMS = [
  { label: 'strings from the LCD', grace: '30', auction: '7' },
  { label: 'numbers', grace: 30, auction: 7 },
  { label: 'no grace', grace: 0, auction: 7 },
  { label: 'no auction', grace: 30, auction: 0 },
  { label: 'neither', grace: 0, auction: 0 },
  { label: 'absent', grace: undefined, auction: undefined }
];

/** Expiries the chain can send, including the ones that mean "never". */
const EXPIRIES = [String(EXPIRE), EXPIRE, 0, '0', '', null, undefined, 'abc', -5];

describe('domain lifecycle, mobile against desktop', () => {
  for (const { label: paramLabel, grace, auction } of PARAMS) {
    describe(paramLabel, () => {
      it('agrees on every status, at every moment, for every expiry', () => {
        for (const expireAt of EXPIRIES) {
          for (const { now } of MOMENTS) {
            expect(lifecycleStatus(now, expireAt, grace, auction)).toBe(
              desktop.lifecycleStatus(now, expireAt, grace, auction)
            );
          }
        }
      });

      it('agrees on the three boundaries', () => {
        for (const expireAt of EXPIRIES) {
          expect(lifecycleWindows(expireAt, grace, auction)).toEqual(
            desktop.lifecycleWindows(expireAt, grace, auction)
          );
        }
      });

      it('agrees on whether a bid and a settlement would be accepted', () => {
        for (const expireAt of EXPIRIES) {
          for (const { now } of MOMENTS) {
            expect(isAuctionOpen(now, expireAt, grace, auction)).toBe(
              desktop.isAuctionOpen(now, expireAt, grace, auction)
            );
            expect(isAuctionSettleable(now, expireAt, grace, auction)).toBe(
              desktop.isAuctionSettleable(now, expireAt, grace, auction)
            );
          }
        }
      });
    });
  }

  it('reads uint64 the same way, including the values that mean "never"', () => {
    for (const input of [...EXPIRIES, '00042', ' 7 ', 1.9, NaN, Infinity, {}, []]) {
      expect(toSeconds(input)).toBe(desktop.toSeconds(input));
    }
  });

  /**
   * One absolute check beside the comparison: two implementations that drifted
   * together would still agree with each other.
   */
  it('puts a live name in active, a lapsed one in grace, then auction, then free', () => {
    const status = (now: number) => lifecycleStatus(now, EXPIRE, 30, 7);
    expect(status(EXPIRE - 1)).toBe('active');
    expect(status(EXPIRE)).toBe('grace');
    expect(status(EXPIRE + 30 * DAY - 1)).toBe('grace');
    expect(status(EXPIRE + 30 * DAY)).toBe('auction');
    expect(status(EXPIRE + 37 * DAY - 1)).toBe('auction');
    expect(status(EXPIRE + 37 * DAY)).toBe('free');
  });
});
