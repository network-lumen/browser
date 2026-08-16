import { describe, expect, it } from 'vitest';
import { computeTxHash } from '../../src/internal/services/chainRpc';

/**
 * The hash a transaction is known by.
 *
 * Tendermint identifies a transaction by the SHA-256 of its raw bytes, in
 * uppercase hex. The explorer looks a transaction up by this, so a wrong answer
 * is a receipt pointing at nothing - and there is no way to notice from the
 * shape of the string.
 */

describe('computeTxHash', () => {
  it('hashes the decoded bytes, not the base64 text', async () => {
    // SHA-256 of the three bytes "abc", which is the canonical test vector.
    await expect(computeTxHash(btoa('abc'))).resolves.toBe(
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
  });

  it('answers in the uppercase hex the chain uses', async () => {
    const hash = await computeTxHash(btoa('lumen'));
    expect(hash).toMatch(/^[0-9A-F]{64}$/);
  });

  it('hashes the empty transaction rather than refusing it', async () => {
    await expect(computeTxHash('')).resolves.toBe(
      'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
    );
  });

  it('answers with a zero hash for input that is not base64 at all', async () => {
    // Not a throw: this runs while drawing a list of transactions, and one bad
    // row must not take the page down with it.
    await expect(computeTxHash('not base64 !!')).resolves.toBe('0'.repeat(64));
  });
});
