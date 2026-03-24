const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { extensionManager } = require('../extensions/manager.cjs');
const {
  getGrantedPermissions,
  requestOptionalPermissions,
  removeGrantedPermissions
} = require('../extensions/dynamic_permissions.cjs');

let registered = false;
let broadcastAttached = false;
let downloadInterceptorAttached = false;
let downloadInterceptorPending = false;
let extensionStoreWindow = null;
const extensionWindows = new Map();
const EXTENSION_SESSION_PARTITION = 'persist:lumen';
const STORE_SESSION_PARTITION = 'persist:lumen-store';
const attachedDownloadInterceptors = new Set();

function safeString(value, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function broadcastExtensionsChanged(entries) {
  const windows =
    typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
  for (const win of windows) {
    try {
      win?.webContents?.send?.('extensions:changed', Array.isArray(entries) ? entries : []);
    } catch {
      // Ignore per-window failures.
    }
  }
}

function resultFromOperation(result) {
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'extension_operation_failed' };
  }
  return result;
}

function normalizeChromeWebStoreUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return 'https://chromewebstore.google.com/category/extensions';
  return raw;
}

function isChromeWebStoreUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = String(url.hostname || '').trim().toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

function isChromeCrxDownloadUrl(input) {
  return String(input || '').trim().toLowerCase().includes('clients2.google.com/service/update2/crx');
}

function extractChromeWebStoreId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return String(direct[1] || '').toLowerCase();

  try {
    const url = new URL(raw);
    const segments = String(url.pathname || '')
      .split('/')
      .map((segment) => String(segment || '').trim())
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return String(fromPath).toLowerCase();

    const fromSearch =
      String(url.searchParams.get('id') || '').trim() ||
      String(url.searchParams.get('extension_id') || '').trim();
    if (/^[a-p]{32}$/i.test(fromSearch)) return fromSearch.toLowerCase();

    const nested = String(url.searchParams.get('x') || '').trim();
    if (nested) {
      const decoded = decodeURIComponent(nested);
      const nestedMatch = decoded.match(/(?:^|&)id=([a-p]{32})(?:&|$)/i);
      if (nestedMatch) return String(nestedMatch[1] || '').toLowerCase();
    }
  } catch {
    // ignore
  }

  return '';
}

function attachExtensionDownloadInterceptor() {
  if (downloadInterceptorAttached) return;
  if (!app?.isReady?.()) {
    if (!downloadInterceptorPending && typeof app?.once === 'function') {
      downloadInterceptorPending = true;
      app.once('ready', () => {
        downloadInterceptorPending = false;
        attachExtensionDownloadInterceptor();
      });
    }
    return;
  }
  const attachForPartition = (partition) => {
    const key = safeString(partition, 128);
    if (!key || attachedDownloadInterceptors.has(key)) return;
    const ses = session.fromPartition(key);
    if (!ses || typeof ses.on !== 'function') return;

    ses.on('will-download', (event, item, sourceWebContents) => {
      try {
        const downloadUrl = String(item?.getURL?.() || '').trim();
        const sourceUrl = String(sourceWebContents?.getURL?.() || '').trim();
        if (!isChromeCrxDownloadUrl(downloadUrl)) return;
        if (!isChromeWebStoreUrl(sourceUrl)) return;

        const extensionId = extractChromeWebStoreId(downloadUrl) || extractChromeWebStoreId(sourceUrl);
        if (!extensionId) return;

        event.preventDefault();
        const owner =
          (sourceWebContents &&
            ((typeof sourceWebContents.getOwnerBrowserWindow === 'function' &&
              sourceWebContents.getOwnerBrowserWindow()) ||
              BrowserWindow.fromWebContents(sourceWebContents))) ||
          null;

        Promise.resolve(extensionManager.installFromChromeWebStore(extensionId, owner))
          .then((result) => {
            try {
              sourceWebContents?.send?.('extensions:storeInstallResult', resultFromOperation(result));
            } catch {}
          })
          .catch((error) => {
            try {
              sourceWebContents?.send?.('extensions:storeInstallResult', {
                ok: false,
                error: String(error?.message || error || 'chrome_web_store_install_failed')
              });
            } catch {}
          });
      } catch {
        // ignore interception failures
      }
    });

    attachedDownloadInterceptors.add(key);
  };

  attachForPartition(EXTENSION_SESSION_PARTITION);
  attachForPartition(STORE_SESSION_PARTITION);

  downloadInterceptorAttached = true;
  downloadInterceptorPending = false;
}

function normalizeExtensionUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!/^chrome-extension:\/\//i.test(raw)) return '';
  return raw;
}

function encodePathSegment(value) {
  return encodeURIComponent(String(value || '').trim());
}

function buildInternalExtensionTabUrl(entry, targetUrl = '') {
  const id = String(entry?.id || '').trim();
  if (!id) return 'lumen://extensions';

  const params = new URLSearchParams();
  const name = String(entry?.name || '').trim();
  const nextTarget = normalizeExtensionUrl(targetUrl || entry?.launchUrl || '');
  if (name) params.set('name', name);
  if (nextTarget) params.set('url', nextTarget);

  const query = params.toString();
  return query
    ? `lumen://extension/${encodePathSegment(id)}?${query}`
    : `lumen://extension/${encodePathSegment(id)}`;
}

function getExtensionGuestPreloadUrl() {
  return pathToFileURL(path.join(__dirname, '..', 'extension-preload.cjs')).toString();
}

function normalizeShimUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).toString();
  } catch {
    return '';
  }
}

function getUrlOrigin(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.origin && url.origin !== 'null') {
      return `${url.origin}`;
    }
    if (url.protocol && url.host) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {}
  return '';
}

function normalizeExtensionScope(input) {
  const raw = normalizeExtensionUrl(input);
  if (!raw) return '';
  try {
    const origin = getUrlOrigin(raw);
    return origin ? `${origin}/` : '';
  } catch {
    return '';
  }
}

async function warmExtensionServiceWorker(entry, targetUrl) {
  const scope = normalizeExtensionScope(targetUrl);
  if (!scope) return false;

  try {
    const ses = typeof extensionManager?.getSession === 'function' ? extensionManager.getSession() : null;
    const serviceWorkers = ses?.serviceWorkers;
    if (!serviceWorkers || typeof serviceWorkers.startWorkerForScope !== 'function') {
      return false;
    }

    const startPromise = Promise.resolve(serviceWorkers.startWorkerForScope(scope));
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('extension_service_worker_start_timeout')), 8000);
    });

    await Promise.race([startPromise, timeoutPromise]);
    return true;
  } catch (error) {
    try {
      console.warn('[extensions] failed to warm extension service worker', {
        extensionId: String(entry?.id || '').trim(),
        runtimeId: String(entry?.runtimeId || '').trim(),
        targetUrl,
        scope,
        error: String(error?.message || error || 'unknown_error')
      });
    } catch {}
    return false;
  }
}

function resolveManagedExtensionEntry(extensionId) {
  const id = String(extensionId || '').trim();
  if (!id) {
    return { ok: false, error: 'extension_id_missing', entry: null };
  }

  const entry =
    extensionManager.listExtensions().find((item) => String(item?.id || '').trim() === id) || null;
  if (!entry) {
    return { ok: false, error: 'extension_not_found', entry: null };
  }
  if (!entry.enabled) {
    return { ok: false, error: 'extension_disabled', entry };
  }
  return { ok: true, entry };
}

async function prepareExtensionTab(extensionId, overrideUrl) {
  const resolved = resolveManagedExtensionEntry(extensionId);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const currentEntry = resolved.entry;
  const targetUrl =
    normalizeExtensionUrl(overrideUrl) || normalizeExtensionUrl(currentEntry.launchUrl);
  if (!targetUrl) {
    return { ok: false, error: 'extension_launch_url_missing' };
  }

  await warmExtensionServiceWorker(currentEntry, targetUrl);

  return {
    ok: true,
    extension: currentEntry,
    targetUrl,
    tabUrl: buildInternalExtensionTabUrl(currentEntry, targetUrl)
  };
}

async function openExtensionInBrowserTab(sender, extensionId) {
  const prepared = await prepareExtensionTab(extensionId, '');
  if (!prepared?.ok) return prepared;

  try {
    sender?.send?.('tabs:openInNewTab', prepared.tabUrl);
  } catch {}
  return prepared;
}

function closeTrackedExtensionWindow(extensionId) {
  const id = String(extensionId || '').trim();
  if (!id) return;
  const win = extensionWindows.get(id);
  extensionWindows.delete(id);
  if (!win || win.isDestroyed()) return;
  try {
    win.close();
  } catch {}
}

