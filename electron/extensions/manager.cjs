const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { app, dialog, session } = require('electron');
const { ensureDir, readJson, writeJson, userDataPath } = require('../utils/fs.cjs');
const {
  extractChromeWebStoreId,
  downloadCrxArchive,
  extractCrxArchiveToDirectory
} = require('./crx.cjs');
const {
  buildProviderFallbackState,
  detectProviderHints,
  hashStableId,
  normalizeProviderHints
} = require('./wallet_injection.cjs');

const EXTENSION_PARTITION = 'persist:lumen';

function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function safeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return !!fallback;
}

function getRealPath(targetPath) {
  const raw = safeString(targetPath, 4096);
  if (!raw) return '';
  try {
    const resolver =
      fs.realpathSync && typeof fs.realpathSync.native === 'function'
        ? fs.realpathSync.native
        : fs.realpathSync;
    return String(resolver(raw) || '');
  } catch {
    return raw;
  }
}

function readManifestFromDirectory(dirPath) {
  const directory = getRealPath(dirPath);
  if (!directory || !fs.existsSync(directory)) {
    throw new Error('extension_directory_not_found');
  }

  const manifestPath = path.join(directory, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest_missing');
  }

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new Error('manifest_invalid');
  }

  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest_invalid');
  }

  const name =
    safeString(manifest.name, 256) ||
    safeString(manifest.short_name, 256) ||
    'Unnamed extension';
  const version = safeString(manifest.version, 64) || '0.0.0';

  return {
    path: directory,
    manifestPath,
    manifest,
    name,
    version
  };
}

function copyDirectoryContents(sourceDir, targetDir) {
  const src = getRealPath(sourceDir);
  if (!src || !fs.existsSync(src)) {
    throw new Error('extension_source_missing');
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(path.dirname(targetDir));
  fs.cpSync(src, targetDir, {
    recursive: true,
    force: true,
    dereference: true,
    errorOnExist: false
  });
}

function removeDirectory(targetDir) {
  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
  } catch {}
}

function getSessionExtensionsApi(targetSession) {
  if (
    targetSession &&
    targetSession.extensions &&
    typeof targetSession.extensions.loadExtension === 'function'
  ) {
    return targetSession.extensions;
  }
  return targetSession;
}

function normalizeRegistryEntry(input) {
  const entry = input && typeof input === 'object' ? input : {};
  return {
    id: safeString(entry.id, 128),
    runtimeId: safeString(entry.runtimeId, 128),
    name: safeString(entry.name, 256) || 'Unnamed extension',
    version: safeString(entry.version, 64) || '0.0.0',
    path: safeString(entry.path, 4096),
    sourcePath: safeString(entry.sourcePath, 4096),
    installType: safeString(entry.installType, 64) || 'unpacked',
    installSource: safeString(entry.installSource, 4096),
    enabled: safeBoolean(entry.enabled, true),
    loaded: safeBoolean(entry.loaded, false),
    lastError: safeString(entry.lastError, 2048),
    popupPath: safeString(entry.popupPath, 2048),
    launchUrl: safeString(entry.launchUrl, 4096),
    providerHints: normalizeProviderHints(entry.providerHints),
    updatedAt: safeString(entry.updatedAt, 128),
    createdAt: safeString(entry.createdAt, 128)
  };
}

function normalizeExtensionPagePath(rawPath) {
  const value = safeString(rawPath, 2048).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!value) return '';
  const withoutQuery = value.split(/[?#]/, 1)[0] || '';
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) return '';
  return value;
}

function buildExtensionPageUrl(runtimeId, pagePath = '') {
  const id = safeString(runtimeId, 128);
  if (!id) return '';
  const normalizedPath = normalizeExtensionPagePath(pagePath);
  return normalizedPath ? `chrome-extension://${id}/${normalizedPath}` : `chrome-extension://${id}/`;
}

function resolveLaunchInfo(manifest, runtimeId) {
  const candidates = [
    manifest?.action?.default_popup,
    manifest?.browser_action?.default_popup,
    manifest?.page_action?.default_popup,
    manifest?.side_panel?.default_path,
    manifest?.options_ui?.page,
    manifest?.options_page
  ];

  for (const candidate of candidates) {
    const popupPath = normalizeExtensionPagePath(candidate);
    if (!popupPath) continue;
    return {
      popupPath,
      launchUrl: buildExtensionPageUrl(runtimeId, popupPath)
    };
  }

  return {
    popupPath: '',
    launchUrl: buildExtensionPageUrl(runtimeId, '')
  };
}

