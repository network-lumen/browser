import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Backing up a wallet and getting it back.
 *
 * The only path where a user can lose everything, and the only one where they
 * can restore something that looks fine and cannot sign: the chain records the
 * hash of the profile's Dilithium key on its first transaction and refuses
 * every later one signed without it. A backup that carries the mnemonic and
 * not the PQC key restores an address that is permanently unusable, and
 * nothing about it looks wrong.
 *
 * So the round trip is tested as a whole - create, export, wipe, import - and
 * what is asserted is that both secrets came back.
 */

type Handler = (...args: any[]) => any;

const handlers = new Map<string, Handler>();
let userData = '';
/** What the next dialog call returns, oldest first. */
let dialogQueue: Array<{ canceled?: boolean; filePaths?: string[] }> = [];

const ADDRESS = 'lmn1ndq47dk3yha8255s48ukxwa8ythfphqp4j4mxp';

function load() {
  const stub = stubElectron({
    ipcMain: {
      handle: (c: string, fn: Handler) => handlers.set(c, fn),
      on: (c: string, fn: Handler) => handlers.set(c, fn),
      removeHandler: () => {}
    },
    dialog: {
      showOpenDialog: async () => dialogQueue.shift() ?? { canceled: true },
      showSaveDialog: async () => dialogQueue.shift() ?? { canceled: true }
    },
    BrowserWindow: { getAllWindows: () => [], fromWebContents: () => null }
  });
  userData = stub.userData;
  const profiles = stub.load<{ registerProfilesIpc: () => void }>('ipc/profiles.cjs');
  profiles.registerProfilesIpc();
  return stub;
}

const call = (channel: string, ...args: any[]) => handlers.get(channel)!(null, ...args);

