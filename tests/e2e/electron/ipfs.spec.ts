import { test, expect, type ElectronApplication } from '@playwright/test';
import { NO_DISPLAY, NO_DISPLAY_REASON, closeApp, evalInApp, evalInAppOnce, launchApp, expectOk } from './support/launch';

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
 * No test here holds a window.
 *
 * `windowWithBridge` hands back the last window `windows()` reports, which is
 * the splash - it loads the same Vue app, so it has the bridge and answers
 * every call correctly right up to the moment the main window takes over and
 * it is destroyed. `beforeAll` waits for the daemon, not for the boot to
 * finish, and the four short tests below run in seconds: the splash was
 * routinely still the one being talked to by the time the IPNS test started,
 * and that one is long enough to still be mid-publish when the swap happened.
 * The failure landed on the publish every time, which read like a slow publish
 * rather than what it was.
 *
 * `evalInApp` re-acquires the window and retries; `evalInAppOnce` targets the
 * main window and never retries, for the calls a second attempt would break.
 */
const addText = (text: string, name: string) =>
  evalInApp(
    app,
    ([t, n]) => (window as any).lumen.ipfsAdd(new TextEncoder().encode(t as string), n as string),
    [text, name]
  ) as Promise<any>;

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

test('adding a file gives back an address that is already pinned', async () => {
  const unique = `lumen e2e ${Date.now()}`;
  const added = await addText(unique, 'note.txt');

  expectOk(added, 'ipfs add');
  // A CIDv0 or v1, not an empty string dressed up as success.
  expect(String(added.cid)).toMatch(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/);

  const pins = await evalInApp<any, void>(app, () => (window as any).lumen.ipfsPinList());
  expectOk(pins, 'pin list');
  expect(pins.pins).toContain(added.cid);
});

test('the same bytes come back out', async () => {
  // The one property the whole app rests on: the address addresses the content.
  const unique = `round trip ${Date.now()}`;
  const added = await addText(unique, 'round.txt');

  const got = await evalInApp<any, string>(app, (cid) => (window as any).lumen.ipfsGet(cid), added.cid);
  expectOk(got, 'ipfs get');
  const text = typeof got.data === 'string' ? got.data : new TextDecoder().decode(new Uint8Array(got.data ?? []));
  expect(text).toContain(unique);
});

test('the same content added twice is the same address', async () => {
  // Content addressing, not upload receipts: a second add must not mint a new id.
  const text = 'deterministic content, identical twice';
  const first = await addText(text, 'a.txt');
  const second = await addText(text, 'b.txt');
  expect(second.cid).toBe(first.cid);
});

test('unpinning drops it from the list', async () => {
  const added = await addText(`to unpin ${Date.now()}`, 'temp.txt');
  const pinned = await evalInApp<any, void>(app, () => (window as any).lumen.ipfsPinList());
  expect(pinned.pins).toContain(added.cid);

  // Not retried: the second unpin of a CID the first one already dropped comes
  // back as a failure, and the test would report it as the feature breaking.
  const removed = await evalInAppOnce<any, string>(app, (cid) => (window as any).lumen.ipfsUnpin(cid), added.cid);
  expectOk(removed, 'unpin');

  const after = await evalInApp<any, void>(app, () => (window as any).lumen.ipfsPinList());
  expect(after.pins).not.toContain(added.cid);
});

test('an IPNS key publishes a CID and resolves back to it', async () => {
  test.setTimeout(120_000);
  const keyName = `e2e-${Date.now()}`;
  // Not retried: a key that exists is refused, so a second attempt at one the
  // first call had already created reports as a broken keygen.
  const key = await evalInAppOnce<any, string>(app, (n) => (window as any).lumen.ipfsKeyGen(n), keyName);
  expectOk(key, 'ipns key generation');

  const added = await addText(`named content ${Date.now()}`, 'named.txt');
  // Safe to retry: republishing the same CID under the same key writes a record
  // with a higher sequence number that resolves to exactly the same place.
  const published = await evalInApp<any, string[]>(
    app,
    ([cid, n]) => (window as any).lumen.ipfsPublishToIPNS(cid, n),
    [added.cid, keyName],
    90_000
  );
  // This is the one that failed on CI with nothing to go on. Whatever the
  // handler knew - a publish timeout, a refused key, an API that was not up -
  // now travels with the failure instead of being discarded by the check.
  expectOk(published, 'ipns publish');

  const name = String(published.name || key.id || '');
  expect(name).not.toBe('');

  const resolved = await evalInApp<any, string>(app, (n) => (window as any).lumen.ipfsResolveIPNS(n), name);
  expectOk(resolved, 'ipns resolve');
  // The resolver answers with a path; the CID it points at is what matters.
  expect(String(resolved.path ?? resolved.cid ?? '')).toContain(added.cid);
});
