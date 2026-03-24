function safeString(value, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function isExtensionPageUrl(href) {
  return /^chrome-extension:\/\//i.test(safeString(href, 4096));
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

function dispatchHostEvent(ipcRenderer, mode, channel, payload) {
  try {
    if (mode === 'guest' && typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost(String(channel || ''), payload ?? null);
      return;
    }
    ipcRenderer.send(String(channel || ''), payload ?? null);
  } catch {}
}

function installExtensionApiHost({ contextBridge, ipcRenderer, mode = 'window' }) {
  // DISABLED: This causes severe blocking with Keplr
  // The complex API shim is too heavy and freezes the thread
  return;
}

  try {
    const flag = '__lumenExtensionApiHostListenerAttached';
    if (!globalThis[flag]) {
      globalThis[flag] = true;
      globalThis.addEventListener(
        'message',
        (event) => {
          try {
            const data = event?.data && typeof event.data === 'object' ? event.data : null;
            if (!data || data.__lumenExtensionHost !== true) return;
            if (safeString(data.type, 64) !== 'navigate') return;
            const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
            const url = safeString(payload.url, 4096);
            if (!url) return;
            if (mode === 'guest') {
              dispatchHostEvent(ipcRenderer, 'guest', 'lumen:navigate', {
                url,
                openInNewTab: !!payload.openInNewTab
              });
              return;
            }
            dispatchHostEvent(ipcRenderer, 'window', 'extensions:shimNavigate', {
              url,
              openInNewTab: !!payload.openInNewTab
            });
          } catch {}
        },
        true
      );
    }
  } catch {}

  contextBridge.executeInMainWorld({
    func: () => {
      // Defer initialization to avoid blocking the thread
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(() => {
          installApiHostDeferred();
        }, 0);
      }
    }
  });

  function installApiHostDeferred() {
    try {
      const root = window;
      if (root.__lumenExtensionApiHostInstalled) return;
      root.__lumenExtensionApiHostInstalled = true;

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
          if (typeof callback === 'function') {
            Promise.resolve().then(() => {
              try {
                callback(value);
              } catch {}
            });
            return;
          }
          return Promise.resolve(value);
        };

        const eventTarget = () => {
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
        };

        const patch = (target, source) => {
          if (!target || typeof target !== 'object') return;
          for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function') {
              if (!target[key] || typeof target[key] !== 'object') target[key] = {};
              patch(target[key], value);
              continue;
            }
            if (target[key] == null) target[key] = value;
          }
        };

        const host = (type, payload) => {
          try {
            root.postMessage(
              { __lumenExtensionHost: true, type, payload: payload && typeof payload === 'object' ? payload : {} },
              '*'
            );
          } catch {}
        };

        const origin = (() => {
          try {
            return new URL(root.location.href).origin || 'chrome-extension://';
          } catch {
            return 'chrome-extension://';
          }
        })();
        const runtimeId = (() => {
          try {
            return new URL(root.location.href).hostname || '';
          } catch {
            return '';
          }
        })();
        const normalizeUrl = (input) => {
          const value = String(Array.isArray(input) ? input[0] : input || '').trim();
          if (!value) return '';
          try {
            if (value.startsWith('/')) {
              return `${origin}/${value.replace(/^\/+/, '')}`;
            }
            return new URL(value, root.location.href).toString();
          } catch {
            return value;
          }
        };

        let nextTabId = 2;
        let nextWindowId = 2;
        let nextNotificationId = 1;
        let offscreenOpen = false;
        const state = {
          storageMemory: new Map(),
          alarms: new Map(),
          notifications: new Map(),
          contextMenus: new Map(),
          userScripts: new Map(),
          dynamicRules: new Map(),
          sidePanel: { openPanelOnActionClick: false }
        };

        const currentTab = () => ({
          id: 1,
          index: 0,
          windowId: 1,
          active: true,
          highlighted: true,
          selected: true,
          status: document.readyState === 'complete' ? 'complete' : 'loading',
          title: document.title || '',
          url: root.location.href,
          incognito: false,
          pinned: false,
          discarded: false,
          autoDiscardable: false,
          audible: false,
          mutedInfo: { muted: false }
        });
        const currentWindow = () => ({
          id: 1,
          focused: typeof document.hasFocus === 'function' ? !!document.hasFocus() : true,
          top: 0,
          left: 0,
          width: Number(root.innerWidth || 0),
          height: Number(root.innerHeight || 0),
          type: 'popup',
          state: 'normal',
          incognito: false,
          alwaysOnTop: false,
          tabs: [currentTab()]
        });
        const sender = () => ({ id: runtimeId, origin: root.location.origin, url: root.location.href, tab: currentTab() });
        const callListeners = async (target, message, currentSender) => {
          if (!target?.listeners?.size) return undefined;
          for (const listener of Array.from(target.listeners)) {
            let responded = false;
            let responseValue;
            const sendResponse = (value) => {
              responded = true;
              responseValue = value;
            };
            const result = listener(message, currentSender, sendResponse);
            if (result && typeof result.then === 'function') {
              const awaited = await result;
              if (awaited !== undefined) return awaited;
              if (responded) return responseValue;
              continue;
            }
            if (result !== undefined) return result;
            if (responded) return responseValue;
          }
          return undefined;
        };

        const tabsEvents = { onRemoved: eventTarget(), onUpdated: eventTarget(), onActivated: eventTarget() };
        const windowsEvents = { onCreated: eventTarget(), onRemoved: eventTarget(), onFocusChanged: eventTarget() };
        const runtimeEvents = {
          onMessage: eventTarget(),
          onMessageExternal: eventTarget(),
          onConnect: eventTarget(),
          onConnectExternal: eventTarget(),
          onInstalled: eventTarget(),
          onStartup: eventTarget(),
          onSuspend: eventTarget(),
          onSuspendCanceled: eventTarget(),
          onUpdateAvailable: eventTarget()
        };
        const storageEvents = { onChanged: eventTarget() };

        const storagePrefix = (area, key = '') => `__lumenExt__/${runtimeId || 'default'}/${area}/${key}`;
        const readRaw = (area, key) => {
          const fullKey = storagePrefix(area, key);
          try {
            const raw = root.localStorage?.getItem?.(fullKey);
            if (raw != null) return raw;
          } catch {}
          return state.storageMemory.has(fullKey) ? state.storageMemory.get(fullKey) : null;
        };
        const writeRaw = (area, key, raw) => {
          const fullKey = storagePrefix(area, key);
          let wrote = false;
          try {
            root.localStorage?.setItem?.(fullKey, raw);
            wrote = true;
          } catch {}
          if (wrote) state.storageMemory.delete(fullKey);
          else state.storageMemory.set(fullKey, raw);
        };
        const removeRaw = (area, key) => {
          const fullKey = storagePrefix(area, key);
          try {
            root.localStorage?.removeItem?.(fullKey);
          } catch {}
          state.storageMemory.delete(fullKey);
        };
        const snapshot = (area) => {
          const prefix = storagePrefix(area);
          const out = {};
          try {
            if (root.localStorage) {
              for (let i = 0; i < root.localStorage.length; i += 1) {
                const key = root.localStorage.key(i);
                if (typeof key !== 'string' || !key.startsWith(prefix)) continue;
                const raw = root.localStorage.getItem(key);
                try {
                  const parsed = JSON.parse(raw);
                  out[key.slice(prefix.length)] = cloneValue(parsed.value);
                } catch {}
              }
            }
          } catch {}
          for (const [key, raw] of state.storageMemory.entries()) {
            if (!key.startsWith(prefix) || Object.prototype.hasOwnProperty.call(out, key.slice(prefix.length))) continue;
            try {
              const parsed = JSON.parse(raw);
              out[key.slice(prefix.length)] = cloneValue(parsed.value);
            } catch {}
          }
          return out;
        };
        const pick = (snap, keys) => {
          if (keys == null) return cloneValue(snap);
          if (typeof keys === 'string') return Object.prototype.hasOwnProperty.call(snap, keys) ? { [keys]: cloneValue(snap[keys]) } : {};
          if (Array.isArray(keys)) {
            const out = {};
            for (const key of keys) if (Object.prototype.hasOwnProperty.call(snap, String(key))) out[String(key)] = cloneValue(snap[String(key)]);
            return out;
          }
          if (keys && typeof keys === 'object') {
            const out = {};
            for (const [key, fallback] of Object.entries(keys)) {
              out[key] = Object.prototype.hasOwnProperty.call(snap, key) ? cloneValue(snap[key]) : cloneValue(fallback);
            }
            return out;
          }
          return {};
        };
        const storageArea = (area) => ({
          get(keys, callback) {
            return asyncResult(pick(snapshot(area), keys), callback);
          },
          set(items, callback) {
            const changes = {};
            for (const [key, value] of Object.entries(items && typeof items === 'object' ? items : {})) {
              const prevRaw = readRaw(area, key);
              const nextRaw = JSON.stringify({ value });
              if (prevRaw === nextRaw) continue;
              writeRaw(area, key, nextRaw);
              changes[key] = { oldValue: prevRaw ? JSON.parse(prevRaw).value : undefined, newValue: cloneValue(value) };
            }
            if (Object.keys(changes).length) storageEvents.onChanged.dispatch(changes, area);
            return asyncResult(undefined, callback);
          },
          remove(keys, callback) {
            const list = Array.isArray(keys) ? keys.map(String) : [String(keys)];
            const changes = {};
            for (const key of list) {
              const prevRaw = readRaw(area, key);
              if (prevRaw == null) continue;
              removeRaw(area, key);
              changes[key] = { oldValue: JSON.parse(prevRaw).value, newValue: undefined };
            }
            if (Object.keys(changes).length) storageEvents.onChanged.dispatch(changes, area);
            return asyncResult(undefined, callback);
          },
          clear(callback) {
            const snap = snapshot(area);
            const changes = {};
            for (const [key, value] of Object.entries(snap)) {
              removeRaw(area, key);
              changes[key] = { oldValue: cloneValue(value), newValue: undefined };
            }
            if (Object.keys(changes).length) storageEvents.onChanged.dispatch(changes, area);
            return asyncResult(undefined, callback);
          },
          getBytesInUse(keys, callback) {
            let bytes = 0;
            try {
              bytes = new TextEncoder().encode(JSON.stringify(pick(snapshot(area), keys))).length;
            } catch {}
            return asyncResult(bytes, callback);
          }
        });

        const runtimeApi = {
          id: runtimeId,
          lastError: null,
          getURL(path = '') {
            const normalized = String(path || '').replace(/^\/+/, '');
            return normalized ? `${origin}/${normalized}` : `${origin}/`;
          },
          getManifest() {
            try {
              const request = new XMLHttpRequest();
              request.open('GET', `${origin}/manifest.json`, false);
              request.send(null);
              if (request.status >= 200 && request.status < 400 && request.responseText) return JSON.parse(request.responseText);
            } catch {}
            return {};
          },
          getBackgroundPage(callback) {
            return asyncResult(null, callback);
          },
          getBrowserInfo(callback) {
            return asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback);
          },
          getPlatformInfo(callback) {
            const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
            return asyncResult({ os, arch: /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64', nacl_arch: 'x86-64' }, callback);
          },
          openOptionsPage(callback) {
            return asyncResult(undefined, callback);
          },
          reload() {
            try { root.location.reload(); } catch {}
          },
          connect(extensionIdOrConnectInfo, connectInfo) {
            const info = extensionIdOrConnectInfo && typeof extensionIdOrConnectInfo === 'object' ? extensionIdOrConnectInfo : connectInfo;
            const port = { name: String(info?.name || ''), sender: sender(), onMessage: eventTarget(), onDisconnect: eventTarget(), disconnect() { this.onDisconnect.dispatch(); }, postMessage(message) { this.onMessage.dispatch(message, this.sender); } };
            Promise.resolve().then(() => runtimeEvents.onConnect.dispatch(port));
            return port;
          },
          sendMessage(extensionIdOrMessage, messageOrOptions, optionsOrCallback, maybeCallback) {
            let message = extensionIdOrMessage;
            let callback = maybeCallback;
            if (typeof extensionIdOrMessage === 'string' && arguments.length >= 2) {
              message = messageOrOptions;
              callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
            } else if (typeof messageOrOptions === 'function') {
              callback = messageOrOptions;
            } else if (typeof optionsOrCallback === 'function') {
              callback = optionsOrCallback;
            }
            const promise = callListeners(runtimeEvents.onMessage, message, sender());
            if (typeof callback === 'function') {
              promise.then((value) => callback(value)).catch(() => callback());
              return;
            }
            return promise;
          },
          requestUpdateCheck(callback) {
            return asyncResult({ status: 'no_update' }, callback);
          },
          setUninstallURL(url, callback) {
            return asyncResult(undefined, callback);
          },
          onMessage: runtimeEvents.onMessage,
          onMessageExternal: runtimeEvents.onMessageExternal,
          onConnect: runtimeEvents.onConnect,
          onConnectExternal: runtimeEvents.onConnectExternal,
          onInstalled: runtimeEvents.onInstalled,
          onStartup: runtimeEvents.onStartup,
          onSuspend: runtimeEvents.onSuspend,
          onSuspendCanceled: runtimeEvents.onSuspendCanceled,
          onUpdateAvailable: runtimeEvents.onUpdateAvailable
        };

        const tabsApi = {
          TAB_ID_NONE: -1,
          create(details, callback) {
            const url = normalizeUrl(details?.url);
            const tab = { ...currentTab(), id: nextTabId++, active: !(details && details.active === false), url: url || currentTab().url };
            if (url) host('navigate', { url, openInNewTab: true });
            return asyncResult(tab, callback);
          },
          get(tabId, callback) {
            return asyncResult(currentTab(), callback);
          },
          query(queryInfo, callback) {
            let tabs = [currentTab()];
            if (queryInfo?.active === false) tabs = [];
            if (queryInfo?.url) {
              const patterns = Array.isArray(queryInfo.url) ? queryInfo.url : [queryInfo.url];
              const match = patterns.some((pattern) => {
                const text = String(pattern || '');
                return text === currentTab().url || (text.endsWith('*') && currentTab().url.startsWith(text.slice(0, -1)));
              });
              tabs = match ? tabs : [];
            }
            return asyncResult(tabs, callback);
          },
          update(tabIdOrProps, propsOrCallback, maybeCallback) {
            const props = tabIdOrProps && typeof tabIdOrProps === 'object' && !Array.isArray(tabIdOrProps) ? tabIdOrProps : propsOrCallback || {};
            const callback = typeof propsOrCallback === 'function' ? propsOrCallback : maybeCallback;
            const url = normalizeUrl(props?.url);
            const tab = { ...currentTab(), url: url || currentTab().url };
            if (url) host('navigate', { url, openInNewTab: false });
            return asyncResult(tab, callback);
          },
          reload(tabId, reloadProperties, callback) {
            try { root.location.reload(); } catch {}
            return asyncResult(undefined, callback);
          },
          executeScript(tabIdOrDetails, detailsOrCallback, maybeCallback) {
            const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
            return asyncResult([], callback);
          },
          sendMessage(tabId, message, optionsOrCallback, maybeCallback) {
            const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
            const promise = callListeners(runtimeEvents.onMessage, message, sender());
            if (typeof callback === 'function') {
              promise.then((value) => callback(value)).catch(() => callback());
              return;
            }
            return promise;
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
            return asyncResult(currentWindow(), callback);
          },
          get(windowId, getInfoOrCallback, maybeCallback) {
            const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
            return asyncResult(currentWindow(), callback);
          },
          getAll(getInfoOrCallback, maybeCallback) {
            const callback = typeof getInfoOrCallback === 'function' ? getInfoOrCallback : maybeCallback;
            return asyncResult([currentWindow()], callback);
          },
          create(details, callback) {
            const url = normalizeUrl(details?.url);
            const win = { ...currentWindow(), id: nextWindowId++, tabs: [{ ...currentTab(), id: nextTabId++, windowId: nextWindowId - 1, url: url || currentTab().url }] };
            if (url) host('navigate', { url, openInNewTab: true });
            Promise.resolve().then(() => windowsEvents.onCreated.dispatch(win));
            return asyncResult(win, callback);
          },
          update(windowId, updateInfo, callback) {
            return asyncResult(currentWindow(), callback);
          },
          remove(windowId, callback) {
            Promise.resolve().then(() => windowsEvents.onRemoved.dispatch(windowId));
            return asyncResult(undefined, callback);
          },
          onCreated: windowsEvents.onCreated,
          onRemoved: windowsEvents.onRemoved,
          onFocusChanged: windowsEvents.onFocusChanged
        };

        const stub = (value) => function (...args) {
          const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
          return asyncResult(cloneValue(value), callback);
        };

        const storageApi = { local: storageArea('local'), sync: storageArea('sync'), session: storageArea('session'), onChanged: storageEvents.onChanged };
        const permissionsApi = {
          contains(details, callback) {
            const manifest = runtimeApi.getManifest();
            const declared = new Set([...(manifest.permissions || []), ...(manifest.host_permissions || []), ...(manifest.optional_permissions || []), ...(manifest.optional_host_permissions || [])]);
            const requested = [...((details && details.permissions) || []), ...((details && details.origins) || [])];
            return asyncResult(requested.every((item) => declared.has(item)), callback);
          },
          getAll(callback) {
            const manifest = runtimeApi.getManifest();
            return asyncResult({ permissions: (manifest.permissions || []).slice(), origins: (manifest.host_permissions || []).slice() }, callback);
          },
          request: stub(true),
          remove: stub(false)
        };
        const idleApi = {
          queryState(delay, callback) {
            const state = root.document?.hidden || (typeof root.document?.hasFocus === 'function' && !root.document.hasFocus()) ? 'idle' : 'active';
            return asyncResult(state, callback);
          },
          setDetectionInterval: stub(undefined),
          onStateChanged: eventTarget()
        };

        const namespaces = {
          action: { openPopup: stub(undefined), enable: stub(undefined), disable: stub(undefined), setBadgeText: stub(undefined), getBadgeText: stub(''), setBadgeBackgroundColor: stub(undefined), setTitle: stub(undefined), getTitle: stub(document.title || ''), setIcon: stub(undefined), onClicked: eventTarget() },
          alarms: { create(nameOrInfo, info) { const name = typeof nameOrInfo === 'string' ? nameOrInfo : `alarm-${state.alarms.size + 1}`; state.alarms.set(name, { name, info: cloneValue(typeof nameOrInfo === 'object' ? nameOrInfo : info || {}) }); }, get(name, callback) { return asyncResult(state.alarms.get(String(name || '')), callback); }, getAll(callback) { return asyncResult(Array.from(state.alarms.values()).map(cloneValue), callback); }, clear(name, callback) { const ok = state.alarms.delete(String(name || '')); return asyncResult(ok, callback); }, clearAll(callback) { const ok = state.alarms.size > 0; state.alarms.clear(); return asyncResult(ok, callback); }, onAlarm: eventTarget() },
          commands: { getAll: stub([]), onCommand: eventTarget() },
          contextMenus: { create(details, callback) { const id = details?.id != null ? String(details.id) : `menu-${state.contextMenus.size + 1}`; state.contextMenus.set(id, cloneValue(details || {})); if (typeof callback === 'function') callback(); return id; }, update(id, details, callback) { state.contextMenus.set(String(id || ''), { ...(state.contextMenus.get(String(id || '')) || {}), ...cloneValue(details || {}) }); return asyncResult(undefined, callback); }, remove(id, callback) { state.contextMenus.delete(String(id || '')); return asyncResult(undefined, callback); }, removeAll(callback) { state.contextMenus.clear(); return asyncResult(undefined, callback); }, onClicked: eventTarget() },
          declarativeNetRequest: { updateDynamicRules(options, callback) { for (const id of options?.removeRuleIds || []) state.dynamicRules.delete(Number(id)); for (const rule of options?.addRules || []) if (Number.isFinite(Number(rule?.id))) state.dynamicRules.set(Number(rule.id), cloneValue(rule)); return asyncResult(undefined, callback); }, getDynamicRules(callback) { return asyncResult(Array.from(state.dynamicRules.values()).map(cloneValue), callback); }, getAvailableStaticRuleCount: stub(0), isRegexSupported: stub({ isSupported: true }) },
          extension: { getURL: runtimeApi.getURL, getViews() { return [root]; }, getBackgroundPage: stub(null), lastError: null },
          identity: { getRedirectURL(path = '') { const normalized = String(path || '').replace(/^\/+/, ''); return normalized ? `https://lumen.invalid/identity/${normalized}` : 'https://lumen.invalid/identity'; }, getProfileUserInfo: stub({ email: '', id: '' }), launchWebAuthFlow(details, callback) { return asyncResult(String(details?.url || ''), callback); } },
          idle: idleApi,
          management: { getSelf(callback) { const manifest = runtimeApi.getManifest(); return asyncResult({ id: runtimeId, name: manifest.name || 'Extension', shortName: manifest.short_name || manifest.name || 'Extension', enabled: true, installType: 'development', mayDisable: true, type: 'extension', version: manifest.version || '0.0.0' }, callback); }, get(id, callback) { return namespaces.management.getSelf(callback); }, getAll: stub([]), getPermissionWarningsById: stub([]), getPermissionWarningsByManifest: stub([]), onEnabled: eventTarget(), onDisabled: eventTarget() },
          notifications: { create(idOrDetails, detailsOrCallback, maybeCallback) { const id = typeof idOrDetails === 'string' ? idOrDetails : `notification-${nextNotificationId++}`; const details = typeof idOrDetails === 'object' && idOrDetails != null ? idOrDetails : detailsOrCallback || {}; const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback; state.notifications.set(id, cloneValue(details)); return asyncResult(id, callback); }, update(id, details, callback) { const key = String(id || ''); if (state.notifications.has(key)) state.notifications.set(key, { ...state.notifications.get(key), ...cloneValue(details || {}) }); return asyncResult(state.notifications.has(key), callback); }, clear(id, callback) { const ok = state.notifications.delete(String(id || '')); return asyncResult(ok, callback); }, getAll(callback) { return asyncResult(Object.fromEntries(Array.from(state.notifications.entries()).map(([id, value]) => [id, cloneValue(value)])), callback); }, getPermissionLevel: stub('granted'), onClicked: eventTarget(), onClosed: eventTarget(), onButtonClicked: eventTarget() },
          offscreen: { createDocument(options, callback) { offscreenOpen = true; return asyncResult(undefined, callback); }, closeDocument(callback) { offscreenOpen = false; return asyncResult(undefined, callback); }, hasDocument(callback) { return asyncResult(offscreenOpen, callback); } },
          permissions: permissionsApi,
          runtime: runtimeApi,
          scripting: { executeScript: stub([]), insertCSS: stub(undefined), removeCSS: stub(undefined) },
          sidePanel: { open: stub(undefined), setPanelBehavior(behavior, callback) { state.sidePanel.openPanelOnActionClick = !!behavior?.openPanelOnActionClick; return asyncResult(undefined, callback); }, getPanelBehavior(callback) { return asyncResult(cloneValue(state.sidePanel), callback); }, setOptions: stub(undefined), getOptions: stub({}) },
          storage: storageApi,
          tabs: tabsApi,
          userScripts: { register(scripts, callback) { for (const script of Array.isArray(scripts) ? scripts : []) { const id = String(script?.id || `script-${state.userScripts.size + 1}`); state.userScripts.set(id, cloneValue(script)); } return asyncResult(undefined, callback); }, getScripts(filter, callback) { return asyncResult(Array.from(state.userScripts.values()).map(cloneValue), callback); }, update(scripts, callback) { for (const script of Array.isArray(scripts) ? scripts : []) { const id = String(script?.id || ''); if (!id) continue; state.userScripts.set(id, { ...(state.userScripts.get(id) || {}), ...cloneValue(script) }); } return asyncResult(undefined, callback); }, unregister(filter, callback) { if (Array.isArray(filter?.ids)) for (const id of filter.ids) state.userScripts.delete(String(id || '')); else state.userScripts.clear(); return asyncResult(undefined, callback); } },
          webNavigation: { onBeforeNavigate: eventTarget(), onCommitted: eventTarget(), onCompleted: eventTarget(), onErrorOccurred: eventTarget() },
          webRequest: { onBeforeRequest: eventTarget(), onBeforeSendHeaders: eventTarget(), onSendHeaders: eventTarget(), onHeadersReceived: eventTarget(), onResponseStarted: eventTarget(), onCompleted: eventTarget(), onErrorOccurred: eventTarget() },
          windows: windowsApi
        };

        if (!root.chrome || typeof root.chrome !== 'object') root.chrome = {};
        patch(root.chrome, namespaces);
        let browserNamespace = root.browser;
        if (!browserNamespace || typeof browserNamespace !== 'object') {
          browserNamespace = {};
          try { root.browser = browserNamespace; } catch {}
        }
        patch(browserNamespace, namespaces);
        try {
          let assigned = browserNamespace;
          Object.defineProperty(root, 'browser', {
            configurable: true,
            enumerable: true,
            get() { return assigned; },
            set(value) { assigned = value && typeof value === 'object' ? value : {}; patch(assigned, namespaces); }
          });
          patch(root.browser, namespaces);
        } catch {}
      } catch {}
    }
  }
}

module.exports = {
  installExtensionApiHost
};
