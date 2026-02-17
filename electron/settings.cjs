const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  localGatewayBase: 'http://127.0.0.1:8088',
  ipfsApiBase: 'http://127.0.0.1:5001',
  showSexualContent: false,
  showViolentContent: false,
  showDisturbingImagery: false,
  securityPasswordEnabled: false,
  securityPasswordHash: null
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
    showSexualContent: !!disk.showSexualContent,
    showViolentContent: !!disk.showViolentContent,
    showDisturbingImagery: !!disk.showDisturbingImagery,
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

  if (Object.prototype.hasOwnProperty.call(p, 'showSexualContent')) {
    next.showSexualContent = !!p.showSexualContent;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'showViolentContent')) {
    next.showViolentContent = !!p.showViolentContent;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'showDisturbingImagery')) {
    next.showDisturbingImagery = !!p.showDisturbingImagery;
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

// ============================================================================
// Gateway Management Functions
// ============================================================================

/**
 * Get path to gateways storage file
 */
function gatewaysPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'gateways.json');
}

/**
 * Load gateways from disk
 */
function loadGateways() {
  const fp = gatewaysPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save gateways to disk
 */
function saveGateways(gateways) {
  const fp = gatewaysPath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(gateways, null, 2), 'utf8');
    return { ok: true };
  } catch (e) {
    console.warn('[electron][settings] failed to save gateways:', e);
    return { ok: false, error: String(e.message) };
  }
}

/**
 * Add a new gateway
 */
function addGateway(gateway) {
  if (!gateway || !gateway.id || !gateway.url) {
    return { ok: false, error: 'Invalid gateway data' };
  }
  
  const gateways = loadGateways();
  
  // Check if gateway with this ID already exists
  if (gateways.some(g => g.id === gateway.id)) {
    return { ok: false, error: 'Gateway with this ID already exists' };
  }
  
  gateways.push({
    id: gateway.id,
    name: gateway.name || 'Unnamed Gateway',
    url: gateway.url,
    apiKey: gateway.apiKey || '',
    createdAt: gateway.createdAt || Date.now(),
    updatedAt: Date.now(),
    status: gateway.status || 'active',
    owner: gateway.owner || ''
  });
  
  return saveGateways(gateways);
}

/**
 * Update an existing gateway
 */
function updateGateway(id, updates) {
  if (!id || !updates) {
    return { ok: false, error: 'Invalid parameters' };
  }
  
  const gateways = loadGateways();
  const index = gateways.findIndex(g => g.id === id);
  
  if (index === -1) {
    return { ok: false, error: 'Gateway not found' };
  }
  
  gateways[index] = {
    ...gateways[index],
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: Date.now()
  };
  
  return saveGateways(gateways);
}

/**
 * Delete a gateway
 */
function deleteGateway(id) {
  if (!id) {
    return { ok: false, error: 'Invalid gateway ID' };
  }
  
  const gateways = loadGateways();
  const filtered = gateways.filter(g => g.id !== id);
  
  if (filtered.length === gateways.length) {
    return { ok: false, error: 'Gateway not found' };
  }
  
  return saveGateways(filtered);
}

// ============================================================================
// Private Cloud Configuration Functions
// ============================================================================

/**
 * Get path to private cloud config file
 */
function privateCloudConfigPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'private-cloud.json');
}

/**
 * Load private cloud configuration
 */
function loadPrivateCloudConfig() {
  const fp = privateCloudConfigPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      enabled: !!parsed.enabled,
      gatewayIds: Array.isArray(parsed.gatewayIds) ? parsed.gatewayIds : [],
      preferPrivate: !!parsed.preferPrivate,
      fallbackToDAO: parsed.fallbackToDAO !== false, // Default true
      timeout: typeof parsed.timeout === 'number' ? parsed.timeout : 5000,
      maxRetries: typeof parsed.maxRetries === 'number' ? parsed.maxRetries : 3
    };
  } catch {
    return {
      enabled: false,
      gatewayIds: [],
      preferPrivate: false,
      fallbackToDAO: true,
      timeout: 5000,
      maxRetries: 3
    };
  }
}

/**
 * Save private cloud configuration
 */
function savePrivateCloudConfig(config) {
  const fp = privateCloudConfigPath();
  console.log('[electron][settings] savePrivateCloudConfig called with:', config);
  console.log('[electron][settings] config path:', fp);
  
  try {
    const toSave = {
      enabled: !!config.enabled,
      gatewayIds: Array.isArray(config.gatewayIds) ? config.gatewayIds : [],
      preferPrivate: !!config.preferPrivate,
      fallbackToDAO: config.fallbackToDAO !== false,
      timeout: typeof config.timeout === 'number' ? config.timeout : 5000,
      maxRetries: typeof config.maxRetries === 'number' ? config.maxRetries : 3
    };
    
    console.log('[electron][settings] saving config:', toSave);
    
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(toSave, null, 2), 'utf8');
    
    console.log('[electron][settings] config saved successfully');
    return { ok: true };
  } catch (e) {
    console.error('[electron][settings] failed to save private cloud config:', e);
    return { ok: false, error: String(e.message) };
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  getSetting,
  getSecurityStatus,
  setSecurityPassword,
  removeSecurityPassword,
  getStoredPasswordHash,
  // Gateway management
  loadGateways,
  saveGateways,
  addGateway,
  updateGateway,
  deleteGateway,
  // Private cloud config
  loadPrivateCloudConfig,
  savePrivateCloudConfig
};
