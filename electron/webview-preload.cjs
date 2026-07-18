// ============================================================================
// electron/webview-preload.cjs
//
// Preload script injected into every `<webview>` (session partition
// `persist:lumen`). Responsibilities:
//   1. Expose `window.lumen` — the site-facing API, restricted to `/ipfs/*`
//      and `/ipns/*` pages — documented via `npm run doc:window.lumen`
//      (see scripts/generate-window-lumen-doc.mjs -> docs/window-lumen.html).
//   2. Expose `window.keplr` / `window.leap` fallbacks so Cosmos dApps work
//      against the embedded wallet when no real Keplr/Leap extension is loaded.
//   3. Shim the `chrome`/`browser` extension API for extensions running
//      inside webviews (tabs/storage/runtime/permissions/alarms/...).
//   4. Intercept `lumen://` links and Chrome Web Store "Add to Chrome"
//      buttons so installs/navigation route through the host app.
//
// Generic, stateless helpers (URL parsing, response-shape wrapping, chrome.*
// call normalization, DOM detection, ...) live in `./utils/webview.cjs` and
// are accessed here as `webview_utils.*`.
//
// --- Doc-generation contract -----------------------------------------------
// `scripts/generate-window-lumen-doc.mjs` parses the `lumen` object literal
// declared below as TEXT (it never executes this file) using naive per-line
// brace-depth counting. That means every leaf entry in `lumen` MUST be a
// single line shaped like:
//
//   name: wrapLumenApiCall(someNamedFunction, 'fallback_error_code'),
//
// immediately preceded by a `/** ... */` JSDoc block (description, @param,
// @returns, @error). Never inline a multi-line function body directly inside
// `lumen` — a stray line that is exactly `}` or `},` inside that body will be
// mistaken by the parser for the end of a namespace and corrupt the rest of
// the generated docs. Put real logic in a named function above the object
// instead (see the "window.lumen action functions" section below) and
// reference it by name.
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');
const webview_utils = require('./utils/webview.cjs');

// `wrapLumenApiCall`/`ensureLumenSite` are destructured (rather than called
// as `webview_utils.wrapLumenApiCall`) specifically so every entry in
// `const lumen` can read as `name: wrapLumenApiCall(fn, 'code'),` — the exact
// shape the doc generator's regex matches. See the contract note above.
const { wrapLumenApiCall, ensureLumenSite } = webview_utils;

const EXTENSION_DEBUG =
  typeof process !== 'undefined' &&
  process &&
  process.env &&
  process.env.LUMEN_EXTENSION_DEBUG === '1';

const EXTENSION_API_SHIM_KEY = '__lumenExtensionWebviewApiShim';
const EXTENSION_API_SHIM_SOURCE = 'webview';

// ---- module state -----------------------------------------------------
const extensionGrantedPermissionsState = {
  loaded: false,
  permissions: new Set(),
  origins: new Set()
};
let extensionManifestCache = null;
const suggestedChains = new Map();
const providerFallbackState = webview_utils.getProviderFallbackStateSync(ipcRenderer);

function debugLog(...args) {
  if (!EXTENSION_DEBUG) return;
  try {
    console.log(...args);
  } catch {}
}

/** Send an event to the host (main process) via `sendToHost` when available, falling back to `ipcRenderer.send`. */
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

// ============================================================================
// SECTION: extension identity / manifest / dynamic-permissions helpers
// ============================================================================

/** Resolve a `tabs.create`/`windows.create` target URL to an absolute URL relative to the extension's origin. */
function normalizeTargetUrl(input) {
  const value = webview_utils.safeString(input, 4096);
  if (!value) return '';

  try {
    if (value.startsWith('/')) {
      return `${webview_utils.getExtensionOrigin()}/${value.replace(/^\/+/, '')}`;
    }
    return new URL(value, webview_utils.currentHref() || `${webview_utils.getExtensionOrigin()}/`).toString();
  } catch {
    return value;
  }
}

/** Fetch (and cache) the extension's `manifest.json`, falling back to a minimal MV3 stub if unreachable. */
function getExtensionManifest() {
  if (extensionManifestCache) {
    return webview_utils.cloneValue(extensionManifestCache);
  }

  try {
    const request = new XMLHttpRequest();
    request.open('GET', `${webview_utils.getExtensionOrigin()}/manifest.json`, false);
    request.send(null);
    if (request.status >= 200 && request.status < 400 && request.responseText) {
      const parsed = JSON.parse(request.responseText);
      if (parsed && typeof parsed === 'object') {
        extensionManifestCache = parsed;
        return webview_utils.cloneValue(extensionManifestCache);
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
  return webview_utils.cloneValue(extensionManifestCache);
}

function normalizeGrantedPermissionPayload(input) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    permissions: Array.isArray(value.permissions)
      ? value.permissions.map((entry) => webview_utils.safeString(entry, 256)).filter(Boolean)
      : [],
    origins: Array.isArray(value.origins)
      ? value.origins.map((entry) => webview_utils.safeString(entry, 4096)).filter(Boolean)
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
      webview_utils.getExtensionRequestContext(),
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
          ? manifest.permissions.map((entry) => webview_utils.safeString(entry, 256)).filter(Boolean)
          : []),
        ...granted.permissions
      ])
    ),
    origins: Array.from(
      new Set([
        ...(Array.isArray(manifest?.host_permissions)
          ? manifest.host_permissions.map((entry) => webview_utils.safeString(entry, 4096)).filter(Boolean)
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
      extensionContext: webview_utils.getExtensionRequestContext(),
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
      extensionContext: webview_utils.getExtensionRequestContext(),
      details: details || {}
    });
    if (result && result.ok !== false && result.granted) {
      setGrantedPermissionsState(result.granted);
    }
    return !!result?.removed;
  }, callback, false);
}

// ============================================================================
// SECTION: Cosmos wallet bridge (Keplr/Leap-compatible offline signer)
//
// Backs `window.keplr` / `window.leap` (injected only when no real
// Keplr/Leap extension is detected, see `providerFallbackState`) so dApps
// written against Keplr's API work against the embedded Lumen wallet.
// ============================================================================

async function getActiveWalletProfile() {
  const profile = await ipcRenderer.invoke('profiles:getActive');
  if (!profile || !profile.id) {
    throw new Error('active_profile_missing');
  }
  const walletAddress = webview_utils.safeString(profile.walletAddress || profile.address || '', 256);
  if (!walletAddress) {
    throw new Error('wallet_address_missing');
  }
  return {
    profileId: webview_utils.safeString(profile.id, 128),
    walletAddress,
    profile
  };
}

