import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const crypto_ = require_('../../electron/utils/crypto.cjs');

/**
 * Password hashing and the password-encrypted envelope.
 *
 * This is what stands between a stolen profile folder and a stolen wallet, and
 * it had no tests. The properties below are the ones that would be silently
 * lost by an edit that still "worked" - a salt that stopped being random, a
 * verify that stopped rejecting, an envelope whose tag stopped being checked.
 */

describe('sha256', () => {
  const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('hashes bytes and the utf8 string that spells them the same way', () => {
    expect(crypto_.sha256('')).toBe(EMPTY);
    expect(crypto_.sha256('abc')).toBe(crypto_.sha256(Buffer.from('abc', 'utf8')));
  });

  it('gives hex by default and the raw digest on demand', () => {
    // The signing paths feed the digest straight to secp256k1, so the bytes
    // have to be the same 32 the hex spells - not a re-encoding of them.
    const bytes = crypto_.sha256('abc', { bytes: true });
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(bytes).toHaveLength(32);
    expect(bytes.toString('hex')).toBe(crypto_.sha256('abc'));
  });

  it('slices and uppercases on demand', () => {
    expect(crypto_.sha256('abc', { length: 12 })).toBe(crypto_.sha256('abc').slice(0, 12));
    expect(crypto_.sha256('abc', { upper: true })).toBe(crypto_.sha256('abc').toUpperCase());
  });

  it('throws on a missing value rather than returning the hash of nothing', () => {
    // Callers compare this against a hash from the chain or from a signed
    // archive; two absent values must not come out equal.
    expect(() => crypto_.sha256(null)).toThrow();
    expect(() => crypto_.sha256(undefined)).toThrow();
  });
});

describe('password hashing', () => {
  it('accepts the right password and refuses a near miss', () => {
    const stored = crypto_.hashPassword('correct horse battery staple');
    expect(crypto_.verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(crypto_.verifyPassword('correct horse battery stapl', stored)).toBe(false);
    expect(crypto_.verifyPassword('', stored)).toBe(false);
  });

  it('salts every hash, so two identical passwords do not collide', () => {
    const a = crypto_.hashPassword('same');
    const b = crypto_.hashPassword('same');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // Both still verify: the salt is stored beside the hash, not derived.
    expect(crypto_.verifyPassword('same', a)).toBe(true);
    expect(crypto_.verifyPassword('same', b)).toBe(true);
  });

  it('never stores the derived key itself', () => {
    const stored = crypto_.hashPassword('pw');
    const key = crypto_.deriveKeyFromPassword('pw', Buffer.from(stored.salt, 'base64'));
    expect(stored.hash).not.toBe(key.toString('base64'));
  });

  it('refuses a malformed record instead of throwing', () => {
    // These arrive from a file on disk, so a truncated or hand-edited one must
    // fail closed rather than crash the unlock path.
    for (const junk of [null, undefined, {}, { hash: 'x' }, { salt: 'y' }]) {
      expect(crypto_.verifyPassword('pw', junk)).toBe(false);
    }
    expect(crypto_.verifyPassword('pw', { hash: '!!not base64!!', salt: '!!' })).toBe(false);
  });

  it('records the parameters it used, so a later change stays readable', () => {
    const stored = crypto_.hashPassword('pw');
    expect(stored.algorithm).toBe('scrypt-sha256');
    expect(stored.params).toMatchObject({ N: 2048, r: 8, p: 1, dklen: 32 });
  });
});

describe('password-encrypted envelope', () => {
  it('round-trips a string', () => {
    const sealed = crypto_.encryptWithPassword('a secret phrase', 'pw');
    expect(JSON.stringify(sealed)).not.toContain('a secret phrase');
    expect(crypto_.decryptWithPassword(sealed, 'pw')).toBe('a secret phrase');
  });

  it('refuses the wrong password rather than returning something', () => {
    const sealed = crypto_.encryptWithPassword('a secret phrase', 'pw');
    expect(() => crypto_.decryptWithPassword(sealed, 'wrong')).toThrow();
  });

  it('refuses a tampered ciphertext', () => {
    // AES-GCM authenticates: flipping a byte has to fail, not decrypt to
    // garbage that a caller might then act on.
    const sealed = crypto_.encryptWithPassword('a secret phrase', 'pw');
    const bytes = Buffer.from(sealed.crypto.ciphertext, 'base64');
    bytes[0] ^= 0xff;
    sealed.crypto.ciphertext = bytes.toString('base64');
    expect(() => crypto_.decryptWithPassword(sealed, 'pw')).toThrow();
  });

  it('refuses a tampered auth tag', () => {
    const sealed = crypto_.encryptWithPassword('a secret phrase', 'pw');
    const tag = Buffer.from(sealed.crypto.tag, 'base64');
    tag[0] ^= 0xff;
    sealed.crypto.tag = tag.toString('base64');
    expect(() => crypto_.decryptWithPassword(sealed, 'pw')).toThrow();
  });

  it('uses a fresh salt and iv each time', () => {
    const a = crypto_.encryptWithPassword('same', 'pw');
    const b = crypto_.encryptWithPassword('same', 'pw');
    expect(a.crypto.iv).not.toBe(b.crypto.iv);
    expect(a.crypto.kdfparams.salt).not.toBe(b.crypto.kdfparams.salt);
    expect(a.crypto.ciphertext).not.toBe(b.crypto.ciphertext);
  });

  it('rejects an envelope with nothing in it', () => {
    expect(() => crypto_.decryptWithPassword(null, 'pw')).toThrow();
    expect(() => crypto_.decryptWithPassword({}, 'pw')).toThrow();
  });
});
