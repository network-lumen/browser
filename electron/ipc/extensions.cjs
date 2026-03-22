const { BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { extensionManager } = require('../extensions/manager.cjs');

let registered = false;
let broadcastAttached = false;
let extensionStoreWindow = null;

function broadcastExtensionsChanged(entries) {
  const windows =
    typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
  for (const win of windows) {
    try {
      win?.webContents?.send?.('extensions:changed', Array.isArray(entries) ? entries : []);
    } catch {
      // Ignore per-window failures.
    }
  }
}

function resultFromOperation(result) {
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'extension_operation_failed' };
  }
  return result;
}

function normalizeChromeWebStoreUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return 'https://chromewebstore.google.com/category/extensions';
  return raw;
}

function createOrFocusExtensionStoreWindow(targetUrl) {
  const nextUrl = normalizeChromeWebStoreUrl(targetUrl);
  if (extensionStoreWindow && !extensionStoreWindow.isDestroyed()) {
    try {
      extensionStoreWindow.loadURL(nextUrl);
    } catch {}
    try {
      extensionStoreWindow.show();
      extensionStoreWindow.focus();
    } catch {}
    return extensionStoreWindow;
  }

  extensionStoreWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Chrome Web Store',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:lumen',
      preload: path.join(__dirname, '..', 'webview-preload.cjs')
    }
  });

  try {
    extensionStoreWindow.setMenu(null);
    extensionStoreWindow.setMenuBarVisibility(false);
  } catch {}

  try {
    extensionStoreWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        extensionStoreWindow.loadURL(normalizeChromeWebStoreUrl(url));
      } catch {}
      return { action: 'deny' };
    });
  } catch {}

  extensionStoreWindow.on('closed', () => {
    extensionStoreWindow = null;
  });

  void extensionStoreWindow.loadURL(nextUrl).catch(() => {});
  return extensionStoreWindow;
}

function registerExtensionsIpc() {
  if (registered) return;
  registered = true;

  if (!broadcastAttached) {
    broadcastAttached = true;
    extensionManager.on('changed', (entries) => {
      broadcastExtensionsChanged(entries);
    });
  }

  ipcMain.handle('extensions:list', async () => {
    return { ok: true, extensions: extensionManager.listExtensions() };
  });

  ipcMain.handle('extensions:loadUnpacked', async (evt) => {
    const owner = evt?.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
    return resultFromOperation(await extensionManager.loadUnpacked(owner));
  });

  ipcMain.handle('extensions:installFromChromeWebStore', async (_evt, input) => {
    return resultFromOperation(await extensionManager.installFromChromeWebStore(input));
  });

  ipcMain.handle('extensions:enable', async (_evt, extensionId) => {
    return resultFromOperation(await extensionManager.enableExtension(extensionId));
  });

  ipcMain.handle('extensions:disable', async (_evt, extensionId) => {
    return resultFromOperation(await extensionManager.disableExtension(extensionId));
  });

  ipcMain.handle('extensions:reload', async (_evt, extensionId) => {
    return resultFromOperation(await extensionManager.reloadExtension(extensionId));
  });

  ipcMain.handle('extensions:remove', async (_evt, extensionId) => {
    return resultFromOperation(await extensionManager.removeExtension(extensionId));
  });

  ipcMain.handle('extensions:openStore', async (_evt, url) => {
    createOrFocusExtensionStoreWindow(url);
    return { ok: true };
  });

  ipcMain.handle('extensions:getProviderFallbackState', async () => {
    return extensionManager.getProviderFallbackState();
  });

  ipcMain.on('extensions:installFromStore', async (evt, payload) => {
    const input =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object'
          ? String(payload.id || payload.url || '').trim()
          : '';
    let result = { ok: false, error: 'invalid_chrome_web_store_id' };
    if (input) {
      result = resultFromOperation(await extensionManager.installFromChromeWebStore(input));
    }
    try {
      evt.sender.send('extensions:storeInstallResult', result);
    } catch {
      // ignore sender failures
    }
  });

  ipcMain.on('extensions:getProviderFallbackStateSync', (evt) => {
    try {
      evt.returnValue = extensionManager.getProviderFallbackState();
    } catch (error) {
      evt.returnValue = { keplr: true, leap: true, ethereum: true, error: String(error?.message || error || '') };
    }
  });
}

module.exports = {
  registerExtensionsIpc
};
