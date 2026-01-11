const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  localGatewayBase: 'http://127.0.0.1:8080',
  ipfsApiBase: 'http://127.0.0.1:5001',
  // Security settings
  securityPasswordEnabled: false,
  securityPasswordHash: null // { hash, salt, algorithm, params }
});

let cached = null;

function normalizeBaseUrl(input, fallback) {
  const raw = String(input ?? '').trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fallback;
    u.hash = '';
    u.search = '';
    let out = u.toString();
    out = out.replace(/\/+$/, '');
    return out || fallback;
  } catch {
    return fallback;
  }
}

function tryNormalizeBaseUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, value: '' };
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, value: '' };
    u.hash = '';
    u.search = '';
    const out = u.toString().replace(/\/+$/, '');
    return out ? { ok: true, value: out } : { ok: false, value: '' };
  } catch {
    return { ok: false, value: '' };
  }
}

function settingsPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'settings.json');
}

function loadSettingsFromDisk() {
  const fp = settingsPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistSettingsToDisk(next) {
  const fp = settingsPath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    console.warn('[electron][settings] failed to persist settings:', e);
  }
}

function getSettings() {
  if (cached) return cached;
  const disk = loadSettingsFromDisk();
  const settings = {
    localGatewayBase: normalizeBaseUrl(disk.localGatewayBase, DEFAULT_SETTINGS.localGatewayBase),
    ipfsApiBase: normalizeBaseUrl(disk.ipfsApiBase, DEFAULT_SETTINGS.ipfsApiBase),
    securityPasswordEnabled: !!disk.securityPasswordEnabled,
    securityPasswordHash: disk.securityPasswordHash || null
  };
  cached = settings;
  return settings;
}

function broadcastSettingsChanged(settings) {
  try {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.webContents?.send('settings:changed', settings);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

function setSettings(partial) {
  const current = getSettings();
  const p = partial && typeof partial === 'object' ? partial : {};

  const next = { ...current };
  if (Object.prototype.hasOwnProperty.call(p, 'localGatewayBase')) {
    const r = tryNormalizeBaseUrl(p.localGatewayBase);
    if (!r.ok) return { ok: false, error: 'invalid_localGatewayBase' };
    next.localGatewayBase = r.value;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'ipfsApiBase')) {
    const r = tryNormalizeBaseUrl(p.ipfsApiBase);
    if (!r.ok) return { ok: false, error: 'invalid_ipfsApiBase' };
    next.ipfsApiBase = r.value;
  }

  next.localGatewayBase = normalizeBaseUrl(next.localGatewayBase, DEFAULT_SETTINGS.localGatewayBase);
  next.ipfsApiBase = normalizeBaseUrl(next.ipfsApiBase, DEFAULT_SETTINGS.ipfsApiBase);

  cached = next;
  persistSettingsToDisk(next);
  broadcastSettingsChanged(next);
  return { ok: true, settings: next };
}

function getSetting(key) {
  const s = getSettings();
  return s && Object.prototype.hasOwnProperty.call(s, key) ? s[key] : undefined;
}

/**
 * Get security status (without exposing the full hash to renderer)
 */
function getSecurityStatus() {
  const s = getSettings();
  return {
    passwordEnabled: !!s.securityPasswordEnabled,
    hasPassword: !!(s.securityPasswordHash && s.securityPasswordHash.hash)
  };
}

/**
 * Set security password hash (internal use only)
 */
function setSecurityPassword(passwordHash) {
  const current = getSettings();
  const next = {
    ...current,
    securityPasswordEnabled: !!(passwordHash && passwordHash.hash),
    securityPasswordHash: passwordHash || null
  };
  cached = next;
  persistSettingsToDisk(next);
  broadcastSettingsChanged({ securityPasswordEnabled: next.securityPasswordEnabled });
  return { ok: true };
}

/**
 * Remove security password
 */
function removeSecurityPassword() {
  const current = getSettings();
  const next = {
    ...current,
    securityPasswordEnabled: false,
    securityPasswordHash: null
  };
  cached = next;
  persistSettingsToDisk(next);
  broadcastSettingsChanged({ securityPasswordEnabled: false });
  return { ok: true };
}

/**
 * Get stored password hash for verification (internal use only)
 */
function getStoredPasswordHash() {
  const s = getSettings();
  return s.securityPasswordHash || null;
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  getSetting,
  getSecurityStatus,
  setSecurityPassword,
  removeSecurityPassword,
  getStoredPasswordHash
};
