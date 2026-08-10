const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { markStartupSuccess } = require('./services/startup_health.cjs');

let splashWindow = null;
let mainWindow = null;

function isAllowedNewTabUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return /^(https?:\/\/|file:\/\/)/i.test(s) || /^lumen:\/\//i.test(s);
}

function wireWindowOpenToTabs(win) {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  if (!wc) return;

  try {
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedNewTabUrl(url)) {
        try {
          wc.send('tabs:openInNewTab', String(url || ''));
        } catch {}
      }
      return { action: 'deny' };
    });
  } catch {}

  try {
    wc.on('new-window', (event, url) => {
      try {
        event.preventDefault();
      } catch {}
      if (isAllowedNewTabUrl(url)) {
        try {
          wc.send('tabs:openInNewTab', String(url || ''));
        } catch {}
      }
    });
  } catch {}
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;

  splashWindow = new BrowserWindow({
    width: 500,
    height: 250,
    frame: false,
    resizable: false,
    show: false,
    transparent: false,
    backgroundColor: '#dbeafe',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preloads', 'preload.cjs'),
      webviewTag: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  splashWindow.setMenu(null);
  splashWindow.setMenuBarVisibility(false);
  wireWindowOpenToTabs(splashWindow);

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  const indexFile = path.join(__dirname, '..', 'dist', 'index.html');

  if (!app.isPackaged) {
    splashWindow.loadURL(`${devServerUrl}?splash=1`);
  } else {
    splashWindow.loadFile(indexFile, { query: { splash: '1' } }).catch((e) => {
      console.error('[electron][splash] failed to load:', e);
    });
  }

  splashWindow.once('ready-to-show', () => {
    try {
      splashWindow.center();
      splashWindow.show();
    } catch {}
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: isMac ? 'hiddenInset' : (isWin ? 'hidden' : 'default'),
    titleBarOverlay: isWin
      ? { color: '#ffffff', symbolColor: '#334155', height: 30 }
      : undefined,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preloads', 'preload.cjs'),
      webviewTag: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);
  wireWindowOpenToTabs(mainWindow);

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (!app.isPackaged) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    try {
      mainWindow.center();
      mainWindow.show();
    } catch {}
    try {
      markStartupSuccess().catch(() => {});
    } catch {}
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getMainWindow() {
  return mainWindow;
}

function getSplashWindow() {
  return splashWindow;
}

/**
 * The BrowserWindow a webContents belongs to, including a <webview>'s host.
 *
 * Falls back to the main window rather than null: every caller wants a window
 * to act on, and "no window at all" is not a state the app runs in.
 */
function browserWindowForWebContents(contents) {
  const fromContents = (target) => {
    if (!target) return null;
    try {
      if (typeof target.getOwnerBrowserWindow === 'function') {
        const owner = target.getOwnerBrowserWindow();
        if (owner && !owner.isDestroyed?.()) return owner;
      }
    } catch {}
    try {
      const owner = BrowserWindow.fromWebContents(target);
      if (owner && !owner.isDestroyed?.()) return owner;
    } catch {}
    return null;
  };

  const direct = fromContents(contents);
  if (direct) return direct;

  try {
    const host = typeof contents?.hostWebContents === 'function'
      ? contents.hostWebContents()
      : contents?.hostWebContents;
    const owner = fromContents(host);
    if (owner) return owner;
  } catch {}

  return (
    getMainWindow() ||
    BrowserWindow.getFocusedWindow() ||
    BrowserWindow.getAllWindows()[0] ||
    null
  );
}

module.exports = {
  browserWindowForWebContents,
  createSplashWindow,
  createMainWindow,
  getMainWindow,
  getSplashWindow
};

