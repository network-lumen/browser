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

const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const { startIpfsDaemon, checkIpfsStatus, stopIpfsDaemon, ipfsCidToBase32, ipfsAdd, ipfsAddWithProgress, ipfsAddPath, ipfsAddPathWithProgress, ipfsAddDirectory, ipfsAddDirectoryWithProgress, ipfsAddDirectoryPaths, ipfsAddDirectoryPathsWithProgress, ipfsAddDirectoryFromPath, ipfsAddDirectoryFromPathWithProgress, ipfsGet, ipfsLs, ipfsPinList, ipfsPinAdd, ipfsUnpin, ipfsStats, ipfsPublishToIPNS, ipfsResolveIPNS, ipfsKeyList, ipfsKeyGen, ipfsSwarmPeers } = require('./ipfs.cjs');
const { startIpfsCache } = require('./ipfs_cache.cjs');
const { startIpfsSeedBootstrapper } = require('./ipfs_seed.cjs');
const { getSettings, setSettings, loadGateways, saveGateways, addGateway, updateGateway, deleteGateway, loadPrivateCloudConfig, savePrivateCloudConfig } = require('./settings.cjs');
const { startGatewayServer, stopGatewayServer, getGatewayServerStatus, getStoredApiKey } = require('./gateway-server.cjs');
const { registerHttpIpc } = require('./ipc/http.cjs');
const { createSplashWindow, createMainWindow, getMainWindow, getSplashWindow } = require('./windows.cjs');
const { registerChainIpc, startChainPoller, stopChainPoller } = require('./ipc/chain.cjs');
const { registerNetworkIpc } = require('./ipc/network.cjs');
const { registerReleaseIpc } = require('./ipc/release.cjs');
const { registerProfilesIpc } = require('./ipc/profiles.cjs');
const { registerWalletIpc } = require('./ipc/wallet.cjs');
const { registerGatewayIpc } = require('./ipc/gateway.cjs');
const { registerHandlers: registerAddressBookIpc } = require('./ipc/addressbook.cjs');
const { registerSecurityIpc } = require('./ipc/security.cjs');
const { registerIpfsPubsubIpc } = require('./ipc/ipfs_pubsub.cjs');
const { registerHlsIpc } = require('./ipc/hls.cjs');
const { registerFindIpc } = require('./ipc/find.cjs');
const { registerDriveBackupIpc } = require('./ipc/drive_backup.cjs');
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

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
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

function getUiWebContents() {
  const win = getMainWindow() || BrowserWindow.getAllWindows()[0] || null;
  const wc = win && win.webContents ? win.webContents : null;
  if (!wc || wc.isDestroyed()) return null;
  return wc;
}

let uiSeq = 0;
const pendingUi = new Map(); // id -> { resolve, timeout }

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

function requestUi(type, data) {
  const wc = getUiWebContents();
  if (!wc) return Promise.resolve({ ok: false, error: 'ui_unavailable' });

  uiSeq += 1;
  const id = `lumenSite-${Date.now().toString(36)}-${uiSeq.toString(36)}`;
  const payload = { id, type: safeString(type, 64), data: data ?? null };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingUi.delete(id);
      resolve({ ok: false, error: 'ui_timeout' });
    }, 60_000);
    pendingUi.set(id, { resolve, timeout });
    try {
      wc.send('lumenSite:uiRequest', payload);
    } catch {
      pendingUi.delete(id);
      clearTimeout(timeout);
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
  const mod = (input && (input.control || input.meta)) && input && input.shift && key === 'I';
  return f12 || mod;
}

