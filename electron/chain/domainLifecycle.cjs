// Where a domain is in its life, and what that allows.
//
// The dns module never stores a status. It stores `expire_at` and derives
// everything else from two governable params, `grace_days` and `auction_days`,
// every time it is asked - `lifecycleStatus` in x/dns/keeper/keeper.go. The
// chain's own `Resolve` query declares a `status` field and then returns only
// the owner, and `AuctionStatus` declares four fields and returns only `start`,
// so neither can be used to ask "is this in auction". The arithmetic has to be
// done here, from `/lumen/dns/v1/domain` and `/lumen/dns/v1/params`.
//
// That makes this file a copy of a rule that lives in Go, which is worth
// naming: if the chain changes how the windows are laid out, this is what has
// to change with it. The four boundaries below are the whole rule.
//
//   expireAt        graceEnd                    auctionEnd
//      |---- grace ----|-------- auction --------|
//   active                                          free
//
// A domain with `expire_at == 0` has never been registered and is free.

const SECONDS_PER_DAY = 24 * 3600;

/** Every status the dns module can be in, in the order they happen. */
const STATUSES = Object.freeze(['active', 'grace', 'auction', 'free']);

/**
 * uint64 arrives from the LCD as a decimal string, and occasionally as a
 * number. Anything else - null, "", "abc", a negative - is read as 0, which the
 * boundaries below treat as "never registered" rather than as an error: a
 * missing field must not put a live domain into auction.
 */
function toSeconds(input) {
  const n = typeof input === 'number' ? input : parseInt(String(input ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * The three boundaries, in seconds. Returned even when the domain is still
 * active, because the UI states when the auction *would* open.
 *
 * @returns {{expireAt:number, graceEnd:number, auctionStart:number, auctionEnd:number}}
 *   all 0 when the domain has no expiry.
 */
function lifecycleWindows(expireAtInput, graceDaysInput, auctionDaysInput) {
  const expireAt = toSeconds(expireAtInput);
  if (!expireAt) {
    return { expireAt: 0, graceEnd: 0, auctionStart: 0, auctionEnd: 0 };
  }
  const graceEnd = expireAt + toSeconds(graceDaysInput) * SECONDS_PER_DAY;
  const auctionEnd = graceEnd + toSeconds(auctionDaysInput) * SECONDS_PER_DAY;
  // The auction opens where the grace period closes. `Bid` computes its start
  // the same way, so an auction row created by a first bid agrees with this.
  return { expireAt, graceEnd, auctionStart: graceEnd, auctionEnd };
}

/**
 * @returns {'active'|'grace'|'auction'|'free'} the status the chain would
 *   compute for the same inputs.
 */
function lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
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

/**
 * The status plus the boundaries, which is what every caller here actually
 * wants - computing them twice is how the two disagree.
 */
function describeLifecycle(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
  const windows = lifecycleWindows(expireAtInput, graceDaysInput, auctionDaysInput);
  return {
    ...windows,
    status: lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput)
  };
}

/**
 * Whether the chain would accept `MsgBid` right now.
 *
 * `Bid` refuses anything but the auction window, and does so *after* the
 * bid fee has been spent on gas, so the UI decides this before signing.
 */
function isAuctionOpen(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
  return lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) === 'auction';
}

/**
 * Whether the chain would accept `MsgSettle`: the auction window has closed and
 * the domain was registered at some point. `Settle` additionally requires a
 * winning bid to exist, which only the auction row can say.
 */
function isAuctionSettleable(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
  const { expireAt, auctionEnd } = lifecycleWindows(
    expireAtInput,
    graceDaysInput,
    auctionDaysInput
  );
  if (!expireAt) return false;
  return toSeconds(nowSec) >= auctionEnd;
}

/**
 * Whether `MsgRenew` is worth offering.
 *
 * The chain's `Renew` checks ownership and nothing else - there is no status
 * gate on it, so an owner can extend an active domain early, and can still
 * rescue one that is in grace or even mid-auction, since the auction only
 * changes the owner once `Settle` runs. What renew cannot do is bring back a
 * domain that has gone `free`: the row is still there with the old owner, so
 * the transaction would be accepted and would buy back a name anyone else can
 * now register underneath. That case is excluded here and named in the UI.
 */
function canRenew(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
  const status = lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput);
  return status === 'active' || status === 'grace' || status === 'auction';
}

module.exports = {
  SECONDS_PER_DAY,
  STATUSES,
  toSeconds,
  lifecycleWindows,
  lifecycleStatus,
  describeLifecycle,
  isAuctionOpen,
  isAuctionSettleable,
  canRenew
};
