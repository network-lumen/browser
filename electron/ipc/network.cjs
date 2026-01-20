const { ipcMain } = require('electron');
const { getNetworkPool } = require('../network/pool_singleton.cjs');

function registerNetworkIpc() {
  ipcMain.handle('net:rpcGet', async (_evt, path, options) => {
    const pool = getNetworkPool();
    return pool.rpcGet(String(path || ''), options || {});
  });

  ipcMain.handle('net:restGet', async (_evt, path, options) => {
    const pool = getNetworkPool();
    return pool.restGet(String(path || ''), options || {});
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
}

module.exports = {
  registerNetworkIpc
};

