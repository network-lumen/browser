// ============================================================================
// electron/utils/webview.cjs
//
// Stateless helpers shared by the webview-facing preload scripts
// (electron/webview-preload.cjs primarily). Everything here is a pure
// function of its arguments (or of the current page's `location`/`document`)
// — nothing in this file holds mutable module-level state, so it is safe to
// `require()` from any preload context.
//
// NOTE: this file is loaded via `require('./utils/webview.cjs')` from a
// `.cjs` file, so it MUST stay plain CommonJS (`function ... {}` +
// `module.exports = {...}` at the bottom). Do not use `export`/`import`
// syntax here — Node treats `.cjs` as CommonJS regardless of the nearest
// package.json's `"type"` field, and `export` is a hard SyntaxError in that
// mode (this file used to be broken exactly this way).
// ============================================================================

// ---------------------------------------------------------------------------
// Section: primitive safety helpers
// ---------------------------------------------------------------------------

/**
 * Coerce a value to a trimmed string, capped at `maxLen` characters.
 * Used everywhere untrusted/renderer-provided input crosses into an IPC call.
 */
function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/** Clamp a delay (ms) to a sane [250, 30000] range, falling back if not finite. */
function safeDelayMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(250, Math.min(30_000, Math.trunc(n)));
}

/** Clamp a count to [0, max], falling back if not finite. */
function safeCount(v, fallback, max = 16) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

/** Normalize a user-supplied pubsub reconnect-delay schedule (ms), capped to 8 entries. */
function normalizeReconnectDelays(input) {
  const fallback = [1000, 2000, 5000];
  if (!Array.isArray(input) || !input.length) return fallback;
  const out = input
    .map((v) => safeDelayMs(v, 0))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 8);
  return out.length ? out : fallback;
}

/** Call `fn` if it is actually a function, swallowing any error it throws. */
function callMaybe(fn, ...args) {
  try {
    if (typeof fn === 'function') fn(...args);
  } catch {}
}

// ---------------------------------------------------------------------------
// Section: page / URL context helpers
// ---------------------------------------------------------------------------

/** Current page URL, or '' if `location` is unavailable for any reason. */
function currentHref() {
  try {
    return String(location.href || '');
  } catch {
    return '';
  }
}

function isChromeExtensionUrl(input = currentHref()) {
  return /^chrome-extension:\/\//i.test(safeString(input, 4096));
}

/** True when this preload instance runs inside a `<webview>` guest (has `sendToHost`). */
function isGuestRendererContext(ipcRenderer) {
  return typeof ipcRenderer.sendToHost === 'function';
}

/** The extension chrome/browser API shim only makes sense in a webview guest, not a top-level extension window. */
function shouldInjectWebviewExtensionApi(ipcRenderer) {
  return isGuestRendererContext(ipcRenderer) && !isChromeExtensionUrl();
}

/** Origin of `input`, falling back to `fallback` (or reconstructing protocol+host) if `URL` parsing yields no usable origin. */
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

function isLumenUrl(input) {
  return /^lumen:\/\//i.test(safeString(input, 4096));
}

