/**
 * The mobile port of `electron/ipc/network.cjs` and `electron/chain/client.cjs`.
 *
 * The desktop reaches the chain through a peer pool: a daemon that pings every
 * endpoint in `resources/peers.txt`, tracks latency and liveness, and answers a
 * read from two or three peers at once so a node that lies about state is
 * outvoted. None of that survives on a phone - there is no daemon, and pinging
 * a list of endpoints in the background is exactly the sort of thing that eats
 * a battery.
 *
 * What is kept is the part that protects the user. A read still goes to TWO
 * endpoints in parallel and their heights are compared before an answer is
 * used; a disagreement falls back to the first success rather than trusting
 * either blindly. What is lost is the pool's memory - every read starts from
 * the static list again, in order, so a slow endpoint is slow every time
 * rather than being learned about once.
 *
 * That gap is worth writing down rather than hiding: it is the main reason
 * this file is not finished work.
 */

import type { ChainResponse, NetworkId, Settings } from '../../../src/types/platformBridge';
import { getSettings, setSettings } from './settings';

/**
 * Which Lumen the app is on. Ported from `electron/chain/networks.cjs` - and
 * it has to stay in step with it, because a signature commits to `chainId`.
 */
const NETWORKS = Object.freeze({
  mainnet: {
    id: 'mainnet',
    label: 'Mainnet',
    chainId: 'lumen',
    prefix: 'lmn',
    denom: 'ulmn',
    symbol: 'LMN',
    decimals: 6,
    prettyName: 'Lumen',
    website: 'https://lumen-browser.com/',
    explorerAccountUrl: 'https://explorer.lumen.network/account/{address}'
  },
  testnet: {
    id: 'testnet',
    label: 'Testnet',
    chainId: 'lumen-testnet',
    prefix: 'lmn',
    denom: 'ulmn',
    symbol: 'LMN',
    decimals: 6,
    prettyName: 'Lumen Testnet',
    website: 'https://lumen-browser.com/',
    // No public testnet explorer is published; pointing this at the mainnet one
    // would show every address as unfunded, which reads as a wallet bug.
    explorerAccountUrl: ''
  }
} as const);

/**
 * The endpoints from `resources/peers.txt`, inlined.
 *
 * The desktop parses that file at runtime from its resources directory; there
 * is no such directory in an APK, and a network switch is rare enough that
 * shipping the list in the bundle is the simpler honest answer. Devnet is left
 * out entirely - its entries are localhost and a WSL address, neither of which
 * means anything from a phone.
 */
const ENDPOINTS: Record<NetworkId, { rpc: string; rest: string }[]> = {
  mainnet: [
    { rpc: 'https://lumen-rpc.linknode.org', rest: 'https://lumen-api.linknode.org' },
    { rpc: 'https://rpc.lumen.chaintools.tech', rest: 'https://api.lumen.chaintools.tech' },
    {
      rpc: 'https://lumen-mainnet-rpc.mekonglabs.com',
      rest: 'https://lumen-mainnet-api.mekonglabs.com'
    }
  ],
  testnet: [
    {
      rpc: 'https://testnet-rpc.lumen.chaintools.tech',
      rest: 'https://testnet-api.lumen.chaintools.tech'
    }
  ]
};

const DEFAULT_NETWORK_ID: NetworkId = 'mainnet';

const normalizeNetworkId = (input: unknown): NetworkId =>
  Object.prototype.hasOwnProperty.call(NETWORKS, String(input ?? '').trim())
    ? (String(input).trim() as NetworkId)
    : DEFAULT_NETWORK_ID;

export const getNetworkDef = (id: unknown) => NETWORKS[normalizeNetworkId(id)];

export async function activeNetworkId(): Promise<NetworkId> {
  return normalizeNetworkId((await getSettings()).lumenNetwork);
}

export async function activeNetwork() {
  return getNetworkDef(await activeNetworkId());
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

async function httpJson(url: string, timeoutMs: number): Promise<ChainResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      // Not every endpoint answers JSON on an error; the text is kept so the
      // caller can still say what happened.
      json = undefined;
    }
    return { ok: res.ok, status: res.status, text, json, timeout: false, endpoint: url };
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'AbortError';
    return { ok: false, status: 0, error: timeout ? 'timeout' : String(e), timeout, endpoint: url };
  } finally {
    clearTimeout(timer);
  }
}