async function resolveChainContext(chainIdInput) {
  const requestedChainId = webview_utils.safeString(chainIdInput, 128);
  const activeProfile = await getActiveWalletProfile();
  const fallbackPrefix = webview_utils.prefixFromAddress(activeProfile.walletAddress || 'lmn');
  const hinted = requestedChainId ? suggestedChains.get(requestedChainId) || null : null;

  if (hinted) {
    return {
      chainId: hinted.chainId,
      chainName: hinted.chainName,
      bech32Config: webview_utils.buildBech32Config(hinted.bech32Config, fallbackPrefix),
      profile: activeProfile
    };
  }

  let networkChainId = '';
  try {
    const state = await ipcRenderer.invoke('net:getState');
    networkChainId = webview_utils.safeString(state?.state?.networkChainId, 128);
  } catch {
    // ignore
  }

  return {
    chainId: requestedChainId || networkChainId || 'lumen',
    chainName: requestedChainId || networkChainId || 'Lumen',
    bech32Config: webview_utils.buildBech32Config({}, fallbackPrefix),
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
    throw new Error(webview_utils.safeString(response?.error || 'wallet_accounts_failed', 256));
  }
  const account = Array.isArray(response.accounts) ? response.accounts[0] : null;
  if (!account || !account.address) {
    throw new Error('wallet_account_missing');
  }
  return {
    ...context,
    account: {
      address: webview_utils.safeString(account.address, 256),
      algo: webview_utils.safeString(account.algo, 64) || 'secp256k1',
      pubkey: webview_utils.normalizeBytes(account.pubkey)
    }
  };
}

function serializeStdSignature(result) {
  return {
    pub_key: {
      type: webview_utils.safeString(result?.pub_key?.type || 'tendermint/PubKeySecp256k1', 128),
      value: webview_utils.safeString(result?.pub_key?.value || '', 4096)
    },
    signature: webview_utils.safeString(result?.signature || '', 4096)
  };
}

function rememberSuggestedChain(chainInfo) {
  const info = chainInfo && typeof chainInfo === 'object' ? chainInfo : {};
  const chainId = webview_utils.safeString(info.chainId, 128);
  if (!chainId) {
    throw new Error('missing_chain_id');
  }
  suggestedChains.set(chainId, {
    chainId,
    chainName: webview_utils.safeString(info.chainName, 256) || chainId,
    bech32Config: webview_utils.buildBech32Config(info.bech32Config || {}, 'lmn')
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
        signerAddress: webview_utils.safeString(signerAddress, 256) || context.account.address,
        signDoc: signDoc || {}
      });
      if (!response || response.ok === false) {
        throw new Error(webview_utils.safeString(response?.error || 'sign_amino_failed', 256));
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
        signerAddress: webview_utils.safeString(signerAddress, 256) || context.account.address,
        signDoc: signDoc || {}
      });
      if (!response || response.ok === false) {
        throw new Error(webview_utils.safeString(response?.error || 'sign_direct_failed', 256));
      }
      return {
        signed: {
          chainId: webview_utils.safeString(response.signed?.chainId, 128),
          accountNumber: BigInt(webview_utils.safeString(response.signed?.accountNumber, 128) || '0'),
          bodyBytes: webview_utils.normalizeBytes(response.signed?.bodyBytes),
          authInfoBytes: webview_utils.normalizeBytes(response.signed?.authInfoBytes)
        },
        signature: serializeStdSignature(response.signature || {})
      };
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
        throw new Error(webview_utils.safeString(response?.error || 'get_key_failed', 256));
      }
      return {
        name: webview_utils.safeString(response.name, 256) || providerName,
        algo: webview_utils.safeString(response.algo, 64) || 'secp256k1',
        bech32Address: webview_utils.safeString(response.bech32Address || response.address, 256),
        address: webview_utils.safeString(response.address || response.bech32Address, 256),
        pubKey: webview_utils.normalizeBytes(response.pubKey),
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
        address: webview_utils.safeString(signer, 256) || context.account.address,
        algo: 'ADR-036',
        payload: typeof data === 'string' ? data : Buffer.from(webview_utils.normalizeBytes(data)).toString('utf8')
      });
      if (!response || response.ok === false) {
        throw new Error(webview_utils.safeString(response?.error || 'sign_arbitrary_failed', 256));
      }
      return {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: webview_utils.safeString(response.pubkeyB64, 4096)
        },
        signature: webview_utils.safeString(response.signatureB64, 4096)
      };
    },
    sendTx: async (_chainId, txBytes, _mode) => {
      const response = await ipcRenderer.invoke('net:broadcastTx', webview_utils.normalizeBytes(txBytes), {});
      if (!response || response.ok === false) {
        throw new Error(webview_utils.safeString(response?.rawLog || response?.error || 'broadcast_failed', 512));
      }
      const txHash = webview_utils.safeString(response.transactionHash, 256);
      if (/^[0-9a-f]+$/i.test(txHash) && txHash.length % 2 === 0) {
        return new Uint8Array(Buffer.from(txHash, 'hex'));
      }
      return webview_utils.normalizeBytes(txBytes);
    },
    sendTransaction: async (payload) => {
      if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'txBytes')) {
        const response = await ipcRenderer.invoke('net:broadcastTx', webview_utils.normalizeBytes(payload.txBytes), payload.options || {});
        if (!response || response.ok === false) {
          throw new Error(webview_utils.safeString(response?.rawLog || response?.error || 'broadcast_failed', 512));
        }
        return response;
      }

      const context = await getWalletAccountsForChain(payload?.chainId);
      const response = await ipcRenderer.invoke('wallet:sendTokens', {
        profileId: context.profile.profileId,
        from: context.account.address,
        to: webview_utils.safeString(payload?.to || payload?.recipient, 256),
        amount: Number(payload?.amount || 0),
        denom: webview_utils.safeString(payload?.denom || 'ulmn', 64) || 'ulmn',
        memo: webview_utils.safeString(payload?.memo || '', 1024)
      });
      if (!response || response.ok === false) {
        throw new Error(webview_utils.safeString(response?.error || 'send_transaction_failed', 512));
      }
      return response;
    }
  };
}

/** `contextBridge.exposeInMainWorld`, swallowing the "already exposed" error on re-injection. */
function maybeExposeProvider(name, provider) {
  try {
    contextBridge.exposeInMainWorld(name, provider);
  } catch {
    // ignore duplicate exposure attempts
  }
}