function createExtensionShellWindow(title) {
  const win = new BrowserWindow({
    width: 420,
    height: 760,
    minWidth: 360,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#111111',
    title: title || 'Extension',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: EXTENSION_SESSION_PARTITION,
      webSecurity: true,
      preload: path.join(__dirname, '..', 'extension-preload.cjs')
    }
  });

  try {
    win.setMenu(null);
    win.setMenuBarVisibility(false);
  } catch {}

  try {
    win.webContents.setWindowOpenHandler(({ url }) => {
      const nextUrl = normalizeShimUrl(url);
      if (nextUrl) {
        try {
          const nextWin = createExtensionShellWindow(win.getTitle());
          void nextWin.loadURL(nextUrl).catch(() => {
            try {
              nextWin.close();
            } catch {}
          });
        } catch {}
      }
      return { action: 'deny' };
    });
  } catch {}

  return win;
}

function createOrFocusExtensionStoreWindow(targetUrl) {
  const nextUrl = normalizeChromeWebStoreUrl(targetUrl);
  if (extensionStoreWindow && !extensionStoreWindow.isDestroyed()) {
    try {
      extensionStoreWindow.loadURL(nextUrl);
    } catch {}
    try {
      extensionStoreWindow.show();
      extensionStoreWindow.focus();
    } catch {}
    return extensionStoreWindow;
  }

  extensionStoreWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Chrome Web Store',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: STORE_SESSION_PARTITION,
      webSecurity: true,
      preload: path.join(__dirname, '..', 'store-preload.cjs')
    }
  });

  try {
    extensionStoreWindow.setMenu(null);
    extensionStoreWindow.setMenuBarVisibility(false);
  } catch {}

  try {
    extensionStoreWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        extensionStoreWindow.loadURL(normalizeChromeWebStoreUrl(url));
      } catch {}
      return { action: 'deny' };
    });
  } catch {}

  extensionStoreWindow.on('closed', () => {
    extensionStoreWindow = null;
  });

  void extensionStoreWindow.loadURL(nextUrl).catch(() => {});
  return extensionStoreWindow;
}

async function createOrFocusExtensionWindow(extensionId) {
  const id = String(extensionId || '').trim();
  if (!id) {
    return { ok: false, error: 'extension_id_missing' };
  }

  const currentEntry =
    extensionManager.listExtensions().find((entry) => String(entry?.id || '').trim() === id) || null;
  if (!currentEntry) {
    return { ok: false, error: 'extension_not_found' };
  }
  if (!currentEntry.enabled) {
    return { ok: false, error: 'extension_disabled' };
  }

  const targetUrl = normalizeExtensionUrl(currentEntry.launchUrl);
  if (!targetUrl) {
    return { ok: false, error: 'extension_launch_url_missing' };
  }

  await warmExtensionServiceWorker(currentEntry, targetUrl);

  const existing = extensionWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    try {
      existing.loadURL(targetUrl);
    } catch {}
    try {
      existing.show();
      existing.focus();
    } catch {}
    return { ok: true };
  }

  const win = createExtensionShellWindow(currentEntry.name || 'Extension');

  extensionWindows.set(id, win);

  win.on('closed', () => {
    if (extensionWindows.get(id) === win) {
      extensionWindows.delete(id);
    }
  });

  void win.loadURL(targetUrl).catch(() => {});
  return { ok: true };
}

async function navigateShimWindow(sender, payload) {
  const owner = sender ? BrowserWindow.fromWebContents(sender) : null;
  if (!owner || owner.isDestroyed()) return { ok: false, error: 'extension_window_not_found' };

  const url = normalizeShimUrl(payload && payload.url);
  if (!url) return { ok: false, error: 'extension_url_missing' };

  await warmExtensionServiceWorker(null, url);

  if (payload && payload.openInNewTab) {
    const nextWin = createExtensionShellWindow(owner.getTitle?.() || 'Extension');
    void nextWin.loadURL(url).catch(() => {
      try {
        nextWin.close();
      } catch {}
    });
    return { ok: true };
  }

  void owner.loadURL(url).catch(() => {});
  return { ok: true };
}

