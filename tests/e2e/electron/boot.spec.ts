import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Booting the real thing.
 *
 * Every other e2e spec loads the Vue app in a browser with `window.lumen`
 * mocked, which is the right way to test a flow and says nothing about the main
 * process. This one launches Electron: main.cjs runs, the preload is attached by
 * a path resolved at runtime, the daemons start, and the bridge is the real one.
 *
 * It is the answer to the failure this repo has already had - a preload pointed
 * at the wrong file does not throw, it just never loads, and every page loses
 * `window.lumen` in silence. A unit test can check the path exists. Only this
 * can check Electron agreed with it.
 */

/**
 * A profile of its own, which this test refuses to run without.
 *
 * `LUMEN_USER_DATA_DIR` is the only way in from outside: Electron resolves
 * appData through the OS rather than the environment, and bootstrap_paths pins
 * userData on top of that, so neither APPDATA nor --user-data-dir reaches it.
 * Without the override this would open the developer's real wallet - and hang,
 * if their Lumen is already running and holding the profile's databases.
 *
 * The directory is stable rather than fresh per run: a first boot initialises a
 * Kubo repository, which is slow. Reused, it costs that once.
 */
function isolatedProfile() {
  const dir = join(tmpdir(), 'lumen-e2e-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Cold, this waits on a Kubo repo being created. Warm, it is seconds. */
const WINDOW_TIMEOUT = 180_000;

let app: ElectronApplication;
let output: string[] = [];

test.beforeAll(async () => {
  test.setTimeout(WINDOW_TIMEOUT + 60_000);
  const profileDir = isolatedProfile();
  const launchEnv: Record<string, string> = { ...(process.env as Record<string, string>) };
  // Some toolchains export this so that `electron` behaves as a plain node.
  // Inherited here, the binary would refuse Chromium's own switches and exit
  // before the app existed - with "bad option", which is a node error message.
  delete launchEnv.ELECTRON_RUN_AS_NODE;

  app = await electron.launch({
    args: ['.'],
    env: {
      ...launchEnv,
      LUMEN_USER_DATA_DIR: profileDir,
      // The windows load this in an unpackaged build; the config's webServer is
      // already serving it.
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
      // Nothing here asserts on gateways, and the monitor would only add
      // network noise to a boot test.
      LUMEN_GATEWAY_HEALTH_MONITOR: '0'
    }
  });

  output = [];
  app.process().stdout?.on('data', (d) => output.push(String(d)));
  app.process().stderr?.on('data', (d) => output.push(String(d)));

  // Waited for once, here, rather than per test: each firstWindow() call starts
  // its own wait, and on a cold profile that is minutes each.
  const first = await app.firstWindow({ timeout: WINDOW_TIMEOUT });
  await first.waitForLoadState('domcontentloaded');
});

/**
 * Whichever window is open right now.
 *
 * Not a reference kept from earlier: the splash closes when the main window
 * takes over, and a page captured before that is dead by the next test.
 */
async function liveWindow() {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const open = app.windows().filter((w) => !w.isClosed());
    if (open.length) {
      const w = open[open.length - 1];
      await w.waitForLoadState('domcontentloaded');
      return w;
    }
    if (Date.now() > deadline) throw new Error('the app has no open window');
    await new Promise((r) => setTimeout(r, 250));
  }
}

test.afterAll(async () => {
  await app?.close().catch(() => {});
});

test('opens a window', async () => {
  const w = await liveWindow();
  expect(await w.title()).toBeDefined();
});

test('attaches the preload, which is what breaks silently', async () => {
  const w = await liveWindow();
  await w.waitForFunction(() => typeof (window as any).lumen === 'object', null, {
    timeout: 30_000
  });

  // Not just "something is there": a handful of members from different corners
  // of the bridge, so a preload that half-loaded is not mistaken for a good one.
  const shape = await w.evaluate(() => {
    const l = (window as any).lumen || {};
    return {
      ipfsStatus: typeof l.ipfsStatus,
      settingsGetAll: typeof l.settingsGetAll,
      netRpcGet: typeof l.net?.rpcGet,
      releasePollNow: typeof l.release?.pollNow,
      profilesGetActive: typeof l.profiles?.getActive
    };
  });

  expect(shape).toEqual({
    ipfsStatus: 'function',
    settingsGetAll: 'function',
    netRpcGet: 'function',
    releasePollNow: 'function',
    profilesGetActive: 'function'
  });
});

test('answers over IPC, so the handlers are registered too', async () => {
  const w = await liveWindow();
  await w.waitForFunction(() => typeof (window as any).lumen === 'object', null, {
    timeout: 30_000
  });

  // settings:getAll is about as inert as a channel gets - it reads a JSON file
  // in the isolated profile - and a reply proves the round trip works end to
  // end: renderer, preload, ipcMain, handler.
  const settings = await w.evaluate(() => (window as any).lumen.settingsGetAll());
  expect(settings).toBeTruthy();
  expect(typeof settings).toBe('object');
});

test('starts its background loops, and says how many', async () => {
  await expect
    .poll(() => output.join(''), { timeout: 30_000 })
    .toMatch(/\[daemon] started \d+\/\d+/);
});

test('logs no preload failure, which is the quiet one', async () => {
  // Electron reports this on stderr and carries on. Nothing else would fail.
  expect(output.join('')).not.toMatch(/Unable to load preload script/i);
});
