import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The security gate and profile store on the mobile target.
 *
 * `@capacitor/preferences` is stubbed with a plain Map rather than left to its
 * web fallback: the fallback is localStorage, which persists between test files
 * in the same jsdom and would let one test's wallet leak into the next.
 */
const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    remove: async ({ key }: { key: string }) => void store.delete(key),
    keys: async () => ({ keys: [...store.keys()] })
  }
}));

const { SECURITY_MEMBERS, clearSession, getSessionPassword } = await import(
  '../../platform/mobile/impl/security'
);
const { PROFILE_MEMBERS } = await import('../../platform/mobile/impl/profiles');
const { decryptWithPassword, encryptMnemonicLocal, resetAppSecretCache } = await import(
  '../../platform/mobile/impl/crypto'
);
const { resetSettingsCache } = await import('../../platform/mobile/impl/settings');
const storage = await import('../../platform/mobile/impl/storage');

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** A profile with a keystore, without going through the SDK's wallet minting. */
async function seedProfile(id: string, name: string) {
  await storage.writeDoc(storage.PROFILES_KEY, {
    profiles: [{ id, name, colorIndex: 1, role: 'user', walletAddress: `lmn1${id}` }],
    activeId: id
  });
  await storage.writeDoc(storage.keystoreKey(id), await encryptMnemonicLocal(MNEMONIC));
}

describe('mobile security gate', () => {
  beforeEach(() => {
    store.clear();
    clearSession();
    resetSettingsCache();
    resetAppSecretCache();
  });

  it('starts with no password and no session', async () => {
    const status = await SECURITY_MEMBERS['security.getStatus']();
    expect(status).toMatchObject({ passwordEnabled: false, hasPassword: false, sessionActive: false });
  });

  it('refuses a password under six characters', async () => {
    await expect(SECURITY_MEMBERS['security.setPassword']({ password: 'short' })).resolves.toEqual({
      ok: false,
      error: 'password_too_short'
    });
  });

  it('sets a password, re-seals the keystore under it, and opens a session', async () => {
    await seedProfile('acc_a', 'Alice');

    await expect(
      SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' })
    ).resolves.toEqual({ ok: true });

    // The point of the whole ordering dance: the keystore now needs the
    // password, and it is the password that was actually stored.
    const ks = await storage.readDoc<any>(storage.keystoreKey('acc_a'));
    expect(ks.passwordProtected).toBe(true);
    await expect(decryptWithPassword(ks, 'hunter2hunter2')).resolves.toBe(MNEMONIC);

    expect(getSessionPassword()).toBe('hunter2hunter2');
    const status = await SECURITY_MEMBERS['security.getStatus']();
    expect(status).toMatchObject({ passwordEnabled: true, hasPassword: true, sessionActive: true });
  });

  it('unlocks with the right password and refuses the wrong one', async () => {
    await seedProfile('acc_a', 'Alice');
    await SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' });
    clearSession();

    await expect(
      SECURITY_MEMBERS['security.verifyPassword']({ password: 'nope-nope' })
    ).resolves.toEqual({ ok: false, error: 'invalid_password' });
    expect(getSessionPassword()).toBeNull();

    await expect(
      SECURITY_MEMBERS['security.verifyPassword']({ password: 'hunter2hunter2' })
    ).resolves.toEqual({ ok: true });
    expect(getSessionPassword()).toBe('hunter2hunter2');
  });

  it('requires the current password to change one, and keeps the keystore readable', async () => {
    await seedProfile('acc_a', 'Alice');
    await SECURITY_MEMBERS['security.setPassword']({ password: 'first-password' });

    await expect(
      SECURITY_MEMBERS['security.setPassword']({ password: 'second-password' })
    ).resolves.toEqual({ ok: false, error: 'current_password_required' });

    await expect(
      SECURITY_MEMBERS['security.setPassword']({
        password: 'second-password',
        currentPassword: 'wrong-one'
      })
    ).resolves.toEqual({ ok: false, error: 'invalid_current_password' });

    await expect(
      SECURITY_MEMBERS['security.setPassword']({
        password: 'second-password',
        currentPassword: 'first-password'
      })
    ).resolves.toEqual({ ok: true });

    const ks = await storage.readDoc<any>(storage.keystoreKey('acc_a'));
    await expect(decryptWithPassword(ks, 'second-password')).resolves.toBe(MNEMONIC);
  });

  it('leaves the stored password alone when a keystore cannot be re-sealed', async () => {
    await seedProfile('acc_a', 'Alice');
    // A keystore that decrypts to nothing: the conversion must abort, and the
    // password must NOT be recorded - otherwise the wallet is sealed with one
    // the app cannot produce.
    await storage.writeDoc(storage.keystoreKey('acc_a'), {
      version: 1,
      createdAt: Date.now(),
      crypto: {
        cipher: 'aes-256-gcm',
        ciphertext: 'AAAA',
        iv: 'AAAAAAAAAAAAAAAA',
        tag: 'AAAAAAAAAAAAAAAAAAAAAA==',
        kdf: 'scrypt',
        kdfparams: { N: 16384, r: 8, p: 1, dklen: 32, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }
      }
    });

    const result = await SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' });
    expect(result.ok).toBe(false);

    const status = await SECURITY_MEMBERS['security.getStatus']();
    expect(status.hasPassword).toBe(false);
  });

  it('removes a password and puts the keystore back under the device secret', async () => {
    await seedProfile('acc_a', 'Alice');
    await SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' });

    await expect(
      SECURITY_MEMBERS['security.removePassword']({ password: 'hunter2hunter2' })
    ).resolves.toEqual({ ok: true });

    const ks = await storage.readDoc<any>(storage.keystoreKey('acc_a'));
    expect(ks.passwordProtected).toBeUndefined();
    expect(getSessionPassword()).toBeNull();
  });

  it('locks, and reports the session through onSessionChanged', async () => {
    const seen: boolean[] = [];
    const unsubscribe = SECURITY_MEMBERS['security.onSessionChanged']((p) => seen.push(p.active));

    await seedProfile('acc_a', 'Alice');
    await SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' });
    await SECURITY_MEMBERS['security.lockSession']();

    expect(seen).toEqual([true, false]);
    await expect(SECURITY_MEMBERS['security.checkSession']()).resolves.toEqual({ active: false });
    expect(() => unsubscribe()).not.toThrow();
  });

  it('refuses to extend a session that is not open', async () => {
    await expect(SECURITY_MEMBERS['security.touchSession']()).resolves.toEqual({
      ok: false,
      error: 'no_active_session'
    });
  });
});

