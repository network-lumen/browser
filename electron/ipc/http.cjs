const fs = require('node:fs');
const { URL } = require('node:url');
const { BrowserWindow, dialog, ipcMain, webContents } = require('electron');
const { extensionManager } = require('../extensions/manager.cjs');
const { ensureDir, readJson, userDataPath, writeJson } = require('../utils/fs.cjs');

const EXTENSION_NETWORK_PERMISSIONS_FILE = () => userDataPath('extension_network_permissions.json');
const EXTENSION_NETWORK_AUDIT_FILE = () => userDataPath('logs', 'extension_network_audit.jsonl');
const extensionPermissionSessionCache = new Map();
const extensionPermissionInflight = new Map();
const guardedSessions = new WeakSet();

function safeAuditText(value, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function appendExtensionNetworkAuditEntry(input) {
  try {
    const entry = input && typeof input === 'object' ? input : {};
    ensureDir(userDataPath('logs'));
    fs.appendFileSync(
      EXTENSION_NETWORK_AUDIT_FILE(),
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'extension_network_authorization',
        extensionId: safeAuditText(entry.extensionId, 128),
        runtimeId: safeAuditText(entry.runtimeId, 128),
        extensionName: safeAuditText(entry.extensionName, 256),
        targetOrigin: safeAuditText(entry.targetOrigin, 4096),
        targetUrl: safeAuditText(entry.targetUrl, 8192),
        pageUrl: safeAuditText(entry.pageUrl, 8192),
        allowed: !!entry.allowed,
        decisionSource: safeAuditText(entry.decisionSource, 64) || 'unknown',
        remembered: !!entry.remembered
      })}\n`,
      'utf8',
    );
  } catch {}
}

function logExtensionAuthorizationDecision(extensionInfo, context, targetOrigin, allowed, meta = {}) {
  appendExtensionNetworkAuditEntry({
    extensionId: extensionInfo?.extensionId,
    runtimeId: extensionInfo?.runtimeId,
    extensionName: extensionInfo?.extensionName,
    targetOrigin,
    targetUrl: meta?.targetUrl,
    pageUrl: context?.pageUrl,
    allowed,
    decisionSource: meta?.decisionSource,
    remembered: meta?.remembered
  });
}

function normalizeHeaders(h) {
  return h && typeof h === 'object' ? { ...h } : {};
}

function decodeRequestBody(options) {
  if (!options || typeof options !== 'object') return undefined;
  if (typeof options.bodyText === 'string') return options.bodyText;
  if (typeof options.bodyBase64 === 'string' && options.bodyBase64) {
    try {
      return Buffer.from(options.bodyBase64, 'base64');
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function rewriteLocalhostSubdomain(url, headers) {
  try {
    const u = new URL(String(url || ''));
    const host = String(u.hostname || '').trim();
    if (!host) return { url: String(url || ''), headers };

    const lower = host.toLowerCase();

    // Browsers treat *.localhost as loopback, but Node/undici does not always resolve it.
    // Instead of relying on a custom Host header (often restricted), convert subdomain gateway
    // URLs to path-style gateway URLs which always resolve locally.
    //
    //   http://<cid>.ipfs.localhost:8080/path  -> http://127.0.0.1:8080/ipfs/<cid>/path
    //   http://<name>.ipns.localhost:8080/path -> http://127.0.0.1:8080/ipns/<name>/path
    const m = lower.match(/^([a-z0-9]+)\.(ipfs|ipns)\.localhost$/i);
    if (m && m[1] && m[2]) {
      const id = String(m[1] || '').trim();
      const kind = String(m[2] || '').trim().toLowerCase();
      if (!id || (kind !== 'ipfs' && kind !== 'ipns')) return { url: String(url || ''), headers };

      const path = String(u.pathname || '/');
      const rest = path.startsWith('/') ? path : '/' + path;
      u.hostname = '127.0.0.1';
      u.pathname = `/${kind}/${id}${rest}`;
      return { url: u.toString(), headers: normalizeHeaders(headers) };
    }

    return { url: String(url || ''), headers };
  } catch {
    return { url: String(url || ''), headers };
  }
}

async function httpGet(url, options = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 60000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'GET',
      headers: rewritten.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    const contentType = res.headers.get('content-type') || '';
    const text = await res.text().catch(() => '');
    let json = null;
    if (contentType.includes('application/json')) {
      try {
        json = JSON.parse(text);
      } catch (_e) {
        // ignore JSON parse error, caller can inspect raw text
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      text,
      json
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    
    // Only log non-timeout and non-DNS errors
    if (!isTimeout && !isDnsError) {
      console.warn('[electron][http:get] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

async function httpGetBytes(url, options = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 60000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'GET',
      headers: rewritten.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    const buf = await res.arrayBuffer().catch(() => null);
    const bytes = buf ? Buffer.from(buf) : Buffer.alloc(0);

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      dataB64: bytes.toString('base64')
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    
    // Only log non-timeout and non-DNS errors
    if (!isTimeout && !isDnsError) {
      console.warn('[electron][http:getBytes] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

async function httpHead(url, options = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 30000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const res = await fetch(rewritten.url, {
      method: 'HEAD',
      headers: rewritten.headers || {},
      signal: controller.signal
    });
    clearTimeout(t);

    return {
      ok: res.ok,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries())
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    if (!isTimeout && !isDnsError) {
      console.warn('[electron][http:head] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

function normalizeExtensionContext(input) {
  const value = input && typeof input === 'object' ? input : {};
  const runtimeId = String(value.runtimeId || '').trim();
  if (!runtimeId) return null;
  return {
    runtimeId,
    origin: String(value.origin || '').trim(),
    pageUrl: String(value.pageUrl || '').trim()
  };
}

function getExtensionRuntimeIdFromUrl(input) {
  try {
    const parsed = new URL(String(input || ''));
    if (parsed.protocol !== 'chrome-extension:') return '';
    return String(parsed.hostname || '').trim();
  } catch {
    return '';
  }
}

function buildExtensionOrigin(runtimeId) {
  const id = String(runtimeId || '').trim();
  return id ? `chrome-extension://${id}` : '';
}

