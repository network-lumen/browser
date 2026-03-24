const { contextBridge, ipcRenderer } = require('electron');

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeDelayMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(250, Math.min(30_000, Math.trunc(n)));
}

function safeCount(v, fallback, max = 16) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

function normalizeReconnectDelays(input) {
  const fallback = [1000, 2000, 5000];
  if (!Array.isArray(input) || !input.length) return fallback;
  const out = input
    .map((v) => safeDelayMs(v, 0))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 8);
  return out.length ? out : fallback;
}

function callMaybe(fn, ...args) {
  try {
    if (typeof fn === 'function') fn(...args);
  } catch {}
}

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

function isGuestRendererContext() {
  return typeof ipcRenderer.sendToHost === 'function';
}

function shouldInjectWebviewExtensionApi() {
  return isGuestRendererContext() && !isChromeExtensionUrl();
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

function prefixFromAddress(address) {
  const value = safeString(address, 256);
  const index = value.indexOf('1');
  return index > 0 ? value.slice(0, index).toLowerCase() : 'lmn';
}

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

function toBase64(value) {
  return Buffer.from(normalizeBytes(value)).toString('base64');
}

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

function getProviderFallbackStateSync() {
  try {
    const state = ipcRenderer.sendSync('extensions:getProviderFallbackStateSync');
    if (state && typeof state === 'object') return state;
  } catch {
    // ignore
  }
  return { keplr: true, leap: true, ethereum: true };
}

const providerFallbackState = getProviderFallbackStateSync();
const suggestedChains = new Map();

async function getActiveWalletProfile() {
  const profile = await ipcRenderer.invoke('profiles:getActive');
  if (!profile || !profile.id) {
    throw new Error('active_profile_missing');
  }
  const walletAddress = safeString(profile.walletAddress || profile.address || '', 256);
  if (!walletAddress) {
    throw new Error('wallet_address_missing');
  }
  return {
    profileId: safeString(profile.id, 128),
    walletAddress,
    profile
  };
}

async function resolveChainContext(chainIdInput) {
  const requestedChainId = safeString(chainIdInput, 128);
  const activeProfile = await getActiveWalletProfile();
  const fallbackPrefix = prefixFromAddress(activeProfile.walletAddress || 'lmn');
  const hinted = requestedChainId ? suggestedChains.get(requestedChainId) || null : null;

  if (hinted) {
    return {
      chainId: hinted.chainId,
      chainName: hinted.chainName,
      bech32Config: buildBech32Config(hinted.bech32Config, fallbackPrefix),
      profile: activeProfile
    };
  }

  let networkChainId = '';
  try {
    const state = await ipcRenderer.invoke('net:getState');
    networkChainId = safeString(state?.state?.networkChainId, 128);
  } catch {
    // ignore
  }

  return {
    chainId: requestedChainId || networkChainId || 'lumen',
    chainName: requestedChainId || networkChainId || 'Lumen',
    bech32Config: buildBech32Config({}, fallbackPrefix),
    profile: activeProfile
  };
}

async function getWalletAccountsForChain(chainId) {
  const context = await resolveChainContext(chainId);
  const response = await ipcRenderer.invoke('wallet:getSignerAccounts', {
    profileId: context.profile.profileId,
    bech32Prefix: context.bech32Config.bech32PrefixAccAddr
  });
  if (!response || response.ok === false) {
    throw new Error(safeString(response?.error || 'wallet_accounts_failed', 256));
  }
  const account = Array.isArray(response.accounts) ? response.accounts[0] : null;
  if (!account || !account.address) {
    throw new Error('wallet_account_missing');
  }
  return {
    ...context,
    account: {
      address: safeString(account.address, 256),
      algo: safeString(account.algo, 64) || 'secp256k1',
      pubkey: normalizeBytes(account.pubkey)
    }
  };
}

function serializeStdSignature(result) {
  return {
    pub_key: {
      type: safeString(result?.pub_key?.type || 'tendermint/PubKeySecp256k1', 128),
      value: safeString(result?.pub_key?.value || '', 4096)
    },
    signature: safeString(result?.signature || '', 4096)
  };
}

function rememberSuggestedChain(chainInfo) {
  const info = chainInfo && typeof chainInfo === 'object' ? chainInfo : {};
  const chainId = safeString(info.chainId, 128);
  if (!chainId) {
    throw new Error('missing_chain_id');
  }
  suggestedChains.set(chainId, {
    chainId,
    chainName: safeString(info.chainName, 256) || chainId,
    bech32Config: buildBech32Config(info.bech32Config || {}, 'lmn')
  });
  return chainId;
}

function makeOfflineSigner(chainId) {
  return {
    getAccounts: async () => {
      const context = await getWalletAccountsForChain(chainId);
      return [
        {
          address: context.account.address,
          algo: context.account.algo,
          pubkey: context.account.pubkey
        }
      ];
    },
    signAmino: async (signerAddress, signDoc) => {
      const context = await getWalletAccountsForChain(chainId);
      const response = await ipcRenderer.invoke('wallet:signAmino', {
        profileId: context.profile.profileId,
        bech32Prefix: context.bech32Config.bech32PrefixAccAddr,
        signerAddress: safeString(signerAddress, 256) || context.account.address,
        signDoc: signDoc || {}
      });
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.error || 'sign_amino_failed', 256));
      }
      return {
        signed: response.signed || signDoc || {},
        signature: serializeStdSignature(response.signature || {})
      };
    },
    signDirect: async (signerAddress, signDoc) => {
      const context = await getWalletAccountsForChain(chainId);
      const response = await ipcRenderer.invoke('wallet:signDirect', {
        profileId: context.profile.profileId,
        bech32Prefix: context.bech32Config.bech32PrefixAccAddr,
        signerAddress: safeString(signerAddress, 256) || context.account.address,
        signDoc: signDoc || {}
      });
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.error || 'sign_direct_failed', 256));
      }
      return {
        signed: {
          chainId: safeString(response.signed?.chainId, 128),
          accountNumber: BigInt(safeString(response.signed?.accountNumber, 128) || '0'),
          bodyBytes: normalizeBytes(response.signed?.bodyBytes),
          authInfoBytes: normalizeBytes(response.signed?.authInfoBytes)
        },
        signature: serializeStdSignature(response.signature || {})
      };
    }
  };
}

// Minimal browser API for Keplr/Leap extension compatibility
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

function callMainWorldRuntimeSendMessage(rawArgs, fallbackValue) {
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

const extensionGrantedPermissionsState = {
  loaded: false,
  permissions: new Set(),
  origins: new Set()
};

function normalizeGrantedPermissionPayload(input) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    permissions: Array.isArray(value.permissions)
      ? value.permissions.map((entry) => safeString(entry, 256)).filter(Boolean)
      : [],
    origins: Array.isArray(value.origins)
      ? value.origins.map((entry) => safeString(entry, 4096)).filter(Boolean)
      : []
  };
}

