import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * Turning a password on, changing it, and taking it off.
 *
 * This is the path that could destroy a wallet. It used to walk the profiles
 * writing as it went, catch per profile, carry on, and store the new password
 * hash afterwards regardless - so one keystore that failed to convert stayed on
 * the old password while the app moved to the new one, and nothing could open
 * it again. There was no backup and no way back.
 *
 * The rule now is all or nothing: read and decrypt everything first, abort
 * before writing a single byte if any of it fails, and only then let the stored
 * hash move.
 */

type Security = {
  registerSecurityIpc: () => void;
};

const handlers = new Map<string, (evt: unknown, arg: unknown) => Promise<any>>();
let userData = '';
let crypto_: any;

function load() {
  handlers.clear();
  const stub = stubElectron({
    ipcMain: {
      handle: (c: string, fn: any) => handlers.set(c, fn),
      on: () => {},
      removeHandler: () => {}
    },
    BrowserWindow: { getAllWindows: () => [] },
    app: {
      getPath: () => userDataFor(stub),
      getAppPath: () => process.cwd(),
      isPackaged: false,
      on: () => {}
    }
  });
  userData = stub.userData;
  crypto_ = stub.load<any>('utils/crypto.cjs');
  stub.load<Security>('ipc/security.cjs').registerSecurityIpc();
  return stub;
}

function userDataFor(stub: { userData: string }) {
  return stub.userData;
}

const call = (channel: string, arg?: unknown) => handlers.get(channel)!(null, arg);

/** A profile row plus a keystore encrypted with the machine secret. */
function plantProfile(id: string, mnemonic: string) {
  const dir = join(userData, 'profiles', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'keystore.json'),
    JSON.stringify(crypto_.encryptMnemonicLocal(mnemonic), null, 2),
    'utf8'
  );
  const file = join(userData, 'profiles.json');
  let data: any = { profiles: [], activeId: '' };
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {}
  data.profiles.push({ id, name: id, role: 'user' });
  data.activeId = data.activeId || id;
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const keystoreOf = (id: string) =>
  JSON.parse(readFileSync(join(userData, 'profiles', id, 'keystore.json'), 'utf8'));

beforeEach(() => {
  load();
});

describe('turning a password on', () => {
  it('moves every keystore onto the password', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    plantProfile('p2', 'beta beta beta');

    expect(await call('security:setPassword', { password: 'hunter22' })).toMatchObject({ ok: true });

    for (const [id, mnemonic] of [['p1', 'alpha alpha alpha'], ['p2', 'beta beta beta']]) {
      const ks = keystoreOf(id);
      expect(crypto_.isPasswordProtected(ks), id).toBe(true);
      expect(crypto_.decryptMnemonicWithPassword(ks, 'hunter22')).toBe(mnemonic);
    }
  });

  it('refuses a password shorter than six characters and changes nothing', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    expect(await call('security:setPassword', { password: 'short' })).toMatchObject({
      ok: false,
      error: 'password_too_short'
    });
    expect(crypto_.isPasswordProtected(keystoreOf('p1'))).toBe(false);
  });

  it('leaves every keystore alone when one of them cannot be read', async () => {
    // The scenario that used to lose a wallet: one keystore fails, the others
    // are converted anyway, and the stored hash moves regardless.
    plantProfile('p1', 'alpha alpha alpha');
    plantProfile('broken', 'never mind');
    writeFileSync(
      join(userData, 'profiles', 'broken', 'keystore.json'),
      JSON.stringify({ crypto: { cipher: 'aes-256-gcm', ciphertext: 'bm90', iv: 'bm90', tag: 'bm90', kdf: 'scrypt', kdfparams: { N: 16384, r: 8, p: 1, dklen: 32, salt: 'bm90' } } }),
      'utf8'
    );

    const res = await call('security:setPassword', { password: 'hunter22' });
    expect(res.ok).toBe(false);
    expect(res.profileId).toBe('broken');

    // The healthy profile is untouched, and the password was never stored.
    expect(crypto_.isPasswordProtected(keystoreOf('p1'))).toBe(false);
    expect(await call('security:getStatus')).toMatchObject({ hasPassword: false });
  });
});

describe('changing the password', () => {
  it('moves every keystore to the new one', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    await call('security:setPassword', { password: 'hunter22' });

    expect(
      await call('security:setPassword', { password: 'newpass1', currentPassword: 'hunter22' })
    ).toMatchObject({ ok: true });

    expect(crypto_.decryptMnemonicWithPassword(keystoreOf('p1'), 'newpass1')).toBe(
      'alpha alpha alpha'
    );
  });

  it('refuses the wrong current password without touching anything', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    await call('security:setPassword', { password: 'hunter22' });

    expect(
      await call('security:setPassword', { password: 'newpass1', currentPassword: 'wrong!!' })
    ).toMatchObject({ ok: false, error: 'invalid_current_password' });

    // Still openable with the password that was actually set.
    expect(crypto_.decryptMnemonicWithPassword(keystoreOf('p1'), 'hunter22')).toBe(
      'alpha alpha alpha'
    );
  });
});

describe('taking the password off', () => {
  it('moves everything back to the machine secret', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    await call('security:setPassword', { password: 'hunter22' });

    expect(await call('security:removePassword', { password: 'hunter22' })).toMatchObject({
      ok: true
    });

    const ks = keystoreOf('p1');
    expect(crypto_.isPasswordProtected(ks)).toBe(false);
    expect(crypto_.decryptMnemonicLocal(ks)).toBe('alpha alpha alpha');
    expect(await call('security:getStatus')).toMatchObject({ hasPassword: false });
  });

  it('keeps the password when the wrong one is given', async () => {
    plantProfile('p1', 'alpha alpha alpha');
    await call('security:setPassword', { password: 'hunter22' });

    expect(await call('security:removePassword', { password: 'nope!!!' })).toMatchObject({
      ok: false,
      error: 'invalid_password'
    });
    expect(crypto_.isPasswordProtected(keystoreOf('p1'))).toBe(true);
    expect(await call('security:getStatus')).toMatchObject({ hasPassword: true });
  });
});
