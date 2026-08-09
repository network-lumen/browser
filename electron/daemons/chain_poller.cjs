// The chain poller: the app's own view of the tip.
//
// Height, status and the RPC it came from, refreshed by the chain-poller daemon
// and pushed to every window when the height moves. The rpc:getHeight handler
// in ipc/chain.cjs reads the same state rather than polling on its own.
const { BrowserWindow } = require('electron');
const { readState } = require('../network/network_middleware.cjs');

const chainState = {
  rpcBase: null,
  height: null,
  status: 'idle',
  error: null,
  lastUpdated: 0,
  polling: false,
};

async function pollChainOnce() {
  if (chainState.polling) return;
  chainState.polling = true;

  try {
    const res = await readState('/status', { kind: 'rpc', timeout: 7000 });

    if (!res || !res.ok) {
      chainState.rpcBase = null;
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = res && res.error ? String(res.error) : 'rpc_unavailable';
      chainState.lastUpdated = Date.now();
      return;
    }

    chainState.rpcBase = res.peer && res.peer.rpc ? res.peer.rpc : null;

    const data = res && res.json ? res.json : null;

    const raw =
      data &&
      data.result &&
      data.result.sync_info &&
      data.result.sync_info.latest_block_height;
    const height = Number(raw);

    if (!Number.isFinite(height) || height <= 0) {
      chainState.height = null;
      chainState.status = 'error';
      chainState.error = 'invalid_height';
      chainState.lastUpdated = Date.now();
      return;
    }

    const prevHeight = chainState.height;
    chainState.height = height;
    chainState.status = 'ok';
    chainState.error = null;
    chainState.lastUpdated = Date.now();

    if (height !== prevHeight) {
      broadcastChainState();
    }
  } catch (e) {
    chainState.height = null;
    chainState.status = 'error';
    chainState.error = String(e && e.message ? e.message : e);
    chainState.lastUpdated = Date.now();
  } finally {
    chainState.polling = false;
  }
}

function broadcastChainState() {
  const payload = {
    height: chainState.height,
    status: chainState.status,
    error: chainState.error,
    lastUpdated: chainState.lastUpdated,
    rpcBase: chainState.rpcBase,
  };
  try {
    const all = BrowserWindow.getAllWindows();
    for (const win of all) {
      try {
        if (!win || win.isDestroyed?.()) continue;
        const wc = win.webContents;
        if (!wc || wc.isDestroyed?.()) continue;
        const mf = wc.mainFrame;
        if (!mf || mf.isDestroyed?.()) continue;
        if (typeof wc.isLoading === 'function' && wc.isLoading()) continue;
        if (typeof wc.getURL === 'function' && !String(wc.getURL() || '').trim()) continue;
        wc.send('rpc:heightChanged', payload);
      } catch {
        // ignore send failures (renderer reloading / disposed frame)
      }
    }
  } catch {
    // ignore
  }
}

/** A copy, so a handler cannot write to the poller's state by accident. */
function getChainState() {
  return {
    height: chainState.height,
    status: chainState.status,
    error: chainState.error,
    lastUpdated: chainState.lastUpdated,
    rpcBase: chainState.rpcBase,
    polling: chainState.polling
  };
}

module.exports = { pollChainOnce, getChainState };
