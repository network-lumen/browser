import { t } from '../../stores/i18nStore';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import type { IbcChannelOption, KnownIbcChainMeta } from '../../types/walletPage';

/**
 * Reading a Cosmos chain's identity out of the strings it is known by, and
 * picking the IBC channel a transfer should leave through.
 *
 * This is not here for tidiness - none of it was duplicated. It is here
 * because it decides where money goes. `rankIbcChannels` chooses which chain
 * a transfer lands on, from a chain id, an address prefix and three weights;
 * get it wrong and the tokens leave through the wrong channel. That rule lived
 * three and a half thousand lines into a page, with no test able to reach it.
 *
 * Everything below is pure. The loading, the caches and the form live with the
 * page that owns them.
 */

export const KNOWN_IBC_CHAIN_METADATA: Record<string, KnownIbcChainMeta> = {
  'beezee-1': {
    label: 'BeeZee',
    addressPrefix: 'bze',
    restEndpoint: 'https://rest.getbze.com',
    rpcEndpoint: 'https://rpc.getbze.com',
    nativeDenom: 'ubze',
    feeDenom: 'ubze',
    minGasPrice: 0.01,
    iconText: 'BZE',
    chainRegistryName: 'beezee'
  },
  'bzetestnet-3': {
    label: t('BeeZee Testnet'),
    addressPrefix: 'bze',
    restEndpoint: 'https://testnet.getbze.com',
    rpcEndpoint: 'https://testnet-rpc.getbze.com',
    nativeDenom: 'ubze',
    feeDenom: 'ubze',
    minGasPrice: 0.01,
    iconText: 'BZE',
    chainRegistryName: 'beezee'
  }
};

/** The bech32 prefix of an address, or empty if it is not one. */
export function getAddressPrefix(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  const match = raw.match(/^([a-z0-9]{1,24})1[ac-hj-np-z02-9]{6,}$/);
  return match ? match[1] : '';
}

/**
 * The address prefixes a chain id might correspond to.
 *
 * Chain ids carry an environment and a revision that the prefix does not -
 * "bze-testnet-2" and "beezee-1" both mean addresses starting "bze" - so both
 * are stripped before guessing. Two candidates come back because stripping can
 * leave a compound name ("cosmos-hub"), and the first token of it is as likely
 * to be the prefix as the whole.
 */
export function derivePrefixHintsFromChainId(chainId: string): string[] {
  const raw = String(chainId || '').trim().toLowerCase();
  if (!raw) return [];

  const candidates = new Set<string>();
  const normalized = raw
    .replace(
      /(?:[_-]?testnet.*$)|(?:[_-]?mainnet.*$)|(?:[_-]?devnet.*$)|(?:[_-]?localnet.*$)|(?:[_-]?stage.*$)|(?:[_-]?alpha.*$)|(?:[_-]?beta.*$)/,
      ''
    )
    .replace(/[_-]?\d+$/, '')
    .replace(/[_-]+$/, '');
  const firstToken = normalized.split(/[_-]/)[0] || normalized;

  for (const entry of [normalized, firstToken]) {
    const cleaned = entry.replace(/[^a-z0-9]/g, '');
    if (cleaned) candidates.add(cleaned);
  }

  // "bzetestnet-3" has no separator before "testnet", so the strip above leaves
  // it whole. Named explicitly rather than loosening the pattern, which would
  // start eating real chain names containing those words.
  if (raw.includes('bzetestnet')) candidates.add('bze');
  return Array.from(candidates);
}

/**
 * How well a channel matches where the recipient lives. A declared prefix is
 * the only strong signal; the chain id and the label are guesses at
 * decreasing confidence, and no signal at all scores zero so the caller can
 * tell a match from a shrug.
 */
export function scoreIbcChannel(channel: IbcChannelOption, recipientPrefix: string): number {
  const prefix = String(recipientPrefix || '').trim().toLowerCase();
  if (!prefix) return 0;
  if (channel.prefixHints.includes(prefix)) return 100;
  if (channel.chainId.toLowerCase().includes(prefix)) return 40;
  if (channel.label.toLowerCase().includes(prefix)) return 10;
  return 0;
}

/**
 * The channel a transfer should leave through, or null if there is nothing to
 * choose from.
 *
 * When nothing scores - an unrecognised recipient, or no recipient typed yet -
 * this returns the first channel rather than nothing, so the form is never
 * left without a route. That is a real decision and worth stating: it means an
 * unrecognised address gets a default channel rather than a refusal.
 */
export function pickIbcChannel(
  channels: IbcChannelOption[],
  recipientPrefix: string
): IbcChannelOption | null {
  if (!channels.length) return null;
  if (channels.length === 1) return channels[0];

  const ranked = channels
    .map((channel) => ({ channel, score: scoreIbcChannel(channel, recipientPrefix) }))
    .sort((a, b) => b.score - a.score || a.channel.label.localeCompare(b.channel.label));

  const best = ranked[0];
  return best && best.score > 0 ? best.channel : channels[0];
}

export function humanizeChainId(chainId: string): string {
  const raw = String(chainId || '').trim();
  if (!raw) return t('Unknown chain');
  const known = KNOWN_IBC_CHAIN_METADATA[raw];
  if (known?.label) return known.label;
  return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase());
}

/** Falls back to a plausible chain built from the prefix, never to nothing. */
export function resolveKnownChainMeta(
  chainId: string,
  prefixHints: string[] = []
): KnownIbcChainMeta {
  const known = KNOWN_IBC_CHAIN_METADATA[String(chainId || '').trim()];
  if (known) return known;

  const prefix = String(prefixHints[0] || '').trim().toLowerCase();
  return {
    label: humanizeChainId(chainId || prefix || t('IBC chain')),
    addressPrefix: prefix,
    restEndpoint: '',
    rpcEndpoint: '',
    nativeDenom: prefix ? `u${prefix}` : '',
    feeDenom: prefix ? `u${prefix}` : 'ulmn',
    minGasPrice: 0,
    iconText: prefix ? prefix.slice(0, 3).toUpperCase() : 'IBC'
  };
}

/**
 * Rounds up: a fee short by rounding is a rejected transaction, where a fee
 * over by one unit is nothing.
 */
export function estimateRemoteFeeAmount(chainId: string, gas: string, fallback = '1000'): string {
  const gasUnits = Number(String(gas || '').trim());
  if (!Number.isFinite(gasUnits) || gasUnits <= 0) return fallback;

  const minGasPrice = Number(KNOWN_IBC_CHAIN_METADATA[String(chainId || '').trim()]?.minGasPrice || 0);
  if (!Number.isFinite(minGasPrice) || minGasPrice <= 0) return fallback;

  return String(Math.ceil(gasUnits * minGasPrice));
}

/**
 * The same account, written for another chain. Empty when the input is not a
 * valid bech32 address - the caller decides what to do about that.
 */
export function reencodeAddressPrefix(value: string, targetPrefix: string): string {
  try {
    const decoded = fromBech32(String(value || '').trim());
    return toBech32(String(targetPrefix || '').trim(), decoded.data);
  } catch {
    return '';
  }
}