function registerExtensionsIpc() {
  if (registered) return;
  registered = true;

  attachExtensionDownloadInterceptor();

  if (!broadcastAttached) {
    broadcastAttached = true;
    extensionManager.on('changed', (entries) => {
      broadcastExtensionsChanged(entries);
    });
  }

  ipcMain.handle('extensions:list', async () => {
    return { ok: true, extensions: extensionManager.listExtensions() };
  });

  ipcMain.handle('extensions:getGuestPreloadUrl', async () => {
    return getExtensionGuestPreloadUrl();
  });

  ipcMain.handle('extensions:prepareTab', async (_evt, extensionId, targetUrl) => {
    return prepareExtensionTab(extensionId, targetUrl);
  });

  ipcMain.handle('extensions:loadUnpacked', async (evt) => {
    const owner = evt?.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
    return resultFromOperation(await extensionManager.loadUnpacked(owner));
  });

  ipcMain.handle('extensions:installFromChromeWebStore', async (_evt, input) => {
    const owner = _evt?.sender ? BrowserWindow.fromWebContents(_evt.sender) : null;
    return resultFromOperation(await extensionManager.installFromChromeWebStore(input, owner));
  });

  ipcMain.handle('extensions:enable', async (_evt, extensionId) => {
    return resultFromOperation(await extensionManager.enableExtension(extensionId));
  });

  ipcMain.handle('extensions:disable', async (_evt, extensionId) => {
    closeTrackedExtensionWindow(extensionId);
    return resultFromOperation(await extensionManager.disableExtension(extensionId));
  });

  ipcMain.handle('extensions:reload', async (_evt, extensionId) => {
    closeTrackedExtensionWindow(extensionId);
    return resultFromOperation(await extensionManager.reloadExtension(extensionId));
  });

  ipcMain.handle('extensions:remove', async (_evt, extensionId) => {
    closeTrackedExtensionWindow(extensionId);
    return resultFromOperation(await extensionManager.removeExtension(extensionId));
  });

  ipcMain.handle('extensions:open', async (_evt, extensionId) => {
    return openExtensionInBrowserTab(_evt?.sender, extensionId);
  });

  ipcMain.on('extensions:shimNavigate', (evt, payload) => {
    navigateShimWindow(evt?.sender, payload || {});
  });

  ipcMain.handle('extensions:openStore', async (_evt, url) => {
    createOrFocusExtensionStoreWindow(url);
    return { ok: true };
  });

  ipcMain.handle('extensions:getGrantedPermissions', async (_evt, context) => {
    return getGrantedPermissions(context || {});
  });

  ipcMain.on('extensions:getGrantedPermissionsSync', (evt, context) => {
    try {
      evt.returnValue = getGrantedPermissions(context || {});
    } catch (error) {
      evt.returnValue = { ok: false, error: String(error?.message || error || 'permissions_lookup_failed') };
    }
  });

  ipcMain.handle('extensions:requestPermissions', async (_evt, payload) => {
    const owner = _evt?.sender ? BrowserWindow.fromWebContents(_evt.sender) : null;
    const input = payload && typeof payload === 'object' ? payload : {};
    return requestOptionalPermissions(owner, input.extensionContext || {}, input.details || {});
  });

  ipcMain.handle('extensions:removePermissions', async (_evt, payload) => {
    const input = payload && typeof payload === 'object' ? payload : {};
    return removeGrantedPermissions(input.extensionContext || {}, input.details || {});
  });

  ipcMain.handle('extensions:getProviderFallbackState', async () => {
    return extensionManager.getProviderFallbackState();
  });

  ipcMain.on('extensions:installFromStore', async (evt, payload) => {
    const input =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object'
          ? String(payload.id || payload.url || '').trim()
          : '';
    let result = { ok: false, error: 'invalid_chrome_web_store_id' };
    if (input) {
      const owner = evt?.sender ? BrowserWindow.fromWebContents(evt.sender) : null;
      result = resultFromOperation(await extensionManager.installFromChromeWebStore(input, owner));
    }
    try {
      evt.sender.send('extensions:storeInstallResult', result);
    } catch {
      // ignore sender failures
    }
  });

  ipcMain.on('extensions:getProviderFallbackStateSync', (evt) => {
    try {
      evt.returnValue = extensionManager.getProviderFallbackState();
    } catch (error) {
      evt.returnValue = { keplr: true, leap: true, ethereum: true, error: String(error?.message || error || '') };
    }
  });
}

module.exports = {
  registerExtensionsIpc
};
