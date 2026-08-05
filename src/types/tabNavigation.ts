import type { Ref } from 'vue';

/** Navigate the current tab. `push` defaults to true, i.e. adds a history entry. */
export type TabNavigate = (url: string, opts?: { push?: boolean }) => void;

/** Open a URL in a new tab. */
export type TabOpenInNewTab = (url: string) => void;

/** Open an extension popup, described by whatever payload the caller has. */
export type OpenExtensionPopup = (input: any) => void;

/** What `MainScreen` provides to everything rendered inside a tab. */
export type TabNavigation = {
  navigate: TabNavigate | null;
  openInNewTab: TabOpenInNewTab | null;
  openExtensionPopup: OpenExtensionPopup | null;
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
};
