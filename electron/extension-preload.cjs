const { contextBridge, ipcRenderer } = require('electron');

function safeString(value, maxLen = 4096) {
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

const RUNTIME_SENDMESSAGE_TIMEOUT_MS = 10_000;
const RUNTIME_BROADCAST_CHANNEL_PREFIX = '__lumen_extension_runtime__';
const EXTENSION_FETCH_BRIDGE_KEY = '__lumenExtensionFetchBridge';
const EXTENSION_DEBUG =
  typeof process !== 'undefined' &&
  process &&
  process.env &&
  process.env.LUMEN_EXTENSION_DEBUG === '1';

function debugLog(...args) {
  if (!EXTENSION_DEBUG) return;
  try {
    console.log(...args);
  } catch {}
}

function normalizeExtensionTargetUrl(input) {
  const value = safeString(input, 4096);
  if (!value) return '';

  try {
    if (value.startsWith('/')) {
      const origin = getUrlOrigin(currentHref(), `chrome-extension://${getExtensionRuntimeId()}`);
      return `${origin}/${value.replace(/^\/+/, '')}`;
    }
    return new URL(value, currentHref() || 'chrome-extension://').toString();
  } catch {
    return value;
  }
}

function requestExtensionNavigation(url, openInNewTab) {
  const nextUrl = normalizeExtensionTargetUrl(url);
  if (!nextUrl) return;
  try {
    if (typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost('extensions:shimNavigate', {
        url: nextUrl,
        openInNewTab: !!openInNewTab
      });
      return;
    }
    ipcRenderer.send('extensions:shimNavigate', {
      url: nextUrl,
      openInNewTab: !!openInNewTab
    });
  } catch {}
}

function createAsyncCallbackResult(factory, callback, fallbackValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const promise = Promise.resolve()
    .then(() => factory())
    .catch(() => fallback());
  if (typeof callback === 'function') {
    promise.then((resolvedValue) => {
      try {
        callback(resolvedValue);
      } catch {}
    });
  }
  return promise;
}

function createBrowserEvent() {
  const listeners = new Set();
  return {
    listeners,
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
    }
  };
}

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {}
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function asyncResult(value, callback) {
  const promise = Promise.resolve(value);
  if (typeof callback === 'function') {
    promise.then((resolvedValue) => {
      try {
        callback(resolvedValue);
      } catch {}
    });
  }
  return promise;
}

function trimTrailingUndefined(args) {
  const trimmed = Array.isArray(args) ? args.slice() : [];
  while (trimmed.length && trimmed[trimmed.length - 1] === undefined) {
    trimmed.pop();
  }
  return trimmed;
}

function isRuntimeSendMessageOptions(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (
      Object.prototype.hasOwnProperty.call(value, 'includeTlsChannelId') ||
      Object.prototype.hasOwnProperty.call(value, 'toProxyScript') ||
      Object.prototype.hasOwnProperty.call(value, 'frameId')
    )
  );
}

function normalizeRuntimeSendMessageCall(rawArgs) {
  const args = trimTrailingUndefined(Array.from(rawArgs || []));
  let callback;

  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  const normalizedArgs = trimTrailingUndefined(args);

  debugLog('[extension-preload] normalizeRuntimeSendMessageCall:', {
    inputArgCount: rawArgs.length,
    outputArgCount: normalizedArgs.length,
    hasCallback: typeof callback === 'function'
  });

  if (normalizedArgs.length === 2) {
    const [first, second] = normalizedArgs;
    if (typeof first === 'string' && isRuntimeSendMessageOptions(second)) {
      return { args: [first, second], callback };
    }
  }

  if (normalizedArgs.length > 3) {
    return { args: normalizedArgs.slice(0, 3), callback };
  }

  return { args: normalizedArgs, callback };
}

function getRuntimeSendMessagePayload(args) {
  if (!Array.isArray(args) || args.length === 0) return null;
  if (typeof args[0] === 'string' && args.length >= 2) {
    const targetMessage = args[1];
    return targetMessage && typeof targetMessage === 'object' && !Array.isArray(targetMessage)
      ? targetMessage
      : null;
  }
  const message = args[0];
  return message && typeof message === 'object' && !Array.isArray(message) ? message : null;
}

function isInternalExtensionRuntimeMessage(args) {
  const message = getRuntimeSendMessagePayload(args);
  return !!(
    message &&
    typeof message.port === 'string' &&
    typeof message.type === 'string' &&
    Object.prototype.hasOwnProperty.call(message, 'msg')
  );
}

function normalizeRuntimeSendMessageResponse(args, value, fallbackValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  let response = value !== null && value !== undefined ? cloneValue(value) : fallback();

  if (response === null || response === undefined) {
    response = {};
  }

  if (!isInternalExtensionRuntimeMessage(args)) {
    return response;
  }

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    if (
      Object.prototype.hasOwnProperty.call(response, 'return') ||
      Object.prototype.hasOwnProperty.call(response, 'error')
    ) {
      return response;
    }
  }

  debugLog('[extension-preload] wrapping raw internal runtime response');
  return { return: response };
}

function normalizeRuntimeConnectCall(rawArgs) {
  const args = trimTrailingUndefined(Array.from(rawArgs || []));
  if (!args.length) return [];
  if (args.length === 1) return args;

  const [first, second] = args;
  if (typeof first === 'string') {
    return second === undefined ? [first] : [first, second];
  }
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return [first];
  }
  return args.slice(0, 2);
}

function normalizeTabsSendMessageCall(rawArgs) {
  const args = trimTrailingUndefined(Array.from(rawArgs || []));
  let callback;

  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  return {
    args: trimTrailingUndefined(args).slice(0, 3),
    callback
  };
}

function callNativeMethod(nativeMethod, nativeThis, args, callback, fallbackValue, normalizeValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const finalizeValue =
    typeof normalizeValue === 'function'
      ? (value) => {
          try {
            return normalizeValue(value, fallback);
          } catch {
            const fallbackValue = fallback();
            return fallbackValue !== null && fallbackValue !== undefined ? fallbackValue : {};
          }
        }
      : (value) => value;

  if (typeof nativeMethod !== 'function') {
    return asyncResult(finalizeValue(fallback()), callback);
  }

  if (typeof callback === 'function') {
    const wrappedCallback = (value) => {
      try {
        callback(finalizeValue(value));
      } catch {}
    };
    try {
      return nativeMethod.apply(nativeThis, [...args, wrappedCallback]);
    } catch {
      return asyncResult(finalizeValue(fallback()), callback);
    }
  }

  try {
    const result = nativeMethod.apply(nativeThis, args);
    if (result && typeof result.then === 'function') {
      return result.then((value) => finalizeValue(value)).catch(() => finalizeValue(fallback()));
    }
    return Promise.resolve(finalizeValue(result));
  } catch {
    return Promise.resolve(finalizeValue(fallback()));
  }
}

function callNativeRuntimeSendMessage(nativeMethod, nativeThis, rawArgs, fallbackValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const { args, callback } = normalizeRuntimeSendMessageCall(rawArgs);
  const retryDelaysMs = [0, 40, 80, 140, 220, 320];

  debugLog('[extension-preload] callNativeRuntimeSendMessage start:', {
    hasNativeMethod: typeof nativeMethod === 'function',
    hasCallback: typeof callback === 'function',
    argsCount: args.length
  });

  const transientPatterns = [
    'receiving end does not exist',
    'message port closed',
    'could not establish connection',
    'port closed before a response was received',
    'service worker context shut down'
  ];

  if (typeof nativeMethod !== 'function') {
    debugLog('[extension-preload] runtime.sendMessage using broadcast bridge fallback');
    return callBroadcastRuntimeSendMessage(args, callback, fallback);
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

      const finish = (value, error) => {
        if (settled) return;
        settled = true;
        if (timeoutId != null) {
          try {
            clearTimeout(timeoutId);
          } catch {}
        }
        debugLog('[extension-preload] invokeAttempt finish:', { value, error: !!error });
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
        if (typeof callback === 'function') {
          const result = nativeMethod.apply(nativeThis, [
            ...args,
            (value) => {
              finish(value, nativeThis?.lastError || null);
            }
          ]);
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
                finish(value, nativeThis?.lastError || null);
              }
            ]);
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

    for (const delay of retryDelaysMs) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const outcome = await invokeAttempt();
      lastOutcome = outcome;

      if (!isTransientFailure(outcome?.value, outcome?.error)) {
        return outcome.value;
      }
    }

    return lastOutcome?.value ?? fallback();
  };

  const promise = runWithRetries()
    .catch(() => {
      const fallbackValue = fallback();
      debugLog('[extension-preload] using fallback value:', fallbackValue);
      return fallbackValue;
    })
    .then((value) => {
      const response = normalizeRuntimeSendMessageResponse(args, value, fallback);
      debugLog('[extension-preload] final response value:', response);
      return response;
    });

  if (typeof callback === 'function') {
    promise
      .then((value) => {
        try {
          debugLog('[extension-preload] runtime.sendMessage callback invoked:', { response: value });
          callback(value);
        } catch (e) {
          console.error('[extension-preload] runtime.sendMessage callback error:', e);
          callback({});
        }
      })
      .catch((e) => {
        console.error('[extension-preload] runtime.sendMessage promise error:', e);
        try {
          callback({});
        } catch (err) {
          console.error('[extension-preload] runtime.sendMessage final fallback error:', err);
        }
      });
  }

  return promise;
}

