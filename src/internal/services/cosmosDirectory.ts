import { t } from '../../stores/i18nStore';
import lumenLogoUrl from '../../img/logo.png';
import bundledChains from '../../data/cosmosChains.json';
import { fetchAbsoluteJson, trimTrailingSlash } from './httpJson';
import { STORAGE_KEYS, profileScopedKey, readJson, readString, writeJson } from './storage';
import { pickPreferredRegistryImage, resolveDenomTrace } from './chainRegistry';
import { loadLumenNetwork } from './lumenNetwork';
import type { LumenNetwork } from '../../types/lumenNetwork';
import type {
  CosmosChainBalance,
  CosmosDelegation,
  CosmosChainSummary,
  CosmosExplorer,
  CosmosIbcPeer,
  CosmosProposal,
  CosmosResolvedDenom,
  CosmosStakingSummary,
  CosmosTransaction,
  CosmosUnbondingEntry,
  CosmosValidator,
  RawIbcChannel,
  StoredCosmosChains,
} from '../../types/walletPage';

/**
 * The Cosmos chain directory: every chain the registry knows, in one request.
 *
 * `chainRegistry.ts` next door fetches one named chain at a time from GitHub
 * raw, which is right for "what does this denom look like" and wrong for "show
 * me everything". Two reasons this does not extend it:
 *
 *  - Volume. The registry repository is ~240 MB of git; the per-chain files are
 *    hundreds of separate requests. GitHub's unauthenticated API allows 60 an
 *    hour, so a fan-out over the directory would rate-limit a user before the
 *    list finished drawing.
 *  - Liveness. chains.cosmos.directory is built from the same registry but also
 *    health-checks the endpoints it republishes, so `best_apis` is a list that
 *    was reachable recently rather than a list someone once committed. Dead
 *    endpoints are the main way a multi-chain view rots.
 *
 * One request, ~2 MB, answered in well under a second. What is kept is far
 * smaller: see the trim in `toSummary`.
 */

const DIRECTORY_URL = 'https://chains.cosmos.directory';

/** A day. The registry moves in days, not minutes; nothing here is a price. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 20000;
const BALANCE_TIMEOUT_MS = 8000;

/** Concurrent callers share one request, as in chainRegistry.ts. */
let directoryRequest: Promise<CosmosChainSummary[]> | null = null;

/** The home chain, pinned to the top of its own browser. */
const HOME_CHAIN_NAME = 'lumen';

/**
 * The directory does not publish an image for Lumen - 14 of the 221 entries
 * have none - so the browser's own bundled mark is used instead of leaving the
 * home chain as a grey initial. The registry does carry `lumen/images/lmn.png`,
 * but reaching for it would be a second network request for an asset already
 * shipped in the build.
 */
const HOME_CHAIN_IMAGE = lumenLogoUrl;

/**
 * The home chain, described by the app rather than by the registry.
 *
 * chains.cosmos.directory only knows mainnet Lumen, and every read in this file
 * goes to `chain.rest[0]`. So while `lumen://network` followed peers.txt onto
 * the testnet, the wallet panel kept reading balances, staking and governance
 * off the mainnet endpoints the registry publishes - the same account, the
 * wrong chain, and nothing on screen saying so.
 *
 * The registry entry is still what the image, the price feed and the explorer
 * links come from, because none of those exist for a testnet. What it must not
 * decide is where to send a query or which chain id a transaction is signed
 * for; those come from the active network.
 *
 * Applied on read rather than folded into the stored directory on purpose: the
 * cache stays the registry's own answer, so switching back to mainnet does not
 * depend on it being refetched.
 */
function homeChainSummary(
  registryEntry: CosmosChainSummary | undefined,
  network: LumenNetwork
): CosmosChainSummary {
  const isMainnet = network.id === 'mainnet';

  return {
    ...(registryEntry as CosmosChainSummary),
    name: HOME_CHAIN_NAME,
    prettyName: network.prettyName || registryEntry?.prettyName || 'Lumen',
    // What the nodes answer, when they have answered: a devnet gets a new chain
    // id every redeploy, and a signature made against a stale one is refused.
    chainId: network.observedChainId || network.chainId,
    prefix: network.prefix,
    status: 'live',
    networkType: network.id,
    symbol: network.symbol,
    denom: network.denom,
    decimals: network.decimals,
    image: registryEntry?.image || HOME_CHAIN_IMAGE,
    rest: network.rest,
    rpc: network.rpc,
    website: network.website || registryEntry?.website || '',
    // Everything below describes mainnet and only mainnet. Carrying a price or
    // an APR across to a testnet would put a dollar value on play money.
    height: isMainnet ? registryEntry?.height ?? null : null,
    priceUsd: isMainnet ? registryEntry?.priceUsd ?? null : null,
    coingeckoId: isMainnet ? registryEntry?.coingeckoId || '' : '',
    apr: isMainnet ? registryEntry?.apr ?? null : null,
    unbondingSeconds: isMainnet ? registryEntry?.unbondingSeconds ?? null : null,
    blockTime: isMainnet ? registryEntry?.blockTime ?? null : null,
    explorers: isMainnet ? registryEntry?.explorers || [] : []
  };
}

/** Replaces the registry's Lumen with the active network's. */
function applyHomeChain(
  chains: CosmosChainSummary[],
  network: LumenNetwork
): CosmosChainSummary[] {
  const home = homeChainSummary(
    chains.find((chain) => chain.name === HOME_CHAIN_NAME),
    network
  );
  const others = chains.filter((chain) => chain.name !== HOME_CHAIN_NAME);
  return sortCosmosChains([home, ...others]);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

/** Endpoint entries arrive as `{ address }` objects or bare strings. */
function readEndpoints(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of list) {
    const address = trimTrailingSlash(
      firstString(typeof entry === 'string' ? entry : (entry as any)?.address)
    );
    if (!address || seen.has(address)) continue;
    seen.add(address);
    out.push(address);
  }
  return out;
}

/**
 * A denom that may arrive as a string or as a `{ denom, exponent }` object.
 *
 * The aggregated directory and the raw registry disagree on this: the registry
 * writes `"display": "acre"`, the directory resolves it to the denom unit it
 * points at and sends the whole object. Reading it as a string produced
 * "[object Object]" for a third of the chains.
 */
