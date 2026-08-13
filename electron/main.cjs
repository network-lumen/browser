const { safeString } = require('./utils/strings.cjs');
const { app, BrowserWindow, ipcMain, session, dialog, desktopCapturer } = require('electron');
const path = require('path');
const {
  APP_NAME,
  resolveStartupUserDataPath,
  setCustomUserDataPath,
} = require('./bootstrap_paths.cjs');
const { initializeMainLogger } = require('./services/main_logger.cjs');
const { applyAppIdentity } = require('./app_icon.cjs');

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
const { registerSiteSchemePrivileges, installSiteProtocol } = require('./sites/protocol.cjs');

// Has to happen before app 'ready', which is why it sits at module scope.
registerSiteSchemePrivileges();
const { registerExtensionNetworkRequestGuard } = require('./ipc/http.cjs');
const {
  createSplashWindow,
  createMainWindow,
  getMainWindow,
  getSplashWindow,
  browserWindowForWebContents
} = require('./windows.cjs');
const { registerAllIpc } = require('./ipc/index.cjs');
const { attachDevtoolsHotkeys } = require('./ipc/devtools.cjs');
const { extensionManager } = require('./extensions/manager.cjs');
const { startDaemons, stopDaemons } = require('./daemons/index.cjs');
const { recordLaunchStart, markGracefulExit } = require('./services/startup_health.cjs');
const { deriveSiteKeyFromHref } = require('./sites/actions.cjs');

registerAllIpc();


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
 * Fullscreen is not a capability, it is a display mode.
 *
 * It was gated on `deriveSiteKeyFromHref`, which only answers for Lumen content
 * - an ipfs/ipns path or a registered domain. Every ordinary https page
 * therefore had its fullscreen request denied, and because the handler is
 * installed on the default session too, that was every video in the browser,
 * silently doing nothing when you pressed the button. Chromium only asks after
 * a user gesture, and nothing here can be read or captured by granting it.
 */
const ALWAYS_ALLOWED_PERMISSIONS = new Set(['fullscreen']);

/** Capturing a screen or a camera stays with Lumen content, which is what asked for it. */
const SITE_ONLY_PERMISSIONS = new Set(['display-capture', 'media']);

const loggedPermissionDenials = new Set();

function logPermissionDenial(label, permission, href) {
  let origin = '';
  try {
    origin = href ? new URL(href).origin : '';
  } catch {
    origin = '';
  }
  const key = `${label}|${permission}|${origin}`;
  if (loggedPermissionDenials.has(key)) return;
  loggedPermissionDenials.add(key);
  // Once per origin and permission: a denial nobody can see is how the
  // fullscreen bug above went unnoticed for as long as it did.
  console.log('[main] permission denied', { label, permission, origin });
}

function configureDisplayMediaForSession(ses, label) {
  if (!ses) return;

  try {
    if (typeof ses.setPermissionRequestHandler === 'function') {
      ses.setPermissionRequestHandler((webContentsRef, permission, callback) => {
        const perm = safeString(permission, 128);
        if (ALWAYS_ALLOWED_PERMISSIONS.has(perm)) {
          callback(true);
          return;
        }

        const href = safeString(webContentsRef?.getURL?.(), 4096);
        if (SITE_ONLY_PERMISSIONS.has(perm)) {
          const siteKey = deriveSiteKeyFromHref(href);
          if (!siteKey) logPermissionDenial(label, perm, href);
          callback(!!siteKey);
          return;
        }

        logPermissionDenial(label, perm, href);
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

  applyAppIdentity();

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

  attachDevtoolsHotkeys();

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
