const { contextBridge, ipcRenderer } = require('electron');

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function currentHref() {
  try {
    return String(location.href || '');
  } catch {
    return '';
  }
}

function isIpfsGatewayUrl(href) {
  try {
    const u = new URL(String(href || ''));
    const p = String(u.pathname || '/');
    return p === '/ipfs' || p.startsWith('/ipfs/') || p === '/ipns' || p.startsWith('/ipns/');
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

async function readCID(argOrOpts, optsMaybe) {
  ensureLumenSite();

  const inputObj = argOrOpts && typeof argOrOpts === 'object' ? argOrOpts : null;
  const arg = safeString(inputObj ? inputObj.arg : argOrOpts, 2048);
  if (!arg) return { ok: false, error: 'missing_cid' };

  const maxBytesRaw = inputObj ? inputObj.maxBytes : null;
  const maxBytes =
    typeof maxBytesRaw === 'number' && Number.isFinite(maxBytesRaw) && maxBytesRaw > 0
      ? Math.floor(maxBytesRaw)
      : null;

  const optionsObj = (inputObj ? inputObj : optsMaybe) && typeof (inputObj ? inputObj : optsMaybe) === 'object'
    ? (inputObj ? inputObj : optsMaybe)
    : {};

  const options = {
    timeoutMs: optionsObj.timeoutMs,
    gateways: optionsObj.gateways
  };

  const allowed = await requestUserConsent('ReadCID', { cid: arg, options: { timeoutMs: options.timeoutMs, maxBytes } });
  if (!allowed) return { ok: false, error: 'user_denied' };

  try {
    const res = await ipcRenderer.invoke('ipfs:get', arg, options || {});
    if (!res || res.ok === false) return res || { ok: false, error: 'read_failed' };
    if (!maxBytes) return res;
    const data = Array.isArray(res.data) ? res.data : [];
    const sliced = data.length > maxBytes ? data.slice(0, maxBytes) : data;
    return { ...res, data: sliced, truncated: data.length > maxBytes };
  } catch (e) {
    return { ok: false, error: safeString(e?.message || e || 'read_failed', 512) };
  }
}

const lumen = {
  // Minimal "action" API (requested)
  SendToken: sendToken,
  Pin: pinCid,
  Save: pinCid,
  ReadCID: readCID,
  resolveUrl,

  // Preferred camelCase aliases
  sendToken,
  pin: pinCid,
  save: pinCid,
  readCID,
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
      const res = await ipcRenderer.invoke('ipfs:pubsub:subscribe', { topic: safeString(topic, 1024), encoding });
      if (!res || res.ok === false) throw new Error((res && res.error) ? String(res.error) : 'subscribe_failed');
      const subId = String(res.subId || '');

      const hMsg = (_e, payload) => {
        try {
          if (!payload || payload.subId !== subId) return;
          // If binary came as array of numbers, restore Uint8Array.
          if (payload.binary && Array.isArray(payload.binary)) payload.binary = new Uint8Array(payload.binary);
          onMessage && onMessage(payload);
        } catch {}
      };
      const hErr = (_e, payload) => { if (!payload || payload.subId !== subId) return; };
      const hEnd = (_e, payload) => { if (!payload || payload.subId !== subId) return; };

      ipcRenderer.on('ipfs:pubsub:message', hMsg);
      ipcRenderer.on('ipfs:pubsub:error', hErr);
      ipcRenderer.on('ipfs:pubsub:end', hEnd);

      const unsubscribe = async () => {
        try { ipcRenderer.removeListener('ipfs:pubsub:message', hMsg); } catch {}
        try { ipcRenderer.removeListener('ipfs:pubsub:error', hErr); } catch {}
        try { ipcRenderer.removeListener('ipfs:pubsub:end', hEnd); } catch {}
        try { await ipcRenderer.invoke('ipfs:pubsub:unsubscribe', subId); } catch {}
      };

      return { subId, unsubscribe };
    },

    ls: async () => {
      ensureLumenSite();
      return await ipcRenderer.invoke('ipfs:pubsub:ls');
    },

    peers: async (topic) => {
      ensureLumenSite();
      return await ipcRenderer.invoke('ipfs:pubsub:peers', safeString(topic, 1024));
    }
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
  },

  // Legacy-ish surface for compatibility
  ipfs: { pinAdd: pinCid, cat: readCID, get: readCID, resolveUrl }
};

try {
  if (isIpfsGatewayUrl(currentHref())) {
    contextBridge.exposeInMainWorld('lumen', lumen);
    try {
      // Helpful flag for debugging / feature-detection
      Object.defineProperty(window, '__lumenSiteInjected', { value: true, enumerable: false });
    } catch {}
  }
} catch {
  // ignore
}
