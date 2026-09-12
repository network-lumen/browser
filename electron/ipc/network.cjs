const { ipcMain } = require('electron');
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');
const { readState, broadcastTx } = require('../chain/client.cjs');
const { getNetwork, listNetworks, explorerAccountUrl } = require('../chain/networks.cjs');
const { getSetting } = require('../settings.cjs');
const { setLumenNetworkSetting } = require('./settings.cjs');

/**
 * The active network, as the renderer needs it.
 *
 * Identity comes from the table in chain/networks.cjs and endpoints come from
 * the live pool, so a page that wants to read Lumen directly - the Cosmos
 * chains panel does, for every chain - gets the peers the rest of the app is
 * already using instead of a public registry that only knows mainnet.
 */
function describeActiveNetwork() {
  const network = getNetwork(getSetting('lumenNetwork'));
  const snapshot = getNetworkPool().snapshot();

  // Best first, because callers take the head of the list and stay there:
  // cosmosDirectory.ts reads `chain.rest[0]` for balances and only walks the
  // list when one fails. Alive and quick beats alive, which beats untried; a
  // peer that has been put down is left out entirely.
  const usable = snapshot.peers
    .filter((peer) => !(peer.flags && peer.flags.death))
    // The same rule the pool applies to its own picks. A peer known to be on
    // another chain is what this whole descriptor exists to keep out of the
    // wallet, so it must not come back out through the endpoint list.
    .filter((peer) => !peer.chainId || peer.chainId === snapshot.networkChainId)
    .map((peer, index) => ({ peer, index }))
    .sort(
      (a, b) =>
        rank(a.peer) - rank(b.peer) ||
        latency(a.peer) - latency(b.peer) ||
        // File order last, so an untried peers.txt still comes out in the order
        // it was written rather than in an arbitrary one.
        a.index - b.index
    )
    .map((entry) => entry.peer);

  return {
    ...network,
    rest: usable.filter((peer) => peer.rest).map((peer) => peer.rest),
    rpc: usable.filter((peer) => peer.rpc).map((peer) => peer.rpc),
    // What the nodes being used have actually said they are. Null until one has
    // answered, so a caller can tell "not yet" from "disagrees" rather than
    // reading the table's own value back as if a node had confirmed it.
    observedChainId: usable.find((peer) => peer.chainId && peer.lastSeenAt)?.chainId || null
  };
}

function rank(peer) {
  if (!peer.lastSeenAt) return 2;
  const healthy = !(peer.flags && (peer.flags.slow || peer.flags.suspect));
  return healthy ? 0 : 1;
}

function latency(peer) {
  return typeof peer.latencyMs === 'number' ? peer.latencyMs : Number.MAX_SAFE_INTEGER;
}


function registerNetworkIpc() {
  ipcMain.handle('net:rpcGet', async (_evt, path, options) => {
    return readState(String(path || ''), { ...(options || {}), kind: 'rpc' });
  });

  ipcMain.handle('net:restGet', async (_evt, path, options) => {
    return readState(String(path || ''), { ...(options || {}), kind: 'rest' });
  });

  ipcMain.handle('net:getState', async () => {
    const pool = getNetworkPool();
    return { ok: true, state: pool.snapshot() };
  });

  ipcMain.handle('net:getNetwork', async () => {
    return { ok: true, network: describeActiveNetwork(), available: listNetworks() };
  });

  ipcMain.handle('net:setNetwork', async (_evt, id) => {
    // Through ipc/settings.cjs rather than straight to setSettings: that is
    // where the pool is dropped and the windows are told, and a second write
    // path that skipped it would leave the app reading the old chain under the
    // new chain's name.
    const res = setLumenNetworkSetting(id);
    if (!res || !res.ok) return res || { ok: false, error: 'set_failed' };
    // Described after the reset, so this is the new network's pool.
    return { ok: true, network: describeActiveNetwork() };
  });

  ipcMain.handle('net:getExplorerAccountUrl', async (_evt, address) => {
    return { ok: true, url: explorerAccountUrl(getSetting('lumenNetwork'), address) };
  });

  ipcMain.handle('net:getValidators', async () => {
    const pool = getNetworkPool();
    return { ok: true, validators: Array.isArray(pool.validators) ? pool.validators : [] };
  });

  ipcMain.handle('net:refreshOnChain', async () => {
    const pool = getNetworkPool();
    const r = await pool.refreshFromOnChain();
    return r && typeof r === 'object' ? r : { ok: false };
  });

  ipcMain.handle('net:broadcastTx', async (_evt, txBytes, options) => {
    return broadcastTx(txBytes, options || {});
  });
}

module.exports = {
  registerNetworkIpc,
  describeActiveNetwork
};