function buildExtensionContextFromRuntimeId(runtimeId, pageUrl = '') {
  const id = String(runtimeId || '').trim();
  if (!id) return null;
  return normalizeExtensionContext({
    runtimeId: id,
    origin: buildExtensionOrigin(id),
    pageUrl: String(pageUrl || '').trim() || buildExtensionOrigin(id)
  });
}

function resolveExtensionContextFromRequestDetails(details) {
  const candidateUrls = [
    details?.initiator,
    details?.origin,
    details?.referrer,
    details?.documentURL,
    details?.documentUrl,
    details?.frameUrl,
    details?.frame?.url
  ];

  for (const candidate of candidateUrls) {
    const runtimeId = getExtensionRuntimeIdFromUrl(candidate);
    if (runtimeId) {
      return buildExtensionContextFromRuntimeId(runtimeId, candidate);
    }
  }

  const wcId = Number(details?.webContentsId);
  if (Number.isFinite(wcId) && wcId > 0) {
    try {
      const sourceContents = webContents.fromId(Math.trunc(wcId));
      const sourceUrl =
        sourceContents && typeof sourceContents.getURL === 'function'
          ? String(sourceContents.getURL() || '').trim()
          : '';
      const runtimeId = getExtensionRuntimeIdFromUrl(sourceUrl);
      if (runtimeId) {
        return buildExtensionContextFromRuntimeId(runtimeId, sourceUrl);
      }
    } catch {}
  }

  return null;
}

