const { ipcMain } = require('electron');
const {
  getLatestReleaseInfo,
  openExternal,
  pollNow
} = require('../daemons/release_watcher.cjs');
const { downloadAndInstall, isValidSha256Hex } = require('../services/release_installer.cjs');
const { ensureUiSender } = require('../sites/actions.cjs');

function registerReleaseIpc() {
  ipcMain.handle('release:getLatestInfo', async () => {
    return getLatestReleaseInfo();
  });

  ipcMain.handle('release:pollNow', async () => {
    return pollNow();
  });

  /**
   * Installs the update this process found, and only that one.
   *
   * What the caller sends is no longer what gets installed. This used to be
   * `downloadAndInstall({ ...input })`, so the URL *and* its digest came out of
   * the renderer's payload - nothing tied the artefact that got installed to
   * the release record the watcher had read off the chain, and a payload with
   * no digest was installed unverified. The round trip was pointless even in
   * the honest case: the renderer was handing back values it had just been
   * given by `release:getLatestInfo`.
   *
   * Two gates rather than one, as elsewhere in this app: the channel is not
   * exposed outside preload.cjs, and it also refuses a sender that is not the
   * app window.
   */
  ipcMain.handle('release:downloadAndInstall', async (evt, input) => {
    const ui = ensureUiSender(evt);
    if (!ui.ok) return ui;

    const latest = getLatestReleaseInfo();
    const url = String(latest?.downloadUrl || '').trim();
    if (!url) return { ok: false, error: 'no_release_available' };

    const sha256Hex = String(latest?.artifact?.sha256Hex || '').trim();
    if (!isValidSha256Hex(sha256Hex)) return { ok: false, error: 'release_missing_sha256' };

    return downloadAndInstall({
      url,
      sha256Hex,
      sizeBytes: latest?.artifact?.size ?? null,
      // Presentation only: whether to show progress, and what to call it.
      silent: input?.silent !== false,
      label: latest?.version || null,
      senderWebContents: evt?.sender
    });
  });

  ipcMain.handle('release:openExternal', async (evt, url) => {
    const ui = ensureUiSender(evt);
    if (!ui.ok) return ui;
    return openExternal(url);
  });
}

module.exports = {
  registerReleaseIpc
};
