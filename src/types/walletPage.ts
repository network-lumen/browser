export type SendTargetMode = 'lumen' | 'ibc';
/** A channel as the chain reports it, before it is matched to a counterparty. */
export type RawIbcChannel = {
  channelId: string;
  portId: string;
  counterpartyChannelId: string;
  counterpartyPortId: string;
  connectionId: string;
  state: string;
};

export type IbcChannelOption = RawIbcChannel & {
  chainId: string;
  prefixHints: string[];
  label: string;
  /** Destination chain's display name, when one is known. */
  chainLabel?: string;
  /** Destination chain's mark, for the route line under the picker. */
  iconUrl?: string;
};

export type KnownIbcChainMeta = {
  label: string;
  addressPrefix: string;
  restEndpoint: string;
  rpcEndpoint: string;
  nativeDenom: string;
  feeDenom: string;
  minGasPrice: number;
  iconText: string;
  chainRegistryName?: string;
};

export type AssetTransferTarget = {
  key: string;
  chainId: string;
  chainLabel: string;
  addressPrefix: string;
  defaultRecipient: string;
  sourceChannel: string;
  sourcePort: string;
  routeLabel: string;
};

export type AssetRow = {
  id: string;
  chainId: string;
  chainLabel: string;
  ownerAddress: string;
  denom: string;
  microAmount: string;
  displayAmount: string;
  displayName: string;
  displaySymbol: string;
  iconText: string;
  iconClass: string;
  iconUrl: string;
  addressLabel: string;
  traceLabel: string;
  routeLabel: string;
  error: string;
  sendEnabled: boolean;
  sendButtonLabel: string;
  transferTargets: AssetTransferTarget[];
  transferEnabled: boolean;
  transferButtonLabel: string;
  rpcEndpoint: string;
  restEndpoint: string;
  feeDenom: string;
};

export type DexQuickLink = {
  label: string;
  url: string;
};

export type DexMarketPreview = {
  pair: string;
  lastPrice: string;
  quoteVolume: string;
};

export type DexListingConfig = {
  key: string;
  name: string;
  chainId: string;
  chainLabel: string;
  restEndpoint: string;
  baseUrl: string;
  openUrl?: string;
  logoUrl: string;
  /**
   * The plate drawn behind the logo. A mark designed to sit on the brand's own
   * dark background disappears against the card, so it gets one back: `dark`
   * is the neutral slate, `navy` the near-black blue Osmosis draws its own mark
   * on. Named after the colour rather than the DEX, since the next light mark
   * to arrive will want one of these two and not a third.
   */
  logoTheme?: 'default' | 'dark' | 'navy';
  iconText: string;
  description: string;
  fallbackLinks: DexQuickLink[];
  /**
   * The pages fetched to decide whether the DEX is up, relative to `baseUrl`.
   * Defaults to BeeZee's `/`, `/exchange`, `/pools` - which is why it exists:
   * another DEX that has no `/exchange` would report itself degraded forever.
   */
  probePaths?: string[];
};

export type DexStatus = 'idle' | 'loading' | 'online' | 'degraded' | 'error';

export type DexRow = DexListingConfig & {
  status: DexStatus;
  siteTitle: string;
  tradingPairsCount: number | null;
  liquidityPoolsCount: number | null;
  featuredMarketPair: string;
  featuredPoolPair: string;
  quickLinks: DexQuickLink[];
  marketPreview: DexMarketPreview | null;
  error: string;
  lastCheckedAt: string;
};

export type ContactForm = { name: string; address: string; note: string };

/** A saved contact as the address book returns it. */
export type AddressBookContact = ContactForm & { id: string };

export type SendForm = { recipient: string; amount: string; gasFee: string };

/** The IBC route chosen for a cross-chain send. */
export type IbcForm = { sourceChannel: string; sourcePort: string };

export type AssetTransferForm = { destinationKey: string; recipient: string; amount: string };

export type ChainRegistryBundle = { chain: any | null; assets: any[] };

export type DenomTrace = { baseDenom: string; path: string };

/** The on-disk shape of the chain registry cache, keyed by registry name. */
export type StoredChainRegistryCache = Record<
  string,
  { updatedAt: number; chain: any | null; assets: any[] }
>;

/**
 * One Cosmos chain, reduced to what a list of 200-odd of them actually draws.
 *
 * The upstream directory entry is far larger - codebase, peers, every declared
 * endpoint, full asset lists. Storing it whole would put megabytes in
 * localStorage for fields nothing reads, so the fetch trims to this on the way
 * in and the trimmed shape is what gets cached.
 */
