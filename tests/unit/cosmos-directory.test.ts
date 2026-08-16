import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCosmosChainsCache,
  clearIbcIndexCache,
  fetchCosmosBalances,
  fetchCosmosProposals,
  fetchCosmosTransactions,
  fetchCosmosStaking,
  getCosmosChainsAge,
  isChainUsable,
  isWellFormedChain,
  loadCosmosChains,
  loadIbcIndex,
  loadIbcPairChannels,
  mergeCosmosChains,
  readFollowedChains,
  resolveIbcDenoms,
  resolveIbcPeers,
  sortCosmosChains,
  toggleFollowedChain,
  writeFollowedChains,
} from '../../src/internal/services/cosmosDirectory';
import { STORAGE_KEYS } from '../../src/internal/services/storage';
import type { CosmosChainSummary } from '../../src/types/walletPage';

/**
 * The Cosmos chain directory.
 *
 * Two behaviours here are load-bearing and easy to regress. The trim is one:
 * the upstream entry carries peers, codebase and full asset lists, and storing
 * it whole would put megabytes of unread fields into localStorage. The stale
 * fallback is the other: a failed refresh has to keep serving yesterday's list,
 * because the alternative shown to the user is an empty screen.
 *
 * Balances are separate on purpose - one chain, on demand - so the endpoint
 * failover is tested against a first endpoint that is down.
 */

const CACHE_KEY = STORAGE_KEYS.cosmosChainsCache;

/**
 * The chain a case is about, by name.
 *
 * Every result now includes the directory snapshot shipped with the build, so
 * a fixture is one entry among 200-odd rather than the whole list.
 */
function pick(chains: CosmosChainSummary[], name = FIXTURE_NAME): CosmosChainSummary {
  const found = chains.find((chain) => chain.name === name);
  if (!found) throw new Error(`no chain named ${name} in ${chains.length} results`);
  return found;
}

/** What `upstreamChain()` is called unless a case overrides it. */
const FIXTURE_NAME = 'osmosis';

/** One upstream entry, deliberately fatter than what we keep. */
function upstreamChain(overrides: Record<string, unknown> = {}) {
  return {
    chain_name: 'osmosis',
    pretty_name: 'Osmosis',
    chain_id: 'osmosis-1',
    bech32_prefix: 'osmo',
    status: 'live',
    network_type: 'mainnet',
    height: 12345,
    assets: [
      {
        base: 'uosmo',
        symbol: 'OSMO',
        display: 'osmo',
        denom_units: [
          { denom: 'uosmo', exponent: 0 },
          { denom: 'osmo', exponent: 6 },
        ],
        images: [{ png: 'https://example.test/osmo.png' }],
      },
    ],
    best_apis: {
      rest: [{ address: 'https://rest.example.test/' }],
      rpc: [{ address: 'https://rpc.example.test' }],
    },
    // Fields the trim must drop rather than cache.
    peers: { seeds: new Array(50).fill({ id: 'x', address: 'y' }) },
    codebase: { git_repo: 'https://example.test/repo' },
    ...overrides,
  };
}

/** Answers absolute URLs through the bridge that fetchAbsoluteJson prefers. */
function stubHttp(handler: (url: string) => unknown) {
  const get = vi.fn(async (url: string) => {
    const body = handler(url);
    if (body === undefined) return { ok: false, status: 502 };
    return { ok: true, json: body };
  });
  (window as any).lumen = { http: { get } };
  return get;
}

beforeEach(() => {
  localStorage.clear();
  // The in-flight promise is a module singleton, so without this every case
  // after the first is served the previous one's result.
  clearCosmosChainsCache();
  clearIbcIndexCache();
  localStorage.clear();
});

