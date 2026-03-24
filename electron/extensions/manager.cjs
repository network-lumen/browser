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
const LUMEN_BACKGROUND_SHIM_FILE_PREFIX = 'lumen-background-shim';
const LUMEN_BACKGROUND_SHIM_FILE = `${LUMEN_BACKGROUND_SHIM_FILE_PREFIX}.js`;
const LUMEN_PATCH_METADATA_FILE = 'lumen-extension-patch.json';
const LEGACY_LUMEN_BACKGROUND_SHIM_FILE = '__lumen_background_shim__.js';
const LEGACY_LUMEN_PATCH_METADATA_FILE = '__lumen_extension_patch__.json';
const RUNTIME_SENDMESSAGE_TIMEOUT_MS = 10_000;
const EXTENSION_DEBUG = process.env.LUMEN_EXTENSION_DEBUG === '1';

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

async function inspectManifestFromCrxBuffer(extensionId, crxBuffer) {
  const tempRoot = fs.mkdtempSync(path.join(app.getPath('temp'), `lumen-ext-preview-${safeString(extensionId, 32) || 'tmp'}-`));
  try {
    await extractCrxArchiveToDirectory(crxBuffer, tempRoot);
    const manifestInfo = readManifestFromDirectory(tempRoot);
    return {
      manifest: manifestInfo.manifest && typeof manifestInfo.manifest === 'object'
        ? JSON.parse(JSON.stringify(manifestInfo.manifest))
        : {},
      name: manifestInfo.name,
      version: manifestInfo.version
    };
  } finally {
    removeDirectory(tempRoot);
  }
}

