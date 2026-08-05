import { getInternalTitle } from '../routes';
import { normalizeTabUrl } from '../navigationUrl';
import type { Tab, TabHistoryEntry } from '../../types/tab';


/**
 * Moves a tab to an internal URL and records it in that tab's history.
 *
 * `TabBar` and `TabPane` each carried a byte-identical copy of this, differing
 * only in where they read the tab from - one from the active tab, the other
 * from its own pane's state. That is the back/forward semantics the project
 * notes warn has to be kept in step across `MainScreen`, `TabBar` and
 * `TabPane` by hand; two of those three now share the one implementation.
 *
 * `push: false` rewrites the entry the tab is currently sitting on instead of
 * adding one, which is what a redirect or an in-place route change wants.
 * Navigating forward from the middle of the history truncates whatever came
 * after, the way a browser does.
 */
export function navigateTabToInternalUrl(
  tab: Tab | null | undefined,
  url: string,
  opts: { push?: boolean } = {}
): void {
  const push = opts.push ?? true;
  if (!tab) return;

  const u = normalizeTabUrl(url);

  if (!Array.isArray(tab.history)) tab.history = [];

  const currentPos = tab.history_position ?? tab.history.length - 1;
  const title = getInternalTitle(u);

  if (!push && tab.history.length) {
    const pos = currentPos >= 0 ? currentPos : tab.history.length - 1;
    const entry = tab.history[pos];
    if (entry) {
      entry.url = u;
      entry.title = title;
      tab.history_position = pos;
    }
  } else {
    if (currentPos >= 0 && currentPos < tab.history.length - 1) {
      tab.history = tab.history.slice(0, currentPos + 1);
    }
    const entry: TabHistoryEntry = { url: u, title };
    tab.history.push(entry);
    tab.history_position = tab.history.length - 1;
  }

  tab.url = u;
  tab.title = title;
  tab.draftUrl = u;
}