function readDenom(value: unknown): string {
  if (value && typeof value === 'object') return firstString((value as any).denom);
  return firstString(value);
}

/**
 * The staking token's exponent, which is what turns `aacre` into `ACRE`.
 *
 * Order matters. The chain's own `decimals` is authoritative and present for
 * every entry; the asset shapes below are fallbacks for the raw-registry form.
 * Getting this wrong is not cosmetic - reading 18 as 6 renders a balance a
 * trillion times too large, which is how a wallet tells someone they are rich.
 *
 * Defaults to 6 only when nothing declares anything: of the two possible
 * errors, understating a balance is the safer one to show.
 */
function readDecimals(entry: any, asset: any): number {
  for (const candidate of [entry?.decimals, asset?.decimals]) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) return value;
  }

  const units = Array.isArray(asset?.denom_units) ? asset.denom_units : [];
  const display = readDenom(asset?.display);
  for (const unit of units) {
    if (firstString(unit?.denom) === display) {
      const exponent = Number(unit?.exponent);
      if (Number.isFinite(exponent) && exponent >= 0) return exponent;
    }
  }
  return 6;
}

/** A finite number, or null - so "absent" and "zero" stay distinguishable. */
function readNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A few explorers, not all of them.
 *
 * Some chains list a dozen; past the first handful this is a directory of
 * third parties rather than a way to look something up, and every one of them
 * is bytes in localStorage for all 221 chains.
 */
function readExplorers(list: unknown): CosmosExplorer[] {
  if (!Array.isArray(list)) return [];
  const out: CosmosExplorer[] = [];
  for (const entry of list) {
    const url = firstString((entry as any)?.url);
    if (!url) continue;
    out.push({
      kind: firstString((entry as any)?.kind, new URL(url).hostname),
      url,
      accountPage: firstString((entry as any)?.account_page)
    });
    if (out.length === 5) break;
  }
  return out;
}

/**
 * One directory entry, reduced to the fields the panel draws.
 *
 * Returns null for anything without a name or a chain id - an entry that
 * cannot be identified cannot be queried either, and a row that does nothing
 * is worse than an absent one.
 */
function toSummary(entry: any): CosmosChainSummary | null {
  const name = firstString(entry?.chain_name, entry?.name, entry?.path);
  const chainId = firstString(entry?.chain_id);
  if (!name || !chainId) return null;

  const asset = Array.isArray(entry?.assets) ? entry.assets[0] : null;
  const apis = entry?.best_apis || entry?.apis || {};
  const image = firstString(
    entry?.image,
    pickPreferredRegistryImage(asset),
    pickPreferredRegistryImage(entry)
  );

  return {
    name,
    prettyName: firstString(entry?.pretty_name, entry?.prettyName, name),
    chainId,
    prefix: firstString(entry?.bech32_prefix),
    status: firstString(entry?.status, 'unknown'),
    networkType: firstString(entry?.network_type, 'mainnet'),
    symbol: firstString(entry?.symbol, asset?.symbol).toUpperCase(),
    denom: firstString(entry?.denom, readDenom(asset?.base)),
    decimals: readDecimals(entry, asset),
    image: name === HOME_CHAIN_NAME ? image || HOME_CHAIN_IMAGE : image,
    rest: readEndpoints(apis?.rest),
    rpc: readEndpoints(apis?.rpc),
    height: readNumber(entry?.height),
    priceUsd: readNumber(asset?.prices?.coingecko?.usd),
    website: firstString(entry?.website),
    coingeckoId: firstString(entry?.coingecko_id, asset?.coingecko_id),
    apr: readNumber(entry?.params?.calculated_apr ?? entry?.params?.estimated_apr),
    unbondingSeconds: readNumber(entry?.params?.unbonding_time),
    blockTime: readNumber(entry?.params?.actual_block_time),
    explorers: readExplorers(entry?.explorers)
  };
}

/**
 * Which chains each chain has a registered IBC path to.
 *
 * The registry keeps one file per pair under `_IBC`, named `<a>-<b>.json`, so
 * the names alone answer the question and the 790 file bodies never need
 * fetching. One call to the git tree API returns the whole listing; what is
 * kept is an index of name to counterparties, a few kilobytes rather than the
 * 230 KB listing.
 *
 * That API allows 60 calls an hour unauthenticated, which is why this is
 * cached for a day and why a failure is silent: IBC peers are a detail on one
 * panel, not something worth an error over.
 */
const IBC_TREE_URL =
  'https://api.github.com/repos/cosmos/chain-registry/contents/_IBC?ref=master';

let ibcIndexRequest: Promise<Record<string, string[]>> | null = null;

function buildIbcIndex(fileNames: string[]): Record<string, string[]> {
  const index: Record<string, Set<string>> = {};
  for (const fileName of fileNames) {
    const base = String(fileName || '').replace(/\.json$/i, '');
    // Chain names contain hyphens, so the split point is not "the hyphen":
    // `gravity-bridge-osmosis` is one pair, not two candidates worth guessing
    // between. Every cut is indexed and `resolveIbcPeers` keeps only the ones
    // naming a chain we know, which discards the rest.
    //
    // Across the 790 pairs the registry publishes today, no file has two cuts
    // that both name real chains, so this resolves exactly. The defensive shape
    // is kept because a future chain name could introduce one.
    const parts = base.split('-');
    for (let cut = 1; cut < parts.length; cut += 1) {
      const a = parts.slice(0, cut).join('-');
      const b = parts.slice(cut).join('-');
      if (!a || !b) continue;
      (index[a] ||= new Set()).add(b);
      (index[b] ||= new Set()).add(a);
    }
  }
  return Object.fromEntries(Object.entries(index).map(([key, set]) => [key, [...set]]));
}

/**
 * Forget the IBC index. Separate from the directory's own clear: the two are
 * independent caches with different lifetimes and different failure modes.
 */
export function clearIbcIndexCache() {
  ibcIndexRequest = null;
  try {
    writeJson(STORAGE_KEYS.cosmosIbcIndexCache, { updatedAt: 0, index: {} });
  } catch {
    // Ignore storage errors; the in-memory promise is already cleared.
  }
}