afterEach(() => {
  delete (window as any).lumen;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadCosmosChains', () => {
  it('keeps the fields the list draws and drops the rest', async () => {
    stubHttp(() => ({ chains: [upstreamChain()] }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);

    expect(chain).toEqual({
      name: 'osmosis',
      prettyName: 'Osmosis',
      chainId: 'osmosis-1',
      prefix: 'osmo',
      status: 'live',
      networkType: 'mainnet',
      symbol: 'OSMO',
      denom: 'uosmo',
      decimals: 6,
      image: 'https://example.test/osmo.png',
      rest: ['https://rest.example.test'],
      rpc: ['https://rpc.example.test'],
      height: 12345,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
    });
    expect(Object.keys(chain)).not.toContain('peers');
    expect(Object.keys(chain)).not.toContain('codebase');
  });

  it('reads the price, staking and explorer detail when the entry carries it', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          website: 'https://osmosis.zone/',
          coingecko_id: 'osmosis',
          params: {
            calculated_apr: 0.0185,
            unbonding_time: 1209600,
            actual_block_time: 1.285,
          },
          assets: [
            {
              base: 'uosmo',
              symbol: 'OSMO',
              display: 'osmo',
              denom_units: [{ denom: 'osmo', exponent: 6 }],
              prices: { coingecko: { usd: 0.03035263 } },
            },
          ],
          explorers: [
            { kind: 'mintscan', url: 'https://mintscan.io/osmosis', account_page: 'https://mintscan.io/osmosis/accounts/${accountAddress}' },
            { kind: 'ping.pub', url: 'https://ping.pub/osmosis' },
          ],
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);

    expect(chain.priceUsd).toBe(0.03035263);
    expect(chain.website).toBe('https://osmosis.zone/');
    expect(chain.coingeckoId).toBe('osmosis');
    expect(chain.apr).toBe(0.0185);
    expect(chain.unbondingSeconds).toBe(1209600);
    expect(chain.blockTime).toBe(1.285);
    expect(chain.explorers).toHaveLength(2);
    expect(chain.explorers[0].accountPage).toContain('${accountAddress}');
    // An explorer with no account template keeps an empty one rather than a
    // borrowed URL, so the caller can tell it apart and fall back to the home page.
    expect(chain.explorers[1].accountPage).toBe('');
  });

  it('keeps a price of zero distinct from no price at all', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          assets: [{ base: 'ux', symbol: 'X', display: 'x', prices: { coingecko: { usd: 0 } } }],
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);
    expect(chain.priceUsd).toBe(0);
  });

  it('caps the explorer list rather than storing a directory of them', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          explorers: new Array(12).fill(null).map((_, index) => ({
            kind: `explorer-${index}`,
            url: `https://explorer-${index}.test`,
          })),
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);
    expect(chain.explorers).toHaveLength(5);
  });

  it('drops an explorer with no url, which cannot be opened', async () => {
    stubHttp(() => ({
      chains: [upstreamChain({ explorers: [{ kind: 'broken' }, { kind: 'ok', url: 'https://ok.test' }] })],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);
    expect(chain.explorers.map((explorer) => explorer.kind)).toEqual(['ok']);
  });

  /**
   * The aggregated directory and the raw registry disagree on two fields, and
   * the disagreement is silent. `display` and `base` arrive here as
   * `{ denom, exponent }` objects rather than strings, and the exponent that
   * matters is the chain's own `decimals`.
   *
   * Read the registry way, 75 of the 221 live chains came back as 6 decimals
   * when they are 18 - a balance rendered a trillion times too large - and
   * `denom` came back as the string "[object Object]". Both were invisible
   * against a hand-written fixture, which is why this one is shaped like the
   * wire.
   */
  it('reads the directory shape, where display and base are objects', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          chain_name: 'acrechain',
          pretty_name: 'Acrechain',
          chain_id: 'acre_9052-1',
          bech32_prefix: 'acre',
          symbol: 'ACRE',
          denom: 'aacre',
          decimals: 18,
          image: 'https://example.test/acre.svg',
          assets: [
            {
              symbol: 'ACRE',
              decimals: 18,
              base: { denom: 'aacre', exponent: 0 },
              display: { denom: 'acre', exponent: 18 },
              denom_units: [
                { denom: 'aacre', exponent: 0 },
                { denom: 'acre', exponent: 18 },
              ],
            },
          ],
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), 'acrechain');

    expect(chain.decimals).toBe(18);
    expect(chain.denom).toBe('aacre');
    expect(chain.symbol).toBe('ACRE');
    expect(chain.image).toBe('https://example.test/acre.svg');
    expect(`${chain.denom}${chain.symbol}${chain.image}`).not.toContain('object Object');
  });

  it('falls back to the registry shape when the entry has no top-level decimals', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          assets: [
            {
              base: 'aevmos',
              symbol: 'EVMOS',
              display: 'evmos',
              denom_units: [
                { denom: 'aevmos', exponent: 0 },
                { denom: 'evmos', exponent: 18 },
              ],
            },
          ],
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);
    expect(chain.decimals).toBe(18);
    expect(chain.denom).toBe('aevmos');
  });

  it('drops an entry that cannot be identified', async () => {
    stubHttp(() => ({
      chains: [upstreamChain(), { pretty_name: 'Nameless', chain_id: '' }],
    }));

    const chains = await loadCosmosChains();
    // The nameless entry is dropped; the identified one survives alongside the
    // bundled snapshot.
    expect(chains.filter((chain) => chain.chainId === '').length).toBe(0);
    expect(pick(chains).name).toBe('osmosis');
  });

  it('sorts by display name so the list is stable between refreshes', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({ chain_name: 'zeta', pretty_name: 'Zeta', chain_id: 'zeta-1' }),
        upstreamChain({ chain_name: 'akash', pretty_name: 'Akash', chain_id: 'akash-1' }),
      ],
    }));

    const chains = await loadCosmosChains();
    const names = chains.map((chain) => chain.name);
    expect(names.indexOf('akash')).toBeLessThan(names.indexOf('zeta'));
  });

  it('gives the home chain an image the directory does not publish', async () => {
    stubHttp(() => ({
      chains: [
        upstreamChain({
          chain_name: 'lumen',
          pretty_name: 'Lumen',
          chain_id: 'lumen',
          bech32_prefix: 'lmn',
          assets: [{ symbol: 'LMN', base: 'ulmn', display: 'lmn', denom_units: [] }],
        }),
      ],
    }));

    const chain = pick(await loadCosmosChains(), FIXTURE_NAME);
    expect(chain.image).toBeTruthy();
  });

  it('serves a fresh stored copy without going to the network', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), chains: [storedChain('stored')] })
    );
    const get = stubHttp(() => ({ chains: [upstreamChain()] }));

    const chains = await loadCosmosChains();

    expect(pick(chains, 'stored').prettyName).toBe('Stored');
    expect(get).not.toHaveBeenCalled();
  });

  /** A complete entry, since a refresh now merges rather than replaces. */
  function storedChain(name: string): CosmosChainSummary {
    return {
      name,
      prettyName: name.charAt(0).toUpperCase() + name.slice(1),
      chainId: `${name}-1`,
      prefix: 'p',
      status: 'live',
      networkType: 'mainnet',
      symbol: name.toUpperCase(),
      denom: `u${name}`,
      decimals: 6,
      image: '',
      rest: ['https://stored.test'],
      rpc: ['https://stored.test'],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
    };
  }

  it('goes to the network when the stored copy has aged out', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        updatedAt: Date.now() - 40 * 60 * 60 * 1000,
        chains: [storedChain('stored')]
      })
    );
    const get = stubHttp(() => ({ chains: [upstreamChain()] }));

    const chains = await loadCosmosChains();

    expect(get).toHaveBeenCalledTimes(1);
    // Fresh data arrives, and the chain that is no longer listed survives it.
    expect(pick(chains).chainId).toBe('osmosis-1');
    expect(pick(chains, 'stored').prettyName).toBe('Stored');
  });

  it('refetches on force even when the stored copy is fresh', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now(), chains: [storedChain('stored')] })
    );
    const get = stubHttp(() => ({ chains: [upstreamChain()] }));

    const chains = await loadCosmosChains({ force: true });

    expect(get).toHaveBeenCalledTimes(1);
    expect(chains.map((chain) => chain.name)).toContain('osmosis');
  });

  it('falls back to a stale copy when the refresh fails', async () => {
    const stale = { ...storedChain('akash'), prettyName: 'Akash (stored)' };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now() - 40 * 60 * 60 * 1000, chains: [stale] })
    );
    stubHttp(() => undefined);

    const chains = await loadCosmosChains();
    expect(pick(chains, 'akash').prettyName).toBe('Akash (stored)');
  });

  it('serves the bundled snapshot when nothing is cached and nothing answers', async () => {
    stubHttp(() => undefined);
    // Offline on a fresh install: the directory shipped with the build is a
    // complete list, so this is never an empty panel.
    const chains = await loadCosmosChains();
    expect(chains.length).toBeGreaterThan(200);
    expect(pick(chains, 'lumen').name).toBe('lumen');
  });

  it('retries after a failure rather than replaying it all session', async () => {
    const get = stubHttp(() => undefined);
    // The snapshot answers, so this resolves - but the failed fetch must not
    // be remembered as the session's answer.
    await expect(loadCosmosChains()).resolves.toBeInstanceOf(Array);

    (window as any).lumen = { http: { get: vi.fn(async () => ({ ok: true, json: { chains: [upstreamChain()] } })) } };
    const chains = await loadCosmosChains({ force: true });
    expect(pick(chains).chainId).toBe('osmosis-1');
    expect(get).toHaveBeenCalled();
  });

  it('treats an empty directory as a failure, not as "no chains"', async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now() - 40 * 60 * 60 * 1000, chains: [storedChain('akash')] })
    );
    stubHttp(() => ({ chains: [] }));

    const chains = await loadCosmosChains();
    expect(pick(chains, 'akash').prettyName).toBe('Akash');
  });
});

/**
 * The directory arrives over TLS from a third party republishing a public
 * repository. There is no signature to check and none is published, so the
 * shape is what gets verified: one malformed entry must not be able to break
 * the panel for the other 220, and a bad exponent is how an amount is rendered
 * wrong.
 */