function resolveOwnerWindowFromRequestDetails(details) {
  const wcId = Number(details?.webContentsId);
  if (Number.isFinite(wcId) && wcId > 0) {
    try {
      const sourceContents = webContents.fromId(Math.trunc(wcId));
      if (sourceContents && !sourceContents.isDestroyed?.()) {
        const owner =
          (typeof sourceContents.getOwnerBrowserWindow === 'function' &&
            sourceContents.getOwnerBrowserWindow()) ||
          BrowserWindow.fromWebContents(sourceContents) ||
          null;
        if (owner && !owner.isDestroyed?.()) return owner;
      }
    } catch {}
  }
  return BrowserWindow.getFocusedWindow() || null;
}

function resolveExtensionAuthorizationSource(input = {}) {
  const evt = input.evt || null;
  const details = input.details || null;
  const options = input.options && typeof input.options === 'object' ? input.options : {};

  const ownerWindow =
    (evt?.sender && BrowserWindow.fromWebContents(evt.sender)) ||
    resolveOwnerWindowFromRequestDetails(details) ||
    null;

  const context =
    normalizeExtensionContext(options.extensionContext) ||
    resolveExtensionContextFromRequestDetails(details) ||
    null;

  return {
    ownerWindow,
    context
  };
}

function getTargetOrigin(url) {
  try {
    const parsed = new URL(String(url || ''));
    return String(parsed.origin || '').trim();
  } catch {
    return '';
  }
}

function buildPermissionCacheKey(extensionKey, targetOrigin) {
  return `${String(extensionKey || '').trim()}::${String(targetOrigin || '').trim()}`;
}

function normalizePermissionEntry(input) {
  const entry = input && typeof input === 'object' ? input : {};
  const extensionId = String(entry.extensionId || '').trim();
  const runtimeId = String(entry.runtimeId || '').trim();
  const targetOrigin = String(entry.targetOrigin || '').trim();
  if (!extensionId || !runtimeId || !targetOrigin) return null;
  return {
    extensionId,
    runtimeId,
    extensionName: String(entry.extensionName || 'Extension').trim() || 'Extension',
    targetOrigin,
    allowed: !!entry.allowed,
    updatedAt: String(entry.updatedAt || '').trim() || new Date().toISOString()
  };
}

function readExtensionPermissionEntries() {
  const raw = readJson(EXTENSION_NETWORK_PERMISSIONS_FILE(), { version: 1, entries: [] }) || {};
  const items = Array.isArray(raw.entries) ? raw.entries : [];
  return items.map((entry) => normalizePermissionEntry(entry)).filter(Boolean);
}

function writeExtensionPermissionEntries(entries) {
  writeJson(EXTENSION_NETWORK_PERMISSIONS_FILE(), {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(entries) ? entries : []
  });
}

function resolveExtensionPermissionInfo(context) {
  const runtimeId = String(context?.runtimeId || '').trim();
  const entries =
    extensionManager && typeof extensionManager.listExtensions === 'function'
      ? extensionManager.listExtensions()
      : [];
  const match =
    entries.find((entry) => String(entry?.runtimeId || '').trim() === runtimeId) ||
    entries.find((entry) => String(entry?.id || '').trim() === runtimeId) ||
    null;

  const extensionId = String(match?.id || runtimeId).trim();
  return {
    extensionId,
    runtimeId: String(match?.runtimeId || runtimeId).trim(),
    extensionName: String(match?.name || `Extension ${extensionId.slice(0, 8)}`).trim() || 'Extension'
  };
}

function readPersistedExtensionPermission(extensionKey, targetOrigin) {
  const key = buildPermissionCacheKey(extensionKey, targetOrigin);
  const entries = readExtensionPermissionEntries();
  const match =
    entries.find(
      (entry) => buildPermissionCacheKey(entry.extensionId || entry.runtimeId, entry.targetOrigin) === key,
    ) || null;
  return match ? !!match.allowed : null;
}