function isChromeWebStoreUrl(href = currentHref()) {
  try {
    const url = new URL(String(href || ''));
    const host = String(url.hostname || '').trim().toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

/**
 * True for `/ipfs/*`, `/ipns/*` paths and subdomain-gateway hosts
 * (e.g. `<cid>.ipfs.localhost:8080`) — the pages `window.lumen` is allowed on.
 */
function isIpfsGatewayUrl(href) {
  try {
    const u = new URL(String(href || ''));
    const p = String(u.pathname || '/');
    if (p === '/ipfs' || p.startsWith('/ipfs/') || p === '/ipns' || p.startsWith('/ipns/')) return true;

    const host = String(u.hostname || '').trim();
    if (!host) return false;
    return /^([a-z0-9]+)\.(ipfs|ipns)\./i.test(host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Throws if the current page is not an `/ipfs/*` or `/ipns/*` page. Every
 * `window.lumen` action function calls this first — it is the boundary that
 * keeps the API off arbitrary pages.
 */
function ensureLumenSite() {
  if (!isIpfsGatewayUrl(currentHref())) {
    throw new Error('window.lumen is only available on /ipfs/* or /ipns/* pages.');
  }
}

/** 32-char extension id from a `chrome-extension://<id>/...` href, defaulting to Lumen's built-in fallback id. */
function getExtensionRuntimeId() {
  try {
    const href = currentHref();
    if (/^chrome-extension:\/\//i.test(href)) {
      return new URL(href).hostname || 'hbfagpiekcachnbiafmlimmcknaoilnh';
    }
  } catch {}
  return 'hbfagpiekcachnbiafmlimmcknaoilnh';
}

/** `chrome-extension://<id>` origin for the current page, or for the fallback runtime id. */
function getExtensionOrigin() {
  try {
    const href = currentHref();
    if (/^chrome-extension:\/\//i.test(href)) {
      return getUrlOrigin(href, `chrome-extension://${getExtensionRuntimeId()}`);
    }
  } catch {}
  return `chrome-extension://${getExtensionRuntimeId()}`;
}

/** `{runtimeId, origin, pageUrl}` bundle used to identify the calling extension to the main process. */
function getExtensionRequestContext() {
  return {
    runtimeId: getExtensionRuntimeId(),
    origin: getExtensionOrigin(),
    pageUrl: currentHref()
  };
}

// ---------------------------------------------------------------------------
// Section: wallet / bech32 helpers
// ---------------------------------------------------------------------------

/** Bech32 human-readable-part prefix (text before the first `'1'`) of an address, defaulting to `lmn`. */
function prefixFromAddress(address) {
  const value = safeString(address, 256);
  const index = value.indexOf('1');
  return index > 0 ? value.slice(0, index).toLowerCase() : 'lmn';
}

/** Normalize any of Uint8Array / Buffer / plain array / `{type:'Buffer',data}` / base64 string into a Uint8Array. */
function normalizeBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (Array.isArray(value)) {
    return Uint8Array.from(
      value.map((item) => {
        const n = Number(item);
        return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.trunc(n))) : 0;
      })
    );
  }
  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Uint8Array.from(value.data);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Uint8Array();
    try {
      return new Uint8Array(Buffer.from(trimmed, 'base64'));
    } catch {
      return new Uint8Array();
    }
  }
  return new Uint8Array();
}

/** Fill in a Keplr/Leap-style `bech32Config` object, deriving val/cons prefixes from the account prefix when absent. */
function buildBech32Config(input, fallbackPrefix) {
  const prefix = safeString(
    input?.bech32PrefixAccAddr ||
      input?.accountAddress ||
      fallbackPrefix ||
      'lmn',
    64
  ).toLowerCase() || 'lmn';
  const validatorPrefix = safeString(input?.bech32PrefixValAddr || `${prefix}valoper`, 64).toLowerCase();
  const consensusPrefix = safeString(input?.bech32PrefixConsAddr || `${prefix}valcons`, 64).toLowerCase();
  return {
    bech32PrefixAccAddr: prefix,
    bech32PrefixAccPub: safeString(input?.bech32PrefixAccPub || `${prefix}pub`, 64).toLowerCase(),
    bech32PrefixValAddr: validatorPrefix,
    bech32PrefixValPub: safeString(input?.bech32PrefixValPub || `${validatorPrefix}pub`, 64).toLowerCase(),
    bech32PrefixConsAddr: consensusPrefix,
    bech32PrefixConsPub: safeString(input?.bech32PrefixConsPub || `${consensusPrefix}pub`, 64).toLowerCase()
  };
}

// ---------------------------------------------------------------------------
// Section: main-process round-trips (take `ipcRenderer` explicitly — this
// module holds no reference to it, keeping every function here testable
// without an Electron runtime)
// ---------------------------------------------------------------------------

/**
 * Ask the main process whether real Keplr/Leap/window.ethereum extensions are
 * loaded, so the caller knows whether to inject its own fallback providers.
 * Synchronous by design: providers must be present before page scripts run.
 */
function getProviderFallbackStateSync(ipcRenderer) {
  try {
    const state = ipcRenderer.sendSync('extensions:getProviderFallbackStateSync');
    if (state && typeof state === 'object') return state;
  } catch {
    // ignore
  }
  return { keplr: true, leap: true, ethereum: true };
}

/** Base URL of the local IPFS gateway, empty string if unavailable. */
async function getLocalGatewayBase(ipcRenderer) {
  try {
    const base = await ipcRenderer.invoke('lumenSite:getLocalGatewayBase');
    return safeString(base, 1024);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Section: window.lumen uniform response wrapper
//
// Every `window.lumen.*` method is wrapped with `wrapLumenApiCall` so callers
// can always rely on the exact same shape:
//   success -> { ok: true, data: <value> }               (or the value itself
//               if it already looked like { ok, ... })
//   failure -> { ok: false, error: '<message, <=512 chars>' }
// No `window.lumen` method should ever throw across the contextBridge or
// resolve to a bare, unwrapped value — this is the single choke point that
// guarantees that.
// ---------------------------------------------------------------------------

/** If `result` already looks like `{ok, ...}`, pass it through; otherwise wrap it as `{ok:true, data:result}`. */
function normalizeLumenApiResult(result) {
  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.prototype.hasOwnProperty.call(result, 'ok')
  ) {
    return result;
  }
  return { ok: true, data: result };
}

/** Build the `{ok:false, error}` shape from a caught error (or fallback message), capped at 512 chars. */
function normalizeLumenApiError(error, fallbackMessage) {
  return {
    ok: false,
    error: safeString(error?.message || error || fallbackMessage || 'failed', 512)
  };
}

/**
 * Wrap an async `window.lumen` action function so it always resolves to the
 * `{ok, data?, error?}` shape and never throws/rejects across the
 * contextBridge. `fallbackMessage` is used as the `error` string when the
 * thrown value has no usable message.
 *
 * @param {(...args:any[]) => Promise<any>} fn
 * @param {string} fallbackMessage
 * @returns {(...args:any[]) => Promise<{ok:boolean,data?:any,error?:string}>}
 */
function wrapLumenApiCall(fn, fallbackMessage) {
  return async (...args) => {
    try {
      const result = await fn(...args);
      return normalizeLumenApiResult(result);
    } catch (error) {
      return normalizeLumenApiError(error, fallbackMessage);
    }
  };
}

// ---------------------------------------------------------------------------
// Section: lumen:// / /ipfs/, /ipns/ path parsing
// ---------------------------------------------------------------------------

/**
 * Parse `lumen://ipfs/<cid>/rest`, `ipfs/<cid>/rest`, `lumen://ipns/<name>/rest`
 * etc. into `{kind: 'ipfs'|'ipns'|'', id, rest}`. Returns an all-empty object
 * when the input doesn't match either shape.
 */
function parseLumenIpfsOrIpns(input) {
  const raw = safeString(input, 4096);
  if (!raw) return { kind: '', id: '', rest: '' };
  const s = raw.replace(/^lumen:\/\//i, '');
  let m = s.match(/^(ipfs)\/([^/?#]+)([^?#]*)/i);
  if (m) return { kind: 'ipfs', id: m[2] || '', rest: m[3] || '' };
  m = s.match(/^(ipns)\/([^/?#]+)([^?#]*)/i);
  if (m) return { kind: 'ipns', id: m[2] || '', rest: m[3] || '' };
  return { kind: '', id: '', rest: '' };
}

// ---------------------------------------------------------------------------
// Section: generic value / async helpers (used by the chrome/browser shim)
// ---------------------------------------------------------------------------

/** Deep-clone a value (structuredClone if available, else JSON round-trip), returning the original on failure. */
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

/** Resolve `value` either via `callback(value)` (async, next microtask) or as a Promise, matching chrome.* dual-style APIs. */
function asyncResult(value, callback) {
  if (typeof callback === 'function') {
    Promise.resolve().then(() => {
      try {
        callback(value);
      } catch {}
    });
    return;
  }
  return Promise.resolve(value);
}

/** Drop trailing `undefined` entries from an arguments array (from `trimTrailingUndefined([1, undefined, undefined])`). */
function trimTrailingUndefined(args) {
  const trimmed = Array.isArray(args) ? args.slice() : [];
  while (trimmed.length && trimmed[trimmed.length - 1] === undefined) {
    trimmed.pop();
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Section: chrome.runtime.sendMessage / connect call-shape normalization
//
// chrome.runtime.sendMessage has several overloads
// (message | extensionId,message | message,options | extensionId,message,options,
// each optionally followed by a callback) and native Electron's extension
// runtime doesn't always resolve/callback the same way a real Chrome does.
// These helpers normalize argument lists and retry transiently-failing calls
// (e.g. a service worker that hasn't woken up yet).
// ---------------------------------------------------------------------------

const DEFAULT_RUNTIME_SENDMESSAGE_TIMEOUT_MS = 10_000;

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

/** Split a raw `sendMessage(...)` arguments list into `{args, callback}`, trimming to the longest valid overload. */
function normalizeRuntimeSendMessageCall(rawArgs) {
  const args = trimTrailingUndefined(Array.from(rawArgs || []));
  let callback;

  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  const normalizedArgs = trimTrailingUndefined(args);

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

/** Extract the actual message payload object out of a normalized `sendMessage` args array. */
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

/** True when the message matches Lumen's internal extension-port envelope shape (`{port, type, msg}`). */
function isInternalExtensionRuntimeMessage(args) {
  const message = getRuntimeSendMessagePayload(args);
  return !!(
    message &&
    typeof message.port === 'string' &&
    typeof message.type === 'string' &&
    Object.prototype.hasOwnProperty.call(message, 'msg')
  );
}

/** Shape a raw `sendMessage` response consistently, wrapping internal-envelope replies as `{return: value}`. */
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

  return { return: response };
}

/** Normalize `runtime.connect(extensionId?, connectInfo?)` overloads down to a plain args array. */
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

/** Normalize `tabs.sendMessage(tabId, message, options?, callback?)` into `{args, callback}`. */
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

/**
 * Call a native `chrome.*`/`browser.*` method if present, falling back to
 * `fallbackValue()` otherwise. Supports both callback-style and Promise-style
 * native methods transparently, and always resolves (never throws).
 */
function callNativeMethod(nativeMethod, nativeThis, args, callback, fallbackValue, normalizeValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const finalizeValue =
    typeof normalizeValue === 'function'
      ? (value) => {
          try {
            return normalizeValue(value, fallback);
          } catch {
            const fallbackResult = fallback();
            return fallbackResult !== null && fallbackResult !== undefined ? fallbackResult : {};
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

/**
 * `chrome.runtime.sendMessage` wrapper with retry-with-backoff for the
 * transient "receiving end does not exist" family of errors (a service
 * worker/background page that hasn't finished waking up yet).
 */
function callNativeRuntimeSendMessage(
  nativeMethod,
  nativeThis,
  rawArgs,
  fallbackValue,
  timeoutMs = DEFAULT_RUNTIME_SENDMESSAGE_TIMEOUT_MS
) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const { args, callback } = normalizeRuntimeSendMessageCall(rawArgs);
  const retryDelaysMs = [0, 40, 80, 140, 220, 320];
  const transientPatterns = [
    'receiving end does not exist',
    'message port closed',
    'could not establish connection',
    'port closed before a response was received',
    'service worker context shut down'
  ];

  if (typeof nativeMethod !== 'function') {
    return asyncResult(normalizeRuntimeSendMessageResponse(args, undefined, fallback), callback);
  }

  const finalizeResponse = (value) =>
    normalizeRuntimeSendMessageResponse(args, value, fallback);

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
      }, timeoutMs);
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

    return finalizeResponse(lastOutcome?.value);
  };

  if (typeof callback === 'function') {
    runWithRetries()
      .then((value) => {
        try {
          callback(finalizeResponse(value));
        } catch {}
      })
      .catch(() => {
        try {
          callback(finalizeResponse(undefined));
        } catch {}
      });
    return;
  }

  return runWithRetries()
    .then((value) => finalizeResponse(value))
    .catch(() => finalizeResponse(undefined));
}

/**
 * Fallback path for `runtime.sendMessage` when no native `chrome.runtime` is
 * available in the isolated world: re-dispatches the call against
 * `window.chrome`/`window.browser` in the page's main world via
 * `contextBridge.executeInMainWorld`.
 */
function callMainWorldRuntimeSendMessage(contextBridge, rawArgs, fallbackValue) {
  const fallback =
    typeof fallbackValue === 'function' ? fallbackValue : () => cloneValue(fallbackValue);
  const { args, callback } = normalizeRuntimeSendMessageCall(rawArgs);

  const invokeMainWorld = async () => {
    if (typeof contextBridge.executeInMainWorld !== 'function') {
      return normalizeRuntimeSendMessageResponse(args, undefined, fallback);
    }

    try {
      const result = contextBridge.executeInMainWorld({
        func: (invokeArgs) => {
          const root = window;
          const runtime =
            root.chrome?.runtime && typeof root.chrome.runtime.sendMessage === 'function'
              ? root.chrome.runtime
              : root.browser?.runtime && typeof root.browser.runtime.sendMessage === 'function'
                ? root.browser.runtime
                : null;

          if (!runtime || typeof runtime.sendMessage !== 'function') {
            return undefined;
          }

          return runtime.sendMessage(...(Array.isArray(invokeArgs) ? invokeArgs : []));
        },
        args: [args]
      });

      if (result && typeof result.then === 'function') {
        const resolved = await result;
        return normalizeRuntimeSendMessageResponse(args, resolved, fallback);
      }

      return normalizeRuntimeSendMessageResponse(args, result, fallback);
    } catch {
      return normalizeRuntimeSendMessageResponse(args, undefined, fallback);
    }
  };

  if (typeof callback === 'function') {
    invokeMainWorld()
      .then((value) => {
        try {
          callback(value);
        } catch {}
      })
      .catch(() => {
        try {
          callback(normalizeRuntimeSendMessageResponse(args, undefined, fallback));
        } catch {}
      });
    return;
  }

  return invokeMainWorld();
}

// ---------------------------------------------------------------------------
// Section: minimal chrome.* event emitter + storage helpers
// ---------------------------------------------------------------------------

/** Minimal `chrome.events.Event`-compatible emitter (addListener/removeListener/hasListener/dispatch). */
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

/** Select `keys` (string | string[] | {key: default} | null=all) out of a `chrome.storage` snapshot object. */
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

// ---------------------------------------------------------------------------
// Section: Chrome Web Store "Add to Chrome" detection (DOM helpers)
// ---------------------------------------------------------------------------

/** Nearest ancestor `<a href>` for a click target (handles text-node targets too). */
function closestAnchorWithHref(target) {
  try {
    const el =
      target && target.nodeType === 1
        ? target
        : target && target.parentElement
          ? target.parentElement
          : null;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('a[href]');
  } catch {
    return null;
  }
}

/** Nearest ancestor button/link/`role=button` for a click target. */
function closestInstallTrigger(target) {
  try {
    const el =
      target && target.nodeType === 1
        ? target
        : target && target.parentElement
          ? target.parentElement
          : null;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest('button, a, [role="button"]');
  } catch {
    return null;
  }
}

/** True if `target` is (or is inside) an element whose text looks like a Chrome Web Store install button. */
function looksLikeChromeWebStoreInstallTrigger(target) {
  const button = closestInstallTrigger(target);
  if (!button) return false;

  const text = safeString(
    button.textContent ||
      (typeof button.getAttribute === 'function' ? button.getAttribute('aria-label') : '') ||
      '',
    512
  ).toLowerCase();
  if (!text) return false;

  if (text.includes('import into lumen')) return true;
  if (text.includes('add to chrome')) return true;
  if (text.includes('add to chromium')) return true;
  if (text.includes('add extension')) return true;
  return false;
}

/** 32-letter (a-p) Chrome extension id found in a Web Store href's path or `id`/`extension_id` query param. */
function extractChromeWebStoreIdFromHref(href = currentHref()) {
  const raw = safeString(href, 4096);
  if (!raw) return '';

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return String(direct[1] || '').toLowerCase();

  try {
    const url = new URL(raw);
    const pathname = String(url.pathname || '');
    const segments = pathname
      .split('/')
      .map((segment) => safeString(segment, 128))
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return String(fromPath).toLowerCase();

    const fromQuery =
      safeString(url.searchParams.get('id'), 64) ||
      safeString(url.searchParams.get('extension_id'), 64);
    if (/^[a-p]{32}$/i.test(fromQuery)) return fromQuery.toLowerCase();
  } catch {
    // ignore
  }

  return '';
}

/** `{id, url, title}` for the extension the current Chrome Web Store page is about, or null off-store / without a detectable id. */
function getChromeWebStoreInstallPayload(documentRef = globalThis.document) {
  if (!isChromeWebStoreUrl()) return null;
  const id = extractChromeWebStoreIdFromHref();
  if (!id) return null;

  let title = '';
  try {
    const heading =
      documentRef?.querySelector?.('h1') ||
      documentRef?.querySelector?.('[role="heading"]') ||
      documentRef?.querySelector?.('title');
    title = safeString(heading?.textContent || documentRef?.title || '', 256);
  } catch {
    title = safeString(documentRef?.title || '', 256);
  }

  return { id, url: currentHref(), title };
}

module.exports = {
  // primitive safety helpers
  safeString,
  safeDelayMs,
  safeCount,
  normalizeReconnectDelays,
  callMaybe,
  // page / URL context
  currentHref,
  isChromeExtensionUrl,
  isGuestRendererContext,
  shouldInjectWebviewExtensionApi,
  getUrlOrigin,
  isLumenUrl,
  isChromeWebStoreUrl,
  isIpfsGatewayUrl,
  ensureLumenSite,
  getExtensionRuntimeId,
  getExtensionOrigin,
  getExtensionRequestContext,
  // wallet / bech32
  prefixFromAddress,
  normalizeBytes,
  buildBech32Config,
  // main-process round-trips
  getProviderFallbackStateSync,
  getLocalGatewayBase,
  // window.lumen response wrapper
  normalizeLumenApiResult,
  normalizeLumenApiError,
  wrapLumenApiCall,
  // lumen:// / ipfs / ipns parsing
  parseLumenIpfsOrIpns,
  // generic value / async helpers
  cloneValue,
  asyncResult,
  trimTrailingUndefined,
  // chrome.runtime.sendMessage / connect normalization
  DEFAULT_RUNTIME_SENDMESSAGE_TIMEOUT_MS,
  isRuntimeSendMessageOptions,
  normalizeRuntimeSendMessageCall,
  getRuntimeSendMessagePayload,
  isInternalExtensionRuntimeMessage,
  normalizeRuntimeSendMessageResponse,
  normalizeRuntimeConnectCall,
  normalizeTabsSendMessageCall,
  callNativeMethod,
  callNativeRuntimeSendMessage,
  callMainWorldRuntimeSendMessage,
  // chrome.* event emitter + storage helpers
  createBrowserEvent,
  pickStorageValues,
  // Chrome Web Store DOM detection
  closestAnchorWithHref,
  closestInstallTrigger,
  looksLikeChromeWebStoreInstallTrigger,
  extractChromeWebStoreIdFromHref,
  getChromeWebStoreInstallPayload
};
