import { describe, expect, it } from 'vitest';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync
} from 'node:crypto';
import {
  decryptWithPassword,
  encryptWithPassword,
  hashPassword,
  verifyPassword
} from '../../platform/mobile/impl/crypto';

/**
 * The mobile build re-implements `electron/utils/crypto.cjs` on WebCrypto and
 * @noble/hashes, because node:crypto does not exist in a WebView. The formats
 * were kept identical so a backup crosses between the two.
 *
 * A round-trip inside the mobile code alone would prove nothing about that -
 * it would pass just as happily if both halves drifted together. So the other
 * side here is node:crypto itself, driven exactly as the desktop drives it.
 * If these fail, a wallet backed up on a phone cannot be restored on a laptop.
 */

const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/** `decryptWithPassword` from electron/utils/crypto.cjs, verbatim in spirit. */
function desktopDecrypt(encrypted: any, password: string): string {
  const { salt, N, r, p, dklen } = encrypted.crypto.kdfparams;
  const key = scryptSync(Buffer.from(password, 'utf8'), Buffer.from(salt, 'base64'), dklen || 32, {
    N,
    r,
    p,
    maxmem: SCRYPT_MAXMEM
  });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.crypto.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.crypto.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.crypto.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

/** `encryptWithPassword` from electron/utils/crypto.cjs, verbatim in spirit. */
function desktopEncrypt(plaintext: string, password: string) {
  const params = { N: 65536, r: 8, p: 1, dklen: 32 };
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(Buffer.from(password, 'utf8'), salt, params.dklen, {
    ...params,
    maxmem: SCRYPT_MAXMEM
  });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    version: 2,
    passwordProtected: true,
    createdAt: Date.now(),
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      kdf: 'scrypt',
      kdfparams: { ...params, salt: salt.toString('base64') }
    }
  };
}

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('mobile crypto is desktop crypto', () => {
  it('produces a keystore the desktop can open', async () => {
    const sealed = await encryptWithPassword(MNEMONIC, 'correct horse battery');
    expect(desktopDecrypt(sealed, 'correct horse battery')).toBe(MNEMONIC);
  });

  it('opens a keystore the desktop produced', async () => {
    const sealed = desktopEncrypt(MNEMONIC, 'correct horse battery');
    await expect(decryptWithPassword(sealed as any, 'correct horse battery')).resolves.toBe(
      MNEMONIC
    );
  });

  it('writes the fields the desktop reads, under the names it reads them by', async () => {
    const sealed = await encryptWithPassword(MNEMONIC, 'pw');
    expect(sealed.version).toBe(2);
    expect(sealed.passwordProtected).toBe(true);
    expect(sealed.crypto.cipher).toBe('aes-256-gcm');
    expect(sealed.crypto.kdf).toBe('scrypt');
    // The work factor travels with the secret; that is what lets it be raised
    // later without locking every existing user out.
    expect(sealed.crypto.kdfparams).toMatchObject({ N: 65536, r: 8, p: 1, dklen: 32 });
    expect(Buffer.from(sealed.crypto.tag, 'base64')).toHaveLength(16);
    expect(Buffer.from(sealed.crypto.iv, 'base64')).toHaveLength(12);
  });

  it('refuses a wrong password rather than returning rubbish', async () => {
    const sealed = await encryptWithPassword(MNEMONIC, 'right');
    await expect(decryptWithPassword(sealed, 'wrong')).rejects.toThrow();
  });

  it('refuses an absurd work factor instead of handing it to scrypt', async () => {
    const sealed = await encryptWithPassword(MNEMONIC, 'pw');
    sealed.crypto.kdfparams.N = 2 ** 30;
    await expect(decryptWithPassword(sealed, 'pw')).rejects.toThrow(
      /unsupported_kdf_parameters/
    );
  });
});

describe('password verifier', () => {
  it('round-trips, and the hash is one the desktop would accept', async () => {
    const stored = await hashPassword('hunter2hunter2');
    await expect(verifyPassword('hunter2hunter2', stored)).resolves.toBe(true);
    await expect(verifyPassword('hunter2hunter3', stored)).resolves.toBe(false);

    // Same derivation the desktop's verifyPassword performs.
    const key = scryptSync(
      Buffer.from('hunter2hunter2', 'utf8'),
      Buffer.from(stored.salt, 'base64'),
      stored.params.dklen,
      { ...stored.params, maxmem: SCRYPT_MAXMEM }
    );
    expect(createHash('sha256').update(key).digest('base64')).toBe(stored.hash);
  });

  it('honours the parameters recorded beside an older hash', async () => {
    // A hash made when N was 2048 must still verify after the work factor was
    // raised to 65536 - otherwise the upgrade locks out every existing user.
    const legacyParams = { N: 2048, r: 8, p: 1, dklen: 32 };
    const salt = randomBytes(32);
    const key = scryptSync(Buffer.from('old-password', 'utf8'), salt, 32, {
      ...legacyParams,
      maxmem: SCRYPT_MAXMEM
    });
    const stored = {
      hash: createHash('sha256').update(key).digest('base64'),
      salt: salt.toString('base64'),
      algorithm: 'scrypt-sha256' as const,
      params: legacyParams
    };
    await expect(verifyPassword('old-password', stored)).resolves.toBe(true);
  });

  it('treats a missing verifier as a failure, not as a pass', async () => {
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
    await expect(verifyPassword('anything', { hash: '', salt: '' } as any)).resolves.toBe(false);
  });
});
