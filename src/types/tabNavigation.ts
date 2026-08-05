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
