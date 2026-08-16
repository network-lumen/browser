import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What the 16 handlers that broadcast tell the user when confirmation fails.
 *
 * One wording, one place: it used to live inside ipc/wallet.cjs, so the three
 * signing paths in ipc/gateway.cjs answered the same node's quirk with raw
 * JSON. The verdict it carries - whether pressing send again is safe - is the
 * whole point, so the three cases are pinned separately.
 */

type Tx = {
  describeBroadcastFailure: (error: unknown) => {
    ok: boolean;
    error: string;
    message: string;
    retrySafe?: boolean;
    txhash?: string;
  } | null;
};

const { describeBroadcastFailure } = stubElectron().load<Tx>('utils/tx.cjs');

function unreadable(extra: Record<string, unknown> = {}) {
  return Object.assign(new Error('transaction indexing is disabled'), extra);
}

describe('describing a broadcast that could not be confirmed', () => {
  it('tells the user not to send again when the transaction reached a block', () => {
    const res = describeBroadcastFailure(unreadable({ retrySafe: false }));
    expect(res).toMatchObject({ ok: false, error: 'indexing_disabled', retrySafe: false });
    expect(res!.message).toMatch(/do not send it again/i);
  });

  it('tells the user they can try again when it did not', () => {
    const res = describeBroadcastFailure(unreadable({ retrySafe: true }));
    expect(res).toMatchObject({ retrySafe: true });
    expect(res!.message).toMatch(/safely try again/i);
  });

  it('stays cautious when there is no verdict, and never invites a blind retry', () => {
    const res = describeBroadcastFailure(unreadable());
    expect(res!.retrySafe).toBeUndefined();
    expect(res!.message).toMatch(/check your balance before sending it again/i);
  });

  it('passes the transaction hash through, so the user can look it up', () => {
    expect(describeBroadcastFailure(unreadable({ txhash: 'ABC123' }))!.txhash).toBe('ABC123');
  });

  it('leaves every other failure to its caller', () => {
    // Returning a shape here would swallow "insufficient funds" into a message
    // about node indexing.
    expect(describeBroadcastFailure(new Error('insufficient funds'))).toBeNull();
    expect(describeBroadcastFailure('account sequence mismatch')).toBeNull();
    expect(describeBroadcastFailure(null)).toBeNull();
  });
});
