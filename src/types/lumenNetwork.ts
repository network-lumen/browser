/**
 * The active Lumen network, as `net:getNetwork` describes it.
 *
 * Mirrors the table in `electron/chain/networks.cjs`, plus the endpoints the
 * peer pool is actually using. Only Lumen has a network switch; every other
 * Cosmos chain the wallet can reach comes from the public registry and is
 * mainnet-only.
 */
export type LumenNetworkId = "mainnet" | "testnet";

export type LumenNetworkIdentity = {
  id: LumenNetworkId;
  /** "Mainnet", "Testnet" - shown as-is next to the switch. */
  label: string;
  /** The id a signature covers. */
  chainId: string;
  prefix: string;
  denom: string;
  symbol: string;
  decimals: number;
  prettyName: string;
  website: string;
  /**
   * Account page template with `{address}` in it, or "" when the network has
   * no explorer - which callers must render as no link rather than a broken one.
   */
  explorerAccountUrl: string;
};

export type LumenNetwork = LumenNetworkIdentity & {
  /** Live pool endpoints, not registry ones. Empty means nothing is reachable. */
  rest: string[];
  rpc: string[];
  /** What the nodes answer, which is not always what the table declares. */
  observedChainId: string | null;
};
