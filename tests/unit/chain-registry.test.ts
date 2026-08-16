import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildChainRegistryRawUrl,
  clearChainRegistryCache,
  clearDenomTraceCache,
  loadChainRegistryBundle,
  pickPreferredRegistryImage,
  resolveChainRegistryIconUrl,
  resolveDenomTrace,
} from '../../src/internal/services/chainRegistry';
import { STORAGE_KEYS } from '../../src/internal/services/storage';

/**
 * The Cosmos chain registry, and what an `ibc/<hash>` denom actually is.
 *
 * This owns its two caches, which is what let it leave WalletPage at all, and
 * they cache opposite things on purpose. The in-flight map drops a chain that
 * failed, so a registry blip is retried rather than leaving that chain blank
 * for the session. The denom-trace map keeps its nulls, because it is called
 * once per balance row and a hash that did not resolve will not resolve on the
 * next render either.
 */

const BUNDLE_CACHE_KEY = STORAGE_KEYS.chainRegistryCache;

function bridge(net?: unknown) {
  (window as any).lumen = net ? { net } : {};
}

/** Answers the two registry files, per chain name. */
function stubRegistry(handler: (url: string) => unknown) {
  const get = vi.fn(async (url: string) => {
    const body = handler(url);
    if (body === undefined) return { ok: false, status: 404 };
    return { ok: true, json: body };
  });
  (window as any).lumen = { http: { get } };
  return get;
}

function seedCache(name: string, entry: unknown) {
  localStorage.setItem(BUNDLE_CACHE_KEY, JSON.stringify({ [name]: entry }));
}

beforeEach(() => {
  localStorage.clear();
  clearDenomTraceCache();
  // Both caches are module-level singletons that outlive a test file, so
  // without this every case after the first would be served the previous
  // one's in-flight promise.
  clearChainRegistryCache();
});

afterEach(() => {
  delete (window as any).lumen;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildChainRegistryRawUrl', () => {
  it('points at the chain’s own folder', () => {
    expect(buildChainRegistryRawUrl('osmosis', 'chain.json'))
      .toBe('https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/chain.json');
  });

  it('escapes a name that would otherwise change the path', () => {
    expect(buildChainRegistryRawUrl('../secrets', 'chain.json')).not.toContain('../');
  });
});

describe('pickPreferredRegistryImage', () => {
  it('prefers SVG over PNG', () => {
    expect(pickPreferredRegistryImage({ images: [{ svg: 'a.svg', png: 'a.png' }] })).toBe('a.svg');
  });

  it('takes the PNG when there is no SVG', () => {
    expect(pickPreferredRegistryImage({ images: [{ png: 'a.png' }] })).toBe('a.png');
  });

  it('prefers the newer images shape over the legacy logo_URIs', () => {
    const entry = { images: [{ svg: 'new.svg' }], logo_URIs: { svg: 'old.svg' } };
    expect(pickPreferredRegistryImage(entry)).toBe('new.svg');
  });

  it('falls back to logo_URIs, under either spelling', () => {
    expect(pickPreferredRegistryImage({ logo_URIs: { png: 'old.png' } })).toBe('old.png');
    expect(pickPreferredRegistryImage({ logo_uris: { svg: 'old.svg' } })).toBe('old.svg');
  });

  it('gives an empty string when there is no image at all', () => {
    expect(pickPreferredRegistryImage({})).toBe('');
    expect(pickPreferredRegistryImage(null)).toBe('');
    expect(pickPreferredRegistryImage({ images: [] })).toBe('');
  });
});

