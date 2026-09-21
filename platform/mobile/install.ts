/**
 * Mobile target: build `window.lumen` and install it before the app boots.
 *
 * Ordering is the only subtle part. `src/main.ts` calls this first, ahead of
 * `initAppSettings()` and the mount, because `App.vue` runs
 * `checkLumenAPIReferences()` on mount and fails the whole app loudly if a
 * single contract member is missing. Since the bridge is generated from that
 * same contract, the check passes - which is what lets the shell come up on
 * Android with nothing implemented yet.
 */

// First, and before every other import: see the file's own comment.
import './shims/buffer-global';
import type { LumenBridge } from '../../src/types/lumenBridge';
import { bridgeReport, buildMobileBridge } from './bridge/stub';
import { installHardwareBack } from './shims/hardware-back';

export function installPlatformBridge(): void {
  const target = window as unknown as Record<string, unknown>;

  // Never clobber a real bridge. Nothing injects one on Android today, but a
  // future Capacitor preload-equivalent would, and silently replacing it with
  // stubs would be a very confusing bug to chase.
  if (target.lumen) return;

  target.lumen = buildMobileBridge() as unknown as LumenBridge;

  // Not awaited: the bridge must be in place before the app mounts, and the
  // back gesture is not needed until the user has navigated somewhere.
  void installHardwareBack();

  // Not dev-only: the first builds people will file bugs against are release
  // APKs, and "which half of the bridge is real?" is the first question.
  target.__lumenBridgeReport = () => {
    const report = bridgeReport();
    console.warn(
      `[platform/mobile] window.lumen: ${report.implemented.length} implemented, ` +
        `${report.stubbed.length} stubbed, ${report.unsupported.length} unsupported ` +
        `of ${report.total}.`
    );
    return report;
  };

  const { implemented, total } = bridgeReport();
  console.warn(
    `[platform/mobile] bridge installed - ${implemented.length}/${total} members implemented. ` +
      'Call __lumenBridgeReport() for the breakdown.'
  );
}
