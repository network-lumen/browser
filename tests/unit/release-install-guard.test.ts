import { createRequire } from 'node:module';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What the updater will agree to install.
 *
 * This is the one channel that replaces the application itself: on Windows by
 * running an installer, on macOS by swapping the .app. It used to be
 * `downloadAndInstall({ ...input })` - the URL and its digest came straight
 * from the caller's payload, so nothing tied the artefact being installed to
 * the release record the watcher had read off the chain, and a payload with no
 * digest was installed with nothing verified.
 *
 * Three things are pinned here: the caller cannot choose what gets installed,
 * a release with no digest is refused rather than trusted, and a sender that is
 * not the app window gets nothing.
 */

type Release = { registerReleaseIpc: () => void };

const handlers = new Map<string, (evt: unknown, arg: unknown) => Promise<any>>();
let installed: any[] = [];
let latest: any = null;
let uiWebContents: unknown;

const SHA = 'a'.repeat(64);

/**
 * Loads the handler with both of its collaborators replaced.
 *
 * Not through `stub.load`: that clears every electron/ module from the require
 * cache before loading, which would take the stubs planted here with it. The
 * electron stub itself is still what `stubElectron()` puts in place.
 */
function loadWithStubs() {
  handlers.clear();
  installed = [];
  uiWebContents = { id: 1, isDestroyed: () => false, send: () => {} };

  stubElectron({
    ipcMain: {
      handle: (c: string, fn: any) => handlers.set(c, fn),
      on: () => {},
      removeHandler: () => {}
    },
    BrowserWindow: {
      getAllWindows: () => [{ webContents: uiWebContents }],
      fromWebContents: () => null,
      getFocusedWindow: () => null
    }
  });

  const req = createRequire(join(process.cwd(), 'package.json'));
  const plant = (relative: string, exports: unknown) => {
    const id = req.resolve(relative);
    req.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
  };

  // Fresh, so the handler is registered against the stubs below. node_modules
  // is spared on purpose: the electron package resolves to a path containing
  // "/electron/" too, and dropping it would take the stub with it.
  for (const key of Object.keys(req.cache)) {
    const p = key.replace(/\\/g, '/');
    if (p.includes('/electron/') && !p.includes('/node_modules/')) delete req.cache[key];
  }

  plant('./electron/daemons/release_watcher.cjs', {
    getLatestReleaseInfo: () => latest,
    pollNow: async () => latest,
    openExternal: vi.fn(async () => ({ ok: true }))
  });
  plant('./electron/services/release_installer.cjs', {
    downloadAndInstall: async (args: any) => {
      installed.push(args);
      return { ok: true };
    },
    isValidSha256Hex: (v: unknown) => /^[0-9a-f]{64}$/i.test(String(v || '').trim())
  });

  (req('./electron/ipc/release.cjs') as Release).registerReleaseIpc();
}

const call = (channel: string, evt: unknown, arg?: unknown) => handlers.get(channel)!(evt, arg);
const fromUi = () => ({ sender: uiWebContents });

beforeEach(() => {
  latest = {
    version: '1.2.3',
    downloadUrl: 'https://releases.test/Lumen-1.2.3.exe',
    artifact: { sha256Hex: SHA, size: 1234 }
  };
  loadWithStubs();
});

describe('choosing what gets installed', () => {
  it('installs the release this process found', async () => {
    expect(await call('release:downloadAndInstall', fromUi(), {})).toMatchObject({ ok: true });
    expect(installed[0]).toMatchObject({
      url: 'https://releases.test/Lumen-1.2.3.exe',
      sha256Hex: SHA,
      sizeBytes: 1234,
      label: '1.2.3'
    });
  });

  it('ignores a url and a digest supplied by the caller', async () => {
    // The whole point. Whatever the renderer sends, the artefact installed is
    // the one the watcher read off the chain.
    await call('release:downloadAndInstall', fromUi(), {
      url: 'https://evil.test/payload.exe',
      sha256Hex: 'b'.repeat(64),
      sizeBytes: 99
    });
    expect(installed[0].url).toBe('https://releases.test/Lumen-1.2.3.exe');
    expect(installed[0].sha256Hex).toBe(SHA);
  });

  it('refuses when there is no release to install', async () => {
    latest = null;
    expect(await call('release:downloadAndInstall', fromUi(), {})).toMatchObject({
      ok: false,
      error: 'no_release_available'
    });
    expect(installed).toEqual([]);
  });
});

describe('the digest', () => {
  it('refuses a release that carries none', async () => {
    latest.artifact.sha256Hex = null;
    expect(await call('release:downloadAndInstall', fromUi(), {})).toMatchObject({
      ok: false,
      error: 'release_missing_sha256'
    });
    expect(installed).toEqual([]);
  });

  it('refuses one that is not a sha256', async () => {
    for (const bad of ['', 'not-a-digest', 'a'.repeat(63), `${'a'.repeat(64)}z`]) {
      latest.artifact.sha256Hex = bad;
      expect(await call('release:downloadAndInstall', fromUi(), {}), bad).toMatchObject({
        ok: false,
        error: 'release_missing_sha256'
      });
    }
    expect(installed).toEqual([]);
  });
});

describe('who may ask', () => {
  it('refuses a sender that is not the app window', async () => {
    const guest = { id: 42, isDestroyed: () => false };
    expect(await call('release:downloadAndInstall', { sender: guest }, {})).toMatchObject({
      ok: false,
      error: 'not_ui'
    });
    expect(installed).toEqual([]);
  });

  it('refuses an event with no sender at all', async () => {
    expect(await call('release:downloadAndInstall', {}, {})).toMatchObject({ ok: false });
    expect(installed).toEqual([]);
  });

  it('guards opening a release page in the browser too', async () => {
    const guest = { id: 42, isDestroyed: () => false };
    expect(await call('release:openExternal', { sender: guest }, 'https://x.test/')).toMatchObject({
      ok: false,
      error: 'not_ui'
    });
  });
});
