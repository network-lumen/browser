const { app, nativeImage } = require('electron');
const path = require('node:path');
const { existsSync } = require('node:fs');

// Windows groups taskbar buttons - and picks the icon they show - by app user
// model id. An unpackaged run has none of its own, so it inherits
// electron.exe's, which is why `npm run dev` showed the Electron atom.
const APP_USER_MODEL_ID = 'com.lumen.browser';

// src/ is not in the packaged app (build.files ships dist/, electron/ and
// package.json only), so the shipped copy is the one electron-builder writes
// to the resources directory via extraResources.
function resolveAppIconPath() {
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'src', 'img', 'logo.png');
  return existsSync(file) ? file : null;
}

function appIconImage() {
  const file = resolveAppIconPath();
  if (!file) return null;
  try {
    const image = nativeImage.createFromPath(file);
    return image.isEmpty() ? null : image;
  } catch {
    return null;
  }
}

/**
 * Must run before the first window is created: the app user model id decides
 * which taskbar button a window lands under, and moving it afterwards leaves
 * the already-created window behind.
 */
function applyAppIdentity() {
  if (process.platform === 'win32') {
    try {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    } catch {}
  }
  if (process.platform === 'darwin' && app.dock) {
    const image = appIconImage();
    if (image) {
      try {
        app.dock.setIcon(image);
      } catch {}
    }
  }
}

module.exports = {
  APP_USER_MODEL_ID,
  appIconImage,
  applyAppIdentity,
  resolveAppIconPath
};
