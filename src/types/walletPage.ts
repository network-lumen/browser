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