class ExtensionManager extends EventEmitter {
  constructor() {
    super();
    this.registry = [];
    this.initialized = false;
  }

  getSession() {
    return session.fromPartition(EXTENSION_PARTITION);
  }

  getSessionExtensions() {
    return getSessionExtensionsApi(this.getSession());
  }

  getExtensionsRoot() {
    return userDataPath('extensions');
  }

  getRegistryPath() {
    return userDataPath('extensions.json');
  }

  getManagedExtensionPath(extensionId) {
    return path.join(this.getExtensionsRoot(), String(extensionId || '').trim());
  }

  readRegistry() {
    const filePath = this.getRegistryPath();
    const raw = readJson(filePath, []);
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.extensions)
        ? raw.extensions
        : [];

    return items
      .map((entry) => normalizeRegistryEntry(entry))
      .filter((entry) => entry.id && entry.path);
  }

  writeRegistry(entries) {
    const normalized = Array.isArray(entries)
      ? entries.map((entry) => normalizeRegistryEntry(entry)).filter((entry) => entry.id && entry.path)
      : [];
    this.registry = normalized;
    writeJson(this.getRegistryPath(), normalized);
    return normalized;
  }

  getRegistryEntries() {
    return this.registry.map((entry) => ({ ...entry }));
  }

  findEntryById(extensionId) {
    const id = safeString(extensionId, 128);
    if (!id) return null;
    return this.registry.find((entry) => entry.id === id) || null;
  }

  findLoadedRuntime(entry, loadedExtensions = null) {
    const items = Array.isArray(loadedExtensions)
      ? loadedExtensions
      : this.getSessionExtensions().getAllExtensions();
    const managedPath = getRealPath(entry.path);
    return (
      items.find((item) => safeString(item?.id, 128) === entry.runtimeId) ||
      items.find((item) => getRealPath(item?.path) === managedPath) ||
      items.find((item) => safeString(item?.id, 128) === entry.id) ||
      null
    );
  }

  syncLoadedState() {
    const loadedExtensions = this.getSessionExtensions().getAllExtensions();
    const next = this.registry.map((entry) => {
      const loadedRuntime = this.findLoadedRuntime(entry, loadedExtensions);
      let launchInfo = {
        popupPath: safeString(entry.popupPath, 2048),
        launchUrl: safeString(entry.launchUrl, 4096)
      };
      try {
        const manifestInfo = readManifestFromDirectory(entry.path);
        launchInfo = resolveLaunchInfo(
          manifestInfo.manifest,
          safeString(loadedRuntime?.id, 128) || entry.runtimeId || entry.id
        );
      } catch {
        // ignore manifest read failures during sync
      }
      return normalizeRegistryEntry({
        ...entry,
        runtimeId: safeString(loadedRuntime?.id, 128) || entry.runtimeId || '',
        name: safeString(loadedRuntime?.name, 256) || entry.name,
        version: safeString(loadedRuntime?.version, 64) || entry.version,
        path: getRealPath(loadedRuntime?.path) || entry.path,
        loaded: !!loadedRuntime,
        popupPath: launchInfo.popupPath,
        launchUrl: launchInfo.launchUrl
      });
    });
    this.registry = next;
    return this.getRegistryEntries();
  }

  emitChanged() {
    const entries = this.syncLoadedState();
    this.writeRegistry(entries);
    this.emit('changed', this.getRegistryEntries());
  }

  buildManagedId(manifest, sourcePath) {
    const key = safeString(manifest?.key, 4096);
    if (key) return hashStableId(`manifest-key:${key}`, 32);
    return hashStableId(`source:${getRealPath(sourcePath)}`, 32);
  }

  async unloadEntry(entry) {
    const current = entry ? normalizeRegistryEntry(entry) : null;
    if (!current) return null;

    const loadedRuntime = this.findLoadedRuntime(current);
    if (!loadedRuntime) {
      return normalizeRegistryEntry({ ...current, loaded: false });
    }

    try {
      this.getSessionExtensions().removeExtension(loadedRuntime.id);
    } catch (error) {
      return normalizeRegistryEntry({
        ...current,
        loaded: true,
        lastError: safeString(error?.message || error || 'remove_extension_failed', 2048)
      });
    }

    return normalizeRegistryEntry({
      ...current,
      runtimeId: safeString(loadedRuntime.id, 128) || current.runtimeId,
      loaded: false
    });
  }

  async loadEntry(entry, options = {}) {
    const current = normalizeRegistryEntry(entry);
    if (!current.enabled) {
      return normalizeRegistryEntry({ ...current, loaded: false });
    }

    const targetPath = current.path;
    if (!targetPath || !fs.existsSync(targetPath)) {
      return normalizeRegistryEntry({
        ...current,
        loaded: false,
        lastError: 'extension_path_missing'
      });
    }

    if (
      current.installType === 'unpacked' &&
      current.sourcePath &&
      safeBoolean(options.syncSource, true)
    ) {
      const sourcePath = getRealPath(current.sourcePath);
      if (sourcePath && fs.existsSync(sourcePath)) {
        copyDirectoryContents(sourcePath, targetPath);
      }
    }

    try {
      const runtime = this.findLoadedRuntime(current);
      if (runtime) {
        try {
          this.getSessionExtensions().removeExtension(runtime.id);
        } catch {}
      }

      const loaded = await this.getSessionExtensions().loadExtension(targetPath, {
        allowFileAccess: true
      });
      const manifestInfo = readManifestFromDirectory(targetPath);
      const launchInfo = resolveLaunchInfo(
        manifestInfo.manifest,
        safeString(loaded?.id, 128) || current.runtimeId || current.id
      );
      return normalizeRegistryEntry({
        ...current,
        runtimeId: safeString(loaded?.id, 128) || current.runtimeId,
        name: safeString(loaded?.name, 256) || manifestInfo.name || current.name,
        version: safeString(loaded?.version, 64) || manifestInfo.version || current.version,
        path: getRealPath(loaded?.path) || targetPath,
        popupPath: launchInfo.popupPath,
        launchUrl: launchInfo.launchUrl,
        providerHints: normalizeProviderHints([
          ...current.providerHints,
          ...detectProviderHints(manifestInfo.manifest, current.installSource || current.sourcePath || targetPath)
        ]),
        loaded: true,
        lastError: '',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      return normalizeRegistryEntry({
        ...current,
        loaded: false,
        lastError: safeString(error?.message || error || 'load_extension_failed', 2048),
        updatedAt: new Date().toISOString()
      });
    }
  }

  async initialize() {
    ensureDir(this.getExtensionsRoot());

    const registry = this.readRegistry();
    this.writeRegistry(registry);

    const loadedEntries = [];
    for (const entry of registry) {
      if (!entry.enabled) {
        loadedEntries.push(normalizeRegistryEntry({ ...entry, loaded: false }));
        continue;
      }
      loadedEntries.push(await this.loadEntry(entry, { syncSource: true }));
    }

    this.writeRegistry(loadedEntries);
    this.initialized = true;
    this.emit('ready', this.getRegistryEntries());
    this.emitChanged();
    return this.getRegistryEntries();
  }

  listExtensions() {
    return this.syncLoadedState();
  }

  getProviderFallbackState() {
    return buildProviderFallbackState(this.syncLoadedState());
  }

  async installManagedExtension(managedId, sourceDir, metadata = {}) {
    const manifestInfo = readManifestFromDirectory(sourceDir);
    const extensionId = safeString(managedId, 128);
    if (!extensionId) throw new Error('invalid_extension_id');

    const managedPath = this.getManagedExtensionPath(extensionId);
    if (getRealPath(manifestInfo.path) !== getRealPath(managedPath)) {
      copyDirectoryContents(manifestInfo.path, managedPath);
    }
    const copiedManifest = readManifestFromDirectory(managedPath);
    const previous = this.findEntryById(extensionId);

    const baseEntry = normalizeRegistryEntry({
      ...previous,
      id: extensionId,
      path: managedPath,
      sourcePath: safeString(metadata.sourcePath, 4096) || previous?.sourcePath || '',
      installType: safeString(metadata.installType, 64) || previous?.installType || 'unpacked',
      installSource: safeString(metadata.installSource, 4096) || previous?.installSource || '',
      name: copiedManifest.name || previous?.name || 'Unnamed extension',
      version: copiedManifest.version || previous?.version || '0.0.0',
      enabled: true,
      loaded: false,
      lastError: '',
      providerHints: normalizeProviderHints([
        ...(previous?.providerHints || []),
        ...detectProviderHints(copiedManifest.manifest, metadata.installSource || metadata.sourcePath || sourceDir)
      ]),
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const nextEntry = await this.loadEntry(baseEntry, { syncSource: false });
    const nextRegistry = [
      ...this.registry.filter((entry) => entry.id !== extensionId),
      nextEntry
    ].sort((a, b) => a.name.localeCompare(b.name));

    this.writeRegistry(nextRegistry);
    this.emitChanged();
    return nextEntry;
  }

  async loadUnpacked(browserWindow = null) {
    const owner = browserWindow && typeof browserWindow.isDestroyed === 'function' && !browserWindow.isDestroyed()
      ? browserWindow
      : null;
    const selected = await dialog.showOpenDialog(owner, {
      title: 'Load unpacked extension',
      properties: ['openDirectory']
    });

    if (!selected || selected.canceled || !Array.isArray(selected.filePaths) || !selected.filePaths.length) {
      return { ok: false, canceled: true, error: 'canceled' };
    }

    const sourcePath = selected.filePaths[0];
    let manifestInfo = null;
    try {
      manifestInfo = readManifestFromDirectory(sourcePath);
    } catch (error) {
      return { ok: false, error: safeString(error?.message || error || 'invalid_extension_directory', 2048) };
    }

    const extensionId = this.buildManagedId(manifestInfo.manifest, sourcePath);

    try {
      const entry = await this.installManagedExtension(extensionId, sourcePath, {
        installType: 'unpacked',
        sourcePath,
        installSource: sourcePath
      });
      if (!entry.loaded && entry.lastError) {
        return { ok: false, error: entry.lastError, extension: entry };
      }
      return { ok: true, extension: entry };
    } catch (error) {
      return { ok: false, error: safeString(error?.message || error || 'load_unpacked_failed', 2048) };
    }
  }

  async installFromChromeWebStore(input) {
    let extensionId = '';
    try {
      extensionId = extractChromeWebStoreId(input);
    } catch (error) {
      return { ok: false, error: safeString(error?.message || error || 'invalid_chrome_web_store_id', 2048) };
    }

    const targetDir = this.getManagedExtensionPath(extensionId);
    try {
      const archive = await downloadCrxArchive(extensionId);
      removeDirectory(targetDir);
      ensureDir(targetDir);
      await extractCrxArchiveToDirectory(archive.buffer, targetDir);
      readManifestFromDirectory(targetDir);
      const entry = await this.installManagedExtension(extensionId, targetDir, {
        installType: 'chrome-web-store',
        installSource: archive.url,
        sourcePath: ''
      });
      if (!entry.loaded && entry.lastError) {
        return { ok: false, error: entry.lastError, extension: entry };
      }
      return { ok: true, extension: entry };
    } catch (error) {
      removeDirectory(targetDir);
      return {
        ok: false,
        error: safeString(error?.message || error || 'chrome_web_store_install_failed', 2048)
      };
    }
  }

  async enableExtension(extensionId) {
    const current = this.findEntryById(extensionId);
    if (!current) return { ok: false, error: 'extension_not_found' };

    const loaded = await this.loadEntry({ ...current, enabled: true }, { syncSource: true });
    const nextRegistry = this.registry.map((entry) => (entry.id === current.id ? loaded : entry));
    this.writeRegistry(nextRegistry);
    this.emitChanged();
    return loaded.loaded
      ? { ok: true, extension: loaded }
      : { ok: false, error: loaded.lastError || 'enable_extension_failed', extension: loaded };
  }

  async disableExtension(extensionId) {
    const current = this.findEntryById(extensionId);
    if (!current) return { ok: false, error: 'extension_not_found' };

    const unloaded = await this.unloadEntry(current);
    const nextEntry = normalizeRegistryEntry({
      ...unloaded,
      enabled: false,
      updatedAt: new Date().toISOString()
    });
    const nextRegistry = this.registry.map((entry) => (entry.id === current.id ? nextEntry : entry));
    this.writeRegistry(nextRegistry);
    this.emitChanged();
    return { ok: true, extension: nextEntry };
  }

  async reloadExtension(extensionId) {
    const current = this.findEntryById(extensionId);
    if (!current) return { ok: false, error: 'extension_not_found' };
    if (!current.enabled) return { ok: false, error: 'extension_disabled' };

    const reloaded = await this.loadEntry(current, { syncSource: true });
    const nextRegistry = this.registry.map((entry) => (entry.id === current.id ? reloaded : entry));
    this.writeRegistry(nextRegistry);
    this.emitChanged();
    return reloaded.loaded
      ? { ok: true, extension: reloaded }
      : { ok: false, error: reloaded.lastError || 'reload_extension_failed', extension: reloaded };
  }

  async removeExtension(extensionId) {
    const current = this.findEntryById(extensionId);
    if (!current) return { ok: false, error: 'extension_not_found' };

    await this.unloadEntry(current);
    removeDirectory(current.path);
    const nextRegistry = this.registry.filter((entry) => entry.id !== current.id);
    this.writeRegistry(nextRegistry);
    this.emitChanged();
    return { ok: true, id: current.id };
  }
}

const extensionManager = new ExtensionManager();

module.exports = {
  EXTENSION_PARTITION,
  extensionManager
};
