import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * The two proof-of-work formats this app mines against, pinned byte for byte.
 *
 * Both changed in chain v2.0.0, and both fail the same silent way: the nonce is
 * computed, the transaction is signed and broadcast, and the chain refuses it
 * with a message about the proof rather than about the input that moved. There
 * is no shape to get wrong and no type to catch it - a wrong separator, a
 * missing field or the wrong byte order each produce a perfectly valid sha256
 * that simply is not the one the chain checks.
 *
 * The expected digests below are not derived here. They came from running the
 * chain's own `x/pqc/types.ComputePowDigest` and
 * `x/dns/types.ComputeUpdatePowDigest` over these inputs, so a change has to be
 * reconciled with Go rather than with a second reading of this file.
 */

const require_ = createRequire(import.meta.url);
const { leadingZeroBits, linkPowPrefix, updatePowPayload, toChainUint } =
  require_('../../electron/utils/pow.cjs');

const CREATOR = 'lmn1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu';
const PUB_KEY = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);

/** Exactly how the miner uses the prefix: hash it once, append the nonce. */
function linkDigest(creator: string, pubKey: Uint8Array, nonce: Uint8Array): string {
  const base = createHash('sha256');
  base.update(linkPowPrefix(creator, pubKey));
  return base.copy().update(Buffer.from(nonce)).digest('hex');
}

function updateDigest(identifier: string, creator: string, updatedAt: unknown, nonce: string): string {
  return createHash('sha256').update(updatePowPayload(identifier, creator, updatedAt, nonce)).digest('hex');
}

describe('the PQC link digest', () => {
  it('matches x/pqc for the same creator, key and nonce', () => {
    expect(linkDigest(CREATOR, PUB_KEY, Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 7]))).toBe(
      'c90d46a8ae38726a0da34a84eb876a7b6686f5d2e9a74d8c528e112bb5f452a1'
    );
  });

  it('matches for the single zero byte a difficulty of 0 sends', () => {
    // The miner answers Buffer.from([0]) rather than an eight-byte zero when
    // there is no work to do, and the chain hashes whatever arrives - so the
    // short nonce is part of the contract, not an implementation detail.
    expect(linkDigest(CREATOR, PUB_KEY, Uint8Array.from([0]))).toBe(
      'c93c2905d917c137ff92e99884d3be498d23b9b69c2aaf6136e57dd3f5e0876a'
    );
  });

  it('changes with the creator, which is the whole point of binding it', () => {
    // Before v2.0.0 the digest covered the key alone, so one solved nonce
    // linked unlimited accounts, and a pending (pub_key, pow_nonce) pair could
    // be lifted out of the mempool and submitted under another address.
    const nonce = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 7]);
    expect(linkDigest(`${CREATOR.slice(0, -1)}v`, PUB_KEY, nonce)).not.toBe(
      linkDigest(CREATOR, PUB_KEY, nonce)
    );
  });

  it('separates the creator from the key, so no two inputs share a payload', () => {
    // Without the "|", creator "ab" with key "cd" and creator "abc" with key
    // "d" would hash the same bytes.
    const nonce = Uint8Array.from([9]);
    expect(linkDigest('ab', Uint8Array.from([0x63, 0x64]), nonce)).not.toBe(
      linkDigest('abc', Uint8Array.from([0x64]), nonce)
    );
  });

  it('refuses to mine without an address rather than hashing an empty one', () => {
    // An empty creator would produce a digest the chain never checks, and the
    // refusal would arrive as a rejected transaction minutes later.
    expect(() => linkPowPrefix('', PUB_KEY)).toThrow();
  });
});

describe('the DNS update digest', () => {
  it('matches x/dns for a domain with a real updated_at', () => {
    expect(updateDigest('mydomain.lmn', CREATOR, 1758200000, '0')).toBe(
      '9965f5a6882ecc44cacef51ddc1212bec302b2236f8b58acbba5485be64d5265'
    );
  });

  it('matches for a domain that has never been updated', () => {
    expect(updateDigest('mydomain.lmn', CREATOR, 0, '0')).toBe(
      'bdde11e6279102f064b27452c0637fe8be10b562fa373bbec8c7d4b197b56cb2'
    );
  });

  it('gives a different digest once the domain has been updated', () => {
    // The defect the field was added for: before it, the digest covered the
    // name, the owner and the nonce, none of which changes between two updates
    // of the same name by the same owner - so one solved nonce authorised every
    // update that name would ever receive.
    expect(updateDigest('mydomain.lmn', CREATOR, 0, '0')).not.toBe(
      updateDigest('mydomain.lmn', CREATOR, 1758200000, '0')
    );
  });

  it('reads a missing or unusable updated_at as the zero a fresh domain carries', () => {
    // The LCD answers uint64 as a decimal string, sometimes as a number, and
    // sometimes omits it. Every unreadable form has to land on the value the
    // chain holds for a domain that has never been updated, or the nonce is
    // mined against a timestamp the handler will not agree with.
    expect(toChainUint(undefined)).toBe(0);
    expect(toChainUint(null)).toBe(0);
    expect(toChainUint('')).toBe(0);
    expect(toChainUint('not a number')).toBe(0);
    expect(toChainUint(-5)).toBe(0);
    expect(toChainUint('1758200000')).toBe(1758200000);
    expect(toChainUint(1758200000)).toBe(1758200000);
  });

  it('writes the timestamp as a plain integer, the way Go prints a uint64', () => {
    // A string param would reach the payload quoted, and a float would reach it
    // with an exponent past 2^21 - neither is what "%d" produces.
    expect(updatePowPayload('a.lmn', 'lmn1x', '1758200000', '5')).toBe('a.lmn|lmn1x|1758200000|5');
  });
});

describe('leadingZeroBits', () => {
  it('counts a whole zero byte as eight', () => {
    expect(leadingZeroBits(Uint8Array.from([0, 0xff]))).toBe(16 - 8);
    expect(leadingZeroBits(Uint8Array.from([0, 0, 0xff]))).toBe(16);
  });

  it('counts the bits inside the first non-zero byte', () => {
    expect(leadingZeroBits(Uint8Array.from([0xff]))).toBe(0);
    expect(leadingZeroBits(Uint8Array.from([0x0f]))).toBe(4);
    expect(leadingZeroBits(Uint8Array.from([0x01]))).toBe(7);
  });

  it('agrees with the target the miner is graded on', () => {
    // Eight bits of difficulty means one leading zero byte, which is the
    // relationship every caller assumes when it compares against a parameter.
    expect(leadingZeroBits(Uint8Array.from([0x00, 0x80]))).toBeGreaterThanOrEqual(8);
    expect(leadingZeroBits(Uint8Array.from([0x01, 0x00]))).toBeLessThan(8);
  });
});
