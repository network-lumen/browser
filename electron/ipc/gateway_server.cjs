const { ipcMain } = require('electron');
const {
  startGatewayServer,
  stopGatewayServer,
  getGatewayServerStatus,
  getStoredApiKey,
} = require('../gateways/server/index.cjs');
const { saveUserMetadata, getAllUserMetadata } = require('../gateways/server/database.cjs');
const { ensureUiSender } = require('../sites/actions.cjs');

/**
 * Running a gateway of your own, from this machine.
 *
 * Every channel here is guarded to the app's own window. These are not
 * site-facing operations: `getApiKey` hands back the credential that authorises
 * writes to the local gateway, and `start` opens a listening socket. A
 * `<webview>` reaches `ipcRenderer` through its preload, so an unguarded
 * channel is one a page can call - and a page that can read the API key can
 * write to the gateway as its owner.
 *
 * `ensureUiSender` compares the sender against the main window's webContents,
 * so nothing but the shell can get past it.
 */

function registerGatewayServerIpc() {
  ipcMain.handle('gatewayServer:start', async (evt, options) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return await startGatewayServer(options);
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:start error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('gatewayServer:stop', async (evt) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return await stopGatewayServer();
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:stop error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('gatewayServer:status', async (evt) => {
    if (!ensureUiSender(evt).ok) return { running: false, port: null, url: null };
    try {
      return getGatewayServerStatus();
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:status error:', e);
      return { running: false, port: null, url: null };
    }
  });

  ipcMain.handle('gatewayServer:getApiKey', async (evt) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return { ok: true, apiKey: getStoredApiKey() };
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:getApiKey error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('gatewayServer:saveMetadata', async (evt, address, metadata) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return { ok: true, metadata: saveUserMetadata(address, metadata) };
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:saveMetadata error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('gatewayServer:getAllMetadata', async (evt) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return { ok: true, metadata: getAllUserMetadata() };
    } catch (e) {
      console.error('[electron][ipc] gatewayServer:getAllMetadata error:', e);
      return { ok: false, error: String(e.message) };
    }
  });
}

module.exports = {
  registerGatewayServerIpc,
};
