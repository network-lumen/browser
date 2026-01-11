const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startIpfsDaemon, checkIpfsStatus, stopIpfsDaemon, ipfsAdd, ipfsAddDirectory, ipfsGet, ipfsLs, ipfsPinList, ipfsPinAdd, ipfsUnpin, ipfsStats, ipfsPublishToIPNS, ipfsResolveIPNS, ipfsKeyList, ipfsKeyGen, ipfsSwarmPeers } = require('./ipfs.cjs');
const { startIpfsSeedBootstrapper } = require('./ipfs_seed.cjs');
const { getSettings, setSettings } = require('./settings.cjs');
const { registerHttpIpc } = require('./ipc/http.cjs');
const { createSplashWindow, createMainWindow, getMainWindow, getSplashWindow } = require('./windows.cjs');
const { registerChainIpc, startChainPoller, stopChainPoller } = require('./ipc/chain.cjs');
const { registerProfilesIpc } = require('./ipc/profiles.cjs');
const { registerWalletIpc } = require('./ipc/wallet.cjs');
const { registerGatewayIpc } = require('./ipc/gateway.cjs');
const { registerHandlers: registerAddressBookIpc } = require('./ipc/addressbook.cjs');
const { registerSecurityIpc } = require('./ipc/security.cjs');

registerChainIpc();
registerProfilesIpc();
registerHttpIpc();
registerWalletIpc();
registerGatewayIpc();
registerAddressBookIpc();
registerSecurityIpc();

function isDevtoolsToggle(input) {
  const key = String(input && input.key ? input.key : '').toUpperCase();
  const f12 = key === 'F12';
  const mod = (input && (input.control || input.meta)) && input && input.shift && key === 'I';
  return f12 || mod;
}

ipcMain.handle('ipfs:status', async () => {
  console.log('[electron][ipc] ipfs:status requested');
  return checkIpfsStatus();
});

ipcMain.handle('ipfs:add', async (_evt, data, filename) => {
  console.log('[electron][ipc] ipfs:add requested:', filename);
  return ipfsAdd(data, filename);
});

ipcMain.handle('ipfs:addDirectory', async (_evt, payload) => {
  console.log('[electron][ipc] ipfs:addDirectory requested');
  return ipfsAddDirectory(payload);
});

ipcMain.handle('ipfs:get', async (_evt, cid, options) => {
  console.log('[electron][ipc] ipfs:get requested:', cid);
  return ipfsGet(cid, options || {});
});

ipcMain.handle('ipfs:ls', async (_evt, cidOrPath) => {
  console.log('[electron][ipc] ipfs:ls requested:', cidOrPath);
  return ipfsLs(cidOrPath);
});

ipcMain.handle('ipfs:pinList', async () => {
  return ipfsPinList();
});

ipcMain.handle('ipfs:pinAdd', async (_evt, cidOrPath) => {
  console.log('[electron][ipc] ipfs:pinAdd requested:', cidOrPath);
  return ipfsPinAdd(cidOrPath);
});

ipcMain.handle('ipfs:unpin', async (_evt, cid) => {
  console.log('[electron][ipc] ipfs:unpin requested:', cid);
  return ipfsUnpin(cid);
});

ipcMain.handle('ipfs:stats', async () => {
  return ipfsStats();
});

ipcMain.handle('ipfs:publishToIPNS', async (_evt, cid, key) => {
  console.log('[electron][ipc] ipfs:publishToIPNS requested:', cid, 'key:', key);
  return ipfsPublishToIPNS(cid, key);
});

ipcMain.handle('ipfs:resolveIPNS', async (_evt, name) => {
  console.log('[electron][ipc] ipfs:resolveIPNS requested:', name);
  return ipfsResolveIPNS(name);
});

ipcMain.handle('ipfs:keyList', async () => {
  console.log('[electron][ipc] ipfs:keyList requested');
  return ipfsKeyList();
});

ipcMain.handle('ipfs:keyGen', async (_evt, name) => {
  console.log('[electron][ipc] ipfs:keyGen requested:', name);
  return ipfsKeyGen(name);
});

