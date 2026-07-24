const { app, BrowserWindow, ipcMain, session, dialog, webContents, desktopCapturer, clipboard } = require('electron');
const path = require('path');
const {
  APP_NAME,
  getBootstrapRuntimeState,
  resolveStartupUserDataPath,
  resetCustomUserDataPath,
  setCustomUserDataPath,
} = require('./bootstrap_paths.cjs');
const { initializeMainLogger } = require('./services/main_logger.cjs');

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
    ((typeof process.getuid === 'function' && process.getuid() === 0) ||
      !String(process.env.DBUS_SESSION_BUS_ADDRESS || '').trim() ||
      !String(process.env.XDG_RUNTIME_DIR || '').trim())
  ) {
    process.env.GTK_USE_PORTAL = '0';
    console.log('[electron] GTK_USE_PORTAL=0 (no-session)');
  }
} catch {}

const { startIpfsDaemon, checkIpfsStatus, stopIpfsDaemon, prefetchPublicIpfsGateways, ipfsCidToBase32, ipfsAdd, ipfsAddWithProgress, ipfsAddPath, ipfsAddPathWithProgress, ipfsAddDirectory, ipfsAddDirectoryWithProgress, ipfsAddDirectoryPaths, ipfsAddDirectoryPathsWithProgress, ipfsAddDirectoryFromPath, ipfsAddDirectoryFromPathWithProgress, ipfsGet, ipfsLs, ipfsPinList, ipfsPinAdd, startManagedPinJob, pauseManagedPinJob, resumeManagedPinJob, cancelManagedPinJob, waitForManagedPinJob, getPinJob, listPinJobs, addPinJobListener, ipfsUnpin, ipfsStats, ipfsPublishToIPNS, ipfsResolveIPNS, ipfsKeyList, ipfsKeyGen, ipfsKeyRename, ipfsKeyImportFromPath, ipfsKeyExportToPath, ipfsKeyRm, ipfsSwarmPeers, ipfsPropagateCidToPublicGateways } = require('./ipfs.cjs');
const { startIpfsCache, invalidateIpnsCache } = require('./ipfs_cache.cjs');
const { startIpfsSeedBootstrapper } = require('./ipfs_seed.cjs');
const { getSettings, setSettings, loadGateways, saveGateways, addGateway, updateGateway, deleteGateway, loadPrivateCloudConfig, savePrivateCloudConfig } = require('./settings.cjs');
const { startGatewayServer, stopGatewayServer, getGatewayServerStatus, getStoredApiKey } = require('./gateway-server.cjs');
const { registerHttpIpc, registerExtensionNetworkRequestGuard } = require('./ipc/http.cjs');
const { createSplashWindow, createMainWindow, getMainWindow, getSplashWindow } = require('./windows.cjs');
const { registerChainIpc, startChainPoller, stopChainPoller } = require('./ipc/chain.cjs');
const { registerNetworkIpc } = require('./ipc/network.cjs');
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
const { isAllowed: isLumenSiteAllowed, setAllowed: setLumenSiteAllowed } = require('./lumen_site_permissions.cjs');
const { startReleaseWatcher, stopReleaseWatcher } = require('./services/release_watcher.cjs');
const { recordLaunchStart, markGracefulExit } = require('./services/startup_health.cjs');

registerChainIpc();
registerProfilesIpc();
registerHttpIpc();
registerNetworkIpc();
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

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

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
const LUMEN_SESSION_SW_PRELOAD_ID = 'lumen-extension-service-worker-preload';