describe('isWellFormedChain', () => {
  function valid(over: Partial<CosmosChainSummary> = {}): CosmosChainSummary {
    return {
      name: 'osmosis',
      prettyName: 'Osmosis',
      chainId: 'osmosis-1',
      prefix: 'osmo',
      status: 'live',
      networkType: 'mainnet',
      symbol: 'OSMO',
      denom: 'uosmo',
      decimals: 6,
      image: '',
      rest: ['https://rest.example.test'],
      rpc: [],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
      ...over,
    };
  }

  it('accepts a complete entry', () => {
    expect(isWellFormedChain(valid())).toBe(true);
  });

  it('rejects anything that is not an object', () => {
    expect(isWellFormedChain(null)).toBe(false);
    expect(isWellFormedChain('osmosis')).toBe(false);
    expect(isWellFormedChain(42)).toBe(false);
  });

  it('needs a name and a chain id, since neither can be guessed', () => {
    expect(isWellFormedChain(valid({ name: '' }))).toBe(false);
    expect(isWellFormedChain(valid({ chainId: '   ' }))).toBe(false);
  });

  it('rejects an exponent that is not a plausible one', () => {
    expect(isWellFormedChain(valid({ decimals: 6.5 }))).toBe(false);
    expect(isWellFormedChain(valid({ decimals: -1 }))).toBe(false);
    expect(isWellFormedChain(valid({ decimals: 99 }))).toBe(false);
    expect(isWellFormedChain(valid({ decimals: '6' as unknown as number }))).toBe(false);
    expect(isWellFormedChain(valid({ decimals: 18 }))).toBe(true);
  });

  it('rejects a denom that is not a string', () => {
    expect(isWellFormedChain(valid({ denom: { denom: 'uosmo' } as unknown as string }))).toBe(false);
  });

  it('rejects endpoints that are not http urls', () => {
    expect(isWellFormedChain(valid({ rest: ['not-a-url'] }))).toBe(false);
    expect(isWellFormedChain(valid({ rpc: [42 as unknown as string] }))).toBe(false);
    expect(isWellFormedChain(valid({ rest: [] }))).toBe(true);
  });

  it('accepts a missing optional number as null but not as a string', () => {
    expect(isWellFormedChain(valid({ priceUsd: null }))).toBe(true);
    expect(isWellFormedChain(valid({ apr: 'high' as unknown as number }))).toBe(false);
  });

  it('needs explorers to be a list', () => {
    expect(isWellFormedChain(valid({ explorers: null as unknown as [] }))).toBe(false);
  });
});

describe('mergeCosmosChains', () => {
  function summary(name: string, over: Partial<CosmosChainSummary> = {}): CosmosChainSummary {
    return {
      name,
      prettyName: name.charAt(0).toUpperCase() + name.slice(1),
      chainId: `${name}-1`,
      prefix: 'p',
      status: 'live',
      networkType: 'mainnet',
      symbol: name.toUpperCase(),
      denom: `u${name}`,
      decimals: 6,
      image: '',
      rest: ['https://old.test'],
      rpc: ['https://old.test'],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
      ...over,
    };
  }

  /**
   * A chain leaving the registry must not leave the wallet. Endpoints and the
   * exponent are what let a balance be read and a token be sent; dropping them
   * because an upstream list got shorter would take away access to funds the
   * user still holds.
   */
  it('keeps a chain the fresh list no longer mentions', () => {
    const merged = mergeCosmosChains([summary('akash'), summary('osmosis')], [summary('osmosis')]);
    expect(merged.map((chain) => chain.name).sort()).toEqual(['akash', 'osmosis']);
  });

  it('updates a chain that is still listed, rather than keeping the old copy', () => {
    const merged = mergeCosmosChains(
      [summary('osmosis', { rest: ['https://old.test'], decimals: 6 })],
      [summary('osmosis', { rest: ['https://new.test'], decimals: 18 })]
    );
    expect(merged[0].rest).toEqual(['https://new.test']);
    expect(merged[0].decimals).toBe(18);
  });

  it('adds chains that were not there before', () => {
    const merged = mergeCosmosChains([summary('akash')], [summary('akash'), summary('zeta')]);
    expect(merged.map((chain) => chain.name)).toContain('zeta');
  });

  it('re-sorts, so a kept chain lands in its band rather than at the end', () => {
    const merged = mergeCosmosChains(
      [summary('zeta'), summary('akash', { rest: [] })],
      [summary('lumen'), summary('beezee')]
    );
    expect(merged[0].name).toBe('lumen');
    // akash publishes no endpoint, so it sinks below the usable ones.
    expect(merged[merged.length - 1].name).toBe('akash');
  });

  it('is the fresh list when nothing was stored', () => {
    const merged = mergeCosmosChains([], [summary('akash')]);
    expect(merged.map((chain) => chain.name)).toEqual(['akash']);
  });
});

