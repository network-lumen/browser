import { describe, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { useTabNavigation, useTabState } from '../../src/composables/useTabNavigation';
import type { TabNavigation, TabState } from '../../src/types/tabNavigation';

/**
 * Where a link goes.
 *
 * Five components had each written this by hand, as `goto` or
 * `openInNewTabSafe`, and they disagreed in ways nobody chose: one had no
 * fallback at all, one turned a blank URL into the new tab page, one forwarded
 * the caller's push option and the rest hard-coded it. Every one of those
 * disagreements is a case below.
 *
 * Either injected side can be absent - a component rendered outside the tab
 * system gets neither - which is why each falls back to the other.
 */

/**
 * Runs a composable with app-level provides, so `inject` resolves without
 * mounting anything. Vue's own runWithContext, no test renderer needed.
 */
function withProvides<T>(provides: Record<string, unknown>, fn: () => T): T {
  // Never mounted, so never unmounted - runWithContext only needs the app's
  // provides, and calling unmount() on an unmounted app just warns.
  const app = createApp({ render: () => null });
  for (const [key, value] of Object.entries(provides)) app.provide(key, value);
  return app.runWithContext(fn);
}

const nav = (provides: Record<string, unknown>): TabNavigation =>
  withProvides(provides, () => useTabNavigation());

describe('open', () => {
  it('navigates in place by default, pushing history', () => {
    const navigate = vi.fn();
    nav({ navigate }).open('lumen://wallet');
    expect(navigate).toHaveBeenCalledWith('lumen://wallet', { push: true });
  });

  it('honours push: false, which is what a redirect wants', () => {
    // One of the five copies hard-coded push and swallowed this.
    const navigate = vi.fn();
    nav({ navigate }).open('lumen://wallet', { push: false });
    expect(navigate).toHaveBeenCalledWith('lumen://wallet', { push: false });
  });

  it('opens a new tab when asked', () => {
    const navigate = vi.fn();
    const openInNewTab = vi.fn();
    nav({ navigate, openInNewTab }).open('lumen://wallet', { blank: true });
    expect(openInNewTab).toHaveBeenCalledWith('lumen://wallet');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still gets you there when a new tab was asked for but none can be opened', () => {
    const navigate = vi.fn();
    nav({ navigate }).open('lumen://wallet', { blank: true });
    expect(navigate).toHaveBeenCalledWith('lumen://wallet', { push: true });
  });

  it('falls back to a new tab when there is nothing to navigate', () => {
    const openInNewTab = vi.fn();
    nav({ openInNewTab }).open('lumen://wallet');
    expect(openInNewTab).toHaveBeenCalledWith('lumen://wallet');
  });

  it('does nothing at all for a blank URL', () => {
    // One copy turned this into the new tab page, which is a navigation the
    // user did not ask for.
    const navigate = vi.fn();
    const openInNewTab = vi.fn();
    const api = nav({ navigate, openInNewTab });
    for (const empty of ['', '   ', null, undefined]) {
      api.open(empty as never);
    }
    expect(navigate).not.toHaveBeenCalled();
    expect(openInNewTab).not.toHaveBeenCalled();
  });

  it('does not throw when nothing was provided at all', () => {
    // The normal case for a component rendered outside the tab system.
    expect(() => nav({}).open('lumen://wallet')).not.toThrow();
    expect(() => nav({}).open('lumen://wallet', { blank: true })).not.toThrow();
  });

  it('trims the URL before handing it on', () => {
    const navigate = vi.fn();
    nav({ navigate }).open('  lumen://wallet  ');
    expect(navigate).toHaveBeenCalledWith('lumen://wallet', { push: true });
  });
});

describe('what it hands back', () => {
  it('passes the injected callbacks straight through', () => {
    const provided = {
      navigate: vi.fn(),
      openInNewTab: vi.fn(),
      openExtensionPopup: vi.fn(),
      setTabFavicon: vi.fn(),
      findRegisterTarget: vi.fn(),
    };
    const api = nav(provided);
    expect(api.navigate).toBe(provided.navigate);
    expect(api.openInNewTab).toBe(provided.openInNewTab);
    expect(api.openExtensionPopup).toBe(provided.openExtensionPopup);
    expect(api.setTabFavicon).toBe(provided.setTabFavicon);
    expect(api.registerFindTarget).toBe(provided.findRegisterTarget);
  });

  it('gives null rather than undefined for what nothing provided', () => {
    // Callers test before calling; undefined would still work but null is the
    // documented contract and two files had drifted to claiming non-null.
    const api = nav({});
    expect(api.navigate).toBeNull();
    expect(api.openInNewTab).toBeNull();
    expect(api.openExtensionPopup).toBeNull();
    expect(api.setTabFavicon).toBeNull();
    expect(api.registerFindTarget).toBeNull();
  });

  it('reads the find-target key under the name the provider uses', () => {
    // The key reads "find/register" while the callback reads "register/find",
    // which is exactly the kind of mismatch inject answers with null.
    const findRegisterTarget = vi.fn();
    expect(nav({ findRegisterTarget }).registerFindTarget).toBe(findRegisterTarget);
    expect(nav({ registerFindTarget: vi.fn() }).registerFindTarget).toBeNull();
  });
});

describe('useTabState', () => {
  it('reads the surrounding tab’s state', () => {
    const provided = {
      currentTabUrl: { value: 'lumen://home' },
      currentTabId: { value: 'tab-1' },
      currentTabRefresh: { value: 3 },
      currentTabIsActive: { value: true },
    };
    const state = withProvides(provided, () => useTabState()) as TabState;
    expect(state.currentTabUrl).toBe(provided.currentTabUrl);
    expect(state.currentTabId).toBe(provided.currentTabId);
    expect(state.currentTabRefresh).toBe(provided.currentTabRefresh);
    expect(state.currentTabIsActive).toBe(provided.currentTabIsActive);
  });

  it('gives null for every field outside a tab', () => {
    const state = withProvides({}, () => useTabState()) as TabState;
    expect(state.currentTabUrl).toBeNull();
    expect(state.currentTabId).toBeNull();
    expect(state.currentTabRefresh).toBeNull();
    expect(state.currentTabIsActive).toBeNull();
  });
});