export type CosmosChainSummary = {
  /** Registry directory name ("osmosis"), which is also the API path segment. */
  name: string;
  prettyName: string;
  chainId: string;
  /** Bech32 prefix, and the reason one seed covers every chain here. */
  prefix: string;
  /** "live", "killed", "upcoming" - upstream's own word for it. */
  status: string;
  networkType: string;
  symbol: string;
  /** Base denom of the staking token ("uosmo"). */
  denom: string;
  decimals: number;
  image: string;
  /** Health-checked REST endpoints, best first. Empty means balances can't be read. */
  rest: string[];
  rpc: string[];
  /** Latest height upstream saw, when it reported one. */
  height: number | null;
  /** USD price of the native token. Null for the 134 chains with no feed. */
  priceUsd: number | null;
  website: string;
  /** CoinGecko slug, the only market-facing identifier the registry carries. */
  coingeckoId: string;
  /** Staking APR as a fraction, null when the chain reports none. */
  apr: number | null;
  /** Seconds, from the chain's live staking params. */
  unbondingSeconds: number | null;
  /** Seconds, as measured upstream rather than as configured. */
  blockTime: number | null;
  /** Capped: a handful is a choice, the full list is a directory. */
  explorers: CosmosExplorer[];
};

/** One block explorer, with the templates that deep-link into it. */
export type CosmosExplorer = {
  kind: string;
  url: string;
  /** `${accountAddress}` template, empty when the explorer offers none. */
  accountPage: string;
};

/** A chain this one has a registered IBC path to. */
export type CosmosIbcPeer = {
  /** Registry name of the counterparty, which names its pair file. */
  name: string;
  prettyName: string;
  /** Carried so a route can be labelled without re-reading the directory. */
  chainId: string;
  image: string;
};

/** The on-disk shape of the chain directory cache. */
export type StoredCosmosChains = {
  updatedAt: number;
  chains: CosmosChainSummary[];
};

/**
 * What an `ibc/<hash>` denom turns out to be, once its trace is resolved.
 *
 * `sourceChain` is empty when the origin cannot be pinned to exactly one known
 * chain - four base denoms in the registry are claimed by two chains each - and
 * an unattributed amount beats a wrongly attributed one.
 */
export type CosmosResolvedDenom = {
  symbol: string;
  decimals: number;
  sourceChain: string;
  /** The origin chain's mark, empty when the origin is unknown. */
  image: string;
  /** Registry name of the issuing chain, for routing it home. */
  sourceName: string;
  /** The trace path, e.g.  - the way back. */
  path: string;
};

/** One denom held on one chain, once a balance query has come back. */
export type CosmosChainBalance = {
  denom: string;
  amount: string;
};

/**
 * Delegated stake and unclaimed rewards, in the chain's own base units.
 *
 * Both are strings for the same reason balances are: these are integer base
 * units of up to 18 decimals, and a float would quietly lose the tail.
 */
export type CosmosStakingSummary = {
  staked: string;
  rewards: string;
  /** Total leaving staking, across every pending entry. */
  unbonding: string;
  /** Each pending withdrawal, soonest first. Undelegations run in parallel. */
  unbondingEntries: CosmosUnbondingEntry[];
  /**
   * Validators that owe this account something right now.
   *
   * Not the delegated set: rewards accrue per validator, so a delegation made
   * moments ago has none yet. The chain rejects a withdraw against a validator
   * with nothing to pay - and since a claim batches one message per validator
   * into one transaction, a single empty one fails the whole batch.
   */
  rewardValidators: string[];
  /** How much sits with each of them, for moving or withdrawing a specific one. */
  delegations: CosmosDelegation[];
};

/** What a staking dialog is doing. */
export type CosmosStakeAction = 'delegate' | 'undelegate' | 'redelegate';

/** One entry in a validator picker: an address and what it reads as. */
export type CosmosStakeOption = {
  address: string;
  label: string;
};

/** One delegation: which validator holds it, and how much. */
export type CosmosDelegation = {
  validator: string;
  /** Base units of the chain's bond denom. */
  amount: string;
};

/** A validator as the staking module reports it, reduced to what a picker shows. */
export type CosmosValidator = {
  address: string;
  moniker: string;
  /** Commission rate as a fraction, e.g. 0.05 for 5%. */
  commission: number;
  /** Bonded tokens in base units - the picker sorts on it. */
  tokens: string;
  jailed: boolean;
};

/** One pending undelegation: an amount, and when it lands. */
export type CosmosUnbondingEntry = {
  amount: string;
  /** ISO time, empty when the chain did not report one. */
  completesAt: string;
};

/** What the panel knows about a chain's balance, including "not asked yet". */
export type CosmosBalanceState = {
  status: 'idle' | 'loading' | 'ok' | 'error';
  balances: CosmosChainBalance[];
  error: string;
  /** The endpoint that answered, so a stale reading can be attributed. */
  source: string;
  /** Null when staking was not read, or could not be. */
  staking: CosmosStakingSummary | null;
};

/** Which of a chain's published gas prices to pay. */
export type FeeTier = 'low' | 'average' | 'high';

/** A chain's gas prices, in its own fee token. See cosmosFees.ts. */
export type ChainFeeSchedule = {
  denom: string;
  low: number;
  average: number;
  high: number;
};

/** The bit of an activity that decides how it is drawn. */
export type ActivityLike = { action?: string; type?: string };

export type ActivityDescriptor = {
  label: string;
  /** Theme colour token, empty when the message is unrecognised. */
  tint: string;
  icon: unknown;
  carriesDomainName: boolean;
};

/** One chain message type and everything an activity row shows for it. */
export type ChainMessageEntry = ActivityDescriptor & { type: string };
