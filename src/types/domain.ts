export type DomainTarget = {
  proto: 'ipfs' | 'ipns';
  id: string;
  /**
   * Optional sub-path inside the target root. Allows domain records like:
   * `lumen://ipfs/<cid>/some/subdir/`
   * so the domain root maps to that subdir.
   *
   * Normalized form: '' (none) or '/path/without/trailing/slash'.
   */
  basePath?: string;
  suffix?: string;
};

export type ResolverRecord = { key: string; value: string };

export type GatewayCache = { ts: number; bases: string[] } | null;

/**
 * Where a domain is in its life. The chain stores only `expire_at` and derives
 * the rest from two governable params, so this is computed rather than read -
 * see platform/mobile/impl/domain-lifecycle.ts and its desktop counterpart.
 */
export type LifecycleStatus = 'active' | 'grace' | 'auction' | 'free';

/** The three boundaries, in seconds, all 0 when the domain has no expiry. */
export interface LifecycleWindows {
  expireAt: number;
  graceEnd: number;
  auctionStart: number;
  auctionEnd: number;
}
