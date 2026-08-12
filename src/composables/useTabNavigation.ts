import { inject } from 'vue';
import type {
  OpenExtensionPopup,
  TabNavigate,
  SetTabFavicon,
  TabNavigation,
  TabOpenInNewTab,
  TabOpenOptions,
  TabState
} from '../types/tabNavigation';
import type { RegisterFindTargetFn } from '../types/tab';

/**
 * The tab contract as one import. `TabPane` provides the state and `navigate`;
 * `MainScreen` provides the openers. Both hooks are `inject`, so both must be
 * called from `setup()`.
 *
 * Twenty-two files used to inject these by hand, each rewriting the signature
 * and repeating the key as a bare string - twenty chances for a typo that
 * `inject` answers with `null` rather than an error, leaving a page whose links
 * quietly do nothing.
 */
const NAVIGATE_KEY = 'navigate';
const OPEN_IN_NEW_TAB_KEY = 'openInNewTab';
const OPEN_EXTENSION_POPUP_KEY = 'openExtensionPopup';
const SET_TAB_FAVICON_KEY = 'setTabFavicon';
const CURRENT_TAB_URL_KEY = 'currentTabUrl';
const CURRENT_TAB_ID_KEY = 'currentTabId';
const CURRENT_TAB_REFRESH_KEY = 'currentTabRefresh';
const CURRENT_TAB_IS_ACTIVE_KEY = 'currentTabIsActive';
/** Note the order: the key reads "find/register", the callback "register/find". */
const REGISTER_FIND_TARGET_KEY = 'findRegisterTarget';

/** Every callback is `null` outside the tab system, so callers keep testing before calling. */
export function useTabNavigation(): TabNavigation {
  const navigate = inject<TabNavigate | null>(NAVIGATE_KEY, null);
  const openInNewTab = inject<TabOpenInNewTab | null>(OPEN_IN_NEW_TAB_KEY, null);

  /**
   * Five components wrote this by hand and disagreed in ways nobody chose: one
   * had no fallback at all, one turned a blank URL into the new tab page, one
   * forwarded the caller's push option and the rest hard-coded it.
   *
   * Either side can be absent, so each falls back to the other: asking for a
   * new tab where none can be opened still gets you there.
   */
  function open(url: string, options: TabOpenOptions = {}) {
    const target = String(url || '').trim();
    if (!target) return;

    if (options.blank) {
      if (openInNewTab) {
        openInNewTab(target);
        return;
      }
      navigate?.(target, { push: true });
      return;
    }

    if (navigate) {
      navigate(target, { push: options.push ?? true });
      return;
    }
    openInNewTab?.(target);
  }

  return {
    open,
    navigate,
    openInNewTab,
    openExtensionPopup: inject<OpenExtensionPopup | null>(OPEN_EXTENSION_POPUP_KEY, null),
    setTabFavicon: inject<SetTabFavicon | null>(SET_TAB_FAVICON_KEY, null),
    registerFindTarget: inject<RegisterFindTargetFn | null>(REGISTER_FIND_TARGET_KEY, null)
  };
}

/**
 * What the surrounding tab currently is: its address, its id, a counter that
 * increments on each refresh, and whether it is the active tab.
 *
 * Seventeen files injected these by hand as `inject<any>(...)`, so
 * `currentTabUrl.value` was `any` and nothing checked what came out of it.
 */
export function useTabState(): TabState {
  return {
    currentTabUrl: inject<TabState['currentTabUrl']>(CURRENT_TAB_URL_KEY, null),
    currentTabId: inject<TabState['currentTabId']>(CURRENT_TAB_ID_KEY, null),
    currentTabRefresh: inject<TabState['currentTabRefresh']>(CURRENT_TAB_REFRESH_KEY, null),
    currentTabIsActive: inject<TabState['currentTabIsActive']>(CURRENT_TAB_IS_ACTIVE_KEY, null)
  };
}
