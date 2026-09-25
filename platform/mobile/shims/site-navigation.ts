/**
 * Hearing a lumen:// site navigate inside its own frame.
 *
 * On this target a site is drawn in an iframe, and an iframe on another origin
 * reports nothing: no navigation event, no readable `location`. Clicking a
 * link inside a site therefore left the address bar on the page it started
 * from, and the back button - with no history entry for the page actually on
 * screen - took the user out of the site altogether.
 *
 * The native request interceptor is the one place that does see it, and
 * `SiteNavPlugin` carries it here. Re-dispatched as a DOM event rather than
 * handed to a page directly, for the same reason the hardware back button is:
 * nothing at this layer knows what a tab is.
 */

import { registerPlugin } from '@capacitor/core';
import type { SiteNavPlugin } from '../../../src/types/siteNavigation';

export const SITE_NAVIGATED_EVENT = 'lumen:site-navigated';

// Registered at module scope: resolving a promise with a Capacitor proxy makes
// the bridge try to call `.then` on it, which it does not implement.
const SiteNav = registerPlugin<SiteNavPlugin>('SiteNav');

/**
 * The other half, and the one that matters for a modern site.
 *
 * A client-side router answers a click by calling `history.pushState` - no
 * request, so the native interceptor has nothing to see. The reporter the
 * interceptor splices into each HTML page posts the new location up instead;
 * this is what receives it.
 *
 * The URL is not trusted: SitePage runs it through the same check the
 * desktop applies to its webview, which drops anything not under the CID the
 * tab is showing. A message from anywhere else changes nothing.
 */
function listenForRouteChanges(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { source?: unknown; url?: unknown } | null;
    if (!data || data.source !== 'lumen-site-nav') return;
    const href = String(data.url ?? '').trim();
    if (!href) return;
    window.dispatchEvent(new CustomEvent(SITE_NAVIGATED_EVENT, { detail: { url: href } }));
  });
}

export async function installSiteNavigation(): Promise<void> {
  listenForRouteChanges();

  try {
    await SiteNav.addListener('navigated', ({ url }) => {
      const href = String(url ?? '').trim();
      if (!href) return;
      window.dispatchEvent(new CustomEvent(SITE_NAVIGATED_EVENT, { detail: { url: href } }));
    });
  } catch (e) {
    // A failure here costs the address bar inside a site, not the app.
    console.warn('[platform/mobile] site navigation reporting not wired:', e);
  }
}
