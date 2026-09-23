/**
 * The tab switcher's row model.
 *
 * `origin` is the one thing a general-purpose browser's tab list has nothing
 * to show: whether a tab is on a name the chain resolved, on raw IPFS content,
 * on one of the app's own pages, or on the ordinary web. On a phone the
 * address bar is truncated to a few characters, so this is where that
 * distinction survives - it is a provenance signal, not decoration.
 */
export type TabOrigin = 'internal' | 'chain' | 'ipfs' | 'web' | 'blank';

export interface TabSwitcherRow {
  id: string;
  title: string;
  /** The identifier under the title: a host, a CID, a route. Never a scheme. */
  subtitle: string;
  origin: TabOrigin;
  loading: boolean;
  favicon: string | null;
  active: boolean;
}
