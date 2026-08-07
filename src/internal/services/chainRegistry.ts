import { useInternalLumen } from '../../composables/useInternalLumen';
import { buildAbsoluteUrl, fetchAbsoluteJson, trimTrailingSlash } from './httpJson';
import { STORAGE_KEYS, readString, writeJson } from './storage';
import type {
  ChainRegistryBundle,
  DenomTrace,
  StoredChainRegistryCache,
} from '../../types/walletPage';

/**
 * The Cosmos chain registry, and what an IBC denom actually is.
 *
 * This owns its caches rather than being handed them - which is why it can
 * leave the page at all. Neither cache is Vue state: one is a Map of in-flight
 * promises so two callers asking at once make one request, the other is
 * localStorage so a restart does not re-download every chain's assets.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Keyed by promise, not by result: concurrent callers share one request. */
const bundleRequests = new Map<string, Promise<ChainRegistryBundle>>();
const denomTraces = new Map<string, DenomTrace | null>();

export function buildChainRegistryRawUrl(chainRegistryName: string, fileName: string): string {
  return `https://raw.githubusercontent.com/cosmos/chain-registry/master/${encodeURIComponent(chainRegistryName)}/${fileName}`;
}

function readStorageCache(): StoredChainRegistryCache {
  try {
    const raw = readString(STORAGE_KEYS.chainRegistryCache);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStorageCache(next: StoredChainRegistryCache) {
  try {
    writeJson(STORAGE_KEYS.chainRegistryCache, next);
  } catch {
    // Ignore storage quota or serialization errors.
  }
}

/**
 * `allowStale` is how a failed refresh still shows something: yesterday's
 * asset list beats an empty screen when the registry is unreachable.
 */
function getStoredBundle(
  chainRegistryName: string,
  { allowStale = false }: { allowStale?: boolean } = {}
): ChainRegistryBundle | null {
  const entry = readStorageCache()[String(chainRegistryName || '').trim()];
  if (!entry) return null;

  const age = Date.now() - Number(entry.updatedAt || 0);
  const isFresh = Number.isFinite(age) && age >= 0 && age <= CACHE_TTL_MS;
  if (!isFresh && !allowStale) return null;

  return { chain: entry.chain || null, assets: Array.isArray(entry.assets) ? entry.assets : [] };
}

function persistBundle(chainRegistryName: string, bundle: ChainRegistryBundle) {
  const key = String(chainRegistryName || '').trim();
  if (!key) return;

  const cache = readStorageCache();
  cache[key] = {
    updatedAt: Date.now(),
    chain: bundle.chain || null,
    assets: Array.isArray(bundle.assets) ? bundle.assets : []
  };
  writeStorageCache(cache);
}

/**
 * A chain's description and asset list.
 *
 * An empty result is dropped from the in-flight map rather than cached, so a
 * chain that failed to load is retried next time instead of staying empty for
 * the life of the session.
 */
export async function loadChainRegistryBundle(chainRegistryName: string): Promise<ChainRegistryBundle> {
  const key = String(chainRegistryName || '').trim();
  if (!key) return { chain: null, assets: [] };

  if (!bundleRequests.has(key)) {
    bundleRequests.set(
      key,
      (async () => {
        const fresh = getStoredBundle(key);
        if (fresh) return fresh;

        const fallbackToStale = () => {
          const stale = getStoredBundle(key, { allowStale: true }) || { chain: null, assets: [] };
          if (!stale.chain && !stale.assets.length) bundleRequests.delete(key);
          return stale;
        };

        try {
          const [chain, assetList] = await Promise.all([
            fetchAbsoluteJson(buildChainRegistryRawUrl(key, 'chain.json'), 10000).catch(() => null),
            fetchAbsoluteJson(buildChainRegistryRawUrl(key, 'assetlist.json'), 10000).catch(() => null)
          ]);

          const bundle: ChainRegistryBundle = {
            chain: chain || null,
            assets: Array.isArray(assetList?.assets) ? assetList.assets : []
          };

          if (bundle.chain || bundle.assets.length) {
            persistBundle(key, bundle);
            return bundle;
          }
          return fallbackToStale();
        } catch {
          return fallbackToStale();
        }
      })()
    );
  }

  return bundleRequests.get(key)!;
}

/** SVG before PNG, and the newer `images` shape before the legacy `logo_URIs`. */
export function pickPreferredRegistryImage(entry: any): string {
  const images = Array.isArray(entry?.images) ? entry.images : [];
  for (const image of images) {
    const svg = String(image?.svg || '').trim();
    if (svg) return svg;
    const png = String(image?.png || '').trim();
    if (png) return png;
  }

  const logos = entry?.logo_URIs || entry?.logo_uris;
  return String(logos?.svg || '').trim() || String(logos?.png || '').trim() || '';
}

/**
 * The icon for a denom, falling back to the chain's own when the asset is not
 * listed - an unknown token from a known chain still gets a recognisable mark.
 */
export async function resolveChainRegistryIconUrl(
  chainRegistryName: string | undefined,
  rawDenom: string,
  trace: DenomTrace | null
): Promise<string> {
  const registryName = String(chainRegistryName || '').trim();
  if (!registryName) return '';

  try {
    const bundle = await loadChainRegistryBundle(registryName);
    const wanted = new Set(
      [String(trace?.baseDenom || '').trim(), String(rawDenom || '').trim()]
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    );

    for (const asset of bundle.assets) {
      const denoms = Array.isArray(asset?.denom_units)
        ? asset.denom_units.map((unit: any) => String(unit?.denom || '').trim().toLowerCase())
        : [];
      const keys = new Set([String(asset?.base || '').trim().toLowerCase(), ...denoms].filter(Boolean));
      if ([...wanted].some((candidate) => keys.has(candidate))) {
        const image = pickPreferredRegistryImage(asset);
        if (image) return image;
      }
    }

    return pickPreferredRegistryImage(bundle.chain);
  } catch {
    return '';
  }
}

/**
 * Forget every resolved trace, so a user-requested refresh re-asks the chain
 * rather than replaying what failed - including the nulls cached below.
 */
export function clearDenomTraceCache() {
  denomTraces.clear();
}

/**
 * What an `ibc/<hash>` denom is underneath: the original denom and the path it
 * travelled. Null for anything that is not an IBC denom.
 *
 * Failures are cached as null on purpose - a hash that cannot be resolved will
 * not resolve on the next render either, and this is called per balance row.
 */
export async function resolveDenomTrace(
  restEndpoint: string,
  denom: string,
  { isLocal = false }: { isLocal?: boolean } = {}
): Promise<DenomTrace | null> {
  const rawDenom = String(denom || '').trim();
  if (!rawDenom || !rawDenom.toUpperCase().startsWith('IBC/')) return null;

  const hash = rawDenom.slice(4);
  const cacheKey = `${isLocal ? '__local__' : trimTrailingSlash(restEndpoint)}|${hash}`;
  if (denomTraces.has(cacheKey)) return denomTraces.get(cacheKey) || null;

  const path = `/ibc/apps/transfer/v1/denom_traces/${encodeURIComponent(hash)}`;
  try {
    let trace: any = null;
    if (isLocal) {
      const net = useInternalLumen()?.net;
      if (!net || typeof net.restGet !== 'function') throw new Error('Network API not available.');
      const res = await net.restGet(path, { timeout: 10000 });
      if (!res || res.ok === false) throw new Error(String(res?.error || 'Failed to resolve denom trace.'));
      trace = res?.json?.denom_trace || res?.json?.denomTrace || null;
    } else {
      const json = await fetchAbsoluteJson(buildAbsoluteUrl(restEndpoint, path), 10000);
      trace = json?.denom_trace || json?.denomTrace || null;
    }

    const resolved: DenomTrace | null = trace
      ? {
          baseDenom: String(trace?.base_denom || trace?.baseDenom || '').trim(),
          path: String(trace?.path || '').trim()
        }
      : null;
    denomTraces.set(cacheKey, resolved);
    return resolved;
  } catch {
    denomTraces.set(cacheKey, null);
    return null;
  }
}