describe('mobile profiles', () => {
  beforeEach(() => {
    store.clear();
    clearSession();
    resetSettingsCache();
    resetAppSecretCache();
  });

  it('lists nothing before anything exists', async () => {
    await expect(PROFILE_MEMBERS['profiles.list']()).resolves.toEqual({
      profiles: [],
      activeId: ''
    });
  });

  it('renames a profile and recolours it to match', async () => {
    await seedProfile('acc_a', 'Alice');
    const result: any = await PROFILE_MEMBERS['profiles.updateName']('acc_a', 'Bob');
    expect(result.ok).toBe(true);
    expect(result.profile.name).toBe('Bob');

    const active: any = await PROFILE_MEMBERS['profiles.getActive']();
    expect(active.name).toBe('Bob');
  });

  it('selects only a profile that exists', async () => {
    await seedProfile('acc_a', 'Alice');
    await expect(PROFILE_MEMBERS['profiles.select']('acc_a')).resolves.toBe('acc_a');
    await expect(PROFILE_MEMBERS['profiles.select']('acc_missing')).resolves.toBe('');
  });

  it('reports a wallet as complete only with both an address and a keystore', async () => {
    await seedProfile('acc_a', 'Alice');
    await expect(PROFILE_MEMBERS['profiles.isWalletFullyCreated']('acc_a')).resolves.toMatchObject({
      ok: true
    });

    await storage.removeDoc(storage.keystoreKey('acc_a'));
    await expect(PROFILE_MEMBERS['profiles.isWalletFullyCreated']('acc_a')).resolves.toEqual({
      ok: false,
      error: 'keystore_missing'
    });
  });

  it('says whether an export will need the password', async () => {
    await seedProfile('acc_a', 'Alice');
    await expect(
      PROFILE_MEMBERS['profiles.checkExportRequiresPassword']('acc_a')
    ).resolves.toEqual({ ok: true, requiresPassword: false });

    await SECURITY_MEMBERS['security.setPassword']({ password: 'hunter2hunter2' });
    await expect(
      PROFILE_MEMBERS['profiles.checkExportRequiresPassword']('acc_a')
    ).resolves.toEqual({ ok: true, requiresPassword: true });
  });

  it('deletes a profile and everything stored under it', async () => {
    await seedProfile('acc_a', 'Alice');
    const result: any = await PROFILE_MEMBERS['profiles.delete']('acc_a');
    expect(result.profiles).toEqual([]);
    expect(result.activeId).toBe('');
    expect(await storage.readDoc(storage.keystoreKey('acc_a'))).toBeNull();
  });

  it('keeps favourites on the active profile', async () => {
    await seedProfile('acc_a', 'Alice');
    await PROFILE_MEMBERS['profiles.setFavourite']('lumen.lmn', 'bafytest');
    await expect(PROFILE_MEMBERS['profiles.getFavourites']()).resolves.toEqual({
      'lumen.lmn': 'bafytest'
    });

    await PROFILE_MEMBERS['profiles.removeFavourite']('lumen.lmn');
    await expect(PROFILE_MEMBERS['profiles.getFavourites']()).resolves.toEqual({});
  });

  it('imports a manual mnemonic into a new profile', async () => {
    const result: any = await PROFILE_MEMBERS['profiles.importManual']({
      name: 'Restored',
      mnemonic: MNEMONIC
    });
    expect(result.ok).toBe(true);

    const { profiles } = await PROFILE_MEMBERS['profiles.list']();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Restored');
  });

  it('refuses a manual import with no mnemonic', async () => {
    await expect(PROFILE_MEMBERS['profiles.importManual']({ name: 'Nope' })).resolves.toEqual({
      ok: false,
      error: 'missing_mnemonic'
    });
  });
});