function getExtensionRuntimeId() {
  try {
    const href = currentHref();
    if (/^chrome-extension:\/\//i.test(href)) {
      return new URL(href).hostname || 'hbfagpiekcachnbiafmlimmcknaoilnh';
    }
  } catch {}
  return 'hbfagpiekcachnbiafmlimmcknaoilnh';
}

function getExtensionOrigin() {
  try {
    const href = currentHref();
    if (/^chrome-extension:\/\//i.test(href)) {
      return getUrlOrigin(href, `chrome-extension://${getExtensionRuntimeId()}`);
    }
  } catch {}
  return `chrome-extension://${getExtensionRuntimeId()}`;
}

function getExtensionRequestContext() {
  return {
    runtimeId: getExtensionRuntimeId(),
    origin: getExtensionOrigin(),
    pageUrl: currentHref()
  };
}

const runtimeBroadcastState = {
  channel: null,
  created: false,
  sequence: 0
};

function getRuntimeBroadcastChannel() {
  if (runtimeBroadcastState.created) {
    return runtimeBroadcastState.channel;
  }

  runtimeBroadcastState.created = true;
  try {
    if (typeof BroadcastChannel === 'function') {
      runtimeBroadcastState.channel = new BroadcastChannel(
        `${RUNTIME_BROADCAST_CHANNEL_PREFIX}/${getExtensionRuntimeId()}`
      );
    }
  } catch {}

  return runtimeBroadcastState.channel;
}

function callBroadcastRuntimeSendMessage(args, callback, fallbackValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const channel = getRuntimeBroadcastChannel();

  if (!channel) {
    return asyncResult(fallback(), callback);
  }

  const requestId = `${Date.now()}:${++runtimeBroadcastState.sequence}:${Math.random()
    .toString(16)
    .slice(2)}`;
  const sender = {
    id: getExtensionRuntimeId(),
    origin: getExtensionOrigin(),
    url: currentHref() || `${getExtensionOrigin()}/`
  };

  const promise = new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId != null) {
        try {
          clearTimeout(timeoutId);
        } catch {}
      }
      try {
        if (typeof channel.removeEventListener === 'function') {
          channel.removeEventListener('message', handleMessage);
        } else if (channel.onmessage === handleMessage) {
          channel.onmessage = null;
        }
      } catch {}
    };

    const finish = (value, handled) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (handled === false) {
        resolve(normalizeRuntimeSendMessageResponse(args, undefined, fallback));
        return;
      }
      resolve(normalizeRuntimeSendMessageResponse(args, value, fallback));
    };

    const handleMessage = (event) => {
      const data = event?.data;
      if (!data || data.__lumenRuntimeBridge !== true) return;
      if (safeString(data.kind, 32) !== 'response') return;
      if (safeString(data.requestId, 256) !== requestId) return;
      finish(cloneValue(data.value), data.handled !== false);
    };

    try {
      if (typeof channel.addEventListener === 'function') {
        channel.addEventListener('message', handleMessage);
      } else {
        channel.onmessage = handleMessage;
      }
    } catch {}

    timeoutId = setTimeout(() => {
      finish(undefined, false);
    }, RUNTIME_SENDMESSAGE_TIMEOUT_MS);

    try {
      channel.postMessage({
        __lumenRuntimeBridge: true,
        kind: 'request',
        requestId,
        args: cloneValue(args),
        sender
      });
    } catch {
      finish(undefined, false);
    }
  });

  if (typeof callback === 'function') {
    promise
      .then((value) => {
        try {
          callback(value);
        } catch {}
      })
      .catch(() => {
        try {
          callback(fallback());
        } catch {}
      });
    return;
  }

  return promise;
}

let extensionManifestCache = null;

function getExtensionManifest() {
  if (extensionManifestCache) {
    return cloneValue(extensionManifestCache);
  }

  try {
    const request = new XMLHttpRequest();
    request.open('GET', `${getExtensionOrigin()}/manifest.json`, false);
    request.send(null);
    if (request.status >= 200 && request.status < 400 && request.responseText) {
      const parsed = JSON.parse(request.responseText);
      if (parsed && typeof parsed === 'object') {
        extensionManifestCache = parsed;
        return cloneValue(extensionManifestCache);
      }
    }
  } catch {}

  extensionManifestCache = {
    manifest_version: 3,
    name: 'Extension',
    short_name: 'Extension',
    version: '1.0.0',
    permissions: [],
    host_permissions: []
  };
  return cloneValue(extensionManifestCache);
}

function pickStorageValues(snapshot, keys) {
  if (!snapshot || typeof snapshot !== 'object') return {};

  if (keys == null) {
    return cloneValue(snapshot) || {};
  }

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
}