/** The Dilithium key material a real profile would have on disk. */
function plantPqcKey(address: string, keyName = 'profile:test') {
  const dir = join(userData, 'pqc_keys');
  mkdir(dir);
  writeFileSync(
    join(dir, 'keys.json'),
    JSON.stringify({
      [keyName]: {
        name: keyName,
        scheme: 'dilithium3',
        publicKey: 'cHVibGljLWtleS1ieXRlcw==',
        privateKey: 'cHJpdmF0ZS1rZXktYnl0ZXM=',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    }),
    'utf8'
  );
  writeFileSync(join(dir, 'links.json'), JSON.stringify({ [address]: keyName }), 'utf8');
}

function mkdir(p: string) {
  // ensureDir lives in the module under test; the test plants files of its own.
  require('node:fs').mkdirSync(p, { recursive: true });
}

beforeEach(() => {
  handlers.clear();
  dialogQueue = [];
  load();
});

describe('exporting a profile', () => {
  it('refuses a profile whose wallet was never finished', async () => {
    // The profile row exists but no keystore does. Exporting it would produce
    // a backup that restores an account nobody can sign for.
    const dir = join(userData, 'profiles', 'ghost');
    mkdir(dir);
    writeFileSync(
      join(userData, 'profiles.json'),
      JSON.stringify({ profiles: [{ id: 'ghost', name: 'Ghost', role: 'user', walletAddress: ADDRESS }], activeId: 'ghost' }),
      'utf8'
    );
    const out = mkdtempSync(join(tmpdir(), 'lumen-backup-'));
    dialogQueue.push({ filePaths: [out] });

    expect(await call('profiles:exportBackup', 'ghost')).toMatchObject({
      ok: false,
      error: 'keystore_missing'
    });
    rmSync(out, { recursive: true, force: true });
  });

  it('carries the mnemonic and the PQC key into the file', async () => {
    const profile = await call('profiles:create', 'Alice');
    expect(profile?.walletAddress).toMatch(/^lmn1/);
    plantPqcKey(profile.walletAddress);

    const out = mkdtempSync(join(tmpdir(), 'lumen-backup-'));
    dialogQueue.push({ filePaths: [out] });
    const res = await call('profiles:exportBackup', profile.id);
    expect(res.ok, res.error).toBe(true);

    const backup = JSON.parse(readFileSync(res.path, 'utf8'));
    expect(backup.walletAddress).toBe(profile.walletAddress);
    expect(String(backup.mnemonic || '').split(/\s+/).length).toBeGreaterThanOrEqual(12);
    // The half that is easy to lose, because it does not live in the profile.
    expect(backup.pqc).toMatchObject({ scheme: 'dilithium3', privateKey: 'cHJpdmF0ZS1rZXktYnl0ZXM=' });
    rmSync(out, { recursive: true, force: true });
  });
});

describe('the whole round trip', () => {
  it('restores a signable wallet on a machine that has nothing', async () => {
    const profile = await call('profiles:create', 'Alice');
    plantPqcKey(profile.walletAddress);

    const out = mkdtempSync(join(tmpdir(), 'lumen-backup-'));
    dialogQueue.push({ filePaths: [out] });
    const exported = await call('profiles:exportBackup', profile.id);
    expect(exported.ok, exported.error).toBe(true);
    const backup = JSON.parse(readFileSync(exported.path, 'utf8'));

    // A new machine: no profile list, no keystore, no PQC store.
    rmSync(join(userData, 'profiles.json'), { force: true });
    rmSync(join(userData, 'profiles'), { recursive: true, force: true });
    rmSync(join(userData, 'pqc_keys'), { recursive: true, force: true });
    expect(await call('profiles:list')).toMatchObject({ profiles: [] });

    dialogQueue.push({ filePaths: [exported.path] });
    const imported = await call('profiles:importBackup');
    expect(imported.ok, imported.error).toBe(true);

    const list = await call('profiles:list');
    const restored = list.profiles.find((p: any) => p.walletAddress === profile.walletAddress);
    expect(restored, 'the profile is back').toBeTruthy();

    // The mnemonic is back and readable with this machine's own secret - the
    // keystore was rebuilt, not copied.
    const keystore = JSON.parse(
      readFileSync(join(userData, 'profiles', restored.id, 'keystore.json'), 'utf8')
    );
    const { decryptMnemonicLocal } = require(join(process.cwd(), 'electron/utils/crypto.cjs'));
    expect(decryptMnemonicLocal(keystore)).toBe(backup.mnemonic);

    // And the PQC key, under a link pointing at the same address. Without this
    // the address would be restored and unable to sign, for good.
    const keys = JSON.parse(readFileSync(join(userData, 'pqc_keys', 'keys.json'), 'utf8'));
    const links = JSON.parse(readFileSync(join(userData, 'pqc_keys', 'links.json'), 'utf8'));
    const keyName = links[profile.walletAddress];
    expect(keyName, 'the address is linked to a key').toBeTruthy();
    expect(keys[keyName]).toMatchObject({ privateKey: 'cHJpdmF0ZS1rZXktYnl0ZXM=' });

    rmSync(out, { recursive: true, force: true });
  });

  it('restores the mnemonic but no PQC key when the backup had none', async () => {
    // Recorded because it is the silent trap: the import succeeds, the profile
    // appears, the address is right, and the wallet cannot sign once the chain
    // has a key hash for it. Nothing in the result says so.
    const profile = await call('profiles:create', 'Bob');
    const out = mkdtempSync(join(tmpdir(), 'lumen-backup-'));
    dialogQueue.push({ filePaths: [out] });
    const exported = await call('profiles:exportBackup', profile.id);
    expect(exported.ok, exported.error).toBe(true);
    expect(JSON.parse(readFileSync(exported.path, 'utf8')).pqc).toBeNull();

    rmSync(join(userData, 'profiles.json'), { force: true });
    rmSync(join(userData, 'profiles'), { recursive: true, force: true });

    dialogQueue.push({ filePaths: [exported.path] });
    expect((await call('profiles:importBackup')).ok).toBe(true);
    expect(existsSync(join(userData, 'pqc_keys', 'links.json'))).toBe(false);

    rmSync(out, { recursive: true, force: true });
  });
});

describe('editing the active profile', () => {
  it('keeps the other profiles, instead of emptying the list', async () => {
    // updateActiveProfile passed the whole {profiles, activeId} object where a
    // profiles array was expected, so the file came back with `profiles` as an
    // object - and loadProfilesFile turns any non-array into [], which is
    // every profile gone. Only setFavourite and removeFavourite reach it, and
    // nothing in the renderer calls them yet, so it never fired.
    const alice = await call('profiles:create', 'Alice');
    await call('profiles:create', 'Bob');
    await call('profiles:setActive', alice.id);

    await call('profiles:setFavourite', 'social.lmn', 'bafyabc');

    const list = await call('profiles:list');
    expect(list.profiles).toHaveLength(2);
    expect(await call('profiles:getFavourites')).toMatchObject({ 'social.lmn': 'bafyabc' });
  });
});
