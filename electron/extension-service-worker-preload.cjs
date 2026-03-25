function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function currentHref() {
  try {
    return String(globalThis.location?.href || '');
  } catch {
    return '';
  }
}

function getUrlOrigin(input, fallback = '') {
  const raw = safeString(input, 4096);
  if (!raw) return safeString(fallback, 4096);
  try {
    const url = new URL(raw);
    const origin = safeString(url.origin, 4096);
    if (origin && origin !== 'null') return origin;
    const protocol = safeString(url.protocol, 64);
    const host = safeString(url.host, 512);
    if (protocol && host) return `${protocol}//${host}`;
  } catch {}
  return safeString(fallback, 4096);
}

function isExtensionServiceWorker() {
  return /^chrome-extension:\/\//i.test(safeString(currentHref(), 4096));
}

function createEventTarget() {
  const listeners = new Set();
  return {
    addListener(listener) {
      if (typeof listener === 'function') listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    hasListener(listener) {
      return listeners.has(listener);
    },
    hasListeners() {
      return listeners.size > 0;
    },
    dispatch(...args) {
      for (const listener of Array.from(listeners)) {
        try {
          listener(...args);
        } catch {}
      }
    },
  };
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {}
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function patchNamespace(target, source) {
  if (!target || typeof target !== 'object') return;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function') {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      patchNamespace(target[key], value);
      continue;
    }
    if (target[key] == null) {
      target[key] = value;
    }
  }
}