// ============================================================================
// SECTION: window.lumen action functions
//
// One function per `window.lumen` API entry. Every one of these is only
// ever called through `wrapLumenApiCall(...)` (see the `lumen` object below),
// which guarantees a uniform `{ok, data?, error?}` response shape and never
// lets an exception escape across the contextBridge — so these functions are
// free to `throw` for any failure condition.
// ============================================================================

/** Resolve a `lumen://ipfs/<cid>`, `lumen://ipns/<name>`, `/ipfs/...`, `/ipns/...` or http(s) URL to a fetchable gateway URL. */
async function resolveUrl(urlOrPath) {
  ensureLumenSite();
  const raw = webview_utils.safeString(urlOrPath, 4096);
  if (!raw) return '';

  // Accept lumen://ipfs/<cid>/... and lumen://ipns/<name>/...
  if (/^lumen:\/\//i.test(raw)) {
    const parsed = webview_utils.parseLumenIpfsOrIpns(raw);
    if (!parsed.kind || !parsed.id) return '';
    const base = (await webview_utils.getLocalGatewayBase(ipcRenderer)) || webview_utils.safeString(location?.origin || '', 1024);
    const b = String(base || '').replace(/\/+$/, '');
    return `${b}/${parsed.kind}/${parsed.id}${parsed.rest || ''}`;
  }

  // Accept /ipfs/... and /ipns/... paths.
  if (/^\/(ipfs|ipns)\//i.test(raw)) {
    const base = (await webview_utils.getLocalGatewayBase(ipcRenderer)) || webview_utils.safeString(location?.origin || '', 1024);
    const b = String(base || '').replace(/\/+$/, '');
    return `${b}${raw}`;
  }

  // Fallback: return as-is if it's already http(s).
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw;
}

/** Send LMN from the active wallet via the host's confirmation UI. */
async function sendToken(rawTx) {
  ensureLumenSite();
  const tx = rawTx && typeof rawTx === 'object' ? rawTx : {};
  const to = webview_utils.safeString(tx.to || '', 256);
  const memo = webview_utils.safeString(tx.memo || '', 1024);
  const amountLmn =
    typeof tx.amount_lmn === 'number' && Number.isFinite(tx.amount_lmn) ? tx.amount_lmn : null;

  try {
    return await ipcRenderer.invoke('lumenSite:sendToken', { to, memo, amountLmn, title: webview_utils.safeString(document?.title || '', 256) });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'send_failed', 512) };
  }
}

/** Pin a CID/URL to the user's Drive via the host's confirmation UI. */
async function pinCid(cidOrUrl, optsMaybe) {
  ensureLumenSite();
  const inputObj = cidOrUrl && typeof cidOrUrl === 'object' ? cidOrUrl : null;
  const cidOrUrlStr = webview_utils.safeString(
    inputObj ? (inputObj.cidOrUrl || inputObj.cid || inputObj.url || '') : cidOrUrl,
    4096
  );
  if (!cidOrUrlStr) return { ok: false, error: 'missing_cid' };

  const name = webview_utils.safeString(
    inputObj ? (inputObj.name || inputObj.title || inputObj.filename || '') : (optsMaybe && optsMaybe.name ? optsMaybe.name : ''),
    256
  );
  try {
    return await ipcRenderer.invoke('lumenSite:pin', {
      cidOrUrl: cidOrUrlStr,
      name,
      title: webview_utils.safeString(document?.title || '', 256)
    });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'pin_failed', 512) };
  }
}

/** Open the stable-link picker so the site can choose/create an IPNS key for live content. */
async function chooseStableLinkForLive(input) {
  ensureLumenSite();
  const payload = input && typeof input === 'object' ? input : {};
  try {
    return await ipcRenderer.invoke('lumenSite:stableLinkForLive', {
      title: webview_utils.safeString(payload.title || document?.title || '', 256),
      suggestedName: webview_utils.safeString(payload.suggestedName || payload.name || '', 128),
      records: Array.isArray(payload.records)
        ? payload.records.map((record) => ({
            key: webview_utils.safeString(record && record.key ? record.key : '', 128),
            value: webview_utils.safeString(record && record.value ? record.value : '', 4096),
          }))
        : [],
    });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'stable_link_failed', 512) };
  }
}

/** Start a fresh stable-link setup flow (create a new IPNS key for live use). */
async function selectStableLinkForLiveSetup(input) {
  ensureLumenSite();
  const payload = input && typeof input === 'object' ? input : {};
  try {
    return await ipcRenderer.invoke('lumenSite:stableLinkSetup', {
      title: webview_utils.safeString(payload.title || document?.title || '', 256),
    });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'stable_link_setup_failed', 512) };
  }
}

/** Publish `records` under an existing stable-link IPNS key. */
async function publishStableLinkForLive(input) {
  ensureLumenSite();
  const payload = input && typeof input === 'object' ? input : {};
  try {
    return await ipcRenderer.invoke('lumenSite:publishStableLinkForLive', {
      title: webview_utils.safeString(payload.title || document?.title || '', 256),
      keyName: webview_utils.safeString(payload.keyName || '', 256),
      records: Array.isArray(payload.records)
        ? payload.records.map((record) => ({
            key: webview_utils.safeString(record && record.key ? record.key : '', 128),
            value: webview_utils.safeString(record && record.value ? record.value : '', 4096),
          }))
        : [],
    });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'stable_link_publish_failed', 512) };
  }
}

/** Toggle fullscreen for the browser window hosting this site. */
async function setWindowFullscreen(active) {
  ensureLumenSite();
  try {
    return await ipcRenderer.invoke('lumenSite:setFullscreen', { active: !!active });
  } catch (e) {
    return { ok: false, error: webview_utils.safeString(e?.message || e || 'window_fullscreen_failed', 512) };
  }
}

/** Get the currently active Lumen profile. */
async function profilesGetActive() {
  ensureLumenSite();
  return await ipcRenderer.invoke('profiles:getActive');
}

/** Add data to IPFS via the host node. */
async function siteIpfsAdd(data, filename) {
  ensureLumenSite();
  return await ipcRenderer.invoke('ipfs:add', data, webview_utils.safeString(filename || 'site-data.json', 256));
}

/** Retrieve content from IPFS by CID or path. */
async function siteIpfsGet(cid, options) {
  ensureLumenSite();
  return await ipcRenderer.invoke('ipfs:get', webview_utils.safeString(cid || '', 4096), options || {});
}