function normalizeManifestList(values, maxLen = 4096) {
  const items = Array.isArray(values) ? values : [];
  return Array.from(
    new Set(
      items
        .map((entry) => safeString(entry, maxLen))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function collectContentScriptMatches(manifest) {
  const scripts = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts : [];
  const matches = [];
  for (const script of scripts) {
    const items = Array.isArray(script?.matches) ? script.matches : [];
    for (const entry of items) {
      const value = safeString(entry, 4096);
      if (value) matches.push(value);
    }
  }
  return Array.from(new Set(matches)).sort((a, b) => a.localeCompare(b));
}

function collectExternallyConnectableMatches(manifest) {
  const items = Array.isArray(manifest?.externally_connectable?.matches)
    ? manifest.externally_connectable.matches
    : [];
  return Array.from(
    new Set(items.map((entry) => safeString(entry, 4096)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function summarizeManifestPermissions(manifest) {
  return {
    permissions: normalizeManifestList(manifest?.permissions, 256),
    optionalPermissions: normalizeManifestList(manifest?.optional_permissions, 256),
    hostPermissions: normalizeManifestList(manifest?.host_permissions, 4096),
    optionalHostPermissions: normalizeManifestList(manifest?.optional_host_permissions, 4096),
    contentScriptMatches: collectContentScriptMatches(manifest),
    externallyConnectableMatches: collectExternallyConnectableMatches(manifest)
  };
}

function summarizeSensitiveManifestWarnings(summary) {
  const warnings = [];
  const permissions = new Set(summary.permissions);
  const allHosts = [
    ...summary.hostPermissions,
    ...summary.optionalHostPermissions,
    ...summary.contentScriptMatches
  ];
  const hasBroadHostAccess = allHosts.some((entry) => {
    const lower = String(entry || '').toLowerCase();
    return lower === '<all_urls>' || lower === '*://*/*' || lower === 'http://*/*' || lower === 'https://*/*';
  });

  if (hasBroadHostAccess) warnings.push('Can access data on many or all websites');
  if (permissions.has('tabs')) warnings.push('Can inspect tab metadata when permissions allow it');
  if (permissions.has('cookies')) warnings.push('Can read and modify cookies');
  if (permissions.has('history')) warnings.push('Can read browsing history');
  if (permissions.has('downloads')) warnings.push('Can manage downloads');
  if (permissions.has('clipboardRead') || permissions.has('clipboardWrite')) {
    warnings.push('Can access the clipboard');
  }
  if (permissions.has('webRequest') || permissions.has('declarativeNetRequest')) {
    warnings.push('Can observe or modify network traffic');
  }
  if (permissions.has('nativeMessaging')) warnings.push('Can communicate with native applications');

  return warnings;
}

function formatInstallPermissionSection(title, items, emptyLabel = 'None declared', limit = 8) {
  if (!Array.isArray(items) || !items.length) {
    return [`${title}: ${emptyLabel}`];
  }
  const visible = items.slice(0, limit);
  return [
    `${title}:`,
    ...visible.map((entry) => `- ${entry}`),
    ...(items.length > limit ? [`- +${items.length - limit} more`] : [])
  ];
}

function buildExtensionInstallDetail(input) {
  const manifestInfo = input?.manifestInfo && typeof input.manifestInfo === 'object' ? input.manifestInfo : {};
  const manifest = manifestInfo?.manifest && typeof manifestInfo.manifest === 'object' ? manifestInfo.manifest : {};
  const summary = summarizeManifestPermissions(manifest);
  const warnings = summarizeSensitiveManifestWarnings(summary);
  const lines = [
    `Extension ID: ${safeString(input?.extensionId, 128) || '(unknown)'}`,
    `Source: ${safeString(input?.sourceLabel, 256) || 'Extension package'}`,
    `Version: ${safeString(manifestInfo?.version || manifest?.version, 64) || '0.0.0'}`,
    `Manifest version: ${safeString(manifest?.manifest_version, 16) || 'unknown'}`
  ];

  const installSource = safeString(input?.installSource, 4096);
  if (installSource) {
    lines.push(`Origin: ${installSource}`);
  }

  lines.push('');

  if (warnings.length) {
    lines.push('Notable capabilities:');
    for (const warning of warnings.slice(0, 6)) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push(
    ...formatInstallPermissionSection('API permissions', summary.permissions),
    '',
    ...formatInstallPermissionSection('Host permissions', summary.hostPermissions),
    '',
    ...formatInstallPermissionSection('Content script matches', summary.contentScriptMatches),
    '',
    ...formatInstallPermissionSection('Optional permissions', summary.optionalPermissions),
    '',
    ...formatInstallPermissionSection('Optional host permissions', summary.optionalHostPermissions),
    '',
    ...formatInstallPermissionSection('Externally connectable matches', summary.externallyConnectableMatches),
    '',
    'Lumen will still ask before this extension opens a new http/https/ws/wss origin.'
  );

  return lines.join('\n');
}

async function confirmExtensionInstall(ownerWindow, input) {
  const owner =
    ownerWindow && typeof ownerWindow.isDestroyed === 'function' && !ownerWindow.isDestroyed()
      ? ownerWindow
      : null;
  const manifestInfo = input?.manifestInfo && typeof input.manifestInfo === 'object' ? input.manifestInfo : {};
  const extensionName =
    safeString(manifestInfo?.name, 256) ||
    safeString(manifestInfo?.manifest?.name, 256) ||
    'Unnamed extension';

  const dialogOptions = {
    type: 'warning',
    buttons: ['Install', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'Install extension',
    message: `Install "${extensionName}"?`,
    detail: buildExtensionInstallDetail(input)
  };

  const result = owner
    ? await dialog.showMessageBox(owner, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);
  return result.response === 0;
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

function safeRelativeExtensionPath(rawPath) {
  const value = safeString(rawPath, 2048).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!value) return '';
  const withoutQuery = value.split(/[?#]/, 1)[0] || '';
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..')) return '';
  return withoutQuery;
}

function isManagedBackgroundShimFile(rawPath) {
  const value = safeRelativeExtensionPath(rawPath);
  if (!value) return false;
  const basename = path.posix.basename(value);
  return (
    basename === LEGACY_LUMEN_BACKGROUND_SHIM_FILE ||
    (basename.startsWith(`${LUMEN_BACKGROUND_SHIM_FILE_PREFIX}-`) && basename.endsWith('.js')) ||
    basename === LUMEN_BACKGROUND_SHIM_FILE
  );
}

function buildManagedBackgroundShimFileName(shimSource) {
  const digest = hashStableId(`background-shim:${shimSource}`, 12);
  return `${LUMEN_BACKGROUND_SHIM_FILE_PREFIX}-${digest}.js`;
}

function detectOriginalServiceWorkerFromShim(dirPath, shimPath) {
  const normalizedShimPath = safeRelativeExtensionPath(shimPath);
  if (!normalizedShimPath) return '';

  const absoluteShimPath = path.join(dirPath, normalizedShimPath);
  if (!fs.existsSync(absoluteShimPath)) return '';

  let source = '';
  try {
    source = fs.readFileSync(absoluteShimPath, 'utf8');
  } catch {
    return '';
  }

  const matchers = [
    /importScripts\((["'`])([^"'`]+)\1\)/,
    /await\s+import\((["'`])(?:\.\/)?([^"'`]+)\1\)/
  ];

  for (const matcher of matchers) {
    const match = matcher.exec(source);
    const candidate = safeRelativeExtensionPath(match?.[2] || '');
    if (
      candidate &&
      !isManagedBackgroundShimFile(candidate) &&
      fs.existsSync(path.join(dirPath, candidate))
    ) {
      return candidate;
    }
  }

  return '';
}

function buildExtensionBackgroundShimSource(originalWorkerPath, workerType = '') {
  const normalizedWorkerPath = safeRelativeExtensionPath(originalWorkerPath);
  if (!normalizedWorkerPath) {
    throw new Error('extension_background_worker_invalid');
  }

  const loadOriginalWorker =
    safeString(workerType, 64) === 'module'
      ? `await import(${JSON.stringify(`./${normalizedWorkerPath}`)});`
      : `importScripts(${JSON.stringify(normalizedWorkerPath)});`;

  return `(async () => {
  const root = globalThis;
  if (root.__lumenBackgroundShimInstalled) {
    return;
  }
  root.__lumenBackgroundShimInstalled = true;

  const safeString = (value, maxLen = 2048) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  };

  const cloneValue = (value) => {
    if (value === undefined) return undefined;
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };

  const asyncResult = (value, callback) => {
    const promise = Promise.resolve(value);
    if (typeof callback === 'function') {
      promise.then((resolvedValue) => {
        try {
          callback(resolvedValue);
        } catch {}
      });
    }
    return promise;
  };

  const summarizeMethodValue = (value, methodName) => {
    try {
      if (!value || typeof value[methodName] !== 'function') return undefined;
      const result = value[methodName]();
      if (result == null) return result ?? null;
      if (
        typeof result === 'string' ||
        typeof result === 'number' ||
        typeof result === 'boolean'
      ) {
        return result;
      }
      return safeString(result, 256);
    } catch {
      return undefined;
    }
  };

  const summarizePortLike = (value, depth) => {
    if (!value || typeof value !== 'object') return null;
    const hasPortShape =
      typeof value.postMessage === 'function' ||
      typeof value.disconnect === 'function' ||
      value.onMessage ||
      value.onDisconnect;
    if (!hasPortShape) return null;
    return {
      portName: safeString(value.name, 256),
      sender: summarizeTraceValue(value.sender, depth + 1),
      hasOnMessage: !!value.onMessage,
      hasOnDisconnect: !!value.onDisconnect
    };
  };

  const summarizeTraceValue = (value, depth = 0) => {
    if (value == null) return value ?? null;

    const type = typeof value;
    if (type === 'string') {
      return value.length > 240 ? \`\${value.slice(0, 240)}...\` : value;
    }
    if (type === 'number' || type === 'boolean') {
      return value;
    }
    if (type === 'function') {
      return \`[function \${value.name || 'anonymous'}]\`;
    }
    if (value instanceof Error) {
      return {
        name: String(value.name || 'Error'),
        message: String(value.message || ''),
        stack: String(value.stack || '').split('\\n').slice(0, 3)
      };
    }
    if (Array.isArray(value)) {
      if (depth >= 2) return \`[array:\${value.length}]\`;
      return value.slice(0, 8).map((item) => summarizeTraceValue(item, depth + 1));
    }
    if (type === 'object') {
      const portSummary = summarizePortLike(value, depth);
      if (portSummary) return portSummary;
      const route = summarizeMethodValue(value, 'route');
      const messageType = summarizeMethodValue(value, 'type');
      const constructorName =
        value?.constructor && value.constructor !== Object
          ? safeString(value.constructor.name, 128)
          : '';
      if (
        Object.prototype.hasOwnProperty.call(value, 'port') &&
        Object.prototype.hasOwnProperty.call(value, 'msg')
      ) {
        return {
          port: summarizeTraceValue(value.port, depth + 1),
          type:
            messageType !== undefined
              ? messageType
              : summarizeTraceValue(value.type, depth + 1),
          route:
            route !== undefined ? route : summarizeMethodValue(value.msg, 'route'),
          msg: summarizeTraceValue(value.msg, depth + 1)
        };
      }
      if (depth >= 2 && (route !== undefined || messageType !== undefined)) {
        const compact = {};
        if (constructorName && constructorName !== 'Object') {
          compact.constructor = constructorName;
        }
        if (route !== undefined) compact.route = route;
        if (messageType !== undefined) compact.type = messageType;
        for (const [key, entryValue] of Object.entries(value).slice(0, 6)) {
          compact[key] = summarizeTraceValue(entryValue, depth + 1);
        }
        return compact;
      }
      if (depth >= 2) {
        return \`[object:\${Object.keys(value).slice(0, 6).join(',')}]\`;
      }
      const out = {};
      if (constructorName && constructorName !== 'Object') {
        out.constructor = constructorName;
      }
      if (route !== undefined) out.route = route;
      if (messageType !== undefined) out.type = messageType;
      for (const [key, entryValue] of Object.entries(value).slice(0, 12)) {
        out[key] = summarizeTraceValue(entryValue, depth + 1);
      }
      return out;
    }

    try {
      return String(value);
    } catch {
      return '[unserializable]';
    }
  };

  let traceWorker = () => {};

  const createEventTarget = (label = 'event') => {
    const listeners = new Set();
    return {
      listeners,
      addListener(listener) {
        if (typeof listener === 'function') {
          listeners.add(listener);
          traceWorker('event.addListener', {
            label,
            listener: String(listener.name || 'anonymous'),
            count: listeners.size
          });
        }
      },
      removeListener(listener) {
        const removed = listeners.delete(listener);
        traceWorker('event.removeListener', {
          label,
          listener: String(listener?.name || 'anonymous'),
          removed,
          count: listeners.size
        });
      },
      hasListener(listener) {
        return listeners.has(listener);
      },
      hasListeners() {
        return listeners.size > 0;
      },
      dispatch(...args) {
        traceWorker('event.dispatch', {
          label,
          listenerCount: listeners.size,
          args: summarizeTraceValue(args, 1)
        });
        for (const listener of Array.from(listeners)) {
          try {
            listener(...args);
          } catch {}
        }
      }
    };
  };

  const nativeEventWrapperCache = new WeakMap();

  const ensureMessageResult = (value, fallbackValue) => {
    if (value !== null && value !== undefined) {
      return value;
    }
    const fallback =
      typeof fallbackValue === 'function' ? fallbackValue() : cloneValue(fallbackValue);
    return fallback !== null && fallback !== undefined ? fallback : {};
  };

  const getNativeEventTarget = (label, nativeEvent, fallbackEvent) => {
    if (nativeEvent && typeof nativeEvent.addListener === 'function') {
      if (nativeEventWrapperCache.has(nativeEvent)) {
        return nativeEventWrapperCache.get(nativeEvent);
      }

      const wrappedEvent = {
        addListener(listener) {
          traceWorker('native-event.addListener', {
            label,
            listener: String(listener?.name || 'anonymous')
          });
          return nativeEvent.addListener(listener);
        },
        removeListener(listener) {
          traceWorker('native-event.removeListener', {
            label,
            listener: String(listener?.name || 'anonymous')
          });
          if (typeof nativeEvent.removeListener === 'function') {
            return nativeEvent.removeListener(listener);
          }
          return undefined;
        },
        hasListener(listener) {
          if (typeof nativeEvent.hasListener === 'function') {
            return nativeEvent.hasListener(listener);
          }
          return false;
        },
        hasListeners() {
          if (typeof nativeEvent.hasListeners === 'function') {
            return nativeEvent.hasListeners();
          }
          return true;
        }
      };

      nativeEventWrapperCache.set(nativeEvent, wrappedEvent);
      return wrappedEvent;
    }
    return fallbackEvent;
  };

  const patchNamespace = (target, source) => {
    if (!target || typeof target !== 'object') return;
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function') {
        if (!target[key] || typeof target[key] !== 'object') {
          try {
            target[key] = {};
          } catch {
            continue;
          }
        }
        patchNamespace(target[key], value);
        continue;
      }
      if (target[key] == null) {
        try {
          target[key] = value;
        } catch {}
      }
    }
  };

  const createNamespaceHost = (nativeNamespace, shimNamespace) => {
    if (!shimNamespace || typeof shimNamespace !== 'object') {
      return nativeNamespace && typeof nativeNamespace === 'object' ? nativeNamespace : shimNamespace;
    }

    const nativeObject =
      nativeNamespace && typeof nativeNamespace === 'object' ? nativeNamespace : null;
    const overrides = new Map();
    const host = {};

    for (const key of Object.keys(shimNamespace)) {
      Object.defineProperty(host, key, {
        configurable: true,
        enumerable: true,
        get() {
          if (overrides.has(key)) {
            return overrides.get(key);
          }

          const nativeValue = nativeObject ? nativeObject[key] : undefined;
          const shimValue = shimNamespace[key];
          if (nativeValue != null) {
            if (typeof nativeValue === 'function') {
              return nativeValue.bind(nativeObject);
            }
            if (
              nativeValue &&
              typeof nativeValue === 'object' &&
              !Array.isArray(nativeValue) &&
              shimValue &&
              typeof shimValue === 'object' &&
              !Array.isArray(shimValue)
            ) {
              return createNamespaceHost(nativeValue, shimValue);
            }
            return nativeValue;
          }

          return shimValue;
        },
        set(value) {
          overrides.set(key, value);
        }
      });
    }

    return host;
  };

  const installRootNamespace = (name, shimNamespace) => {
    const nativeNamespace = root[name];
    if (nativeNamespace && typeof nativeNamespace === 'object') {
      patchNamespace(nativeNamespace, shimNamespace);
    }
    const hostNamespace = createNamespaceHost(nativeNamespace, shimNamespace);
    try {
      Object.defineProperty(root, name, {
        configurable: true,
        enumerable: true,
        get() {
          return hostNamespace;
        },
        set(value) {
          if (value && typeof value === 'object') {
            patchNamespace(value, shimNamespace);
          }
        }
      });
      return hostNamespace;
    } catch {}

    if (!nativeNamespace || typeof nativeNamespace !== 'object') {
      root[name] = hostNamespace;
      return hostNamespace;
    }

    patchNamespace(nativeNamespace, shimNamespace);
    return nativeNamespace;
  };

  const href = (() => {
    try {
      return String(root.location?.href || root.registration?.scope || '');
    } catch {
      return '';
    }
  })();

  const runtimeId = (() => {
    try {
      return new URL(href).hostname || '';
    } catch {
      return '';
    }
  })();

  const getUrlOrigin = (input, fallback = '') => {
    const raw = safeString(input, 4096);
    if (!raw) return safeString(fallback, 4096);
    try {
      const url = new URL(raw);
      const origin = safeString(url.origin, 4096);
      if (origin && origin !== 'null') return origin;
      const protocol = safeString(url.protocol, 64);
      const host = safeString(url.host, 512);
      if (protocol && host) return protocol + '//' + host;
    } catch {}
    return safeString(fallback, 4096);
  };

  const extensionOrigin = getUrlOrigin(
    href,
    runtimeId ? 'chrome-extension://' + runtimeId : 'chrome-extension://'
  );

  const traceBuffer = [];
  let traceSeq = 0;
  traceWorker = (phase, details = {}) => {
    const entry = {
      seq: (traceSeq += 1),
      phase: String(phase || 'unknown'),
      href,
      runtimeId,
      worker: ${JSON.stringify(normalizedWorkerPath)}
    };
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      Object.assign(entry, summarizeTraceValue(details));
    } else if (details !== undefined) {
      entry.value = summarizeTraceValue(details);
    }
    traceBuffer.push(entry);
    if (traceBuffer.length > 300) {
      traceBuffer.splice(0, traceBuffer.length - 300);
    }
    if (${JSON.stringify(EXTENSION_DEBUG)}) {
      try {
        console.log(\`[lumen-managed-extension-background-trace] \${JSON.stringify(entry)}\`);
      } catch {}
    }
    return entry;
  };

  const drainTraceBuffer = () =>
    traceBuffer.splice(0, traceBuffer.length).map((entry) => cloneValue(entry));

  const storageEvents = {
    onChanged: createEventTarget('storage.onChanged')
  };
  const runtimeEvents = {
    onMessage: createEventTarget('runtime.onMessage'),
    onMessageExternal: createEventTarget('runtime.onMessageExternal'),
    onConnect: createEventTarget('runtime.onConnect'),
    onConnectExternal: createEventTarget('runtime.onConnectExternal'),
    onInstalled: createEventTarget('runtime.onInstalled'),
    onStartup: createEventTarget('runtime.onStartup'),
    onSuspend: createEventTarget('runtime.onSuspend'),
    onSuspendCanceled: createEventTarget('runtime.onSuspendCanceled'),
    onUpdateAvailable: createEventTarget('runtime.onUpdateAvailable')
  };
  const runtimeBridgeMirrors = {
    onMessage: new Set(),
    onMessageExternal: new Set()
  };
  const getRuntimeBridgeMirror = (target) => {
    if (target === runtimeEvents.onMessage) return runtimeBridgeMirrors.onMessage;
    if (target === runtimeEvents.onMessageExternal) return runtimeBridgeMirrors.onMessageExternal;
    return null;
  };
  const runtimeBridgeTimeoutMs = ${RUNTIME_SENDMESSAGE_TIMEOUT_MS};
  const runtimeBridgeChannel = (() => {
    try {
      if (typeof BroadcastChannel !== 'function') return null;
      return new BroadcastChannel('__lumen_extension_runtime__/' + (runtimeId || 'default'));
    } catch {
      return null;
    }
  })();

  const callRuntimeMessageListeners = async (target, message, currentSender) => {
    const listenerSet = new Set();
    if (target?.listeners && typeof target.listeners[Symbol.iterator] === 'function') {
      for (const listener of target.listeners) {
        listenerSet.add(listener);
      }
    }
    const mirroredListeners = getRuntimeBridgeMirror(target);
    if (mirroredListeners && typeof mirroredListeners[Symbol.iterator] === 'function') {
      for (const listener of mirroredListeners) {
        listenerSet.add(listener);
      }
    }
    if (listenerSet.size === 0) {
      return { handled: false, value: undefined };
    }

    const listenerTimeout = Symbol('listener-timeout');

    for (const listener of Array.from(listenerSet)) {
      let responded = false;
      let responseValue;
      let resolveAsyncResponse = null;
      const asyncResponse = new Promise((resolve) => {
        resolveAsyncResponse = resolve;
      });
      const sendResponse = (value) => {
        responded = true;
        responseValue = value;
        try {
          resolveAsyncResponse?.(value);
        } catch {}
      };

      try {
        const result = listener(message, currentSender, sendResponse);
        if (result && typeof result.then === 'function') {
          const awaited = await result;
          if (awaited !== undefined) return { handled: true, value: awaited };
          if (responded) return { handled: true, value: responseValue };
          continue;
        }
        if (result === true) {
          const awaited = await Promise.race([
            asyncResponse,
            new Promise((resolve) => setTimeout(() => resolve(listenerTimeout), runtimeBridgeTimeoutMs))
          ]);
          if (awaited !== listenerTimeout || responded) {
            return { handled: true, value: responded ? responseValue : awaited };
          }
          traceWorker('runtime.bridge.listener.timeout', {
            target: target === runtimeEvents.onMessageExternal ? 'external' : 'internal',
            listener: String(listener?.name || 'anonymous')
          });
          continue;
        }
        if (result !== undefined) return { handled: true, value: result };
        if (responded) return { handled: true, value: responseValue };
      } catch (error) {
        return {
          handled: true,
          value: {
            error: safeString(error?.message || error || 'runtime_onMessage_failed', 2048)
          }
        };
      }
    }

    return { handled: false, value: undefined };
  };

  const handleRuntimeBridgeRequest = async (payload) => {
    if (!runtimeBridgeChannel) return;

    const requestId = safeString(payload?.requestId, 256);
    if (!requestId) return;

    const args = Array.isArray(payload?.args) ? payload.args : [];
    let target = runtimeEvents.onMessage;
    let message = args[0];
    const targetExtensionId =
      typeof args[0] === 'string' && args.length >= 2 ? safeString(args[0], 128) : '';
    if (targetExtensionId) {
      message = args[1];
      if (targetExtensionId && targetExtensionId !== runtimeId) {
        target = runtimeEvents.onMessageExternal;
      }
    }

    const sender =
      payload?.sender && typeof payload.sender === 'object'
        ? payload.sender
        : {
            id: runtimeId,
            origin: extensionOrigin,
            url: href || extensionOrigin + '/'
          };

    traceWorker('runtime.bridge.request', {
      requestId,
      args: summarizeTraceValue(args, 1),
      sender: summarizeTraceValue(sender, 1),
      target: target === runtimeEvents.onMessageExternal ? 'external' : 'internal'
    });

    let handled = false;
    let value;
    try {
      const result = await callRuntimeMessageListeners(target, message, sender);
      handled = !!result?.handled;
      value = result?.value;
    } catch (error) {
      handled = true;
      value = {
        error: safeString(error?.message || error || 'runtime_bridge_failed', 2048)
      };
    }

    traceWorker('runtime.bridge.response', {
      requestId,
      handled,
      value: summarizeTraceValue(value, 1)
    });

    try {
      runtimeBridgeChannel.postMessage({
        __lumenRuntimeBridge: true,
        kind: 'response',
        requestId,
        handled,
        value: cloneValue(value)
      });
    } catch {}
  };

  if (runtimeBridgeChannel) {
    const runtimeBridgeListener = (event) => {
      const data = event?.data;
      if (!data || data.__lumenRuntimeBridge !== true) return;
      if (safeString(data.kind, 32) !== 'request') return;
      void handleRuntimeBridgeRequest(data);
    };
    try {
      if (typeof runtimeBridgeChannel.addEventListener === 'function') {
        runtimeBridgeChannel.addEventListener('message', runtimeBridgeListener);
      } else {
        runtimeBridgeChannel.onmessage = runtimeBridgeListener;
      }
    } catch {}
  }
  const idleEvents = {
    onStateChanged: createEventTarget('idle.onStateChanged')
  };
  const alarmsEvents = {
    onAlarm: createEventTarget('alarms.onAlarm')
  };
  const notificationsEvents = {
    onClicked: createEventTarget('notifications.onClicked'),
    onButtonClicked: createEventTarget('notifications.onButtonClicked'),
    onClosed: createEventTarget('notifications.onClosed'),
    onShown: createEventTarget('notifications.onShown'),
    onPermissionLevelChanged: createEventTarget('notifications.onPermissionLevelChanged')
  };
  const identityEvents = {
    onSignInChanged: createEventTarget('identity.onSignInChanged')
  };
  const windowEvents = {
    onCreated: createEventTarget('windows.onCreated'),
    onRemoved: createEventTarget('windows.onRemoved'),
    onFocusChanged: createEventTarget('windows.onFocusChanged')
  };
  const tabsEvents = {
    onCreated: createEventTarget('tabs.onCreated'),
    onUpdated: createEventTarget('tabs.onUpdated'),
    onRemoved: createEventTarget('tabs.onRemoved'),
    onActivated: createEventTarget('tabs.onActivated'),
    onReplaced: createEventTarget('tabs.onReplaced'),
    onDetached: createEventTarget('tabs.onDetached'),
    onAttached: createEventTarget('tabs.onAttached'),
    onMoved: createEventTarget('tabs.onMoved'),
    onHighlighted: createEventTarget('tabs.onHighlighted'),
    onZoomChange: createEventTarget('tabs.onZoomChange')
  };
  const webNavigationEvents = {
    onBeforeNavigate: createEventTarget('webNavigation.onBeforeNavigate'),
    onCommitted: createEventTarget('webNavigation.onCommitted'),
    onCompleted: createEventTarget('webNavigation.onCompleted'),
    onDOMContentLoaded: createEventTarget('webNavigation.onDOMContentLoaded'),
    onCreatedNavigationTarget: createEventTarget('webNavigation.onCreatedNavigationTarget'),
    onHistoryStateUpdated: createEventTarget('webNavigation.onHistoryStateUpdated'),
    onReferenceFragmentUpdated: createEventTarget('webNavigation.onReferenceFragmentUpdated'),
    onErrorOccurred: createEventTarget('webNavigation.onErrorOccurred')
  };

  const storageMemory = new Map();
  let nextWindowId = 2;
  let nextTabId = 2;
  const windowState = new Map();
  const tabState = new Map();
  const storageNamespacePrefix = \`__lumenExtensionWorkerStorage__/\${runtimeId || 'default'}/\`;

  const callNativeAsync = (nativeMethod, nativeThis, args, callback, fallbackValue) => {
    const fallback =
      typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);

    if (typeof nativeMethod !== 'function') {
      return asyncResult(fallback(), callback);
    }

    if (typeof callback === 'function') {
      try {
        const result = nativeMethod.apply(nativeThis, [
          ...args,
          (value) => {
            try {
              callback(value);
            } catch {}
          }
        ]);
        if (result && typeof result.then === 'function') {
          result.then(
            (value) => {
              try {
                callback(value);
              } catch {}
            },
            () => {
              try {
                callback(fallback());
              } catch {}
            }
          );
        }
        return;
      } catch {
        return asyncResult(fallback(), callback);
      }
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      try {
        const result = nativeMethod.apply(nativeThis, [...args, finish]);
        if (result && typeof result.then === 'function') {
          result.then(
            (value) => finish(value),
            () => finish(fallback())
          );
        } else if (result !== undefined) {
          finish(result);
        }
      } catch {
        finish(fallback());
      }
    });
  };

  const callNativeRuntimeSendMessage = (nativeMethod, nativeThis, args, callback, fallbackValue) => {
    const fallback =
      typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
    const maxAttempts = 6;
    const retryDelaysMs = [0, 40, 80, 140, 220, 320];
    const transientPatterns = [
      'receiving end does not exist',
      'message port closed',
      'could not establish connection',
      'port closed before a response was received',
      'service worker context shut down'
    ];

    if (typeof nativeMethod !== 'function') {
      return asyncResult(fallback(), callback);
    }

    const isTransientFailure = (value, error) => {
      if (value != null) return false;
      const message = safeString(error?.message || error || '', 1024).toLowerCase();
      if (!message) return true;
      return transientPatterns.some((pattern) => message.includes(pattern));
    };

    const invokeAttempt = () =>
      new Promise((resolve) => {
        let settled = false;
        let timeoutId = null;
        const expectsCallback = typeof callback === 'function';
        const finish = (value, error) => {
          if (settled) return;
          settled = true;
          if (timeoutId != null) {
            try {
              clearTimeout(timeoutId);
            } catch {}
          }
          resolve({ value, error });
        };

        const invokeWithoutCallback = () => {
          const result = nativeMethod.apply(nativeThis, args);
          if (result && typeof result.then === 'function') {
            result.then(
              (value) => finish(value, nativeThis?.lastError || null),
              (error) => finish(undefined, error)
            );
            return;
          }
          if (result !== undefined) {
            finish(result, nativeThis?.lastError || null);
          }
        };

        try {
          if (expectsCallback) {
            const result = nativeMethod.apply(nativeThis, [
              ...args,
              (value) => {
                const callbackError = nativeThis?.lastError || null;
                finish(value, callbackError);
              }
            ]);
            if (result !== undefined) {
              traceWorker('runtime.sendMessage.native-return.ignored', {
                value: summarizeTraceValue(result, 1),
                hasThen: !!(result && typeof result.then === 'function')
              });
            }
            if (result && typeof result.then === 'function') {
              result.then(
                () => {},
                (error) => finish(undefined, error)
              );
            }
          } else {
            try {
              const result = nativeMethod.apply(nativeThis, [
                ...args,
                (value) => {
                  const callbackError = nativeThis?.lastError || null;
                  finish(value, callbackError);
                }
              ]);
              if (result !== undefined && !(result && typeof result.then === 'function')) {
                traceWorker('runtime.sendMessage.native-return.ignored', {
                  value: summarizeTraceValue(result, 1),
                  hasThen: false
                });
              }
              if (result && typeof result.then === 'function') {
                result.then(
                  (value) => {
                    if (value !== undefined || nativeThis?.lastError) {
                      finish(value, nativeThis?.lastError || null);
                    }
                  },
                  (error) => finish(undefined, error)
                );
              }
            } catch (callbackStyleError) {
              try {
                invokeWithoutCallback();
              } catch (plainInvokeError) {
                finish(undefined, plainInvokeError || callbackStyleError);
              }
            }
          }
        } catch (error) {
          finish(undefined, error);
          return;
        }

        timeoutId = setTimeout(() => {
          finish(undefined, new Error('runtime.sendMessage timeout'));
        }, RUNTIME_SENDMESSAGE_TIMEOUT_MS);
      });

    const runWithRetries = async () => {
      let lastOutcome = null;
      const summarizedArgs = summarizeTraceValue(args, 1);
      traceWorker('runtime.sendMessage.start', {
        args: summarizedArgs,
        hasCallback: typeof callback === 'function'
      });
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        traceWorker('runtime.sendMessage.attempt', {
          attempt: attempt + 1,
          args: summarizedArgs
        });
        const outcome = await invokeAttempt();
        lastOutcome = outcome;
        traceWorker('runtime.sendMessage.outcome', {
          attempt: attempt + 1,
          value: summarizeTraceValue(outcome?.value, 1),
          error: summarizeTraceValue(outcome?.error, 1)
        });
        if (!isTransientFailure(outcome?.value, outcome?.error)) {
          traceWorker('runtime.sendMessage.success', {
            attempt: attempt + 1,
            value: summarizeTraceValue(outcome?.value, 1)
          });
          return outcome.value;
        }
        const delay = retryDelaysMs[Math.min(attempt + 1, retryDelaysMs.length - 1)];
        traceWorker('runtime.sendMessage.retry', {
          attempt: attempt + 1,
          delayMs: delay
        });
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      const fallbackResult = ensureMessageResult(lastOutcome?.value, fallback);
      traceWorker('runtime.sendMessage.fallback', {
        value: summarizeTraceValue(fallbackResult, 1)
      });
      return fallbackResult;
    };

    if (typeof callback === 'function') {
      runWithRetries()
        .then((value) => {
          try {
            callback(ensureMessageResult(value, fallback));
          } catch {}
        })
        .catch(() => {
          try {
            callback(ensureMessageResult(undefined, fallback));
          } catch {}
        });
      return;
    }

    return runWithRetries()
      .then((value) => ensureMessageResult(value, fallback))
      .catch(() => ensureMessageResult(undefined, fallback));
  };

  const ensureWindow = (windowId = 1, patch = {}) => {
    const numericWindowId = Number(windowId) || 1;
    const existing = windowState.get(numericWindowId) || {
      id: numericWindowId,
      focused: numericWindowId === 1,
      top: 0,
      left: 0,
      width: 1280,
      height: 900,
      type: 'normal',
      state: 'normal',
      incognito: false,
      alwaysOnTop: false,
      tabs: []
    };
    const next = {
      ...existing,
      ...patch,
      id: numericWindowId
    };
    if (!Array.isArray(next.tabs)) {
      next.tabs = [];
    }
    windowState.set(numericWindowId, next);
    return next;
  };

  const ensureTab = (tabId = 1, patch = {}) => {
    const numericTabId = Number(tabId) || 1;
    const existing = tabState.get(numericTabId) || {
      id: numericTabId,
      index: 0,
      windowId: 1,
      active: numericTabId === 1,
      highlighted: numericTabId === 1,
      selected: numericTabId === 1,
      status: 'complete',
      title: '',
      url: extensionOrigin + '/',
      incognito: false,
      pinned: false,
      discarded: false,
      autoDiscardable: false
    };
    const next = {
      ...existing,
      ...patch,
      id: numericTabId
    };
    tabState.set(numericTabId, next);
    return next;
  };

  const syncWindowTabs = (windowId) => {
    const win = ensureWindow(windowId);
    const tabs = Array.from(tabState.values())
      .filter((tab) => Number(tab.windowId) === Number(windowId))
      .sort((left, right) => (Number(left.index) || 0) - (Number(right.index) || 0))
      .map((tab) => cloneValue(tab));
    win.tabs = tabs;
    windowState.set(Number(windowId) || 1, win);
    return cloneValue(win);
  };

  ensureWindow(1, { focused: true, type: 'normal' });
  ensureTab(1, {
    windowId: 1,
    active: true,
    highlighted: true,
    selected: true,
    index: 0,
    status: 'complete',
    url: extensionOrigin + '/'
  });
  syncWindowTabs(1);

  const serializeStorageValue = (value) => {
    try {
      return JSON.stringify({ value });
    } catch {
      return JSON.stringify({ value: null });
    }
  };

  const deserializeStorageValue = (raw) => {
    if (typeof raw !== 'string' || !raw.length) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'value' in parsed) {
        return cloneValue(parsed.value);
      }
      return cloneValue(parsed);
    } catch {
      return undefined;
    }
  };

  const storageAreaPrefix = (areaName) => \`\${storageNamespacePrefix}\${areaName}/\`;
  const storageEntryKey = (areaName, key) => \`\${storageAreaPrefix(areaName)}\${key}\`;

  const readStorageRaw = (areaName, key) => {
    const entryKey = storageEntryKey(areaName, key);
    return storageMemory.has(entryKey) ? storageMemory.get(entryKey) : null;
  };

  const writeStorageRaw = (areaName, key, raw) => {
    storageMemory.set(storageEntryKey(areaName, key), raw);
  };

  const removeStorageRaw = (areaName, key) => {
    storageMemory.delete(storageEntryKey(areaName, key));
  };

  const readStorageAreaSnapshot = (areaName) => {
    const prefix = storageAreaPrefix(areaName);
    const out = {};
    for (const [entryKey, raw] of storageMemory.entries()) {
      if (!entryKey.startsWith(prefix)) continue;
      const name = entryKey.slice(prefix.length);
      const value = deserializeStorageValue(raw);
      if (value !== undefined) out[name] = value;
    }
    return out;
  };

  const selectStorageValues = (snapshot, keys) => {
    if (keys == null) return cloneValue(snapshot) || {};
    if (typeof keys === 'string') {
      return Object.prototype.hasOwnProperty.call(snapshot, keys)
        ? { [keys]: cloneValue(snapshot[keys]) }
        : {};
    }
    if (Array.isArray(keys)) {
      const selected = {};
      for (const key of keys) {
        const normalizedKey = String(key);
        if (Object.prototype.hasOwnProperty.call(snapshot, normalizedKey)) {
          selected[normalizedKey] = cloneValue(snapshot[normalizedKey]);
        }
      }
      return selected;
    }
    if (keys && typeof keys === 'object') {
      const selected = {};
      for (const [key, fallbackValue] of Object.entries(keys)) {
        selected[key] = Object.prototype.hasOwnProperty.call(snapshot, key)
          ? cloneValue(snapshot[key])
          : cloneValue(fallbackValue);
      }
      return selected;
    }
    return {};
  };

  const dispatchStorageChanges = (changes, areaName) => {
    if (!changes || !Object.keys(changes).length) return;
    Promise.resolve().then(() => {
      try {
        storageEvents.onChanged.dispatch(changes, areaName);
      } catch {}
    });
  };

  const createStorageArea = (areaName) => ({
    get(keys, callback) {
      return asyncResult(selectStorageValues(readStorageAreaSnapshot(areaName), keys), callback);
    },
    set(items, callback) {
      const changes = {};
      const entries =
        items && typeof items === 'object' && !Array.isArray(items)
          ? Object.entries(items)
          : [];

      for (const [key, value] of entries) {
        const previousRaw = readStorageRaw(areaName, key);
        const nextRaw = serializeStorageValue(value);
        if (previousRaw === nextRaw) continue;
        writeStorageRaw(areaName, key, nextRaw);
        changes[key] = {
          oldValue: deserializeStorageValue(previousRaw),
          newValue: cloneValue(value)
        };
      }

      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    remove(keys, callback) {
      const keyList = Array.isArray(keys) ? keys.map((key) => String(key)) : [String(keys)];
      const changes = {};

      for (const key of keyList) {
        const previousRaw = readStorageRaw(areaName, key);
        if (previousRaw == null) continue;
        removeStorageRaw(areaName, key);
        changes[key] = {
          oldValue: deserializeStorageValue(previousRaw),
          newValue: undefined
        };
      }

      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    clear(callback) {
      const snapshot = readStorageAreaSnapshot(areaName);
      const changes = {};

      for (const key of Object.keys(snapshot)) {
        removeStorageRaw(areaName, key);
        changes[key] = {
          oldValue: cloneValue(snapshot[key]),
          newValue: undefined
        };
      }

      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    getBytesInUse(keys, callback) {
      let bytes = 0;
      try {
        bytes = new TextEncoder().encode(
          JSON.stringify(selectStorageValues(readStorageAreaSnapshot(areaName), keys))
        ).length;
      } catch {}
      return asyncResult(bytes, callback);
    }
  });

  const alarms = new Map();

  const alarmsApi = {
    create(nameOrInfo, alarmInfo) {
      const hasName = typeof nameOrInfo === 'string';
      const name = hasName ? safeString(nameOrInfo, 256) : '';
      const info = hasName ? alarmInfo : nameOrInfo;
      alarms.set(name || '__default__', {
        name: name || '__default__',
        scheduledTime: Date.now(),
        periodInMinutes: Number(info?.periodInMinutes || 0) || undefined
      });
    },
    get(name, callback) {
      return asyncResult(alarms.get(safeString(name, 256) || '__default__') || null, callback);
    },
    getAll(callback) {
      return asyncResult(Array.from(alarms.values()), callback);
    },
    clear(name, callback) {
      const key = safeString(name, 256) || '__default__';
      const removed = alarms.delete(key);
      return asyncResult(removed, callback);
    },
    clearAll(callback) {
      const hadAny = alarms.size > 0;
      alarms.clear();
      return asyncResult(hadAny, callback);
    },
    onAlarm: alarmsEvents.onAlarm
  };

  const idleApi = {
    queryState(_detectionIntervalInSeconds, callback) {
      return asyncResult('active', callback);
    },
    setDetectionInterval(_intervalInSeconds, callback) {
      return asyncResult(undefined, callback);
    },
    onStateChanged: idleEvents.onStateChanged
  };

  const notificationsApi = {
    create(notificationIdOrOptions, optionsOrCallback, maybeCallback) {
      const callback =
        typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      const notificationId =
        typeof notificationIdOrOptions === 'string'
          ? safeString(notificationIdOrOptions, 256)
          : \`lumen-notification-\${Date.now()}\`;
      return asyncResult(notificationId, callback);
    },
    update(_notificationId, _options, callback) {
      return asyncResult(true, callback);
    },
    clear(_notificationId, callback) {
      return asyncResult(true, callback);
    },
    getAll(callback) {
      return asyncResult({}, callback);
    },
    getPermissionLevel(callback) {
      return asyncResult('granted', callback);
    },
    onClicked: notificationsEvents.onClicked,
    onButtonClicked: notificationsEvents.onButtonClicked,
    onClosed: notificationsEvents.onClosed,
    onShown: notificationsEvents.onShown,
    onPermissionLevelChanged: notificationsEvents.onPermissionLevelChanged
  };

  const identityApi = {
    getRedirectURL(path = '') {
      let normalized = safeString(path, 4096);
      while (normalized.startsWith('/')) {
        normalized = normalized.slice(1);
      }
      return normalized ? \`\${extensionOrigin}/\${normalized}\` : \`\${extensionOrigin}/\`;
    },
    launchWebAuthFlow(_details, callback) {
      return asyncResult('', callback);
    },
    getAuthToken(detailsOrCallback, maybeCallback) {
      const callback =
        typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
      return asyncResult('', callback);
    },
    removeCachedAuthToken(_details, callback) {
      return asyncResult(undefined, callback);
    },
    clearAllCachedAuthTokens(callback) {
      return asyncResult(undefined, callback);
    },
    onSignInChanged: identityEvents.onSignInChanged
  };

  const sidePanelApi = {
    open(options, callback) {
      return asyncResult(undefined, callback || options);
    },
    setPanelBehavior(behavior, callback) {
      return asyncResult(undefined, callback || behavior);
    }
  };

  const scriptingApi = {
    executeScript(_injection, callback) {
      return asyncResult([], callback);
    },
    getRegisteredContentScripts(callback) {
      return asyncResult([], callback);
    },
    registerContentScripts(_scripts, callback) {
      return asyncResult(undefined, callback);
    },
    updateContentScripts(_scripts, callback) {
      return asyncResult(undefined, callback);
    },
    unregisterContentScripts(_filter, callback) {
      return asyncResult(undefined, callback);
    }
  };

  const webNavigationApi = {
    getFrame(detailsOrCallback, maybeCallback) {
      const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
      return asyncResult(
        {
          errorOccurred: false,
          frameId: 0,
          parentFrameId: -1,
          tabId: -1,
          url: href
        },
        callback
      );
    },
    getAllFrames(detailsOrCallback, maybeCallback) {
      const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
      return asyncResult(
        [
          {
            errorOccurred: false,
            frameId: 0,
            parentFrameId: -1,
            processId: -1,
            url: href
          }
        ],
        callback
      );
    },
    onBeforeNavigate: webNavigationEvents.onBeforeNavigate,
    onCommitted: webNavigationEvents.onCommitted,
    onCompleted: webNavigationEvents.onCompleted,
    onDOMContentLoaded: webNavigationEvents.onDOMContentLoaded,
    onCreatedNavigationTarget: webNavigationEvents.onCreatedNavigationTarget,
    onHistoryStateUpdated: webNavigationEvents.onHistoryStateUpdated,
    onReferenceFragmentUpdated: webNavigationEvents.onReferenceFragmentUpdated,
    onErrorOccurred: webNavigationEvents.onErrorOccurred
  };

  const nativeChromeNamespace =
    root.chrome && typeof root.chrome === 'object' ? root.chrome : null;
  const nativeChromeRuntime =
    nativeChromeNamespace &&
    nativeChromeNamespace.runtime &&
    typeof nativeChromeNamespace.runtime === 'object'
      ? nativeChromeNamespace.runtime
      : null;

  const nativeEventListenerWrappers = new WeakMap();

  const instrumentNativePort = (label, port) => {
    if (!port || typeof port !== 'object' || port.__lumenTraceWrapped === true) {
      return port;
    }

    try {
      Object.defineProperty(port, '__lumenTraceWrapped', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: true
      });
    } catch {}

    try {
      if (typeof port.postMessage === 'function') {
        const originalPostMessage = port.postMessage.bind(port);
        port.postMessage = (message, ...rest) => {
          traceWorker('native.port.postMessage', {
            label,
            message: summarizeTraceValue(message, 1)
          });
          return originalPostMessage(message, ...rest);
        };
      }
    } catch (error) {
      traceWorker('native.port.wrap-failed', {
        label,
        method: 'postMessage',
        error: summarizeTraceValue(error)
      });
    }

    try {
      if (typeof port.disconnect === 'function') {
        const originalDisconnect = port.disconnect.bind(port);
        port.disconnect = (...args) => {
          traceWorker('native.port.disconnect', { label });
          return originalDisconnect(...args);
        };
      }
    } catch (error) {
      traceWorker('native.port.wrap-failed', {
        label,
        method: 'disconnect',
        error: summarizeTraceValue(error)
      });
    }

    wrapNativeEventMethods(label + '.onMessage', port.onMessage);
    wrapNativeEventMethods(label + '.onDisconnect', port.onDisconnect);

    traceWorker('native.port.instrumented', {
      label,
      port: summarizeTraceValue(port, 1)
    });
    return port;
  };

  const wrapNativeEventMethods = (label, nativeEvent) => {
    if (!nativeEvent || typeof nativeEvent.addListener !== 'function') return;
    if (nativeEvent.__lumenTraceWrapped === true) return;
    const runtimeBridgeMirror =
      label === 'runtime.onMessage'
        ? runtimeBridgeMirrors.onMessage
        : label === 'runtime.onMessageExternal'
          ? runtimeBridgeMirrors.onMessageExternal
          : null;

    try {
      Object.defineProperty(nativeEvent, '__lumenTraceWrapped', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: true
      });
    } catch {}

    try {
      const originalAdd = nativeEvent.addListener.bind(nativeEvent);
      nativeEvent.addListener = (listener, ...rest) => {
        let wrappedListener = listener;
        if (typeof listener === 'function') {
          wrappedListener = nativeEventListenerWrappers.get(listener);
          if (!wrappedListener) {
            wrappedListener = (...rawArgs) => {
              const args = Array.from(rawArgs);
              if (
                args.length > 0 &&
                (label.includes('runtime.onConnect') || label.includes('.onConnect'))
              ) {
                args[0] = instrumentNativePort(label + '.port', args[0]);
              }
              const isRuntimeMessageEvent =
                args.length >= 3 &&
                label.includes('runtime.onMessage') &&
                typeof args[2] === 'function';
              let messageResponseSent = false;
              let messageSendResponse = null;
              if (isRuntimeMessageEvent) {
                const nativeSendResponse = args[2];
                messageSendResponse = (value) => {
                  const responseValue = ensureMessageResult(value);
                  messageResponseSent = true;
                  traceWorker('native-event.sendResponse', {
                    label,
                    value: summarizeTraceValue(responseValue, 1)
                  });
                  return nativeSendResponse(responseValue);
                };
                args[2] = messageSendResponse;
              }

              traceWorker('native-event.actual-call', {
                label,
                listener: String(listener?.name || 'anonymous'),
                args: summarizeTraceValue(args, 1)
              });

              try {
                const result = listener(...args);
                if (result && typeof result.then === 'function') {
                  if (isRuntimeMessageEvent) {
                    result.then(
                      (value) => {
                        traceWorker('native-event.actual-result', {
                          label,
                          mode: 'promise',
                          value: summarizeTraceValue(value, 1)
                        });
                        if (!messageResponseSent && value !== undefined) {
                          try {
                            messageSendResponse?.(value);
                          } catch {}
                        }
                      },
                      (error) => {
                        traceWorker('native-event.actual-throw', {
                          label,
                          error: summarizeTraceValue(error)
                        });
                        if (!messageResponseSent) {
                          try {
                            messageSendResponse?.({
                              error: safeString(
                                error?.message || error || 'runtime_onMessage_failed',
                                2048
                              )
                            });
                          } catch {}
                        }
                      }
                    );
                    return true;
                  }
                  return result.then(
                    (value) => {
                      traceWorker('native-event.actual-result', {
                        label,
                        mode: 'promise',
                        value: summarizeTraceValue(value, 1)
                      });
                      return value;
                    },
                    (error) => {
                      traceWorker('native-event.actual-throw', {
                        label,
                        error: summarizeTraceValue(error)
                      });
                      throw error;
                    }
                  );
                }
                traceWorker('native-event.actual-result', {
                  label,
                  mode: 'return',
                  value: summarizeTraceValue(result, 1)
                });
                if (isRuntimeMessageEvent) {
                  if (result === true || messageResponseSent) {
                    return true;
                  }
                  if (result !== undefined) {
                    try {
                      messageSendResponse?.(result);
                    } catch {}
                    return true;
                  }
                }
                return result;
              } catch (error) {
                traceWorker('native-event.actual-throw', {
                  label,
                  error: summarizeTraceValue(error)
                });
                if (isRuntimeMessageEvent && !messageResponseSent) {
                  try {
                    messageSendResponse?.({
                      error: safeString(error?.message || error || 'runtime_onMessage_failed', 2048)
                    });
                    return true;
                  } catch {}
                }
                throw error;
              }
            };
            nativeEventListenerWrappers.set(listener, wrappedListener);
          }
        }

        traceWorker('native-event.actual-add', {
          label,
          listener: String(listener?.name || 'anonymous')
        });
        if (
          runtimeBridgeMirror &&
          typeof wrappedListener === 'function' &&
          listener?.__lumenSkipRuntimeBridgeMirror !== true
        ) {
          runtimeBridgeMirror.add(wrappedListener);
        }
        return originalAdd(wrappedListener, ...rest);
      };
    } catch (error) {
      traceWorker('native-event.wrap-failed', {
        label,
        method: 'addListener',
        error: summarizeTraceValue(error)
      });
    }

    try {
      if (typeof nativeEvent.removeListener === 'function') {
        const originalRemove = nativeEvent.removeListener.bind(nativeEvent);
        nativeEvent.removeListener = (listener, ...rest) => {
          const wrappedListener =
            (typeof listener === 'function' && nativeEventListenerWrappers.get(listener)) ||
            listener;
          traceWorker('native-event.actual-remove', {
            label,
            listener: String(listener?.name || 'anonymous')
          });
          if (runtimeBridgeMirror && typeof wrappedListener === 'function') {
            runtimeBridgeMirror.delete(wrappedListener);
          }
          return originalRemove(wrappedListener, ...rest);
        };
      }
    } catch (error) {
      traceWorker('native-event.wrap-failed', {
        label,
        method: 'removeListener',
        error: summarizeTraceValue(error)
      });
    }
  };

  const patchNativeChromeRuntime = () => {
    if (!nativeChromeRuntime || nativeChromeRuntime.__lumenRuntimeTraceWrapped === true) {
      return;
    }

    try {
      Object.defineProperty(nativeChromeRuntime, '__lumenRuntimeTraceWrapped', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: true
      });
    } catch {}

    try {
      const originalSendMessage = (
        typeof nativeChromeRuntime.sendMessage === 'function'
          ? nativeChromeRuntime.sendMessage.bind(nativeChromeRuntime)
          : null
      );
      if (originalSendMessage) {
        nativeChromeRuntime.sendMessage = (...rawArgs) => {
          const args = Array.from(rawArgs);
          const callback =
            typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
          traceWorker('native.runtime.sendMessage.called', {
            args: summarizeTraceValue(args, 1),
            hasCallback: typeof callback === 'function'
          });
          return callNativeRuntimeSendMessage(
            originalSendMessage,
            nativeChromeRuntime,
            args,
            callback,
            () => ({})
          );
        };
      }
    } catch (error) {
      traceWorker('native.runtime.patch-failed', {
        method: 'sendMessage',
        error: summarizeTraceValue(error)
      });
    }

    try {
      const originalConnect = (
        typeof nativeChromeRuntime.connect === 'function'
          ? nativeChromeRuntime.connect.bind(nativeChromeRuntime)
          : null
      );
      if (originalConnect) {
        nativeChromeRuntime.connect = (...args) => {
          traceWorker('native.runtime.connect.called', {
            args: summarizeTraceValue(args, 1)
          });
          return instrumentNativePort('runtime.connect', originalConnect(...args));
        };
      }
    } catch (error) {
      traceWorker('native.runtime.patch-failed', {
        method: 'connect',
        error: summarizeTraceValue(error)
      });
    }

    wrapNativeEventMethods('runtime.onMessage', nativeChromeRuntime.onMessage);
    wrapNativeEventMethods('runtime.onMessageExternal', nativeChromeRuntime.onMessageExternal);
    wrapNativeEventMethods('runtime.onConnect', nativeChromeRuntime.onConnect);
    wrapNativeEventMethods('runtime.onConnectExternal', nativeChromeRuntime.onConnectExternal);

    traceWorker('native.runtime.patched', {
      hasSendMessage: typeof nativeChromeRuntime.sendMessage === 'function',
      hasConnect: typeof nativeChromeRuntime.connect === 'function'
    });
  };

  patchNativeChromeRuntime();

  traceWorker('bootstrap', {
    hasNativeChrome: !!nativeChromeNamespace,
    hasNativeRuntime: !!nativeChromeRuntime
  });

  try {
    root.addEventListener?.('error', (event) => {
      traceWorker('worker.error', {
        message: String(event?.message || ''),
        filename: String(event?.filename || ''),
        lineno: Number(event?.lineno || 0) || 0,
        colno: Number(event?.colno || 0) || 0
      });
    });
  } catch {}

  try {
    root.addEventListener?.('unhandledrejection', (event) => {
      traceWorker('worker.unhandledrejection', {
        reason: summarizeTraceValue(event?.reason)
      });
    });
  } catch {}

  try {
    if (typeof nativeChromeRuntime?.onMessage?.addListener === 'function') {
      const runtimeTraceDrainListener = (message, sender, sendResponse) => {
        if (!message || typeof message !== 'object' || message.__lumenTrace !== 'drain') {
          const isExternalMessage =
            typeof sender?.id === 'string' && sender.id && sender.id !== runtimeId;
          const target = isExternalMessage
            ? runtimeEvents.onMessageExternal
            : runtimeEvents.onMessage;
          if (!target?.hasListeners?.()) {
            return undefined;
          }

          Promise.resolve(callRuntimeMessageListeners(target, message, sender))
            .then((result) => {
              if (!result?.handled) return;
              try {
                sendResponse(ensureMessageResult(result.value));
              } catch {}
            })
            .catch((error) => {
              try {
                sendResponse({
                  error: safeString(error?.message || error || 'runtime_onMessage_failed', 2048)
                });
              } catch {}
            });

          return true;
        }
        try {
          sendResponse({
            ok: true,
            entries: drainTraceBuffer()
          });
        } catch {}
        return true;
      };
      try {
        Object.defineProperty(runtimeTraceDrainListener, '__lumenSkipRuntimeBridgeMirror', {
          configurable: true,
          enumerable: false,
          value: true
        });
      } catch {}
      nativeChromeRuntime.onMessage.addListener(runtimeTraceDrainListener);
      traceWorker('trace.drain.installed', { via: 'nativeChromeRuntime.onMessage' });
    }
  } catch (error) {
    traceWorker('trace.drain.install.failed', {
      error: summarizeTraceValue(error)
    });
  }

  const runtimeApi = {
    id: safeString(nativeChromeRuntime?.id, 128) || runtimeId,
    get lastError() {
      return nativeChromeRuntime?.lastError || null;
    },
    getURL(path = '') {
      if (typeof nativeChromeRuntime?.getURL === 'function') {
        try {
          return nativeChromeRuntime.getURL(path);
        } catch {}
      }
      let normalized = safeString(path, 4096);
      while (normalized.startsWith('/')) {
        normalized = normalized.slice(1);
      }
      return normalized ? \`\${extensionOrigin}/\${normalized}\` : \`\${extensionOrigin}/\`;
    },
    getManifest() {
      if (typeof nativeChromeRuntime?.getManifest === 'function') {
        try {
          return nativeChromeRuntime.getManifest();
        } catch {}
      }
      try {
        const manifestResponse = new XMLHttpRequest();
        manifestResponse.open('GET', \`\${extensionOrigin}/manifest.json\`, false);
        manifestResponse.send(null);
        if (
          manifestResponse.status >= 200 &&
          manifestResponse.status < 400 &&
          manifestResponse.responseText
        ) {
          return JSON.parse(manifestResponse.responseText);
        }
      } catch {}
      return {};
    },
    getBrowserInfo(callback) {
      return callNativeAsync(
        nativeChromeRuntime?.getBrowserInfo,
        nativeChromeRuntime,
        [],
        callback,
        () => ({
          name: 'Lumen',
          vendor: 'Lumen',
          version: '1.0.0',
          buildID: 'lumen'
        })
      );
    },
    openOptionsPage(callback) {
      return callNativeAsync(
        nativeChromeRuntime?.openOptionsPage,
        nativeChromeRuntime,
        [],
        callback,
        () => undefined
      );
    },
    sendMessage(extensionIdOrMessage, messageOrOptions, optionsOrCallback, maybeCallback) {
      let args = [];
      let callback = maybeCallback;

      if (typeof extensionIdOrMessage === 'string' && arguments.length >= 2) {
        args = [extensionIdOrMessage, messageOrOptions];
        callback =
          typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        if (
          optionsOrCallback &&
          typeof optionsOrCallback === 'object' &&
          typeof optionsOrCallback !== 'function'
        ) {
          args.push(optionsOrCallback);
        }
      } else {
        args = [extensionIdOrMessage];
        if (
          messageOrOptions &&
          typeof messageOrOptions === 'object' &&
          typeof messageOrOptions !== 'function'
        ) {
          args.push(messageOrOptions);
        }
        if (typeof messageOrOptions === 'function') {
          callback = messageOrOptions;
      } else if (typeof optionsOrCallback === 'function') {
          callback = optionsOrCallback;
        }
      }

      traceWorker('runtime.sendMessage.called', {
        argCount: args.length,
        args: summarizeTraceValue(args, 1)
      });
      const promise = callNativeRuntimeSendMessage(
        nativeChromeRuntime?.sendMessage,
        nativeChromeRuntime,
        args,
        callback,
        () => ({})
      );
      if (typeof callback === 'function' && promise && typeof promise.then !== 'function') {
        return Promise.resolve(promise);
      }
      return promise;
    },
    connect(extensionIdOrConnectInfo, connectInfo) {
      traceWorker('runtime.connect.called', {
        extensionIdOrConnectInfo: summarizeTraceValue(extensionIdOrConnectInfo, 1),
        connectInfo: summarizeTraceValue(connectInfo, 1)
      });
      if (typeof nativeChromeRuntime?.connect === 'function') {
        try {
          if (
            extensionIdOrConnectInfo &&
            typeof extensionIdOrConnectInfo === 'object' &&
            !Array.isArray(extensionIdOrConnectInfo)
          ) {
            return nativeChromeRuntime.connect(extensionIdOrConnectInfo);
          }
          if (typeof extensionIdOrConnectInfo === 'string') {
            return nativeChromeRuntime.connect(extensionIdOrConnectInfo, connectInfo);
          }
          return nativeChromeRuntime.connect();
        } catch {}
      }
      return {
        name: safeString(connectInfo?.name || extensionIdOrConnectInfo?.name, 256),
        disconnect() {},
        postMessage() {},
        onMessage: createEventTarget('runtime.connect.fallback.onMessage'),
        onDisconnect: createEventTarget('runtime.connect.fallback.onDisconnect')
      };
    },
    onMessage: runtimeEvents.onMessage,
    onMessageExternal: runtimeEvents.onMessageExternal,
    onConnect: getNativeEventTarget(
      'runtime.onConnect',
      nativeChromeRuntime?.onConnect,
      runtimeEvents.onConnect
    ),
    onConnectExternal: getNativeEventTarget(
      'runtime.onConnectExternal',
      nativeChromeRuntime?.onConnectExternal,
      runtimeEvents.onConnectExternal
    ),
    onInstalled: getNativeEventTarget(
      'runtime.onInstalled',
      nativeChromeRuntime?.onInstalled,
      runtimeEvents.onInstalled
    ),
    onStartup: getNativeEventTarget(
      'runtime.onStartup',
      nativeChromeRuntime?.onStartup,
      runtimeEvents.onStartup
    ),
    onSuspend: getNativeEventTarget(
      'runtime.onSuspend',
      nativeChromeRuntime?.onSuspend,
      runtimeEvents.onSuspend
    ),
    onSuspendCanceled: getNativeEventTarget(
      'runtime.onSuspendCanceled',
      nativeChromeRuntime?.onSuspendCanceled,
      runtimeEvents.onSuspendCanceled
    ),
    onUpdateAvailable: getNativeEventTarget(
      'runtime.onUpdateAvailable',
      nativeChromeRuntime?.onUpdateAvailable,
      runtimeEvents.onUpdateAvailable
    )
  };

  const windowsApi = {
    getCurrent(getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      return asyncResult(syncWindowTabs(1), callback);
    },
    get(windowId, getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      return asyncResult(syncWindowTabs(windowId), callback);
    },
    getAll(getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      const allWindows = Array.from(windowState.keys())
        .sort((left, right) => left - right)
        .map((windowId) => syncWindowTabs(windowId));
      return asyncResult(allWindows, callback);
    },
    create(createData = {}, callback) {
      const windowId = nextWindowId++;
      const tabId = nextTabId++;
      const win = ensureWindow(windowId, {
        focused: createData.focused !== false,
        top: Number(createData.top) || 0,
        left: Number(createData.left) || 0,
        width: Number(createData.width) || 480,
        height: Number(createData.height) || 640,
        type: safeString(createData.type, 64) || 'popup',
        state: safeString(createData.state, 32) || 'normal'
      });
      const tab = ensureTab(tabId, {
        windowId,
        active: true,
        highlighted: true,
        selected: true,
        index: 0,
        status: 'complete',
        url: safeString(createData.url, 4096) || extensionOrigin + '/'
      });
      const snapshot = syncWindowTabs(windowId);
      Promise.resolve().then(() => {
        try {
          windowEvents.onCreated.dispatch(snapshot);
          tabsEvents.onCreated.dispatch(cloneValue(tab));
          tabsEvents.onUpdated.dispatch(tabId, { status: 'complete', url: tab.url }, cloneValue(tab));
          if (win.focused) {
            windowEvents.onFocusChanged.dispatch(windowId);
          }
        } catch {}
      });
      return asyncResult(snapshot, callback);
    },
    update(windowId, updateInfo = {}, callback) {
      const id = Number(windowId) || 1;
      const current = ensureWindow(id);
      ensureWindow(id, {
        focused: updateInfo.focused !== undefined ? !!updateInfo.focused : current.focused,
        top: updateInfo.top !== undefined ? Number(updateInfo.top) || 0 : current.top,
        left: updateInfo.left !== undefined ? Number(updateInfo.left) || 0 : current.left,
        width: updateInfo.width !== undefined ? Number(updateInfo.width) || 0 : current.width,
        height: updateInfo.height !== undefined ? Number(updateInfo.height) || 0 : current.height,
        state: safeString(updateInfo.state, 32) || current.state
      });
      const snapshot = syncWindowTabs(id);
      Promise.resolve().then(() => {
        try {
          if (updateInfo.focused) {
            windowEvents.onFocusChanged.dispatch(id);
          }
        } catch {}
      });
      return asyncResult(snapshot, callback);
    },
    remove(windowId, callback) {
      const id = Number(windowId) || 1;
      const removedTabs = Array.from(tabState.values())
        .filter((tab) => Number(tab.windowId) === id)
        .map((tab) => tab.id);
      for (const tabId of removedTabs) {
        tabState.delete(tabId);
      }
      windowState.delete(id);
      Promise.resolve().then(() => {
        try {
          for (const tabId of removedTabs) {
            tabsEvents.onRemoved.dispatch(tabId, { windowId: id, isWindowClosing: true });
          }
          windowEvents.onRemoved.dispatch(id);
        } catch {}
      });
      return asyncResult(undefined, callback);
    },
    onCreated: windowEvents.onCreated,
    onRemoved: windowEvents.onRemoved,
    onFocusChanged: windowEvents.onFocusChanged
  };

  const tabsApi = {
    get(tabId, callback) {
      return asyncResult(cloneValue(ensureTab(tabId)), callback);
    },
    create(createProperties = {}, callback) {
      const tabId = nextTabId++;
      const windowId = Number(createProperties.windowId) || 1;
      ensureWindow(windowId);
      const currentTabs = Array.from(tabState.values()).filter(
        (tab) => Number(tab.windowId) === windowId
      );
      const tab = ensureTab(tabId, {
        windowId,
        index: Number.isFinite(Number(createProperties.index))
          ? Number(createProperties.index)
          : currentTabs.length,
        active: createProperties.active !== false,
        highlighted: createProperties.active !== false,
        selected: createProperties.active !== false,
        status: 'complete',
        url: safeString(createProperties.url, 4096) || extensionOrigin + '/'
      });
      syncWindowTabs(windowId);
      Promise.resolve().then(() => {
        try {
          tabsEvents.onCreated.dispatch(cloneValue(tab));
        } catch {}
      });
      return asyncResult(cloneValue(tab), callback);
    },
    update(tabId, updateProperties = {}, callback) {
      const id = Number(tabId) || 1;
      const current = ensureTab(id);
      const next = ensureTab(id, {
        url: safeString(updateProperties.url, 4096) || current.url,
        active:
          updateProperties.active !== undefined ? !!updateProperties.active : current.active,
        highlighted:
          updateProperties.active !== undefined
            ? !!updateProperties.active
            : current.highlighted,
        selected:
          updateProperties.active !== undefined ? !!updateProperties.active : current.selected,
        status: safeString(updateProperties.status, 32) || current.status
      });
      syncWindowTabs(next.windowId || 1);
      Promise.resolve().then(() => {
        try {
          tabsEvents.onUpdated.dispatch(
            id,
            { status: next.status, url: next.url },
            cloneValue(next)
          );
          if (updateProperties.active !== undefined) {
            tabsEvents.onActivated.dispatch({
              tabId: id,
              windowId: next.windowId || 1
            });
          }
        } catch {}
      });
      return asyncResult(cloneValue(next), callback);
    },
    remove(tabIds, callback) {
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      const removed = ids.map((tabId) => Number(tabId) || 0).filter(Boolean);
      for (const id of removed) {
        const current = tabState.get(id);
        if (!current) continue;
        tabState.delete(id);
        syncWindowTabs(current.windowId || 1);
      }
      Promise.resolve().then(() => {
        try {
          for (const id of removed) {
            tabsEvents.onRemoved.dispatch(id, { windowId: 1, isWindowClosing: false });
          }
        } catch {}
      });
      return asyncResult(undefined, callback);
    },
    query(queryInfo = {}, callback) {
      let tabs = Array.from(tabState.values());
      if (queryInfo.currentWindow) {
        tabs = tabs.filter((tab) => Number(tab.windowId) === 1);
      }
      if (queryInfo.active !== undefined) {
        tabs = tabs.filter((tab) => !!tab.active === !!queryInfo.active);
      }
      if (queryInfo.windowId != null) {
        tabs = tabs.filter((tab) => Number(tab.windowId) === Number(queryInfo.windowId));
      }
      if (queryInfo.url) {
        const urlPattern = String(queryInfo.url);
        tabs = tabs.filter((tab) =>
          String(tab.url || '').includes(urlPattern.split('*').join(''))
        );
      }
      return asyncResult(tabs.map((tab) => cloneValue(tab)), callback);
    },
    sendMessage(_tabId, _message, optionsOrCallback, maybeCallback) {
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      return asyncResult({}, callback);
    },
    onCreated: tabsEvents.onCreated,
    onUpdated: tabsEvents.onUpdated,
    onRemoved: tabsEvents.onRemoved,
    onActivated: tabsEvents.onActivated,
    onReplaced: tabsEvents.onReplaced,
    onDetached: tabsEvents.onDetached,
    onAttached: tabsEvents.onAttached,
    onMoved: tabsEvents.onMoved,
    onHighlighted: tabsEvents.onHighlighted,
    onZoomChange: tabsEvents.onZoomChange
  };

  const shimNamespaces = {
    runtime: runtimeApi,
    windows: windowsApi,
    tabs: tabsApi,
    idle: idleApi,
    alarms: alarmsApi,
    notifications: notificationsApi,
    identity: identityApi,
    sidePanel: sidePanelApi,
    scripting: scriptingApi,
    webNavigation: webNavigationApi,
    storage: {
      local: createStorageArea('local'),
      sync: createStorageArea('sync'),
      session: createStorageArea('session'),
      onChanged: storageEvents.onChanged
    }
  };

  const applyNamespaceOverrides = (namespace) => {
    if (!namespace || typeof namespace !== 'object') return namespace;
    try {
      namespace.runtime = runtimeApi;
    } catch {}
    return namespace;
  };

  let chromeNamespace = installRootNamespace('chrome', shimNamespaces);
  applyNamespaceOverrides(chromeNamespace);
  let browserNamespace =
    root.browser && typeof root.browser === 'object'
      ? applyNamespaceOverrides(installRootNamespace('browser', shimNamespaces))
      : null;
  const ensureBrowserNamespace = () => {
    browserNamespace = applyNamespaceOverrides(installRootNamespace('browser', shimNamespaces));
    return browserNamespace;
  };
  const originalImportScripts =
    typeof root.importScripts === 'function' ? root.importScripts.bind(root) : null;

  if (originalImportScripts) {
    root.importScripts = (...urls) => {
      traceWorker('importScripts.called', {
        urls: summarizeTraceValue(urls)
      });
      const result = originalImportScripts(...urls);
      if (
        urls.some((url) => {
          const normalizedUrl = safeString(url, 4096).toLowerCase();
          return (
            normalizedUrl.includes('browser-polyfill.js') ||
            normalizedUrl.includes('browser-polyfill.min.js')
          );
        })
      ) {
        chromeNamespace = installRootNamespace('chrome', shimNamespaces);
        applyNamespaceOverrides(chromeNamespace);
        ensureBrowserNamespace();
        traceWorker('importScripts.browserPolyfill.loaded', {
          hasBrowserNamespace: !!browserNamespace
        });
      }
      traceWorker('importScripts.completed', {
        urlCount: urls.length
      });
      return result;
    };
  }

  try {
    const apiNamespaceForLog = browserNamespace || chromeNamespace;
    const readyPayload = {
      href,
      runtimeId,
      worker: ${JSON.stringify(normalizedWorkerPath)},
      hasWebNavigation:
        typeof apiNamespaceForLog?.webNavigation?.onBeforeNavigate?.addListener === 'function',
      hasWindows:
        typeof apiNamespaceForLog?.windows?.onCreated?.addListener === 'function',
      hasBrowserNamespace: !!browserNamespace
    };
    traceWorker('ready', readyPayload);
    if (${JSON.stringify(EXTENSION_DEBUG)}) {
      console.log(\`[lumen-managed-extension-background-shim] ready \${JSON.stringify(readyPayload)}\`);
    }
  } catch {}

  try {
    traceWorker('worker.import.start', {
      worker: ${JSON.stringify(normalizedWorkerPath)},
      workerType: ${JSON.stringify(safeString(workerType, 64) || 'classic')}
    });
    ${loadOriginalWorker}
    traceWorker('worker.import.success', {
      worker: ${JSON.stringify(normalizedWorkerPath)}
    });
  } catch (error) {
    try {
      traceWorker('worker.import.failed', {
        error: summarizeTraceValue(error)
      });
      console.error(
        \`[lumen-managed-extension-background-shim] worker import failed \${JSON.stringify(
          summarizeTraceValue(error)
        )}\`
      );
    } catch {}
    throw error;
  }
})();`;
}

function prepareManagedExtensionDirectory(dirPath) {
  const manifestInfo = readManifestFromDirectory(dirPath);
  const metadataPath = path.join(manifestInfo.path, LUMEN_PATCH_METADATA_FILE);
  const legacyMetadataPath = path.join(manifestInfo.path, LEGACY_LUMEN_PATCH_METADATA_FILE);
  const metadata = {
    ...readJson(legacyMetadataPath, {}),
    ...readJson(metadataPath, {})
  };
  const manifest = manifestInfo.manifest && typeof manifestInfo.manifest === 'object'
    ? JSON.parse(JSON.stringify(manifestInfo.manifest))
    : {};
  let manifestChanged = false;
  let metadataChanged = false;

  const background = manifest.background && typeof manifest.background === 'object'
    ? manifest.background
    : null;

  if (manifest.manifest_version === 3 && background) {
    let originalWorker = safeRelativeExtensionPath(metadata.originalServiceWorker);
    if (!originalWorker) {
      const currentWorker = safeRelativeExtensionPath(background.service_worker);
      if (currentWorker && !isManagedBackgroundShimFile(currentWorker)) {
        originalWorker = currentWorker;
      } else if (currentWorker) {
        originalWorker = detectOriginalServiceWorkerFromShim(manifestInfo.path, currentWorker);
      }
    }

    if (originalWorker) {
      const originalWorkerPath = path.join(manifestInfo.path, originalWorker);
      if (fs.existsSync(originalWorkerPath)) {
        if (metadata.originalServiceWorker !== originalWorker) {
          metadata.originalServiceWorker = originalWorker;
          metadataChanged = true;
        }

        const isModuleWorker = safeString(background.type, 64) === 'module';
        let activeShimFileName = '';

        if (isModuleWorker) {
          if (background.service_worker !== originalWorker) {
            background.service_worker = originalWorker;
            manifestChanged = true;
          }

          if (metadata.backgroundShimFile) {
            delete metadata.backgroundShimFile;
            metadataChanged = true;
          }
        } else {
          const shimSource = buildExtensionBackgroundShimSource(originalWorker, background.type);
          const shimFileName = buildManagedBackgroundShimFileName(shimSource);
          const shimFilePath = path.join(manifestInfo.path, shimFileName);
          const currentShimSource = fs.existsSync(shimFilePath)
            ? fs.readFileSync(shimFilePath, 'utf8')
            : '';
          if (currentShimSource !== shimSource) {
            fs.writeFileSync(shimFilePath, shimSource, 'utf8');
          }

          if (background.service_worker !== shimFileName) {
            background.service_worker = shimFileName;
            manifestChanged = true;
          }

          if (metadata.backgroundShimFile !== shimFileName) {
            metadata.backgroundShimFile = shimFileName;
            metadataChanged = true;
          }

          activeShimFileName = shimFileName;
        }

        try {
          for (const entry of fs.readdirSync(manifestInfo.path, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            if (!isManagedBackgroundShimFile(entry.name)) continue;
            if (activeShimFileName && entry.name === activeShimFileName) continue;
            if (entry.name === LEGACY_LUMEN_BACKGROUND_SHIM_FILE) continue;
            fs.rmSync(path.join(manifestInfo.path, entry.name), { force: true });
          }
        } catch {}
      }
    }
  }

  if (manifestChanged) {
    fs.writeFileSync(manifestInfo.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  if (metadataChanged) {
    writeJson(metadataPath, {
      ...metadata,
      patchedAt: new Date().toISOString()
    });
  }

  for (const legacyFile of [LEGACY_LUMEN_BACKGROUND_SHIM_FILE, LEGACY_LUMEN_PATCH_METADATA_FILE]) {
    const legacyPath = path.join(manifestInfo.path, legacyFile);
    try {
      if (fs.existsSync(legacyPath)) {
        fs.rmSync(legacyPath, { force: true });
      }
    } catch {}
  }

  return readManifestFromDirectory(manifestInfo.path);
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

  async clearExtensionRuntimeData(runtimeId) {
    const id = safeString(runtimeId, 128);
    if (!id) return;
    try {
      await this.getSession().clearStorageData({
        origin: `chrome-extension://${id}`,
        storages: ['serviceworkers', 'cachestorage', 'indexdb', 'localstorage']
      });
    } catch {}
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
      await this.clearExtensionRuntimeData(loadedRuntime.id);
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
      const preparedManifest = prepareManagedExtensionDirectory(targetPath);
      const runtime = this.findLoadedRuntime(current);
      if (runtime) {
        try {
          this.getSessionExtensions().removeExtension(runtime.id);
        } catch {}
        await this.clearExtensionRuntimeData(runtime.id);
      } else if (current.runtimeId) {
        await this.clearExtensionRuntimeData(current.runtimeId);
      }

      try {
        console.log('[extensions] prepared managed extension', {
          id: current.id,
          runtimeId: current.runtimeId,
          path: targetPath,
          serviceWorker: safeString(preparedManifest?.manifest?.background?.service_worker, 512),
          popupPath: safeString(preparedManifest?.manifest?.action?.default_popup, 512)
        });
      } catch {}

      const loaded = await this.getSessionExtensions().loadExtension(targetPath, {
        allowFileAccess: false
      });
      const manifestInfo = preparedManifest || readManifestFromDirectory(targetPath);
      try {
        console.log('[extensions] loaded managed extension', {
          id: current.id,
          runtimeId: safeString(loaded?.id, 128) || current.runtimeId,
          path: getRealPath(loaded?.path) || targetPath,
          serviceWorker: safeString(manifestInfo?.manifest?.background?.service_worker, 512),
          popupPath: safeString(manifestInfo?.manifest?.action?.default_popup, 512)
        });
      } catch {}
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
    const copiedManifest = prepareManagedExtensionDirectory(managedPath);
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
    const confirmed = await confirmExtensionInstall(owner, {
      extensionId,
      manifestInfo,
      sourceLabel: 'Local unpacked folder',
      installSource: sourcePath
    });
    if (!confirmed) {
      return { ok: false, canceled: true, error: 'install_canceled' };
    }

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

  async installFromChromeWebStore(input, browserWindow = null) {
    let extensionId = '';
    try {
      extensionId = extractChromeWebStoreId(input);
    } catch (error) {
      return { ok: false, error: safeString(error?.message || error || 'invalid_chrome_web_store_id', 2048) };
    }

    const targetDir = this.getManagedExtensionPath(extensionId);
    const owner =
      browserWindow && typeof browserWindow.isDestroyed === 'function' && !browserWindow.isDestroyed()
        ? browserWindow
        : null;
    try {
      const archive = await downloadCrxArchive(extensionId);
      const manifestInfo = await inspectManifestFromCrxBuffer(extensionId, archive.buffer);
      const confirmed = await confirmExtensionInstall(owner, {
        extensionId,
        manifestInfo,
        sourceLabel: 'Chrome Web Store package',
        installSource: archive.url
      });
      if (!confirmed) {
        return { ok: false, canceled: true, error: 'install_canceled' };
      }
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
  extensionManager,
  prepareManagedExtensionDirectory
};