function createMinimalBrowserApi() {
  const runtimeId = getExtensionRuntimeId();
  const extensionOrigin = getExtensionOrigin();
  const nativeBrowserRuntime = globalThis.browser?.runtime || null;
  const nativeChromeRuntime = globalThis.chrome?.runtime || null;
  const nativeRuntime = nativeBrowserRuntime || nativeChromeRuntime;
  const nativeChromeTabs = globalThis.chrome?.tabs || null;
  const nativeChromeWindows = globalThis.chrome?.windows || null;
  const storagePrefix = `__lumen_extension_storage__/${runtimeId}/`;
  const notifications = new Map();
  const alarms = new Map();
  const sidePanelState = { openPanelOnActionClick: false };
  const storageEvents = { onChanged: createBrowserEvent() };
  const runtimeEvents = {
    onMessage: createBrowserEvent(),
    onConnect: createBrowserEvent(),
    onInstalled: createBrowserEvent(),
    onStartup: createBrowserEvent(),
    onSuspend: createBrowserEvent(),
    onSuspendCanceled: createBrowserEvent(),
    onUpdateAvailable: createBrowserEvent()
  };
  const tabsEvents = {
    onRemoved: createBrowserEvent(),
    onUpdated: createBrowserEvent(),
    onActivated: createBrowserEvent()
  };
  const windowsEvents = {
    onCreated: createBrowserEvent(),
    onRemoved: createBrowserEvent(),
    onFocusChanged: createBrowserEvent()
  };
  const idleEvents = { onStateChanged: createBrowserEvent() };
  const identityEvents = { onSignInChanged: createBrowserEvent() };
  const notificationsEvents = {
    onClicked: createBrowserEvent(),
    onButtonClicked: createBrowserEvent(),
    onClosed: createBrowserEvent(),
    onShown: createBrowserEvent(),
    onPermissionLevelChanged: createBrowserEvent()
  };
  const webNavigationEvents = {
    onBeforeNavigate: createBrowserEvent(),
    onCommitted: createBrowserEvent(),
    onCompleted: createBrowserEvent(),
    onDOMContentLoaded: createBrowserEvent(),
    onCreatedNavigationTarget: createBrowserEvent(),
    onHistoryStateUpdated: createBrowserEvent(),
    onReferenceFragmentUpdated: createBrowserEvent(),
    onErrorOccurred: createBrowserEvent()
  };
  let nextTabId = 2;
  let nextWindowId = 2;
  let nextNotificationId = 1;
  const tabs = new Map();

  const createAsyncStub = (value) => (...args) => {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    return asyncResult(cloneValue(value), callback);
  };

  const currentTab = () => ({
    id: 1,
    windowId: 1,
    active: true,
    highlighted: true,
    discarded: false,
    selected: true,
    status: 'complete',
    title: safeString(globalThis.document?.title || getExtensionManifest().name || 'Extension', 512) || 'Extension',
    url: currentHref() || `${extensionOrigin}/`,
    favIconUrl: '',
    incognito: false
  });

  const currentWindow = () => ({
    id: 1,
    focused: true,
    alwaysOnTop: false,
    incognito: false,
    type: 'popup',
    state: 'normal',
    tabs: [cloneValue(currentTab())]
  });

  tabs.set(1, currentTab());
  let cachedHostTabContext = null;
  let nextHostTabContextRequestId = 1;
  const pendingHostTabContextRequests = new Map();

  const normalizeHostTab = (value) => {
    if (!value || typeof value !== 'object') return null;
    const url = safeString(value.url, 4096);
    if (!url) return null;
    const id = Number(value.id);
    return {
      id: Number.isFinite(id) && id > 1 ? Math.trunc(id) : 1001,
      windowId: Number.isFinite(Number(value.windowId)) ? Number(value.windowId) : 1,
      active: value.active !== false,
      highlighted: value.highlighted !== false,
      discarded: !!value.discarded,
      selected: value.selected !== false,
      status: safeString(value.status, 32) || 'complete',
      title: safeString(value.title, 512) || url,
      url,
      favIconUrl: safeString(value.favIconUrl, 4096),
      incognito: !!value.incognito
    };
  };

  const normalizeHostWindow = (value, tab) => ({
    id: Number.isFinite(Number(value?.id)) ? Number(value.id) : tab.windowId || 1,
    focused: value?.focused !== false,
    alwaysOnTop: !!value?.alwaysOnTop,
    incognito: !!value?.incognito,
    type: safeString(value?.type, 32) || 'normal',
    state: safeString(value?.state, 32) || 'normal',
    tabs: [cloneValue(tab)]
  });

  const normalizeHostTabContext = (value) => {
    if (!value || typeof value !== 'object') return null;
    const tab = normalizeHostTab(value.tab || value);
    if (!tab) return null;
    return {
      tab,
      window: normalizeHostWindow(value.window, tab)
    };
  };

  const resolvePendingHostTabContext = (requestId, context) => {
    const key = safeString(requestId, 128);
    if (!key) return;
    const pending = pendingHostTabContextRequests.get(key);
    if (!pending) return;
    pendingHostTabContextRequests.delete(key);
    try {
      clearTimeout(pending.timeoutId);
    } catch {}
    pending.resolve(context ? cloneValue(context) : null);
  };

  ipcRenderer.on('extensions:tabContext', (_event, payload) => {
    const requestId = safeString(payload?.requestId, 128);
    const context = normalizeHostTabContext(payload?.context);
    if (context) {
      cachedHostTabContext = context;
    }
    resolvePendingHostTabContext(requestId, context || cachedHostTabContext);
  });

  const requestHostTabContext = () => {
    if (cachedHostTabContext) {
      return Promise.resolve(cloneValue(cachedHostTabContext));
    }
    if (typeof ipcRenderer.sendToHost !== 'function') {
      return Promise.resolve(null);
    }
    const requestId = `${Date.now()}:${nextHostTabContextRequestId++}`;
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        pendingHostTabContextRequests.delete(requestId);
        resolve(cachedHostTabContext ? cloneValue(cachedHostTabContext) : null);
      }, 300);
      pendingHostTabContextRequests.set(requestId, { resolve, timeoutId });
      try {
        ipcRenderer.sendToHost('extensions:requestTabContext', { requestId });
      } catch {
        pendingHostTabContextRequests.delete(requestId);
        try {
          clearTimeout(timeoutId);
        } catch {}
        resolve(cachedHostTabContext ? cloneValue(cachedHostTabContext) : null);
      }
    });
  };

  const getHostTabContext = async () => {
    const context = await requestHostTabContext();
    return context || cachedHostTabContext || null;
  };

  const escapeRegExp = (value) => String(value || '').replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

  const pathMatchesPattern = (pattern, pathname) => {
    const source = String(pattern || '/*');
    const target = String(pathname || '/');
    const matcher = new RegExp(`^${source.split('*').map(escapeRegExp).join('.*')}$`);
    return matcher.test(target);
  };

  const hostMatchesPattern = (pattern, hostname) => {
    const expected = safeString(pattern, 512).toLowerCase();
    const actual = safeString(hostname, 512).toLowerCase();
    if (!expected || !actual) return false;
    if (expected === '*') return true;
    if (expected.startsWith('*.')) {
      const suffix = expected.slice(2);
      return actual === suffix || actual.endsWith(`.${suffix}`);
    }
    return actual === expected;
  };

  const urlMatchesHostPermission = (pattern, rawUrl) => {
    const value = safeString(pattern, 4096);
    const target = safeString(rawUrl, 4096);
    if (!value || !target) return false;

    try {
      const parsed = new URL(target);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      if (value === '<all_urls>') {
        return true;
      }

      const match = /^(\*|http|https):\/\/([^/]+)(\/.*)$/.exec(value);
      if (!match) return false;

      const [, schemePattern, hostPattern, pathPattern] = match;
      const protocol = String(parsed.protocol || '').toLowerCase();
      const schemeOk =
        schemePattern === '*'
          ? protocol === 'http:' || protocol === 'https:'
          : protocol === `${String(schemePattern).toLowerCase()}:`;
      if (!schemeOk) return false;
      if (!hostMatchesPattern(hostPattern, parsed.hostname || '')) return false;
      return pathMatchesPattern(pathPattern || '/*', parsed.pathname || '/');
    } catch {
      return false;
    }
  };

  const canReadSensitiveHostTabFields = (rawUrl) => {
    const tabUrl = safeString(rawUrl, 4096);
    if (!/^https?:\/\//i.test(tabUrl)) {
      return false;
    }

    const manifest = getExtensionManifest();
    const grantedPermissions = new Set(
      Array.isArray(manifest.permissions)
        ? manifest.permissions.map((entry) => safeString(entry, 256)).filter(Boolean)
        : []
    );
    if (grantedPermissions.has('tabs') || grantedPermissions.has('activeTab')) {
      return true;
    }

    const hostPermissions = Array.isArray(manifest.host_permissions)
      ? manifest.host_permissions.map((entry) => safeString(entry, 4096)).filter(Boolean)
      : [];
    return hostPermissions.some((pattern) => urlMatchesHostPermission(pattern, tabUrl));
  };

  const sanitizeTabForExtension = (tab) => {
    const value = tab && typeof tab === 'object' ? cloneValue(tab) : null;
    if (!value) return value;

    const tabUrl = safeString(value.url, 4096);
    if (/^chrome-extension:\/\//i.test(tabUrl)) {
      return value;
    }
    if (canReadSensitiveHostTabFields(tabUrl)) {
      return value;
    }

    delete value.url;
    delete value.title;
    delete value.favIconUrl;
    return value;
  };

  const sanitizeWindowForExtension = (windowValue, fallbackTab) => {
    const tab = sanitizeTabForExtension(fallbackTab);
    const base = windowValue && typeof windowValue === 'object' ? cloneValue(windowValue) : {};
    return {
      ...base,
      tabs: tab ? [cloneValue(tab)] : []
    };
  };

  const buildLocalTabsQueryResults = (queryInfo) => {
    const info = queryInfo && typeof queryInfo === 'object' ? queryInfo : {};
    let results = Array.from(tabs.values()).map((tab) => cloneValue(tab));
    if (!results.length) results = [cloneValue(currentTab())];
    if (info.active !== undefined) results = results.filter((tab) => tab.active === info.active);
    if (info.currentWindow === true || info.lastFocusedWindow === true) {
      results = results.filter((tab) => tab.windowId === 1);
    }
    if (info.windowId !== undefined) results = results.filter((tab) => tab.windowId === info.windowId);
    if (info.url !== undefined) {
      const patterns = Array.isArray(info.url) ? info.url.map(String) : [String(info.url)];
      results = results.filter((tab) =>
        patterns.some((pattern) =>
          pattern.endsWith('*')
            ? String(tab.url || '').startsWith(pattern.slice(0, -1))
            : String(tab.url || '') === pattern
        )
      );
    }
    return results;
  };

  const normalizeNativeTabResult = (value, fallback) => {
    if (value && typeof value === 'object') return cloneValue(value);
    return fallback();
  };

  const normalizeNativeTabsQueryResult = (value, fallback) => {
    if (Array.isArray(value) && value.length > 0) return cloneValue(value);
    return fallback();
  };

  const normalizeNativeWindowResult = (value, fallback) => {
    if (value && typeof value === 'object') return cloneValue(value);
    return fallback();
  };

  const buildEffectiveTabsQueryResults = async (queryInfo) => {
    const info = queryInfo && typeof queryInfo === 'object' ? queryInfo : {};
    const hostContext = await getHostTabContext();
    if (!hostContext?.tab) {
      return buildLocalTabsQueryResults(queryInfo);
    }
    let results = [sanitizeTabForExtension(hostContext.tab)].filter(Boolean);
    if (info.active !== undefined) results = results.filter((tab) => tab.active === info.active);
    if (info.currentWindow === true || info.lastFocusedWindow === true) {
      results = results.filter((tab) => tab.windowId === hostContext.window?.id);
    }
    if (info.windowId !== undefined) results = results.filter((tab) => tab.windowId === info.windowId);
    if (info.url !== undefined) {
      const patterns = Array.isArray(info.url) ? info.url.map(String) : [String(info.url)];
      results = results.filter((tab) =>
        patterns.some((pattern) =>
          pattern.endsWith('*')
            ? String(tab.url || '').startsWith(pattern.slice(0, -1))
            : String(tab.url || '') === pattern
        )
      );
    }
    return results;
  };

  const getEffectiveTabById = async (tabId) => {
    const numericTabId = Number(tabId);
    const hostContext = await getHostTabContext();
    if (hostContext?.tab && Number(hostContext.tab.id) === numericTabId) {
      return sanitizeTabForExtension(hostContext.tab);
    }
    return cloneValue(tabs.get(numericTabId) || currentTab());
  };

  const getEffectiveCurrentWindow = async () => {
    const hostContext = await getHostTabContext();
    if (!hostContext?.window || !hostContext?.tab) {
      return cloneValue(currentWindow());
    }
    return sanitizeWindowForExtension(hostContext.window, hostContext.tab);
  };

  const readStorageArea = (areaName) => {
    try {
      const raw = globalThis.localStorage?.getItem(`${storagePrefix}${areaName}`);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeStorageArea = (areaName, value) => {
    try {
      globalThis.localStorage?.setItem(`${storagePrefix}${areaName}`, JSON.stringify(value || {}));
    } catch {}
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
      return asyncResult(pickStorageValues(readStorageArea(areaName), keys), callback);
    },
    set(items, callback) {
      const snapshot = readStorageArea(areaName);
      const next = { ...snapshot };
      const changes = {};
      for (const [key, value] of Object.entries(items && typeof items === 'object' ? items : {})) {
        const previous = snapshot[key];
        next[key] = cloneValue(value);
        if (JSON.stringify(previous) === JSON.stringify(next[key])) continue;
        changes[key] = { oldValue: cloneValue(previous), newValue: cloneValue(next[key]) };
      }
      writeStorageArea(areaName, next);
      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    remove(keys, callback) {
      const snapshot = readStorageArea(areaName);
      const next = { ...snapshot };
      const changes = {};
      const keyList = Array.isArray(keys) ? keys.map((key) => String(key)) : [String(keys)];
      for (const key of keyList) {
        if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
        changes[key] = { oldValue: cloneValue(next[key]), newValue: undefined };
        delete next[key];
      }
      writeStorageArea(areaName, next);
      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    clear(callback) {
      const snapshot = readStorageArea(areaName);
      const changes = {};
      for (const [key, value] of Object.entries(snapshot)) {
        changes[key] = { oldValue: cloneValue(value), newValue: undefined };
      }
      writeStorageArea(areaName, {});
      dispatchStorageChanges(changes, areaName);
      return asyncResult(undefined, callback);
    },
    getBytesInUse(keys, callback) {
      let bytes = 0;
      try {
        bytes = new TextEncoder().encode(JSON.stringify(pickStorageValues(readStorageArea(areaName), keys))).length;
      } catch {}
      return asyncResult(bytes, callback);
    }
  });

  const runtimeApi = {
    id: safeString(nativeRuntime?.id, 128) || runtimeId,
    get lastError() {
      return nativeRuntime?.lastError || null;
    },
    getManifest() {
      if (typeof nativeRuntime?.getManifest === 'function') {
        try {
          return nativeRuntime.getManifest();
        } catch {}
      }
      return getExtensionManifest();
    },
    getURL(path = '') {
      if (typeof nativeRuntime?.getURL === 'function') {
        try {
          return nativeRuntime.getURL(path);
        } catch {}
      }
      const normalized = safeString(path, 4096).replace(/^\/+/, '');
      return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
    },
    getBackgroundPage(callback) {
      if (typeof nativeRuntime?.getBackgroundPage === 'function') {
        try {
          return nativeRuntime.getBackgroundPage(callback);
        } catch {}
      }
      return asyncResult(null, callback);
    },
    getBrowserInfo(callback) {
      if (typeof nativeRuntime?.getBrowserInfo === 'function') {
        try {
          return nativeRuntime.getBrowserInfo(callback);
        } catch {}
      }
      return asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback);
    },
    getPlatformInfo(callback) {
      if (typeof nativeRuntime?.getPlatformInfo === 'function') {
        try {
          return nativeRuntime.getPlatformInfo(callback);
        } catch {}
      }
      const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
      const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
      return asyncResult({ os, arch, nacl_arch: arch }, callback);
    },
    openOptionsPage(callback) {
      if (typeof nativeRuntime?.openOptionsPage === 'function') {
        try {
          return nativeRuntime.openOptionsPage(callback);
        } catch {}
      }
      return asyncResult(undefined, callback);
    },
    reload() {
      if (typeof nativeRuntime?.reload === 'function') {
        try {
          return nativeRuntime.reload();
        } catch {}
      }
      try {
        globalThis.location?.reload?.();
      } catch {}
    },
    connect(_extensionIdOrConnectInfo, connectInfo) {
      if (typeof nativeRuntime?.connect === 'function') {
        try {
          return nativeRuntime.connect(
            ...normalizeRuntimeConnectCall([_extensionIdOrConnectInfo, connectInfo])
          );
        } catch {}
      }
      const info =
        _extensionIdOrConnectInfo && typeof _extensionIdOrConnectInfo === 'object'
          ? _extensionIdOrConnectInfo
          : connectInfo || {};
      const port = {
        name: safeString(info?.name, 256),
        sender: { id: runtimeId, url: currentHref() || `${extensionOrigin}/` },
        onMessage: createBrowserEvent(),
        onDisconnect: createBrowserEvent(),
        postMessage(message) {
          Promise.resolve().then(() => {
            try {
              this.onMessage.dispatch(message, this.sender);
            } catch {}
          });
        },
        disconnect() {
          Promise.resolve().then(() => {
            try {
              this.onDisconnect.dispatch();
            } catch {}
          });
        }
      };
      Promise.resolve().then(() => {
        try {
          runtimeEvents.onConnect.dispatch(port);
        } catch {}
      });
      return port;
    },
    requestUpdateCheck(callback) {
      if (typeof nativeRuntime?.requestUpdateCheck === 'function') {
        try {
          return nativeRuntime.requestUpdateCheck(callback);
        } catch {}
      }
      return asyncResult({ status: 'no_update' }, callback);
    },
    setUninstallURL(_url, callback) {
      if (typeof nativeRuntime?.setUninstallURL === 'function') {
        try {
          return nativeRuntime.setUninstallURL(_url, callback);
        } catch {}
      }
      return asyncResult(undefined, callback);
    },
    sendMessage(_extensionIdOrMessage, messageOrOptions, optionsOrCallback, maybeCallback) {
      debugLog('[extension-preload] RUNTIME.SENDMESSAGE CALLED - ENTRY POINT');
      debugLog('[extension-preload] runtime.sendMessage called', {
        hasNativeRuntime: !!nativeRuntime,
        hasNativeBrowserRuntime: !!nativeBrowserRuntime,
        hasNativeChromeRuntime: !!nativeChromeRuntime,
        hasNativeSendMessage: typeof nativeRuntime?.sendMessage === 'function',
        args: [_extensionIdOrMessage, typeof messageOrOptions, typeof optionsOrCallback, typeof maybeCallback],
        stack: new Error().stack?.split('\n').slice(0, 5).join('\n')
      });
      return callNativeRuntimeSendMessage(
        nativeRuntime?.sendMessage,
        nativeRuntime,
        arguments,
        () => ({})
      );
    },
    onMessage: nativeRuntime?.onMessage || runtimeEvents.onMessage,
    onConnect: nativeRuntime?.onConnect || runtimeEvents.onConnect,
    onInstalled: nativeRuntime?.onInstalled || runtimeEvents.onInstalled,
    onStartup: nativeRuntime?.onStartup || runtimeEvents.onStartup,
    onSuspend: nativeRuntime?.onSuspend || runtimeEvents.onSuspend,
    onSuspendCanceled: nativeRuntime?.onSuspendCanceled || runtimeEvents.onSuspendCanceled,
    onUpdateAvailable: nativeRuntime?.onUpdateAvailable || runtimeEvents.onUpdateAvailable
  };

  const tabsApi = {
    TAB_ID_NONE: -1,
    create(details, callback) {
      const nextUrl = normalizeExtensionTargetUrl(details?.url);
      if (!nextUrl && typeof nativeChromeTabs?.create === 'function') {
        try {
          return nativeChromeTabs.create(details, callback);
        } catch {}
      }
      const tab = {
        ...currentTab(),
        id: nextTabId++,
        windowId: Number.isFinite(Number(details?.windowId)) ? Number(details.windowId) : 1,
        active: !(details && details.active === false),
        url: nextUrl || currentHref() || `${extensionOrigin}/`,
        title: safeString(details?.title || '', 512) || currentTab().title
      };
      tabs.set(tab.id, tab);
      if (nextUrl) requestExtensionNavigation(nextUrl, true);
      return asyncResult(cloneValue(tab), callback);
    },
    get(tabId, callback) {
      return createAsyncCallbackResult(async () => {
        const nativeValue = await callNativeMethod(
          nativeChromeTabs?.get,
          nativeChromeTabs,
          [tabId],
          undefined,
          () => undefined,
          (value) => value
        );
        if (nativeValue && typeof nativeValue === 'object') return sanitizeTabForExtension(nativeValue);
        return getEffectiveTabById(tabId);
      }, callback, () => getEffectiveTabById(tabId));
    },
    getCurrent(callback) {
      return createAsyncCallbackResult(async () => {
        const nativeValue = await callNativeMethod(
          nativeChromeTabs?.getCurrent,
          nativeChromeTabs,
          [],
          undefined,
          () => undefined,
          (value) => value
        );
        if (nativeValue && typeof nativeValue === 'object') return cloneValue(nativeValue);
        return cloneValue(currentTab());
      }, callback, () => cloneValue(currentTab()));
    },
    query(queryInfo, callback) {
      return createAsyncCallbackResult(async () => {
        const nativeValue = await callNativeMethod(
          nativeChromeTabs?.query,
          nativeChromeTabs,
          [queryInfo],
          undefined,
          () => undefined,
          (value) => value
        );
        if (Array.isArray(nativeValue) && nativeValue.length > 0) {
          return nativeValue.map((tab) => sanitizeTabForExtension(tab)).filter(Boolean);
        }
        return buildEffectiveTabsQueryResults(queryInfo);
      }, callback, () => buildLocalTabsQueryResults(queryInfo));
    },
    update(tabIdOrUpdateProps, updatePropertiesOrCallback, maybeCallback) {
      const hasNumericTabId =
        typeof tabIdOrUpdateProps === 'number' ||
        (typeof tabIdOrUpdateProps === 'string' && tabIdOrUpdateProps.trim() !== '');
      const tabId = hasNumericTabId ? Number(tabIdOrUpdateProps) : 1;
      const updateProperties =
        hasNumericTabId && updatePropertiesOrCallback && typeof updatePropertiesOrCallback === 'object'
          ? updatePropertiesOrCallback
          : !hasNumericTabId && tabIdOrUpdateProps && typeof tabIdOrUpdateProps === 'object'
            ? tabIdOrUpdateProps
            : {};
      const callback = typeof updatePropertiesOrCallback === 'function' ? updatePropertiesOrCallback : maybeCallback;
      const nextUrl = normalizeExtensionTargetUrl(updateProperties?.url);
      if (!nextUrl && typeof nativeChromeTabs?.update === 'function') {
        try {
          return nativeChromeTabs.update(tabIdOrUpdateProps, updatePropertiesOrCallback, maybeCallback);
        } catch {}
      }
      const existing = tabs.get(tabId) || currentTab();
      const tab = {
        ...existing,
        active: updateProperties?.active === undefined ? existing.active : !!updateProperties.active,
        title: updateProperties?.title === undefined ? existing.title : safeString(updateProperties.title, 512),
        url: nextUrl || existing.url
      };
      tabs.set(tab.id, tab);
      if (nextUrl) requestExtensionNavigation(nextUrl, false);
      Promise.resolve().then(() => {
        try {
          tabsEvents.onUpdated.dispatch(tab.id, { status: 'complete', url: tab.url }, cloneValue(tab));
        } catch {}
      });
      return asyncResult(cloneValue(tab), callback);
    },
    reload(_tabId, _reloadProperties, callback) {
      try {
        globalThis.location?.reload?.();
      } catch {}
      return asyncResult(undefined, callback);
    },
    remove(tabIds, callback) {
      if (typeof nativeChromeTabs?.remove === 'function') {
        try {
          return nativeChromeTabs.remove(tabIds, callback);
        } catch {}
      }
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      for (const id of ids.map((value) => Number(value))) {
        tabs.delete(id);
        Promise.resolve().then(() => {
          try {
            tabsEvents.onRemoved.dispatch(id, { windowId: 1, isWindowClosing: false });
          } catch {}
        });
      }
      return asyncResult(undefined, callback);
    },
    sendMessage(_tabId, _message, optionsOrCallback, maybeCallback) {
      const { args, callback } = normalizeTabsSendMessageCall(arguments);
      return callNativeMethod(
        nativeChromeTabs?.sendMessage,
        nativeChromeTabs,
        args,
        callback,
        () => ({}),
        (value, fallback) => {
          if (value !== null && value !== undefined) return value;
          const fallbackValue = fallback();
          return fallbackValue !== null && fallbackValue !== undefined ? fallbackValue : {};
        }
      );
    },
    executeScript(_tabIdOrDetails, detailsOrCallback, maybeCallback) {
      const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
      return asyncResult([], callback);
    },
    onRemoved: tabsEvents.onRemoved,
    onUpdated: tabsEvents.onUpdated,
    onActivated: tabsEvents.onActivated
  };

  const windowsApi = {
    WINDOW_ID_NONE: -1,
    WINDOW_ID_CURRENT: -2,
    getCurrent(getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      const args =
        typeof getInfoOrCallback === 'function' || getInfoOrCallback === undefined
          ? []
          : [getInfoOrCallback];
      return createAsyncCallbackResult(async () => {
        const nativeValue = await callNativeMethod(
          nativeChromeWindows?.getCurrent,
          nativeChromeWindows,
          args,
          undefined,
          () => undefined,
          (value) => value
        );
        if (nativeValue && typeof nativeValue === 'object') {
          const nativeTabs = Array.isArray(nativeValue.tabs) ? nativeValue.tabs : [];
          return sanitizeWindowForExtension(nativeValue, nativeTabs[0] || currentTab());
        }
        return getEffectiveCurrentWindow();
      }, callback, () => cloneValue(currentWindow()));
    },
    get(_windowId, getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      const args =
        typeof getInfoOrCallback === 'function' || getInfoOrCallback === undefined
          ? [_windowId]
          : [_windowId, getInfoOrCallback];
      return createAsyncCallbackResult(async () => {
        const nativeValue = await callNativeMethod(
          nativeChromeWindows?.get,
          nativeChromeWindows,
          args,
          undefined,
          () => undefined,
          (value) => value
        );
        if (nativeValue && typeof nativeValue === 'object') {
          const nativeTabs = Array.isArray(nativeValue.tabs) ? nativeValue.tabs : [];
          return sanitizeWindowForExtension(nativeValue, nativeTabs[0] || currentTab());
        }
        return getEffectiveCurrentWindow();
      }, callback, () => cloneValue(currentWindow()));
    },
    getAll(getInfoOrCallback, maybeCallback) {
      const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
      const args =
        typeof getInfoOrCallback === 'function' || getInfoOrCallback === undefined
          ? []
          : [getInfoOrCallback];
      return callNativeMethod(
        nativeChromeWindows?.getAll,
        nativeChromeWindows,
        args,
        callback,
        () => [cloneValue(currentWindow())],
        (value, fallback) =>
          Array.isArray(value) && value.length > 0
            ? value
                .map((entry) => {
                  const nativeTabs = Array.isArray(entry?.tabs) ? entry.tabs : [];
                  return sanitizeWindowForExtension(entry, nativeTabs[0] || currentTab());
                })
                .filter(Boolean)
            : fallback()
      );
    },
    create(createData, callback) {
      const nextUrl = normalizeExtensionTargetUrl(createData?.url);
      if (!nextUrl && typeof nativeChromeWindows?.create === 'function') {
        try {
          return nativeChromeWindows.create(createData, callback);
        } catch {}
      }
      const windowId = nextWindowId++;
      const win = {
        ...currentWindow(),
        id: windowId,
        tabs: [{
          ...currentTab(),
          id: nextTabId++,
          windowId,
          url: nextUrl || currentHref() || `${extensionOrigin}/`
        }]
      };
      if (nextUrl) requestExtensionNavigation(nextUrl, true);
      Promise.resolve().then(() => {
        try {
          windowsEvents.onCreated.dispatch(cloneValue(win));
        } catch {}
      });
      return asyncResult(cloneValue(win), callback);
    },
    update(_windowId, _updateInfo, callback) {
      return asyncResult(cloneValue(currentWindow()), callback);
    },
    remove(windowId, callback) {
      Promise.resolve().then(() => {
        try {
          windowsEvents.onRemoved.dispatch(Number(windowId));
        } catch {}
      });
      return asyncResult(undefined, callback);
    },
    onCreated: windowsEvents.onCreated,
    onRemoved: windowsEvents.onRemoved,
    onFocusChanged: windowsEvents.onFocusChanged
  };

  const storageApi = {
    local: createStorageArea('local'),
    sync: createStorageArea('sync'),
    session: createStorageArea('session'),
    onChanged: storageEvents.onChanged
  };

  const permissionsApi = {
    contains(details, callback) {
      const manifest = getExtensionManifest();
      const declared = new Set([
        ...(manifest.permissions || []),
        ...(manifest.host_permissions || []),
        ...(manifest.optional_permissions || []),
        ...(manifest.optional_host_permissions || [])
      ]);
      const requested = [...((details && details.permissions) || []), ...((details && details.origins) || [])];
      return asyncResult(requested.every((item) => declared.has(item)), callback);
    },
    getAll(callback) {
      const manifest = getExtensionManifest();
      return asyncResult({
        permissions: (manifest.permissions || []).slice(),
        origins: (manifest.host_permissions || []).slice()
      }, callback);
    },
    request: createAsyncStub(true),
    remove: createAsyncStub(false)
  };

  const namespaces = {
    alarms: {
      create(nameOrInfo, alarmInfo) {
        const hasName = typeof nameOrInfo === 'string';
        const name = hasName ? safeString(nameOrInfo, 256) : `alarm-${alarms.size + 1}`;
        alarms.set(name, {
          name,
          scheduledTime: Date.now(),
          periodInMinutes: Number((hasName ? alarmInfo : nameOrInfo)?.periodInMinutes || 0) || undefined
        });
      },
      get(name, callback) {
        return asyncResult(cloneValue(alarms.get(safeString(name, 256)) || null), callback);
      },
      getAll(callback) {
        return asyncResult(Array.from(alarms.values()).map(cloneValue), callback);
      },
      clear(name, callback) {
        return asyncResult(alarms.delete(safeString(name, 256)), callback);
      },
      clearAll(callback) {
        const hadAny = alarms.size > 0;
        alarms.clear();
        return asyncResult(hadAny, callback);
      },
      onAlarm: createBrowserEvent()
    },
    extension: {
      getURL: runtimeApi.getURL,
      getViews() {
        return [globalThis];
      },
      getBackgroundPage: createAsyncStub(null),
      lastError: null
    },
    identity: {
      getRedirectURL(path = '') {
        const normalized = safeString(path, 4096).replace(/^\/+/, '');
        return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
      },
      getProfileUserInfo: createAsyncStub({ email: '', id: '' }),
      getAuthToken(detailsOrCallback, maybeCallback) {
        const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
        return asyncResult('', callback);
      },
      launchWebAuthFlow(details, callback) {
        return asyncResult(safeString(details?.url, 4096), callback);
      },
      removeCachedAuthToken(_details, callback) {
        return asyncResult(undefined, callback);
      },
      clearAllCachedAuthTokens(callback) {
        return asyncResult(undefined, callback);
      },
      onSignInChanged: identityEvents.onSignInChanged
    },
    idle: {
      queryState(_detectionIntervalInSeconds, callback) {
        const state =
          globalThis.document?.hidden ||
          (typeof globalThis.document?.hasFocus === 'function' && !globalThis.document.hasFocus())
            ? 'idle'
            : 'active';
        return asyncResult(state, callback);
      },
      setDetectionInterval: createAsyncStub(undefined),
      onStateChanged: idleEvents.onStateChanged
    },
    management: {
      getSelf(callback) {
        const manifest = getExtensionManifest();
        return asyncResult({
          id: runtimeId,
          name: manifest.name || 'Extension',
          shortName: manifest.short_name || manifest.name || 'Extension',
          enabled: true,
          installType: 'development',
          mayDisable: true,
          type: 'extension',
          version: manifest.version || '0.0.0'
        }, callback);
      },
      get(_id, callback) {
        return namespaces.management.getSelf(callback);
      },
      getAll: createAsyncStub([]),
      getPermissionWarningsById: createAsyncStub([]),
      getPermissionWarningsByManifest: createAsyncStub([]),
      onEnabled: createBrowserEvent(),
      onDisabled: createBrowserEvent()
    },
    notifications: {
      create(idOrOptions, optionsOrCallback, maybeCallback) {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        const notificationId = typeof idOrOptions === 'string' ? safeString(idOrOptions, 256) : `notification-${nextNotificationId++}`;
        const details =
          idOrOptions && typeof idOrOptions === 'object' && !Array.isArray(idOrOptions)
            ? idOrOptions
            : optionsOrCallback || {};
        notifications.set(notificationId, cloneValue(details));
        return asyncResult(notificationId, callback);
      },
      update(id, details, callback) {
        const key = safeString(id, 256);
        if (notifications.has(key)) {
          notifications.set(key, { ...(notifications.get(key) || {}), ...cloneValue(details || {}) });
        }
        return asyncResult(notifications.has(key), callback);
      },
      clear(id, callback) {
        return asyncResult(notifications.delete(safeString(id, 256)), callback);
      },
      getAll(callback) {
        return asyncResult(Object.fromEntries(Array.from(notifications.entries()).map(([id, value]) => [id, cloneValue(value)])), callback);
      },
      getPermissionLevel(callback) {
        return asyncResult('granted', callback);
      },
      onClicked: notificationsEvents.onClicked,
      onButtonClicked: notificationsEvents.onButtonClicked,
      onClosed: notificationsEvents.onClosed,
      onShown: notificationsEvents.onShown,
      onPermissionLevelChanged: notificationsEvents.onPermissionLevelChanged
    },
    permissions: permissionsApi,
    runtime: runtimeApi,
    scripting: {
      executeScript: createAsyncStub([]),
      getRegisteredContentScripts: createAsyncStub([]),
      registerContentScripts: createAsyncStub(undefined),
      updateContentScripts: createAsyncStub(undefined),
      unregisterContentScripts: createAsyncStub(undefined)
    },
    sidePanel: {
      open: createAsyncStub(undefined),
      setPanelBehavior(behavior, callback) {
        sidePanelState.openPanelOnActionClick = !!behavior?.openPanelOnActionClick;
        return asyncResult(undefined, callback);
      },
      getPanelBehavior(callback) {
        return asyncResult(cloneValue(sidePanelState), callback);
      },
      setOptions: createAsyncStub(undefined),
      getOptions: createAsyncStub({})
    },
    storage: storageApi,
    tabs: tabsApi,
    webNavigation: {
      getFrame(detailsOrCallback, maybeCallback) {
        const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
        return asyncResult({
          errorOccurred: false,
          frameId: 0,
          parentFrameId: -1,
          tabId: 1,
          url: currentHref() || `${extensionOrigin}/`
        }, callback);
      },
      getAllFrames(detailsOrCallback, maybeCallback) {
        const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
        return asyncResult([{
          errorOccurred: false,
          frameId: 0,
          parentFrameId: -1,
          processId: -1,
          tabId: 1,
          url: currentHref() || `${extensionOrigin}/`
        }], callback);
      },
      onBeforeNavigate: webNavigationEvents.onBeforeNavigate,
      onCommitted: webNavigationEvents.onCommitted,
      onCompleted: webNavigationEvents.onCompleted,
      onDOMContentLoaded: webNavigationEvents.onDOMContentLoaded,
      onCreatedNavigationTarget: webNavigationEvents.onCreatedNavigationTarget,
      onHistoryStateUpdated: webNavigationEvents.onHistoryStateUpdated,
      onReferenceFragmentUpdated: webNavigationEvents.onReferenceFragmentUpdated,
      onErrorOccurred: webNavigationEvents.onErrorOccurred
    },
    windows: windowsApi
  };

  return namespaces;
}

