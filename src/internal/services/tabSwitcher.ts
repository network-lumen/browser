/**
 * What the tab switcher shows for each open tab.
 *
 * The switcher replaces the desktop tab strip below the narrow breakpoint. On
 * a phone that strip is unusable - each tab is 240px wide in a 412px viewport
 * with `overflow: hidden`, so from the third tab on there is nothing to tap,
 * not even the button that opens a new one.
 *
 * Deciding what a row says is kept here rather than in the component for a
 * reason beyond tidiness: it is the part with rules in it. A tab's URL can be
 * an internal route, a chain name, a CID or ordinary http, and each reads
 * differently.
 *
 * `routes.ts` is deliberately NOT imported, although it already knows the
 * internal route names. Importing it pulls in every page component, one of
 * which calls the bridge as it loads - see the note in tabPosition.ts - so a
 * module that imports it cannot be tested outside the app. The rule it would
 * have provided is one line: a `lumen://` host with a dot is a domain, without
 * one it is a route.
 */

import { truncateMiddle } from './format';
import { tabCurrentTitle, tabCurrentUrl } from './tabPosition';
import type { Tab } from '../../types/tab';
import type { TabOrigin, TabSwitcherRow } from '../../types/tabSwitcher';

/** The URL a brand-new tab carries before it has been anywhere. */
const BLANK_URL = 'lumen://newtab';

/** The `lumen://` host that introduces content rather than a page. */
const CONTENT_HOSTS = new Set(['ipfs', 'ipns']);

function schemeOf(url: string): string {
  const match = String(url ?? '').trim().match(/^([a-z][a-z0-9+.-]*):/i);
  return match ? match[1].toLowerCase() : '';
}

/** The first segment after `lumen://`, lowercased, without path or query. */
function lumenHost(url: string): string {
  const rest = String(url ?? '').trim().replace(/^lumen:\/\//i, '');
  return (rest.split(/[/?#]/, 1)[0] || '').toLowerCase();
}

export function tabOrigin(url: string): TabOrigin {
  const value = String(url ?? '').trim();
  if (!value) return 'blank';

  const scheme = schemeOf(value);
  if (scheme === 'ipfs' || scheme === 'ipns') return 'ipfs';
  if (scheme === 'http' || scheme === 'https' || scheme === 'file') return 'web';
  if (scheme !== 'lumen') return 'web';

  const host = lumenHost(value);
  if (!host || host === 'newtab') return 'blank';
  if (CONTENT_HOSTS.has(host)) return 'ipfs';
  // A dot is what separates a registered name from one of the app's own pages.
  return host.includes('.') ? 'chain' : 'internal';
}

/**
 * The line under the title: the shortest thing that still identifies the tab.
 *
 * The scheme is left out on purpose - the provenance chip beside it already
 * says `chain`, `ipfs` or `web`, and repeating it would cost the width that
 * makes a CID legible.
 */
export function tabSubtitle(url: string): string {
  const value = String(url ?? '').trim();
  const origin = tabOrigin(value);
  if (origin === 'blank') return '';

  if (origin === 'web') {
    try {
      return new URL(value).host.replace(/^www\./i, '') || value;
    } catch {
      return value;
    }
  }

  if (origin === 'internal') return `lumen://${lumenHost(value)}`;

  if (origin === 'chain') {
    const path = value.replace(/^lumen:\/\//i, '').slice(lumenHost(value).length);
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    return trimmed ? `${lumenHost(value)}/${trimmed}` : lumenHost(value);
  }

  // IPFS: the CID is the identifier, and the middle of it carries no meaning.
  const withoutScheme = value.replace(/^(lumen|ipfs|ipns):\/\//i, '');
  const segments = withoutScheme.split('/').filter(Boolean);
  const cid = CONTENT_HOSTS.has((segments[0] || '').toLowerCase()) ? segments[1] : segments[0];
  return truncateMiddle(cid || withoutScheme, { start: 8, end: 6, separator: '…' });
}

/**
 * One row per tab, in the order they are open.
 *
 * `fallbackTitle` is passed in rather than translated here so that this module
 * stays free of the i18n store, which the component already has.
 */
export function buildTabRows(
  tabs: Tab[],
  activeId: string,
  fallbackTitle: string
): TabSwitcherRow[] {
  return (Array.isArray(tabs) ? tabs : []).map((tab) => {
    const url = tabCurrentUrl(tab, { fallback: BLANK_URL });
    return {
      id: tab.id,
      title: tabCurrentTitle(tab, { fallback: fallbackTitle }) || fallbackTitle,
      subtitle: tabSubtitle(url),
      origin: tabOrigin(url),
      loading: !!tab.loading,
      favicon: tab.favicon ?? null,
      active: tab.id === activeId
    };
  });
}

/**
 * The number in the counter.
 *
 * Capped because the button is a 28px square: a fourth digit would either
 * overflow it or shrink the type below what is readable at arm's length.
 */
export function tabCountLabel(count: number): string {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n > 99 ? '99+' : String(n);
}

/**
 * The tab to land on when `id` is closed, or null when it was not open.
 *
 * The one after it, falling back to the one before - closing the tab you are
 * reading should move you forward through the list, not back to the start.
 * Returns the id unchanged when another tab is active, since closing a
 * background tab must not move the user at all.
 */
export function nextActiveTabId(tabs: Tab[], activeId: string, id: string): string | null {
  const list = Array.isArray(tabs) ? tabs : [];
  const index = list.findIndex((tab) => tab.id === id);
  if (index === -1) return null;
  if (activeId !== id) return activeId;

  const next = list[index + 1] ?? list[index - 1] ?? null;
  return next ? next.id : null;
}
