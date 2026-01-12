const { contextBridge, ipcRenderer } = require('electron');

function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

async function requestUserConsent(kind, details) {
  try {
    const payload = {
      kind: safeString(kind, 64),
      details: details ?? null,
      meta: {
        origin: safeString(location?.origin || ''),
        href: safeString(currentHref()),
        title: safeString(document?.title || '', 512)
      }
    };
    const res = await ipcRenderer.invoke('lumenSite:confirm', payload);
    return res === true;
  } catch {
    return false;
  }
}

async function resolveActiveProfileFallback() {
  try {
    return (await ipcRenderer.invoke('profiles:getActive')) || null;
  } catch {
    return null;
  }
}

function normalizeSendInput(rawTx) {
  const tx = rawTx && typeof rawTx === 'object' ? rawTx : {};
  const profileId = safeString(tx.profileId || tx.profile || tx.profile_id || '');
  const from = safeString(tx.from || tx.address || tx.sender || '');
  const to = safeString(tx.to || tx.recipient || '');

  const memo = safeString(tx.memo || tx.note || '', 1024);
  const denomIn = safeString(tx.denom || 'ulmn', 16).toLowerCase();

  const amountUlmnExplicit =
    tx.amount_ulmn != null ? Math.floor(safeNumber(tx.amount_ulmn)) : null;
  const amountInput = safeNumber(tx.amount);

  let amountLmn = 0;
  if (amountUlmnExplicit != null && amountUlmnExplicit > 0) {
    amountLmn = amountUlmnExplicit / 1_000_000;
  } else if (denomIn === 'ulmn') {
    amountLmn = amountInput / 1_000_000;
  } else {
    amountLmn = amountInput;
  }

  return {
    profileId,
    from,
    to,
    amountLmn,
    memo,
    denomIn
  };
}

async function sendToken(rawTx, options) {
  ensureLumenSite();

  const optionsObj = options && typeof options === 'object' ? options : {};
  const reason = safeString(optionsObj.reason || '', 256);
  const siteLabel = safeString(optionsObj.siteLabel || '', 256);

  const normalized = normalizeSendInput(rawTx);
  let { profileId, from } = normalized;
  const to = normalized.to;
  const amountLmn = normalized.amountLmn;
  const memo = normalized.memo;

  if (!profileId || !from) {
    const active = await resolveActiveProfileFallback();
    if (!profileId) profileId = safeString(active?.id || active?.profileId || '');
    if (!from) from = safeString(active?.address || active?.walletAddress || active?.addr || '');
  }

  if (!profileId) return { ok: false, error: 'missing_profileId' };
  if (!from || !to || !(amountLmn > 0)) return { ok: false, error: 'missing_from_to_amount' };

  const amountUlmn = Math.round(amountLmn * 1_000_000);

  const allowed = await requestUserConsent('SendToken', {
    profileId,
    from,
    to,
    amount_lmn: amountLmn,
    amount_ulmn: amountUlmn,
    memo,
    reason,
    siteLabel
  });
  if (!allowed) return { ok: false, error: 'user_denied' };

  try {
    return await ipcRenderer.invoke('wallet:sendTokens', {
      profileId,
      from,
      to,
      amount: amountLmn,
      denom: 'ulmn',
      memo
    });
  } catch (e) {
    return { ok: false, error: safeString(e?.message || e || 'send_failed', 512) };
  }
}

async function saveCID(cidOrPath) {
  ensureLumenSite();
  const cid = safeString(cidOrPath, 2048);
  if (!cid) return { ok: false, error: 'missing_cid' };

  const allowed = await requestUserConsent('SaveCID', { cid });
  if (!allowed) return { ok: false, error: 'user_denied' };

  try {
    return await ipcRenderer.invoke('ipfs:pinAdd', cid);
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
  SaveCID: saveCID,
  ReadCID: readCID,

  // Preferred camelCase aliases
  sendToken,
  saveCID,
  readCID,

  // Legacy-ish surface for compatibility
  wallet: { requestSend: sendToken },
  ipfs: { pinAdd: saveCID, cat: readCID, get: readCID }
};

try {
  contextBridge.exposeInMainWorld('lumen', lumen);
  try {
    // Helpful flag for debugging / feature-detection
    Object.defineProperty(window, '__lumenSiteInjected', { value: true, enumerable: false });
  } catch {}
} catch {
  // ignore
}

