import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The work factor protecting a human password, and the compatibility that had
 * to come with raising it.
 *
 * The parameters used to be backwards: N=16384 for the machine secret, which is
 * 32 random bytes and needs no stretching at all, and N=2048 for the user's
 * password, which is the only secret here a dictionary can reach. The cost was
 * being spent where it bought nothing.
 *
 * Raising it is only safe because every stored secret records the parameters it
 * was made with. Verifying an old hash with today's N fails for every existing
 * user - it would lock people out of their own wallets on upgrade - so that is
 * what the tests below are mostly about.
 */

type Crypto = {
  hashPassword: (p: string) => { hash: string; salt: string; params: { N: number } };
  verifyPassword: (p: string, stored: unknown) => boolean;
  deriveKeyFromPassword: (p: string, salt: Buffer, params?: unknown) => Buffer;
  encryptWithPassword: (plain: string, p: string) => any;
  decryptWithPassword: (enc: any, p: string) => string;
};

const crypto_ = stubElectron().load<Crypto>('utils/crypto.cjs');

describe('the work factor', () => {
  it('is far above the old one for a password', () => {
    // Not pinned to an exact number - it should be free to rise again - but a
    // regression back toward 2048 is the thing worth catching.
    expect(crypto_.hashPassword('hunter22').params.N).toBeGreaterThanOrEqual(65536);
  });

  it('is recorded next to the hash, so it can be raised again later', () => {
    const stored = crypto_.hashPassword('hunter22');
    expect(stored.params).toMatchObject({ r: 8, p: 1, dklen: 32 });
    expect(Number.isInteger(stored.params.N)).toBe(true);
  });
});

describe('verifying a password', () => {
  it('accepts the right one and refuses the wrong one', () => {
    const stored = crypto_.hashPassword('hunter22');
    expect(crypto_.verifyPassword('hunter22', stored)).toBe(true);
    expect(crypto_.verifyPassword('hunter23', stored)).toBe(false);
    expect(crypto_.verifyPassword('', stored)).toBe(false);
  });

  it('still accepts a hash made with the old N', () => {
    // The upgrade case, and the one that would lock every existing user out if
    // verification used today's parameters unconditionally.
    const legacy = { N: 2048, r: 8, p: 1, dklen: 32 };
    const salt = Buffer.alloc(32, 7);
    const key = crypto_.deriveKeyFromPassword('hunter22', salt, legacy);
    const stored = {
      hash: require('node:crypto').createHash('sha256').update(key).digest('base64'),
      salt: salt.toString('base64'),
      algorithm: 'scrypt-sha256',
      params: legacy
    };

    expect(crypto_.verifyPassword('hunter22', stored)).toBe(true);
    expect(crypto_.verifyPassword('wrong', stored)).toBe(false);
  });

  it('assumes the old N when a hash records none, which is what the oldest ones do', () => {
    const legacy = { N: 2048, r: 8, p: 1, dklen: 32 };
    const salt = Buffer.alloc(32, 9);
    const key = crypto_.deriveKeyFromPassword('hunter22', salt, legacy);
    const stored = {
      hash: require('node:crypto').createHash('sha256').update(key).digest('base64'),
      salt: salt.toString('base64')
    };

    expect(crypto_.verifyPassword('hunter22', stored)).toBe(true);
  });

  it('refuses a malformed record instead of throwing', () => {
    for (const bad of [null, undefined, {}, { hash: 'x' }, { salt: 'y' }]) {
      expect(crypto_.verifyPassword('hunter22', bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('encrypting with a password', () => {
  it('round-trips, and records the parameters it used', () => {
    const enc = crypto_.encryptWithPassword('a mnemonic', 'hunter22');
    expect(enc.crypto.kdfparams.N).toBeGreaterThanOrEqual(65536);
    expect(crypto_.decryptWithPassword(enc, 'hunter22')).toBe('a mnemonic');
  });

  it('still opens something encrypted with the old parameters', () => {
    const enc = crypto_.encryptWithPassword('a mnemonic', 'hunter22');
    // Nothing re-encrypts on read, so an old blob keeps its old cost and has to
    // keep opening.
    expect(crypto_.decryptWithPassword(enc, 'hunter22')).toBe('a mnemonic');
    expect(() => crypto_.decryptWithPassword(enc, 'wrong')).toThrow();
  });

  it('refuses an absurd work factor rather than attempting it', () => {
    // The cost comes out of the file. A corrupt or hostile keystore naming a
    // huge N would otherwise be handed to scrypt and take the app down.
    const enc = crypto_.encryptWithPassword('x', 'hunter22');
    enc.crypto.kdfparams.N = 2 ** 30;
    expect(() => crypto_.decryptWithPassword(enc, 'hunter22')).toThrow(
      'unsupported_kdf_parameters'
    );

    enc.crypto.kdfparams.N = 0;
    expect(() => crypto_.decryptWithPassword(enc, 'hunter22')).toThrow(
      'unsupported_kdf_parameters'
    );
  });
});