ipcMain.handle('ipfs:status', async () => {
  console.log('[electron][ipc] ipfs:status requested');
  return checkIpfsStatus();
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

ipcMain.handle('ipfs:cancelAdd', async (evt) => {
  const wcId = String(evt?.sender?.id || '');
  const job = wcId ? ACTIVE_IPFS_ADDS.get(wcId) : null;
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
      evt?.sender?.send?.('ipfs:addProgress', { ...payload, filename: safeName || '' });
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

ipcMain.handle('ipfs:addPathWithProgress', async (evt, filePath, filename) => {
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
      evt?.sender?.send?.('ipfs:addProgress', { ...payload, filename: safeName || '' });
    } catch {}
  };

  try {
    return await ipfsAddPathWithProgress(filePath, filename, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (wcId) ACTIVE_IPFS_ADDS.delete(wcId);
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
      evt?.sender?.send?.('ipfs:addProgress', { ...payload2, rootName: rootName || '' });
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
      evt?.sender?.send?.('ipfs:addProgress', { ...payload2, rootName: rootName || '' });
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
      evt?.sender?.send?.('ipfs:addProgress', { ...payload2, rootName: rootName || '' });
    } catch {}
  };

  try {
    return await ipfsAddDirectoryFromPathWithProgress(payload, { signal: controller.signal, onProgress: sendProgress });
  } finally {
    if (wcId) ACTIVE_IPFS_ADDS.delete(wcId);
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

ipcMain.handle('ipfs:pinAdd', async (_evt, cidOrPath) => {
  console.log('[electron][ipc] ipfs:pinAdd requested:', cidOrPath);
  return ipfsPinAdd(cidOrPath);
});

ipcMain.handle('ipfs:unpin', async (_evt, cid) => {
  console.log('[electron][ipc] ipfs:unpin requested:', cid);
  return ipfsUnpin(cid);
});

ipcMain.handle('ipfs:stats', async () => {
  return ipfsStats();
});

ipcMain.handle('ipfs:publishToIPNS', async (_evt, cid, key) => {
  console.log('[electron][ipc] ipfs:publishToIPNS requested:', cid, 'key:', key);
  return ipfsPublishToIPNS(cid, key);
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
    const changed =
      String(before?.ipfsApiBase || '') !== String(after?.ipfsApiBase || '') ||
      String(before?.localGatewayBase || '') !== String(after?.localGatewayBase || '');

    // Apply without prompting: restart the embedded IPFS daemon so it binds to the new ports.
    if (changed) {
      try { stopIpfsDaemon(); } catch {}
      setTimeout(() => {
        try { startIpfsDaemon(); } catch {}
      }, 250);
    }
  }
  return res;
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

async function ensureLumenSitePermission(siteKey, meta, actionKind, actionDetails) {
  const key = safeString(siteKey, 256);
  if (!key) return { ok: false, error: 'missing_siteKey' };
  if (isLumenSiteAllowed(key)) return { ok: true, decision: 'always' };

  const res = await requestUi('permission', {
    siteKey: key,
    meta: meta ?? null,
    actionKind: safeString(actionKind, 64),
    actionDetails: actionDetails ?? null
  });

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
  if (mode === 'startup') {
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

ipcMain.handle('window:open-main', async () => {
  const main = createMainWindow();
  try { main.focus(); } catch {}
  const current = BrowserWindow.getFocusedWindow();
  if (current && current !== main) {
    try { current.close(); } catch {}
  }
  return true;
});

app.whenReady().then(() => {
  try {
    const appName = 'lumen';
    app.setName(appName);
    app.setPath('userData', path.join(app.getPath('appData'), appName));
    console.log('[electron] userData path set to', app.getPath('userData'));
  } catch (e) {
    console.warn('[electron] failed to set userData path', e);
  }

  // Startup health: mark this launch as "in progress". If the previous launch didn't reach success
  // and didn't exit gracefully, it will be counted as a crash.
  try {
    recordLaunchStart().catch(() => {});
  } catch {}

  // Preload for <webview partition="persist:lumen"> sites (demo websites, IPFS HTML, etc.).
  try {
    const preloadPath = path.join(__dirname, 'webview-preload.cjs');
    const s = session.fromPartition('persist:lumen');
    s.setPreloads([preloadPath]);
    console.log('[electron] webview preload set for persist:lumen:', preloadPath);
  } catch (e) {
    console.warn('[electron] failed to set webview preloads:', e);
  }

  // Route any window.open / target=_blank (including from <webview>) into our tab system.
  // This prevents Electron from creating a separate "Chromium-like" popup window.
  try {
    app.on('web-contents-created', (_event, contents) => {
      if (!contents) return;

      const forwardToTabs = (url) => {
        try {
          const s = String(url || '').trim();
          if (!s) return;
          if (!/^https?:\/\//i.test(s) && !/^lumen:\/\//i.test(s)) return;
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

  if (allowDevtools) {
    app.on('web-contents-created', (_event, contents) => {
      contents.on('before-input-event', (event, input) => {
        if (isDevtoolsToggle(input)) {
          event.preventDefault();
          try { contents.toggleDevTools(); } catch {}
        }
      });
    });
  }

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
