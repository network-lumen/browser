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
