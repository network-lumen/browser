/**
 * The native updater, as `platform/mobile/impl/release.ts` uses it.
 *
 * Android will not let an app replace its own APK without the system
 * installer, so the download, the sha256 check and the install session all sit
 * in Java - see `android/.../UpdaterPlugin.java`.
 */
export interface UpdaterPlugin {
  /** The device's architecture, in the names the release list uses. */
  abi(): Promise<{ abi: string; arch: string; platform: string }>;

  downloadAndInstall(options: { url: string; sha256Hex: string }): Promise<{ ok: boolean; bytes: number }>;

  addListener(
    event: 'progress',
    handler: (payload: {
      phase: string;
      received: number;
      total: number;
      error?: string;
    }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
