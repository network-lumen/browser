/**
 * What actually happened to a transaction the app broadcast.
 *
 * There are four outcomes and only two of them are what they look like. The
 * one that matters is `indexing_disabled`: the node that accepts a broadcast is
 * not always the one asked to read it back, and a peer with transaction
 * indexing turned off cannot answer. The transaction is on the chain; only the
 * receipt is missing. Reported as a failure - which is how the staking dialog
 * reported it, raw error code and all - it invites the user to sign and pay for
 * the same delegation twice.
 *
 * `retrySafe` comes from the main process, which knows whether the transaction
 * reached a block before the confirmation was lost. When it says nothing, the
 * safe reading is that it might have.
 *
 * Pure on purpose: the page decides which toast to raise and whether to lock
 * the session, and this file stays testable without any of that.
 */

import type { BroadcastOutcome, BroadcastResult } from '../../types/broadcast';

function hashOf(result: BroadcastResult): string {
  return String(result?.txhash || result?.txHash || '').trim();
}

export function classifyBroadcastResult(result: BroadcastResult): BroadcastOutcome {
  // A bridge that answered nothing at all failed; it did not succeed quietly.
  if (!result || typeof result !== 'object') {
    return { kind: 'failed', error: '' };
  }

  const error = String(result.error || '').trim();

  if (result.ok === false) {
    if (error === 'password_required' || error === 'invalid_password') {
      return { kind: 'locked' };
    }
    if (error === 'indexing_disabled') {
      return {
        kind: 'unconfirmed',
        // Absent means unknown, and unknown is treated as "it may have landed":
        // the cost of a duplicated transfer is higher than of one extra check.
        retrySafe: result.retrySafe === true,
        txhash: hashOf(result),
      };
    }
    return { kind: 'failed', error };
  }

  return { kind: 'sent', txhash: hashOf(result) };
}
