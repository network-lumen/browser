const { app, ipcMain } = require('electron');
const { safeString } = require('../utils/strings.cjs');
const { appendRendererError } = require('../services/main_logger.cjs');
const { registerSiteHost, getSiteHostStatus } = require('../sites/protocol.cjs');
const { ensureUiSender } = require('../sites/actions.cjs');

/**
 * The handful of channels that belong to the app itself rather than to any
 * feature: what languages the OS is set to, an error the renderer could not
 * handle, and the domain a site is being served under.
 */

/**
 * An error the renderer could not handle itself, on its way to errors.log.
 *
 * `ensureUiSender` is not optional here. This writes to a file on every call,
 * so a channel a page could reach is a way to fill the user's disk from a tab -
 * which is also why it is not exposed in webview-preload at all. Two gates
 * rather than one, because the cheap one can be forgotten.
 */
function registerRendererErrorChannel() {
  ipcMain.on('app:reportRendererError', (evt, payload) => {
    if (!ensureUiSender(evt).ok) return;
    try {
      appendRendererError(payload);
    } catch {
      // A logger that throws is worse than a missing line.
    }
  });
}

/**
 * The OS's language preferences, best first, for the renderer to pick a
 * starting language from.
 *
 * Synchronous on purpose - the renderer needs an answer before its first paint,
 * and this is a read of a value Electron already holds.
 * `getPreferredSystemLanguages` is the ordered list a user actually configured;
 * `getSystemLocale` is the single locale the OS reports, kept as a fallback for
 * the platforms where the list comes back empty.
 *
 * LUMEN_SYSTEM_LANGUAGES pins what the app believes the OS is set to. On a
 * fresh profile the interface follows the system language, which is the
 * behaviour people expect and exactly what breaks a test asserting English
 * button labels on a French machine. The end-to-end harness sets this to "en"
 * so a run says the same thing wherever it happens; by hand it is also the
 * quickest way to see a screen in another language without changing anything.
 */
function registerSystemLanguagesChannel() {
  ipcMain.on('app:systemLanguages', (evt) => {
    evt.returnValue = [];
    if (!ensureUiSender(evt).ok) return;

    const forced = String(process.env.LUMEN_SYSTEM_LANGUAGES || '').trim();
    if (forced) {
      evt.returnValue = forced.split(',').map((entry) => entry.trim()).filter(Boolean);
      return;
    }

    try {
      const preferred = typeof app.getPreferredSystemLanguages === 'function'
        ? app.getPreferredSystemLanguages()
        : [];
      const fallback = typeof app.getSystemLocale === 'function' ? app.getSystemLocale() : '';
      evt.returnValue = [...(Array.isArray(preferred) ? preferred : []), fallback, app.getLocale()]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean);
    } catch (e) {
      console.warn('[electron] failed to read system languages:', String(e?.message || e));
    }
  });
}

/**
 * Points a Lumen domain at the ipfs/ipns target currently behind it, so the
 * local site-host server can serve it under a stable <domain>.localhost origin.
 * Resolution stays in SitePage - this only records the outcome.
 */
function registerSiteHostChannels() {
  ipcMain.handle('siteHost:register', async (evt, host, target) => {
    const okUi = ensureUiSender(evt);
    if (!okUi.ok) return okUi;
    try {
      return registerSiteHost(safeString(host, 256), {
        proto: safeString(target?.proto, 16),
        id: safeString(target?.id, 512),
        basePath: safeString(target?.basePath, 1024)
      });
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle('siteHost:status', async () => getSiteHostStatus());
}

function registerAppIpc() {
  registerRendererErrorChannel();
  registerSystemLanguagesChannel();
  registerSiteHostChannels();
}

module.exports = {
  registerAppIpc,
};
