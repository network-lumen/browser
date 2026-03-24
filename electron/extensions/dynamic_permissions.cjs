const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');
const { ensureDir, readJson, userDataPath, writeJson } = require('../utils/fs.cjs');
const { extensionManager } = require('./manager.cjs');

const EXTENSION_DYNAMIC_PERMISSIONS_FILE = () => userDataPath('extension_dynamic_permissions.json');
const EXTENSION_DYNAMIC_PERMISSIONS_AUDIT_FILE = () =>
  userDataPath('logs', 'extension_dynamic_permissions_audit.jsonl');

function safeString(value, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function normalizeList(values, maxLen = 4096) {
  const items = Array.isArray(values) ? values : [];
  return Array.from(
    new Set(items.map((entry) => safeString(entry, maxLen)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function normalizeExtensionContext(input) {
  const value = input && typeof input === 'object' ? input : {};
  const runtimeId = safeString(value.runtimeId, 128);
  if (!runtimeId) return null;
  return {
    runtimeId,
    origin: safeString(value.origin, 4096),
    pageUrl: safeString(value.pageUrl, 8192)
  };
}

function normalizeGrantEntry(input) {
  const value = input && typeof input === 'object' ? input : {};
  const extensionId = safeString(value.extensionId, 128);
  const runtimeId = safeString(value.runtimeId, 128);
  if (!extensionId || !runtimeId) return null;
  return {
    extensionId,
    runtimeId,
    extensionName: safeString(value.extensionName, 256) || 'Extension',
    permissions: normalizeList(value.permissions, 256),
    origins: normalizeList(value.origins, 4096),
    updatedAt: safeString(value.updatedAt, 128) || new Date().toISOString()
  };
}

function readGrantEntries() {
  const raw = readJson(EXTENSION_DYNAMIC_PERMISSIONS_FILE(), { version: 1, entries: [] }) || {};
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return entries.map((entry) => normalizeGrantEntry(entry)).filter(Boolean);
}

function writeGrantEntries(entries) {
  writeJson(EXTENSION_DYNAMIC_PERMISSIONS_FILE(), {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(entries) ? entries : []
  });
}

function appendAuditEntry(input) {
  try {
    const entry = input && typeof input === 'object' ? input : {};
    ensureDir(userDataPath('logs'));
    fs.appendFileSync(
      EXTENSION_DYNAMIC_PERMISSIONS_AUDIT_FILE(),
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'extension_dynamic_permissions',
        extensionId: safeString(entry.extensionId, 128),
        runtimeId: safeString(entry.runtimeId, 128),
        extensionName: safeString(entry.extensionName, 256),
        pageUrl: safeString(entry.pageUrl, 8192),
        allowed: typeof entry.allowed === 'boolean' ? entry.allowed : null,
        decisionSource: safeString(entry.decisionSource, 64) || 'unknown',
        requestedPermissions: normalizeList(entry.requestedPermissions, 256),
        requestedOrigins: normalizeList(entry.requestedOrigins, 4096),
        newPermissions: normalizeList(entry.newPermissions, 256),
        newOrigins: normalizeList(entry.newOrigins, 4096),
        remainingPermissions: normalizeList(entry.remainingPermissions, 256),
        remainingOrigins: normalizeList(entry.remainingOrigins, 4096)
      })}\n`,
      'utf8',
    );
  } catch {}
}

function resolveExtensionInfo(context) {
  const normalized = normalizeExtensionContext(context);
  if (!normalized) return null;
  const items =
    extensionManager && typeof extensionManager.listExtensions === 'function'
      ? extensionManager.listExtensions()
      : [];
  const entry =
    items.find((item) => safeString(item?.runtimeId, 128) === normalized.runtimeId) ||
    items.find((item) => safeString(item?.id, 128) === normalized.runtimeId) ||
    null;
  if (!entry) return null;
  return {
    context: normalized,
    extensionId: safeString(entry.id, 128),
    runtimeId: safeString(entry.runtimeId, 128) || normalized.runtimeId,
    extensionName: safeString(entry.name, 256) || 'Extension',
    path: safeString(entry.path, 4096)
  };
}

function readManifest(info) {
  const manifestPath = path.join(safeString(info?.path, 4096), 'manifest.json');
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    throw new Error('manifest_missing');
  }
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!raw || typeof raw !== 'object') {
    throw new Error('manifest_invalid');
  }
  return raw;
}

function getStoredGrant(info) {
  const entries = readGrantEntries();
  const match =
    entries.find((entry) => entry.extensionId === info.extensionId) ||
    entries.find((entry) => entry.runtimeId === info.runtimeId) ||
    null;
  return (
    match || {
      extensionId: info.extensionId,
      runtimeId: info.runtimeId,
      extensionName: info.extensionName,
      permissions: [],
      origins: [],
      updatedAt: new Date().toISOString()
    }
  );
}

function persistGrant(info, grant) {
  const nextEntry = normalizeGrantEntry({
    extensionId: info.extensionId,
    runtimeId: info.runtimeId,
    extensionName: info.extensionName,
    permissions: grant.permissions,
    origins: grant.origins,
    updatedAt: new Date().toISOString()
  });
  if (!nextEntry) return;
  const current = readGrantEntries();
  const filtered = current.filter(
    (entry) => entry.extensionId !== info.extensionId && entry.runtimeId !== info.runtimeId
  );
  filtered.push(nextEntry);
  writeGrantEntries(filtered);
}

function buildEffectivePermissions(manifest, grant) {
  return {
    permissions: normalizeList(
      [...(manifest.permissions || []), ...(grant.permissions || [])],
      256,
    ),
    origins: normalizeList(
      [...(manifest.host_permissions || []), ...(grant.origins || [])],
      4096,
    )
  };
}

function normalizePermissionDetails(details) {
  const value = details && typeof details === 'object' ? details : {};
  return {
    permissions: normalizeList(value.permissions, 256),
    origins: normalizeList(value.origins, 4096)
  };
}

function formatPermissionSection(title, items, emptyLabel = 'None') {
  if (!Array.isArray(items) || !items.length) {
    return [`${title}: ${emptyLabel}`];
  }
  return [`${title}:`, ...items.map((item) => `- ${item}`)];
}

async function requestOptionalPermissions(ownerWindow, context, details) {
  const info = resolveExtensionInfo(context);
  if (!info) {
    return { ok: false, error: 'extension_not_found', granted: { permissions: [], origins: [] } };
  }

  const manifest = readManifest(info);
  const requested = normalizePermissionDetails(details);
  const grant = getStoredGrant(info);
  const effective = buildEffectivePermissions(manifest, grant);

  const newPermissions = requested.permissions.filter(
    (item) => !effective.permissions.includes(item)
  );
  const newOrigins = requested.origins.filter((item) => !effective.origins.includes(item));

  if (!newPermissions.length && !newOrigins.length) {
    return { ok: true, allowed: true, granted: grant };
  }

  const optionalPermissions = new Set(normalizeList(manifest.optional_permissions, 256));
  const optionalOrigins = new Set(normalizeList(manifest.optional_host_permissions, 4096));
  const invalidPermissions = newPermissions.filter((item) => !optionalPermissions.has(item));
  const invalidOrigins = newOrigins.filter((item) => !optionalOrigins.has(item));

  if (invalidPermissions.length || invalidOrigins.length) {
    appendAuditEntry({
      extensionId: info.extensionId,
      runtimeId: info.runtimeId,
      extensionName: info.extensionName,
      pageUrl: info.context.pageUrl,
      allowed: false,
      decisionSource: 'invalid_request',
      requestedPermissions: requested.permissions,
      requestedOrigins: requested.origins,
      newPermissions,
      newOrigins
    });
    return { ok: true, allowed: false, granted: grant };
  }

  const detailLines = [
    `Extension ID: ${info.extensionId}`,
    `Requested from: ${info.context.pageUrl || info.context.origin || '(unknown)'}`,
    '',
    ...formatPermissionSection('New API permissions', newPermissions),
    '',
    ...formatPermissionSection('New host permissions', newOrigins),
    '',
    'These permissions stay granted until the extension removes them or the user removes the extension.'
  ];

  const dialogOptions = {
    type: 'warning',
    buttons: ['Allow', 'Block'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Grant extension permissions',
    message: `Allow "${info.extensionName}" to request more permissions?`,
    detail: detailLines.join('\n')
  };

  const owner =
    ownerWindow && typeof ownerWindow.isDestroyed === 'function' && !ownerWindow.isDestroyed()
      ? ownerWindow
      : null;
  const result = owner
    ? await dialog.showMessageBox(owner, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);

  const allowed = result.response === 0;
  if (!allowed) {
    appendAuditEntry({
      extensionId: info.extensionId,
      runtimeId: info.runtimeId,
      extensionName: info.extensionName,
      pageUrl: info.context.pageUrl,
      allowed: false,
      decisionSource: 'prompt',
      requestedPermissions: requested.permissions,
      requestedOrigins: requested.origins,
      newPermissions,
      newOrigins
    });
    return { ok: true, allowed: false, granted: grant };
  }

  const nextGrant = {
    permissions: normalizeList([...grant.permissions, ...newPermissions], 256),
    origins: normalizeList([...grant.origins, ...newOrigins], 4096)
  };
  persistGrant(info, nextGrant);
  appendAuditEntry({
    extensionId: info.extensionId,
    runtimeId: info.runtimeId,
    extensionName: info.extensionName,
    pageUrl: info.context.pageUrl,
    allowed: true,
    decisionSource: 'prompt',
    requestedPermissions: requested.permissions,
    requestedOrigins: requested.origins,
    newPermissions,
    newOrigins
  });
  return { ok: true, allowed: true, granted: nextGrant };
}

function removeGrantedPermissions(context, details) {
  const info = resolveExtensionInfo(context);
  if (!info) {
    return { ok: false, error: 'extension_not_found', granted: { permissions: [], origins: [] } };
  }

  const requested = normalizePermissionDetails(details);
  const grant = getStoredGrant(info);
  const nextGrant = {
    permissions: normalizeList(
      grant.permissions.filter((item) => !requested.permissions.includes(item)),
      256,
    ),
    origins: normalizeList(
      grant.origins.filter((item) => !requested.origins.includes(item)),
      4096,
    )
  };
  persistGrant(info, nextGrant);
  appendAuditEntry({
    extensionId: info.extensionId,
    runtimeId: info.runtimeId,
    extensionName: info.extensionName,
    pageUrl: info.context.pageUrl,
    decisionSource: 'remove',
    requestedPermissions: requested.permissions,
    requestedOrigins: requested.origins,
    remainingPermissions: nextGrant.permissions,
    remainingOrigins: nextGrant.origins
  });
  return { ok: true, removed: true, granted: nextGrant };
}

function getGrantedPermissions(context) {
  const info = resolveExtensionInfo(context);
  if (!info) {
    return { ok: false, error: 'extension_not_found', granted: { permissions: [], origins: [] } };
  }
  return { ok: true, granted: getStoredGrant(info) };
}

module.exports = {
  getGrantedPermissions,
  requestOptionalPermissions,
  removeGrantedPermissions
};