function setGrantedPermissionsState(input) {
  const normalized = normalizeGrantedPermissionPayload(input);
  extensionGrantedPermissionsState.permissions = new Set(normalized.permissions);
  extensionGrantedPermissionsState.origins = new Set(normalized.origins);
  extensionGrantedPermissionsState.loaded = true;
  return normalized;
}

function getGrantedPermissionsState() {
  if (extensionGrantedPermissionsState.loaded) {
    return {
      permissions: Array.from(extensionGrantedPermissionsState.permissions),
      origins: Array.from(extensionGrantedPermissionsState.origins)
    };
  }

  try {
    const result = ipcRenderer.sendSync(
      'extensions:getGrantedPermissionsSync',
      getExtensionRequestContext(),
    );
    if (result && result.ok !== false && result.granted) {
      return setGrantedPermissionsState(result.granted);
    }
  } catch {}

  return setGrantedPermissionsState({});
}

function buildEffectivePermissionLists(manifest) {
  const granted = getGrantedPermissionsState();
  return {
    permissions: Array.from(
      new Set([
        ...(Array.isArray(manifest?.permissions)
          ? manifest.permissions.map((entry) => safeString(entry, 256)).filter(Boolean)
          : []),
        ...granted.permissions
      ])
    ),
    origins: Array.from(
      new Set([
        ...(Array.isArray(manifest?.host_permissions)
          ? manifest.host_permissions.map((entry) => safeString(entry, 4096)).filter(Boolean)
          : []),
        ...granted.origins
      ])
    )
  };
}

function resolvePermissionRequest(factory, callback, fallbackValue) {
  const promise = Promise.resolve()
    .then(factory)
    .catch(() => fallbackValue);
  if (typeof callback === 'function') {
    promise.then((value) => {
      try {
        callback(value);
      } catch {}
    });
  }
  return promise;
}

function requestDynamicPermissions(details, callback) {
  return resolvePermissionRequest(async () => {
    const result = await ipcRenderer.invoke('extensions:requestPermissions', {
      extensionContext: getExtensionRequestContext(),
      details: details || {}
    });
    if (result && result.ok !== false && result.granted) {
      setGrantedPermissionsState(result.granted);
    }
    return !!result?.allowed;
  }, callback, false);
}

function removeDynamicPermissions(details, callback) {
  return resolvePermissionRequest(async () => {
    const result = await ipcRenderer.invoke('extensions:removePermissions', {
      extensionContext: getExtensionRequestContext(),
      details: details || {}
    });
    if (result && result.ok !== false && result.granted) {
      setGrantedPermissionsState(result.granted);
    }
    return !!result?.removed;
  }, callback, false);
}