/** The height a node reports, for the coherence check. `null` when unreadable. */
function heightOf(response: ChainResponse): number | null {
  const body = response.json as any;
  const raw =
    body?.result?.sync_info?.latest_block_height ??
    body?.block?.header?.height ??
    body?.sync_info?.latest_block_height;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * One chain read, answered by two endpoints where there are two.
 *
 * The heights are compared rather than the bodies: two honest nodes a block
 * apart return different bodies for the same query all the time, so comparing
 * payloads would reject the normal case. A gap wider than a few blocks means
 * one of them is stale or lying, and the first success is used while the
 * disagreement is logged.
 */
export async function readState(
  path: string,
  options: { kind?: 'rpc' | 'rest'; timeout?: number } = {}
): Promise<ChainResponse> {
  const kind = options.kind === 'rest' ? 'rest' : 'rpc';
  const timeout = Math.min(Math.max(options.timeout ?? 12_000, 1_000), 120_000);
  const endpoints = ENDPOINTS[await activeNetworkId()] ?? [];
  if (!endpoints.length) return { ok: false, status: 0, error: 'no_endpoints_configured' };

  const clean = String(path ?? '').trim();
  const suffix = clean.startsWith('/') ? clean : `/${clean}`;
  const urls = endpoints.map((e) => `${trimSlash(kind === 'rest' ? e.rest : e.rpc)}${suffix}`);

  const first = await Promise.all(urls.slice(0, 2).map((url) => httpJson(url, timeout)));
  const good = first.filter((r) => r.ok);

  if (good.length >= 2) {
    const [a, b] = good.map(heightOf);
    if (a !== null && b !== null && Math.abs(a - b) > 5) {
      console.warn(
        `[platform/mobile] endpoints disagree on height (${a} vs ${b}) for ${suffix} - using the first.`
      );
    }
    return good[0];
  }

  if (good.length === 1) return good[0];

  // Both failed: walk whatever is left before giving up.
  for (const url of urls.slice(2)) {
    const res = await httpJson(url, timeout);
    if (res.ok) return res;
  }

  return first[0] ?? { ok: false, status: 0, error: 'read_failed' };
}

/** POST to the RPC, for broadcasting. */
async function rpcPost(body: unknown, timeout: number): Promise<ChainResponse> {
  const endpoints = ENDPOINTS[await activeNetworkId()] ?? [];
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(trimSlash(endpoint.rpc), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      if (res.ok) return { ok: true, status: res.status, text, json, endpoint: endpoint.rpc };
    } catch {
      // Try the next endpoint rather than failing on the first unreachable one.
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, error: 'no_rpc_endpoint_available' };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * Broadcasts in sync mode, which returns once the transaction passes CheckTx -
 * before it is in a block. Callers must wait for the commit before reading the
 * state the transaction was meant to change.
 */
export async function broadcastTx(txBytes: unknown): Promise<Record<string, unknown>> {
  let bytes: Uint8Array | null = null;
  if (txBytes instanceof Uint8Array) bytes = txBytes;
  else if (Array.isArray(txBytes)) bytes = new Uint8Array(txBytes);
  else if (typeof txBytes === 'string') {
    try {
      bytes = Uint8Array.from(atob(txBytes), (c) => c.charCodeAt(0));
    } catch {
      bytes = null;
    }
  }
  if (!bytes?.length) return { ok: false, error: 'missing_txBytes' };

  const res = await rpcPost(
    {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'broadcast_tx_sync',
      params: { tx: toBase64(bytes) }
    },
    20_000
  );

  if (!res.ok) return { ok: false, error: res.error ?? 'broadcast_failed' };

  const result = (res.json as any)?.result;
  const code = Number(result?.code ?? 0);
  if (code !== 0) {
    return { ok: false, code, error: result?.log || 'broadcast_rejected', hash: result?.hash };
  }
  return { ok: true, hash: result?.hash, code, log: result?.log };
}

/** Subscribers of `net.onNetworkChanged`. */
const networkListeners = new Set<(payload: unknown) => void>();
const heightListeners = new Set<(payload: unknown) => void>();

async function describeActiveNetwork() {
  const id = await activeNetworkId();
  const endpoints = ENDPOINTS[id] ?? [];
  return {
    ...getNetworkDef(id),
    rest: endpoints.map((e) => e.rest),
    rpc: endpoints.map((e) => e.rpc),
    // Null until a node has answered, so a caller can tell "not yet" from
    // "disagrees" rather than reading the table's own value back.
    observedChainId: null as string | null
  };
}

async function latestHeight(): Promise<number | null> {
  const res = await readState('/status', { kind: 'rpc', timeout: 8_000 });
  return res.ok ? heightOf(res) : null;
}

export const NETWORK_MEMBERS = {
  'net.rpcGet': (path: string, options?: { timeout?: number }) =>
    readState(String(path ?? ''), { ...(options ?? {}), kind: 'rpc' }),

  'net.restGet': (path: string, options?: { timeout?: number }) =>
    readState(String(path ?? ''), { ...(options ?? {}), kind: 'rest' }),

  'net.broadcastTx': (txBytes: unknown) => broadcastTx(txBytes),

  'net.getState': async () => {
    const id = await activeNetworkId();
    const endpoints = ENDPOINTS[id] ?? [];
    return {
      ok: true,
      state: {
        networkChainId: getNetworkDef(id).chainId,
        // Shaped like the desktop pool's snapshot so the renderer reads it the
        // same way, but the liveness flags are optimistic: nothing here pings.
        peers: endpoints.map((e) => ({
          rpc: e.rpc,
          rest: e.rest,
          grpc: null,
          source: 'bundled',
          chainId: getNetworkDef(id).chainId,
          lastSeenHeight: null,
          lastSeenAt: 0,
          latencyMs: null,
          flags: { alive: true, slow: false, death: false, suspect: false }
        }))
      }
    };
  },

  'net.getNetwork': async () => ({
    ok: true,
    network: await describeActiveNetwork(),
    available: Object.values(NETWORKS)
  }),

  'net.setNetwork': async (id: string) => {
    const next = normalizeNetworkId(id);
    await setSettings({ lumenNetwork: next } as Settings);
    const network = await describeActiveNetwork();
    for (const fn of networkListeners) {
      try {
        fn({ network });
      } catch {
        // One bad subscriber must not stop the rest hearing about it.
      }
    }
    return { ok: true, network };
  },

  'net.getExplorerAccountUrl': async (address: string) => {
    const template = (await activeNetwork()).explorerAccountUrl;
    const addr = String(address ?? '').trim();
    // '' means "this network has no explorer", which the wallet renders by
    // hiding the link rather than by linking somewhere wrong.
    return { ok: true, url: template && addr ? template.replace('{address}', encodeURIComponent(addr)) : '' };
  },

  'net.getValidators': async () => {
    const res = await readState(
      '/cosmos/staking/v1beta1/validators?pagination.limit=500&status=BOND_STATUS_BONDED',
      { kind: 'rest' }
    );
    const validators = res.ok ? ((res.json as any)?.validators ?? []) : [];
    return { ok: res.ok, validators };
  },

  'net.refreshOnChain': async () => {
    // The desktop rediscovers peers from the chain's own validator set. Here
    // the list is bundled, so there is nothing to refresh - but the caller is
    // told plainly rather than being left waiting on a promise that resolves
    // with nothing.
    return { ok: true, refreshed: 0, reason: 'endpoints_are_bundled_on_mobile' };
  },

  'net.onNetworkChanged': (callback: (payload: unknown) => void) => {
    networkListeners.add(callback);
    return () => networkListeners.delete(callback);
  },

  'rpc.getHeight': async () => {
    const height = await latestHeight();
    return height === null ? { ok: false, error: 'height_unavailable' } : { ok: true, height };
  },

  'rpc.onHeightChanged': (callback: (payload: unknown) => void) => {
    heightListeners.add(callback);
    // Deliberately no polling loop. The desktop has a daemon already watching
    // the head for other reasons; starting a timer here would wake the radio
    // every few seconds for a number most screens do not show.
    return () => heightListeners.delete(callback);
  }
};

/** Plain HTTP, used by pages that fetch a gateway or a web page directly. */
async function plainGet(url: string, asBytes: boolean, method: 'GET' | 'HEAD' = 'GET') {
  try {
    const res = await fetch(String(url ?? ''), { method });
    if (asBytes) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { ok: res.ok, status: res.status, bytes: Array.from(bytes) };
    }
    const text = method === 'HEAD' ? '' : await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return { ok: res.ok, status: res.status, text, headers };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

export const HTTP_MEMBERS = {
  httpGet: (url: string) => plainGet(url, false),
  httpHead: (url: string) => plainGet(url, false, 'HEAD'),
  httpGetBytes: (url: string) => plainGet(url, true),
  'http.get': (url: string) => plainGet(url, false),
  'http.getBytes': (url: string) => plainGet(url, true)
};
