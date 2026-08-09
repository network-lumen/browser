const { ipcMain } = require('electron');
const {
  getLatestReleaseInfo,
  openExternal,
  pollNow
} = require('../daemons/release_watcher.cjs');
const { downloadAndInstall } = require('../services/release_installer.cjs');

function registerReleaseIpc() {
  ipcMain.handle('release:getLatestInfo', async () => {
    return getLatestReleaseInfo();
  });

  ipcMain.handle('release:pollNow', async () => {
    return pollNow();
  });

  ipcMain.handle('release:downloadAndInstall', async (evt, input) => {
    return downloadAndInstall({ ...(input || {}), senderWebContents: evt?.sender });
  });

  ipcMain.handle('release:openExternal', async (_evt, url) => {
    return openExternal(url);
  });
}

module.exports = {
  registerReleaseIpc
};
