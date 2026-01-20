const { loadBootstrapPeers } = require('./peers.cjs');
const { PeerPool } = require('./peer_pool.cjs');

let _pool = null;

function getNetworkPool() {
  if (_pool) return _pool;
  const pool = new PeerPool();
  pool.addBootstrapPeers(loadBootstrapPeers());
  pool.start();
  _pool = pool;
  return pool;
}

module.exports = {
  getNetworkPool
};

