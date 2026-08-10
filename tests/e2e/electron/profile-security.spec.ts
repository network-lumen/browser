import { test, expect, type ElectronApplication } from '@playwright/test';
import {
  NO_DISPLAY,
  NO_DISPLAY_REASON,
  closeApp,
  evalInApp,
  evalInAppOnce,
  launchApp,
  windowWithBridge
} from './support/launch';

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
test.describe.configure({ mode: 'serial' });

/**
 * The wallet's front door.
 *
 * Creating a profile mints a mnemonic and writes a keystore; setting a password
 * re-encrypts every one of them away from the machine secret; locking forgets
 * the password until it is given again. Between them they are what stands
 * between a stolen laptop and a drained wallet, and none of it was exercised
 * outside unit tests of the crypto - which cannot say whether the app wires it
 * together.
 *
 * A fresh profile directory each run: these assertions are about going from
 * nothing to protected, and a leftover password would make them lie.
 */

let app: ElectronApplication;

/** Per test, never cached - the splash closes under a held reference. */
const bridge = () => windowWithBridge(app);

const PASSWORD = 'e2e-correct-horse';

test.beforeAll(async () => {
  test.setTimeout(240_000);
  ({ app } = await launchApp('security', { fresh: true }));
  await bridge();
});

test.afterAll(async () => {
  await closeApp(app);
});

test('starts with no profile and no password', async () => {
  const state = await evalInApp(app, async () => {
    const l = (window as any).lumen;
    return { profiles: await l.profiles.list(), security: await l.security.getStatus() };
  });

  expect(state.profiles.profiles).toEqual([]);
  expect(state.security.hasPassword).toBe(false);
});

test('creating a profile mints a wallet address', async () => {
  const created = await evalInAppOnce(app, () => (window as any).lumen.profiles.create('E2E Tester'));

  expect(created).toBeTruthy();
  expect(created.role).not.toBe('guest');
  // bech32 on the chain's own prefix: proof a key was actually derived, not a
  // placeholder row written to a JSON file.
  expect(String(created.walletAddress)).toMatch(/^lmn1[0-9a-z]{38,}$/);

  const list = await evalInApp(app, () => (window as any).lumen.profiles.list());
  expect(list.profiles.map((p: any) => p.id)).toContain(created.id);
});

test('refuses a password too short to be worth having', async () => {
  const res = await evalInAppOnce(app, () => (window as any).lumen.security.setPassword({ password: 'abc' }));
  expect(res).toMatchObject({ ok: false, error: 'password_too_short' });

  const status = await evalInApp(app, () => (window as any).lumen.security.getStatus());
  expect(status.hasPassword).toBe(false);
});

test('setting a password turns protection on and leaves the session open', async () => {
  const res = await evalInAppOnce(app, (p) => (window as any).lumen.security.setPassword({ password: p }), PASSWORD);
  expect(res.ok).toBe(true);

  const status = await evalInApp(app, () => (window as any).lumen.security.getStatus());
  expect(status.hasPassword).toBe(true);

  // Setting it must not lock the user out of the app they are using.
  const session = await evalInApp(app, () => (window as any).lumen.security.checkSession());
  expect(session.active).toBe(true);
});

test('the wrong password is refused and the right one accepted', async () => {
  const wrong = await evalInAppOnce(app, () => (window as any).lumen.security.verifyPassword({ password: 'not-it' }));
  expect(wrong.ok).toBe(false);

  const right = await evalInAppOnce(app, (p) => (window as any).lumen.security.verifyPassword({ password: p }), PASSWORD);
  expect(right.ok).toBe(true);
});

test('locking forgets the password until it is given again', async () => {
  await evalInAppOnce(app, () => (window as any).lumen.security.lockSession());

  const locked = await evalInApp(app, () => (window as any).lumen.security.checkSession());
  expect(locked.active).toBe(false);

  // Verifying is how the unlock screen re-establishes the session.
  const unlocked = await evalInAppOnce(app, (p) => (window as any).lumen.security.verifyPassword({ password: p }), PASSWORD);
  expect(unlocked.ok).toBe(true);

  const after = await evalInApp(app, () => (window as any).lumen.security.checkSession());
  expect(after.active).toBe(true);
});

test('the password survives a restart, and the session does not', async () => {
  // The distinction that matters after closing the laptop: the protection is on
  // disk, the permission to use it is not.
  await closeApp(app);
  ({ app } = await launchApp('security'));

  const state = await evalInApp(app, async () => {
    const l = (window as any).lumen;
    return { security: await l.security.getStatus(), session: await l.security.checkSession() };
  });

  expect(state.security.hasPassword).toBe(true);
  expect(state.session.active).toBe(false);
});