describe('sortCosmosChains', () => {
  /** Only the fields the ordering reads. */
  function chain(
    name: string,
    { rest = ['https://x.test'], prefix = 'p' }: { rest?: string[]; prefix?: string } = {}
  ): CosmosChainSummary {
    return {
      name,
      prettyName: name.charAt(0).toUpperCase() + name.slice(1),
      chainId: `${name}-1`,
      prefix,
      status: 'live',
      networkType: 'mainnet',
      symbol: name.toUpperCase(),
      denom: `u${name}`,
      decimals: 6,
      image: '',
      rest,
      rpc: [],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
    };
  }

  it('puts the home chain first, whatever its name would sort as', () => {
    const sorted = sortCosmosChains([chain('akash'), chain('lumen'), chain('zeta')]);
    expect(sorted.map((c) => c.name)).toEqual(['lumen', 'akash', 'zeta']);
  });

  it('pins the home chain above a chain that would otherwise precede it', () => {
    const sorted = sortCosmosChains([chain('aaaaa'), chain('lumen')]);
    expect(sorted[0].name).toBe('lumen');
  });

  it('sinks chains with no endpoint below every usable one', () => {
    const sorted = sortCosmosChains([
      chain('akash', { rest: [] }),
      chain('zeta'),
      chain('lumen'),
      chain('beezee'),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['lumen', 'beezee', 'zeta', 'akash']);
  });

  it('sinks a chain with no address prefix too', () => {
    const sorted = sortCosmosChains([chain('akash', { prefix: '' }), chain('zeta')]);
    expect(sorted.map((c) => c.name)).toEqual(['zeta', 'akash']);
  });

  it('keeps the sunk band alphabetical rather than arbitrary', () => {
    const sorted = sortCosmosChains([
      chain('zeta', { rest: [] }),
      chain('akash', { rest: [] }),
      chain('mars', { rest: [] }),
    ]);
    expect(sorted.map((c) => c.name)).toEqual(['akash', 'mars', 'zeta']);
  });

  it('keeps the home chain first even when it has no endpoint', () => {
    const sorted = sortCosmosChains([chain('akash'), chain('lumen', { rest: [] })]);
    expect(sorted[0].name).toBe('lumen');
  });

  it('does not mutate the array it was given', () => {
    const input = [chain('zeta'), chain('akash')];
    sortCosmosChains(input);
    expect(input.map((c) => c.name)).toEqual(['zeta', 'akash']);
  });
});

describe('isChainUsable', () => {
  it('needs both an endpoint and a prefix', () => {
    const base: CosmosChainSummary = {
      name: 'x', prettyName: 'X', chainId: 'x-1', prefix: 'x', status: 'live',
      networkType: 'mainnet', symbol: 'X', denom: 'ux', decimals: 6, image: '',
      rest: ['https://x.test'], rpc: [], height: null, priceUsd: null, website: '', coingeckoId: '', apr: null,
      unbondingSeconds: null, blockTime: null, explorers: [],
    };
    expect(isChainUsable(base)).toBe(true);
    expect(isChainUsable({ ...base, rest: [] })).toBe(false);
    expect(isChainUsable({ ...base, prefix: '' })).toBe(false);
  });
});

describe('followed chains', () => {
  /**
   * The home chain leads every watchlist and cannot be removed: this is its
   * own browser, and hiding the account it is built on is not a choice worth
   * offering.
   */
  it('starts with the home chain and round-trips what was written after it', () => {
    expect(readFollowedChains('p1')).toEqual(['lumen']);
    writeFollowedChains('p1', ['osmosis', 'akash']);
    expect(readFollowedChains('p1')).toEqual(['lumen', 'osmosis', 'akash']);
  });

  it('does not repeat the home chain when it is also stored', () => {
    writeFollowedChains('p1', ['lumen', 'osmosis']);
    expect(readFollowedChains('p1')).toEqual(['lumen', 'osmosis']);
  });

  it('refuses to unfollow the home chain', () => {
    expect(toggleFollowedChain('p1', 'lumen')).toEqual(['lumen']);
    expect(readFollowedChains('p1')).toEqual(['lumen']);
  });

  it('keeps the order they were followed in, not alphabetical', () => {
    toggleFollowedChain('p1', 'zeta');
    toggleFollowedChain('p1', 'akash');
    expect(readFollowedChains('p1')).toEqual(['lumen', 'zeta', 'akash']);
  });

  it('toggles off as well as on', () => {
    expect(toggleFollowedChain('p1', 'osmosis')).toEqual(['lumen', 'osmosis']);
    expect(toggleFollowedChain('p1', 'osmosis')).toEqual(['lumen']);
    expect(readFollowedChains('p1')).toEqual(['lumen']);
  });

  it('keeps one profile out of another profile’s watchlist', () => {
    toggleFollowedChain('p1', 'osmosis');
    toggleFollowedChain('p2', 'akash');
    expect(readFollowedChains('p1')).toEqual(['lumen', 'osmosis']);
    expect(readFollowedChains('p2')).toEqual(['lumen', 'akash']);
  });

  it('does not follow the same chain twice', () => {
    writeFollowedChains('p1', ['osmosis', 'osmosis', 'akash']);
    expect(readFollowedChains('p1')).toEqual(['lumen', 'osmosis', 'akash']);
  });

  it('ignores a stored value that is not a list', () => {
    localStorage.setItem('lumen:cosmos:followed:v1:p1', '"osmosis"');
    expect(readFollowedChains('p1')).toEqual(['lumen']);
  });

  it('ignores an empty name rather than storing a blank entry', () => {
    expect(toggleFollowedChain('p1', '   ')).toEqual(['lumen']);
    expect(readFollowedChains('p1')).toEqual(['lumen']);
  });
});

describe('IBC peers', () => {
  function chainNamed(name: string): CosmosChainSummary {
    return {
      name,
      prettyName: name.charAt(0).toUpperCase() + name.slice(1),
      chainId: `${name}-1`,
      prefix: 'p',
      status: 'live',
      networkType: 'mainnet',
      symbol: name.toUpperCase(),
      denom: `u${name}`,
      decimals: 6,
      image: '',
      rest: [],
      rpc: [],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
    };
  }

  it('indexes both sides of every registered pair', async () => {
    (window as any).lumen = {
      http: {
        get: vi.fn(async () => ({
          ok: true,
          json: [{ name: 'lumen-osmosis.json' }, { name: 'beezee-lumen.json' }],
        })),
      },
    };

    const index = await loadIbcIndex();
    const chains = [chainNamed('lumen'), chainNamed('osmosis'), chainNamed('beezee')];

    expect(resolveIbcPeers(index, 'lumen', chains).map((peer) => peer.name)).toEqual([
      'beezee',
      'osmosis',
    ]);
    expect(resolveIbcPeers(index, 'osmosis', chains).map((peer) => peer.name)).toEqual(['lumen']);
  });

  /**
   * Chain names contain hyphens, so `a-b-c.json` could be `a` + `b-c` or
   * `a-b` + `c`. Every split is indexed and the wrong one names no chain, so
   * resolving against the known set is what discards it.
   */
  it('does not invent a peer from an ambiguous file name', async () => {
    (window as any).lumen = {
      http: { get: vi.fn(async () => ({ ok: true, json: [{ name: 'gravity-bridge-osmosis.json' }] })) },
    };

    const index = await loadIbcIndex();
    const chains = [chainNamed('gravity-bridge'), chainNamed('osmosis')];

    expect(resolveIbcPeers(index, 'gravity-bridge', chains).map((p) => p.name)).toEqual(['osmosis']);
    // "gravity" alone is indexed by the other split and must resolve to nothing.
    expect(resolveIbcPeers(index, 'osmosis', chains).map((p) => p.name)).toEqual(['gravity-bridge']);
  });

  it('is empty rather than throwing when the listing cannot be fetched', async () => {
    (window as any).lumen = { http: { get: vi.fn(async () => ({ ok: false, status: 403 })) } };
    await expect(loadIbcIndex()).resolves.toEqual({});
  });

  it('sorts peers by display name', () => {
    const index = { lumen: ['osmosis', 'akash'] };
    const chains = [chainNamed('lumen'), chainNamed('osmosis'), chainNamed('akash')];
    expect(resolveIbcPeers(index, 'lumen', chains).map((p) => p.prettyName)).toEqual([
      'Akash',
      'Osmosis',
    ]);
  });

  it('is empty for a chain with no registered path', () => {
    expect(resolveIbcPeers({}, 'lumen', [chainNamed('lumen')])).toEqual([]);
  });
});

describe('fetchCosmosStaking', () => {
  const chain: CosmosChainSummary = {
    name: 'cosmoshub',
    prettyName: 'Cosmos Hub',
    chainId: 'cosmoshub-4',
    prefix: 'cosmos',
    status: 'live',
    networkType: 'mainnet',
    symbol: 'ATOM',
    denom: 'uatom',
    decimals: 6,
    image: '',
    rest: ['https://rest.example.test'],
    rpc: [],
    height: null,
    priceUsd: null,
    website: '',
    coingeckoId: '',
    apr: null,
    unbondingSeconds: null,
    blockTime: null,
    explorers: [],
  };

  /** Shaped like the two endpoints actually answer. */
  function stubStaking(delegations: unknown, rewards: unknown) {
    return stubHttp((url) => {
      if (url.includes('/staking/v1beta1/delegations/')) return delegations;
      if (url.includes('/distribution/')) return rewards;
      return undefined;
    });
  }

  it('sums delegations in the chain’s own denom', async () => {
    stubStaking(
      {
        delegation_responses: [
          { balance: { denom: 'uatom', amount: '65642016' } },
          { balance: { denom: 'uatom', amount: '1000000' } },
        ],
      },
      { total: [] }
    );

    await expect(fetchCosmosStaking(chain, 'cosmos1abc')).resolves.toEqual({
      staked: '66642016',
      rewards: '0',
      unbonding: '0',
      unbondingEntries: [],
      rewardValidators: [],
      delegations: [],
    });
  });

  /**
   * Rewards are DecCoin, not Coin: they accrue continuously, so the endpoint
   * answers "16116867.987034811218198944". Read as an integer that is NaN, and
   * parsed as a float it loses the tail on an 18-decimal chain.
   */
  it('truncates the fractional part of a reward rather than rounding it', async () => {
    stubStaking({ delegation_responses: [] }, {
      total: [{ denom: 'uatom', amount: '16116867.987034811218198944' }],
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewards).toBe('16116867');
  });

  it('stays exact past what a double can hold', async () => {
    stubStaking({ delegation_responses: [] }, {
      total: [{ denom: 'uatom', amount: '69995572532191940537221600633824.5' }],
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewards).toBe('69995572532191940537221600633824');
  });

  it('ignores rewards paid in tokens that arrived over IBC', async () => {
    stubStaking({ delegation_responses: [] }, {
      total: [
        { denom: 'ibc/054892D6BB43AF8B93AAC28AA5FD7019D2C59A15DAFD6F45C1FA2BF9BDA22454', amount: '571.43' },
        { denom: 'uatom', amount: '100.9' },
      ],
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewards).toBe('100');
  });

  it('ignores a delegation denominated in something else', async () => {
    stubStaking(
      { delegation_responses: [{ balance: { denom: 'uosmo', amount: '999' } }] },
      { total: [] }
    );

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.staked).toBe('0');
  });

  it('still reports stake when the distribution module does not answer', async () => {
    stubHttp((url) => {
      if (url.includes('/staking/v1beta1/delegations/')) {
        return { delegation_responses: [{ balance: { denom: 'uatom', amount: '500' } }] };
      }
      return undefined;
    });

    await expect(fetchCosmosStaking(chain, 'cosmos1abc')).resolves.toEqual({
      staked: '500',
      rewards: '0',
      unbonding: '0',
      unbondingEntries: [],
      rewardValidators: [],
      delegations: [],
    });
  });

  it('is zero for an account that has never delegated', async () => {
    stubStaking({ delegation_responses: [] }, { total: [] });
    await expect(fetchCosmosStaking(chain, 'cosmos1abc')).resolves.toEqual({
      staked: '0',
      rewards: '0',
      unbonding: '0',
      unbondingEntries: [],
      rewardValidators: [],
      delegations: [],
    });
  });

  it('refuses a chain with no endpoint, and an empty address', async () => {
    await expect(fetchCosmosStaking({ ...chain, rest: [] }, 'cosmos1abc')).rejects.toThrow();
    await expect(fetchCosmosStaking(chain, '  ')).rejects.toThrow();
  });

  /**
   * A claim batches one message per validator into one transaction, and the
   * chain refuses a withdraw against a validator that owes nothing:
   *
   *   code 18: withdraw delegator reward: no rewards available for delegator
   *   lmn1… on validator lmnvaloper1… : invalid request
   *
   * One empty validator therefore fails the whole batch. Rewards accrue per
   * validator, so a delegation made moments ago has none while its neighbours
   * do - which is why the claim list comes from the rewards and not from the
   * delegations.
   */
  it('lists only validators that owe something, not everyone delegated to', async () => {
    stubStaking(
      {
        delegation_responses: [
          { delegation: { validator_address: 'val-paying' }, balance: { denom: 'uatom', amount: '100' } },
          { delegation: { validator_address: 'val-empty' }, balance: { denom: 'uatom', amount: '900' } },
        ],
      },
      {
        total: [{ denom: 'uatom', amount: '42.5' }],
        rewards: [
          { validator_address: 'val-paying', reward: [{ denom: 'uatom', amount: '42.5' }] },
          { validator_address: 'val-empty', reward: [] },
        ],
      }
    );

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');

    expect(result.rewardValidators).toEqual(['val-paying']);
    // Both are still shown as delegations - only the claim list is narrowed.
    expect(result.delegations.map((entry) => entry.validator).sort()).toEqual([
      'val-empty',
      'val-paying',
    ]);
  });

  it('skips a validator paying only in a foreign denom', async () => {
    stubStaking({ delegation_responses: [] }, {
      total: [],
      rewards: [
        { validator_address: 'val-ibc-only', reward: [{ denom: 'ibc/ABC', amount: '900' }] },
      ],
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewardValidators).toEqual([]);
  });

  it('skips a validator whose reward rounds down to nothing claimable', async () => {
    stubStaking({ delegation_responses: [] }, {
      total: [{ denom: 'uatom', amount: '0.4' }],
      rewards: [{ validator_address: 'val-dust', reward: [{ denom: 'uatom', amount: '0.4' }] }],
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewardValidators).toEqual([]);
  });

  it('is empty when the distribution module did not answer', async () => {
    stubHttp((url) => {
      if (url.includes('/distribution/')) return undefined;
      if (url.includes('/staking/v1beta1/delegations/')) {
        return { delegation_responses: [{ balance: { denom: 'uatom', amount: '5' } }] };
      }
      return { unbonding_responses: [] };
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.rewardValidators).toEqual([]);
  });

  /**
   * Unbonding entries carry no denom - an unbonding is always in the chain's
   * bond token - and they nest one level deeper than delegations do, under
   * `unbonding_responses[].entries[]`. Shaped like the wire, from a real
   * Osmosis validator.
   */
  it('sums unbonding entries and reports the earliest completion', async () => {
    stubHttp((url) => {
      if (url.includes('/unbonding_delegations')) {
        return {
          unbonding_responses: [
            {
              entries: [
                { balance: '255000000', completion_time: '2026-08-24T19:00:19.644788463Z' },
                { balance: '45000000', completion_time: '2026-08-30T10:00:00Z' },
              ],
            },
            {
              entries: [{ balance: '1000000', completion_time: '2026-08-20T08:00:00Z' }],
            },
          ],
        };
      }
      if (url.includes('/staking/v1beta1/delegations/')) return { delegation_responses: [] };
      return { total: [] };
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.unbonding).toBe('301000000');
    // Soonest first, and every entry kept rather than collapsed to one date.
    expect(result.unbondingEntries.map((e) => e.completesAt)).toEqual([
      '2026-08-20T08:00:00Z',
      '2026-08-24T19:00:19.644788463Z',
      '2026-08-30T10:00:00Z',
    ]);
    expect(result.unbondingEntries[0].amount).toBe('1000000');
  });

  it('is zero with no date when nothing is unbonding', async () => {
    stubHttp((url) => {
      if (url.includes('/unbonding_delegations')) return { unbonding_responses: [] };
      if (url.includes('/staking/v1beta1/delegations/')) return { delegation_responses: [] };
      return { total: [] };
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.unbonding).toBe('0');
    expect(result.unbondingEntries).toEqual([]);
  });

  it('still reports stake when the unbonding endpoint does not answer', async () => {
    stubHttp((url) => {
      if (url.includes('/unbonding_delegations')) return undefined;
      if (url.includes('/staking/v1beta1/delegations/')) {
        return { delegation_responses: [{ balance: { denom: 'uatom', amount: '700' } }] };
      }
      return { total: [] };
    });

    const result = await fetchCosmosStaking(chain, 'cosmos1abc');
    expect(result.staked).toBe('700');
    expect(result.unbonding).toBe('0');
  });
});

describe('resolveIbcDenoms', () => {
  function chainNamed(over: Partial<CosmosChainSummary> & { name: string }): CosmosChainSummary {
    return {
      prettyName: over.name,
      chainId: `${over.name}-1`,
      prefix: 'p',
      status: 'live',
      networkType: 'mainnet',
      symbol: over.name.toUpperCase(),
      denom: `u${over.name}`,
      decimals: 6,
      image: '',
      rest: ['https://rest.example.test'],
      rpc: [],
      height: null,
      priceUsd: null,
      website: '',
      coingeckoId: '',
      apr: null,
      unbondingSeconds: null,
      blockTime: null,
      explorers: [],
      ...over,
    };
  }

  const beezee = chainNamed({ name: 'beezee', symbol: 'BZE', denom: 'ubze' });
  const lumen = chainNamed({ name: 'lumen', prettyName: 'Lumen', symbol: 'LMN', denom: 'ulmn' });

  /** The hash BeeZee actually holds for LMN, and the trace it answers with. */
  const LMN_ON_BZE =
    'ibc/693DDB2D9B4260D67C8136C22D837F37488E0FBD81857D8E9C6022332EA26E33';

  it('turns a hash into the asset it is, and names where it came from', async () => {
    stubHttp(() => ({ denom_trace: { path: 'transfer/channel-10', base_denom: 'ulmn' } }));

    const resolved = await resolveIbcDenoms(beezee, [LMN_ON_BZE], [beezee, lumen]);

    expect(resolved[LMN_ON_BZE]).toEqual({
      symbol: 'LMN',
      decimals: 6,
      sourceChain: 'Lumen',
      image: '',
      sourceName: 'lumen',
      path: 'transfer/channel-10',
    });
  });

  /**
   * Four base denoms in the registry are claimed by two chains each - `uluna`
   * by both Terra chains among them. Crediting one of them would be a coin
   * flip, so the amount keeps its base denom and no origin.
   */
  it('refuses to name an origin when two chains claim the denom', async () => {
    const terra = chainNamed({ name: 'terra', prettyName: 'Terra', symbol: 'LUNC', denom: 'uluna' });
    const terra2 = chainNamed({ name: 'terra2', prettyName: 'Terra 2', symbol: 'LUNA', denom: 'uluna' });
    stubHttp(() => ({ denom_trace: { path: 'transfer/channel-1', base_denom: 'uluna' } }));

    const resolved = await resolveIbcDenoms(beezee, ['ibc/ABC'], [beezee, terra, terra2]);

    expect(resolved['ibc/ABC']).toEqual({ symbol: 'uluna', decimals: 0, sourceChain: '', image: '', sourceName: '', path: 'transfer/channel-1' });
  });

  it('keeps the base denom when no known chain issues it', async () => {
    stubHttp(() => ({ denom_trace: { path: 'transfer/channel-9', base_denom: 'uunknown' } }));

    const resolved = await resolveIbcDenoms(beezee, ['ibc/DEF'], [beezee]);
    expect(resolved['ibc/DEF']).toEqual({ symbol: 'uunknown', decimals: 0, sourceChain: '', image: '', sourceName: '', path: 'transfer/channel-9' });
  });

  it('leaves a hash that will not resolve out of the map', async () => {
    stubHttp(() => undefined);
    await expect(resolveIbcDenoms(beezee, ['ibc/GHI'], [beezee])).resolves.toEqual({});
  });

  it('ignores denoms that are not IBC hashes', async () => {
    const get = stubHttp(() => ({}));
    await expect(resolveIbcDenoms(beezee, ['ubze', 'factory/x'], [beezee])).resolves.toEqual({});
    expect(get).not.toHaveBeenCalled();
  });

  it('does nothing without an endpoint to ask', async () => {
    const get = stubHttp(() => ({}));
    await expect(resolveIbcDenoms({ ...beezee, rest: [] }, [LMN_ON_BZE], [beezee])).resolves.toEqual({});
    expect(get).not.toHaveBeenCalled();
  });
});

describe('loadIbcPairChannels', () => {
  /** Shaped like the registry's own pair file, sides in alphabetical order. */
  const PAIR = {
    chain_1: { chain_name: 'lumen', chain_id: 'lumen', connection_id: 'connection-1' },
    chain_2: { chain_name: 'osmosis', chain_id: 'osmosis-1', connection_id: 'connection-11040' },
    channels: [
      {
        chain_1: { channel_id: 'channel-1', port_id: 'transfer' },
        chain_2: { channel_id: 'channel-109674', port_id: 'transfer' },
        tags: { preferred: true, status: 'ACTIVE' },
      },
    ],
  };

  it('reads the source side from whichever half names the source', async () => {
    stubHttp(() => PAIR);

    const fromLumen = await loadIbcPairChannels('lumen', 'osmosis');
    expect(fromLumen[0].channelId).toBe('channel-1');
    expect(fromLumen[0].counterpartyChannelId).toBe('channel-109674');

    // Same file, opposite direction: the sides must swap, not repeat. Reading
    // it the wrong way round sends through a channel id that does not exist
    // on the broadcasting chain.
    const fromOsmosis = await loadIbcPairChannels('osmosis', 'lumen');
    expect(fromOsmosis[0].channelId).toBe('channel-109674');
    expect(fromOsmosis[0].counterpartyChannelId).toBe('channel-1');
  });

  it('names the file with both chains in alphabetical order', async () => {
    const get = stubHttp(() => PAIR);
    await loadIbcPairChannels('osmosis', 'lumen');
    expect(get.mock.calls[0][0]).toContain('lumen-osmosis.json');
  });

  it('drops a channel the registry has not marked active', async () => {
    stubHttp(() => ({
      ...PAIR,
      channels: [
        { chain_1: { channel_id: 'channel-old' }, chain_2: { channel_id: 'channel-x' }, tags: { status: 'KILLED' } },
        { chain_1: { channel_id: 'channel-1' }, chain_2: { channel_id: 'channel-2' }, tags: { status: 'ACTIVE' } },
      ],
    }));

    const channels = await loadIbcPairChannels('lumen', 'osmosis');
    expect(channels.map((channel) => channel.channelId)).toEqual(['channel-1']);
  });

  it('keeps a channel with no status tag rather than assuming it is dead', async () => {
    stubHttp(() => ({
      ...PAIR,
      channels: [{ chain_1: { channel_id: 'channel-1' }, chain_2: { channel_id: 'channel-2' } }],
    }));

    await expect(loadIbcPairChannels('lumen', 'osmosis')).resolves.toHaveLength(1);
  });

  it('defaults the port to transfer, which is what ics20 uses', async () => {
    stubHttp(() => ({
      ...PAIR,
      channels: [{ chain_1: { channel_id: 'channel-1' }, chain_2: { channel_id: 'channel-2' } }],
    }));

    const [channel] = await loadIbcPairChannels('lumen', 'osmosis');
    expect(channel.portId).toBe('transfer');
    expect(channel.counterpartyPortId).toBe('transfer');
  });

  it('drops an entry with no channel id on our side', async () => {
    stubHttp(() => ({
      ...PAIR,
      channels: [{ chain_1: {}, chain_2: { channel_id: 'channel-2' } }],
    }));

    await expect(loadIbcPairChannels('lumen', 'osmosis')).resolves.toEqual([]);
  });

  it('refuses a missing chain name instead of building a bad url', async () => {
    const get = stubHttp(() => PAIR);
    await expect(loadIbcPairChannels('lumen', '')).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('getCosmosChainsAge', () => {
  it('is null when nothing has been stored', () => {
    expect(getCosmosChainsAge()).toBeNull();
  });

  it('reports how old the stored copy is', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ updatedAt: Date.now() - 3 * 60 * 60 * 1000, chains: [] })
    );
    const age = getCosmosChainsAge();
    expect(age).not.toBeNull();
    expect(Math.round((age as number) / (60 * 60 * 1000))).toBe(3);
  });
});

describe('fetchCosmosBalances', () => {
  const chain: CosmosChainSummary = {
    name: 'osmosis',
    prettyName: 'Osmosis',
    chainId: 'osmosis-1',
    prefix: 'osmo',
    status: 'live',
    networkType: 'mainnet',
    symbol: 'OSMO',
    denom: 'uosmo',
    decimals: 6,
    image: '',
    rest: ['https://down.example.test', 'https://up.example.test'],
    rpc: [],
    height: null,
    priceUsd: null,
    website: '',
    coingeckoId: '',
    apr: null,
    unbondingSeconds: null,
    blockTime: null,
    explorers: [],
  };

  it('moves to the next endpoint when the first is down', async () => {
    stubHttp((url) =>
      url.startsWith('https://up.example.test')
        ? { balances: [{ denom: 'uosmo', amount: '1500000' }] }
        : undefined
    );

    const result = await fetchCosmosBalances(chain, 'osmo1abc');
    expect(result.source).toBe('https://up.example.test');
    expect(result.balances).toEqual([{ denom: 'uosmo', amount: '1500000' }]);
  });

  it('throws when every endpoint fails', async () => {
    stubHttp(() => undefined);
    await expect(fetchCosmosBalances(chain, 'osmo1abc')).rejects.toThrow();
  });

  it('refuses a chain with no endpoint rather than guessing one', async () => {
    await expect(fetchCosmosBalances({ ...chain, rest: [] }, 'osmo1abc')).rejects.toThrow(/REST endpoint/);
  });

  it('refuses an empty address', async () => {
    await expect(fetchCosmosBalances(chain, '  ')).rejects.toThrow(/No address/);
  });

  it('drops a balance entry with no denom', async () => {
    stubHttp(() => ({ balances: [{ denom: '', amount: '5' }, { denom: 'uosmo', amount: '7' }] }));
    const result = await fetchCosmosBalances(chain, 'osmo1abc');
    expect(result.balances).toEqual([{ denom: 'uosmo', amount: '7' }]);
  });
});

/** The two new readers share the balance fixture's shape; only rest matters. */
const historyChain: CosmosChainSummary = {
  name: 'osmosis',
  prettyName: 'Osmosis',
  chainId: 'osmosis-1',
  prefix: 'osmo',
  status: 'live',
  networkType: 'mainnet',
  symbol: 'OSMO',
  denom: 'uosmo',
  decimals: 6,
  image: '',
  rest: ['https://rest.example.test'],
  rpc: [],
  height: null,
  priceUsd: null,
  website: '',
  coingeckoId: '',
  apr: null,
  unbondingSeconds: null,
  blockTime: null,
  explorers: [],
};

function txRow(hash: string, height: string, type: string, code = 0) {
  return {
    txhash: hash,
    height,
    code,
    timestamp: '2026-08-01T10:00:00Z',
    tx: { body: { messages: [{ '@type': type }] } },
  };
}

describe('fetchCosmosTransactions', () => {
  it('merges the sender and recipient queries without repeating a transaction', async () => {
    // The same transfer is indexed under both, which is the whole reason two
    // queries are made - and the reason it must be deduplicated afterwards.
    stubHttp((url) =>
      url.includes('message.sender')
        ? { tx_responses: [txRow('AAA', '100', '/cosmos.bank.v1beta1.MsgSend')] }
        : { tx_responses: [txRow('AAA', '100', '/cosmos.bank.v1beta1.MsgSend')] }
    );

    const result = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe('AAA');
  });

  it('shortens the message type and orders the newest block first', async () => {
    stubHttp((url) =>
      url.includes('message.sender')
        ? { tx_responses: [txRow('OLD', '10', '/cosmos.staking.v1beta1.MsgDelegate')] }
        : { tx_responses: [txRow('NEW', '900', '/cosmos.bank.v1beta1.MsgSend')] }
    );

    const result = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(result.map((entry) => entry.hash)).toEqual(['NEW', 'OLD']);
    expect(result.map((entry) => entry.kind)).toEqual(['MsgSend', 'MsgDelegate']);
  });

  it('falls back to the older spelling of the filter parameter', async () => {
    // Chains below SDK 0.46 only answer `events`; refusing `query` must not be
    // read as "this account has no history".
    stubHttp((url) => (url.includes('events=') ? { tx_responses: [txRow('OK', '5', '/x.MsgSend')] } : undefined));

    const result = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(result.map((entry) => entry.hash)).toEqual(['OK']);
  });

  it('reports a failed transaction with the code the chain returned', async () => {
    stubHttp(() => ({ tx_responses: [txRow('BAD', '7', '/x.MsgSend', 18)] }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.failed).toBe(true);
    expect(entry.code).toBe(18);
  });

  it('returns nothing when no endpoint answers, rather than throwing', async () => {
    // A chain with its transaction index off is not a failure to put in front
    // of anyone: it looks exactly like an account that never spent.
    stubHttp(() => undefined);
    await expect(fetchCosmosTransactions(historyChain, 'osmo1abc')).resolves.toEqual([]);
  });

  it('asks nothing without an address', async () => {
    const get = stubHttp(() => ({ tx_responses: [] }));
    await expect(fetchCosmosTransactions(historyChain, '  ')).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchCosmosProposals', () => {
  it('prefers v1 and never asks v1beta1 when it answers', async () => {
    const get = stubHttp((url) =>
      url.includes('/gov/v1/proposals')
        ? { proposals: [{ id: '42', title: 'Raise the cap', status: 'PROPOSAL_STATUS_VOTING_PERIOD' }] }
        : undefined
    );

    const result = await fetchCosmosProposals(historyChain);
    expect(result).toEqual([
      { id: '42', title: 'Raise the cap', status: 'VOTING_PERIOD', statusLabel: 'Voting', votingEndsAt: '' },
    ]);
    expect(get.mock.calls.every(([url]) => !String(url).includes('v1beta1'))).toBe(true);
  });

  it('falls back to v1beta1, where the title sits inside the content', async () => {
    stubHttp((url) =>
      url.includes('v1beta1')
        ? {
            proposals: [
              { proposal_id: '7', content: { title: 'Legacy text' }, status: 'PROPOSAL_STATUS_PASSED' },
            ],
          }
        : undefined
    );

    const [proposal] = await fetchCosmosProposals(historyChain);
    expect(proposal).toEqual({
      id: '7',
      title: 'Legacy text',
      status: 'PASSED',
      statusLabel: 'Passed',
      votingEndsAt: '',
    });
  });

  it('reads the title of a v1 proposal that wraps a legacy one', async () => {
    stubHttp(() => ({ proposals: [{ id: '9', messages: [{ content: { title: 'Wrapped' } }] }] }));
    expect((await fetchCosmosProposals(historyChain))[0].title).toBe('Wrapped');
  });

  it('falls back to the number when no shape carries a title', async () => {
    stubHttp(() => ({ proposals: [{ id: '3' }] }));
    expect((await fetchCosmosProposals(historyChain))[0].title).toBe('#3');
  });

  it('treats an empty answer as an answer and stops asking', async () => {
    // A chain with no proposals is a real result; retrying it against every
    // endpoint would spend the requests to arrive at the same empty list.
    const get = stubHttp(() => ({ proposals: [] }));
    await expect(fetchCosmosProposals(historyChain)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('returns nothing when the chain publishes no REST endpoint', async () => {
    const get = stubHttp(() => ({ proposals: [] }));
    await expect(fetchCosmosProposals({ ...historyChain, rest: [] })).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('transaction detail', () => {
  function sendRow(hash: string, from: string, to: string) {
    return {
      txhash: hash,
      height: '100',
      code: 0,
      timestamp: '2026-08-01T10:00:00Z',
      tx: {
        body: {
          messages: [
            {
              '@type': '/cosmos.bank.v1beta1.MsgSend',
              from_address: from,
              to_address: to,
              amount: [{ denom: 'uosmo', amount: '2500000' }],
            },
          ],
        },
      },
    };
  }

  it('marks what the account signed as outgoing and the rest as incoming', async () => {
    stubHttp((url) =>
      url.includes('message.sender')
        ? { tx_responses: [sendRow('OUT', 'osmo1abc', 'osmo1other')] }
        : { tx_responses: [sendRow('IN', 'osmo1other', 'osmo1abc')] }
    );

    const result = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    const byHash = Object.fromEntries(result.map((entry) => [entry.hash, entry.direction]));
    expect(byHash).toEqual({ OUT: 'out', IN: 'in' });
  });

  it('calls a transaction found by both queries outgoing', async () => {
    // Delegating withdraws rewards to the delegator in the same transaction, so
    // the recipient query matches something the account itself sent.
    stubHttp(() => ({ tx_responses: [sendRow('BOTH', 'osmo1abc', 'osmo1abc')] }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.direction).toBe('out');
  });

  it('reads the coin out of a send', async () => {
    stubHttp(() => ({ tx_responses: [sendRow('AMT', 'osmo1abc', 'osmo1other')] }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.amount).toBe('2500000');
    expect(entry.denom).toBe('uosmo');
  });

  it('reads the single coin the staking messages carry', async () => {
    stubHttp(() => ({
      tx_responses: [
        {
          txhash: 'DEL',
          height: '1',
          code: 0,
          tx: {
            body: {
              messages: [
                {
                  '@type': '/cosmos.staking.v1beta1.MsgDelegate',
                  amount: { denom: 'uosmo', amount: '900' },
                },
              ],
            },
          },
        },
      ],
    }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry).toMatchObject({ amount: '900', denom: 'uosmo', label: 'Delegate' });
  });

  it('reads the coin an IBC transfer calls a token', async () => {
    stubHttp(() => ({
      tx_responses: [
        {
          txhash: 'IBC',
          height: '1',
          code: 0,
          tx: {
            body: {
              messages: [
                { '@type': '/ibc.applications.transfer.v1.MsgTransfer', token: { denom: 'uatom', amount: '5' } },
              ],
            },
          },
        },
      ],
    }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry).toMatchObject({ amount: '5', denom: 'uatom', label: 'IBC transfer' });
  });

  it('leaves an unmapped message type under its protobuf name', async () => {
    stubHttp(() => ({ tx_responses: [txRow('X', '1', '/osmosis.gamm.v1beta1.MsgSwapExactAmountIn')] }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.label).toBe('MsgSwapExactAmountIn');
    expect(entry.amount).toBe('');
  });

  it('counts the messages, so a batch is not shown as a single action', async () => {
    stubHttp(() => ({
      tx_responses: [
        {
          txhash: 'BATCH',
          height: '1',
          code: 0,
          tx: {
            body: {
              messages: [
                { '@type': '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward' },
                { '@type': '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward' },
                { '@type': '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward' },
              ],
            },
          },
        },
      ],
    }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.messageCount).toBe(3);
    expect(entry.label).toBe('Claim rewards');
  });
});

describe('naming a transaction made of several messages', () => {
  function multi(hash: string, types: string[]) {
    return {
      txhash: hash,
      height: '1',
      code: 0,
      tx: { body: { messages: types.map((type) => ({ '@type': type })) } },
    };
  }

  it('skips the IBC plumbing and names the message that moved something', async () => {
    // What an incoming IBC transfer actually looks like on the wire.
    stubHttp(() => ({
      tx_responses: [
        multi('IBCIN', ['/ibc.core.client.v1.MsgUpdateClient', '/ibc.core.channel.v1.MsgRecvPacket']),
      ],
    }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.kind).toBe('MsgRecvPacket');
    expect(entry.label).toBe('IBC receive');
    // Still two messages: the row names one, it does not hide the other.
    expect(entry.messageCount).toBe(2);
  });

  it('keeps naming a transaction that is only plumbing', async () => {
    stubHttp(() => ({ tx_responses: [multi('REL', ['/ibc.core.client.v1.MsgUpdateClient'])] }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry.label).toBe('MsgUpdateClient');
  });

  it('takes the coin from the message it named, not from the first one', async () => {
    stubHttp(() => ({
      tx_responses: [
        {
          txhash: 'MIX',
          height: '1',
          code: 0,
          tx: {
            body: {
              messages: [
                { '@type': '/ibc.core.client.v1.MsgUpdateClient' },
                {
                  '@type': '/cosmos.bank.v1beta1.MsgSend',
                  amount: [{ denom: 'uosmo', amount: '4200' }],
                },
              ],
            },
          },
        },
      ],
    }));

    const [entry] = await fetchCosmosTransactions(historyChain, 'osmo1abc');
    expect(entry).toMatchObject({ label: 'Send', amount: '4200', denom: 'uosmo' });
  });
});