function normalizeTargetUrl(input) {
  const value = safeString(input, 4096);
  if (!value) return '';

  try {
    if (value.startsWith('/')) {
      return `${getExtensionOrigin()}/${value.replace(/^\/+/, '')}`;
    }
    return new URL(value, currentHref() || `${getExtensionOrigin()}/`).toString();
  } catch {
    return value;
  }
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
  const nativeBrowserRuntime = globalThis.browser?.runtime || null;
  const nativeChromeRuntime = globalThis.chrome?.runtime || null;
  const nativeRuntime = nativeBrowserRuntime || nativeChromeRuntime;
  const nativeChromeTabs = globalThis.chrome?.tabs || null;
  const nativeChromeWindows = globalThis.chrome?.windows || null;
  let tabIdCounter = 1;
  const tabs = new Map();
  const currentTabId = tabIdCounter++;

  // Initialize current tab
  tabs.set(currentTabId, {
    id: currentTabId,
    windowId: 1,
    active: true,
    url: currentHref(),
    title: document?.title || 'Lumen'
  });

  const buildLocalTabsQueryResults = (queryInfo) => {
    const info = queryInfo && typeof queryInfo === 'object' ? queryInfo : {};
    const results = [];
    for (const [, tab] of tabs) {
      if (info.active !== undefined && tab.active !== info.active) continue;
      if (info.currentWindow === true || info.lastFocusedWindow === true) {
        if (tab.windowId !== 1) continue;
      }
      if (info.windowId !== undefined && tab.windowId !== info.windowId) continue;
      if (info.url !== undefined && tab.url !== info.url) continue;
      results.push(tab);
    }
    return results.length ? results : (info.active === false ? [] : [tabs.get(currentTabId)].filter(Boolean));
  };

  const normalizeNativeTabResult = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    return fallback();
  };

  const normalizeNativeTabsQueryResult = (value, fallback) => {
    if (Array.isArray(value) && value.length > 0) return value;
    return fallback();
  };

  const normalizeNativeWindowResult = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    return fallback();
  };

  return {
    tabs: {
      create: async (options) => {
        const nextUrl = normalizeTargetUrl(options?.url);
        if (!nextUrl && typeof nativeChromeTabs?.create === 'function') {
          try {
            return nativeChromeTabs.create(options);
          } catch {}
        }
        const tabId = tabIdCounter++;
        const tab = {
          id: tabId,
          windowId: options?.windowId || 1,
          active: options?.active !== false,
          url: nextUrl || '',
          title: options?.title || ''
        };
        tabs.set(tabId, tab);
        if (nextUrl) {
          sendHostEvent('extensions:shimNavigate', {
            url: nextUrl,
            openInNewTab: true
          });
        }
        return tab;
      },
      get: async (tabId) => {
        return callNativeMethod(
          nativeChromeTabs?.get,
          nativeChromeTabs,
          [tabId],
          undefined,
          () => tabs.get(tabId) || tabs.get(currentTabId) || null,
          normalizeNativeTabResult
        );
      },
      query: async (queryInfo) => {
        return callNativeMethod(
          nativeChromeTabs?.query,
          nativeChromeTabs,
          [queryInfo],
          undefined,
          () => buildLocalTabsQueryResults(queryInfo),
          normalizeNativeTabsQueryResult
        );
      },
      update: async (tabId, updateProperties) => {
        const nextUrl = normalizeTargetUrl(updateProperties?.url);
        if (!nextUrl && typeof nativeChromeTabs?.update === 'function') {
          try {
            return nativeChromeTabs.update(tabId, updateProperties);
          } catch {}
        }
        const tab = tabs.get(tabId);
        if (!tab) return null;
        if (nextUrl) {
          tab.url = nextUrl;
          sendHostEvent('extensions:shimNavigate', {
            url: nextUrl,
            openInNewTab: false
          });
        }
        if (updateProperties.active !== undefined) tab.active = updateProperties.active;
        if (updateProperties.title !== undefined) tab.title = updateProperties.title;
        return tab;
      },
      remove: async (tabIds) => {
        if (typeof nativeChromeTabs?.remove === 'function') {
          try {
            return nativeChromeTabs.remove(tabIds);
          } catch {}
        }
        const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
        ids.forEach(id => tabs.delete(id));
      },
      sendMessage: async (tabId, message, optionsOrCallback, maybeCallback) => {
        const { args, callback } = normalizeTabsSendMessageCall([
          tabId,
          message,
          optionsOrCallback,
          maybeCallback
        ]);
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
      }
    },
    windows: {
      getCurrent: async () => {
        return callNativeMethod(
          nativeChromeWindows?.getCurrent,
          nativeChromeWindows,
          [],
          undefined,
          () => ({
            id: 1,
            focused: true,
            alwaysOnTop: false,
            incognito: false,
            type: 'normal',
            state: 'normal'
          }),
          normalizeNativeWindowResult
        );
      },
      getAll: async () => {
        if (typeof nativeChromeWindows?.getAll === 'function') {
          try {
            return nativeChromeWindows.getAll();
          } catch {}
        }
        return [{
          id: 1,
          focused: true,
          alwaysOnTop: false,
          incognito: false,
          type: 'normal',
          state: 'normal'
        }];
      },
      create: async (createData) => {
        const nextUrl = normalizeTargetUrl(createData?.url);
        if (!nextUrl && typeof nativeChromeWindows?.create === 'function') {
          try {
            return nativeChromeWindows.create(createData);
          } catch {}
        }
        if (nextUrl) {
          sendHostEvent('extensions:shimNavigate', {
            url: nextUrl,
            openInNewTab: true
          });
        }
        return {
          id: 2,
          focused: true,
          alwaysOnTop: false,
          incognito: false,
          type: 'normal',
          state: 'normal',
          tabs: []
        };
      }
    },
    storage: {
      local: {
        get: async (keys) => {
          const result = {};
          const storageKey = 'browser_storage_local';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            if (keys === null || keys === undefined) {
              return data;
            }
            const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
            keyArray.forEach(k => {
              if (data[k] !== undefined) result[k] = data[k];
            });
          } catch {}
          return result;
        },
        set: async (items) => {
          const storageKey = 'browser_storage_local';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            Object.assign(data, items);
            localStorage.setItem(storageKey, JSON.stringify(data));
          } catch {}
        },
        remove: async (keys) => {
          const storageKey = 'browser_storage_local';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
            keyArray.forEach(k => delete data[k]);
            localStorage.setItem(storageKey, JSON.stringify(data));
          } catch {}
        },
        clear: async () => {
          try {
            localStorage.removeItem('browser_storage_local');
          } catch {}
        }
      },
      sync: {
        get: async (keys) => {
          const result = {};
          const storageKey = 'browser_storage_sync';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            if (keys === null || keys === undefined) return data;
            const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
            keyArray.forEach(k => {
              if (data[k] !== undefined) result[k] = data[k];
            });
          } catch {}
          return result;
        },
        set: async (items) => {
          const storageKey = 'browser_storage_sync';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            Object.assign(data, items);
            localStorage.setItem(storageKey, JSON.stringify(data));
          } catch {}
        },
        remove: async (keys) => {
          const storageKey = 'browser_storage_sync';
          try {
            const stored = localStorage.getItem(storageKey);
            const data = stored ? JSON.parse(stored) : {};
            const keyArray = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : [];
            keyArray.forEach(k => delete data[k]);
            localStorage.setItem(storageKey, JSON.stringify(data));
          } catch {}
        }
      }
    },
    runtime: {
      id: nativeRuntime?.id || 'hbfagpiekcachnbiafmlimmcknaoilnh',
      getManifest: () => {
        if (typeof nativeRuntime?.getManifest === 'function') {
          try {
            return nativeRuntime.getManifest();
          } catch {}
        }
        return {
          name: 'Keplr',
          version: '1.0.0',
          description: 'Keplr extension'
        };
      },
      getURL: (path) => {
        if (typeof nativeRuntime?.getURL === 'function') {
          try {
            return nativeRuntime.getURL(path);
          } catch {}
        }
        return `chrome-extension://hbfagpiekcachnbiafmlimmcknaoilnh/${path || ''}`;
      },
      getBackgroundPage: (callback) => {
        if (typeof nativeRuntime?.getBackgroundPage === 'function') {
          try {
            return nativeRuntime.getBackgroundPage(callback);
          } catch {}
        }
        return asyncResult(null, callback);
      },
      getBrowserInfo: (callback) => {
        if (typeof nativeRuntime?.getBrowserInfo === 'function') {
          try {
            return nativeRuntime.getBrowserInfo(callback);
          } catch {}
        }
        return asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback);
      },
      getPlatformInfo: (callback) => {
        if (typeof nativeRuntime?.getPlatformInfo === 'function') {
          try {
            return nativeRuntime.getPlatformInfo(callback);
          } catch {}
        }
        const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
        const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
        return asyncResult({ os, arch, nacl_arch: arch }, callback);
      },
      openOptionsPage: (callback) => {
        if (typeof nativeRuntime?.openOptionsPage === 'function') {
          try {
            return nativeRuntime.openOptionsPage(callback);
          } catch {}
        }
        return asyncResult(undefined, callback);
      },
      connect: (extensionIdOrConnectInfo, connectInfo) => {
        if (typeof nativeRuntime?.connect === 'function') {
          try {
            return nativeRuntime.connect(
              ...normalizeRuntimeConnectCall([extensionIdOrConnectInfo, connectInfo])
            );
          } catch {}
        }
        return {
          name: String(connectInfo?.name || extensionIdOrConnectInfo?.name || ''),
          disconnect() {},
          postMessage() {},
          onMessage: createBrowserEvent(),
          onDisconnect: createBrowserEvent()
        };
      },
      onMessage: nativeRuntime?.onMessage || createBrowserEvent(),
      onConnect: nativeRuntime?.onConnect || createBrowserEvent(),
      onStateChanged: createBrowserEvent(),
      sendMessage: async (extensionIdOrMessage, messageOrOptions, optionsOrCallback, maybeCallback) => {
        debugLog('[webview-preload] runtime.sendMessage called', {
          hasNativeRuntime: !!nativeRuntime,
          hasNativeBrowserRuntime: !!nativeBrowserRuntime,
          hasNativeChromeRuntime: !!nativeChromeRuntime,
          hasNativeSendMessage: typeof nativeRuntime?.sendMessage === 'function',
          args: [
            typeof extensionIdOrMessage,
            typeof messageOrOptions,
            typeof optionsOrCallback,
            typeof maybeCallback
          ]
        });
        if (typeof nativeRuntime?.sendMessage !== 'function') {
          debugLog('[webview-preload] runtime.sendMessage forwarding to main-world runtime');
          return callMainWorldRuntimeSendMessage(
            [
              extensionIdOrMessage,
              messageOrOptions,
              optionsOrCallback,
              maybeCallback
            ],
            () => ({})
          );
        }
        return callNativeRuntimeSendMessage(
          nativeRuntime?.sendMessage,
          nativeRuntime,
          [
            extensionIdOrMessage,
            messageOrOptions,
            optionsOrCallback,
            maybeCallback
          ],
          () => ({})
        );
      }
    }
  };
}

