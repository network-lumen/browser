import type { Ref } from 'vue';
import type { RegisterFindTargetFn } from './tab';

/** Navigate the current tab. `push` defaults to true, i.e. adds a history entry. */
export type TabNavigate = (url: string, opts?: { push?: boolean }) => void;

export type TabOpenInNewTab = (url: string) => void;

/** Open an extension popup, described by whatever payload the caller has. */
export type OpenExtensionPopup = (input: any) => void;

/** Set (or clear) the favicon shown on the tab. */
export type SetTabFavicon = (icon: string | null) => void;

export type TabOpenOptions = {
  /** Open in a new tab instead of here. */
  blank?: boolean;
  /** Add a history entry. Ignored when opening in a new tab. */
  push?: boolean;
};

/** What `MainScreen` and `TabBar` provide to everything rendered inside a tab. */
export type TabNavigation = {
  /**
   * Go to a URL, wherever the caller is. Prefer this over reaching for
   * `navigate` or `openInNewTab` directly - it falls back to whichever one
   * exists, which is the whole of what five hand-written helpers used to do.
   */
  open: (url: string, options?: TabOpenOptions) => void;
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
 * What `TabPane` provides about the tab a component is rendered in. All four
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
