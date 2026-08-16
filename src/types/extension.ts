export type InstalledExtension = {
  id: string;
  runtimeId: string;
  name: string;
  enabled: boolean;
  launchUrl: string;
};

export type ExtensionInstallResult =
  | { ok: true }
  | { ok: false; error: string };