function createCosmosProvider(providerKind) {
  const providerName = providerKind === 'leap' ? 'Leap' : 'Keplr';

  return {
    version: 'lumen-embedded',
    isLumenEmbedded: true,
    isKeplr: providerKind === 'keplr',
    isLeap: providerKind === 'leap',
    mode: 'extension',
    enable: async (chains) => {
      const chainIds = Array.isArray(chains) ? chains : [chains];
      for (const chainId of chainIds.filter(Boolean)) {
        await resolveChainContext(chainId);
      }
      return true;
    },
    experimentalSuggestChain: async (chainInfo) => {
      rememberSuggestedChain(chainInfo);
      return true;
    },
    getAccounts: async (chainId) => {
      const context = await getWalletAccountsForChain(chainId);
      return [
        {
          address: context.account.address,
          algo: context.account.algo,
          pubkey: context.account.pubkey
        }
      ];
    },
    getKey: async (chainId) => {
      const context = await resolveChainContext(chainId);
      const response = await ipcRenderer.invoke('wallet:getKeyInfo', {
        profileId: context.profile.profileId,
        bech32Prefix: context.bech32Config.bech32PrefixAccAddr
      });
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.error || 'get_key_failed', 256));
      }
      return {
        name: safeString(response.name, 256) || providerName,
        algo: safeString(response.algo, 64) || 'secp256k1',
        bech32Address: safeString(response.bech32Address || response.address, 256),
        address: safeString(response.address || response.bech32Address, 256),
        pubKey: normalizeBytes(response.pubKey),
        isNanoLedger: false,
        isKeystone: false
      };
    },
    getOfflineSigner: (chainId) => makeOfflineSigner(chainId),
    getOfflineSignerOnlyAmino: (chainId) => makeOfflineSigner(chainId),
    getOfflineSignerAuto: async (chainId) => makeOfflineSigner(chainId),
    signAmino: async (chainId, signerAddress, signDoc) =>
      makeOfflineSigner(chainId).signAmino(signerAddress, signDoc),
    signDirect: async (chainId, signerAddress, signDoc) =>
      makeOfflineSigner(chainId).signDirect(signerAddress, signDoc),
    signArbitrary: async (chainId, signer, data) => {
      const context = await getWalletAccountsForChain(chainId);
      const response = await ipcRenderer.invoke('wallet:signArbitrary', {
        profileId: context.profile.profileId,
        address: safeString(signer, 256) || context.account.address,
        algo: 'ADR-036',
        payload: typeof data === 'string' ? data : Buffer.from(normalizeBytes(data)).toString('utf8')
      });
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.error || 'sign_arbitrary_failed', 256));
      }
      return {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: safeString(response.pubkeyB64, 4096)
        },
        signature: safeString(response.signatureB64, 4096)
      };
    },
    sendTx: async (_chainId, txBytes, _mode) => {
      const response = await ipcRenderer.invoke('net:broadcastTx', normalizeBytes(txBytes), {});
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.rawLog || response?.error || 'broadcast_failed', 512));
      }
      const txHash = safeString(response.transactionHash, 256);
      if (/^[0-9a-f]+$/i.test(txHash) && txHash.length % 2 === 0) {
        return new Uint8Array(Buffer.from(txHash, 'hex'));
      }
      return normalizeBytes(txBytes);
    },
    sendTransaction: async (payload) => {
      if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'txBytes')) {
        const response = await ipcRenderer.invoke('net:broadcastTx', normalizeBytes(payload.txBytes), payload.options || {});
        if (!response || response.ok === false) {
          throw new Error(safeString(response?.rawLog || response?.error || 'broadcast_failed', 512));
        }
        return response;
      }

      const context = await getWalletAccountsForChain(payload?.chainId);
      const response = await ipcRenderer.invoke('wallet:sendTokens', {
        profileId: context.profile.profileId,
        from: context.account.address,
        to: safeString(payload?.to || payload?.recipient, 256),
        amount: Number(payload?.amount || 0),
        denom: safeString(payload?.denom || 'ulmn', 64) || 'ulmn',
        memo: safeString(payload?.memo || '', 1024)
      });
      if (!response || response.ok === false) {
        throw new Error(safeString(response?.error || 'send_transaction_failed', 512));
      }
      return response;
    }
  };
}

function maybeExposeProvider(name, provider) {
  try {
    contextBridge.exposeInMainWorld(name, provider);
  } catch {
    // ignore duplicate exposure attempts
  }
}

function isIpfsGatewayUrl(href) {
  try {
    const u = new URL(String(href || ''));
    const p = String(u.pathname || '/');
    if (p === '/ipfs' || p.startsWith('/ipfs/') || p === '/ipns' || p.startsWith('/ipns/')) return true;

    // Subdomain gateway support (e.g. http://<cid>.ipfs.localhost:8080/)
    const host = String(u.hostname || '').trim();
    if (!host) return false;
    const h = host.toLowerCase();
    return /^([a-z0-9]+)\.(ipfs|ipns)\./i.test(h);
  } catch {
    return false;
  }
}

function ensureLumenSite() {
  if (!isIpfsGatewayUrl(currentHref())) {
    throw new Error('window.lumen is only available on /ipfs/* or /ipns/* pages.');
  }
}

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

async function getLocalGatewayBase() {
  try {
    const base = await ipcRenderer.invoke('lumenSite:getLocalGatewayBase');
    return safeString(base, 1024);
  } catch {
    return '';
  }
}

async function resolveUrl(urlOrPath) {
  ensureLumenSite();
  const raw = safeString(urlOrPath, 4096);
  if (!raw) return '';

  // Accept lumen://ipfs/<cid>/... and lumen://ipns/<name>/...
  if (/^lumen:\/\//i.test(raw)) {
    const parsed = parseLumenIpfsOrIpns(raw);
    if (!parsed.kind || !parsed.id) return '';
    const base = (await getLocalGatewayBase()) || safeString(location?.origin || '', 1024);
    const b = String(base || '').replace(/\/+$/, '');
    return `${b}/${parsed.kind}/${parsed.id}${parsed.rest || ''}`;
  }

  // Accept /ipfs/... and /ipns/... paths.
  if (/^\/(ipfs|ipns)\//i.test(raw)) {
    const base = (await getLocalGatewayBase()) || safeString(location?.origin || '', 1024);
    const b = String(base || '').replace(/\/+$/, '');
    return `${b}${raw}`;
  }

  // Fallback: return as-is if it's already http(s).
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw;
}