ipcMain.handle('ipfs:swarmPeers', async () => {
  return ipfsSwarmPeers();
});

ipcMain.handle('settings:getAll', async () => {
  return { ok: true, settings: getSettings() };
});

ipcMain.handle('settings:set', async (_evt, partial) => {
  const before = getSettings();
  const res = setSettings(partial || {});
  if (res?.ok && res?.settings) {
    const after = res.settings;
    const changed =
      String(before?.ipfsApiBase || '') !== String(after?.ipfsApiBase || '') ||
      String(before?.localGatewayBase || '') !== String(after?.localGatewayBase || '');

    // Apply without prompting: restart the embedded IPFS daemon so it binds to the new ports.
    if (changed) {
      try { stopIpfsDaemon(); } catch {}
      setTimeout(() => {
        try { startIpfsDaemon(); } catch {}
      }, 250);
    }
  }
  return res;
});

ipcMain.on('window:mode', (_evt, mode) => {
  const win =
    BrowserWindow.getFocusedWindow() ||
    getMainWindow() ||
    getSplashWindow() ||
    BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (mode === 'startup') {
    win.setResizable(false);
    win.setMinimumSize(500, 250);
    win.setSize(500, 250, true);
  } else if (mode === 'main') {
    win.setResizable(true);
    win.setMinimumSize(800, 600);
    win.setSize(1200, 800, true);
    try { win.center(); } catch {}
  }
});

ipcMain.handle('window:open-main', async () => {
  const main = createMainWindow();
  try { main.focus(); } catch {}
  const current = BrowserWindow.getFocusedWindow();
  if (current && current !== main) {
    try { current.close(); } catch {}
  }
  return true;
});

app.whenReady().then(() => {
  try {
    const appName = 'lumen';
    app.setName(appName);
    app.setPath('userData', path.join(app.getPath('appData'), appName));
    console.log('[electron] userData path set to', app.getPath('userData'));
  } catch (e) {
    console.warn('[electron] failed to set userData path', e);
  }

  // Route any window.open / target=_blank (including from <webview>) into our tab system.
  // This prevents Electron from creating a separate "Chromium-like" popup window.
  try {
    app.on('web-contents-created', (_event, contents) => {
      if (!contents) return;

      const forwardToTabs = (url) => {
        try {
          const s = String(url || '').trim();
          if (!s) return;
          if (!/^https?:\/\//i.test(s) && !/^lumen:\/\//i.test(s)) return;
          const owner =
            typeof contents.getOwnerBrowserWindow === 'function'
              ? contents.getOwnerBrowserWindow()
              : null;
          const fallback =
            getMainWindow() ||
            BrowserWindow.getAllWindows()[0] ||
            BrowserWindow.getFocusedWindow();
          const targetWin = owner || fallback;
          const wc = targetWin && targetWin.webContents ? targetWin.webContents : null;
          if (!wc) return;
          wc.send('tabs:openInNewTab', s);
        } catch {}
      };

      try {
        contents.setWindowOpenHandler(({ url }) => {
          forwardToTabs(url);
          return { action: 'deny' };
        });
      } catch {}

      // Backward compat for older Electron events.
      try {
        contents.on('new-window', (event, url) => {
          try { event.preventDefault(); } catch {}
          forwardToTabs(url);
        });
      } catch {}
    });
  } catch {}

  console.log('[electron] app ready, booting IPFS and main window');
  startIpfsDaemon();
  startIpfsSeedBootstrapper();
  createSplashWindow();
  startChainPoller();

  const allowDevtools = !app.isPackaged || String(process.env.DEBUG_LUMEN_ELECTRON || '') === '1';

  if (allowDevtools) {
    app.on('web-contents-created', (_event, contents) => {
      contents.on('before-input-event', (event, input) => {
        if (isDevtoolsToggle(input)) {
          event.preventDefault();
          try { contents.toggleDevTools(); } catch {}
        }
      });
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    try { stopChainPoller(); } catch {}
    try { stopIpfsDaemon(); } catch {}
    app.quit();
  }
});
