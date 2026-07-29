// NavBar's extensions-dropdown summary - distinct shape from
// types/extension.ts's InstalledExtension (that one tracks a single hosted
// extension instance's runtime/popup state; this one is a lighter list-item
// view used only for the NavBar extensions menu).
export type NavBarExtensionSummary = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  loaded?: boolean;
  lastError?: string;
  launchUrl?: string;
};

export type NavBarImportMode = 'file' | 'manual';
