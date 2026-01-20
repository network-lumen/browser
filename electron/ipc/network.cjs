const { ipcMain } = require('electron');
const { getNetworkPool } = require('../network/pool_singleton.cjs');
const { readState, broadcastTx } = require('../network/network_middleware.cjs');

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
  registerNetworkIpc
};
