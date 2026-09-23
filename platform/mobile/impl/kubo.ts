/**
 * Bringing the embedded kubo node up, and pointing the app at it.
 *
 * The node itself is the Go daemon in `android/app/src/main/java/chain/lumen/
 * browser/KuboPlugin.java` - the same binary the desktop runs, cross-compiled
 * for arm64 and shipped inside the APK. Nothing here speaks IPFS: once the
 * daemon answers on 127.0.0.1:5001, `impl/ipfs.ts` reaches it exactly as it
 * would reach a node on another machine, because to the page there is no
 * difference.
 *
 * Starting it is deliberately not part of the bridge install. The daemon takes
 * seconds to come up and dials peers as it does, and nothing on the first
 * screen needs IPFS - so the app paints, and the node arrives behind it.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { getSettings, setSettings } from './settings';

const EMBEDDED_API_BASE = 'http://127.0.0.1:5001';

let startPromise: Promise<{ ok: boolean; error?: string }> | null = null;

/**
 * The plugin proxy, created synchronously at module scope.
 *
 * It must never be the value a promise resolves to. Capacitor's proxy answers
 * every property access with a callable, `then` included, so resolving a
 * promise with it makes JavaScript treat it as a thenable and call that - and
 * Capacitor dutifully looks for a native method called `then`. That is the
 * whole of "Kubo.then() is not implemented on android": the node was never
 * asked to start, because asking for the plugin failed first.
 *
 * A static import keeps the proxy out of any promise. `registerPlugin` only
 * builds the proxy - it touches nothing native - so doing it on this target's
 * module graph costs nothing.
 */
const Kubo = registerPlugin<{
  start(): Promise<{
    ok: boolean;
    alreadyRunning?: boolean;
    apiBase?: string;
    error?: string;
    output?: string[];
  }>;
  stop(): Promise<{ ok: boolean }>;
  status(): Promise<{
    ok: boolean;
    running: boolean;
    repoInitialised: boolean;
    binaryPresent: boolean;
    apiBase: string;
    output?: string[];
  }>;
}>('Kubo');

/**
 * Copies the daemon's own output into the app log.
 *
 * kubo says exactly why it will not start - a locked repo, a version it
 * refuses, a path it cannot write - and until now all of that went to logcat,
 * which needs a cable. "Failed to connect to 127.0.0.1:5001" is what is left
 * when those lines are thrown away.
 */
function echoDaemonOutput(output: string[] | undefined, label: string): void {
  if (!output?.length) return;
  console.warn(`[kubo] ${label} - ${output.length} line(s) from the daemon:`);
  for (const line of output) console.warn(`[kubo]   ${line}`);
}

/**
 * Points `ipfsApiBase` at the embedded node, unless the user chose otherwise.
 *
 * The default is the loopback address the daemon listens on, so a setting that
 * still holds the shipped default is one nobody has touched and can be updated
 * silently. A setting holding anything else is a decision - someone pointed
 * this at their own node - and overwriting it would undo that.
 */
async function adoptEmbeddedApiBase(): Promise<void> {
  const current = String((await getSettings()).ipfsApiBase ?? '').trim();
  const untouched = !current || current === 'http://127.0.0.1:5001';
  if (untouched && current !== EMBEDDED_API_BASE) {
    await setSettings({ ipfsApiBase: EMBEDDED_API_BASE });
  }
}

/**
 * Starts the node, at most once per run.
 *
 * Callers get the same promise, so a second screen asking for IPFS while the
 * daemon is still coming up waits for that start rather than racing a second.
 */
export function startEmbeddedNode(): Promise<{ ok: boolean; error?: string }> {
  if (startPromise) return startPromise;

  console.warn('[kubo] startEmbeddedNode called');

  startPromise = (async () => {
    try {
      console.warn('[kubo] platform =', Capacitor.getPlatform());
      // Checked before the plugin is touched at all. Off Android - the mobile
      // bundle opened in a desktop browser during development, or under
      // jsdom in a test - Capacitor's proxy rejects the moment a method is
      // created, and that rejection escapes the try below rather than being
      // caught by it. There is also nothing to start there.
      if (Capacitor.getPlatform() !== 'android') {
        console.warn('[kubo] not android, nothing to start');
        return { ok: false, error: 'embedded_node_is_android_only' };
      }

      console.warn('[kubo] calling Kubo.start() - this can take a minute on a first run');

      console.warn('[kubo] starting the embedded node');
      const result = await Kubo.start();
      console.warn(`[kubo] start ok=${result?.ok} error=${result?.error ?? 'none'}`);
      echoDaemonOutput(result?.output, 'start');

      if (!result?.ok) {
        // The plugin resolves rather than rejects on a failed start, precisely
        // so its output survives to be read here.
        const status = await Kubo.status().catch(() => null);
        if (status) {
          console.warn(
            `[kubo] status running=${status.running} repo=${status.repoInitialised} binary=${status.binaryPresent}`
          );
          echoDaemonOutput(status.output, 'status');
        }
        return { ok: false, error: result?.error ?? 'kubo_start_refused' };
      }
      await adoptEmbeddedApiBase();
      console.warn('[kubo] ipfsApiBase now points at the embedded node');
      console.warn(
        `[platform/mobile] embedded IPFS node ready on ${EMBEDDED_API_BASE}` +
          (result.alreadyRunning ? ' (already running)' : '')
      );
      return { ok: true };
    } catch (e) {
      // A failure here costs IPFS, not the app: every other screen works
      // without a node, and the remote-API path is still available in
      // Settings > Network for anyone who has one.
      const error = String(e instanceof Error ? e.message : e);
      console.warn('[platform/mobile] embedded IPFS node did not start:', error);
      return { ok: false, error };
    }
  })();

  return startPromise;
}
