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
 * Whether `MsgRenew` is worth offering: only in grace, from chain v2.0.0 on.
 *
 * `Renew` used to check ownership and nothing else, which let an owner call it
 * on an active name over and over - each call bounded the term it added and
 * nothing bounded the total, so `expire_at` could be walked arbitrarily far
 * into the future one year at a time. The chain now refuses every status but
 * `grace`, and says which one it saw.
 *
 * The three refusals that follow from that are each worth naming, because they
 * read as regressions otherwise:
 *  - `active`: renewing early is no longer possible. A name has to lapse first,
 *    which is what the grace period is for.
 *  - `auction`: an auction can only be ended by settling it, and settling is
 *    permissionless, so the owner is not stuck waiting on the bidder.
 *  - `free`: unchanged, and never allowed - the row still names the old owner,
 *    so the transaction would be accepted and would buy back a name anyone
 *    else can now register underneath.
 *
 * A held bid blocks renewal too, since both ways out of a bid escrow are
 * measured from `expire_at`. That one cannot be decided from the lifecycle
 * alone - it needs the auction row - so it is left to the chain's own error.
 */
function canRenew(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) {
  return lifecycleStatus(nowSec, expireAtInput, graceDaysInput, auctionDaysInput) === 'grace';
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
