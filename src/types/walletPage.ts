export type SendTargetMode = 'lumen' | 'ibc';
export type IbcChannelOption = {
  channelId: string;
  portId: string;
  counterpartyChannelId: string;
  counterpartyPortId: string;
  connectionId: string;
  state: string;
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
  logoTheme?: 'default' | 'dark';
  iconText: string;
  description: string;
  fallbackLinks: DexQuickLink[];
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
