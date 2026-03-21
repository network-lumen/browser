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

    if (typeof ipcRenderer.sendToHost === 'function') {
      ipcRenderer.sendToHost('lumen:navigate', { url: href, openInNewTab });
    } else {
      ipcRenderer.send('lumen:navigate', { url: href, openInNewTab });
    }
  } catch {
    // ignore
  }
}

try {
  function attachLumenLinkInterceptor() {
    try {
      const key = '__lumenLinkInterceptorAttached';
      if (document && document[key]) return;
      if (document) document[key] = true;
      document.addEventListener('click', handleLumenLinkClick, true);
    } catch {
      // ignore
    }
  }

  try {
    window.addEventListener('DOMContentLoaded', attachLumenLinkInterceptor, true);
  } catch {}

  attachLumenLinkInterceptor();
} catch {
  // ignore
}
