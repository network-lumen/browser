function isSocketClosedError(err) {
  const code = err && (err.cause && err.cause.code ? err.cause.code : err.code);
  if (code === 'UND_ERR_SOCKET') return true;
  const msg = String(err && err.message ? err.message : '');
  return msg.includes('UND_ERR_SOCKET') || msg.includes('fetch failed');
}

async function runWithRpcRetry(action, label, attempts = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (!isSocketClosedError(err) || i === attempts - 1) {
        throw err;
      }
      console.warn(
        `[rpc-retry] ${label}: connection closed (attempt ${i + 1}/${attempts}); retrying in ${delayMs}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

// Lumen has no gas market: the fee amount is always empty and the DAO's fixed
// price is charged by the message itself.
function zeroFee(gas = '300000') {
  return { amount: [], gas: String(gas) };
}

/**
 * A display amount to the chain's own base units, exactly.
 *
 * Every send used to compute `amount * 1_000_000`, which is right only where
 * the exponent is six. It is 18 on 75 of the 221 chains in the registry, and
 * there sending 1 token moved a trillionth of one - not a loss, but not what
 * anyone typed.
 *
 * Done on the decimal string rather than in floating point: 1e18 is far past
 * what a double holds exactly, so the multiplication itself would round.
 * Extra digits beyond the exponent are truncated, never rounded up - a send
 * must not exceed the figure the user confirmed.
 */
function toBaseUnits(amount, decimals = 6) {
  const exponent = Number.isFinite(Number(decimals)) ? Math.max(0, Math.trunc(decimals)) : 6;
  const text = String(amount == null ? '' : amount).trim();
  if (!/^\d*(\.\d*)?$/.test(text) || text === '' || text === '.') return '0';

  const [whole, fraction = ''] = text.split('.');
  const padded = (fraction + '0'.repeat(exponent)).slice(0, exponent);
  const scaled = BigInt(whole || '0') * 10n ** BigInt(exponent) + BigInt(padded || '0');
  return scaled.toString();
}

// A node running with `tx_index.indexer = "null"` answers a tx lookup with an
// RPC error instead of the transaction, so the broadcast cannot be confirmed
// through it. Reporting that as a plain failure is both alarming and wrong,
// and leaking the raw body puts {"code":-32603,...} in front of the user.
const INDEXING_DISABLED_HINT = 'transaction indexing is disabled';

/**
 * Turns an unconfirmable broadcast into something a user can act on.
 *
 * The question that matters is never "did it confirm" but "may I press send
 * again". chain/client.cjs answers it by watching the sender's sequence, which
 * is state and stays readable when transactions do not, and passes the verdict
 * along on the error as `retrySafe`. Only when even that could not be read do
 * we fall back to "most likely sent" - and then say so, rather than implying a
 * retry is harmless.
 *
 * Every handler that broadcasts goes through here, wallet and gateway alike:
 * one node's quirk used to produce a clean message on one screen and raw JSON
 * on the next.
 *
 * @returns null for any other failure, leaving each caller's own path intact
 */
function describeBroadcastFailure(error) {
  const raw = String(error && error.message ? error.message : error);
  if (!raw.includes(INDEXING_DISABLED_HINT)) return null;

  const txhash = String((error && error.txhash) || '');
  const retrySafe = error && typeof error.retrySafe === 'boolean' ? error.retrySafe : null;

  let message;
  if (retrySafe === false) {
    message =
      'Your transaction reached a block, but no node available here can read it back to confirm it. Do not send it again - it has already gone through. Your balance will show it shortly.';
  } else if (retrySafe === true) {
    message =
      'Your transaction was not accepted, and the node used to confirm it has transaction indexing disabled, so nothing more can be read about it. You can safely try again.';
  } else {
    message =
      'Your transaction was most likely sent, but the node used to confirm it has transaction indexing disabled, so it cannot be read back. Check your balance before sending it again.';
  }

  console.warn(
    `[tx] broadcast unconfirmable, indexing disabled (retrySafe=${retrySafe === null ? 'unknown' : retrySafe})`
  );
  return {
    ok: false,
    error: 'indexing_disabled',
    message,
    ...(retrySafe === null ? {} : { retrySafe }),
    ...(txhash ? { txhash } : {})
  };
}

module.exports = {
  runWithRpcRetry,
  zeroFee,
  toBaseUnits,
  INDEXING_DISABLED_HINT,
  describeBroadcastFailure
};

