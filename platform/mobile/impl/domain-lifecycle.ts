/**
 * Where a domain is in its life - the mobile half of a rule that lives in Go.
 *
 * This is a port of `electron/chain/domainLifecycle.cjs`, which is itself a
 * copy of `lifecycleStatus` in x/dns/keeper/keeper.go. The chain stores only
 * `expire_at` and derives everything else from two governable params every
 * time it is asked, and its own queries declare a `status` field they never
 * fill, so there is nothing to read - the arithmetic has to be done here.
 *
 *   expireAt        graceEnd                    auctionEnd
 *      |---- grace ----|-------- auction --------|
 *   active                                          free
 *
 * A domain with `expire_at == 0` has never been registered and is free.
 *
 * Ported rather than shared because the desktop copy is CommonJS loaded by the
 * main process. `tests/unit/mobile-domain-lifecycle.test.ts` runs both over
 * the same table and fails if they ever disagree, which is the part that
 * matters: a badge on this page and the auction list a bidder acts on must not
 * differ about whether a name is in grace.
 */

import type { LifecycleStatus, LifecycleWindows } from '../../../src/types/domain';

export const SECONDS_PER_DAY = 24 * 3600;

/**
 * uint64 arrives from the LCD as a decimal string, and occasionally as a
 * number. Anything else - null, "", "abc", a negative - reads as 0, which the
 * boundaries treat as "never registered" rather than as an error: a missing
 * field must not put a live domain into auction.
 */
export function toSeconds(input: unknown): number {
  const n = typeof input === 'number' ? input : parseInt(String(input ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The three boundaries, in seconds. Returned even while the domain is active,
 * because the UI states when the auction *would* open.
 */
export function lifecycleWindows(
  expireAtInput: unknown,
  graceDaysInput: unknown,
  auctionDaysInput: unknown
): LifecycleWindows {
  const expireAt = toSeconds(expireAtInput);
  if (!expireAt) return { expireAt: 0, graceEnd: 0, auctionStart: 0, auctionEnd: 0 };

  const graceEnd = expireAt + toSeconds(graceDaysInput) * SECONDS_PER_DAY;
  const auctionEnd = graceEnd + toSeconds(auctionDaysInput) * SECONDS_PER_DAY;
  // The auction opens where the grace period closes. `Bid` computes its start
  // the same way, so an auction row created by a first bid agrees with this.
  return { expireAt, graceEnd, auctionStart: graceEnd, auctionEnd };
}

/** The status the chain would compute for the same inputs. */
export function lifecycleStatus(
  nowSec: unknown,
  expireAtInput: unknown,
  graceDaysInput: unknown,
  auctionDaysInput: unknown
): LifecycleStatus {
  const now = toSeconds(nowSec);
  const { expireAt, graceEnd, auctionEnd } = lifecycleWindows(
    expireAtInput,
    graceDaysInput,
    auctionDaysInput
  );
  if (!expireAt) return 'free';
  if (now < expireAt) return 'active';
  if (now < graceEnd) return 'grace';
  if (now < auctionEnd) return 'auction';
  return 'free';
}

/** The status plus the boundaries - computing them twice is how they diverge. */
export function describeLifecycle(
  nowSec: unknown,
  expireAtInput: unknown,
  graceDaysInput: unknown,
  auctionDaysInput: unknown
): LifecycleWindows & { status: LifecycleStatus } {
  return {
    ...lifecycleWindows(expireAtInput, graceDaysInput, auctionDaysInput),
    status: lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput)
  };
}

/**
 * Whether the chain would accept `MsgBid` right now. `Bid` refuses anything
 * but the auction window, and does so after the bid fee has been spent on gas.
 */
export function isAuctionOpen(
  nowSec: unknown,
  expireAtInput: unknown,
  graceDaysInput: unknown,
  auctionDaysInput: unknown
): boolean {
  return lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) === 'auction';
}

/**
 * Whether the chain would accept `MsgSettle`: the window has closed and the
 * domain was registered at some point. `Settle` additionally requires a
 * winning bid, which only the auction row can say.
 */
export function isAuctionSettleable(
  nowSec: unknown,
  expireAtInput: unknown,
  graceDaysInput: unknown,
  auctionDaysInput: unknown
): boolean {
  const { expireAt, auctionEnd } = lifecycleWindows(
    expireAtInput,
    graceDaysInput,
    auctionDaysInput
  );
  if (!expireAt) return false;
  return toSeconds(nowSec) >= auctionEnd;
}
