import { describe, expect, it } from 'vitest';
import { classifyBroadcastResult } from '../../src/internal/services/broadcastOutcome';

/**
 * Reading what a broadcast actually did.
 *
 * The case worth the file is `indexing_disabled`. It arrives with `ok: false`,
 * so every naive reading calls it a failure - the staking dialog put "Transaction
 * failed / indexing_disabled" on screen under a Try again button, for a
 * delegation that was already on the chain. Signing it a second time costs real
 * money, so this must never come back as `failed`.
 */

describe('a transaction that landed but could not be read back', () => {
  it('is not a failure', () => {
    const out = classifyBroadcastResult({ ok: false, error: 'indexing_disabled' });
    expect(out.kind).toBe('unconfirmed');
  });

  it('carries the hash when the node managed to return one', () => {
    const out = classifyBroadcastResult({ ok: false, error: 'indexing_disabled', txhash: 'ABC123' });
    expect(out).toEqual({ kind: 'unconfirmed', retrySafe: false, txhash: 'ABC123' });
  });

  it('repeats the main process when it says retrying is safe', () => {
    const out = classifyBroadcastResult({ ok: false, error: 'indexing_disabled', retrySafe: true });
    expect(out).toMatchObject({ kind: 'unconfirmed', retrySafe: true });
  });

  it('assumes it may have landed when nothing is said', () => {
    const out = classifyBroadcastResult({ ok: false, error: 'indexing_disabled' });
    expect(out).toMatchObject({ retrySafe: false });
  });
});

describe('a wallet that needs unlocking', () => {
  it('is told apart from a failure, for both spellings', () => {
    expect(classifyBroadcastResult({ ok: false, error: 'password_required' }).kind).toBe('locked');
    expect(classifyBroadcastResult({ ok: false, error: 'invalid_password' }).kind).toBe('locked');
  });
});

describe('the two plain outcomes', () => {
  it('reads a success, from either spelling of the hash', () => {
    expect(classifyBroadcastResult({ ok: true, txhash: 'AAA' })).toEqual({ kind: 'sent', txhash: 'AAA' });
    expect(classifyBroadcastResult({ ok: true, txHash: 'BBB' })).toEqual({ kind: 'sent', txhash: 'BBB' });
  });

  it('treats anything not explicitly refused as sent', () => {
    expect(classifyBroadcastResult({ txhash: 'CCC' }).kind).toBe('sent');
  });

  it('keeps the error code so the page can show it', () => {
    expect(classifyBroadcastResult({ ok: false, error: 'insufficient funds' })).toEqual({
      kind: 'failed',
      error: 'insufficient funds',
    });
  });

  it('calls a missing answer a failure rather than a success', () => {
    expect(classifyBroadcastResult(null).kind).toBe('failed');
    expect(classifyBroadcastResult(undefined).kind).toBe('failed');
  });
});
