import { useInternalLumen } from '../../composables/useInternalLumen';
import type { LumenNetwork, LumenNetworkIdentity } from '../../types/lumenNetwork';

/**
 * Which Lumen the app is on, for the renderer.
 *
 * The main process owns the answer - it holds the setting and the peer pool -
 * so this is a cache in front of one IPC call rather than a second source of
 * truth. Everything that used to hard-code mainnet in the UI (the chain id, the
 * fee denom, the explorer link, and the Lumen entry in the Cosmos chain
 * directory) reads it from here instead.
 *
 * The cache is dropped when the main process says the network changed, which is
 * also the moment every balance on screen stops meaning anything.
 */
let request: Promise<LumenNetwork> | null = null;
let unsubscribe: (() => void) | null = null;

/**
 * What to answer when the bridge is missing - a browser-only unit test, or a
 * preload that failed to inject. Mainnet's identity with no endpoints: reads
 * fail loudly instead of quietly going somewhere else.
 */
const UNKNOWN_NETWORK: LumenNetwork = {
  id: 'mainnet',
  // Blank rather than a name: this entry is never one of the choices drawn by
  // the settings page - those come from `listLumenNetworks` - and labelling a
  // fallback "Mainnet" would let it pass for the real thing if it ever were.
  label: '',
  chainId: 'lumen',
  prefix: 'lmn',
  denom: 'ulmn',
  symbol: 'LMN',
  decimals: 6,
  prettyName: 'Lumen',
  website: '',
  explorerAccountUrl: '',
  rest: [],
  rpc: [],
  observedChainId: null
};

function watchForChanges() {
  if (unsubscribe) return;
  const net = useInternalLumen()?.net;
  if (typeof net?.onNetworkChanged !== 'function') return;
  unsubscribe = net.onNetworkChanged(() => {
    request = null;
  });
}

/** The active network. Cached until the network actually changes. */
export function loadLumenNetwork(): Promise<LumenNetwork> {
  watchForChanges();

  if (!request) {
    request = (async () => {
      const net = useInternalLumen()?.net;
      if (typeof net?.getNetwork !== 'function') return UNKNOWN_NETWORK;
      try {
        const res = await net.getNetwork();
        const network = res?.network;
        if (!network || !network.chainId) return UNKNOWN_NETWORK;
        return {
          ...network,
          rest: Array.isArray(network.rest) ? network.rest : [],
          rpc: Array.isArray(network.rpc) ? network.rpc : []
        } as LumenNetwork;
      } catch {
        // Drop the shared promise so the next caller retries rather than
        // replaying this failure for the rest of the session.
        request = null;
        return UNKNOWN_NETWORK;
      }
    })();
  }

  return request;
}

/** Forget the cached network, for a user-requested refresh. */
export function clearLumenNetworkCache() {
  request = null;
}

/** The networks that can be switched to, for the settings page. */
export async function listLumenNetworks(): Promise<LumenNetworkIdentity[]> {
  const net = useInternalLumen()?.net;
  if (typeof net?.getNetwork !== 'function') return [];
  try {
    const res = await net.getNetwork();
    return Array.isArray(res?.available) ? (res.available as LumenNetworkIdentity[]) : [];
  } catch {
    return [];
  }
}

/**
 * Switch networks.
 *
 * The main process resets the peer pool and tells every window, so callers do
 * not have to invalidate anything themselves - but what is already rendered was
 * read from the other chain, and is the caller's to refetch.
 */
export async function setLumenNetwork(id: string): Promise<{ ok: boolean; error?: string }> {
  const net = useInternalLumen()?.net;
  if (typeof net?.setNetwork !== 'function') return { ok: false, error: 'bridge_unavailable' };
  const res = await net.setNetwork(id);
  if (res?.ok) request = null;
  return res?.ok ? { ok: true } : { ok: false, error: String(res?.error || 'set_failed') };
}

/** The explorer account page, or '' when this network publishes none. */
export async function explorerAccountUrl(address: string): Promise<string> {
  const network = await loadLumenNetwork();
  const addr = String(address || '').trim();
  if (!network.explorerAccountUrl || !addr) return '';
  return network.explorerAccountUrl.replace('{address}', encodeURIComponent(addr));
}
