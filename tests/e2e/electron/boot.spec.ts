import { test, expect, type ElectronApplication } from '@playwright/test';
import { NO_DISPLAY, NO_DISPLAY_REASON, closeApp, launchApp, liveWindow, windowWithBridge } from './support/launch';

/**
 * Booting the real thing.
 *
 * Every spec outside this folder loads the Vue app in a browser with
 * `window.lumen` mocked, which is the right way to test a flow and says nothing
 * about the main process. This one launches Electron: main.cjs runs, the preload
 * is attached by a path resolved at runtime, the daemons start, and the bridge
 * is the real one.
 *
 * It is the answer to a failure this repo has already had - a preload pointed at
 * the wrong file does not throw, it just never loads, and every page loses
 * `window.lumen` in silence. A unit test can check the path exists. Only this can
 * check Electron agreed with it.
 */

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);

let app: ElectronApplication;
let output: () => string;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  ({ app, output } = await launchApp('boot'));
});

test.afterAll(async () => {
  await closeApp(app);
});

test('opens a window', async () => {
  const w = await liveWindow(app);
  expect(await w.title()).toBeDefined();
});

test('attaches the preload, which is what breaks silently', async () => {
  const w = await windowWithBridge(app);

  // Not just "something is there": members from four corners of the bridge, so
  // a preload that half-loaded is not mistaken for a good one.
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
  const w = await windowWithBridge(app);

  // settings:getAll is about as inert as a channel gets - it reads a JSON file
  // in the isolated profile - and a reply proves the round trip end to end:
  // renderer, preload, ipcMain, handler.
  const settings = await w.evaluate(() => (window as any).lumen.settingsGetAll());
  expect(settings.ok).toBe(true);
  expect(typeof settings.settings).toBe('object');
});

test('starts its background loops, and says how many', async () => {
  await expect.poll(() => output(), { timeout: 60_000 }).toMatch(/\[daemon] started \d+\/\d+/);
});

test('logs no preload failure, which is the quiet one', async () => {
  // Electron reports this on stderr and carries on. Nothing else would fail.
  expect(output()).not.toMatch(/Unable to load preload script/i);
});
