/**
 * Updating the app from the release list on chain, without a store.
 *
 * The desktop has done this all along through
 * `electron/daemons/release_watcher.cjs`: it reads `/lumen/release/releases`,
 * picks the newest validated release for its platform and offers it. The rules
 * for that choice live in `src/internal/services/releaseSelection.ts` so both
 * targets answer the same question - a release picked two different ways is an
 * app updating itself to the wrong build.
 *
 * WHAT ANDROID ADDS, and it is worth knowing before trusting this:
 *
 *  - The install is not silent the first time. Every install goes through the
 *    system installer; only once this app is the installer of record for the
 *    version in place can a later update be committed without a dialog. So:
 *    one tap now, none afterwards.
 *  - The app is killed while it is replaced, and starting an activity from the
 *    background is restricted, so it does not reopen itself. The user taps the
 *    icon. Promising otherwise would be a lie.
 *  - THE SIGNING KEY DECIDES WHETHER ANY OF THIS WORKS. An APK signed with a
 *    different key than the installed one is refused outright, and today's
 *    builds are signed with a per-machine debug key. Until a release keystore
 *    exists and is kept, an update cannot be installed over an existing app.
 */

import { registerPlugin } from '@capacitor/core';

import { readState } from './network';
import {
  isUpdate,
  pickDownloadUrl,
  selectLatestRelease
} from '../../../src/internal/services/releaseSelection';
import type { LatestPayload, ReleaseCandidate } from '../../../src/types/releaseUpdates';
import type { UpdaterPlugin } from '../../../src/types/updater';
import pkg from '../../../package.json';

/** The same defaults the desktop watcher uses, so both follow one channel. */
const CHANNEL = 'beta';
const KIND = 'browser';

/** How many releases to look back through. */
const LIST_LIMIT = 50;

const CURRENT_VERSION = String((pkg as { version?: string }).version || '0.0.0');

let cached: LatestPayload | null = null;
let platform = '';

const availableListeners = new Set<(payload: unknown) => void>();
const progressListeners = new Set<(payload: unknown) => void>();

/**
 * Registered at module scope, and NEVER returned from an async function.
 *
 * A Capacitor proxy resolved as a promise's value makes the bridge try to call
 * `then` on it, which no plugin implements: the console reads
 * `"Updater.then()" is not implemented on android` and the caller waits on a
 * promise that cannot settle. An earlier version of this file had an
 * `async plugin()` helper returning the proxy, and every poll hung on it -
 * measured on the device, and the same trap the Kubo plugin fell into.
 */
const Updater = registerPlugin<UpdaterPlugin>('Updater');

/** One native subscription for the life of the app, fanned out to the page. */
let subscribed = false;

async function ensureSubscribed(): Promise<void> {
  if (subscribed) return;
  subscribed = true;
  try {
    await Updater.addListener('progress', (payload) => {
      for (const listener of progressListeners) {
        try {
          listener(payload);
        } catch {
          // One bad subscriber must not silence the rest.
        }
      }
    });
  } catch (e) {
    subscribed = false;
    console.warn('[platform/mobile] updater progress not wired:', e);
  }
}

/**
 * `android-arm64` and friends, asked of the device rather than assumed.
 *
 * A release publishes one artifact per architecture, and an arm64 phone handed
 * the x86 build fails at install with nothing useful to say.
 */
async function currentPlatform(): Promise<string> {
  if (platform) return platform;
  try {
    const info = await Updater.abi();
    platform = String(info?.platform || '').trim() || 'android-arm64';
  } catch {
    // The common case by far, and a better guess than nothing.
    platform = 'android-arm64';
  }
  return platform;
}

function toPayload(candidate: ReleaseCandidate, target: string, downloadUrl: string): LatestPayload {
  return {
    version: String(candidate.release.version || ''),
    channel: CHANNEL,
    platform: target,
    kind: KIND,
    release: candidate.release,
    artifact: candidate.artifact,
    downloadUrl: downloadUrl || null
  };
}

/** Announced once per version, not once per poll. */
function announce(payload: LatestPayload): void {
  for (const listener of availableListeners) {
    try {
      listener(payload);
    } catch {
      // As above.
    }
  }
}

async function poll(): Promise<LatestPayload | null> {
  const target = await currentPlatform();

  const query = new URLSearchParams({ limit: String(LIST_LIMIT), channel: CHANNEL });
  const res = await readState(`/lumen/release/releases?${query.toString()}`, {
    kind: 'rest',
    timeout: 12_000
  });
  if (!res.ok) return cached;

  const body = res.json as { releases?: unknown; data?: { releases?: unknown } } | null;
  const list = Array.isArray(body?.releases)
    ? body.releases
    : Array.isArray(body?.data?.releases)
      ? body.data.releases
      : [];

  const candidate = selectLatestRelease(list as never, {
    channel: CHANNEL,
    platform: target,
    kind: KIND
  });
  if (!candidate) return cached;

  // Through the local gateway when the artifact is only on IPFS: the update
  // then arrives the same way the rest of the app's content does.
  const { localIpfsGatewayBase } = await import('../../../src/internal/services/contentResolver');
  const url = pickDownloadUrl(candidate.artifact, localIpfsGatewayBase());
  const payload = toPayload(candidate, target, url);

  const changed = payload.version !== cached?.version;
  cached = payload;
  if (changed && isUpdate(candidate, CURRENT_VERSION)) announce(payload);

  return cached;
}

export const RELEASE_MEMBERS = {
  'release.getLatestInfo': async () => cached,

  'release.pollNow': async () => {
    try {
      return await poll();
    } catch (e) {
      console.warn('[platform/mobile] release poll failed:', e);
      return cached;
    }
  },

  /**
   * Downloads the artifact, checks it against the sha256 the chain published,
   * and hands it to the system installer. See the note at the top of this file
   * for what the user sees and what the signing key decides.
   */
  'release.downloadAndInstall': async () => {
    const info = cached ?? (await poll());
    const url = String(info?.downloadUrl || '').trim();
    if (!url) return { ok: false, error: 'no_release_available' };

    try {
      await ensureSubscribed();
      const result = await Updater.downloadAndInstall({
        url,
        sha256Hex: String(info?.artifact?.sha256Hex || '')
      });
      return { ok: true, bytes: result?.bytes ?? null };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  'release.onUpdateAvailable': (callback: (payload: unknown) => void) => {
    availableListeners.add(callback);
    // A poll that already found one should not be missed by a late subscriber.
    const known = cached
      ? ({ release: cached.release, artifact: cached.artifact } as ReleaseCandidate)
      : null;
    if (known && isUpdate(known, CURRENT_VERSION)) {
      try {
        callback(cached);
      } catch {
        // ignore
      }
    }
    return () => availableListeners.delete(callback);
  },

  'release.onUpdateProgress': (callback: (payload: unknown) => void) => {
    progressListeners.add(callback);
    void ensureSubscribed();
    return () => progressListeners.delete(callback);
  }
};

/**
 * Test seam: everything here is module state, the subscription flag included -
 * leaving that set means the native listener is never attached again.
 */
export function resetReleaseState(): void {
  cached = null;
  platform = '';
  subscribed = false;
  availableListeners.clear();
  progressListeners.clear();
}
