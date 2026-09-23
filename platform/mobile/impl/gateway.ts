/**
 * The gateway half of the bridge, which is what `lumen://` quietly depends on.
 *
 * Resolving a `.lmn` address ends with `pickFastestSource` racing three kinds
 * of source: the local IPFS gateway, the gateways the chain whitelists, and a
 * couple of public ones. The middle option comes from here - `getPlansOverview`
 * lists them and `getBaseUrl` turns each into a base URL - and with this
 * namespace stubbed that whole branch answered "no_gateways" instantly. A
 * phone with no local node was left with only the public fallback, which is
 * also the slowest and the most easily rate-limited.
 *
 * The desktop answers most of this from a gateway agent on localhost. There is
 * none here, so everything that can be read from the chain is read from the
 * chain, and everything that needs the agent is honest about not having one.
 */

import { readState } from './network';
import { httpRequest } from './native-http';
import { PROFILES_KEY, readDoc } from './storage';

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const trimSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * Turns whatever a gateway record calls its address into a usable base URL.
 *
 * Records carry `endpoint`, `baseUrl` or `url` depending on when they were
 * written, and some carry a bare host with no scheme. https is assumed for
 * those: a gateway reached over plain http from a page served over https would
 * be blocked as mixed content anyway.
 */
function normalizeBase(hint: unknown): string {
  const raw = String(hint ?? '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return trimSlash(url.origin);
  } catch {
    return '';
  }
}

async function activeProfileId(): Promise<string> {
  const doc = await readDoc<{ profiles: { id: string }[]; activeId: string }>(PROFILES_KEY);
  return String(doc?.activeId ?? doc?.profiles?.[0]?.id ?? '');
}

/** The gateways the chain knows about. */
async function chainGateways(limit = 200) {
  const res = await readState(`/lumen/gateway/v1/gateways?limit=${limit}`, {
    kind: 'rest',
    timeout: 10_000
  });
  if (!res.ok) return { ok: false as const, error: 'gateway_list_failed', gateways: [] };
  return { ok: true as const, gateways: asArray((res.json as any)?.gateways) };
}

export const GATEWAY_MEMBERS = {
  'gateway.listGateways': async (input?: { limit?: number }) => {
    const limit = Math.min(Math.max(Number(input?.limit ?? 200), 1), 1000);
    const result = await chainGateways(limit);
    return result.ok
      ? { ok: true, gateways: result.gateways, total: result.gateways.length }
      : { ok: false, error: result.error };
  },

  'gateway.getParams': async () => {
    const res = await readState('/lumen/gateway/v1/params', { kind: 'rest', timeout: 10_000 });
    return res.ok
      ? { ok: true, params: (res.json as any)?.params ?? {} }
      : { ok: false, status: res.status, error: 'gateway_params_failed' };
  },

  /**
   * The list `loadWhitelistedGatewayBases` walks.
   *
   * Pricing is skipped when the caller says so - the resolver does, because it
   * only wants somewhere to fetch from and paying for it is a different
   * question asked on a different screen.
   */
  'gateway.getPlansOverview': async (profileId?: string, options?: { includePricing?: boolean }) => {
    const id = String(profileId ?? (await activeProfileId()));
    const list = await chainGateways(200);
    if (!list.ok) return { ok: false, error: list.error, plans: [], gateways: [] };

    let plans: unknown[] = [];
    if (options?.includePricing !== false && id) {
      const res = await readState('/lumen/gateway/v1/contracts', { kind: 'rest', timeout: 10_000 });
      if (res.ok) plans = asArray((res.json as any)?.contracts);
    }

    return { ok: true, plans, gateways: list.gateways, errors: {} };
  },

  /** Normalises an endpoint hint into the base the resolver will fetch from. */
  'gateway.getBaseUrl': async (profileId?: string, hint?: string) => {
    const baseUrl = normalizeBase(hint);
    if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };
    return { ok: true, baseUrl };
  },

  'gateway.checkAlive': async (input: { endpoint?: string } | string) => {
    const base = normalizeBase(typeof input === 'string' ? input : input?.endpoint);
    if (!base) return { ok: false, error: 'missing_endpoint' };
    const res = await httpRequest(`${base}/health`, { method: 'GET', timeoutMs: 5_000 });
    return { ok: res.ok, status: res.status, alive: res.ok };
  },

  /**
   * Content search, which runs on a gateway rather than on the chain.
   *
   * With no gateway configured there is nothing to ask, and saying so beats an
   * empty result set that reads as "nothing matched".
   */
  'gateway.searchPq': async (input: {
    query?: string;
    baseUrl?: string;
    endpoint?: string;
  }): Promise<{ ok: boolean; error?: string; results: unknown[] }> => {
    // The base is resolved once, up front, rather than by calling back into
    // this member with a filled-in hint - a self-reference TypeScript cannot
    // infer a return type through, and a loop with no obvious stopping point.
    let base = normalizeBase(input?.baseUrl ?? input?.endpoint);
    if (!base) {
      const list = await chainGateways(20);
      for (const entry of list.gateways) {
        base = normalizeBase((entry as any)?.endpoint ?? (entry as any)?.url ?? (entry as any)?.baseUrl);
        if (base) break;
      }
    }
    if (!base) return { ok: false, error: 'no_gateway_available', results: [] };

    // POST /pq/search with a JSON body - the route is public, unlike the
    // wallet-scoped ones, but it is still not a query string.
    const res = await httpRequest(`${base}/pq/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: String(input?.query ?? ''), ...(input ?? {}) }),
      timeoutMs: 15_000
    });
    if (!res.ok) return { ok: false, error: `gateway_search_failed_${res.status}`, results: [] };
    try {
      const body = JSON.parse(res.text);
      return { ok: true, results: asArray(body?.results ?? body) };
    } catch {
      return { ok: false, error: 'gateway_search_bad_response', results: [] };
    }
  },

  'gateway.pingViewPq': async (input: { cid?: string; endpoint?: string; baseUrl?: string }) => {
    const base = normalizeBase(input?.baseUrl ?? input?.endpoint);
    const cid = String(input?.cid ?? '').trim();
    if (!base || !cid) return { ok: false, error: 'missing_gateway_or_cid' };
    await httpRequest(`${base}/pq/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cid }),
      timeoutMs: 4_000
    });
    return { ok: true };
  }
};