export async function loadIbcIndex(): Promise<Record<string, string[]>> {
  if (!ibcIndexRequest) {
    ibcIndexRequest = (async () => {
      const stored = readJson<{ updatedAt?: number; index?: Record<string, string[]> } | null>(
        STORAGE_KEYS.cosmosIbcIndexCache,
        null
      );
      const age = Date.now() - Number(stored?.updatedAt || 0);
      if (stored?.index && age >= 0 && age <= CACHE_TTL_MS) return stored.index;

      try {
        const listing = await fetchAbsoluteJson(IBC_TREE_URL, REQUEST_TIMEOUT_MS);
        const names = Array.isArray(listing)
          ? listing.map((entry: any) => String(entry?.name || ''))
          : [];

        // An empty listing is a bad response, not a registry without pairs.
        // Caching it would hide every peer for a day; retrying is cheap.
        if (!names.length) {
          ibcIndexRequest = null;
          return stored?.index || {};
        }

        const index = buildIbcIndex(names);
        writeJson(STORAGE_KEYS.cosmosIbcIndexCache, { updatedAt: Date.now(), index });
        return index;
      } catch {
        ibcIndexRequest = null;
        return stored?.index || {};
      }
    })();
  }
  return ibcIndexRequest;
}

/**
 * The chains `chainName` has an IBC path to, resolved to entries we know.
 *
 * The filter is what makes the ambiguous split in `buildIbcIndex` safe: a
 * wrong cut produces a name no chain has, and it is dropped here.
 */
export function resolveIbcPeers(
  index: Record<string, string[]>,
  chainName: string,
  chains: CosmosChainSummary[]
): CosmosIbcPeer[] {
  const byName = new Map(chains.map((chain) => [chain.name, chain]));
  return (index[chainName] || [])
    .map((name) => byName.get(name))
    .filter((chain): chain is CosmosChainSummary => Boolean(chain))
    .map((chain) => ({
      name: chain.name,
      prettyName: chain.prettyName,
      chainId: chain.chainId,
      image: chain.image
    }))
    .sort((a, b) => a.prettyName.localeCompare(b.prettyName));
}

/**
 * Whether a chain can actually do anything when opened.
 *
 * 85 of the 221 entries publish no reachable REST endpoint, which means no
 * balance can ever be read for them. They are kept in the list - the metadata
 * is still worth showing, and their absence would be its own puzzle - but they
 * sink below the chains that work rather than being scattered through them.
 */
export function isChainUsable(chain: CosmosChainSummary): boolean {
  // Defensive about the shape: this runs over data that came out of storage,
  // and a truncated entry there must not take the panel down with it.
  return Array.isArray(chain?.rest) && chain.rest.length > 0 && Boolean(chain?.prefix);
}

/**
 * Home chain first, then everything usable, then what is missing an endpoint.
 *
 * Alphabetical inside each band, so the ordering stays predictable between
 * refreshes and a chain does not move because a health check flapped.
 */
export function sortCosmosChains(chains: CosmosChainSummary[]): CosmosChainSummary[] {
  const rank = (chain: CosmosChainSummary): number => {
    if (chain.name === HOME_CHAIN_NAME) return 0;
    return isChainUsable(chain) ? 1 : 2;
  };

  return [...chains].sort(
    (a, b) => rank(a) - rank(b) || a.prettyName.localeCompare(b.prettyName)
  );
}

/**
 * The chains this profile follows, in the order they were followed.
 *
 * Per profile rather than global: two profiles are two different people as far
 * as this app is concerned, and one's watchlist is not the other's. Stored as
 * registry names, which are the stable identifier here - a chain id can change
 * across an upgrade, the directory name does not.
 */
