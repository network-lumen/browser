import { test, expect, type ElectronApplication } from '@playwright/test';
import { NO_DISPLAY, NO_DISPLAY_REASON, appWindow, closeApp, evalInApp, launchApp, windowWithBridge } from './support/launch';

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
test.describe.configure({ mode: 'serial' });

/**
 * `window.lumen` inside a site, which is the product.
 *
 * A page served from IPFS gets an API the rest of the web does not: pinning,
 * site data, a wallet. Where that line falls is the whole security model, and
 * nothing tested it - the renderer suite mocks the bridge in the app's own
 * window and never opens a webview at all.
 *
 * A real page here: a file put into the profile's own daemon and fetched back
 * through its own gateway, so the boundary is judged on a genuine `/ipfs/` URL.
 */

let app: ElectronApplication;
let gatewayPort: number;
let siteCid = '';

const PAGE = '<!doctype html><title>e2e site</title><h1 id="marker">lumen e2e site</h1>';

test.beforeAll(async () => {
  test.setTimeout(240_000);
  // Fresh, and it has to be: "Always allow" is written to the profile, so a
  // reused one would have granted the permission a previous run asked for and
  // the prompt would never appear again.
  ({ app, ports: { gateway: gatewayPort } } = await launchApp('site', { fresh: true }));

  await expect
    .poll(
      async () => {
        try {
          return ((await evalInApp(app, () => (window as any).lumen.ipfsStatus())) as any)?.ok === true;
        } catch {
          return false;
        }
      },
      { timeout: 120_000, intervals: [1_000] }
    )
    .toBe(true);

  const added = (await evalInApp(
    app,
    (html) => (window as any).lumen.ipfsAdd(new TextEncoder().encode(html as string), 'index.html'),
    PAGE
  )) as any;
  siteCid = added.cid;

  // Past the first-run overlays: profile creation is mandatory by design, and
  // the modal sits over everything a navigation would touch.
  const profile = (await evalInApp(app, () => (window as any).lumen.profiles.create('Site Tester'))) as any;
  const w = await windowWithBridge(app);
  await w.evaluate((id) => {
    localStorage.setItem(`lumen_wallet_onboarding_completed_${id}`, 'true');
    localStorage.setItem('lumen:onboarding:discover:v1', '1');
  }, profile.id);
  await w.reload();
  await windowWithBridge(app);
});

test.afterAll(async () => {
  await closeApp(app);
});

/** Drive the address bar, the way the renderer suite does. */
async function openUrl(url: string) {
  const w = await appWindow(app);
  const bar = w.locator('input[type="search"], input[type="text"]').first();
  await bar.click();
  await bar.fill(url);
  await bar.press('Enter');
}

/**
 * What a page actually got, read from the main process.
 *
 * A `<webview>` is its own WebContents; Playwright lists windows, not guests,
 * so the only way in is to ask Electron for the one showing this URL.
 */
async function inGuest(urlPart: string, expression: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await app.evaluate(
      async ({ webContents }, [needle, expr]) => {
        const guest = webContents
          .getAllWebContents()
          .find((wc) => !wc.isDestroyed() && wc.getURL().includes(needle as string));
        if (!guest) return { found: false as const };
        if (guest.isLoading()) return { found: false as const };
        try {
          return { found: true as const, value: await guest.executeJavaScript(expr as string) };
        } catch (e) {
          return { found: false as const, error: String((e as Error)?.message || e) };
        }
      },
      [urlPart, expression]
    );
    if (res.found) return res.value;
    if (Date.now() > deadline) throw new Error(`no loaded guest for ${urlPart}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

test('a page served from IPFS gets window.lumen', async () => {
  await openUrl(`http://127.0.0.1:${gatewayPort}/ipfs/${siteCid}`);

  const marker = await inGuest(siteCid, 'document.getElementById("marker")?.textContent || ""');
  expect(marker).toContain('lumen e2e site');

  const type = await inGuest(siteCid, 'typeof window.lumen');
  expect(type).toBe('object');
});