function installExtensionServiceWorkerShim() {
  if (!isExtensionServiceWorker()) return;

  const root = globalThis;
  if (root.__lumenExtensionServiceWorkerShimInstalled) return;
  root.__lumenExtensionServiceWorkerShimInstalled = true;

  const runtimeId = (() => {
    try {
      return new URL(currentHref()).hostname || '';
    } catch {
      return '';
    }
  })();

  const extensionOrigin = (() => {
    return getUrlOrigin(currentHref(), runtimeId ? `chrome-extension://${runtimeId}` : 'chrome-extension://');
  })();

  const normalizeExtensionTargetUrl = (input) => {
    const value = safeString(input, 4096);
    if (!value) return '';
    try {
      if (value.startsWith('/')) {
        return `${extensionOrigin}/${value.replace(/^\/+/, '')}`;
      }
      return new URL(value, currentHref() || `${extensionOrigin}/`).toString();
    } catch {
      return value;
    }
  };

  const storageEvents = {
    onChanged: createEventTarget(),
  };
  const idleEvents = {
    onStateChanged: createEventTarget(),
  };
  const alarmsEvents = {
    onAlarm: createEventTarget(),
  };
  const notificationsEvents = {
    onClicked: createEventTarget(),
    onButtonClicked: createEventTarget(),
    onClosed: createEventTarget(),
    onShown: createEventTarget(),
    onPermissionLevelChanged: createEventTarget(),
  };
  const identityEvents = {
    onSignInChanged: createEventTarget(),
  };
  const webNavigationEvents = {
    onBeforeNavigate: createEventTarget(),
    onCommitted: createEventTarget(),
    onCompleted: createEventTarget(),
    onDOMContentLoaded: createEventTarget(),
    onCreatedNavigationTarget: createEventTarget(),
    onHistoryStateUpdated: createEventTarget(),
    onReferenceFragmentUpdated: createEventTarget(),
    onErrorOccurred: createEventTarget(),
  };

  const storageMemory = new Map();
  const storageNamespacePrefix = `__lumenExtensionWorkerStorage__/${runtimeId || 'default'}/`;

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

  const storageAreaPrefix = (areaName) => `${storageNamespacePrefix}${areaName}/`;
  const storageEntryKey = (areaName, key) => `${storageAreaPrefix(areaName)}${key}`;

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

  const createAsyncStub = (value) => {
    return (...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
      return asyncResult(cloneValue(value), callback);
    };
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
          newValue: cloneValue(value),
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
          newValue: undefined,
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
          newValue: undefined,
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
    },
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
        periodInMinutes: Number(info?.periodInMinutes || 0) || undefined,
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
    onAlarm: alarmsEvents.onAlarm,
  };

  const idleApi = {
    queryState(_detectionIntervalInSeconds, callback) {
      return asyncResult('active', callback);
    },
    setDetectionInterval(_intervalInSeconds, callback) {
      return asyncResult(undefined, callback);
    },
    onStateChanged: idleEvents.onStateChanged,
  };

  const notificationsApi = {
    create(notificationIdOrOptions, optionsOrCallback, maybeCallback) {
      const callback =
        typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      const notificationId =
        typeof notificationIdOrOptions === 'string'
          ? safeString(notificationIdOrOptions, 256)
          : `lumen-notification-${Date.now()}`;
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
    onPermissionLevelChanged: notificationsEvents.onPermissionLevelChanged,
  };

  const identityApi = {
    getRedirectURL(path = '') {
      const normalized = safeString(path, 4096).replace(/^\/+/, '');
      return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
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
    onSignInChanged: identityEvents.onSignInChanged,
  };

  const sidePanelApi = {
    open(options, callback) {
      return asyncResult(undefined, callback || options);
    },
    setPanelBehavior(behavior, callback) {
      return asyncResult(undefined, callback || behavior);
    },
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
    },
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
          url: currentHref(),
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
            url: currentHref(),
          },
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
    onErrorOccurred: webNavigationEvents.onErrorOccurred,
  };

  const runtimeApi = {
    id: runtimeId,
    lastError: null,
    getManifest() {
      return { manifest_version: 3, name: 'Extension', version: '1.0.0' };
    },
    getURL(path = '') {
      const normalized = safeString(path, 4096).replace(/^\/+/, '');
      return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
    },
    getPlatformInfo(callback) {
      const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
      const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
      return asyncResult({ os, arch, nacl_arch: arch }, callback);
    },
    sendMessage(...args) {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      const promise = Promise.resolve({});
      if (typeof callback === 'function') {
        promise.then(callback).catch(() => callback({}));
      }
      return promise;
    },
    connect(_extensionIdOrConnectInfo, _connectInfo) {
      const port = {
        name: '',
        sender: { id: runtimeId, url: currentHref() || `${extensionOrigin}/` },
        onMessage: createEventTarget(),
        onDisconnect: createEventTarget(),
        postMessage() {},
        disconnect() {},
      };
      Promise.resolve().then(() => {
        try {
          runtimeApi.onConnect.dispatch(port);
        } catch {}
      });
      return port;
    },
    onMessage: createEventTarget(),
    onConnect: createEventTarget(),
    onInstalled: createEventTarget(),
    onStartup: createEventTarget(),
    onSuspend: createEventTarget(),
    onSuspendCanceled: createEventTarget(),
    onUpdateAvailable: createEventTarget(),
    reload() {},
    requestUpdateCheck(callback) {
      return asyncResult({ status: 'no_update' }, callback);
    },
  };

  const tabsApi = {
    TAB_ID_NONE: -1,
    create(details, callback) {
      const nextUrl = normalizeExtensionTargetUrl(details?.url);
      const tab = {
        id: 1,
        windowId: 1,
        active: true,
        highlighted: true,
        status: 'complete',
        url: nextUrl || currentHref() || `${extensionOrigin}/`,
      };
      if (nextUrl) {
        try {
          root.clients?.matchAll().then(() => {});
        } catch {}
      }
      return asyncResult(tab, callback);
    },
    get(_tabId, callback) {
      return asyncResult({ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }, callback);
    },
    getCurrent(callback) {
      return asyncResult({ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }, callback);
    },
    query(_queryInfo, callback) {
      return asyncResult([{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }], callback);
    },
    update(_tabId, updateProperties, callback) {
      return asyncResult({ id: 1, windowId: 1, active: true, url: normalizeExtensionTargetUrl(updateProperties?.url) || currentHref() || `${extensionOrigin}/` }, callback);
    },
    remove(_tabIds, callback) {
      return asyncResult(undefined, callback);
    },
    sendMessage(_tabId, _message, _optionsOrCallback, maybeCallback) {
      const callback = typeof maybeCallback === 'function' ? maybeCallback : typeof _optionsOrCallback === 'function' ? _optionsOrCallback : undefined;
      return asyncResult(undefined, callback);
    },
  };

  const windowsApi = {
    WINDOW_ID_NONE: -1,
    WINDOW_ID_CURRENT: -2,
    getCurrent(_getInfoOrCallback, maybeCallback) {
      const callback = typeof _getInfoOrCallback === 'function' ? _getInfoOrCallback : maybeCallback;
      return asyncResult({ id: 1, focused: true, tabs: [{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }] }, callback);
    },
    get(_windowId, _getInfoOrCallback, maybeCallback) {
      const callback = typeof _getInfoOrCallback === 'function' ? _getInfoOrCallback : maybeCallback;
      return asyncResult({ id: 1, focused: true, tabs: [{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }] }, callback);
    },
    getAll(_getInfoOrCallback, maybeCallback) {
      const callback = typeof _getInfoOrCallback === 'function' ? _getInfoOrCallback : maybeCallback;
      return asyncResult([{ id: 1, focused: true, tabs: [{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }] }], callback);
    },
    create(_createData, callback) {
      return asyncResult({ id: 1, focused: true, tabs: [{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }] }, callback);
    },
    update(_windowId, _updateInfo, callback) {
      return asyncResult({ id: 1, focused: true, tabs: [{ id: 1, windowId: 1, active: true, url: currentHref() || `${extensionOrigin}/` }] }, callback);
    },
    remove(_windowId, callback) {
      return asyncResult(undefined, callback);
    },
    onCreated: createEventTarget(),
    onRemoved: createEventTarget(),
    onFocusChanged: createEventTarget(),
  };

  const shimNamespaces = {
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
      onChanged: storageEvents.onChanged,
    },
    runtime: runtimeApi,
    tabs: tabsApi,
    windows: windowsApi,
  };

  if (!root.chrome || typeof root.chrome !== 'object') {
    root.chrome = {};
  }
  patchNamespace(root.chrome, shimNamespaces);

  if (root.browser && typeof root.browser === 'object') {
    patchNamespace(root.browser, shimNamespaces);
  }

  try {
    console.log('[lumen-extension-sw-preload] ready', {
      href: currentHref(),
      runtimeId,
      hasWebNavigation: typeof root.browser?.webNavigation?.onBeforeNavigate?.addListener === 'function',
      hasBrowserRuntime: typeof root.browser?.runtime?.sendMessage === 'function',
      hasChromeRuntime: typeof root.chrome?.runtime?.sendMessage === 'function',
      hasChromeWebRequest: typeof root.chrome?.webRequest?.onBeforeRequest?.addListener === 'function',
      hasChromeDnr: typeof root.chrome?.declarativeNetRequest === 'object',
      hasBrowserTabsCreate: typeof root.browser?.tabs?.create === 'function',
      hasChromeTabsCreate: typeof root.chrome?.tabs?.create === 'function',
      hasBrowserNamespace: !!(root.browser && typeof root.browser === 'object')
    });
  } catch {}
}

installExtensionServiceWorkerShim();
