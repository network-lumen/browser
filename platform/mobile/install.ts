/**
 * Mobile target: build `window.lumen` and install it before the app boots.
 *
 * THE BRIDGE IS INSTALLED WHEN THIS MODULE IS EVALUATED, not when
 * `installPlatformBridge()` is called, and that distinction is the whole
 * reason this file is shaped the way it is.
 *
 * On the desktop, Electron's preload puts `window.lumen` in place before a
 * single renderer module is evaluated. Modules written against that take it at
 * face value: `src/internal/common/upload.ts` does `const api =
 * useInternalLumen()` at module scope, captured once and used forever.
 *
 * Installing from inside a function called by `src/main.ts` is too late for
 * them. ES modules evaluate every import before the importing module's body,
 * so `App.vue` and everything it pulls in - upload.ts among them - runs before
 * main.ts reaches its first statement. Those modules captured `undefined`, and
 * kept it: uploading a file reported "Cannot read properties of undefined
 * (reading 'dialogOpenFiles')" long after the bridge was perfectly healthy.
 *
 * So the install is a side effect of importing this file, and `@platform` is
 * the first import in main.ts. `installPlatformBridge()` stays exported and
 * idempotent so main.ts reads the same on both targets, but by the time it
 * runs the work is already done.
 */

// First, and before every other import: see the file's own comment.
import './shims/buffer-global';
import type { LumenBridge } from '../../src/types/lumenBridge';
import { bridgeReport, buildMobileBridge } from './bridge/stub';
import { startEmbeddedNode } from './impl/kubo';
import { installHardwareBack } from './shims/hardware-back';

function install(): void {
  const target = globalThis as unknown as Record<string, unknown>;

  // Never clobber a real bridge. Nothing injects one on Android today, but a
  // future Capacitor preload-equivalent would, and silently replacing it with
  // stubs would be a very confusing bug to chase.
  if (target.lumen) return;

  target.lumen = buildMobileBridge() as unknown as LumenBridge;

  // Neither is awaited: the bridge must be in place before the app mounts,
  // and neither the back gesture nor the IPFS node is needed to paint the
  // first screen. The daemon takes seconds to come up and dials peers as it
  // does - doing that in front of the user would be a slow launch for a
  // feature most sessions never touch.
  void startEmbeddedNode();
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

// The side effect the comment above is about. Guarded because a test may
// import this module more than once, and because install() is cheap to call
// twice but not free.
if (typeof window !== 'undefined') install();

/**
 * Kept so `src/main.ts` calls the same function on both targets. The bridge is
 * already up by the time this runs; it only matters if something cleared it.
 */
export function installPlatformBridge(): void {
  install();
}
