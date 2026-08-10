import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Launching the real app for a test, without touching the real one.
 *
 * `LUMEN_USER_DATA_DIR` is the only way in from outside: Electron resolves
 * appData through the OS, and bootstrap_paths pins userData on top, so neither
 * APPDATA nor --user-data-dir reaches it. Without it these tests would read and
 * write the developer's own wallet - and hang, if their Lumen is open and
 * holding the profile's databases.
 */

/** Electron needs a display server; the CI job runs on plain ubuntu. */
export const NO_DISPLAY = process.platform === 'linux' && !process.env.DISPLAY;
export const NO_DISPLAY_REASON = 'no display server: run under xvfb to launch Electron';

/** Cold, a launch waits on a Kubo repository being created. Warm, it is seconds. */
export const LAUNCH_TIMEOUT = 180_000;

/**
 * Ports of its own, written before the first launch.
 *
 * The app configures Kubo's `Addresses.API` and `Addresses.Gateway` from these
 * settings, and both profiles default to 5001. Left alone, a test launched
 * while the developer's Lumen is running would fail to bind, fall through to
 * *their* daemon on 5001, and pin test files into their real repository.
 */
/**
 * A port pair per suite, derived from its name.
 *
 * Not one shared pair: two spec files launching at once would both try to bind
 * it, and the second daemon would lose - then answer from the first one's
 * repository, which is the contamination this exists to prevent, only between
 * tests instead of with the developer.
 */
function portsFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 200;
  return { api: 5300 + h, gateway: 8300 + h };
}

function seedPorts(profileDir: string, name: string) {
  const { api, gateway } = portsFor(name);
  const file = join(profileDir, 'settings.json');
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    current = {};
  }
  writeFileSync(
    file,
    JSON.stringify(
      {
        ...current,
        ipfsApiBase: `http://127.0.0.1:${api}`,
        localGatewayBase: `http://127.0.0.1:${gateway}`
      },
      null,
      2
    ),
    'utf8'
  );
}

export type LaunchedApp = {
  app: ElectronApplication;
  /** Everything the main process wrote, for assertions about boot. */
  output: () => string;
  profileDir: string;
  /** Where this suite's own daemon listens, for building URLs to serve from. */
  ports: { api: number; gateway: number };
};

/**
 * @param name a profile per suite, so one test's settings cannot explain
 *   another's result. Reused across runs on purpose: a first boot initialises a
 *   Kubo repository, which is slow.
 */
export async function launchApp(
  name = 'default',
  opts: { fresh?: boolean; env?: Record<string, string> } = {}
): Promise<LaunchedApp> {
  const profileDir = join(tmpdir(), `lumen-e2e-${name}`);
  if (opts.fresh) rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });
  seedPorts(profileDir, name);

  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  // Some toolchains export this so `electron` behaves as a plain node. Inherited
  // here, the binary refuses Chromium's own switches and exits before the app
  // exists - with "bad option", which is a node error message.
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    args: ['.'],
    env: {
      ...env,
      LUMEN_USER_DATA_DIR: profileDir,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
      LUMEN_GATEWAY_HEALTH_MONITOR: '0',
      ...(opts.env || {})
    }
  });

  const chunks: string[] = [];
  app.process().stdout?.on('data', (d) => chunks.push(String(d)));
  app.process().stderr?.on('data', (d) => chunks.push(String(d)));

  await app.firstWindow({ timeout: LAUNCH_TIMEOUT });
  return { app, output: () => chunks.join(''), profileDir, ports: portsFor(name) };
}

/**
 * Whichever window is open right now, loaded.
 *
 * Never a reference kept from earlier: the splash closes when the main window
 * takes over, and a page captured before that is dead by the next line.
 */
export async function liveWindow(app: ElectronApplication, timeoutMs = 60_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const open = app.windows().filter((w) => !w.isClosed());
    if (open.length) {
      const w = open[open.length - 1];
      try {
        await w.waitForLoadState('domcontentloaded');
        return w;
      } catch {
        // It closed between the filter and the wait; look again.
      }
    }
    if (Date.now() > deadline) throw new Error('the app has no open window');
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Run something in the app, retrying while the window under it is replaced.
 *
 * The splash can close between being handed out and being used, and the error
 * for that ("Target page... has been closed") is indistinguishable from a real
 * failure to a caller - `expect.poll` in particular treats it as fatal rather
 * than retrying. Everything a test asks the app should go through here.
 */
export async function evalInApp<R, A>(
  app: ElectronApplication,
  fn: (arg: A) => R | Promise<R>,
  arg?: A,
  timeoutMs = 30_000
): Promise<R> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const w = await windowWithBridge(app, Math.max(1_000, deadline - Date.now()));
    try {
      return (await w.evaluate(fn as never, arg as never)) as R;
    } catch (e) {
      const message = String((e as Error)?.message || e);
      if (!/has been closed|Target closed|Execution context/i.test(message)) throw e;
      if (Date.now() > deadline) throw e;
    }
  }
}

/**
 * Runs something in the app exactly once, whatever happens to the window.
 *
 * `evalInApp` retries when the page under it is replaced, which is right for a
 * question and wrong for an instruction: an IPC call that already reached the
 * main process is not undone by the page that made it going away. Retrying one
 * sends it twice - measured on the real chain, where a transfer the harness
 * thought had failed had in fact gone out, and the retry sent it again.
 *
 * Anything that writes - a transfer, a profile import - goes through here, and
 * a window that dies mid-call is a failure to be reported, not to be papered
 * over: only the caller knows whether repeating it is safe.
 */
export async function evalInAppOnce<R, A>(
  app: ElectronApplication,
  fn: (arg: A) => R | Promise<R>,
  arg?: A
): Promise<R> {
  const w = await appWindow(app);
  await w.waitForFunction(() => typeof (window as any).lumen === 'object', null, {
    timeout: 30_000
  });
  return (await w.evaluate(fn as never, arg as never)) as R;
}

/**
 * The app's own window, never the splash.
 *
 * Both are open at once for a while, both load the same Vue app, and the splash
 * is the one `windows()` hands back last - so a test that clicks "the window"
 * clicks a loading screen with nothing on it. The splash carries `?splash=1`.
 */
export async function appWindow(app: ElectronApplication, timeoutMs = 60_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const open = app.windows().filter((w) => !w.isClosed());
    const main = open.find((w) => !w.url().includes('splash'));
    if (main) {
      try {
        await main.waitForLoadState('domcontentloaded');
        return main;
      } catch {
        // Replaced under us; look again.
      }
    }
    if (Date.now() > deadline) throw new Error('the app never opened its main window');
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** The window with the bridge attached, which is the one a test wants. */
export async function windowWithBridge(app: ElectronApplication, timeoutMs = 60_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const w = await liveWindow(app, Math.max(1_000, deadline - Date.now()));
    try {
      await w.waitForFunction(() => typeof (window as any).lumen === 'object', null, {
        timeout: 5_000
      });
      return w;
    } catch {
      if (Date.now() > deadline) throw new Error('no window ever exposed window.lumen');
    }
  }
}