/** Resolve an IPNS name to the CID/path it currently points at. */
async function siteIpfsResolveIPNS(name) {
  ensureLumenSite();
  return await ipcRenderer.invoke('ipfs:resolveIPNS', webview_utils.safeString(name || '', 512));
}

/** Publish a CID under an IPNS key on the host (auto-creates the key if missing). */
async function siteIpfsPublishToIPNS(cid, key, options) {
  ensureLumenSite();
  return await ipcRenderer.invoke(
    'ipfs:publishToIPNS',
    webview_utils.safeString(cid || '', 512),
    webview_utils.safeString(key || '', 256),
    Object.assign({}, options || {}, { autoCreateKey: true })
  );
}

/** Publish a message on an IPFS pubsub topic (text/json/binary encoding, inferred from `data` unless `opts.encoding` is set). */
async function pubsubPublish(topic, data, opts) {
  ensureLumenSite();
  const encoding =
    (opts && opts.encoding) ||
    (typeof data === 'string' ? 'text' : (typeof data === 'object' ? 'json' : 'text'));

  const payload = { topic: webview_utils.safeString(topic, 1024), encoding };
  if (encoding === 'binary') {
    if (data instanceof Uint8Array) payload.dataB64 = Buffer.from(data).toString('base64');
    else payload.dataB64 = webview_utils.safeString(data, 1024 * 1024);
  } else if (encoding === 'json') {
    payload.data = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  } else {
    payload.data = String(data ?? '');
  }
  return await ipcRenderer.invoke('ipfs:pubsub:publish', payload);
}

/**
 * Subscribe to an IPFS pubsub topic. Returns a subscription handle with
 * `getSubId`/`getTopics`/`getState`/`unsubscribe`, and auto-reconnects (with
 * backoff) on stream failure unless `opts.autoReconnect === false`.
 */