async function sendToken(rawTx) {
  ensureLumenSite();
  const tx = rawTx && typeof rawTx === 'object' ? rawTx : {};
  const to = safeString(tx.to || tx.recipient || '', 256);
  const memo = safeString(tx.memo || tx.note || '', 1024);
  const amountLmnRaw = tx.amount_lmn ?? tx.amountLmn ?? tx.amount;
  const amountLmn =
    typeof amountLmnRaw === 'number' && Number.isFinite(amountLmnRaw) ? amountLmnRaw : null;

  try {
    return await ipcRenderer.invoke('lumenSite:sendToken', { to, memo, amountLmn, title: safeString(document?.title || '', 256) });
  } catch (e) {
    return { ok: false, error: safeString(e?.message || e || 'send_failed', 512) };
  }
}

async function pinCid(cidOrUrl, optsMaybe) {
  ensureLumenSite();
  const inputObj = cidOrUrl && typeof cidOrUrl === 'object' ? cidOrUrl : null;
  const cidOrUrlStr = safeString(
    inputObj ? (inputObj.cidOrUrl || inputObj.cid || inputObj.url || '') : cidOrUrl,
    4096
  );
  if (!cidOrUrlStr) return { ok: false, error: 'missing_cid' };

  const name = safeString(
    inputObj ? (inputObj.name || inputObj.title || inputObj.filename || '') : (optsMaybe && optsMaybe.name ? optsMaybe.name : ''),
    256
  );
  try {
    return await ipcRenderer.invoke('lumenSite:pin', {
      cidOrUrl: cidOrUrlStr,
      name,
      title: safeString(document?.title || '', 256)
    });
  } catch (e) {
    return { ok: false, error: safeString(e?.message || e || 'pin_failed', 512) };
  }
}

