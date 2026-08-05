import { inject } from 'vue';
import type {
  OpenExtensionPopup,
  TabNavigate,
  SetTabFavicon,
  TabNavigation,
  TabOpenInNewTab,
  TabState
} from '../types/tabNavigation';
import type { RegisterFindTargetFn } from '../types/tab';

/**
 * The navigation callbacks `MainScreen` provides to everything inside a tab.
 *
 * Twenty-two files used to call `inject()` for these by hand, each rewriting
 * the same signature - `((url: string, opts?: { push?: boolean }) => void) | null`
 * - and each repeating the injection key as a bare string. That is twenty
 * chances for a typo that `inject` answers with `null` rather than an error,
 * leaving a page whose links quietly do nothing. Two files had also drifted to
 * a non-nullable annotation with no default, which claims a guarantee the
 * provider does not give.
 *
 * Must be called from `setup()`, like any `inject`.
 */

/**
 * The provide/inject keys of the whole tab contract. `TabPane` provides the
 * state and `navigate`; `MainScreen` provides the two openers.
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

/**
 * All three at once. Each is `null` when nothing provided it - which is the
 * normal case for a component rendered outside the tab system, so callers keep
 * testing before calling.
 */
export function useTabNavigation(): TabNavigation {
  return {
    navigate: inject<TabNavigate | null>(NAVIGATE_KEY, null),
    openInNewTab: inject<TabOpenInNewTab | null>(OPEN_IN_NEW_TAB_KEY, null),
    openExtensionPopup: inject<OpenExtensionPopup | null>(OPEN_EXTENSION_POPUP_KEY, null),
    setTabFavicon: inject<SetTabFavicon | null>(SET_TAB_FAVICON_KEY, null),
    registerFindTarget: inject<RegisterFindTargetFn | null>(REGISTER_FIND_TARGET_KEY, null)
  };
}

/**
 * What the surrounding tab currently is: its address, its id, and a counter
 * that increments whenever the user asks for a refresh.
 *
 * Injected by hand in seventeen files before this, every one of them as
 * `inject<any>(...)` - so `currentTabUrl.value` was `any` and nothing checked
 * what came out of it. The keys are the same names the properties have, which
 * keeps the migration to a single declaration line per file.
 */
export function useTabState(): TabState {
  return {
    currentTabUrl: inject<TabState['currentTabUrl']>(CURRENT_TAB_URL_KEY, null),
    currentTabId: inject<TabState['currentTabId']>(CURRENT_TAB_ID_KEY, null),
    currentTabRefresh: inject<TabState['currentTabRefresh']>(CURRENT_TAB_REFRESH_KEY, null),
    currentTabIsActive: inject<TabState['currentTabIsActive']>(CURRENT_TAB_IS_ACTIVE_KEY, null)
  };
}
