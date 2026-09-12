const { PeerPool, loadBootstrapPeers } = require('./peer_pool.cjs');
const { getNetwork, normalizeNetworkId, DEFAULT_NETWORK_ID } = require('../../chain/networks.cjs');

let _pool = null;

/**
 * The active network id, from settings.
 *
 * Read lazily rather than at module load: settings live under the user data
 * path, which does not exist until the app is ready, and this module is
 * required long before that.
 */
function activeNetworkId() {
  try {
    // Required here, not at the top: settings.cjs pulls in `electron.app`, and
    // the pool is also constructed by tests that have no app.
    const { getSetting } = require('../../settings.cjs');
    return normalizeNetworkId(getSetting('lumenNetwork'));
  } catch (e) {
    console.warn('[net] cannot read the network setting, falling back to', DEFAULT_NETWORK_ID, e && e.message ? e.message : e);
    return DEFAULT_NETWORK_ID;
  }
}

function getNetworkPool() {
  if (_pool) return _pool;

  const networkId = activeNetworkId();
  const network = getNetwork(networkId);

  // Pinning the chain id is what keeps a peer discovered from a validator's
  // description - which is how a mainnet endpoint gets into a testnet pool -
  // from being handed to a balance read or, worse, to a signature.
  const pool = new PeerPool({ networkId: network.id, expectedChainId: network.chainId });
  pool.addBootstrapPeers(loadBootstrapPeers(network.id));

  const count = pool.listPeers().length;
  console.log(`[net] network ${network.id} (${network.chainId}), ${count} bootstrap peer(s)`);
  if (!count) {
    console.warn(`[net] resources/peers.txt has no [${network.id}] section, or it is empty`);
  }

  _pool = pool;
  return _pool;
}

/**
 * Drop the pool so the next caller builds one for whatever network is now set.
 *
 * Peer health, the chain id and the discovered peers are all per-network, so
 * none of it survives the switch - there is nothing here worth carrying over to
 * a different chain.
 */
function resetNetworkPool() {
  _pool = null;
}

module.exports = {
  getNetworkPool,
  resetNetworkPool
};
