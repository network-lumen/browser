import { describeFavouriteUrl } from '../services/favouriteMeta';
import { canonicalizeLumenUrl, isLumenUrl } from '../services/navigationUrl';
import type {
  AddressSuggestion,
  AddressSuggestionCandidate,
  AddressSuggestionOptions,
  AddressSuggestionSource,
  ScoredAddressSuggestion
} from '../../types/addressSuggestions';

export type { AddressSuggestion, AddressSuggestionCandidate };

const DEFAULT_LIMIT = 8;

/**
 * Where the query was found, best first. The host is what people type, so a
 * host match beats a title match beats "somewhere in the URL" - without this
 * ordering a query like "wal" ranks a page whose *body path* contains "wal"
 * level with `lumen://wallet`.
 */
const enum Tier {
  HostPrefix = 0,
  HostSubstring = 1,
  TitlePrefix = 2,
  Elsewhere = 3,
  NoMatch = 4
}

/** The address bar strips the scheme people rarely type; the ranking has to see the same string. */
function hostOf(rawUrl: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(isLumenUrl(url) ? canonicalizeLumenUrl(url) : url);
    return String(parsed.hostname || '').replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function tierOf(query: string, url: string, title: string): Tier {
  const host = hostOf(url);
  if (host.startsWith(query)) return Tier.HostPrefix;
  if (host.includes(query)) return Tier.HostSubstring;
  if (title.toLowerCase().startsWith(query)) return Tier.TitlePrefix;
  if (title.toLowerCase().includes(query) || url.toLowerCase().includes(query)) return Tier.Elsewhere;
  return Tier.NoMatch;
}

function keyOf(rawUrl: string): string {
  const url = String(rawUrl || '').trim();
  return (isLumenUrl(url) ? canonicalizeLumenUrl(url) : url).toLowerCase();
}

function score(
  candidates: AddressSuggestionCandidate[],
  source: AddressSuggestionSource,
  query: string,
  taken: Set<string>
): ScoredAddressSuggestion[] {
  const out: ScoredAddressSuggestion[] = [];
  for (const candidate of candidates) {
    const url = String(candidate?.url || '').trim();
    if (!url) continue;
    const key = keyOf(url);
    if (taken.has(key)) continue;

    const meta = describeFavouriteUrl(url, candidate.title);
    const tier = tierOf(query, url, meta.title);
    if (tier === Tier.NoMatch) continue;

    taken.add(key);
    out.push({
      suggestion: { ...meta, source },
      tier,
      recency: Number(candidate.lastVisitedAt) || 0,
      visits: Number(candidate.visitCount) || 0
    });
  }
  return out.sort(
    (a, b) => a.tier - b.tier || b.visits - a.visits || b.recency - a.recency
  );
}

/**
 * What the address bar offers under the input as the user types.
 *
 * **Favourites come first as a block**, then history - not interleaved by match
 * quality. A shortcut the user saved on purpose is a stronger signal of intent
 * than a page they happened to land on, and a list whose top entry changes
 * category on every keystroke is one nobody can hit blind. Within each block
 * the tiers above decide the order.
 *
 * A URL saved *and* visited appears once, as the favourite: the two stores
 * canonicalise `lumen://` the same way, so the same page is the same key.
 */
export function rankAddressSuggestions(
  rawQuery: string,
  options: AddressSuggestionOptions = {}
): AddressSuggestion[] {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return [];

  const limit = Math.max(0, Math.floor(Number(options.limit ?? DEFAULT_LIMIT)));
  if (!limit) return [];

  const taken = new Set<string>();
  const favourites = score(options.favourites || [], 'favourite', query, taken);
  const history = score(options.history || [], 'history', query, taken);

  return [...favourites, ...history].slice(0, limit).map((entry) => entry.suggestion);
}
