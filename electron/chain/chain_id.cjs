// Which chain a signature is for.
//
// A Cosmos signature covers the chain id, so signing with the wrong one
// produces bytes the chain cannot verify. It answers "signature verification
// failed; please verify account number (N) and chain-id (lumen-devnet-1)",
// which reads like a key or an account problem and is neither.
//
// ipc/gateway.cjs used to write `input?.chainId || 'lumen'`, in four places.
// Against a chain actually called `lumen-devnet-1` every gateway transaction
// was refused while sending tokens worked, because ipc/wallet.cjs took the id
// from the peer pool instead. Two ways of answering one question, and only one
// of them asked the network.
//
// The pool learns the id from each peer's `node_info.network` when it pings it,
// so it is whatever the node running right now says it is - which is the only
// definition that can be right after a devnet is redeployed.
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');

/**
 * @param {string} [override] a caller-supplied id, used when the caller really
 *   does know better - a cross-chain send names its own.
 * @returns the chain id, or undefined. Never a literal fallback: undefined lets
 *   the SDK ask the node, where a wrong guess silently invalidates a signature.
 */
function resolveChainId(override) {
  const explicit = String(override || '').trim();
  if (explicit) return explicit;

  try {
    const pool = getNetworkPool();
    const best = pool.getBestPeer('rpc');
    const fromPeer = String(best?.chainId || '').trim();
    if (fromPeer) return fromPeer;

    const fromPool = String(pool.networkChainId || '').trim();
    if (fromPool) return fromPool;
  } catch {
    // No pool yet - fall through and let the SDK resolve it.
  }

  return undefined;
}

module.exports = { resolveChainId };
