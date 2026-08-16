import type { Tab, TabHistoryEntry } from '../../types/tab';

/**
 * Where a tab currently is - the entry in its own history it is sitting on.
 *
 * Separate from `tabHistory`, which moves a tab, because reading a position
 * needs nothing but the tab: no route table, no URL normalisation. That
 * matters beyond tidiness - `tabHistory` reads page titles from the route
 * registry, which imports every internal page, one of which calls into the
 * Electron bridge as its module loads. Anything importing it outside the app
 * crashes before it runs, which is why this had never been testable.
 *
 * Three components worked this out for themselves and one of them got it
 * wrong: `MainScreen` fell back to `history_position ?? 0` where `TabBar` and
 * `TabPane` fall back to the last entry. A tab with no recorded position sits
 * at its newest entry - that is what a push sets - so defaulting to the first
 * meant `MainScreen` could report the oldest page in the tab, and `MainScreen`
 * is what writes the browsing history.
 */
export function tabCurrentEntry(tab: Tab | null | undefined): TabHistoryEntry | null {
  const history = Array.isArray(tab?.history) ? tab.history : [];
  if (!history.length) return null;

  const raw = typeof tab?.history_position === 'number' ? tab.history_position : history.length - 1;
  const pos = Math.min(Math.max(raw, 0), history.length - 1);
  return history[pos] || history[history.length - 1] || null;
}

/**
 * `fallback` is empty by default on purpose. `MainScreen` uses the empty string
 * to mean "nothing worth recording" before it writes a visit to the browsing
 * history, so handing it "lumen://newtab" there would put every new tab in the
 * user's history.
 */
export function tabCurrentUrl(
  tab: Tab | null | undefined,
  options: { fallback?: string } = {}
): string {
  const entry = tabCurrentEntry(tab);
  const url = typeof entry?.url === 'string' ? entry.url.trim() : '';
  return url || String(tab?.url || '').trim() || (options.fallback ?? '');
}

export function tabCurrentTitle(
  tab: Tab | null | undefined,
  options: { fallback?: string } = {}
): string {
  return tabCurrentEntry(tab)?.title ?? options.fallback ?? '';
}
