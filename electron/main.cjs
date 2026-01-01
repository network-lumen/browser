const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startIpfsDaemon, checkIpfsStatus, stopIpfsDaemon } = require('./ipfs.cjs');
const { registerHttpIpc } = require('./ipc/http.cjs');
const { createSplashWindow, createMainWindow, getMainWindow, getSplashWindow } = require('./windows.cjs');
const { registerChainIpc, startChainPoller, stopChainPoller } = require('./ipc/chain.cjs');
const { registerProfilesIpc } = require('./ipc/profiles.cjs');

registerChainIpc();
registerProfilesIpc();
registerHttpIpc();

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

  console.log('[electron] app ready, booting IPFS and main window');
  startIpfsDaemon();
  createSplashWindow();
  startChainPoller();

  if (!app.isPackaged) {
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