export function readFollowedChains(profileId: string): string[] {
  const raw = readJson<unknown>(profileScopedKey(STORAGE_KEYS.cosmosFollowedPrefix, profileId), []);
  const seen = new Set<string>();
  // The home chain leads and cannot be dropped: this is its own browser, and a
  // watchlist without it would be a wallet hiding the account it is built on.
  const out: string[] = [HOME_CHAIN_NAME];
  seen.add(HOME_CHAIN_NAME);

  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    const name = String(entry ?? '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function writeFollowedChains(profileId: string, names: string[]): void {
  writeJson(profileScopedKey(STORAGE_KEYS.cosmosFollowedPrefix, profileId), names);
}

/** Adds or removes a chain, returning the new list. The home chain never leaves. */
export function toggleFollowedChain(profileId: string, chainName: string): string[] {
  const name = String(chainName || '').trim();
  if (!name || name === HOME_CHAIN_NAME) return readFollowedChains(profileId);

  const current = readFollowedChains(profileId);
  const next = current.includes(name)
    ? current.filter((entry) => entry !== name)
    : [...current, name];
  writeFollowedChains(profileId, next);
  return next;
}

/** Whether this chain can be unfollowed at all. */
export function isPinnedChain(chainName: string): boolean {
  return String(chainName || '').trim() === HOME_CHAIN_NAME;
}

/**
 * Whether an entry is shaped well enough to act on.
 *
 * The directory is fetched over TLS from a third party that republishes a
 * public repository - there is no signature to check, and none is published,
 * so the shape is what gets verified instead. An entry with a denom that is
 * not a denom, or an exponent that is not a number, is dropped rather than
 * stored: one malformed chain must not be able to break the panel for the
 * other 220, and a bad exponent is how an amount gets rendered wrong.
 *
 * Deliberately permissive about what is missing and strict about what is
 * wrong. Half the fields here are absent on some chain or another; none of
 * them may hold a value of the wrong kind.
 */
export function isWellFormedChain(chain: unknown): boolean {
  const entry = chain as CosmosChainSummary;
  if (!entry || typeof entry !== 'object') return false;

  const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  const text = (value: unknown) => typeof value === 'string';
  const urls = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string' && /^https?:\/\//i.test(item));

  if (!nonEmpty(entry.name) || !nonEmpty(entry.chainId)) return false;
  if (!text(entry.prettyName) || !text(entry.prefix) || !text(entry.denom)) return false;
  if (!text(entry.symbol) || !text(entry.image) || !text(entry.website)) return false;
  if (!urls(entry.rest) || !urls(entry.rpc)) return false;

  // The exponent decides where the decimal point goes, so a wrong one is not a
  // cosmetic problem. Anything outside what a Cosmos asset can declare is a
  // corrupted entry rather than an unusual one.
  if (!Number.isInteger(entry.decimals) || entry.decimals < 0 || entry.decimals > 24) return false;

  const optionalNumber = (value: unknown) => value === null || Number.isFinite(value as number);
  if (!optionalNumber(entry.priceUsd) || !optionalNumber(entry.apr)) return false;
  if (!optionalNumber(entry.height) || !optionalNumber(entry.blockTime)) return false;
  if (!optionalNumber(entry.unbondingSeconds)) return false;

  return Array.isArray(entry.explorers);
}

/**
 * Folds a fresh directory into what is already stored: adds, updates, never removes.
 *
 * The registry is not a contract. A chain can be dropped from it because it was
 * renamed, because a maintainer tidied up, or because the aggregator had a bad
 * minute and answered with half a list. Mirroring a deletion would take the
 * endpoints and the exponent of a chain out of the user's wallet - and with
 * them, the ability to read a balance they still hold or send a token they
 * still own.
 *
 * So a chain that disappears upstream keeps its last known entry. It stops
 * being updated, which is visible and recoverable; it does not stop working,
 * which would not be.
 */
export function mergeCosmosChains(
  stored: CosmosChainSummary[],
  fresh: CosmosChainSummary[]
): CosmosChainSummary[] {
  const merged = new Map<string, CosmosChainSummary>();
  for (const chain of stored) merged.set(chain.name, chain);
  // Fresh wins field-for-field: a re-listed chain gets today's endpoints, not
  // the ones cached the day it was removed.
  for (const chain of fresh) merged.set(chain.name, chain);
  return sortCosmosChains([...merged.values()]);
}

/**
 * What a merge starts from: what the user has stored, or the copy shipped with
 * the build.
 *
 * The bundled snapshot is checked into the repository, so a fresh install has a
 * complete directory before its first request and an offline one is not an
 * empty screen. It is also the floor the merge can never fall below - a chain
 * present at build time stays reachable whatever the network later answers.
 */
function baseChains(stored: CosmosChainSummary[] | undefined): CosmosChainSummary[] {
  // Stored data is checked as strictly as fetched data: it was written by an
  // older build, or by a quota-truncated write, and neither is trustworthy
  // just because it came from disk.
  const kept = (stored || []).filter(isWellFormedChain);
  const seed = (bundledChains as CosmosChainSummary[]).filter(isWellFormedChain).map((chain) =>
    // The home chain's mark is a build asset, so its URL is decided by the
    // bundler and cannot be written into a checked-in file: the snapshot holds
    // an empty string and it is filled in here.
    chain.name === HOME_CHAIN_NAME ? { ...chain, image: chain.image || HOME_CHAIN_IMAGE } : chain
  );
  return kept.length ? mergeCosmosChains(seed, kept) : seed;
}

function readStoredChains(): StoredCosmosChains | null {
  try {
    const raw = readString(STORAGE_KEYS.cosmosChainsCache);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.chains)) return null;
    return parsed as StoredCosmosChains;
  } catch {
    return null;
  }
}

function writeStoredChains(chains: CosmosChainSummary[]) {
  try {
    writeJson(STORAGE_KEYS.cosmosChainsCache, { updatedAt: Date.now(), chains });
  } catch {
    // A full quota is not worth failing the view over: the list is already in
    // memory for this session, and the next start simply refetches.
  }
}

