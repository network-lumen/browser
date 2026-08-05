import type { Ref } from 'vue';
import type { RegisterFindTargetFn } from './tab';

/** Navigate the current tab. `push` defaults to true, i.e. adds a history entry. */
export type TabNavigate = (url: string, opts?: { push?: boolean }) => void;

/** Open a URL in a new tab. */
export type TabOpenInNewTab = (url: string) => void;

/** Open an extension popup, described by whatever payload the caller has. */
export type OpenExtensionPopup = (input: any) => void;

/** Set (or clear) the favicon shown on the tab. */
export type SetTabFavicon = (icon: string | null) => void;

/** What `MainScreen` and `TabBar` provide to everything rendered inside a tab. */
export type TabNavigation = {
  navigate: TabNavigate | null;
  openInNewTab: TabOpenInNewTab | null;
  openExtensionPopup: OpenExtensionPopup | null;
  setTabFavicon: SetTabFavicon | null;
  /**
   * Tell the find bar which webContents to search. Reuses the type `TabBar`
   * already declares for the provide side, rather than the fifth hand-written
   * copy of its signature.
   */
  registerFindTarget: RegisterFindTargetFn | null;
};

/**
 * What `TabPane` provides about the tab a component is rendered in. All three
 * are `null` outside the tab system, so callers keep using `?.value`.
 */
export type TabState = {
  currentTabUrl: Readonly<Ref<string>> | null;
  currentTabId: Readonly<Ref<string>> | null;
  /** Increments on every refresh request; watch it to reload. */
  currentTabRefresh: Readonly<Ref<number>> | null;
  /** False while the tab is open but not the one being looked at. */
  currentTabIsActive: Readonly<Ref<boolean>> | null;
};
