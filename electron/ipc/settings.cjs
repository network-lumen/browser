const { BrowserWindow, ipcMain, clipboard } = require('electron');
const {
  getSettings,
  setSettings,
  loadGateways,
  addGateway,
  updateGateway,
  deleteGateway,
  loadPrivateCloudConfig,
  savePrivateCloudConfig,
} = require('../settings.cjs');
const {
  getBootstrapRuntimeState,
  resetCustomUserDataPath,
  setCustomUserDataPath,
} = require('../bootstrap_paths.cjs');
const { syncActiveSessionTimeout } = require('./security.cjs');
const { startIpfsDaemon, stopIpfsDaemon } = require('../ipfs.cjs');
const { resetNetworkPool } = require('../daemons/peers/pool_singleton.cjs');

/**
 * App settings, the gateway list the user maintains by hand, the private-cloud
 * config, the data folder, and the clipboard.
 *
 * The clipboard sits here because it is the same kind of thing: a one-line
 * pass-through to an Electron API with no domain of its own, and a file of its
 * own for one handler would be worse than the company.
 */

/**
 * Changing where IPFS lives has to reach the daemon, or the setting is a lie
 * until the next launch. Restarting is deliberate and unprompted: the endpoints
 * are only read at startup, so nothing short of a restart applies them.
 */
function restartIpfsIfEndpointsChanged(before, after) {
  const changed =
    String(before?.ipfsApiBase || '') !== String(after?.ipfsApiBase || '') ||
    String(before?.localGatewayBase || '') !== String(after?.localGatewayBase || '') ||
    String(before?.ipfsConnectivityMode || '') !== String(after?.ipfsConnectivityMode || '');
  if (!changed) return;

  try { stopIpfsDaemon(); } catch {}
  setTimeout(() => {
    try { startIpfsDaemon(); } catch {}
  }, 250);
}

/**
 * Switching network invalidates every peer in the pool, the chain id, and every
 * balance and transaction already on screen. The pool is dropped so the next
 * read bootstraps from the new network's section of peers.txt, and the windows
 * are told so the pages refetch rather than showing another chain's numbers
 * under the new network's name.
 */
function applyNetworkChange(before, after) {
  if (String(before?.lumenNetwork || '') === String(after?.lumenNetwork || '')) return;

  try { resetNetworkPool(); } catch {}
  try {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.webContents?.send('net:networkChanged', { networkId: after.lumenNetwork });
      } catch {
        // A window that has gone away is not worth failing the switch over.
      }
    });
  } catch {}
}

/**
 * The one way the network setting is written.
 *
 * `settings:set` and `net:setNetwork` both land here, so neither can be the
 * path that forgets to drop the pool - which would leave the app on the old
 * chain's peers while the setting, and the UI reading it, said otherwise.
 */
function setLumenNetworkSetting(id) {
  const before = getSettings();
  const res = setSettings({ lumenNetwork: String(id || '') });
  if (res?.ok && res?.settings) applyNetworkChange(before, res.settings);
  return res;
}

function registerSettingsIpc() {
  ipcMain.handle('settings:getAll', async () => ({ ok: true, settings: getSettings() }));

  ipcMain.handle('settings:set', async (_evt, partial) => {
    const before = getSettings();
    const res = setSettings(partial || {});
    if (res?.ok && res?.settings) {
      const after = res.settings;
      if (before?.securitySessionTimeoutMs !== after?.securitySessionTimeoutMs) {
        try { syncActiveSessionTimeout(after.securitySessionTimeoutMs); } catch {}
      }
      restartIpfsIfEndpointsChanged(before, after);
      applyNetworkChange(before, after);
    }
    return res;
  });

  ipcMain.handle('settings:loadGateways', async () => {
    try {
      return loadGateways();
    } catch (e) {
      console.error('[electron][ipc] settings:loadGateways error:', e);
      return [];
    }
  });

  ipcMain.handle('settings:addGateway', async (_evt, gateway) => {
    try {
      return addGateway(gateway);
    } catch (e) {
      console.error('[electron][ipc] settings:addGateway error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('settings:updateGateway', async (_evt, id, updates) => {
    try {
      return updateGateway(id, updates);
    } catch (e) {
      console.error('[electron][ipc] settings:updateGateway error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('settings:deleteGateway', async (_evt, id) => {
    try {
      return deleteGateway(id);
    } catch (e) {
      console.error('[electron][ipc] settings:deleteGateway error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('settings:loadPrivateCloudConfig', async () => {
    try {
      return loadPrivateCloudConfig();
    } catch (e) {
      console.error('[electron][ipc] settings:loadPrivateCloudConfig error:', e);
      return {
        enabled: false,
        gatewayIds: [],
        preferPrivate: false,
        fallbackToDAO: true,
        timeout: 5000,
        maxRetries: 3
      };
    }
  });

  ipcMain.handle('settings:savePrivateCloudConfig', async (_evt, config) => {
    try {
      return savePrivateCloudConfig(config);
    } catch (e) {
      console.error('[electron][ipc] settings:savePrivateCloudConfig error:', e);
      return { ok: false, error: String(e.message) };
    }
  });

  ipcMain.handle('bootstrapPath:getState', async () => ({ ok: true, state: getBootstrapRuntimeState() }));

  ipcMain.handle('bootstrapPath:setCustomUserDataPath', async (_evt, nextPath) =>
    setCustomUserDataPath(nextPath),
  );

  ipcMain.handle('bootstrapPath:resetCustomUserDataPath', async () => resetCustomUserDataPath());

  ipcMain.handle('clipboard:writeText', async (_evt, text) => {
    try {
      clipboard.writeText(String(text ?? ''));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });
}

module.exports = {
  registerSettingsIpc,
  setLumenNetworkSetting,
};
