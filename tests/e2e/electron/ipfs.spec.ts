import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { NO_DISPLAY, NO_DISPLAY_REASON, closeApp, evalInApp, launchApp, windowWithBridge } from './support/launch';

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
test.describe.configure({ mode: 'serial' });

/**
 * Content in and out of the node the app runs itself.
 *
 * Everything the browser is for goes through here: adding a file returns the
 * address it will be reachable at forever, pinning is what keeps it alive, and
 * IPNS is the only mutable name over the top. None of it was covered - the
 * renderer suite mocks the bridge, so it has never seen a real CID.
 *
 * The daemon is the profile's own, on ports nobody else uses: the harness pins
 * them before the first launch, because both profiles otherwise default to 5001
 * and a test would quietly write into the developer's repository.
 */

let app: ElectronApplication;

/**
 * Fetched per test, never cached: the splash window closes when the main one
 * takes over, and a page held from beforeAll is dead by the time it is used -
 * intermittently, depending on how long the suite before it took.
 */
const bridge = () => windowWithBridge(app);

test.beforeAll(async () => {
  test.setTimeout(240_000);
  ({ app } = await launchApp('ipfs'));
  // The daemon comes up after the window; every call below needs it.
  await expect
    .poll(
      async () => {
        try {
          const status = await evalInApp(app, () => (window as any).lumen.ipfsStatus());
          return (status as { ok?: boolean })?.ok === true;
        } catch {
          // The window is still being replaced; that is not an answer yet.
          return false;
        }
      },
      { timeout: 120_000, intervals: [1_000] }
    )
    .toBe(true);
});

test.afterAll(async () => {
  await closeApp(app);
});

const addText = (page: Page, text: string, name: string) =>
  page.evaluate(
    ([t, n]) => (window as any).lumen.ipfsAdd(new TextEncoder().encode(t as string), n as string),
    [text, name]
  );

test('adding a file gives back an address that is already pinned', async () => {
  const w = await bridge();
  const unique = `lumen e2e ${Date.now()}`;
  const added = await addText(w, unique, 'note.txt');

  expect(added.ok).toBe(true);
  // A CIDv0 or v1, not an empty string dressed up as success.
  expect(String(added.cid)).toMatch(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/);

  const pins = await w.evaluate(() => (window as any).lumen.ipfsPinList());
  expect(pins.ok).toBe(true);
  expect(pins.pins).toContain(added.cid);
});

test('the same bytes come back out', async () => {
  const w = await bridge();
  // The one property the whole app rests on: the address addresses the content.
  const unique = `round trip ${Date.now()}`;
  const added = await addText(w, unique, 'round.txt');

  const got = await w.evaluate((cid) => (window as any).lumen.ipfsGet(cid), added.cid);
  expect(got.ok).toBe(true);
  const text = typeof got.data === 'string' ? got.data : new TextDecoder().decode(new Uint8Array(got.data ?? []));
  expect(text).toContain(unique);
});

test('the same content added twice is the same address', async () => {
  const w = await bridge();
  // Content addressing, not upload receipts: a second add must not mint a new id.
  const text = 'deterministic content, identical twice';
  const first = await addText(w, text, 'a.txt');
  const second = await addText(w, text, 'b.txt');
  expect(second.cid).toBe(first.cid);
});

test('unpinning drops it from the list', async () => {
  const w = await bridge();
  const added = await addText(w, `to unpin ${Date.now()}`, 'temp.txt');
  expect((await w.evaluate(() => (window as any).lumen.ipfsPinList())).pins).toContain(added.cid);

  const removed = await w.evaluate((cid) => (window as any).lumen.ipfsUnpin(cid), added.cid);
  expect(removed.ok).toBe(true);

  const after = await w.evaluate(() => (window as any).lumen.ipfsPinList());
  expect(after.pins).not.toContain(added.cid);
});

test('an IPNS key publishes a CID and resolves back to it', async () => {
  const w = await bridge();
  test.setTimeout(120_000);
  const keyName = `e2e-${Date.now()}`;
  const key = await w.evaluate((n) => (window as any).lumen.ipfsKeyGen(n), keyName);
  expect(key.ok).toBe(true);

  const added = await addText(w, `named content ${Date.now()}`, 'named.txt');
  const published = await w.evaluate(
    ([cid, n]) => (window as any).lumen.ipfsPublishToIPNS(cid, n),
    [added.cid, keyName]
  );
  expect(published.ok).toBe(true);

  const name = String(published.name || key.id || '');
  expect(name).not.toBe('');

  const resolved = await w.evaluate((n) => (window as any).lumen.ipfsResolveIPNS(n), name);
  expect(resolved.ok).toBe(true);
  // The resolver answers with a path; the CID it points at is what matters.
  expect(String(resolved.path ?? resolved.cid ?? '')).toContain(added.cid);
});
