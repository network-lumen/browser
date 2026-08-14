import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
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

/**
 * Asserts a bridge call succeeded, and says why when it did not.
 *
 * Every handler in this app answers `{ ok, error }`, and `expect(res.ok)
 * .toBe(true)` throws the error away - so a red CI run reads "Expected: true,
 * Received: false" and the one string that would explain it is gone. That cost
 * a round trip on an IPNS publish nobody could reproduce locally: the process
 * knew it had timed out and the assertion did not pass it on.
 */
export function expectOk(
  result: { ok?: boolean; error?: unknown } | null | undefined,
  what: string
): void {
  const reason = result?.error === undefined ? 'no error given' : String(result.error);
  expect(result?.ok, `${what} failed: ${reason}`).toBe(true);
}

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

/**
 * A profile directory with nothing in it.
 *
 * Deleting the usual one is the obvious way and not a reliable one: on Windows
 * a process that was just killed still holds its Chromium cache files for a
 * moment, and `rmSync` fails with EBUSY - failing a test for a reason that has
 * nothing to do with what it was checking. What `fresh` actually asks for is an
 * empty directory, and a new name gives that unconditionally.
 */
function emptyProfileDir(name: string) {
  const preferred = join(tmpdir(), `lumen-e2e-${name}`);
  try {
    rmSync(preferred, { recursive: true, force: true });
    return preferred;
  } catch {
    return join(tmpdir(), `lumen-e2e-${name}-${Date.now().toString(36)}`);
  }
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
  const profileDir = opts.fresh ? emptyProfileDir(name) : join(tmpdir(), `lumen-e2e-${name}`);
  mkdirSync(profileDir, { recursive: true });
  seedPorts(profileDir, name);

  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  // Some toolchains export this so `electron` behaves as a plain node. Inherited
  // here, the binary refuses Chromium's own switches and exits before the app
  // exists - with "bad option", which is a node error message.
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    // `--lang` pins Chromium's own locale, which is what `navigator.languages`
    // reports. LUMEN_SYSTEM_LANGUAGES below covers the other half - what the
    // main process reports the OS is set to - and the renderer consults both.
    args: ['.', '--lang=en-US'],
    env: {
      ...env,
      LUMEN_USER_DATA_DIR: profileDir,
      VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173',
      LUMEN_GATEWAY_HEALTH_MONITOR: '0',
      // A profile that has never chosen a language follows the OS, so on a
      // French machine every assertion about an English label fails - and the
      // suite's result would depend on whose laptop it ran on.
      LUMEN_SYSTEM_LANGUAGES: 'en',
      ...(opts.env || {})
    }
  });

  const chunks: string[] = [];
  app.process().stdout?.on('data', (d) => chunks.push(String(d)));
  app.process().stderr?.on('data', (d) => chunks.push(String(d)));

  // Anything that reads like the app falling over goes straight to the run's
  // output. A failure here is a window that never appeared or a process that
  // never quit, and the reason is always in the app's own log - which was
  // captured and then never printed, so a red CI run said what happened and
  // never why. Filtered rather than echoed whole: a full boot is thousands of
  // lines of renderer console.
  const shout = (d: unknown) => {
    for (const line of String(d).split('\n')) {
      if (/\b(FATAL|sandbox|crashed|EADDRINUSE|Unable to load preload|uncaught|unhandled)\b/i.test(line)) {
        console.error(`[app:${name}] ${line.trim()}`);
      }
    }
  };
  app.process().stdout?.on('data', shout);
  app.process().stderr?.on('data', shout);

  await app.firstWindow({ timeout: LAUNCH_TIMEOUT });
  return { app, output: () => chunks.join(''), profileDir, ports: portsFor(name) };
}

/**
 * Closes the app, and stops waiting if it will not go.
 *
 * `app.close()` resolves when the process exits, and the process does not exit
 * while the Kubo daemon it started is still shutting down. On a cold CI profile
 * that outlasted the 240s hook budget and failed a run whose 64 tests had all
 * passed - and `.catch()` on it never fired, because the promise does not
 * reject, it simply never settles.
 *
 * The grace period is long enough that a healthy shutdown always wins, so on a
 * developer's machine nothing changes and no Kubo process is ever orphaned
 * holding a repository lock. Past it, the test is over and what matters is that
 * the process is gone.
 */
export async function closeApp(app: ElectronApplication | null | undefined, graceMs = 20_000) {
  if (!app) return;

  let timer: NodeJS.Timeout | undefined;
  const gaveUp = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  try {
    await Promise.race([app.close().catch(() => {}), gaveUp]);
  } finally {
    clearTimeout(timer);
  }

  const proc = (() => {
    try {
      return app.process();
    } catch {
      return null;
    }
  })();
  if (!proc || proc.exitCode !== null) return;

  // Killing the process is not enough on its own. The stdout/stderr readers
  // attached at launch keep the pipes referenced, and the Kubo daemon Electron
  // spawned inherits them - so after a SIGKILL the streams never end and the
  // Playwright worker hangs at teardown instead of exiting. All 32 tests pass
  // and the run still fails, which is how this was found.
  try {
    proc.stdout?.removeAllListeners();
    proc.stderr?.removeAllListeners();
    proc.stdout?.destroy();
    proc.stderr?.destroy();
  } catch {
    // Already torn down.
  }

  try {
    proc.kill('SIGKILL');
  } catch {
    return;
  }

  // Wait for the exit we just asked for, briefly: leaving before the process is
  // reaped is what leaves a handle open behind us.
  await new Promise<void>((resolve) => {
    const done = setTimeout(resolve, 5_000);
    proc.once('exit', () => {
      clearTimeout(done);
      resolve();
    });
  });
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