const lumen = {
  // Minimal "action" API (requested)
  SendToken: sendToken,
  Pin: pinCid,
  Save: pinCid,
  resolveUrl,

  // Preferred camelCase aliases
  sendToken,
  pin: pinCid,
  save: pinCid,
  resolveUrl,

  profiles: {
    getActive: async () => {
      ensureLumenSite();
      return await ipcRenderer.invoke('profiles:getActive');
    }
  },

  pubsub: {
    publish: async (topic, data, opts) => {
      ensureLumenSite();
      const encoding =
        (opts && opts.encoding) ||
        (typeof data === 'string' ? 'text' : (typeof data === 'object' ? 'json' : 'text'));

      const payload = { topic: safeString(topic, 1024), encoding };
      if (encoding === 'binary') {
        if (data instanceof Uint8Array) payload.dataB64 = Buffer.from(data).toString('base64');
        else payload.dataB64 = safeString(data, 1024 * 1024);
      } else if (encoding === 'json') {
        payload.data = typeof data === 'string' ? data : JSON.stringify(data ?? null);
      } else {
        payload.data = String(data ?? '');
      }
      return await ipcRenderer.invoke('ipfs:pubsub:publish', payload);
    },

    subscribe: async (topic, opts = {}, onMessage) => {
      ensureLumenSite();
      const encoding = (opts && opts.encoding) ? String(opts.encoding) : 'text';
      const autoConnect = !!(opts && opts.autoConnect);
      const autoReconnect = !opts || opts.autoReconnect !== false;
      const reconnectDelaysMs = normalizeReconnectDelays(opts && opts.reconnectDelaysMs);
      const maxReconnectAttempts = safeCount(
        opts && opts.maxReconnectAttempts,
        reconnectDelaysMs.length,
        Math.max(reconnectDelaysMs.length, 16)
      );
      const onStatus = opts && typeof opts.onStatus === 'function' ? opts.onStatus : null;
      const onError = opts && typeof opts.onError === 'function' ? opts.onError : null;
      const onEnd = opts && typeof opts.onEnd === 'function' ? opts.onEnd : null;
      const topicRaw = safeString(topic, 1024);

      let disposed = false;
      let state = 'connecting';
      let currentSubId = '';
      let currentTopics = undefined;
      let reconnectTimer = null;
      let reconnectAttempt = 0;
      let reconnectScheduledForSubId = '';
      let terminalSubId = '';
      let subscribeNonce = 0;

      const syncHandle = () => {
        handle.subId = currentSubId;
        handle.topics = Array.isArray(currentTopics) ? currentTopics.slice() : undefined;
        handle.state = state;
      };

      const emitStatus = (next, detail = {}) => {
        state = String(next || '').trim() || state;
        syncHandle();
        callMaybe(onStatus, state, detail);
      };

      const clearReconnectTimer = () => {
        try {
          if (reconnectTimer) clearTimeout(reconnectTimer);
        } catch {}
        reconnectTimer = null;
      };

      const scheduleReconnect = (reason, detail = {}) => {
        if (disposed) return false;
        if (!autoReconnect) {
          emitStatus('ended', { ...detail, reason: reason || 'stream_ended' });
          return false;
        }
        if (reconnectTimer) return true;
        if (reconnectAttempt >= maxReconnectAttempts) return false;
        const attempt = reconnectAttempt + 1;
        const delayMs = reconnectDelaysMs[Math.min(reconnectAttempt, reconnectDelaysMs.length - 1)];
        reconnectAttempt = attempt;
        emitStatus('reconnecting', { ...detail, attempt, delayMs, reason: reason || 'stream_ended', phase: 'scheduled' });
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void subscribeInternal(true, reason || 'stream_ended');
        }, delayMs);
        return true;
      };

      const subscribeInternal = async (isReconnect, reason) => {
        const myNonce = ++subscribeNonce;
        if (disposed) return;
        emitStatus(isReconnect ? 'reconnecting' : 'connecting', {
          attempt: reconnectAttempt,
          reason: reason || (isReconnect ? 'reconnect' : 'initial'),
          phase: 'attempting'
        });

        let res;
        try {
          res = await ipcRenderer.invoke('ipfs:pubsub:subscribe', { topic: topicRaw, encoding, autoConnect });
        } catch (e) {
          res = { ok: false, error: String(e?.message || e || 'subscribe_failed') };
        }

        if (disposed) {
          const subId = safeString(res && res.subId ? res.subId : '', 256);
          if (subId) {
            try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
          }
          return;
        }
        if (myNonce !== subscribeNonce) {
          const subId = safeString(res && res.subId ? res.subId : '', 256);
          if (subId) {
            try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
          }
          return;
        }
        if (!res || res.ok === false) {
          const error = (res && res.error) ? String(res.error) : 'subscribe_failed';
          callMaybe(onError, { error, phase: isReconnect ? 'reconnect' : 'subscribe', attempt: reconnectAttempt });
          if (!isReconnect) throw new Error(error);
          clearReconnectTimer();
          if (!scheduleReconnect('subscribe_failed', { error })) {
            if (!disposed && autoReconnect) {
              emitStatus('failed', { error, attempt: reconnectAttempt, reason: 'subscribe_failed' });
            }
          }
          return;
        }

        currentSubId = String(res.subId || '');
        currentTopics = Array.isArray(res.topics) ? res.topics.map((t) => String(t || '')).filter(Boolean) : undefined;
        reconnectAttempt = 0;
        reconnectScheduledForSubId = '';
        terminalSubId = '';
        emitStatus('connected', {
          subId: currentSubId,
          topics: currentTopics,
          reason: reason || (isReconnect ? 'reconnected' : 'initial')
        });
      };

      const handle = {
        subId: '',
        topics: undefined,
        state,
        getSubId: () => currentSubId,
        getTopics: () => (Array.isArray(currentTopics) ? currentTopics.slice() : undefined),
        getState: () => state,
        unsubscribe: async () => {
          if (disposed) return;
          disposed = true;
          clearReconnectTimer();
          const subId = currentSubId;
          currentSubId = '';
          currentTopics = undefined;
          try { ipcRenderer.removeListener('ipfs:pubsub:message', hMsg); } catch {}
          try { ipcRenderer.removeListener('ipfs:pubsub:error', hErr); } catch {}
          try { ipcRenderer.removeListener('ipfs:pubsub:end', hEnd); } catch {}
          emitStatus('ended', { subId, reason: 'unsubscribe', manual: true });
          callMaybe(onEnd, { subId, reason: 'unsubscribe', manual: true });
          if (subId) {
            try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
          }
        },
      };

      const hMsg = (_e, payload) => {
        try {
          if (!payload || payload.subId !== currentSubId) return;
          // If binary came as array of numbers, restore Uint8Array.
          if (payload.binary && Array.isArray(payload.binary)) payload.binary = new Uint8Array(payload.binary);
          onMessage && onMessage(payload);
        } catch {}
      };
      const hErr = (_e, payload) => {
        if (!payload) return;
        const subId = String(payload.subId || '');
        if (!subId) return;
        if (subId !== currentSubId && subId !== terminalSubId) return;
        callMaybe(onError, {
          subId,
          error: safeString(payload.error, 1024) || 'stream_error',
          phase: 'stream',
          state
        });
      };
      const hEnd = (_e, payload) => {
        if (!payload) return;
        const subId = String(payload.subId || '');
        if (!subId) return;
        if (subId !== currentSubId && subId !== terminalSubId) return;
        if (subId !== terminalSubId) {
          terminalSubId = subId;
          callMaybe(onEnd, { subId, reason: 'stream_ended', manual: false });
        }
        if (subId === currentSubId) {
          currentSubId = '';
          currentTopics = undefined;
          syncHandle();
        }
        if (reconnectScheduledForSubId === subId) return;
        reconnectScheduledForSubId = subId;
        if (!scheduleReconnect('stream_ended', { subId })) {
          if (!disposed && autoReconnect) emitStatus('failed', { subId, reason: 'stream_ended' });
        }
      };

      ipcRenderer.on('ipfs:pubsub:message', hMsg);
      ipcRenderer.on('ipfs:pubsub:error', hErr);
      ipcRenderer.on('ipfs:pubsub:end', hEnd);

      try {
        await subscribeInternal(false, 'initial');
        return handle;
      } catch (e) {
        disposed = true;
        clearReconnectTimer();
        try { ipcRenderer.removeListener('ipfs:pubsub:message', hMsg); } catch {}
        try { ipcRenderer.removeListener('ipfs:pubsub:error', hErr); } catch {}
        try { ipcRenderer.removeListener('ipfs:pubsub:end', hEnd); } catch {}
        throw e;
      }
    },
  },

  wallet: {
    requestSend: sendToken,
    signArbitrary: async (args) => {
      ensureLumenSite();
      const a = args && typeof args === 'object' ? args : {};
      return await ipcRenderer.invoke('wallet:signArbitrary', {
        profileId: safeString(a.profileId, 128),
        address: safeString(a.address, 256),
        algo: safeString(a.algo || 'ADR-036', 64),
        payload: safeString(a.payload, 1024 * 1024),
      });
    },
    verifyArbitrary: async (args) => {
      ensureLumenSite();
      const a = args && typeof args === 'object' ? args : {};
      return await ipcRenderer.invoke('wallet:verifyArbitrary', {
        algo: safeString(a.algo || 'ADR-036', 64),
        payload: safeString(a.payload, 1024 * 1024),
        signatureB64: safeString(a.signatureB64, 4096),
        pubkeyB64: safeString(a.pubkeyB64, 4096),
        address: safeString(a.address, 256),
      });
    }
  }
};

if (providerFallbackState.keplr) {
  maybeExposeProvider('keplr', createCosmosProvider('keplr'));
}

if (providerFallbackState.leap) {
  maybeExposeProvider('leap', createCosmosProvider('leap'));
}