async function pubsubSubscribe(topic, opts = {}, onMessage) {
  ensureLumenSite();
  const encoding = (opts && opts.encoding) ? String(opts.encoding) : 'text';
  const autoConnect = !!(opts && opts.autoConnect);
  const autoReconnect = !opts || opts.autoReconnect !== false;
  const reconnectDelaysMs = webview_utils.normalizeReconnectDelays(opts && opts.reconnectDelaysMs);
  const maxReconnectAttempts = webview_utils.safeCount(
    opts && opts.maxReconnectAttempts,
    reconnectDelaysMs.length,
    Math.max(reconnectDelaysMs.length, 16)
  );
  const onStatus = opts && typeof opts.onStatus === 'function' ? opts.onStatus : null;
  const onError = opts && typeof opts.onError === 'function' ? opts.onError : null;
  const onEnd = opts && typeof opts.onEnd === 'function' ? opts.onEnd : null;
  const topicRaw = webview_utils.safeString(topic, 1024);

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
    webview_utils.callMaybe(onStatus, state, detail);
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
      const subId = webview_utils.safeString(res && res.subId ? res.subId : '', 256);
      if (subId) {
        try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
      }
      return;
    }
    if (myNonce !== subscribeNonce) {
      const subId = webview_utils.safeString(res && res.subId ? res.subId : '', 256);
      if (subId) {
        try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
      }
      return;
    }
    if (!res || res.ok === false) {
      const error = (res && res.error) ? String(res.error) : 'subscribe_failed';
      webview_utils.callMaybe(onError, { error, phase: isReconnect ? 'reconnect' : 'subscribe', attempt: reconnectAttempt });
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
      webview_utils.callMaybe(onEnd, { subId, reason: 'unsubscribe', manual: true });
      if (subId) {
        try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
      }
    },
  };

  const hMsg = (_e, payload) => {
    try {
      if (!payload || payload.subId !== currentSubId) return;
      if (payload.binary && Array.isArray(payload.binary)) payload.binary = new Uint8Array(payload.binary);
      onMessage && onMessage(payload);
    } catch {}
  };
  const hErr = (_e, payload) => {
    if (!payload) return;
    const subId = String(payload.subId || '');
    if (!subId) return;
    if (subId !== currentSubId && subId !== terminalSubId) return;
    webview_utils.callMaybe(onError, {
      subId,
      error: webview_utils.safeString(payload.error, 1024) || 'stream_error',
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
      webview_utils.callMaybe(onEnd, { subId, reason: 'stream_ended', manual: false });
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
}

/** Sign arbitrary data with the active wallet key (ADR-036 style by default). */
async function walletSignArbitrary(args) {
  ensureLumenSite();
  const a = args && typeof args === 'object' ? args : {};
  return await ipcRenderer.invoke('wallet:signArbitrary', {
    profileId: webview_utils.safeString(a.profileId, 128),
    address: webview_utils.safeString(a.address, 256),
    algo: webview_utils.safeString(a.algo || 'ADR-036', 64),
    payload: webview_utils.safeString(a.payload, 1024 * 1024),
  });
}

/** Verify a signature previously produced by `walletSignArbitrary`. */
async function walletVerifyArbitrary(args) {
  ensureLumenSite();
  const a = args && typeof args === 'object' ? args : {};
  return await ipcRenderer.invoke('wallet:verifyArbitrary', {
    algo: webview_utils.safeString(a.algo || 'ADR-036', 64),
    payload: webview_utils.safeString(a.payload, 1024 * 1024),
    signatureB64: webview_utils.safeString(a.signatureB64, 4096),
    pubkeyB64: webview_utils.safeString(a.pubkeyB64, 4096),
    address: webview_utils.safeString(a.address, 256),
  });
}

// ============================================================================
// SECTION: window.lumen — the documented, site-facing API surface
//
// Only exposed on `/ipfs/*` / `/ipns/*` pages (see `initWebviewPreload`
// below). Every entry is wrapped with `wrapLumenApiCall`, so every method
// ALWAYS resolves to `{ok: true, data?}` or `{ok: false, error}` — it never
// throws or rejects across the contextBridge. See the doc-generation
// contract note at the top of this file before editing this object.
// ============================================================================

/**
 * Client API injected into renderer pages that are loaded from IPFS/IPNS.
 * @namespace lumen
 */
const lumen = {
  /**
   * Pin a CID (or a `/ipfs/...`, `/ipns/...`, `lumen://...` URL) to the
   * user's Drive, via a confirmation modal.
   * @param {string|object} cidOrUrl - CID/URL string, or `{cidOrUrl|cid|url, name?}`.
   * @param {object} [optsMaybe] - `{name}`, used when `cidOrUrl` is a plain string.
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
   * @error {missing_cid} No CID/URL could be extracted from the input.
   * @error {pin_failed} The user declined, or pinning failed on the host.
   */
  Pin: wrapLumenApiCall(pinCid, 'pin_failed'),

  /**
   * Resolve a `lumen://ipfs/<cid>`, `lumen://ipns/<name>`, `/ipfs/...`,
   * `/ipns/...` or already-absolute http(s) URL into a fetchable gateway URL.
   * @param {string} urlOrPath - The URL/path to resolve.
   * @returns {Promise<{ok:boolean,data?:string,error?:string}>} `data` is the resolved URL, or '' if unrecognized.
   * @error {resolve_url_failed} The local gateway could not be reached.
   */
  resolveUrl: wrapLumenApiCall(resolveUrl, 'resolve_url_failed'),

  /**
   * Toggle fullscreen for the browser window hosting this site.
   * @param {boolean} active - `true` to enter fullscreen, `false` to exit.
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
   * @error {window_fullscreen_failed} The host window was not available.
   */
  setWindowFullscreen: wrapLumenApiCall(setWindowFullscreen, 'window_fullscreen_failed'),

  stableLinks: {
    /**
     * Open the stable-link picker so the site can choose (or create) an IPNS
     * key to publish live/streamed content under.
     * @param {object} input - `{title?, suggestedName?, records?: {key,value}[]}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
     * @error {stable_link_failed} The user cancelled, or no stable link is available.
     */
    chooseForLive: wrapLumenApiCall(chooseStableLinkForLive, 'stable_link_failed'),

    /**
     * Start a fresh stable-link setup flow (create a new IPNS key for live use).
     * @param {object} input - `{title?}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
     * @error {stable_link_setup_failed} Key creation was cancelled or failed.
     */
    selectForLiveSetup: wrapLumenApiCall(selectStableLinkForLiveSetup, 'stable_link_setup_failed'),

    /**
     * Publish `records` under an existing stable-link IPNS key.
     * @param {object} input - `{title?, keyName, records?: {key,value}[]}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
     * @error {stable_link_publish_failed} The IPNS publish failed.
     */
    publishForLive: wrapLumenApiCall(publishStableLinkForLive, 'stable_link_publish_failed'),
  },

  profiles: {
    /**
     * Get the currently active Lumen profile.
     * @returns {Promise<{ok:boolean,data?:object,error?:string}>} `data` is the profile record.
     * @error {get_active_failed} No active profile / wallet is set up.
     */
    getActive: wrapLumenApiCall(profilesGetActive, 'get_active_failed')
  },

  /**
   * Add data to IPFS via the host node.
   * @param {Uint8Array|Buffer|object|string} data - The content to add.
   * @param {string} [filename] - Filename hint (default `site-data.json`).
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>} `data` includes the resulting CID.
   * @error {ipfs_add_failed} The host node was unreachable or the add failed.
   */
  ipfsAdd: wrapLumenApiCall(siteIpfsAdd, 'ipfs_add_failed'),

  /**
   * Retrieve content from IPFS by CID or path.
   * @param {string} cid - CID or `/ipfs/...` path.
   * @param {object} [options] - Host-defined retrieval options.
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
   * @error {ipfs_get_failed} The content could not be fetched.
   */
  ipfsGet: wrapLumenApiCall(siteIpfsGet, 'ipfs_get_failed'),

  /**
   * Resolve an IPNS name to the CID/path it currently points at.
   * @param {string} name - IPNS name/key to resolve.
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
   * @error {ipfs_resolve_ipns_failed} Resolution failed or timed out.
   */
  ipfsResolveIPNS: wrapLumenApiCall(siteIpfsResolveIPNS, 'ipfs_resolve_ipns_failed'),

  /**
   * Publish a CID under an IPNS key on the host (auto-creates the key if it
   * doesn't exist yet).
   * @param {string} cid - CID to publish.
   * @param {string} key - IPNS key name.
   * @param {object} [options] - Additional publish options.
   * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
   * @error {ipfs_publish_ipns_failed} The publish failed.
   */
  ipfsPublishToIPNS: wrapLumenApiCall(siteIpfsPublishToIPNS, 'ipfs_publish_ipns_failed'),

  pubsub: {
    /**
     * Publish a message on an IPFS pubsub topic.
     * @param {string} topic - Topic name.
     * @param {string|object|Uint8Array} data - Payload; encoding is inferred from its type unless `opts.encoding` is set.
     * @param {object} [opts] - `{encoding?: 'text'|'json'|'binary'}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
     * @error {pubsub_publish_failed} The message could not be published.
     */
    publish: wrapLumenApiCall(pubsubPublish, 'pubsub_publish_failed'),

    /**
     * Subscribe to an IPFS pubsub topic. Auto-reconnects on stream failure
     * unless `opts.autoReconnect` is `false`.
     * @param {string} topic - Topic name.
     * @param {object} [opts] - `{encoding?, autoConnect?, autoReconnect?, reconnectDelaysMs?, maxReconnectAttempts?, onStatus?, onError?, onEnd?}`.
     * @param {function} [onMessage] - Called with each incoming message payload.
     * @returns {Promise<{ok:boolean,data?:{getSubId:function,getTopics:function,getState:function,unsubscribe:function},error?:string}>}
     *   `data` is a subscription handle; call `data.unsubscribe()` to stop.
     * @error {pubsub_subscribe_failed} The initial subscribe call failed.
     */
    subscribe: wrapLumenApiCall(pubsubSubscribe, 'pubsub_subscribe_failed')
  },

  wallet: {
    /**
     * Send LMN (or a memo-only transfer) from the active wallet, using the
     * embedded wallet UI to prompt/confirm on the user's behalf.
     * @param {object} payment - `{to, memo?, amount_lmn?}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>} Resolves with the broadcast result on success.
     * @error {send_failed} Wallet/profile missing, user declined, or broadcast failed.
     */
    requestSend: wrapLumenApiCall(sendToken, 'send_failed'),

    /**
     * Sign arbitrary data with the active wallet key (ADR-036 style by default).
     * @param {object} args - `{profileId?, address, algo?, payload}`.
     * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
     * @error {sign_arbitrary_failed} Signing failed or was declined.
     */
    signArbitrary: wrapLumenApiCall(walletSignArbitrary, 'sign_arbitrary_failed'),

    /**
     * Verify a signature produced by `signArbitrary`.
     * @param {object} args - `{algo?, payload, signatureB64, pubkeyB64, address}`.
     * @returns {Promise<{ok:boolean,data?:boolean,error?:string}>} `data` is `true` when the signature is valid.
     * @error {verify_arbitrary_failed} Verification failed (bad signature/pubkey/payload).
     */
    verifyArbitrary: wrapLumenApiCall(walletVerifyArbitrary, 'verify_arbitrary_failed')
  }
};

// ============================================================================
// SECTION: chrome/browser extension API shim
//
// Reimplements the parts of the `chrome.*`/`browser.*` extension API that
// extensions running inside a `<webview>` need (tabs/windows/storage/runtime/
// permissions/alarms/notifications/identity/sidePanel/scripting/webNavigation).
// Falls back to the native Electron extension API where available and only
// fills in gaps with the local shim below.
//
// NOTE: an equivalent shim also exists in `extension-preload.cjs` (top-level
// extension pages) and `extension-service-worker-preload.cjs` (MV3 service
// workers) — those two contexts can't share this module verbatim because
// they don't run inside a webview guest, but any behavioral fix made here
// (e.g. to `runtime.sendMessage` retry logic) should be mirrored there too.
// ============================================================================

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
    url: webview_utils.currentHref(),
    title: webview_utils.safeString(document?.title, 256) || 'Lumen'
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
          title: webview_utils.safeString(options?.title, 256) || 'Lumen'
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
        return webview_utils.callNativeMethod(
          nativeChromeTabs?.get,
          nativeChromeTabs,
          [tabId],
          undefined,
          () => tabs.get(tabId) || tabs.get(currentTabId) || null,
          normalizeNativeTabResult
        );
      },
      query: async (queryInfo) => {
        return webview_utils.callNativeMethod(
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
        const { args, callback } = webview_utils.normalizeTabsSendMessageCall([
          tabId,
          message,
          optionsOrCallback,
          maybeCallback
        ]);
        return webview_utils.callNativeMethod(
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
        return webview_utils.callNativeMethod(
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
        return webview_utils.asyncResult(null, callback);
      },
      getBrowserInfo: (callback) => {
        if (typeof nativeRuntime?.getBrowserInfo === 'function') {
          try {
            return nativeRuntime.getBrowserInfo(callback);
          } catch {}
        }
        return webview_utils.asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback);
      },
      getPlatformInfo: (callback) => {
        if (typeof nativeRuntime?.getPlatformInfo === 'function') {
          try {
            return nativeRuntime.getPlatformInfo(callback);
          } catch {}
        }
        const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
        const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
        return webview_utils.asyncResult({ os, arch, nacl_arch: arch }, callback);
      },
      openOptionsPage: (callback) => {
        if (typeof nativeRuntime?.openOptionsPage === 'function') {
          try {
            return nativeRuntime.openOptionsPage(callback);
          } catch {}
        }
        return webview_utils.asyncResult(undefined, callback);
      },
      connect: (extensionIdOrConnectInfo, connectInfo) => {
        if (typeof nativeRuntime?.connect === 'function') {
          try {
            return nativeRuntime.connect(
              ...webview_utils.normalizeRuntimeConnectCall([extensionIdOrConnectInfo, connectInfo])
            );
          } catch {}
        }
        return {
          name: String(connectInfo?.name || extensionIdOrConnectInfo?.name || ''),
          disconnect() {},
          postMessage() {},
          onMessage: webview_utils.createBrowserEvent(),
          onDisconnect: webview_utils.createBrowserEvent()
        };
      },
      onMessage: nativeRuntime?.onMessage || webview_utils.createBrowserEvent(),
      onConnect: nativeRuntime?.onConnect || webview_utils.createBrowserEvent(),
      onStateChanged: webview_utils.createBrowserEvent(),
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
          return webview_utils.callMainWorldRuntimeSendMessage(
            contextBridge,
            [
              extensionIdOrMessage,
              messageOrOptions,
              optionsOrCallback,
              maybeCallback
            ],
            () => ({})
          );
        }
        return webview_utils.callNativeRuntimeSendMessage(
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

function enhanceExtensionBrowserApi(api) {
  if (!api || typeof api !== 'object') return api;

  const runtimeId = webview_utils.getExtensionRuntimeId();
  const extensionOrigin = webview_utils.getExtensionOrigin();
  const storagePrefix = `__lumen_webview_extension_storage__/${runtimeId}/`;
  const notifications = new Map();
  const alarms = new Map();
  const sidePanelState = { openPanelOnActionClick: false };
  const storageEvents =
    api.storage?.onChanged && typeof api.storage.onChanged === 'object'
      ? api.storage.onChanged
      : webview_utils.createBrowserEvent();
  const idleEvents = { onStateChanged: webview_utils.createBrowserEvent() };
  const identityEvents = { onSignInChanged: webview_utils.createBrowserEvent() };
  const notificationsEvents = {
    onClicked: webview_utils.createBrowserEvent(),
    onButtonClicked: webview_utils.createBrowserEvent(),
    onClosed: webview_utils.createBrowserEvent(),
    onShown: webview_utils.createBrowserEvent(),
    onPermissionLevelChanged: webview_utils.createBrowserEvent()
  };
  const webNavigationEvents = {
    onBeforeNavigate: webview_utils.createBrowserEvent(),
    onCommitted: webview_utils.createBrowserEvent(),
    onCompleted: webview_utils.createBrowserEvent(),
    onDOMContentLoaded: webview_utils.createBrowserEvent(),
    onCreatedNavigationTarget: webview_utils.createBrowserEvent(),
    onHistoryStateUpdated: webview_utils.createBrowserEvent(),
    onReferenceFragmentUpdated: webview_utils.createBrowserEvent(),
    onErrorOccurred: webview_utils.createBrowserEvent()
  };
  let nextNotificationId = 1;

  const createAsyncStub = (value) => (...args) => {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    return webview_utils.asyncResult(webview_utils.cloneValue(value), callback);
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
      return webview_utils.asyncResult(webview_utils.pickStorageValues(readStorageArea(areaName), keys), callback);
    },
    set(items, callback) {
      const snapshot = readStorageArea(areaName);
      const next = { ...snapshot };
      const changes = {};
      for (const [key, value] of Object.entries(items && typeof items === 'object' ? items : {})) {
        const previous = snapshot[key];
        next[key] = webview_utils.cloneValue(value);
        if (JSON.stringify(previous) === JSON.stringify(next[key])) continue;
        changes[key] = { oldValue: webview_utils.cloneValue(previous), newValue: webview_utils.cloneValue(next[key]) };
      }
      writeStorageArea(areaName, next);
      dispatchStorageChanges(changes, areaName);
      return webview_utils.asyncResult(undefined, callback);
    },
    remove(keys, callback) {
      const snapshot = readStorageArea(areaName);
      const next = { ...snapshot };
      const changes = {};
      const keyList = Array.isArray(keys) ? keys.map((key) => String(key)) : [String(keys)];
      for (const key of keyList) {
        if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
        changes[key] = { oldValue: webview_utils.cloneValue(next[key]), newValue: undefined };
        delete next[key];
      }
      writeStorageArea(areaName, next);
      dispatchStorageChanges(changes, areaName);
      return webview_utils.asyncResult(undefined, callback);
    },
    clear(callback) {
      const snapshot = readStorageArea(areaName);
      const changes = {};
      for (const [key, value] of Object.entries(snapshot)) {
        changes[key] = { oldValue: webview_utils.cloneValue(value), newValue: undefined };
      }
      writeStorageArea(areaName, {});
      dispatchStorageChanges(changes, areaName);
      return webview_utils.asyncResult(undefined, callback);
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
      const normalized = webview_utils.safeString(path, 4096).replace(/^\/+/, '');
      return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
    }),
    getBackgroundPage: api.runtime?.getBackgroundPage || ((callback) => webview_utils.asyncResult(null, callback)),
    getBrowserInfo: api.runtime?.getBrowserInfo || ((callback) => webview_utils.asyncResult({ name: 'Lumen', vendor: 'Lumen', version: '1.0.0', buildID: 'lumen' }, callback)),
    getPlatformInfo: api.runtime?.getPlatformInfo || ((callback) => {
      const os = /mac/i.test(navigator.platform) ? 'mac' : /win/i.test(navigator.platform) ? 'win' : 'linux';
      const arch = /arm/i.test(navigator.userAgent) ? 'arm' : 'x86-64';
      return webview_utils.asyncResult({ os, arch, nacl_arch: arch }, callback);
    }),
    openOptionsPage: api.runtime?.openOptionsPage || ((callback) => webview_utils.asyncResult(undefined, callback)),
    requestUpdateCheck: api.runtime?.requestUpdateCheck || ((callback) => webview_utils.asyncResult({ status: 'no_update' }, callback)),
    setUninstallURL: api.runtime?.setUninstallURL || ((_url, callback) => webview_utils.asyncResult(undefined, callback))
  };

  if (!api.tabs?.getCurrent) {
    api.tabs = {
      ...(api.tabs || {}),
      getCurrent(callback) {
        return webview_utils.asyncResult({
          id: 1,
          windowId: 1,
          active: true,
          status: 'complete',
          title: webview_utils.safeString(globalThis.document?.title || getExtensionManifest().name || 'Extension', 512) || 'Extension',
          url: webview_utils.currentHref() || `${extensionOrigin}/`
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
        return webview_utils.asyncResult(state, callback);
      },
      setDetectionInterval: createAsyncStub(undefined),
      onStateChanged: idleEvents.onStateChanged
    };
  }

  if (!api.management) {
    api.management = {
      getSelf(callback) {
        const manifest = getExtensionManifest();
        return webview_utils.asyncResult({
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
        return webview_utils.asyncResult(
          requestedPermissions.every((item) => permissions.has(webview_utils.safeString(item, 256))) &&
            requestedOrigins.every((item) => origins.has(webview_utils.safeString(item, 4096))),
          callback,
        );
      },
      getAll(callback) {
        const manifest = getExtensionManifest();
        const effective = buildEffectivePermissionLists(manifest);
        return webview_utils.asyncResult({
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
        const name = hasName ? webview_utils.safeString(nameOrInfo, 256) : `alarm-${alarms.size + 1}`;
        alarms.set(name, {
          name,
          scheduledTime: Date.now(),
          periodInMinutes: Number((hasName ? alarmInfo : nameOrInfo)?.periodInMinutes || 0) || undefined
        });
      },
      get(name, callback) {
        return webview_utils.asyncResult(webview_utils.cloneValue(alarms.get(webview_utils.safeString(name, 256)) || null), callback);
      },
      getAll(callback) {
        return webview_utils.asyncResult(Array.from(alarms.values()).map(webview_utils.cloneValue), callback);
      },
      clear(name, callback) {
        return webview_utils.asyncResult(alarms.delete(webview_utils.safeString(name, 256)), callback);
      },
      clearAll(callback) {
        const hadAny = alarms.size > 0;
        alarms.clear();
        return webview_utils.asyncResult(hadAny, callback);
      },
      onAlarm: webview_utils.createBrowserEvent()
    };
  }

  if (!api.notifications) {
    api.notifications = {
      create(idOrOptions, optionsOrCallback, maybeCallback) {
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
        const notificationId = typeof idOrOptions === 'string' ? webview_utils.safeString(idOrOptions, 256) : `notification-${nextNotificationId++}`;
        const details =
          idOrOptions && typeof idOrOptions === 'object' && !Array.isArray(idOrOptions)
            ? idOrOptions
            : optionsOrCallback || {};
        notifications.set(notificationId, webview_utils.cloneValue(details));
        return webview_utils.asyncResult(notificationId, callback);
      },
      update(id, details, callback) {
        const key = webview_utils.safeString(id, 256);
        if (notifications.has(key)) {
          notifications.set(key, { ...(notifications.get(key) || {}), ...webview_utils.cloneValue(details || {}) });
        }
        return webview_utils.asyncResult(notifications.has(key), callback);
      },
      clear(id, callback) {
        return webview_utils.asyncResult(notifications.delete(webview_utils.safeString(id, 256)), callback);
      },
      getAll(callback) {
        return webview_utils.asyncResult(Object.fromEntries(Array.from(notifications.entries()).map(([id, value]) => [id, webview_utils.cloneValue(value)])), callback);
      },
      getPermissionLevel(callback) {
        return webview_utils.asyncResult('granted', callback);
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
        const normalized = webview_utils.safeString(path, 4096).replace(/^\/+/, '');
        return normalized ? `${extensionOrigin}/${normalized}` : `${extensionOrigin}/`;
      },
      getProfileUserInfo: createAsyncStub({ email: '', id: '' }),
      getAuthToken(detailsOrCallback, maybeCallback) {
        const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
        return webview_utils.asyncResult('', callback);
      },
      launchWebAuthFlow(details, callback) {
        return webview_utils.asyncResult(webview_utils.safeString(details?.url, 4096), callback);
      },
      removeCachedAuthToken(_details, callback) {
        return webview_utils.asyncResult(undefined, callback);
      },
      clearAllCachedAuthTokens(callback) {
        return webview_utils.asyncResult(undefined, callback);
      },
      onSignInChanged: identityEvents.onSignInChanged
    };
  }

  if (!api.sidePanel) {
    api.sidePanel = {
      open: createAsyncStub(undefined),
      setPanelBehavior(behavior, callback) {
        sidePanelState.openPanelOnActionClick = !!behavior?.openPanelOnActionClick;
        return webview_utils.asyncResult(undefined, callback);
      },
      getPanelBehavior(callback) {
        return webview_utils.asyncResult(webview_utils.cloneValue(sidePanelState), callback);
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
        return webview_utils.asyncResult({
          errorOccurred: false,
          frameId: 0,
          parentFrameId: -1,
          tabId: 1,
          url: webview_utils.currentHref() || `${extensionOrigin}/`
        }, callback);
      },
      getAllFrames(detailsOrCallback, maybeCallback) {
        const callback = typeof detailsOrCallback === 'function' ? detailsOrCallback : maybeCallback;
        return webview_utils.asyncResult([{
          errorOccurred: false,
          frameId: 0,
          parentFrameId: -1,
          processId: -1,
          tabId: 1,
          url: webview_utils.currentHref() || `${extensionOrigin}/`
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

/**
 * Patches `window.chrome`/`window.browser` in the page's MAIN world (not the
 * isolated preload world) by merging the shim onto whatever native extension
 * API Electron already installed there — needed because some extension code
 * runs before/outside the isolated-world contextBridge reach.
 */
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

// ============================================================================
// SECTION: lumen:// link interception + Chrome Web Store "Add to Chrome"
// button interception
// ============================================================================

/** Intercept left-clicks on `<a href="lumen://...">` links so they route through tab navigation instead of the webview's own navigation. */
function handleLumenLinkClick(ev) {
  try {
    if (!ev || ev.defaultPrevented) return;
    const button = typeof ev.button === 'number' ? ev.button : 0;
    if (button !== 0) return;

    const a = webview_utils.closestAnchorWithHref(ev.target);
    if (!a) return;

    const href = webview_utils.safeString((typeof a.getAttribute === 'function' ? a.getAttribute('href') : '') || a.href || '', 4096);
    if (!webview_utils.isLumenUrl(href)) return;

    const target = webview_utils.safeString((typeof a.getAttribute === 'function' ? a.getAttribute('target') : '') || a.target || '', 64).toLowerCase();
    const openInNewTab = target === '_blank';

    try { ev.preventDefault(); } catch {}
    try { ev.stopImmediatePropagation?.(); } catch {}
    try { ev.stopPropagation?.(); } catch {}

    sendHostEvent('lumen:navigate', { url: href, openInNewTab });
  } catch {
    // ignore
  }
}

/** Tell the host to install an extension detected on the current Chrome Web Store page. */
function requestChromeWebStoreInstall(trigger = 'unknown') {
  const payload = webview_utils.getChromeWebStoreInstallPayload();
  if (!payload) return false;
  sendHostEvent('extensions:installFromStore', {
    ...payload,
    trigger: webview_utils.safeString(trigger, 64) || 'unknown'
  });
  return true;
}

function removeChromeWebStoreImportButton() {
  try {
    const existing = document.getElementById('lumen-chrome-store-import');
    existing?.remove?.();
  } catch {
    // ignore
  }
}

/** Create/refresh the floating "Import into Lumen" button shown on Chrome Web Store extension pages. */
function ensureChromeWebStoreImportButton() {
  if (!webview_utils.isChromeWebStoreUrl()) {
    removeChromeWebStoreImportButton();
    return;
  }

  const payload = webview_utils.getChromeWebStoreInstallPayload();
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
    button.textContent = webview_utils.safeString(label, 128) || 'Import into Lumen';
    button.style.background = isError ? '#b91c1c' : '#2563eb';
  } catch {
    // ignore
  }
}

/** Intercept clicks on the Chrome Web Store's own "Add to Chrome" button (or our injected one) and route the install through the host. */
function handleChromeWebStoreClick(ev) {
  try {
    if (!webview_utils.isChromeWebStoreUrl()) return;
    if (!webview_utils.getChromeWebStoreInstallPayload()) return;
    if (!webview_utils.looksLikeChromeWebStoreInstallTrigger(ev?.target)) return;
    const clickedButton = webview_utils.closestInstallTrigger(ev?.target);

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

/** Wire up the `lumen://` link + Chrome Web Store click interceptors (idempotent, guarded by a marker on `document`). */
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

/** Watch the DOM (mutation observer + history patch + hashchange/popstate) for the Chrome Web Store install button appearing, e.g. on SPA navigation. */
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

// ============================================================================
// SECTION: bootstrap
//
// Everything above this point is only declarations (function/const) with no
// side effects, so it's safe to require() this module more than once and
// order-independent. This is the single place side effects happen, and it
// runs last so every `const` it references (lumen, browserApi, extensionApi,
// providerFallbackState, ...) is guaranteed to already be initialized.
// ============================================================================

function initWebviewPreload() {
  if (webview_utils.shouldInjectWebviewExtensionApi(ipcRenderer)) {
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
        href: webview_utils.currentHref(),
        hasSendToHost: webview_utils.isGuestRendererContext(ipcRenderer),
        isChromeExtensionUrl: webview_utils.isChromeExtensionUrl()
      });
    } catch {}
  }

  try {
    if (webview_utils.isIpfsGatewayUrl(webview_utils.currentHref())) {
      contextBridge.exposeInMainWorld('lumen', lumen);
    }
  } catch {
    // ignore
  }

  if (providerFallbackState.keplr) {
    maybeExposeProvider('keplr', createCosmosProvider('keplr'));
  }
  if (providerFallbackState.leap) {
    maybeExposeProvider('leap', createCosmosProvider('leap'));
  }

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

  try {
    window.addEventListener('DOMContentLoaded', attachLumenLinkInterceptor, true);
    window.addEventListener('DOMContentLoaded', attachChromeWebStoreImportWatcher, true);
  } catch {}

  attachLumenLinkInterceptor();
  attachChromeWebStoreImportWatcher();
}

initWebviewPreload();