function persistExtensionPermissionDecision(extensionInfo, targetOrigin, allowed) {
  const current = readExtensionPermissionEntries();
  const nextEntry = normalizePermissionEntry({
    extensionId: extensionInfo.extensionId,
    runtimeId: extensionInfo.runtimeId,
    extensionName: extensionInfo.extensionName,
    targetOrigin,
    allowed: !!allowed,
    updatedAt: new Date().toISOString()
  });
  if (!nextEntry) return;

  const key = buildPermissionCacheKey(extensionInfo.extensionId || extensionInfo.runtimeId, targetOrigin);
  const filtered = current.filter(
    (entry) => buildPermissionCacheKey(entry.extensionId || entry.runtimeId, entry.targetOrigin) !== key,
  );
  filtered.push(nextEntry);
  writeExtensionPermissionEntries(filtered);
}

async function promptForExtensionPermission(ownerWindow, extensionInfo, targetOrigin, context = null, targetUrl = '') {
  const cacheKey = buildPermissionCacheKey(
    extensionInfo.extensionId || extensionInfo.runtimeId,
    targetOrigin,
  );
  if (extensionPermissionInflight.has(cacheKey)) {
    return extensionPermissionInflight.get(cacheKey);
  }

  const promptPromise = (async () => {
    const owner = ownerWindow || BrowserWindow.getFocusedWindow() || undefined;

    const dialogOptions = {
      type: 'question',
      buttons: ['Allow', 'Block'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Extension Request Permission',
      message: `Extension "${extensionInfo.extensionName}" is requesting permission to make requests to "${targetOrigin}".`,
      detail: 'Allow this extension to access this network origin?',
      checkboxLabel: 'Remember this choice for this extension and origin',
      checkboxChecked: true
    };
    const result = owner
      ? await dialog.showMessageBox(owner, dialogOptions)
      : await dialog.showMessageBox(dialogOptions);

    const allowed = result.response === 0;
    extensionPermissionSessionCache.set(cacheKey, allowed);
    if (result.checkboxChecked) {
      persistExtensionPermissionDecision(extensionInfo, targetOrigin, allowed);
    }
    logExtensionAuthorizationDecision(extensionInfo, context, targetOrigin, allowed, {
      decisionSource: 'prompt',
      remembered: result.checkboxChecked,
      targetUrl
    });
    return allowed;
  })().finally(() => {
    extensionPermissionInflight.delete(cacheKey);
  });

  extensionPermissionInflight.set(cacheKey, promptPromise);
  return promptPromise;
}

async function ensureExtensionRequestAuthorized(evt, url, options) {
  const source = resolveExtensionAuthorizationSource({ evt, options });
  const context = normalizeExtensionContext(source.context);
  if (!context) return { allowed: true };

  const targetOrigin = getTargetOrigin(url);
  if (!targetOrigin) return { allowed: true };

  const extensionInfo = resolveExtensionPermissionInfo(context);
  const cacheKey = buildPermissionCacheKey(
    extensionInfo.extensionId || extensionInfo.runtimeId,
    targetOrigin,
  );

  if (extensionPermissionSessionCache.has(cacheKey)) {
    return { allowed: !!extensionPermissionSessionCache.get(cacheKey) };
  }

  const persisted = readPersistedExtensionPermission(
    extensionInfo.extensionId || extensionInfo.runtimeId,
    targetOrigin,
  );
  if (persisted != null) {
    extensionPermissionSessionCache.set(cacheKey, !!persisted);
    logExtensionAuthorizationDecision(extensionInfo, context, targetOrigin, !!persisted, {
      decisionSource: 'persisted',
      remembered: true,
      targetUrl: url
    });
    return { allowed: !!persisted };
  }

  const allowed = await promptForExtensionPermission(
    source.ownerWindow,
    extensionInfo,
    targetOrigin,
    context,
    url,
  );
  return { allowed };
}

async function authorizeExtensionRequestFromDetails(details) {
  const source = resolveExtensionAuthorizationSource({ details });
  const context = normalizeExtensionContext(source.context);
  if (!context) return { allowed: true, context: null };

  const targetUrl = String(details?.url || '').trim();
  const targetOrigin = getTargetOrigin(targetUrl);
  if (!targetOrigin) return { allowed: true, context };

  const extensionInfo = resolveExtensionPermissionInfo(context);
  const cacheKey = buildPermissionCacheKey(
    extensionInfo.extensionId || extensionInfo.runtimeId,
    targetOrigin,
  );

  if (extensionPermissionSessionCache.has(cacheKey)) {
    return {
      allowed: !!extensionPermissionSessionCache.get(cacheKey),
      context
    };
  }

  const persisted = readPersistedExtensionPermission(
    extensionInfo.extensionId || extensionInfo.runtimeId,
    targetOrigin,
  );
  if (persisted != null) {
    extensionPermissionSessionCache.set(cacheKey, !!persisted);
    logExtensionAuthorizationDecision(extensionInfo, context, targetOrigin, !!persisted, {
      decisionSource: 'persisted',
      remembered: true,
      targetUrl
    });
    return { allowed: !!persisted, context };
  }

  const allowed = await promptForExtensionPermission(
    source.ownerWindow,
    extensionInfo,
    targetOrigin,
    context,
    targetUrl,
  );
  return { allowed, context };
}

async function httpRequest(url, options = {}, evt = null) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'unsupported_scheme' };
    }
  } catch (_e) {
    return { ok: false, status: 0, error: 'invalid_url' };
  }

  try {
    const authorization = await ensureExtensionRequestAuthorized(evt, url, options);
    if (!authorization.allowed) {
      return {
        ok: false,
        status: 0,
        error: 'extension_request_not_authorized',
        blockedByUser: true
      };
    }

    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeout === 'number' && options.timeout > 0
        ? options.timeout
        : 60000;
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const rewritten = rewriteLocalhostSubdomain(url, options.headers);
    const method = String(options.method || 'GET').trim().toUpperCase() || 'GET';
    const init = {
      method,
      headers: rewritten.headers || {},
      redirect: options.redirect === 'manual' ? 'manual' : 'follow',
      signal: controller.signal
    };
    const body = decodeRequestBody(options);
    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      init.body = body;
    }

    const res = await fetch(rewritten.url, init);
    clearTimeout(t);

    const buf = await res.arrayBuffer().catch(() => null);
    const bytes = buf ? Buffer.from(buf) : Buffer.alloc(0);

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText || '',
      url: String(res.url || rewritten.url || url),
      redirected: !!res.redirected,
      headers: Object.fromEntries(res.headers.entries()),
      bodyBase64: bytes.toString('base64')
    };
  } catch (e) {
    const isTimeout = e.name === 'AbortError' || String(e).includes('aborted');
    const isDnsError = e.cause && (e.cause.code === 'ENOTFOUND' || e.cause.code === 'EAI_AGAIN');
    if (!isTimeout && !isDnsError) {
      console.warn('[electron][http:request] error', e);
    }
    return {
      ok: false,
      status: 0,
      error: String(e && e.message ? e.message : e),
      timeout: isTimeout
    };
  }
}

function registerHttpIpc() {
  ipcMain.handle('http:get', async (_evt, url, options) => {
    return httpGet(String(url || ''), options || {});
  });
  ipcMain.handle('http:getBytes', async (_evt, url, options) => {
    return httpGetBytes(String(url || ''), options || {});
  });
  ipcMain.handle('http:head', async (_evt, url, options) => {
    return httpHead(String(url || ''), options || {});
  });
  ipcMain.handle('http:request', async (_evt, url, options) => {
    return httpRequest(String(url || ''), options || {}, _evt || null);
  });
}

function registerExtensionNetworkRequestGuard(targetSession) {
  if (!targetSession || !targetSession.webRequest) return false;
  if (guardedSessions.has(targetSession)) return true;

  targetSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      void authorizeExtensionRequestFromDetails(details)
        .then((authorization) => {
          callback({ cancel: authorization.allowed === false });
        })
        .catch(() => {
          callback({ cancel: true });
        });
    },
  );

  guardedSessions.add(targetSession);
  return true;
}

module.exports = {
  httpGet,
  httpGetBytes,
  httpHead,
  httpRequest,
  registerHttpIpc,
  registerExtensionNetworkRequestGuard
};