function enhanceExtensionBrowserApi(api) {
  if (!api || typeof api !== 'object') return api;

  const runtimeId = getExtensionRuntimeId();
  const extensionOrigin = getExtensionOrigin();
  const storagePrefix = `__lumen_webview_extension_storage__/${runtimeId}/`;
  const notifications = new Map();
  const alarms = new Map();
  const sidePanelState = { openPanelOnActionClick: false };
  const storageEvents =
    api.storage?.onChanged && typeof api.storage.onChanged === 'object'
      ? api.storage.onChanged
      : createBrowserEvent();
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
  let nextNotificationId = 1;

  const createAsyncStub = (value) => (...args) => {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    return asyncResult(cloneValue(value), callback);
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
        storageEvents.dispatch(changes, areaName);
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
    }
  });

  api.storage = {
    ...(api.storage || {}),
    session: createStorageArea('session'),
    onChanged: storageEvents
  };

  api.runtime = {
    ...(api.runtime || {}),
    id: api.runtime?.id || runtimeId,
    lastError: null,
    getManifest: api.runtime?.getManifest || (() => getExtensionManifest()),
    getURL: api.runtime?.getURL || ((path = '') => {
      const normalized = safeString(path, 4096).replace(/^\/+/, '');
      return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
    }),
    getBackgroundPage: api.runtime?.getBackgroundPage || ((callback) => asyncResult(null, callback)),
    getBrowserInfo: api.runtime?.getBrowserInfo || ((callback) => asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback)),
    getPlatformInfo: api.runtime?.getPlatformInfo || ((callback) => {
      const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
      const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
      return asyncResult({ os, arch, nacl_arch: arch }, callback);
    }),
    openOptionsPage: api.runtime?.openOptionsPage || ((callback) => asyncResult(undefined, callback)),
    requestUpdateCheck: api.runtime?.requestUpdateCheck || ((callback) => asyncResult({ status: 'no_update' }, callback)),
    setUninstallURL: api.runtime?.setUninstallURL || ((_url, callback) => asyncResult(undefined, callback))
  };

  if (!api.tabs?.getCurrent) {
    api.tabs = {
      ...(api.tabs || {}),
      getCurrent(callback) {
        return asyncResult({
          id: 1,
          windowId: 1,
          active: true,
          status: 'complete',
          title: safeString(globalThis.document?.title || getExtensionManifest().name || 'Extension', 512) || 'Extension',
          url: currentHref() || `${extensionOrigin}/`
        }, callback);
      }
    };
  }

  if (!api.extension) {
    api.extension = {
      getURL: api.runtime.getURL,
      getViews() {
        return [globalThis];
      },
      getBackgroundPage: createAsyncStub(null),
      lastError: null
    };
  }

  if (!api.idle) {
    api.idle = {
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
    };
  }

  if (!api.management) {
    api.management = {
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
        return api.management.getSelf(callback);
      },
      getAll: createAsyncStub([]),
      getPermissionWarningsById: createAsyncStub([]),
      getPermissionWarningsByManifest: createAsyncStub([])
    };
  }

  if (!api.permissions) {
    api.permissions = {
      contains(details, callback) {
        const manifest = getExtensionManifest();
        const effective = buildEffectivePermissionLists(manifest);
        const permissions = new Set(effective.permissions);
        const origins = new Set(effective.origins);
        const requestedPermissions = Array.isArray(details?.permissions) ? details.permissions : [];
        const requestedOrigins = Array.isArray(details?.origins) ? details.origins : [];
        return asyncResult(
          requestedPermissions.every((item) => permissions.has(safeString(item, 256))) &&
            requestedOrigins.every((item) => origins.has(safeString(item, 4096))),
          callback,
        );
      },
      getAll(callback) {
        const manifest = getExtensionManifest();
        const effective = buildEffectivePermissionLists(manifest);
        return asyncResult({
          permissions: effective.permissions.slice(),
          origins: effective.origins.slice()
        }, callback);
      },
      request: requestDynamicPermissions,
      remove: removeDynamicPermissions
    };
  }

  if (!api.alarms) {
    api.alarms = {
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
    };
  }

  if (!api.notifications) {
    api.notifications = {
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
    };
  }

  if (!api.identity) {
    api.identity = {
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
    };
  }

  if (!api.sidePanel) {
    api.sidePanel = {
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
    };
  }

  if (!api.scripting) {
    api.scripting = {
      executeScript: createAsyncStub([]),
      getRegisteredContentScripts: createAsyncStub([]),
      registerContentScripts: createAsyncStub(undefined),
      updateContentScripts: createAsyncStub(undefined),
      unregisterContentScripts: createAsyncStub(undefined)
    };
  }

  if (!api.webNavigation) {
    api.webNavigation = {
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
    };
  }

  return api;
}

// Expose browser/chrome API from the local shim so the preload works in sandboxed renderers.
const browserApi = enhanceExtensionBrowserApi(createMinimalBrowserApi());
const extensionApi = browserApi;
const EXTENSION_API_SHIM_KEY = '__lumenExtensionWebviewApiShim';
const EXTENSION_API_SHIM_SOURCE = 'webview';

function installMainWorldExtensionApi(shimKey, shimSource) {
  if (typeof contextBridge.executeInMainWorld !== 'function') return;

  try {
    contextBridge.executeInMainWorld({
      func: (key, source, debugEnabled) => {
        const root = window;
        const shim = root[key];
        if (!shim || typeof shim !== 'object') return;
        const log = (...args) => {
          if (!debugEnabled) return;
          try {
            console.log(...args);
          } catch {}
        };
        if (/^chrome-extension:\/\//i.test(String(root.location?.href || ''))) {
          try {
            log('[lumen-webview-preload] skipping extension api injection for top-level extension window', {
              href: String(root.location?.href || ''),
              reason: 'main-world-chrome-extension-url'
            });
          } catch {}
          return;
        }
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

        const chromeApi = createApiRoot(root.chrome);
        const browserApi = createApiRoot(root.browser);

        installApiProperty('chrome', chromeApi);
        installApiProperty('browser', browserApi);
        forceShimMethods(chromeApi);
        forceShimMethods(browserApi);
        forceShimMethods(root.chrome);
        forceShimMethods(root.browser);

        try {
          log('[lumen-webview-preload] extension api patched', {
            hasBrowserTabsCreate: typeof root.browser?.tabs?.create === 'function',
            hasChromeTabsCreate: typeof root.chrome?.tabs?.create === 'function',
            href: String(root.location?.href || '')
          });
        } catch {}
      },
      args: [shimKey, shimSource, EXTENSION_DEBUG]
    });
  } catch {}
}

if (shouldInjectWebviewExtensionApi()) {
  try {
    contextBridge.exposeInMainWorld(EXTENSION_API_SHIM_KEY, extensionApi);
  } catch {}

  try {
    contextBridge.exposeInMainWorld('browser', browserApi);
  } catch {
    // ignore
  }

  try {
    contextBridge.exposeInMainWorld('chrome', extensionApi);
  } catch {
    // ignore
  }

  installMainWorldExtensionApi(EXTENSION_API_SHIM_KEY, EXTENSION_API_SHIM_SOURCE);
} else {
  try {
    debugLog('[lumen-webview-preload] skipping extension api injection for top-level extension window', {
      href: currentHref(),
      hasSendToHost: isGuestRendererContext(),
      isChromeExtensionUrl: isChromeExtensionUrl()
    });
  } catch {}
}

try {
  if (isIpfsGatewayUrl(currentHref())) {
    contextBridge.exposeInMainWorld('lumen', lumen);
  }
} catch {
  // ignore
}

function isLumenUrl(input) {
  return /^lumen:\/\//i.test(safeString(input, 4096));
}

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