const browserApi = createMinimalBrowserApi();
const extensionApi = browserApi;
const EXTENSION_API_SHIM_KEY = '__lumenExtensionWindowApiShim';
const EXTENSION_API_SHIM_SOURCE = 'extension-window';

function installMainWorldExtensionApi(shimKey, shimSource) {
  if (typeof contextBridge.executeInMainWorld !== 'function') return;

  try {
    contextBridge.executeInMainWorld({
      func: (key, source, fetchBridgeKey, debugEnabled) => {
        const root = window;
        const shim = root[key];
        if (!shim || typeof shim !== 'object') return;
        const log = (...args) => {
          if (!debugEnabled) return;
          try {
            console.log(...args);
          } catch {}
        };

        log('[extension-preload] installMainWorldExtensionApi called', {
          shimKey: key,
          shimSource: source,
          hasShim: !!shim,
          shimKeys: Object.keys(shim || {}),
          hasBrowserRuntime: !!(root.browser?.runtime?.sendMessage),
          hasChromeRuntime: !!(root.chrome?.runtime?.sendMessage)
        });

        const forceShimPaths = new Set([
          'runtime.sendMessage',
          'runtime.connect',
          'tabs.sendMessage'
        ]);

        const bindMethod = (fn, owner, fallback, fallbackOwner) =>
          typeof fn === 'function'
            ? (...args) => fn.apply(owner || root, args)
            : typeof fallback === 'function'
              ? (...args) => fallback.apply(fallbackOwner || root, args)
              : undefined;

        const isObject = (value) =>
          !!value && typeof value === 'object' && !Array.isArray(value);

        const mergeApiTree = (
          baseValue,
          shimValue,
          preferShim,
          path = '',
          baseOwner = null,
          shimOwner = null
        ) => {
          const shouldPreferShim = preferShim || forceShimPaths.has(path);

          if (typeof shimValue === 'function' || typeof baseValue === 'function') {
            return shouldPreferShim
              ? bindMethod(shimValue, shimOwner, baseValue, baseOwner)
              : bindMethod(baseValue, baseOwner, shimValue, shimOwner);
          }

          if (!isObject(shimValue) && !isObject(baseValue)) {
            return shouldPreferShim
              ? (shimValue !== undefined ? shimValue : baseValue)
              : (baseValue !== undefined ? baseValue : shimValue);
          }

          const base = isObject(baseValue) ? baseValue : {};
          const shimNode = isObject(shimValue) ? shimValue : {};
          const merged = { ...base };

          for (const key of Object.keys(shimNode)) {
            const nextPath = path ? `${path}.${key}` : key;
            merged[key] = mergeApiTree(
              base[key],
              shimNode[key],
              preferShim,
              nextPath,
              base,
              shimNode
            );
          }

          return merged;
        };

        const createApiRoot = (baseRoot) =>
          mergeApiTree(
            baseRoot,
            shim,
            !!(baseRoot && typeof baseRoot === 'object' && baseRoot.__lumenShimSource && baseRoot.__lumenShimSource !== source)
          );

        const mergeAssignedValue = (target, value, path = '') => {
          if (!isObject(target) || !isObject(value)) return;

          for (const [key, nextValue] of Object.entries(value)) {
            if (nextValue == null) continue;
            const nextPath = path ? `${path}.${key}` : key;
            if (isObject(nextValue)) {
              if (!isObject(target[key])) {
                target[key] = {};
              }
              mergeAssignedValue(target[key], nextValue, nextPath);
              continue;
            }
            if (forceShimPaths.has(nextPath) && target[key] !== undefined) {
              continue;
            }
            target[key] = nextValue;
          }
        };

        const installApiProperty = (property, initialApi) => {
          let assigned = initialApi;
          try {
            Object.defineProperty(assigned, '__lumenShimSource', {
              configurable: true,
              enumerable: false,
              value: source
            });
          } catch {}
          try {
            Object.defineProperty(root, property, {
              configurable: true,
              enumerable: true,
              get() {
                return assigned;
              },
              set(value) {
                mergeAssignedValue(assigned, value);
              }
            });
            return true;
          } catch {
            try {
              root[property] = assigned;
              return true;
            } catch {
              return false;
            }
          }
        };

        const readPath = (target, path) => {
          if (!isObject(target)) return undefined;
          let node = target;
          for (const segment of path.split('.')) {
            if (!isObject(node) && typeof node !== 'function') return undefined;
            node = node?.[segment];
            if (node == null) return node;
          }
          return node;
        };

        const ensureParentPath = (target, path) => {
          if (!isObject(target)) return null;
          const segments = path.split('.');
          const methodName = segments.pop();
          let node = target;
          for (const segment of segments) {
            if (!isObject(node[segment])) {
              try {
                node[segment] = {};
              } catch {
                return null;
              }
            }
            node = node[segment];
          }
          return { parent: node, methodName };
        };

        const forceShimMethods = (target) => {
          if (!isObject(target)) return;
          for (const path of forceShimPaths) {
            const shimLocation = ensureParentPath(shim, path);
            const shimMethod = shimLocation?.parent?.[shimLocation.methodName];
            if (typeof shimMethod !== 'function') continue;
            const location = ensureParentPath(target, path);
            if (!location) continue;
            try {
              location.parent[location.methodName] = (...args) =>
                shimMethod.apply(shimLocation.parent || shim, args);
              continue;
            } catch {}
            try {
              Object.defineProperty(location.parent, location.methodName, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: (...args) => shimMethod.apply(shimLocation.parent || shim, args)
              });
            } catch {}
          }
        };

        const forceBrowserMethodsFromChrome = (browserTarget, chromeTarget) => {
          if (!isObject(browserTarget) || !isObject(chromeTarget)) return;

          const aliasMethod = (target, path, method, owner) => {
            const location = ensureParentPath(target, path);
            if (!location) return;
            try {
              location.parent[location.methodName] = (...args) => method.apply(owner || root, args);
              return;
            } catch {}
            try {
              Object.defineProperty(location.parent, location.methodName, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: (...args) => method.apply(owner || root, args)
              });
            } catch {}
          };

          for (const path of forceShimPaths) {
            const chromeLocation = ensureParentPath(chromeTarget, path);
            const chromeMethod = chromeLocation?.parent?.[chromeLocation.methodName];
            if (typeof chromeMethod !== 'function') continue;
            aliasMethod(browserTarget, path, chromeMethod, chromeLocation.parent || chromeTarget);
            aliasMethod(root.browser, path, chromeMethod, chromeLocation.parent || chromeTarget);
          }
        };

        const aliasBrowserNamespaceToChrome = () => {
          try {
            Object.defineProperty(root, 'browser', {
              configurable: true,
              enumerable: true,
              get() {
                return root.chrome;
              },
              set(value) {
                mergeAssignedValue(root.chrome, value);
              }
            });
            return true;
          } catch {
            try {
              root.browser = root.chrome;
              return root.browser === root.chrome;
            } catch {
              return false;
            }
          }
        };

        const installFetchFallback = () => {
          const fetchBridge = root[fetchBridgeKey];
          if (!fetchBridge || typeof fetchBridge.request !== 'function') return;
          if (typeof root.fetch !== 'function') return;
          if (root.fetch.__lumenExtensionFetchPatched === true) return;

          const canProxyUrl = (value) => {
            try {
              const url = new URL(String(value || ''), String(root.location?.href || ''));
              return url.protocol === 'http:' || url.protocol === 'https:';
            } catch {
              return false;
            }
          };

          const headersToObject = (input) => {
            const out = {};
            if (!input) return out;
            try {
              if (typeof Headers !== 'undefined' && input instanceof Headers) {
                for (const [key, value] of input.entries()) out[key] = value;
                return out;
              }
            } catch {}
            if (Array.isArray(input)) {
              for (const entry of input) {
                if (!Array.isArray(entry) || entry.length < 2) continue;
                out[String(entry[0])] = String(entry[1]);
              }
              return out;
            }
            if (typeof input === 'object') {
              for (const [key, value] of Object.entries(input)) {
                out[String(key)] = String(value);
              }
            }
            return out;
          };

          const toBase64 = (bytes) => {
            if (!(bytes instanceof Uint8Array)) return '';
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode(...chunk);
            }
            return btoa(binary);
          };

          const fromBase64 = (value) => {
            const input = String(value || '');
            if (!input) return new Uint8Array();
            const binary = atob(input);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          };

          const serializeBody = async (body) => {
            if (body == null) return {};
            if (typeof body === 'string') return { bodyText: body };
            if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
              return { bodyText: body.toString() };
            }
            if (typeof Blob !== 'undefined' && body instanceof Blob) {
              const buffer = await body.arrayBuffer();
              return { bodyBase64: toBase64(new Uint8Array(buffer)) };
            }
            if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
              return { bodyBase64: toBase64(new Uint8Array(body)) };
            }
            if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) {
              return {
                bodyBase64: toBase64(
                  new Uint8Array(body.buffer, body.byteOffset, body.byteLength)
                )
              };
            }
            return { unsupportedBody: true };
          };

          const normalizeFetchArgs = async (input, init) => {
            const requestLike =
              typeof Request !== 'undefined' && input instanceof Request ? input : null;
            const url = requestLike ? requestLike.url : String(input || '');
            const method = String(init?.method || requestLike?.method || 'GET').toUpperCase();
            const headers = headersToObject(init?.headers || requestLike?.headers);
            const redirect = init?.redirect || requestLike?.redirect || 'follow';
            let bodySource;

            if (init && Object.prototype.hasOwnProperty.call(init, 'body')) {
              bodySource = init.body;
            } else if (requestLike && method !== 'GET' && method !== 'HEAD') {
              try {
                bodySource = await requestLike.clone().arrayBuffer();
              } catch {
                bodySource = undefined;
              }
            }

            const body = await serializeBody(bodySource);
            if (body.unsupportedBody) return null;

            return {
              url,
              init: {
                method,
                headers,
                redirect,
                ...body
              }
            };
          };

          const nativeFetch = root.fetch.bind(root);
          const patchedFetch = async (input, init) => {
            try {
              return await nativeFetch(input, init);
            } catch (error) {
              const normalized = await normalizeFetchArgs(input, init);
              if (!normalized || !canProxyUrl(normalized.url)) {
                throw error;
              }

              const result = await fetchBridge.request(normalized.url, normalized.init);
              if (!result || Number(result.status) <= 0) {
                throw error;
              }

              const response = new Response(fromBase64(result.bodyBase64), {
                status: Number(result.status) || 200,
                statusText: String(result.statusText || ''),
                headers: result.headers && typeof result.headers === 'object' ? result.headers : {}
              });

              try {
                Object.defineProperty(response, 'url', {
                  configurable: true,
                  enumerable: true,
                  value: String(result.url || normalized.url)
                });
              } catch {}
              try {
                Object.defineProperty(response, 'redirected', {
                  configurable: true,
                  enumerable: true,
                  value: !!result.redirected
                });
              } catch {}

              return response;
            }
          };

          try {
            Object.defineProperty(patchedFetch, '__lumenExtensionFetchPatched', {
              configurable: true,
              enumerable: false,
              value: true
            });
          } catch {}

          try {
            root.fetch = patchedFetch;
          } catch {}
        };

        const chromeApi = createApiRoot(root.chrome);
        const browserApi = createApiRoot(root.browser);

        const chromeInstalled = installApiProperty('chrome', chromeApi);
        const browserInstalled = installApiProperty('browser', browserApi);

        forceShimMethods(chromeApi);
        forceShimMethods(browserApi);
        forceShimMethods(root.chrome);
        forceShimMethods(root.browser);
        forceBrowserMethodsFromChrome(browserApi, root.chrome);
        const browserAliasedToChrome = aliasBrowserNamespaceToChrome();
        installFetchFallback();

        log('[extension-preload] API installation result', {
          chromeInstalled,
          browserInstalled,
          browserAliasedToChrome,
          hasBrowserRuntimeSendMessage: typeof root.browser?.runtime?.sendMessage === 'function',
          hasChromeRuntimeSendMessage: typeof root.chrome?.runtime?.sendMessage === 'function',
          browserUsesShimRuntimeSendMessage: root.browser?.runtime?.sendMessage === browserApi?.runtime?.sendMessage,
          chromeUsesShimRuntimeSendMessage: root.chrome?.runtime?.sendMessage === chromeApi?.runtime?.sendMessage,
          browserUsesChromeRuntimeSendMessage: root.browser?.runtime?.sendMessage === root.chrome?.runtime?.sendMessage
        });

        try {
          log('[lumen-extension-preload] api patched', {
            hasBrowserTabsCreate: typeof root.browser?.tabs?.create === 'function',
            hasChromeTabsCreate: typeof root.chrome?.tabs?.create === 'function',
            href: String(root.location?.href || '')
          });
        } catch {}
      },
      args: [shimKey, shimSource, EXTENSION_FETCH_BRIDGE_KEY, EXTENSION_DEBUG]
    });
  } catch (err) {
    console.error('[lumen-extension-preload] ✗ Failed to install main world API:', err?.message);
  }
}

try {
  contextBridge.exposeInMainWorld(EXTENSION_API_SHIM_KEY, extensionApi);
} catch (err) {
  console.error('[lumen-extension-preload] ✗ Failed to expose ' + EXTENSION_API_SHIM_KEY + ':', err?.message);
}

try {
  contextBridge.exposeInMainWorld(EXTENSION_FETCH_BRIDGE_KEY, {
    request: (url, options) =>
      ipcRenderer.invoke('http:request', url, {
        ...(options && typeof options === 'object' ? options : {}),
        extensionContext: getExtensionRequestContext()
      })
  });
} catch (err) {
  console.error('[lumen-extension-preload] ✗ Failed to expose ' + EXTENSION_FETCH_BRIDGE_KEY + ':', err?.message);
}

installMainWorldExtensionApi(EXTENSION_API_SHIM_KEY, EXTENSION_API_SHIM_SOURCE);