function describeSessionPartition(ses) {
  try {
    if (!ses) return 'missing';
    if (ses === session.defaultSession) return 'default';
    if (ses === session.fromPartition(LUMEN_SESSION_PARTITION)) return LUMEN_SESSION_PARTITION;
    if (typeof ses.getStoragePath === 'function') {
      const storagePath = safeString(ses.getStoragePath(), 4096);
      if (storagePath) return storagePath;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function listSessionPreloadScripts(ses) {
  try {
    const scripts =
      ses && typeof ses.getPreloadScripts === 'function' ? ses.getPreloadScripts() : [];
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
      filePath: path.join(__dirname, 'webview-preload.cjs'),
    },
  ];

  try {
    if (typeof ses.unregisterPreloadScript === 'function') {
      for (const script of listSessionPreloadScripts(ses)) {
        if (script.id === LUMEN_SESSION_PRELOAD_ID || script.id === LUMEN_SESSION_SW_PRELOAD_ID) {
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
    console.warn('[main] failed to register session preload', {
      partition: LUMEN_SESSION_PARTITION,
      preloadPath,
      error: String(e && e.message ? e.message : e || 'unknown_error'),
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveSiteKeyFromHref(href) {
  try {
    const u = new URL(String(href || ''));
    const p = String(u.pathname || '/');
    const host = String(u.hostname || '').trim();

    // Subdomain gateway: http://<id>.ipfs.localhost:8080/...
    if (host) {
      const h = host.toLowerCase();
      const mSub = h.match(/^([a-z0-9]+)\.(ipfs|ipns)\./i);
      if (mSub && mSub[1] && mSub[2]) {
        const id = String(mSub[1] || '').trim();
        const kind = String(mSub[2] || '').trim().toLowerCase();
        if (id && (kind === 'ipfs' || kind === 'ipns')) return `${kind}:${id}`;
      }
    }

    let m = p.match(/^\/ipfs\/([^/]+)(\/.*)?$/i);
    if (m && m[1]) return `ipfs:${m[1]}`;
    m = p.match(/^\/ipns\/([^/]+)(\/.*)?$/i);
    if (m && m[1]) return `ipns:${m[1]}`;
    return null;
  } catch {
    return null;
  }
}

function senderSiteContext(evt) {
  const sender = evt && evt.sender ? evt.sender : null;
  if (!sender || sender.isDestroyed()) return { ok: false, error: 'sender_missing' };

  try {
    if (typeof sender.getType === 'function') {
      const t = String(sender.getType() || '').toLowerCase();
      if (t && t !== 'webview') return { ok: false, error: 'not_webview' };
    }
  } catch {
    // ignore
  }

  const href = safeString(typeof sender.getURL === 'function' ? sender.getURL() : '', 4096);
  const siteKey = deriveSiteKeyFromHref(href);
  if (!siteKey) return { ok: false, error: 'unsupported_origin' };

  return { ok: true, sender, href, siteKey };
}

function isSenderSiteContextStillValid(ctx) {
  try {
    const sender = ctx && ctx.sender ? ctx.sender : null;
    if (!sender || sender.isDestroyed()) return false;
    const hrefNow = safeString(typeof sender.getURL === 'function' ? sender.getURL() : '', 4096);
    const siteKeyNow = deriveSiteKeyFromHref(hrefNow);
    return !!(siteKeyNow && siteKeyNow === ctx.siteKey);
  } catch {
    return false;
  }
}

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

function getUiWebContents() {
  const win = getMainWindow() || BrowserWindow.getAllWindows()[0] || null;
  const wc = win && win.webContents ? win.webContents : null;
  if (!wc || wc.isDestroyed()) return null;
  return wc;
}

let uiSeq = 0;
const pendingUi = new Map(); // id -> { resolve, timeout }
const UI_REQUEST_TIMEOUT_MS = 60_000;
const UI_INTERACTIVE_TIMEOUT_MS = 10 * 60_000;

ipcMain.on('lumenSite:uiResponse', (_evt, payload) => {
  const id = safeString(payload && payload.id ? payload.id : '', 128);
  if (!id) return;
  const pending = pendingUi.get(id);
  if (!pending) return;
  pendingUi.delete(id);
  try {
    if (pending.timeout) clearTimeout(pending.timeout);
  } catch {}
  try {
    pending.resolve(payload && Object.prototype.hasOwnProperty.call(payload, 'response') ? payload.response : null);
  } catch {}
});

function requestUi(type, data, options = {}) {
  const wc = getUiWebContents();
  if (!wc) return Promise.resolve({ ok: false, error: 'ui_unavailable' });

  uiSeq += 1;
  const id = `lumenSite-${Date.now().toString(36)}-${uiSeq.toString(36)}`;
  const payload = { id, type: safeString(type, 64), data: data ?? null };
  const timeoutMsRaw = Number(options && Object.prototype.hasOwnProperty.call(options, 'timeoutMs') ? options.timeoutMs : UI_REQUEST_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? Math.floor(timeoutMsRaw) : 0;

  return new Promise((resolve) => {
    const timeout = timeoutMs
      ? setTimeout(() => {
          pendingUi.delete(id);
          resolve({ ok: false, error: 'ui_timeout' });
        }, timeoutMs)
      : null;
    pendingUi.set(id, { resolve, timeout });
    try {
      wc.send('lumenSite:uiRequest', payload);
    } catch {
      pendingUi.delete(id);
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, error: 'ui_send_failed' });
    }
  });
}

let uiChain = Promise.resolve();
function enqueueUi(fn) {
  const run = uiChain.then(fn, fn);
  uiChain = run.catch(() => {});
  return run;
}

const siteLastModalAt = new Map(); // siteKey -> nextAllowedAt (ms)
const siteInFlight = new Map(); // siteKey -> count
let uiTabsStateReady = false;
const uiOpenTabIds = new Set(); // tabId -> true

function isUiTabOpen(tabId) {
  const id = safeString(tabId, 256);
  if (!id) return false;
  if (!uiTabsStateReady) return true;
  return uiOpenTabIds.has(id);
}

function tryBeginSiteAction(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return { ok: false, error: 'missing_siteKey' };
  const cur = siteInFlight.get(key) || 0;
  if (cur >= 1) return { ok: false, error: 'busy' };
  siteInFlight.set(key, cur + 1);
  return { ok: true, key };
}

function endSiteAction(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const cur = (siteInFlight.get(key) || 0) - 1;
  if (cur <= 0) siteInFlight.delete(key);
  else siteInFlight.set(key, cur);
}

async function enforceSiteModalDelay(siteKey) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const now = Date.now();
  const nextAllowedAt = siteLastModalAt.get(key) || 0;
  const waitMs = nextAllowedAt - now;
  if (waitMs > 0) await sleep(waitMs);
}

function markSiteModalCooldown(siteKey, ms = 3000) {
  const key = safeString(siteKey, 256);
  if (!key) return;
  const cooldownMs = typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 3000;
  siteLastModalAt.set(key, Date.now() + cooldownMs);
}

function shouldIgnoreRendererConsoleMessage(contents, sourceId, message) {
  const type =
    contents && typeof contents.getType === 'function'
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

ipcMain.on('tabs:state', (evt, tabIds) => {
  const okUi = ensureUiSender(evt);
  if (!okUi.ok) return;
  uiTabsStateReady = true;
  uiOpenTabIds.clear();
  const ids = Array.isArray(tabIds) ? tabIds : [];
  for (const id of ids) {
    const key = safeString(id, 256);
    if (key) uiOpenTabIds.add(key);
  }
});

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

function isChromeExtensionUrl(rawUrl) {
  return /^chrome-extension:\/\//i.test(safeString(rawUrl, 4096));
}

function isChromeExtensionWebviewContents(contents) {
  if (!contents || contents.isDestroyed?.()) return false;
  try {
    const type = typeof contents.getType === 'function' ? String(contents.getType() || '') : '';
    if (type.toLowerCase() !== 'webview') return false;
  } catch {
    return false;
  }
  try {
    return isChromeExtensionUrl(contents.getURL?.());
  } catch {
    return false;
  }
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

ipcMain.handle('ipfs:status', async () => {
  console.log('[electron][ipc] ipfs:status requested');
  return checkIpfsStatus();
});

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

const ACTIVE_IPFS_ADDS = new Map(); // wcId -> { abort: () => void }
const ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS = new Map(); // wcId -> { abort: () => void }

ipcMain.handle('ipfs:cancelAdd', async (evt, payload) => {
  console.log('[electron][ipc] ipfs:cancelAdd');
  const wcId = String(payload?.uploadId || '');
  console.log('Cancel request for wcId:', wcId);
  const job = ACTIVE_IPFS_ADDS.get(wcId);
  if (!job) return { ok: false, error: 'no_active_job' };
  try {
    job.abort?.();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || 'cancel_failed') };
  }
});

ipcMain.handle('ipfs:cancelPublicGatewayPropagation', async (evt) => {
  const wcId = String(evt?.sender?.id || evt.uploadId || '');
  const job = wcId ? ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.get(wcId) : null;
  if (!job) return { ok: false, error: 'no_active_job' };
  try {
    job.abort?.();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || 'cancel_failed') };
  }
});

ipcMain.handle('ipfs:add', async (_evt, data, filename) => {
  console.log('[electron][ipc] ipfs:add requested:', filename);
  return ipfsAdd(data, filename);
});

ipcMain.handle('ipfs:propagateCidToPublicGateways', async (evt, input) => {
  const wcId = String(evt?.sender?.id || '');
  if (wcId && ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.has(wcId)) {
    return { ok: false, error: 'propagation_in_progress' };
  }

  const controller = new AbortController();
  const abort = () => {
    try {
      controller.abort();
    } catch {}
  };
  if (wcId) ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.set(wcId, { abort });

  const sendProgress = (payload) => {
    try {
      evt?.sender?.send?.('ipfs:publicGatewayPropagationProgress', payload || {});
    } catch {}
  };

  try {
    return await ipfsPropagateCidToPublicGateways(input || {}, {
      signal: controller.signal,
      onProgress: sendProgress,
    });
  } finally {
    if (wcId) ACTIVE_PUBLIC_GATEWAY_PROPAGATIONS.delete(wcId);
  }
});

ipcMain.handle('ipfs:addWithProgress', async (evt, data, filename) => {
  const wcId = String(evt?.sender?.id || '');
  if (wcId && ACTIVE_IPFS_ADDS.has(wcId)) return { ok: false, error: 'add_in_progress' };

  const controller = new AbortController();
  const abort = () => {
    try { controller.abort(); } catch {}
  };
  if (wcId) ACTIVE_IPFS_ADDS.set(wcId, { abort });

  const safeName = safeString(filename, 256);
  const sendProgress = (payload) => {
    try {
      evt?.sender?.send?.('ipfs:addProgress', {
        ...payload,
        rootPath: payload?.rootPath || '',
        rootName: rootName || '',
      });
    } catch {}
  };

  try {
    return await ipfsAddWithProgress(data, filename, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (wcId) ACTIVE_IPFS_ADDS.delete(wcId);
  }
});

ipcMain.handle('ipfs:addPath', async (_evt, filePath, filename) => {
  console.log('[electron][ipc] ipfs:addPath requested:', filename);
  return ipfsAddPath(filePath, filename);
});

ipcMain.handle('ipfs:addPathWithProgress', async (evt, payload, filename) => {
  const uploadId = String(payload?.uploadId || '');
  if (uploadId && ACTIVE_IPFS_ADDS.has(uploadId)) return { ok: false, error: 'add_in_progress' };

  const controller = new AbortController();
  const abort = () => {
    try { controller.abort(); } catch {}
  };
  if (uploadId) ACTIVE_IPFS_ADDS.set(uploadId, { abort });

  const safeName = safeString(filename, 256);
  const sendProgress = (payload2) => {
    try {
      evt?.sender?.send?.('ipfs:addProgress', {
        ...payload2,
        rootPath: payload2?.path || '',
        rootName: payload2?.filename || '',
        key: payload?.filePath || '',
      });
    } catch (e) {
      console.error('SEND PROGRESS ERROR', e);
    }
  };
  try {
    return await ipfsAddPathWithProgress(payload.filePath, payload.filename, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (uploadId) ACTIVE_IPFS_ADDS.delete(uploadId);
  }
});



ipcMain.handle('ipfs:addDirectory', async (_evt, payload) => {
  console.log('[electron][ipc] ipfs:addDirectory requested');
  return ipfsAddDirectory(payload);
});

ipcMain.handle('ipfs:addDirectoryWithProgress', async (evt, payload) => {
  const wcId = String(evt?.sender?.id || '');
  if (wcId && ACTIVE_IPFS_ADDS.has(wcId)) return { ok: false, error: 'add_in_progress' };

  const controller = new AbortController();
  const abort = () => {
    try { controller.abort(); } catch {}
  };
  if (wcId) ACTIVE_IPFS_ADDS.set(wcId, { abort });

  const rootName = safeString(payload?.rootName ?? '', 256);
  const sendProgress = (payload2) => {
    try {
      evt?.sender?.send?.('ipfs:addProgress', {
        ...payload2,
        rootPath: payload?.rootPath || '',
        rootName: rootName || '',
      });
    } catch {}
  };

  try {
    return await ipfsAddDirectoryWithProgress(payload, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (wcId) ACTIVE_IPFS_ADDS.delete(wcId);
  }
});

ipcMain.handle('ipfs:addDirectoryPaths', async (_evt, payload) => {
  console.log('[electron][ipc] ipfs:addDirectoryPaths requested');
  return ipfsAddDirectoryPaths(payload);
});

ipcMain.handle('ipfs:addDirectoryPathsWithProgress', async (evt, payload) => {
  const wcId = String(evt?.sender?.id || '');
  if (wcId && ACTIVE_IPFS_ADDS.has(wcId)) return { ok: false, error: 'add_in_progress' };

  const controller = new AbortController();
  const abort = () => {
    try { controller.abort(); } catch {}
  };
  if (wcId) ACTIVE_IPFS_ADDS.set(wcId, { abort });

  const rootName = safeString(payload?.rootName ?? '', 256);
  const sendProgress = (payload2) => {
    try {
      evt?.sender?.send?.('ipfs:addProgress', {
        ...payload2,
        rootPath: payload?.rootPath || '',
        rootName: rootName || '',
      });
    } catch {}
  };

  try {
    return await ipfsAddDirectoryPathsWithProgress(payload, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (wcId) ACTIVE_IPFS_ADDS.delete(wcId);
  }
});

ipcMain.handle('ipfs:addDirectoryFromPath', async (_evt, payload) => {
  console.log('[electron][ipc] ipfs:addDirectoryFromPath requested');
  return ipfsAddDirectoryFromPath(payload);
});



ipcMain.handle('ipfs:addDirectoryFromPathWithProgress', async (evt, payload) => {
    const uploadId = payload.uploadId;
  if (uploadId && ACTIVE_IPFS_ADDS.has(uploadId)) return { ok: false, error: 'add_in_progress' };

  const controller = new AbortController();
  const abort = () => {
    try { controller.abort(); } catch {}
  };
  if (uploadId) ACTIVE_IPFS_ADDS.set(uploadId, { abort });
  const rootName = safeString(payload?.rootName ?? '', 256);
  const key = path.resolve(payload?.rootPath || '');
  const sendProgress = (payload2) => {
    try {
      evt?.sender?.send?.('ipfs:addProgress', {
        ...payload2,
        key
      });
    } catch {}
  };

  try {
    return await ipfsAddDirectoryFromPathWithProgress(payload, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (uploadId) ACTIVE_IPFS_ADDS.delete(uploadId);
  }
});

ipcMain.handle('ipfs:cidToBase32', async (_evt, cid) => {
  try {
    const out = ipfsCidToBase32(cid);
    return { ok: true, cid: out || '' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || 'cid_format_failed') };
  }
});

ipcMain.handle('ipfs:get', async (_evt, cid, options) => {
  console.log('[electron][ipc] ipfs:get requested:', cid);
  return ipfsGet(cid, options || {});
});

ipcMain.handle('ipfs:ls', async (_evt, cidOrPath) => {
  console.log('[electron][ipc] ipfs:ls requested:', cidOrPath);
  return ipfsLs(cidOrPath);
});

ipcMain.handle('ipfs:pinList', async () => {
  return ipfsPinList();
});

ipcMain.handle('ipfs:pinStart', async (_evt, input) => {
  console.log('[electron][ipc] ipfs:pinStart requested:', input);
  return startManagedPinJob(input || {});
});

ipcMain.handle('ipfs:pinPause', async (_evt, jobId) => {
  return pauseManagedPinJob(jobId);
});

ipcMain.handle('ipfs:pinResume', async (_evt, jobId) => {
  return resumeManagedPinJob(jobId);
});

ipcMain.handle('ipfs:pinCancel', async (_evt, jobId) => {
  return cancelManagedPinJob(jobId);
});

ipcMain.handle('ipfs:pinWait', async (_evt, jobId, options) => {
  const timeoutMs = Number(options?.timeoutMs || 0) || 0;
  return waitForManagedPinJob(jobId, timeoutMs);
});

ipcMain.handle('ipfs:pinGet', async (_evt, jobId) => {
  const job = getPinJob(jobId);
  return job ? { ok: true, job } : { ok: false, error: 'pin_job_not_found' };
});

ipcMain.handle('ipfs:pinJobs', async () => {
  return { ok: true, jobs: listPinJobs() };
});

ipcMain.handle('ipfs:pinAdd', async (_evt, cidOrPath) => {
  console.log('[electron][ipc] ipfs:pinAdd requested:', cidOrPath);
  const started = await startManagedPinJob({ cidOrPath });
  if (!started?.ok || !started?.job?.id) return started || { ok: false, error: 'pin_start_failed' };
  const waited = await waitForManagedPinJob(started.job.id);
  if (!waited?.ok) {
    return {
      ok: false,
      cancelled: !!waited?.cancelled,
      error: String(waited?.error || 'pin_failed'),
      job: waited?.job || started.job
    };
  }
  const job = waited.job || started.job;
  const pins = job?.pinnedCid ? [String(job.pinnedCid)] : [];
  return {
    ok: true,
    pins,
    pinnedCid: String(job?.pinnedCid || pins[0] || '').trim(),
    job
  };
});

ipcMain.handle('ipfs:unpin', async (_evt, cid) => {
  console.log('[electron][ipc] ipfs:unpin requested:', cid);
  return ipfsUnpin(cid);
});

ipcMain.handle('ipfs:stats', async () => {
  return ipfsStats();
});

ipcMain.handle('ipfs:publishToIPNS', async (_evt, cid, key, options) => {
  console.log('[electron][ipc] ipfs:publishToIPNS requested:', cid, 'key:', key);
  const timeoutMs = Number(options && options.timeoutMs);
  const res = await ipfsPublishToIPNS(cid, key, {
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 60000,
  });
  if (res?.ok) {
    try {
      invalidateIpnsCache(res.name);
      invalidateIpnsCache(key);
    } catch {}
  }
  return res;
});

ipcMain.handle('ipfs:resolveIPNS', async (_evt, name) => {
  console.log('[electron][ipc] ipfs:resolveIPNS requested:', name);
  return ipfsResolveIPNS(name);
});

ipcMain.handle('ipfs:keyList', async () => {
  console.log('[electron][ipc] ipfs:keyList requested');
  return ipfsKeyList();
});

ipcMain.handle('ipfs:keyGen', async (_evt, name) => {
  console.log('[electron][ipc] ipfs:keyGen requested:', name);
  return ipfsKeyGen(name);
});

ipcMain.handle('ipfs:keyRename', async (_evt, oldName, newName) => {
  console.log('[electron][ipc] ipfs:keyRename requested:', oldName, '->', newName);
  return ipfsKeyRename(oldName, newName);
});

ipcMain.handle('ipfs:keyImport', async (_evt, name) => {
  const keyName = String(name || '').trim();
  if (!keyName) return { ok: false, error: 'missing_key_name' };
  const win = getMainWindow();
  const selected = win
    ? await dialog.showOpenDialog(win, {
        title: 'Import stable link key',
        properties: ['openFile'],
        filters: [
          { name: 'Private key files', extensions: ['key', 'pem', 'txt'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
    : await dialog.showOpenDialog({
        title: 'Import stable link key',
        properties: ['openFile'],
        filters: [
          { name: 'Private key files', extensions: ['key', 'pem', 'txt'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
  if (selected.canceled || !selected.filePaths?.length) return { ok: false, canceled: true };
  return ipfsKeyImportFromPath(keyName, selected.filePaths[0]);
});

ipcMain.handle('ipfs:keyExport', async (_evt, name) => {
  const keyName = String(name || '').trim();
  if (!keyName) return { ok: false, error: 'missing_key_name' };
  const safeName = keyName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'stable-link';
  const win = getMainWindow();
  const selected = win
    ? await dialog.showSaveDialog(win, {
        title: 'Export stable link key',
        defaultPath: `${safeName}.pem`,
        filters: [
          { name: 'PEM private key', extensions: ['pem'] },
          { name: 'All files', extensions: ['*'] },
        ],
      })
    : await dialog.showSaveDialog({
        title: 'Export stable link key',
        defaultPath: `${safeName}.pem`,
        filters: [
          { name: 'PEM private key', extensions: ['pem'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
  if (selected.canceled || !selected.filePath) return { ok: false, canceled: true };
  return ipfsKeyExportToPath(keyName, selected.filePath);
});

ipcMain.handle('ipfs:keyRm', async (_evt, name) => {
  return ipfsKeyRm(name);
});

ipcMain.handle('clipboard:writeText', async (_evt, text) => {
  try {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('ipfs:swarmPeers', async () => {
  return ipfsSwarmPeers();
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

ipcMain.handle('settings:saveGateways', async (_evt, gateways) => {
  try {
    return saveGateways(gateways);
  } catch (e) {
    console.error('[electron][ipc] settings:saveGateways error:', e);
    return { ok: false, error: String(e.message) };
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
const { saveUserMetadata, getUserMetadata, getAllUserMetadata, deleteUserMetadata } = require('./gateway-database.cjs');

ipcMain.handle('gatewayServer:saveMetadata', async (_evt, address, metadata) => {
  try {
    const saved = saveUserMetadata(address, metadata);
    return { ok: true, metadata: saved };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:saveMetadata error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('gatewayServer:getMetadata', async (_evt, address) => {
  try {
    const metadata = getUserMetadata(address);
    return { ok: true, metadata };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:getMetadata error:', e);
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

ipcMain.handle('gatewayServer:deleteMetadata', async (_evt, address) => {
  try {
    const deleted = deleteUserMetadata(address);
    return { ok: true, deleted };
  } catch (e) {
    console.error('[electron][ipc] gatewayServer:deleteMetadata error:', e);
    return { ok: false, error: String(e.message) };
  }
});

ipcMain.handle('lumenSite:getLocalGatewayBase', async () => {
  const s = getSettings();
  return safeString(s && s.localGatewayBase ? s.localGatewayBase : '', 1024);
});

ipcMain.handle('lumenSite:setFullscreen', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const active = !!(input && input.active);
  const win = browserWindowForWebContents(evt.sender);
  if (!win || win.isDestroyed?.()) return { ok: false, error: 'window_unavailable' };
  try {
    win.setFullScreen(active);
    return {
      ok: true,
      active: typeof win.isFullScreen === 'function' ? !!win.isFullScreen() : active
    };
  } catch (e) {
    return { ok: false, error: safeString(e?.message || e || 'window_fullscreen_failed', 512) };
  }
});

async function ensureLumenSitePermission(siteKey, meta, actionKind, actionDetails) {
  const key = safeString(siteKey, 256);
  if (!key) return { ok: false, error: 'missing_siteKey' };
  if (isLumenSiteAllowed(key)) return { ok: true, decision: 'always' };

  const res = await requestUi('permission', {
    siteKey: key,
    meta: meta ?? null,
    actionKind: safeString(actionKind, 64),
    actionDetails: actionDetails ?? null
  }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });

  if (!res || res.ok === false) return res || { ok: false, error: 'permission_prompt_failed' };

  const decision = safeString(res.decision || '', 16).toLowerCase();
  if (decision === 'always') {
    setLumenSiteAllowed(key, true);
    return { ok: true, decision: 'always' };
  }
  if (decision === 'once') return { ok: true, decision: 'once' };
  return { ok: false, error: 'user_denied' };
}

ipcMain.handle('lumenSite:sendToken', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const to = safeString(input && input.to ? input.to : '', 256);
  const memo = safeString(input && input.memo ? input.memo : '', 1024);
  const amountLmn =
    typeof (input && input.amountLmn) === 'number' && Number.isFinite(input.amountLmn)
      ? input.amountLmn
      : null;

  const meta = {
    href: ctx.href,
    title: safeString(input && input.title ? input.title : '', 256)
  };

  const lock = tryBeginSiteAction(ctx.siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'SendToken', {
        to,
        memo,
        amountLmn
      });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      await enforceSiteModalDelay(ctx.siteKey);

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const res = await requestUi('sendToken', {
        siteKey: ctx.siteKey,
        meta,
        defaults: { to, memo, amountLmn, denom: 'LMN' }
      });
      markSiteModalCooldown(ctx.siteKey);
      return res || { ok: false, error: 'send_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

ipcMain.handle('lumenSite:pin', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const cidOrUrl = safeString(input && (input.cid || input.url || input.cidOrUrl) ? (input.cid || input.url || input.cidOrUrl) : '', 2048);
  if (!cidOrUrl) return { ok: false, error: 'missing_cid' };
  const name = safeString(input && (input.name || input.filename || input.saveName) ? (input.name || input.filename || input.saveName) : '', 256);

  const meta = {
    href: ctx.href,
    title: safeString(input && input.title ? input.title : '', 256)
  };

  const lock = tryBeginSiteAction(ctx.siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'Save', { cidOrUrl, name });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      await enforceSiteModalDelay(ctx.siteKey);

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const res = await requestUi('pin', {
        siteKey: ctx.siteKey,
        meta,
        cidOrUrl,
        name
      });
      markSiteModalCooldown(ctx.siteKey);
      return res || { ok: false, error: 'pin_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

ipcMain.handle('lumenSite:stableLinkForLive', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const title = safeString(input && input.title ? input.title : '', 256);
  const suggestedName = safeString(input && input.suggestedName ? input.suggestedName : '', 128);
  const records = Array.isArray(input && input.records)
    ? input.records
        .map((record) => ({
          key: safeString(record && record.key ? record.key : '', 128),
          value: safeString(record && record.value ? record.value : '', 4096),
        }))
        .filter((record) => record.key && record.value)
        .slice(0, 16)
    : [];
  if (!records.length) return { ok: false, error: 'missing_records' };

  const meta = { href: ctx.href, title };
  const lock = tryBeginSiteAction(ctx.siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', {
        title,
        suggestedName,
      });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      await enforceSiteModalDelay(ctx.siteKey);

      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };

      const res = await requestUi('stableLink', {
        siteKey: ctx.siteKey,
        meta,
        title,
        suggestedName,
        records,
      }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
      markSiteModalCooldown(ctx.siteKey);
      return res || { ok: false, error: 'stable_link_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

ipcMain.handle('lumenSite:stableLinkSetup', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const title = safeString(input && input.title ? input.title : '', 256);
  const meta = { href: ctx.href, title };
  const lock = tryBeginSiteAction(ctx.siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', { title, mode: 'setup' });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
      await enforceSiteModalDelay(ctx.siteKey);
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
      const res = await requestUi('stableLinkSetup', { siteKey: ctx.siteKey, meta, title }, { timeoutMs: UI_INTERACTIVE_TIMEOUT_MS });
      markSiteModalCooldown(ctx.siteKey);
      return res || { ok: false, error: 'stable_link_setup_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

ipcMain.handle('lumenSite:publishStableLinkForLive', async (evt, input) => {
  const ctx = senderSiteContext(evt);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const title = safeString(input && input.title ? input.title : '', 256);
  const keyName = safeString(input && input.keyName ? input.keyName : '', 256);
  if (!keyName || !keyName.startsWith('stable:')) return { ok: false, error: 'invalid_key_name' };
  const records = Array.isArray(input && input.records)
    ? input.records
        .map((record) => ({
          key: safeString(record && record.key ? record.key : '', 128),
          value: safeString(record && record.value ? record.value : '', 4096),
        }))
        .filter((record) => record.key && record.value)
        .slice(0, 24)
    : [];
  if (!records.length) return { ok: false, error: 'missing_records' };

  const meta = { href: ctx.href, title };
  const lock = tryBeginSiteAction(ctx.siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (!isSenderSiteContextStillValid(ctx)) return { ok: false, error: 'tab_closed' };
      const perm = await ensureLumenSitePermission(ctx.siteKey, meta, 'StableLink', { title, keyName, mode: 'publish' });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      const body = JSON.stringify({
        lumenRecordsVersion: 1,
        type: 'lumen.stable-link.records',
        updatedAt: new Date().toISOString(),
        records,
      }, null, 2);
      const added = await ipfsAdd(Buffer.from(body, 'utf8'), 'stable-live.lumen-records.json');
      if (!added?.ok || !added.cid) return { ok: false, error: added?.error || 'ipfs_add_failed' };
      const published = await ipfsPublishToIPNS(added.cid, keyName, { timeoutMs: 60000 });
      if (!published?.ok) return { ok: false, error: published?.error || 'ipns_publish_failed' };

      const keys = await ipfsKeyList().catch(() => null);
      const list = Array.isArray(keys?.keys) ? keys.keys : [];
      const key = list.find((item) => String(item?.Name || item?.name || '') === keyName);
      const ipnsName = String(key?.Id || key?.id || published.name || '').trim();
      try {
        invalidateIpnsCache(ipnsName);
        invalidateIpnsCache(keyName);
      } catch {}
      const url = ipnsName ? `lumen://ipns/${ipnsName}/` : '';
      if (url) clipboard.writeText(url);
      markSiteModalCooldown(ctx.siteKey);
      return { ok: true, url, keyName, ipnsName, copied: !!url };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

function ensureUiSender(evt) {
  const ui = getUiWebContents();
  if (!ui) return { ok: false, error: 'ui_unavailable' };
  if (!evt || evt.sender !== ui) return { ok: false, error: 'not_ui' };
  return { ok: true };
}

ipcMain.handle('domainSite:sendToken', async (evt, input) => {
  const okUi = ensureUiSender(evt);
  if (!okUi.ok) return okUi;

  const tabId = safeString(input && input.tabId ? input.tabId : '', 256);
  if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

  const host = safeString(input && input.host ? input.host : '', 256);
  if (!host) return { ok: false, error: 'missing_host' };

  const to = safeString(input && input.to ? input.to : '', 256);
  const memo = safeString(input && input.memo ? input.memo : '', 1024);
  const amountLmn =
    typeof (input && input.amountLmn) === 'number' && Number.isFinite(input.amountLmn)
      ? input.amountLmn
      : null;

  const siteKey = `domain:${host}`;
  const meta = {
    href: safeString(input && input.href ? input.href : `lumen://${host}`, 4096),
    title: safeString(input && input.title ? input.title : '', 256)
  };

  const lock = tryBeginSiteAction(siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      const perm = await ensureLumenSitePermission(siteKey, meta, 'SendToken', { to, memo, amountLmn });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      await enforceSiteModalDelay(siteKey);

      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      const res = await requestUi('sendToken', {
        siteKey,
        meta,
        defaults: { to, memo, amountLmn, denom: 'LMN' }
      });
      markSiteModalCooldown(siteKey);
      return res || { ok: false, error: 'send_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
});

ipcMain.handle('domainSite:pin', async (evt, input) => {
  const okUi = ensureUiSender(evt);
  if (!okUi.ok) return okUi;

  const tabId = safeString(input && input.tabId ? input.tabId : '', 256);
  if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

  const host = safeString(input && input.host ? input.host : '', 256);
  if (!host) return { ok: false, error: 'missing_host' };

  const cidOrUrl = safeString(input && (input.cid || input.url || input.cidOrUrl) ? (input.cid || input.url || input.cidOrUrl) : '', 2048);
  if (!cidOrUrl) return { ok: false, error: 'missing_cid' };
  const name = safeString(input && (input.name || input.filename || input.saveName) ? (input.name || input.filename || input.saveName) : '', 256);

  const siteKey = `domain:${host}`;
  const meta = {
    href: safeString(input && input.href ? input.href : `lumen://${host}`, 4096),
    title: safeString(input && input.title ? input.title : '', 256)
  };

  const lock = tryBeginSiteAction(siteKey);
  if (!lock.ok) return lock;

  return enqueueUi(async () => {
    try {
      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      const perm = await ensureLumenSitePermission(siteKey, meta, 'Save', { cidOrUrl, name });
      if (!perm || perm.ok === false) return perm || { ok: false, error: 'user_denied' };

      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      await enforceSiteModalDelay(siteKey);

      if (tabId && !isUiTabOpen(tabId)) return { ok: false, error: 'tab_closed' };

      const res = await requestUi('pin', {
        siteKey,
        meta,
        cidOrUrl,
        name
      });
      markSiteModalCooldown(siteKey);
      return res || { ok: false, error: 'pin_modal_failed' };
    } finally {
      endSiteAction(lock.key);
    }
  });
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
  startChainPoller();
  startReleaseWatcher();

  const allowDevtools = !app.isPackaged || String(process.env.DEBUG_LUMEN_ELECTRON || '') === '1';

  // Always attached (even in packaged builds): lets registered personal-site pages
  // (lumen://mysite.lmn, see devtools:registerSiteTarget) use F12 like Chrome's own
  // devtools shortcut, without exposing devtools on arbitrary web/extension content in prod.
  app.on('web-contents-created', (_event, contents) => {
    contents.once('destroyed', () => siteDevtoolsTargetIds.delete(contents.id));
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
    try { stopChainPoller(); } catch {}
    try { stopReleaseWatcher(); } catch {}
    try { stopIpfsDaemon(); } catch {}
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    markGracefulExit().catch(() => {});
  } catch {}
});
