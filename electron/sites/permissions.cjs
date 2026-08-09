const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FILE_NAME = 'lumen_site_permissions.json';
const VERSION = 1;

let cached = null;

function permissionsPath() {
  const userData = app.getPath('userData');
  return path.join(userData, FILE_NAME);
}

function loadFromDisk() {
  const fp = permissionsPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { version: VERSION, sites: {} };
    const sites = parsed.sites && typeof parsed.sites === 'object' ? parsed.sites : {};
    return { version: VERSION, sites };
  } catch {
    return { version: VERSION, sites: {} };
  }
}

function persistToDisk(data) {
  const fp = permissionsPath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[electron][lumenSite] failed to persist permissions:', e);
  }
}

function getAll() {
  if (!cached) cached = loadFromDisk();
  return cached;
}

function isAllowed(siteKey) {
  const key = String(siteKey || '').trim();
  if (!key) return false;
  const data = getAll();
  const entry = data.sites && data.sites[key] ? data.sites[key] : null;
  return !!(entry && entry.allowModals === true);
}

function setAllowed(siteKey, allow) {
  const key = String(siteKey || '').trim();
  if (!key) return { ok: false, error: 'missing_siteKey' };
  const data = getAll();
  if (!data.sites || typeof data.sites !== 'object') data.sites = {};
  data.sites[key] = {
    allowModals: !!allow,
    updatedAt: Date.now()
  };
  cached = data;
  persistToDisk(data);
  return { ok: true };
}

module.exports = {
  isAllowed,
  setAllowed
};

