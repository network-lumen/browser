import { useInternalLumen } from '../../composables/useInternalLumen';
import { derivePrefixHintsFromChainId } from './ibcChains';
import type { IbcChannelOption, RawIbcChannel } from '../../types/walletPage';

/**
 * Asking the connected chain which IBC transfer channels it has open.
 *
 * Returns the channels or throws; it sets no flags and holds no state, so the
 * page decides what "loading" and "failed" look like. The shaping rules below
 * are exported separately from the fetching, which is what makes them
 * testable without standing up a chain.
 */

/**
 * Both spellings of every field. The transfer module answers in snake_case
 * over REST and camelCase through some gateways, and a channel read one way
 * and not the other silently disappears from the list.
 */
export function normalizeIbcChannels(payload: unknown): RawIbcChannel[] {
  const entries = Array.isArray(payload) ? payload : [];
  return entries
    .map((entry: any) => {
      const counterparty = entry?.counterparty || {};
      return {
        channelId: String(entry?.channel_id ?? entry?.channelId ?? '').trim(),
        portId: String(entry?.port_id ?? entry?.portId ?? 'transfer').trim() || 'transfer',
        counterpartyChannelId: String(
          counterparty?.channel_id ?? counterparty?.channelId ?? ''
        ).trim(),
        counterpartyPortId: String(counterparty?.port_id ?? counterparty?.portId ?? '').trim(),
        connectionId: String(entry?.connection_hops?.[0] ?? entry?.connectionHops?.[0] ?? '').trim(),
        state: String(entry?.state || '').trim().toUpperCase()
      };
    })
    .filter((entry) => {
      if (!entry.channelId) return false;
      // A channel with no state reported is kept: some endpoints omit it, and
      // dropping those would empty the list on an otherwise working chain.
      if (entry.state && entry.state !== 'STATE_OPEN' && entry.state !== 'OPEN') return false;
      return entry.portId === 'transfer';
    });
}

/**
 * The chain id sits at one of four paths depending on the node's version, and
 * an unknown one is not fatal - the channel is still usable, it just cannot be
 * matched to a recipient by prefix, so it falls back to naming its
 * counterparty.
 */
export function describeIbcChannel(entry: RawIbcChannel, chainId: string): IbcChannelOption {
  const chain = String(chainId || '').trim();
  return {
    ...entry,
    chainId: chain,
    prefixHints: derivePrefixHintsFromChainId(chain),
    label: chain
      ? `${entry.channelId} -> ${chain}`
      : `${entry.channelId}${entry.counterpartyChannelId ? ` -> ${entry.counterpartyChannelId}` : ''}`
  };
}

export function readClientStateChainId(json: any): string {
  return String(
    json?.identified_client_state?.client_state?.chain_id ||
      json?.identified_client_state?.client_state?.chainId ||
      json?.client_state?.chain_id ||
      json?.client_state?.chainId ||
      ''
  ).trim();
}

/**
 * Open transfer channels on the connected chain, sorted by label so the list
 * does not reshuffle between loads.
 *
 * Tries the transfer module first and falls back to the core channel endpoint,
 * because older nodes do not serve the former.
 */
export async function fetchIbcTransferChannels(): Promise<IbcChannelOption[]> {
  const net = useInternalLumen()?.net;
  if (!net || typeof net.restGet !== 'function') {
    throw new Error('Network API not available.');
  }

  const readChannels = async (path: string): Promise<unknown[]> => {
    const res = await net.restGet(path, { timeout: 15000 });
    if (!res || res.ok === false || !Array.isArray(res?.json?.channels)) return [];
    return res.json.channels;
  };

  let payload = await readChannels('/ibc/apps/transfer/v1/channels');
  if (!payload.length) {
    payload = await readChannels('/ibc/core/channel/v1/channels?pagination.limit=200');
  }

  const channels = await Promise.all(
    normalizeIbcChannels(payload).map(async (entry) => {
      let chainId = '';
      try {
        const res = await net.restGet(
          `/ibc/core/channel/v1/channels/${encodeURIComponent(entry.channelId)}/ports/${encodeURIComponent(entry.portId)}/client_state`,
          { timeout: 10000 }
        );
        chainId = readClientStateChainId(res?.json);
      } catch {
        // A channel whose chain cannot be identified is still offered.
        chainId = '';
      }
      return describeIbcChannel(entry, chainId);
    })
  );

  return channels.sort((a, b) => a.label.localeCompare(b.label));
}
