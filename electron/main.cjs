const { safeString } = require('./utils/strings.cjs');
const { app, BrowserWindow, ipcMain, session, dialog, webContents, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const {
  APP_NAME,
  getBootstrapRuntimeState,
  resolveStartupUserDataPath,
  resetCustomUserDataPath,
  setCustomUserDataPath,
} = require('./bootstrap_paths.cjs');
const { initializeMainLogger, appendRendererError } = require('./services/main_logger.cjs');

function configureAppPaths() {
  try {
    app.setName(APP_NAME);
    const resolved = resolveStartupUserDataPath();
    if (!resolved?.ok || !resolved?.state?.effectiveUserDataPath) {
      const state = resolved?.state || {};
      const target = String(
        state.usingCustomUserDataPath
          ? state.customUserDataPath || ''
          : state.effectiveUserDataPath || ''
      ).trim();
      const reason = String(resolved?.error || 'path_unavailable').trim();
      const title = 'Lumen data folder unavailable';
      const body = [
        'Lumen could not start because the configured data folder is unavailable.',
        '',
        `Target: ${target || '(empty)'}`,
        `Reason: ${reason}`,
        '',
        'Update the configured folder in the bootstrap config or restore access to that path.',
      ].join('\n');
      console.error('[electron] failed to configure userData path:', { target, reason });
      return { ok: false, error: reason, title, body, state };
    }
    const userDataPath = resolved.state.effectiveUserDataPath;
    app.setPath('userData', userDataPath);
    app.setAppLogsPath(path.join(userDataPath, 'logs'));
    return { ok: true, state: resolved.state };
  } catch (e) {
    const reason = String(e && e.message ? e.message : e || 'path_configuration_failed');
    console.error('[electron] configureAppPaths exception:', reason);
    return {
      ok: false,
      error: reason,
      title: 'Lumen data folder unavailable',
      body: `Lumen could not configure its data folder.\n\nReason: ${reason}`,
      state: null,
    };
  }
}

const configuredAppPaths = configureAppPaths();
const startupPathConfigFailure = configuredAppPaths?.ok ? null : configuredAppPaths;

async function showStartupPathRecoveryDialog(failure) {
  let currentFailure = failure && typeof failure === 'object' ? { ...failure } : {};

  while (true) {
    const title = String(currentFailure?.title || 'Lumen data folder unavailable').trim();
    const message = 'Lumen could not start because the configured data folder is unavailable.';
    const detail = String(
      currentFailure?.body ||
      `Reason: ${String(currentFailure?.error || 'path_unavailable').trim()}`,
    ).trim();

    const action = dialog.showMessageBoxSync({
      type: 'error',
      buttons: ['Close Lumen', 'Update Folder and Restart'],
      defaultId: 1,
      cancelId: 0,
      noLink: true,
      title,
      message,
      detail: `${detail}\n\nChoose "Update Folder and Restart" to select a different data folder.`,
    });

    if (action !== 1) {
      try { app.quit(); } catch {}
      return;
    }

    const selected = dialog.showOpenDialogSync({
      title: 'Select Lumen data folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!Array.isArray(selected) || !selected.length) {
      continue;
    }

    const nextPath = String(selected[0] || '').trim();
    const update = setCustomUserDataPath(nextPath);
    if (update?.ok) {
      try {
        app.relaunch();
      } catch {}
      try {
        app.exit(0);
      } catch {
        try { app.quit(); } catch {}
      }
      return;
    }

    currentFailure = {
      ok: false,
      error: String(update?.error || 'path_update_failed'),
      title: 'Could not update Lumen data folder',
      body: [
        `Selected folder: ${nextPath || '(empty)'}`,
        `Reason: ${String(update?.error || 'path_update_failed').trim()}`,
      ].join('\n'),
      state: null,
    };
  }
}

if (!startupPathConfigFailure) {
  initializeMainLogger();
}

// Linux environments without a user session bus (containers, system services, root shells) can cause
// portal-backed file pickers to hang. Prefer the native GTK dialog in that case.
try {
  if (
    process.platform === 'linux' &&
    !process.env.GTK_USE_PORTAL &&
    (
      (typeof process.getuid === 'function' && process.getuid() === 0) ||
      !String(process.env.DBUS_SESSION_BUS_ADDRESS || '').trim() ||
      !String(process.env.XDG_RUNTIME_DIR || '').trim()
    )
  ) {
    process.env.GTK_USE_PORTAL = '0';
    console.log('[electron] GTK_USE_PORTAL=0 (no-session)');
  }
} catch {}

const { startIpfsDaemon, stopIpfsDaemon, prefetchPublicIpfsGateways, addPinJobListener } = require('./ipfs.cjs');
const { startIpfsCache } = require('./daemons/ipfs_cache.cjs');
const { startIpfsSeedBootstrapper } = require('./daemons/ipfs_seed.cjs');
const { getSettings, setSettings, loadGateways, addGateway, updateGateway, deleteGateway, loadPrivateCloudConfig, savePrivateCloudConfig } = require('./settings.cjs');
const { startGatewayServer, stopGatewayServer, getGatewayServerStatus, getStoredApiKey } = require('./gateways/server/index.cjs');
const {
  registerSiteSchemePrivileges,
  installSiteProtocol,
  registerSiteHost,
  getSiteHostStatus
} = require('./sites/protocol.cjs');

// Has to happen before app 'ready', which is why it sits at module scope.
registerSiteSchemePrivileges();
const { registerHttpIpc, registerExtensionNetworkRequestGuard } = require('./ipc/http.cjs');
const {
  createSplashWindow,
  createMainWindow,
  getMainWindow,
  getSplashWindow,
  browserWindowForWebContents
} = require('./windows.cjs');
const { registerChainIpc } = require('./ipc/chain.cjs');
const { registerNetworkIpc } = require('./ipc/network.cjs');
const { registerIpfsIpc } = require('./ipc/ipfs.cjs');
const { registerReleaseIpc } = require('./ipc/release.cjs');
const { registerProfilesIpc } = require('./ipc/profiles.cjs');
const { registerWalletIpc } = require('./ipc/wallet.cjs');
const { registerGatewayIpc } = require('./ipc/gateway.cjs');
const { registerHandlers: registerAddressBookIpc } = require('./ipc/addressbook.cjs');
const { registerSecurityIpc, syncActiveSessionTimeout } = require('./ipc/security.cjs');
const { registerIpfsPubsubIpc } = require('./ipc/ipfs_pubsub.cjs');
const { registerHlsIpc } = require('./ipc/hls.cjs');
const { registerFindIpc, resolveActiveTargetWebContents } = require('./ipc/find.cjs');
const { registerDriveBackupIpc } = require('./ipc/drive_backup.cjs');
const { registerTroubleshootingIpc } = require('./ipc/troubleshooting.cjs');
const { registerExtensionsIpc } = require('./ipc/extensions.cjs');
const { extensionManager } = require('./extensions/manager.cjs');
const { startDaemons, stopDaemons } = require('./daemons/index.cjs');
const { recordLaunchStart, markGracefulExit } = require('./services/startup_health.cjs');
const {
  registerSiteIpc,
  forgetSiteWebContents,
  ensureUiSender,
  deriveSiteKeyFromHref
} = require('./sites/actions.cjs');

registerChainIpc();
registerSiteIpc();
registerProfilesIpc();
registerHttpIpc();
registerNetworkIpc();
registerIpfsIpc();
registerReleaseIpc();
registerWalletIpc();
registerGatewayIpc();
registerAddressBookIpc();
registerSecurityIpc();
registerIpfsPubsubIpc();
registerHlsIpc();
registerFindIpc();
registerDriveBackupIpc();
registerTroubleshootingIpc();
registerExtensionsIpc();


function broadcastPinJobUpdate(payload) {
  try {
    const wins = typeof BrowserWindow.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const win of wins) {
      try {
        win?.webContents?.send?.('ipfs:pinProgress', payload || {});
      } catch {}
    }
  } catch {}
}

addPinJobListener((payload) => {
  broadcastPinJobUpdate(payload);
});

const LUMEN_SESSION_PARTITION = 'persist:lumen';
const LUMEN_SESSION_PRELOAD_ID = 'lumen-extension-preload';

function listSessionPreloadScripts(ses) {
  try {
    const scripts = ses && typeof ses.getPreloadScripts === 'function' ? ses.getPreloadScripts() : [];
    return Array.isArray(scripts)
      ? scripts.map((script) => ({
          id: safeString(script?.id, 256),
          type: safeString(script?.type, 64),
          filePath: safeString(script?.filePath, 4096),
        }))
      : [];
  } catch {
    return [];
  }
}

function registerLumenSessionPreload() {
  const ses = session.fromPartition(LUMEN_SESSION_PARTITION);
  const preloadScripts = [
    {
      id: LUMEN_SESSION_PRELOAD_ID,
      type: 'frame',
      filePath: path.join(__dirname, 'preloads', 'webview-preload.cjs'),
    },
  ];

  try {
    if (typeof ses.unregisterPreloadScript === 'function') {
      for (const script of listSessionPreloadScripts(ses)) {
        if (script.id === LUMEN_SESSION_PRELOAD_ID) {
          try {
            ses.unregisterPreloadScript(script.id);
          } catch {}
        }
      }
    }

    if (typeof ses.registerPreloadScript === 'function') {
      for (const preload of preloadScripts) {
        const registeredId = String(ses.registerPreloadScript(preload) || '').trim();
        console.log('[main] registered session preload', {
          requestedId: preload.id,
          registeredId,
          partition: LUMEN_SESSION_PARTITION,
          preloadPath: preload.filePath,
          preloadType: preload.type,
        });
      }
    } else {
      ses.setPreloads(preloadScripts.map((preload) => preload.filePath));
      console.log('[main] registered session preload via deprecated setPreloads', {
        partition: LUMEN_SESSION_PARTITION,
        preloadPaths: preloadScripts.map((preload) => preload.filePath),
      });
    }

    console.log('[main] registered preloads =', {
      partition: LUMEN_SESSION_PARTITION,
      scripts: listSessionPreloadScripts(ses),
    });
  } catch (e) {
    // This is the failure that leaves every site without window.lumen, so the
    // warning has to survive: `preloadPath` was never a variable here, and
    // reading it threw a second time, inside the handler for the first.
    console.warn('[main] failed to register session preload', {
      partition: LUMEN_SESSION_PARTITION,
      preloadPaths: preloadScripts.map((preload) => preload.filePath),
      error: String(e && e.message ? e.message : e || 'unknown_error'),
    });
  }
}

/**
 * Points a Lumen domain at the ipfs/ipns target currently behind it, so the
 * local site-host server can serve it under a stable <domain>.localhost origin.
 * Resolution stays in SitePage - this only records the outcome.
 */
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

/**
 * An error the renderer could not handle itself, on its way to errors.log.
 *
 * `ensureUiSender` is not optional here. This writes to a file on every call,
 * so a channel a page could reach is a way to fill the user's disk from a
 * tab - which is also why it is not exposed in webview-preload at all. Two
 * gates rather than one, because the cheap one can be forgotten.
 */
ipcMain.on('app:reportRendererError', (evt, payload) => {
  if (!ensureUiSender(evt).ok) return;
  try {
    appendRendererError(payload);
  } catch {
    // A logger that throws is worse than a missing line.
  }
});

function configureDisplayMediaForSession(ses, label) {
  if (!ses) return;

  try {
    if (typeof ses.setPermissionRequestHandler === 'function') {
      ses.setPermissionRequestHandler((webContentsRef, permission, callback) => {
        const perm = safeString(permission, 128);
        if (perm === 'display-capture' || perm === 'media' || perm === 'fullscreen') {
          const href = safeString(webContentsRef?.getURL?.(), 4096);
          const siteKey = deriveSiteKeyFromHref(href);
          callback(!!siteKey);
          return;
        }
        callback(false);
      });
    }
  } catch (e) {
    console.warn('[main] display media permission handler failed', {
      label,
      error: String(e?.message || e || 'unknown_error'),
    });
  }

  try {
    if (typeof ses.setDisplayMediaRequestHandler !== 'function') {
      console.warn('[main] display media request handler unavailable', { label });
      return;
    }

    ses.setDisplayMediaRequestHandler(
      async (request, callback) => {
        try {
          const href = safeString(
            request?.frame?.url || request?.securityOrigin || '',
            4096,
          );
          const siteKey = deriveSiteKeyFromHref(href);
          if (!siteKey) {
            callback({});
            return;
          }

          const sources = await desktopCapturer.getSources({
            types: ['window', 'screen'],
            thumbnailSize: { width: 320, height: 180 },
            fetchWindowIcons: true,
          });
          const choices = sources.slice(0, 12);
          let selectedIndex = 0;
          if (choices.length > 1) {
            const win = getMainWindow() || BrowserWindow.getAllWindows()[0] || null;
            const result = await dialog.showMessageBox(win || undefined, {
              type: 'question',
              title: 'Share screen or window',
              message: 'Select a source to share with this Lumen site.',
              detail: safeString(siteKey, 256),
              buttons: choices.map((item, index) => {
                const name = safeString(item?.name, 80) || `Source ${index + 1}`;
                const kind = String(item?.id || '').startsWith('screen:') ? 'Screen' : 'Window';
                return `${kind}: ${name}`;
              }),
              cancelId: choices.length - 1,
              noLink: true,
            });
            selectedIndex = Number.isInteger(result?.response) ? result.response : 0;
          }
          const source = choices[selectedIndex] || choices[0];
          if (!source) {
            callback({});
            return;
          }
          const streams = {
            video: {
              id: String(source.id || ''),
              name: String(source.name || 'Shared screen'),
            },
          };
          if (request?.audioRequested) {
            streams.audio = 'loopback';
          }
          callback(streams);
        } catch (e) {
          console.warn('[main] display media request failed', {
            label,
            error: String(e?.message || e || 'unknown_error'),
          });
          callback({});
        }
      },
      { useSystemPicker: true },
    );
    console.log('[main] display media enabled', { label });
  } catch (e) {
    console.warn('[main] display media handler registration failed', {
      label,
      error: String(e?.message || e || 'unknown_error'),
    });
  }
}

function configureDisplayMedia() {
  configureDisplayMediaForSession(session.fromPartition(LUMEN_SESSION_PARTITION), LUMEN_SESSION_PARTITION);
  configureDisplayMediaForSession(session.defaultSession, 'default');
}

function shouldIgnoreRendererConsoleMessage(contents, sourceId, message) {
  const type = contents && typeof contents.getType === 'function'
      ? String(contents.getType() || 'unknown')
      : 'unknown';
  if (type !== 'webview') return false;

  const source = String(sourceId || '');
  const text = String(message || '');
  if (source !== 'node:electron/js2c/sandbox_bundle') return false;
  return (
    text.includes('Electron Security Warning (Insecure Content-Security-Policy)') ||
    text.includes('Electron Security Warning (Insecure Resources)')
  );
}

function isDevtoolsToggle(input) {
  const key = String(input && input.key ? input.key : '').toUpperCase();
  const f12 = key === 'F12';
  const ctrlOrMeta = !!(input && (input.control || input.meta));
  const ctrlAltI = !!(input && input.control && input.alt) && key === 'I';
  const ctrlShiftI = ctrlOrMeta && !!(input && input.shift) && key === 'I';
  return f12 || ctrlAltI || ctrlShiftI;
}

function isF12Toggle(input) {
  return String(input && input.key ? input.key : '').toUpperCase() === 'F12';
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


ipcMain.handle('devtools:openActive', async (evt) => {
  return openDevToolsForSourceContents(evt?.sender, { toggle: false });
});

// Personal-site <webview> pages (lumen://mysite.lmn) self-register their webContents id here so
// F12 can toggle devtools for them even in packaged builds, without opening devtools access up to
// every webview (extensions, plain IPFS/http content) in production - see the F12-only guard below.
const siteDevtoolsTargetIds = new Set();

function toWebContentsIdNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

ipcMain.on('devtools:registerSiteTarget', (_evt, targetWebContentsId) => {
  const id = toWebContentsIdNumber(targetWebContentsId);
  if (id != null) siteDevtoolsTargetIds.add(id);
});

ipcMain.on('devtools:unregisterSiteTarget', (_evt, targetWebContentsId) => {
  const id = toWebContentsIdNumber(targetWebContentsId);
  if (id != null) siteDevtoolsTargetIds.delete(id);
});

function sanitizeDialogOptions(input = {}) {
  const o = input && typeof input === 'object' ? input : {};
  const title = safeString(o.title, 256) || '';
  const multi = !!o.multi;
  const allowFiles = o.allowFiles !== false;
  const allowDirs = !!o.allowDirs;
  const filtersRaw = Array.isArray(o.filters) ? o.filters : [];
  const filters = filtersRaw
    .map((f) => ({
      name: safeString(f && f.name, 64) || 'Files',
      extensions: Array.isArray(f && f.extensions)
        ? f.extensions
            .map((x) => safeString(x, 16).replace(/^\./, '').toLowerCase())
            .filter(Boolean)
        : []
    }))
    .filter((f) => f.extensions.length > 0)
    .slice(0, 10);
  return { title, multi, allowFiles, allowDirs, filters };
}

function isLinuxDialogEnvironmentSupported() {
  try {
    if (process.platform !== 'linux') return true;
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const hasSessionBus = !!String(process.env.DBUS_SESSION_BUS_ADDRESS || '').trim();
    const hasRuntimeDir = !!String(process.env.XDG_RUNTIME_DIR || '').trim();
    return !isRoot && hasSessionBus && hasRuntimeDir;
  } catch {
    return true;
  }
}

ipcMain.handle('dialog:openFiles', async (evt, options) => {
  try {
    console.log('[electron][ipc] dialog:openFiles requested');
    if (!isLinuxDialogEnvironmentSupported()) {
      console.log('[electron][ipc] dialog:openFiles unsupported_environment');
      return { ok: false, error: 'unsupported_environment' };
    }
    const win = evt && evt.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
    try { win?.focus?.(); } catch {}
    const o = sanitizeDialogOptions(options);
    const properties = ['openFile'];
    if (o.multi) properties.push('multiSelections');
    const useParent = !!win && process.platform !== 'linux';
    const res = useParent
      ? await dialog.showOpenDialog(win, {
          title: o.title || 'Select files',
          properties,
          ...(o.filters.length ? { filters: o.filters } : {})
        })
      : await dialog.showOpenDialog({
          title: o.title || 'Select files',
          properties,
          ...(o.filters.length ? { filters: o.filters } : {})
        });
    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { ok: false, error: 'canceled' };
    }
    const paths = Array.from(
      new Set(res.filePaths.map((p) => String(p || '').trim()).filter(Boolean)),
    );
    return { ok: true, paths };
  } catch (e) {
    console.warn('[electron][ipc] dialog:openFiles failed:', e);
    return { ok: false, error: String(e?.message || e || 'dialog_failed') };
  }
});

ipcMain.handle('dialog:openFolder', async (evt, options) => {
  try {
    console.log('[electron][ipc] dialog:openFolder requested');
    if (!isLinuxDialogEnvironmentSupported()) {
      console.log('[electron][ipc] dialog:openFolder unsupported_environment');
      return { ok: false, error: 'unsupported_environment' };
    }
    const win = evt && evt.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
    try { win?.focus?.(); } catch {}
    const o = sanitizeDialogOptions(options);
    const properties = ['openDirectory'];
    if (o.multi) properties.push('multiSelections');
    const useParent = !!win && process.platform !== 'linux';
    const res = useParent
      ? await dialog.showOpenDialog(win, {
          title: o.title || 'Select folder',
          properties,
        })
      : await dialog.showOpenDialog({
          title: o.title || 'Select folder',
          properties,
        });
    if (res.canceled || !res.filePaths || !res.filePaths.length) {
      return { ok: false, error: 'canceled' };
    }
    const paths = Array.from(
      new Set(res.filePaths.map((p) => String(p || '').trim()).filter(Boolean)),
    );
    return { ok: true, paths };
  } catch (e) {
    console.warn('[electron][ipc] dialog:openFolder failed:', e);
    return { ok: false, error: String(e?.message || e || 'dialog_failed') };
  }
});





ipcMain.handle('clipboard:writeText', async (_evt, text) => {
  try {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('settings:getAll', async () => {
  return { ok: true, settings: getSettings() };
});

ipcMain.handle('settings:set', async (_evt, partial) => {
  const before = getSettings();
  const res = setSettings(partial || {});
  if (res?.ok && res?.settings) {
    const after = res.settings;
    if (before?.securitySessionTimeoutMs !== after?.securitySessionTimeoutMs) {
      try { syncActiveSessionTimeout(after.securitySessionTimeoutMs); } catch {}
    }
    const changed =
      String(before?.ipfsApiBase || '') !== String(after?.ipfsApiBase || '') ||
      String(before?.localGatewayBase || '') !== String(after?.localGatewayBase || '') ||
      String(before?.ipfsConnectivityMode || '') !== String(after?.ipfsConnectivityMode || '');

    // Apply without prompting: restart the embedded IPFS daemon so endpoint/config changes take effect.
    if (changed) {
      try { stopIpfsDaemon(); } catch {}
      setTimeout(() => {
        try { startIpfsDaemon(); } catch {}
      }, 250);
    }
  }
  return res;
});

ipcMain.handle('bootstrapPath:getState', async () => {
  return { ok: true, state: getBootstrapRuntimeState() };
});

ipcMain.handle('bootstrapPath:setCustomUserDataPath', async (_evt, nextPath) => {
  return setCustomUserDataPath(nextPath);
});

ipcMain.handle('bootstrapPath:resetCustomUserDataPath', async () => {
  return resetCustomUserDataPath();
});

// Gateway management IPC handlers
ipcMain.handle('settings:loadGateways', async () => {
  try {
    return loadGateways();
  } catch (e) {
    console.error('[electron][ipc] settings:loadGateways error:', e);
    return [];
  }
});

ipcMain.handle('settings:addGateway', async (_evt, gateway) => {
  try {
    return addGateway(gateway);
  } catch (e) {
    console.error('[electron][ipc] settings:addGateway error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('settings:updateGateway', async (_evt, id, updates) => {
  try {
    return updateGateway(id, updates);
  } catch (e) {
    console.error('[electron][ipc] settings:updateGateway error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('settings:deleteGateway', async (_evt, id) => {
  try {
    return deleteGateway(id);
  } catch (e) {
    console.error('[electron][ipc] settings:deleteGateway error:', e);
    return { ok: false, error: String(e.message) };
  }
});

// Private cloud config IPC handlers
ipcMain.handle('settings:loadPrivateCloudConfig', async () => {
  try {
    return loadPrivateCloudConfig();
  } catch (e) {
    console.error('[electron][ipc] settings:loadPrivateCloudConfig error:', e);
    return {
      enabled: false,
      gatewayIds: [],
      preferPrivate: false,
      fallbackToDAO: true,
      timeout: 5000,
      maxRetries: 3
    };
  }
});

ipcMain.handle('settings:savePrivateCloudConfig', async (_evt, config) => {
  try {
    return savePrivateCloudConfig(config);
  } catch (e) {
    console.error('[electron][ipc] settings:savePrivateCloudConfig error:', e);
    return { ok: false, error: String(e.message) };
  }
});

// Embedded Gateway Server IPC handlers
ipcMain.handle('gatewayServer:start', async (_evt, options) => {
  try {
    return await startGatewayServer(options);
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:start error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('gatewayServer:stop', async () => {
  try {
    return await stopGatewayServer();
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:stop error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('gatewayServer:status', async () => {
  try {
    return getGatewayServerStatus();
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:status error:', e);
    return { running: false, port: null, url: null };
  }
});

ipcMain.handle('gatewayServer:getApiKey', async () => {
  try {
    const apiKey = getStoredApiKey();
    return { ok: true, apiKey };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:getApiKey error:', e);
    return { ok: false, error: String(e.message) };
  }
});

// Gateway metadata IPC handlers
const { saveUserMetadata, getAllUserMetadata } = require('./gateways/server/database.cjs');

ipcMain.handle('gatewayServer:saveMetadata', async (_evt, address, metadata) => {
  try {
    const saved = saveUserMetadata(address, metadata);
    return { ok: true, metadata: saved };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:saveMetadata error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('gatewayServer:getAllMetadata', async () => {
  try {
    const metadata = getAllUserMetadata();
    return { ok: true, metadata };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:getAllMetadata error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.on('window:mode', (_evt, mode) => {
  const win =
    BrowserWindow.getFocusedWindow() ||
    getMainWindow() ||
    getSplashWindow() ||
    BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (mode === 'fullscreen') {
    try { win.setFullScreen(true); } catch {}
  } else if (mode === 'exit-fullscreen') {
    try { win.setFullScreen(false); } catch {}
  } else if (mode === 'startup') {
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

ipcMain.handle('window:open-main', async (event) => {
  const splash = browserWindowForWebContents(event.sender);
  const main = createMainWindow();
  try { main.focus(); } catch {}
  if (splash && splash !== main) {
    try { splash.close(); } catch {}
  }
  return true;
});

app.whenReady().then(async () => {
  if (startupPathConfigFailure) {
    void showStartupPathRecoveryDialog(startupPathConfigFailure).catch((e) => {
      console.error('[electron] startup path recovery failed:', e);
      try { app.quit(); } catch {}
    });
    return;
  }

  try {
    console.log('[electron] userData path set to', app.getPath('userData'));
    console.log('[electron] logs path set to', app.getPath('logs'));
  } catch (e) {
    console.warn('[electron] failed to resolve app paths', e);
  }

  registerLumenSessionPreload();
  registerExtensionNetworkRequestGuard(session.fromPartition(LUMEN_SESSION_PARTITION));
  configureDisplayMedia();

  try {
    await extensionManager.initialize();
    console.log('[electron] extension manager initialized');
  } catch (e) {
    console.warn('[electron] extension manager init failed:', e);
  }

  // Startup health: mark this launch as "in progress". If the previous launch didn't reach success
  // and didn't exit gracefully, it will be counted as a crash.
  try {
    recordLaunchStart().catch(() => {});
  } catch {}

  // Route any window.open / target=_blank (including from <webview>) into our tab system.
  // This prevents Electron from creating a separate "Chromium-like" popup window.
  try {
    app.on('web-contents-created', (_event, contents) => {
      if (!contents) return;

      try {
        contents.on('console-message', (_evt, level, message, line, sourceId) => {
          if (shouldIgnoreRendererConsoleMessage(contents, sourceId, message)) return;
          const type =
            typeof contents.getType === 'function'
              ? String(contents.getType() || 'unknown')
              : 'unknown';
          console.log('[renderer-console]', {
            wcId: contents.id,
            type,
            level,
            line,
            sourceId: String(sourceId || ''),
            message: String(message || '')
          });
        });
      } catch {}

      try {
        contents.on('render-process-gone', (_evt2, details) => {
          const type =
            typeof contents.getType === 'function'
              ? String(contents.getType() || 'unknown')
              : 'unknown';
          console.error('[renderer-process-gone]', {
            wcId: contents.id,
            type,
            details: details || null
          });
        });
      } catch {}

      try {
        contents.on('did-fail-load', (_evt2, errorCode, errorDescription, validatedURL, isMainFrame) => {
          console.warn('[renderer-did-fail-load]', {
            wcId: contents.id,
            errorCode,
            errorDescription: String(errorDescription || ''),
            validatedURL: String(validatedURL || ''),
            isMainFrame: !!isMainFrame
          });
        });
      } catch {}

      try {
        contents.on('enter-html-full-screen', () => {
          const owner = browserWindowForWebContents(contents);
          if (owner && !owner.isDestroyed?.()) owner.setFullScreen(true);
        });
        contents.on('leave-html-full-screen', () => {
          const owner = browserWindowForWebContents(contents);
          if (owner && !owner.isDestroyed?.()) owner.setFullScreen(false);
        });
      } catch {}

      const forwardToTabs = (url) => {
        try {
          const s = String(url || '').trim();
          if (!s) return;
          if (!/^(https?:\/\/|file:\/\/)/i.test(s) && !/^lumen:\/\//i.test(s)) return;
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
  // Stable per-domain origins for site storage - see sites/protocol.cjs.
  installSiteProtocol(session.fromPartition(LUMEN_SESSION_PARTITION));
  startIpfsSeedBootstrapper();
  void prefetchPublicIpfsGateways().catch(() => {});

  // CDN-style rolling cache for IPFS resources loaded by the browser.
  try {
    const sessions = [
      session.defaultSession,
      session.fromPartition('persist:lumen')
    ].filter(Boolean);
    startIpfsCache({ sessions });
  } catch (e) {
    console.warn('[electron][ipfs-cache] failed to start', String(e?.message || e));
  }

  createSplashWindow();
  startDaemons();

  const allowDevtools = !app.isPackaged || String(process.env.DEBUG_LUMEN_ELECTRON || '') === '1';

  // Always attached (even in packaged builds): lets registered personal-site pages
  // (lumen://mysite.lmn, see devtools:registerSiteTarget) use F12 like Chrome's own
  // devtools shortcut, without exposing devtools on arbitrary web/extension content in prod.
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
      if (!allowDevtools && isF12Toggle(input) && siteDevtoolsTargetIds.has(contents.id)) {
        event.preventDefault();
        openDevToolsForSourceContents(contents, { toggle: true });
      }
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    try { stopDaemons(); } catch {}
    try { stopIpfsDaemon(); } catch {}
    app.quit();
  }
});

app.on('before-quit', () => {
  // Also here, not only in window-all-closed: on macOS a quit does not go
  // through that handler, and stopDaemons is idempotent.
  try { stopDaemons(); } catch {}
  try {
    markGracefulExit().catch(() => {});
  } catch {}
});