/** How old the stored copy is, or null when there is none. */
export function getCosmosChainsAge(): number | null {
  const stored = readStoredChains();
  if (!stored) return null;
  const age = Date.now() - Number(stored.updatedAt || 0);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function isFresh(stored: StoredCosmosChains | null): boolean {
  if (!stored) return false;
  const age = Date.now() - Number(stored.updatedAt || 0);
  return Number.isFinite(age) && age >= 0 && age <= CACHE_TTL_MS;
}

/**
 * Every chain in the directory, newest copy that is not older than the TTL.
 *
 * A failed refresh falls back to whatever was stored, however old - the same
 * bargain chainRegistry.ts makes, and for the same reason: yesterday's list of
 * chains is worth far more than an empty screen, and none of this data is
 * time-sensitive enough for staleness to mislead.
 */
export async function loadCosmosChains(
  { force = false }: { force?: boolean } = {}
): Promise<CosmosChainSummary[]> {
  const [chains, network] = await Promise.all([
    loadDirectoryChains({ force }),
    loadLumenNetwork()
  ]);
  return applyHomeChain(chains, network);
}

/** The registry's own answer, untouched, memoized and cached to storage. */
function loadDirectoryChains(
  { force = false }: { force?: boolean } = {}
): Promise<CosmosChainSummary[]> {
  if (force) directoryRequest = null;

  if (!directoryRequest) {
    directoryRequest = (async () => {
      const stored = readStoredChains();
      // Sorted on read as well as on write: a copy cached before the ordering
      // existed would otherwise stay alphabetical until its TTL expired. Folded
      // over the bundled snapshot so a chain shipped with the build is present
      // even for someone whose cache predates it.
      if (!force && isFresh(stored)) return baseChains(stored!.chains);

      try {
        const json = await fetchAbsoluteJson(DIRECTORY_URL, REQUEST_TIMEOUT_MS);
        const raw = Array.isArray(json?.chains) ? json.chains : [];
        const fresh = raw
          .map(toSummary)
          .filter((chain: CosmosChainSummary | null): chain is CosmosChainSummary =>
            Boolean(chain) && isWellFormedChain(chain)
          );

        if (!fresh.length) throw new Error(t('The chain directory came back empty.'));

        const chains = mergeCosmosChains(baseChains(stored?.chains), fresh);
        writeStoredChains(chains);
        return chains;
      } catch (error) {
        // Offline, rate-limited or refused: the bundled snapshot is still a
        // complete directory, so this never falls through to an empty panel.
        const fallback = baseChains(stored?.chains);
        if (fallback.length) return fallback;
        // Nothing cached and nothing fetched: drop the shared promise so the
        // next caller retries rather than replaying this failure all session.
        directoryRequest = null;
        throw error;
      }
    })();
  }

  return directoryRequest;
}

/** Forget the directory, for a user-requested refresh. */
export function clearCosmosChainsCache() {
  directoryRequest = null;
  try {
    writeJson(STORAGE_KEYS.cosmosChainsCache, { updatedAt: 0, chains: [] });
  } catch {
    // Ignore storage errors; the in-memory promise is already cleared.
  }
}

/**
 * Turns `ibc/<hash>` denoms into the assets they actually are.
 *
 * An IBC denom is the SHA-256 of the path a token travelled, so the hash alone
 * says nothing - not the ticker, and not the exponent, which means the amount
 * cannot even be formatted. The chain holding it can say: its transfer module
 * resolves the hash back to a base denom and a path.
 *
 * The base denom is then matched against the directory to recover the ticker,
 * the exponent and where it came from. That match must be unique: four base
 * denoms in the registry are claimed by two chains each (`uluna` by both Terra
 * chains, `basecro` by two Cronos), and for those the amount is left
 * unattributed rather than credited to a coin flip.
 */
export async function resolveIbcDenoms(
  chain: CosmosChainSummary,
  denoms: string[],
  chains: CosmosChainSummary[]
): Promise<Record<string, CosmosResolvedDenom>> {
  const endpoint = chain.rest[0];
  const wanted = denoms.filter((denom) => denom.toLowerCase().startsWith('ibc/')).slice(0, 12);
  if (!endpoint || !wanted.length) return {};

  const byDenom = new Map<string, CosmosChainSummary[]>();
  for (const entry of chains) {
    if (!entry.denom) continue;
    byDenom.set(entry.denom, [...(byDenom.get(entry.denom) || []), entry]);
  }

  const resolved: Record<string, CosmosResolvedDenom> = {};
  const queue = [...wanted];

  const workers = new Array(Math.min(4, queue.length)).fill(null).map(async () => {
    for (let denom = queue.shift(); denom; denom = queue.shift()) {
      try {
        const trace = await resolveDenomTrace(endpoint, denom);
        const base = String(trace?.baseDenom || '').trim();
        if (!base) continue;

        const candidates = byDenom.get(base) || [];
        const origin = candidates.length === 1 ? candidates[0] : null;

        resolved[denom] = {
          // Falling back to the base denom keeps "uatom" on screen rather than
          // a hash, even when the origin chain is unknown or ambiguous.
          symbol: origin?.symbol || base,
          decimals: origin?.decimals ?? 0,
          sourceChain: origin?.prettyName || '',
          image: origin?.image || '',
          sourceName: origin?.name || '',
          path: String(trace?.path || '').trim()
        };
      } catch {
        // A hash that will not resolve stays a hash; the row still draws.
      }
    }
  });
  await Promise.all(workers);

  return resolved;
}

/**
 * In-progress redelegations for an account, as the chain reports them.
 *
 * Cosmos forbids moving stake out of a validator that is itself still
 * receiving one - the transitive-redelegation ban - and refuses the message
 * only at broadcast, after it has been signed. Reading them lets the panel say
 * so before rather than after.
 *
 * Returned raw so `buildRedelegationLocks` next door can interpret them: that
 * function and its lock-expiry rule already exist for the home chain's staking
 * screen, and are tested.
 */
export async function fetchCosmosRedelegations(
  chain: CosmosChainSummary,
  address: string
): Promise<unknown[]> {
  const account = String(address || '').trim();
  if (!account || !chain.rest.length) return [];

  const path = `/cosmos/staking/v1beta1/delegators/${encodeURIComponent(account)}/redelegations`;

  for (const endpoint of chain.rest) {
    try {
      const json = await fetchAbsoluteJson(`${endpoint}${path}`, BALANCE_TIMEOUT_MS);
      return Array.isArray(json?.redelegation_responses) ? json.redelegation_responses : [];
    } catch {
      // Try the next endpoint; a missing lock only costs a late refusal.
    }
  }
  return [];
}

/**
 * The chain's active validators, for picking one to stake with.
 *
 * Bonded only: an unbonded or jailed validator earns nothing, and offering one
 * in a picker is offering a mistake. Capped at 200, which is above every
 * chain's active set in the registry today - the parameter runs 13 to 200.
 *
 * Sorted by stake, because that is the order every explorer and every other
 * wallet presents them in, and an unfamiliar order reads as a different list.
 */
export async function fetchCosmosValidators(
  chain: CosmosChainSummary
): Promise<CosmosValidator[]> {
  if (!chain.rest.length) throw new Error(t('This chain does not publish a REST endpoint.'));

  const path =
    '/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200';
  let lastError: unknown = null;

  for (const endpoint of chain.rest) {
    try {
      const json = await fetchAbsoluteJson(`${endpoint}${path}`, BALANCE_TIMEOUT_MS);
      const raw = Array.isArray(json?.validators) ? json.validators : [];

      return raw
        .map((entry: any) => ({
          address: firstString(entry?.operator_address),
          moniker: firstString(entry?.description?.moniker, entry?.operator_address),
          commission: Number(entry?.commission?.commission_rates?.rate) || 0,
          tokens: firstString(entry?.tokens, '0').split('.')[0],
          jailed: Boolean(entry?.jailed)
        }))
        .filter((entry: CosmosValidator) => entry.address && !entry.jailed)
        .sort((a: CosmosValidator, b: CosmosValidator) =>
          BigInt(b.tokens || '0') > BigInt(a.tokens || '0') ? 1 : -1
        );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(t('No endpoint answered.'));
}

/**
 * The common message types in words.
 *
 * A dozen types cover nearly every transaction an account makes. The rest keep
 * their protobuf name: a chain-specific message has no general translation,
 * and `MsgSwapExactAmountIn` is what its own explorer calls it too.
 */
function describeMessage(kind: string): string {
  switch (kind) {
    case 'MsgSend':
      return t('Send');
    case 'MsgMultiSend':
      return t('Multi-send');
    case 'MsgDelegate':
      return t('Delegate');
    case 'MsgUndelegate':
      return t('Undelegate');
    case 'MsgBeginRedelegate':
      return t('Redelegate');
    case 'MsgWithdrawDelegatorReward':
      return t('Claim rewards');
    case 'MsgWithdrawValidatorCommission':
      return t('Claim commission');
    case 'MsgVote':
    case 'MsgVoteWeighted':
      return t('Vote');
    case 'MsgSubmitProposal':
      return t('Submit proposal');
    case 'MsgDeposit':
      return t('Deposit');
    case 'MsgTransfer':
      return t('IBC transfer');
    case 'MsgRecvPacket':
      return t('IBC receive');
    case 'MsgExec':
      return t('Execute');
    default:
      return kind;
  }
}

/**
 * The coin a message moves, across the three shapes the SDK spells it in.
 *
 * `MsgSend` carries a list, the staking messages a single coin, and the IBC
 * transfer calls it `token`. Anything else moves nothing worth a column.
 */
function readMessageCoin(message: any): { amount: string; denom: string } {
  const coin = Array.isArray(message?.amount)
    ? message.amount[0]
    : message?.amount && typeof message.amount === 'object'
      ? message.amount
      : message?.token;

  return { amount: firstString(coin?.amount), denom: firstString(coin?.denom) };
}

/**
 * Relayer housekeeping, which is never what a transaction was about.
 *
 * An IBC delivery arrives as [MsgUpdateClient, MsgRecvPacket]: naming the row
 * after its first message calls it "MsgUpdateClient", which is light-client
 * bookkeeping and tells the account nothing about the tokens it just received.
 * These are skipped when picking the message that names the row - the count
 * still reports every message, so none of it is hidden.
 */
const PLUMBING_MESSAGES = new Set([
  'MsgUpdateClient',
  'MsgCreateClient',
  'MsgConnectionOpenInit',
  'MsgConnectionOpenTry',
  'MsgConnectionOpenAck',
  'MsgConnectionOpenConfirm',
  'MsgChannelOpenInit',
  'MsgChannelOpenTry',
  'MsgChannelOpenAck',
  'MsgChannelOpenConfirm',
  'MsgAcknowledgement',
  'MsgTimeout'
]);

/** One row of the tx service's answer, or null when it carries no hash. */
function toTransaction(row: any, direction: 'in' | 'out'): CosmosTransaction | null {
  const hash = firstString(row?.txhash, row?.hash);
  if (!hash) return null;

  const messages = Array.isArray(row?.tx?.body?.messages) ? row.tx.body.messages : [];
  // '/cosmos.bank.v1beta1.MsgSend' is what a row is worth reading at a glance.
  const kinds = messages.map((message: any) => firstString(message?.['@type']).split('.').pop() || '');

  // The first message that is not plumbing; failing that, whatever came first,
  // so a transaction made only of plumbing still names itself rather than
  // showing an empty type.
  const named = kinds.findIndex((entry: string) => entry && !PLUMBING_MESSAGES.has(entry));
  const index = named >= 0 ? named : 0;

  const kind = kinds[index] || t('Transaction');
  const coin = readMessageCoin(messages[index]);
  const code = Number(row?.code) || 0;

  return {
    hash,
    height: firstString(row?.height, '0'),
    timestamp: firstString(row?.timestamp),
    kind,
    label: describeMessage(kind),
    direction,
    amount: coin.amount,
    denom: coin.denom,
    messageCount: messages.length || 1,
    code,
    failed: code > 0
  };
}

/**
 * The account's recent transactions on this chain.
 *
 * Two queries rather than one: the tx service indexes a transfer under its
 * sender and under its recipient separately, so asking only `message.sender`
 * hides every incoming payment - which is most of what an account came to see.
 *
 * The parameter carrying the filter was renamed across SDK versions and both
 * spellings are live across the registry, so each is tried in turn. A chain
 * running without a tx index refuses both, and that is a chain with no history
 * to show rather than a failure worth putting in front of anyone: the caller
 * gets an empty list, exactly as it would from an account that never spent.
 */
export async function fetchCosmosTransactions(
  chain: CosmosChainSummary,
  address: string,
  limit = 25
): Promise<CosmosTransaction[]> {
  const account = String(address || '').trim();
  const size = Math.min(100, Math.max(1, limit | 0));
  if (!account || !chain.rest.length) return [];

  /**
   * Which query answered is the direction, which is why the sender runs first.
   *
   * A transaction the account signed can appear under both - delegating
   * withdraws rewards to you in the same transaction, so `transfer.recipient`
   * matches it too. First seen wins, and the signer query having run first
   * makes that the right answer: you sent it, whatever else it also did.
   */
  const filters: { filter: string; direction: 'in' | 'out' }[] = [
    { filter: `message.sender='${account}'`, direction: 'out' },
    { filter: `transfer.recipient='${account}'`, direction: 'in' }
  ];
  const byHash = new Map<string, CosmosTransaction>();

  for (const endpoint of chain.rest) {
    let answered = false;

    for (const { filter, direction } of filters) {
      for (const param of ['query', 'events']) {
        try {
          const url =
            `${endpoint}/cosmos/tx/v1beta1/txs?${param}=${encodeURIComponent(filter)}` +
            `&order_by=ORDER_BY_DESC&pagination.limit=${size}`;
          const json = await fetchAbsoluteJson(url, BALANCE_TIMEOUT_MS);
          const rows = Array.isArray(json?.tx_responses) ? json.tx_responses : [];

          answered = true;
          for (const row of rows) {
            const parsed = toTransaction(row, direction);
            if (parsed && !byHash.has(parsed.hash)) byHash.set(parsed.hash, parsed);
          }
          break;
        } catch {
          // The other spelling of the parameter, then the next endpoint.
        }
      }
    }

    if (answered) break;
  }

  return [...byHash.values()]
    .sort((a, b) => Number(b.height || 0) - Number(a.height || 0))
    .slice(0, size);
}

/** The gov module's status enum in words. */
function describeProposalStatus(status: string): string {
  switch (status) {
    case 'VOTING_PERIOD':
      return t('Voting');
    case 'DEPOSIT_PERIOD':
      return t('Deposit');
    case 'PASSED':
      return t('Passed');
    case 'REJECTED':
      return t('Rejected');
    case 'FAILED':
      return t('Failed');
    default:
      return status;
  }
}

/** One proposal, from either module version, or null without an id. */
function toProposal(entry: any): CosmosProposal | null {
  const id = firstString(entry?.id, entry?.proposal_id);
  if (!id) return null;

  const status = firstString(entry?.status).replace('PROPOSAL_STATUS_', '');

  return {
    id,
    // v1 carries the title at the top level, v1beta1 inside `content`, and a v1
    // proposal wrapping a legacy one carries it in its first message.
    title: firstString(
      entry?.title,
      entry?.content?.title,
      entry?.messages?.[0]?.content?.title,
      `#${id}`
    ),
    status,
    statusLabel: describeProposalStatus(status),
    votingEndsAt: firstString(entry?.voting_end_time)
  };
}

/**
 * The chain's governance proposals, newest first.
 *
 * Two module versions are live across the registry: v1 replaced v1beta1 in SDK
 * 0.46, both are still served, and a proposal submitted through v1 with no
 * legacy content makes the v1beta1 endpoint fail outright rather than omit it.
 * So v1 is asked first, and v1beta1 answers for the chains that never moved.
 *
 * An endpoint that answers at all settles it, empty included: a chain with no
 * proposals is a real answer, and retrying it against every other endpoint
 * would spend 20 requests to arrive at the same empty list.
 */
export async function fetchCosmosProposals(
  chain: CosmosChainSummary,
  limit = 20
): Promise<CosmosProposal[]> {
  const size = Math.min(100, Math.max(1, limit | 0));
  if (!chain.rest.length) return [];

  const paths = ['/cosmos/gov/v1/proposals', '/cosmos/gov/v1beta1/proposals'];

  for (const endpoint of chain.rest) {
    for (const path of paths) {
      try {
        const json = await fetchAbsoluteJson(
          `${endpoint}${path}?pagination.limit=${size}&pagination.reverse=true`,
          BALANCE_TIMEOUT_MS
        );
        if (!Array.isArray(json?.proposals)) continue;

        return json.proposals
          .map(toProposal)
          .filter((entry: CosmosProposal | null): entry is CosmosProposal => entry !== null);
      } catch {
        // The other module version, then the next endpoint.
      }
    }
  }

  return [];
}

/** The registry orders every pair file alphabetically; all 790 follow it. */
function ibcPairFileName(a: string, b: string): string {
  return [a, b].sort().join('-');
}

/**
 * The transfer channels between two chains, from the registry's pair file.
 *
 * This exists because the alternative does not scale. Asking a chain for its
 * own channels costs one request per channel to resolve each counterparty's
 * chain id, and Osmosis has over 150 - so listing destinations that way is
 * ~150 requests before the dialog can draw. The registry has already done that
 * work and published the answer per pair.
 *
 * Served from raw.githubusercontent rather than the API used by the index
 * above: raw is a CDN with no hourly quota, which is what makes fetching one
 * file per destination affordable.
 */
export async function loadIbcPairChannels(
  sourceName: string,
  peerName: string
): Promise<RawIbcChannel[]> {
  const source = String(sourceName || '').trim();
  const peer = String(peerName || '').trim();
  if (!source || !peer) return [];

  const url = `https://raw.githubusercontent.com/cosmos/chain-registry/master/_IBC/${encodeURIComponent(ibcPairFileName(source, peer))}.json`;

  const json = await fetchAbsoluteJson(url, REQUEST_TIMEOUT_MS);
  const channels = Array.isArray(json?.channels) ? json.channels : [];

  // The file names its two sides chain_1 / chain_2 in alphabetical order, not
  // in the caller's order, so which side is "ours" has to be read rather than
  // assumed. Getting this backwards would send through the counterparty's
  // channel id, which does not exist locally.
  const sourceIsFirst = firstString(json?.chain_1?.chain_name) === source;
  const near = sourceIsFirst ? 'chain_1' : 'chain_2';
  const far = sourceIsFirst ? 'chain_2' : 'chain_1';

  return channels
    .filter((channel: any) => {
      const status = firstString(channel?.tags?.status).toUpperCase();
      return !status || status === 'ACTIVE';
    })
    .map((channel: any) => ({
      channelId: firstString(channel?.[near]?.channel_id),
      portId: firstString(channel?.[near]?.port_id, 'transfer'),
      counterpartyChannelId: firstString(channel?.[far]?.channel_id),
      counterpartyPortId: firstString(channel?.[far]?.port_id, 'transfer'),
      connectionId: firstString(json?.[near]?.connection_id),
      state: 'STATE_OPEN'
    }))
    .filter((channel: RawIbcChannel) => Boolean(channel.channelId))
    // A pair can register several channels; the one tagged preferred is first
    // in the file when there is one, so order is preserved rather than sorted.
    .slice(0, 4);
}

/**
 * The balances an address holds on one chain.
 *
 * Deliberately per-chain and on demand. Querying every chain at once would be
 * ~200 requests against volunteer-run public endpoints on a single page view,
 * which is both slow for the user and rude to the operators; the panel calls
 * this when a chain is opened.
 *
 * Endpoints are tried in order and the first that answers wins, because
 * `best_apis` is ranked but not guaranteed - health-checked recently is not
 * the same as up right now.
 */
export async function fetchCosmosBalances(
  chain: CosmosChainSummary,
  address: string
): Promise<{ balances: CosmosChainBalance[]; source: string }> {
  const account = String(address || '').trim();
  // These messages reach the user: errorMessage() surfaces error.message, so an
  // internal sentinel here would be shown raw and untranslated.
  if (!account) throw new Error(t('No address to look up.'));
  if (!chain.rest.length) throw new Error(t('This chain does not publish a REST endpoint.'));

  const path = `/cosmos/bank/v1beta1/balances/${encodeURIComponent(account)}`;
  let lastError: unknown = null;

  for (const endpoint of chain.rest) {
    try {
      const json = await fetchAbsoluteJson(`${endpoint}${path}`, BALANCE_TIMEOUT_MS);
      const raw = Array.isArray(json?.balances) ? json.balances : [];
      const balances = raw
        .map((entry: any) => ({
          denom: firstString(entry?.denom),
          amount: firstString(entry?.amount, '0')
        }))
        .filter((entry: CosmosChainBalance) => Boolean(entry.denom));
      return { balances, source: endpoint };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(t('No endpoint answered.'));
}

/**
 * Sums the entries of a coin list that are in `denom`, as an integer string.
 *
 * Rewards arrive as `DecCoin` - "16116867.987034811218198944" - because they
 * accrue continuously, where balances and delegations are whole base units.
 * The fraction is dropped rather than rounded, which is what the chain itself
 * does when the reward is actually withdrawn; showing more than is claimable
 * would be the wrong direction to be wrong in.
 *
 * BigInt on the integer part keeps 18-decimal chains exact: a chain like
 * Injective quotes rewards well past what a double can hold.
 */
function sumDenom(coins: unknown, denom: string): string {
  if (!Array.isArray(coins) || !denom) return '0';

  let total = 0n;
  for (const coin of coins) {
    if (firstString((coin as any)?.denom) !== denom) continue;
    const amount = firstString((coin as any)?.amount).split('.')[0];
    if (!/^\d+$/.test(amount)) continue;
    total += BigInt(amount);
  }
  return total.toString();
}

/**
 * Tokens being withdrawn from staking, and when the first of them lands.
 *
 * Entries carry no denom: an unbonding is always in the chain's bond token, so
 * the balances are summed as-is rather than filtered. The earliest completion
 * is the one worth showing - it is the next date anything actually changes.
 */
function readUnbonding(payload: unknown): {
  unbonding: string;
  unbondingEntries: CosmosUnbondingEntry[];
} {
  const responses = Array.isArray((payload as any)?.unbonding_responses)
    ? (payload as any).unbonding_responses
    : [];

  let total = 0n;
  const entries: CosmosUnbondingEntry[] = [];

  // Undelegations run in parallel and each has its own clock, so an account
  // can have several pending at once - from one validator or from many. They
  // are kept individually rather than collapsed to a total and a single date,
  // which would pair the whole amount with the soonest of the dates and read
  // as though it all lands then.
  for (const response of responses) {
    for (const entry of Array.isArray(response?.entries) ? response.entries : []) {
      const amount = firstString(entry?.balance).split('.')[0];
      if (!/^\d+$/.test(amount)) continue;
      total += BigInt(amount);
      entries.push({ amount, completesAt: firstString(entry?.completion_time) });
    }
  }

  // Soonest first; entries with no date sort last rather than to the front.
  entries.sort((a, b) => (a.completesAt || '￿').localeCompare(b.completesAt || '￿'));

  return { unbonding: total.toString(), unbondingEntries: entries };
}

/**
 * What the account has delegated on this chain, and what it has not claimed.
 *
 * Two standard Cosmos SDK endpoints, no third party: staking for the
 * delegations, distribution for the rewards. Both are read per chain and on
 * demand, like the balance, and only the chain's own denom is counted - a
 * validator can pay rewards in tokens that arrived over IBC, and eleven
 * foreign denoms in a headline is noise rather than information.
 */
export async function fetchCosmosStaking(
  chain: CosmosChainSummary,
  address: string
): Promise<CosmosStakingSummary> {
  const account = String(address || '').trim();
  if (!account) throw new Error(t('No address to look up.'));
  if (!chain.rest.length) throw new Error(t('This chain does not publish a REST endpoint.'));

  const delegationsPath = `/cosmos/staking/v1beta1/delegations/${encodeURIComponent(account)}`;
  const rewardsPath = `/cosmos/distribution/v1beta1/delegators/${encodeURIComponent(account)}/rewards`;
  const unbondingPath = `/cosmos/staking/v1beta1/delegators/${encodeURIComponent(account)}/unbonding_delegations`;
  let lastError: unknown = null;

  for (const endpoint of chain.rest) {
    try {
      // Delegations decide whether this call succeeded; the other two are
      // allowed to fail on their own. A chain can serve staking and 501 the
      // distribution module, and a staked figure with no reward line beats
      // neither figure at all.
      const [delegations, rewards, unbonding] = await Promise.all([
        fetchAbsoluteJson(`${endpoint}${delegationsPath}`, BALANCE_TIMEOUT_MS),
        fetchAbsoluteJson(`${endpoint}${rewardsPath}`, BALANCE_TIMEOUT_MS).catch(() => null),
        fetchAbsoluteJson(`${endpoint}${unbondingPath}`, BALANCE_TIMEOUT_MS).catch(() => null)
      ]);

      const responses = Array.isArray(delegations?.delegation_responses)
        ? delegations.delegation_responses
        : [];

      return {
        staked: sumDenom(responses.map((entry: any) => entry?.balance), chain.denom),
        rewards: sumDenom(rewards?.total, chain.denom),
        // Claiming batches one message per validator into one transaction, and
        // the chain refuses a withdraw against a validator that owes nothing -
        // "no rewards available", code 18 - which fails the whole batch. So
        // this is the set with something to pay, read from the rewards rather
        // than from the delegations.
        rewardValidators: (Array.isArray(rewards?.rewards) ? rewards.rewards : [])
          .filter((entry: any) => sumDenom(entry?.reward, chain.denom) !== '0')
          .map((entry: any) => firstString(entry?.validator_address))
          .filter(Boolean),
        // Per-validator amounts, so a specific delegation can be moved or
        // withdrawn rather than only the total being visible.
        delegations: responses
          .map((entry: any) => ({
            validator: firstString(entry?.delegation?.validator_address),
            amount: firstString(entry?.balance?.amount, '0').split('.')[0]
          }))
          .filter((entry: CosmosDelegation) => entry.validator && entry.amount !== '0')
          .sort((a: CosmosDelegation, b: CosmosDelegation) =>
            BigInt(b.amount) > BigInt(a.amount) ? 1 : -1
          ),
        ...readUnbonding(unbonding)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(t('No endpoint answered.'));
}