test('and it is the site API, not the app one', async () => {
  // Two different objects with the same name in two realms. The site gets Pin
  // and siteData; it must never get the app's settings or profile management.
  const shape = (await inGuest(
    siteCid,
    `JSON.stringify({
       pin: typeof window.lumen.Pin,
       siteData: typeof window.lumen.siteData?.get,
       wallet: typeof window.lumen.wallet?.requestSend,
       settings: typeof window.lumen.settingsGetAll,
       profilesCreate: typeof window.lumen.profiles?.create
     })`
  )) as string;

  expect(JSON.parse(shape)).toEqual({
    pin: 'function',
    siteData: 'function',
    wallet: 'function',
    settings: 'undefined',
    profilesCreate: 'undefined'
  });
});

/** Start a call in the site and leave it pending, so the modal can be answered. */
async function callInGuest(expression: string) {
  await app.evaluate(async ({ webContents }, expr) => {
    const guest = webContents
      .getAllWebContents()
      .find((wc) => !wc.isDestroyed() && wc.getURL().includes('/ipfs/'));
    // Not awaited: the promise only settles once the user has answered.
    void guest?.executeJavaScript(
      `window.__e2e = window.__e2e || {}; window.__e2e.pending = ${expr}; true;`
    );
  }, expression);
}

const guestResult = () => inGuest(siteCid, 'window.__e2e.pending.then(r => JSON.stringify(r))', 60_000);

/** What a refusal looks like, captured once so the granted case can differ from it. */
let denialError = '';

test('asking to pin raises a permission prompt, and Deny is an answer', async () => {
  // The gate in front of everything a site can ask for. A site must not be able
  // to pin, spend or publish without the person seeing it first.
  const w = await appWindow(app);
  await callInGuest(`window.lumen.Pin(${JSON.stringify(siteCid)})`);

  const deny = w.getByRole('button', { name: 'Deny' });
  await expect(deny).toBeVisible({ timeout: 20_000 });
  await deny.click();

  const answer = JSON.parse((await guestResult()) as string);
  expect(answer.ok).toBe(false);
  denialError = String(answer.error || '');
  expect(denialError).toBeTruthy();
});

test('"Always allow" is remembered, so the second ask does not prompt', async () => {
  const w = await appWindow(app);
  await callInGuest(`window.lumen.Pin(${JSON.stringify(siteCid)})`);

  const always = w.getByRole('button', { name: 'Always allow' });
  await expect(always).toBeVisible({ timeout: 20_000 });
  await always.click();
  await guestResult();

  // The cooldown between modals is three seconds; a second ask that prompts
  // again would be a permission the user thought they had granted for good.
  await new Promise((r) => setTimeout(r, 3_500));
  await callInGuest(`window.lumen.Pin(${JSON.stringify(siteCid)})`);

  await expect(w.getByRole('button', { name: 'Deny' })).toBeHidden({ timeout: 10_000 });

  // A refusal comes back at once; a granted pin goes on to talk to a gateway
  // this profile has not subscribed to, and takes its time failing. So "still
  // running after ten seconds" is itself proof it was not refused - and waiting
  // for the gateway to give up would add two minutes to the suite.
  const second = (await inGuest(
    siteCid,
    `Promise.race([
       window.__e2e.pending.then(r => JSON.stringify(r)),
       new Promise(r => setTimeout(() => r("STILL RUNNING"), 10000))
     ])`,
    30_000
  )) as string;

  if (second !== 'STILL RUNNING') {
    expect(String(JSON.parse(second).error || ''), 'the remembered grant must not be re-asked').not.toBe(
      denialError
    );
  }
});

test('a page that is not IPFS-served gets nothing', async () => {
  // Same origin, same gateway, a path that is not /ipfs/ - the boundary is the
  // path, not the host, and this is the half that must stay closed.
  //
  // Navigated in the tab that already exists rather than through the address
  // bar: once a site is showing, the bar is behind the webview as far as a
  // click is concerned, and this test is about the preload, not the chrome.
  const target = `http://127.0.0.1:${gatewayPort}/webui`;
  await app.evaluate(async ({ webContents }, url) => {
    const guest = webContents
      .getAllWebContents()
      .find((wc) => !wc.isDestroyed() && wc.getURL().includes('/ipfs/'));
    await guest?.loadURL(url as string).catch(() => {});
  }, target);

  const type = await inGuest('/webui', 'typeof window.lumen');
  expect(type).toBe('undefined');
});