function handleLumenLinkClick(ev) {
  try {
    if (!ev || ev.defaultPrevented) return;
    const button = typeof ev.button === 'number' ? ev.button : 0;
    if (button !== 0) return;

    const a = closestAnchorWithHref(ev.target);
    if (!a) return;

    const href = safeString((typeof a.getAttribute === 'function' ? a.getAttribute('href') : '') || a.href || '', 4096);
    if (!isLumenUrl(href)) return;

    const target = safeString((typeof a.getAttribute === 'function' ? a.getAttribute('target') : '') || a.target || '', 64).toLowerCase();
    const openInNewTab = target === '_blank';

    try { ev.preventDefault(); } catch {}
    try { ev.stopImmediatePropagation?.(); } catch {}
    try { ev.stopPropagation?.(); } catch {}

    sendHostEvent('lumen:navigate', { url: href, openInNewTab });
  } catch {
    // ignore
  }
}

function sendHostEvent(channel, payload) {
  try {
    if (typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost(String(channel || ''), payload ?? null);
    } else {
      ipcRenderer.send(String(channel || ''), payload ?? null);
    }
  } catch {
    // ignore
  }
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

function getChromeWebStoreInstallPayload() {
  if (!isChromeWebStoreUrl()) return null;
  const id = extractChromeWebStoreIdFromHref();
  if (!id) return null;

  let title = '';
  try {
    const heading =
      document.querySelector('h1') ||
      document.querySelector('[role="heading"]') ||
      document.querySelector('title');
    title = safeString(heading?.textContent || document?.title || '', 256);
  } catch {
    title = safeString(document?.title || '', 256);
  }

  return {
    id,
    url: currentHref(),
    title
  };
}

function requestChromeWebStoreInstall(trigger = 'unknown') {
  const payload = getChromeWebStoreInstallPayload();
  if (!payload) return false;
  sendHostEvent('extensions:installFromStore', {
    ...payload,
    trigger: safeString(trigger, 64) || 'unknown'
  });
  return true;
}

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

function removeChromeWebStoreImportButton() {
  try {
    const existing = document.getElementById('lumen-chrome-store-import');
    existing?.remove?.();
  } catch {
    // ignore
  }
}

function ensureChromeWebStoreImportButton() {
  if (!isChromeWebStoreUrl()) {
    removeChromeWebStoreImportButton();
    return;
  }

  const payload = getChromeWebStoreInstallPayload();
  if (!payload || !document?.body) {
    removeChromeWebStoreImportButton();
    return;
  }

  let button = document.getElementById('lumen-chrome-store-import');
  if (!button) {
    button = document.createElement('button');
    button.id = 'lumen-chrome-store-import';
    button.type = 'button';
    button.textContent = 'Import into Lumen';
    button.style.position = 'fixed';
    button.style.right = '24px';
    button.style.bottom = '24px';
    button.style.zIndex = '2147483647';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.padding = '12px 18px';
    button.style.border = '0';
    button.style.borderRadius = '999px';
    button.style.background = '#2563eb';
    button.style.color = '#ffffff';
    button.style.fontSize = '14px';
    button.style.fontWeight = '600';
    button.style.letterSpacing = '0.01em';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 12px 32px rgba(37, 99, 235, 0.35)';
    button.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    button.addEventListener('mouseenter', () => {
      button.style.filter = 'brightness(1.08)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.filter = 'brightness(1)';
    });
    button.addEventListener('click', (event) => {
      try { event.preventDefault(); } catch {}
      try { event.stopPropagation(); } catch {}
      button.textContent = 'Import requested';
      requestChromeWebStoreInstall('floating-button');
    });
    document.body.appendChild(button);
  } else {
    button.textContent = 'Import into Lumen';
  }

  button.setAttribute('data-extension-id', payload.id);
}

function setChromeWebStoreImportButtonText(label, isError = false) {
  try {
    const button = document.getElementById('lumen-chrome-store-import');
    if (!button) return;
    button.textContent = safeString(label, 128) || 'Import into Lumen';
    button.style.background = isError ? '#b91c1c' : '#2563eb';
  } catch {
    // ignore
  }
}

function handleChromeWebStoreClick(ev) {
  try {
    if (!isChromeWebStoreUrl()) return;
    if (!getChromeWebStoreInstallPayload()) return;
    if (!looksLikeChromeWebStoreInstallTrigger(ev?.target)) return;
    const clickedButton = closestInstallTrigger(ev?.target);

    try { ev.preventDefault?.(); } catch {}
    try { ev.stopImmediatePropagation?.(); } catch {}
    try { ev.stopPropagation?.(); } catch {}

    if (clickedButton && clickedButton.id === 'lumen-chrome-store-import') {
      clickedButton.textContent = 'Import requested';
    }
    requestChromeWebStoreInstall('page-install-button');
    ensureChromeWebStoreImportButton();
  } catch {
    // ignore
  }
}

try {
  try {
    ipcRenderer.on('extensions:storeInstallResult', (_event, payload) => {
      const ok = !!payload?.ok;
      if (ok) {
        setChromeWebStoreImportButtonText('Imported into Lumen', false);
      } else {
        setChromeWebStoreImportButtonText('Import failed', true);
      }
    });
  } catch {
    // ignore
  }

  function attachLumenLinkInterceptor() {
    try {
      const key = '__lumenLinkInterceptorAttached';
      if (document && document[key]) return;
      if (document) document[key] = true;
      document.addEventListener('click', handleLumenLinkClick, true);
      document.addEventListener('click', handleChromeWebStoreClick, true);
    } catch {
      // ignore
    }
  }

  function attachChromeWebStoreImportWatcher() {
    try {
      const key = '__lumenChromeStoreWatcherAttached';
      if (window && window[key]) return;
      if (window) window[key] = true;

      const refresh = () => {
        try {
          ensureChromeWebStoreImportButton();
        } catch {
          // ignore
        }
      };

      const observer = new MutationObserver(() => refresh());
      try {
        observer.observe(document.documentElement || document.body || document, {
          childList: true,
          subtree: true
        });
      } catch {
        // ignore
      }

      try {
        window.addEventListener('hashchange', refresh, true);
        window.addEventListener('popstate', refresh, true);
      } catch {
        // ignore
      }

      try {
        const wrapHistory = (methodName) => {
          const original = history && history[methodName];
          if (typeof original !== 'function') return;
          history[methodName] = function wrappedHistoryState(...args) {
            const result = original.apply(this, args);
            try { refresh(); } catch {}
            return result;
          };
        };
        wrapHistory('pushState');
        wrapHistory('replaceState');
      } catch {
        // ignore
      }

      window.setTimeout(refresh, 300);
      window.setTimeout(refresh, 1200);
      window.setTimeout(refresh, 2500);
    } catch {
      // ignore
    }
  }

  try {
    window.addEventListener('DOMContentLoaded', attachLumenLinkInterceptor, true);
    window.addEventListener('DOMContentLoaded', attachChromeWebStoreImportWatcher, true);
  } catch {}

  attachLumenLinkInterceptor();
  attachChromeWebStoreImportWatcher();
} catch {
  // ignore
}
