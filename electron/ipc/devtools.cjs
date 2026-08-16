const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const { isDevtoolsToggle, isDevtoolsF12 } = require('../hotkeys.cjs');
const { resolveActiveTargetWebContents } = require('./find.cjs');
const { forgetSiteWebContents } = require('../sites/actions.cjs');

/**
 * Opening devtools on whatever the user is actually looking at.
 *
 * The awkward part is that the shortcut arrives on the webContents that had
 * focus, which for a tab is the `<webview>` and for the shell is the window -
 * and the useful target is neither reliably. So the source is resolved to the
 * active tab, then to the focused contents when that focus is inside the same
 * window, and the devtools window is raised afterwards because opening it
 * detached does not always bring it forward.
 */

/**
 * Personal-site `<webview>` pages (lumen://mysite.lmn) register themselves here
 * so F12 works for them in packaged builds, without opening devtools up to
 * every webview - extensions, plain IPFS and http content - in production.
 */
const siteDevtoolsTargetIds = new Set();

function toWebContentsIdNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveFocusedDevtoolsTarget(sourceContents) {
  const fallback = resolveActiveTargetWebContents(sourceContents) || sourceContents;
  let sourceOwner = null;
  try {
    sourceOwner =
      sourceContents && typeof sourceContents.getOwnerBrowserWindow === 'function'
        ? sourceContents.getOwnerBrowserWindow()
        : sourceContents
          ? BrowserWindow.fromWebContents(sourceContents)
          : null;
  } catch {
    sourceOwner = null;
  }

  let focused = null;
  try {
    focused =
      webContents && typeof webContents.getFocusedWebContents === 'function'
        ? webContents.getFocusedWebContents()
        : null;
  } catch {
    focused = null;
  }

  if (!focused || focused.isDestroyed?.()) return fallback;

  let focusedOwner = null;
  try {
    focusedOwner =
      typeof focused.getOwnerBrowserWindow === 'function'
        ? focused.getOwnerBrowserWindow()
        : BrowserWindow.fromWebContents(focused);
  } catch {
    focusedOwner = null;
  }
  if (!focusedOwner || (sourceOwner && focusedOwner !== sourceOwner)) return fallback;

  return focused;
}

function focusDevToolsWindowForContents(targetContents) {
  if (!targetContents || targetContents.isDestroyed?.()) return false;

  try {
    const devtoolsContents = targetContents.devToolsWebContents;
    if (!devtoolsContents || devtoolsContents.isDestroyed?.()) return false;

    const devtoolsWindow = BrowserWindow.fromWebContents(devtoolsContents);
    if (devtoolsWindow && !devtoolsWindow.isDestroyed?.()) {
      try { devtoolsWindow.show?.(); } catch {}
      try { devtoolsWindow.restore?.(); } catch {}
      try { devtoolsWindow.focus?.(); } catch {}
      try { devtoolsWindow.moveTop?.(); } catch {}
      return true;
    }

    try { devtoolsContents.focus?.(); } catch {}
    return true;
  } catch {
    return false;
  }
}

function openDevToolsForSourceContents(sourceContents, options = {}) {
  const toggle = !!options.toggle;
  const targetContents = resolveFocusedDevtoolsTarget(sourceContents);
  if (!targetContents || targetContents.isDestroyed?.()) {
    return { ok: false, error: 'target_missing' };
  }

  try {
    targetContents.focus?.();
  } catch {}

  try {
    if (toggle && typeof targetContents.isDevToolsOpened === 'function' && targetContents.isDevToolsOpened()) {
      targetContents.closeDevTools?.();
      return { ok: true, action: 'closed', targetWebContentsId: targetContents.id };
    }

    try {
      targetContents.once?.('devtools-opened', () => {
        setTimeout(() => {
          focusDevToolsWindowForContents(targetContents);
        }, 25);
      });
    } catch {}

    targetContents.openDevTools?.({ mode: 'detach', activate: true });
    setTimeout(() => {
      focusDevToolsWindowForContents(targetContents);
    }, 100);
    return { ok: true, action: 'opened', targetWebContentsId: targetContents.id };
  } catch (error) {
    try {
      if (toggle) {
        targetContents.toggleDevTools?.();
        return { ok: true, action: 'toggled', targetWebContentsId: targetContents.id };
      }
    } catch {}

    return {
      ok: false,
      error: String(error && error.message ? error.message : error || 'open_devtools_failed'),
      targetWebContentsId: targetContents.id,
    };
  }
}

/**
 * Attaches the keyboard shortcut to every webContents the app creates, and
 * cleans up the per-contents registrations when one goes away.
 *
 * In development every devtools combination works everywhere. In a packaged
 * build only F12, and only on a page that registered itself.
 */
function attachDevtoolsHotkeys() {
  const allowDevtools = !app.isPackaged || String(process.env.DEBUG_LUMEN_ELECTRON || '') === '1';

  app.on('web-contents-created', (_event, contents) => {
    contents.once('destroyed', () => {
      siteDevtoolsTargetIds.delete(contents.id);
      forgetSiteWebContents(contents.id);
    });

    contents.on('before-input-event', (event, input) => {
      if (allowDevtools && isDevtoolsToggle(input)) {
        event.preventDefault();
        openDevToolsForSourceContents(contents, { toggle: true });
        return;
      }
      if (!allowDevtools && isDevtoolsF12(input) && siteDevtoolsTargetIds.has(contents.id)) {
        event.preventDefault();
        openDevToolsForSourceContents(contents, { toggle: true });
      }
    });
  });
}

function registerDevtoolsIpc() {
  ipcMain.handle('devtools:openActive', async (evt) =>
    openDevToolsForSourceContents(evt?.sender, { toggle: false }),
  );

  ipcMain.on('devtools:registerSiteTarget', (_evt, targetWebContentsId) => {
    const id = toWebContentsIdNumber(targetWebContentsId);
    if (id != null) siteDevtoolsTargetIds.add(id);
  });

  ipcMain.on('devtools:unregisterSiteTarget', (_evt, targetWebContentsId) => {
    const id = toWebContentsIdNumber(targetWebContentsId);
    if (id != null) siteDevtoolsTargetIds.delete(id);
  });
}

module.exports = {
  registerDevtoolsIpc,
  attachDevtoolsHotkeys,
};
