import { inject } from 'vue';
import type {
  OpenExtensionPopup,
  TabNavigate,
  TabNavigation,
  TabOpenInNewTab
} from '../types/tabNavigation';

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

/** The provide/inject keys. `MainScreen` provides all three under these names. */
const NAVIGATE_KEY = 'navigate';
const OPEN_IN_NEW_TAB_KEY = 'openInNewTab';
const OPEN_EXTENSION_POPUP_KEY = 'openExtensionPopup';

/**
 * All three at once. Each is `null` when nothing provided it - which is the
 * normal case for a component rendered outside the tab system, so callers keep
 * testing before calling.
 */
export function useTabNavigation(): TabNavigation {
  return {
    navigate: inject<TabNavigate | null>(NAVIGATE_KEY, null),
    openInNewTab: inject<TabOpenInNewTab | null>(OPEN_IN_NEW_TAB_KEY, null),
    openExtensionPopup: inject<OpenExtensionPopup | null>(OPEN_EXTENSION_POPUP_KEY, null)
  };
}
