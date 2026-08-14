import { test, expect, type ElectronApplication } from '@playwright/test';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NO_DISPLAY, NO_DISPLAY_REASON, closeApp, evalInApp, launchApp, expectOk } from './support/launch';

test.skip(NO_DISPLAY, NO_DISPLAY_REASON);
test.describe.configure({ mode: 'serial' });

/**
 * Getting a wallet out of the app and back in.
 *
 * The only recovery path there is: lose this and the keys are gone, since
 * nothing about them exists on a server. Two routes out - a JSON copy of the
 * profile, and a full backup written to a folder the user picks - and the
 * second was untestable until the picker could be answered from the test.
 */

let app: ElectronApplication;
let backupDir: string;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  ({ app } = await launchApp('backup', { fresh: true }));
  backupDir = join(tmpdir(), `lumen-e2e-backup-${Date.now()}`);
  mkdirSync(backupDir, { recursive: true });

  // The native folder picker cannot be clicked by a test; answer it in the main
  // process instead. `dialog` is a property of the same electron module object
  // the handlers destructured, so patching it reaches them.
  await app.evaluate(({ dialog }, dir) => {
    (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [dir] });
    (dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: `${dir}/saved.json` });
  }, backupDir);
});

test.afterAll(async () => {
  await closeApp(app);
  rmSync(backupDir, { recursive: true, force: true });
});

const list = () => evalInApp(app, () => (window as any).lumen.profiles.list()) as Promise<any>;

test('exports a profile as JSON that carries its identity', async () => {
  const created = (await evalInApp(app, () => (window as any).lumen.profiles.create('Backup Me'))) as any;

  const json = (await evalInApp(app, (id) => (window as any).lumen.profiles.export(id), created.id)) as string;
  expect(typeof json).toBe('string');

  const parsed = JSON.parse(json);
  expect(parsed.id).toBe(created.id);
  expect(parsed.walletAddress).toBe(created.walletAddress);
});

test('that JSON restores the profile but not a usable wallet', async () => {
  // Worth pinning, because the file looks like a backup: it carries the
  // address, so a restored row shows the right account - and cannot sign for
  // it. The keys are not in there. exportBackup below is the real one.
  const before = await list();
  const target = before.profiles.find((p: any) => p.name === 'Backup Me');
  expect(target).toBeTruthy();

  const json = (await evalInApp(app, (id) => (window as any).lumen.profiles.export(id), target.id)) as string;

  // The handler answers with the list it kept, rather than an ok flag.
  const deleted = (await evalInApp(app, (id) => (window as any).lumen.profiles.delete(id), target.id)) as any;
  expect(deleted.profiles.map((p: any) => p.id)).not.toContain(target.id);
  expect((await list()).profiles.map((p: any) => p.id)).not.toContain(target.id);

  const imported = (await evalInApp(app, (j) => (window as any).lumen.profiles.import(j), json)) as any;
  expect(imported).toBeTruthy();

  const after = await list();
  const restored = after.profiles.find((p: any) => p.name === 'Backup Me');
  expect(restored).toBeTruthy();
  expect(restored.walletAddress).toBe(target.walletAddress);

  const usable = (await evalInApp(
    app,
    (id) => (window as any).lumen.profiles.isWalletFullyCreated(id),
    restored.id
  )) as any;
  expect(usable.ok, 'a JSON import brings back the row, never the keys').toBe(false);
});

test('refuses to import something that is not a profile', async () => {
  const before = (await list()).profiles.length;

  for (const junk of ['', 'not json at all', '{}', '{"name":""}']) {
    const res = await evalInApp(app, (j) => (window as any).lumen.profiles.import(j), junk);
    expect(res).toBeFalsy();
  }

  expect((await list()).profiles.length).toBe(before);
});

test('writes a backup to the folder the user picks', async () => {
  // A profile with its keys, not the row restored above: the app refuses to
  // back up a wallet it cannot find a keystore for, which is the right answer.
  const fresh = (await evalInApp(app, () => (window as any).lumen.profiles.create('Real Backup'))) as any;

  const res = (await evalInApp(
    app,
    (id) => (window as any).lumen.profiles.exportBackup(id, '', false),
    fresh.id,
    120_000
  )) as any;

  expectOk(res, 'backup export');
  // Something was actually written; the shape of the file is the app's business,
  // its existence is the user's.
  expect(readdirSync(backupDir).length).toBeGreaterThan(0);
});

test('restores a signing wallet from that backup after the profile is gone', async () => {
  test.setTimeout(120_000);
  const target = (await list()).profiles.find((p: any) => p.name === 'Real Backup');
  const address = target.walletAddress;

  await evalInApp(app, (id) => (window as any).lumen.profiles.delete(id), target.id);
  expect((await list()).profiles.map((p: any) => p.name)).not.toContain('Real Backup');

  const res = (await evalInApp(app, () => (window as any).lumen.profiles.importBackup(), undefined, 120_000)) as any;
  expectOk(res, 'backup import');

  const restored = (await list()).profiles.find((p: any) => p.walletAddress === address);
  expect(restored, 'the backup restored a profile with the original address').toBeTruthy();

  // The difference from the JSON route, and the reason this path exists.
  const usable = (await evalInApp(
    app,
    (id) => (window as any).lumen.profiles.isWalletFullyCreated(id),
    restored.id
  )) as any;
  expect(usable.ok, 'the backup restored the keys, not just the row').toBe(true);
});
