const { app, BrowserWindow } = require('electron');
const path = require('node:path');

let splashWindow = null;
let mainWindow = null;

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
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false
    }
  });

  splashWindow.setMenu(null);
  splashWindow.setMenuBarVisibility(false);

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  const splashUrl = app.isPackaged
    ? path.join(__dirname, '..', 'dist', 'index.html?splash=1')
    : `${devServerUrl}?splash=1`;

  if (!app.isPackaged) {
    splashWindow.loadURL(splashUrl);
  } else {
    splashWindow.loadFile(splashUrl);
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
      ? { color: '#dbeafe', symbolColor: '#334155', height: 30 }
      : undefined,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#dbeafe',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false
    }
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

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

module.exports = {
  createSplashWindow,
  createMainWindow,
  getMainWindow,
  getSplashWindow
};

