/**
 * Domain auctions, as `dns:listAuctions` describes them.
 *
 * The status and the window boundaries are computed in the main process
 * (electron/chain/domainLifecycle.cjs) from `expire_at` and the two governable
 * params, because the chain publishes neither: its `Resolve` query declares a
 * `status` field and returns only the owner. Nothing here recomputes them.
 */

/** The four states x/dns/keeper/keeper.go moves a name through, in order. */
export type DomainLifecycleStatus = "active" | "grace" | "auction" | "free";

export type DomainLifecycle = {
  status: DomainLifecycleStatus;
  /** Seconds since epoch. 0 when the domain has never been registered. */
  expireAt: number;
  graceEnd: number;
  /** The auction opens where the grace period closes. */
  auctionStart: number;
  auctionEnd: number;
};

export type AuctionRow = {
  /** The fqdn, which is also the auction's index on the chain. */
  name: string;
  status: DomainLifecycleStatus;
  /** Still the outgoing owner: the name moves only when settle runs. */
  owner: string;
  expireAtSeconds: number | null;
  auctionStartSeconds: number | null;
  auctionEndSeconds: number | null;
  /**
   * The standing bid in ulmn, as an integer string - "" when nobody has bid.
   * A string all the way down: bids are compared as integers on the chain and
   * a large one does not survive a round trip through a float.
   */
  highestBidUlmn: string;
  /** "" when nobody has bid yet, in which case the auction row does not exist. */
  bidder: string;
  /** The chain would accept a bid right now. */
  open: boolean;
  /** The window has closed with a winner on record, and settle would be accepted. */
  settleable: boolean;
};

export type AuctionList = {
  rows: AuctionRow[];
  /**
   * The domain scan hit its page cap, so an auction may be missing from the
   * list. Said out loud in the UI rather than presented as "none".
   */
  truncated: boolean;
  /** What the chain charges to place a bid, in ulmn. Governable. */
  bidFeeUlmn: number;
  graceDays: number;
  auctionDays: number;
  scannedDomains: number;
};