describe('loadChainRegistryBundle', () => {
  it('serves a fresh cache entry without asking the network', async () => {
    seedCache('osmosis', { updatedAt: Date.now(), chain: { chain_name: 'osmosis' }, assets: [] });
    const get = stubRegistry(() => undefined);
    const bundle = await loadChainRegistryBundle('osmosis');
    expect(bundle.chain).toMatchObject({ chain_name: 'osmosis' });
    expect(get).not.toHaveBeenCalled();
  });

  it('ignores an entry older than a day and refetches', async () => {
    seedCache('juno', {
      updatedAt: Date.now() - 25 * 60 * 60 * 1000,
      chain: { chain_name: 'stale' },
      assets: [],
    });
    stubRegistry((url) => (url.includes('chain.json') ? { chain_name: 'fresh' } : { assets: [] }));
    const bundle = await loadChainRegistryBundle('juno');
    expect(bundle.chain).toMatchObject({ chain_name: 'fresh' });
  });

  it('falls back to a stale entry when the registry is unreachable', async () => {
    // Yesterday's asset list beats an empty screen.
    seedCache('akash', {
      updatedAt: Date.now() - 48 * 60 * 60 * 1000,
      chain: { chain_name: 'akash' },
      assets: [{ base: 'uakash' }],
    });
    stubRegistry(() => undefined);
    const bundle = await loadChainRegistryBundle('akash');
    expect(bundle.chain).toMatchObject({ chain_name: 'akash' });
    expect(bundle.assets).toHaveLength(1);
  });

  it('shares one request between concurrent callers', async () => {
    const get = stubRegistry((url) => (url.includes('chain.json') ? { chain_name: 'x' } : { assets: [] }));
    await Promise.all([
      loadChainRegistryBundle('shared'),
      loadChainRegistryBundle('shared'),
      loadChainRegistryBundle('shared'),
    ]);
    // Two files, once - not two files three times.
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('retries a chain that came back empty, rather than caching the emptiness', async () => {
    // A registry blip must not leave that chain blank for the whole session.
    let attempts = 0;
    (window as any).lumen = {
      http: {
        get: vi.fn(async (url: string) => {
          attempts += 1;
          if (attempts <= 2) return { ok: false, status: 500 };
          return { ok: true, json: url.includes('chain.json') ? { chain_name: 'late' } : { assets: [] } };
        }),
      },
    };
    expect(await loadChainRegistryBundle('flaky')).toEqual({ chain: null, assets: [] });
    expect((await loadChainRegistryBundle('flaky')).chain).toMatchObject({ chain_name: 'late' });
  });

  it('answers an empty bundle for no chain name, without asking anything', async () => {
    const get = stubRegistry(() => undefined);
    expect(await loadChainRegistryBundle('')).toEqual({ chain: null, assets: [] });
    expect(await loadChainRegistryBundle('   ')).toEqual({ chain: null, assets: [] });
    expect(get).not.toHaveBeenCalled();
  });

  it('survives a corrupted cache', async () => {
    localStorage.setItem(BUNDLE_CACHE_KEY, '{not json');
    stubRegistry((url) => (url.includes('chain.json') ? { chain_name: 'ok' } : { assets: [] }));
    expect((await loadChainRegistryBundle('corrupt')).chain).toMatchObject({ chain_name: 'ok' });
  });
});

describe('resolveChainRegistryIconUrl', () => {
  const assets = [
    { base: 'uosmo', denom_units: [{ denom: 'uosmo' }, { denom: 'osmo' }], images: [{ svg: 'osmo.svg' }] },
  ];

  it('finds the asset by its base denom', async () => {
    seedCache('osmosis', { updatedAt: Date.now(), chain: { images: [{ svg: 'chain.svg' }] }, assets });
    await expect(resolveChainRegistryIconUrl('osmosis', 'uosmo', null)).resolves.toBe('osmo.svg');
  });

  it('finds it by a display unit too', async () => {
    seedCache('osmosis', { updatedAt: Date.now(), chain: null, assets });
    await expect(resolveChainRegistryIconUrl('osmosis', 'OSMO', null)).resolves.toBe('osmo.svg');
  });

  it('matches on the traced base denom for an IBC token', async () => {
    seedCache('osmosis', { updatedAt: Date.now(), chain: null, assets });
    const trace = { baseDenom: 'uosmo', path: 'transfer/channel-0' };
    await expect(resolveChainRegistryIconUrl('osmosis', 'ibc/ABC123', trace)).resolves.toBe('osmo.svg');
  });

  it('falls back to the chain’s own mark for a token it does not list', async () => {
    // An unknown token from a known chain still gets something recognisable.
    seedCache('osmosis', { updatedAt: Date.now(), chain: { images: [{ svg: 'chain.svg' }] }, assets });
    await expect(resolveChainRegistryIconUrl('osmosis', 'unknown', null)).resolves.toBe('chain.svg');
  });

  it('gives an empty string with no chain to look in', async () => {
    await expect(resolveChainRegistryIconUrl('', 'uosmo', null)).resolves.toBe('');
    await expect(resolveChainRegistryIconUrl(undefined, 'uosmo', null)).resolves.toBe('');
  });
});

describe('resolveDenomTrace', () => {
  it('ignores anything that is not an IBC denom', async () => {
    bridge();
    for (const denom of ['ulmn', 'uosmo', '', 'ibcnotslash']) {
      await expect(resolveDenomTrace('https://rest.test', denom)).resolves.toBeNull();
    }
  });

  it('resolves through the local node when asked to', async () => {
    // Args declared so the call tuple below is indexable rather than empty.
    const restGet = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      json: { denom_trace: { base_denom: 'uosmo', path: 'transfer/channel-0' } },
    }));
    bridge({ restGet });
    await expect(resolveDenomTrace('', 'ibc/ABC', { isLocal: true }))
      .resolves.toEqual({ baseDenom: 'uosmo', path: 'transfer/channel-0' });
    expect(restGet.mock.calls[0][0]).toContain('/denom_traces/ABC');
  });

  it('reads either spelling the endpoint may answer with', async () => {
    bridge({ restGet: async () => ({ ok: true, json: { denomTrace: { baseDenom: 'uatom', path: 'p' } } }) });
    await expect(resolveDenomTrace('', 'ibc/CAMEL', { isLocal: true }))
      .resolves.toEqual({ baseDenom: 'uatom', path: 'p' });
  });

  it('is case-insensitive about the IBC prefix', async () => {
    bridge({ restGet: async () => ({ ok: true, json: { denom_trace: { base_denom: 'u', path: 'p' } } }) });
    await expect(resolveDenomTrace('', 'IBC/ABC', { isLocal: true })).resolves.not.toBeNull();
  });

  it('answers a repeat from cache instead of asking again', async () => {
    const restGet = vi.fn(async () => ({ ok: true, json: { denom_trace: { base_denom: 'u', path: 'p' } } }));
    bridge({ restGet });
    await resolveDenomTrace('', 'ibc/SAME', { isLocal: true });
    await resolveDenomTrace('', 'ibc/SAME', { isLocal: true });
    expect(restGet).toHaveBeenCalledTimes(1);
  });

  it('caches the failure too, because this runs once per balance row', async () => {
    const restGet = vi.fn(async () => ({ ok: false, error: 'not found' }));
    bridge({ restGet });
    await expect(resolveDenomTrace('', 'ibc/BAD', { isLocal: true })).resolves.toBeNull();
    await expect(resolveDenomTrace('', 'ibc/BAD', { isLocal: true })).resolves.toBeNull();
    expect(restGet).toHaveBeenCalledTimes(1);
  });

  it('can be cleared, which is what a manual refresh needs', async () => {
    const restGet = vi.fn(async () => ({ ok: false }));
    bridge({ restGet });
    await resolveDenomTrace('', 'ibc/X', { isLocal: true });
    clearDenomTraceCache();
    await resolveDenomTrace('', 'ibc/X', { isLocal: true });
    expect(restGet).toHaveBeenCalledTimes(2);
  });

  it('has a matching clear for the registry bundles', async () => {
    // A forced refresh used to clear the traces only, so a chain whose assets
    // had failed stayed blank until restart - for the person who pressed
    // refresh because it was blank.
    const get = vi.fn(async (url: string) => ({
      ok: true, json: url.includes('chain.json') ? { chain_name: 'x' } : { assets: [] },
    }));
    (window as any).lumen = { http: { get } };
    await loadChainRegistryBundle('clearable');
    clearChainRegistryCache();
    await loadChainRegistryBundle('clearable');
    expect(get).toHaveBeenCalledTimes(4);
  });

  it('keys the cache per endpoint, so two chains do not share an answer', async () => {
    const get = vi.fn(async () => ({ ok: true, json: { denom_trace: { base_denom: 'u', path: 'p' } } }));
    (window as any).lumen = { http: { get } };
    await resolveDenomTrace('https://a.test', 'ibc/SAME');
    await resolveDenomTrace('https://b.test', 'ibc/SAME');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('returns null rather than throwing when the local bridge is missing', async () => {
    bridge();
    await expect(resolveDenomTrace('', 'ibc/ABC', { isLocal: true })).resolves.toBeNull();
  });
});
