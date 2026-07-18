export function safeString(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function safeDelayMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(250, Math.min(30_000, Math.trunc(n)));
}

export function safeCount(v, fallback, max = 16) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, Math.trunc(n)));
}

export function normalizeReconnectDelays(input) {
  const fallback = [1000, 2000, 5000];
  if (!Array.isArray(input) || !input.length) return fallback;
  const out = input
    .map((v) => safeDelayMs(v, 0))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 8);
  return out.length ? out : fallback;
}

export function callMaybe(fn, ...args) {
  try {
    if (typeof fn === 'function') fn(...args);
  } catch {}
}

export function currentHref() {
  try {
    return String(location.href || '');
  } catch {
    return '';
  }
}

export function isChromeExtensionUrl(input = currentHref()) {
  return /^chrome-extension:\/\//i.test(safeString(input, 4096));
}

export  function isGuestRendererContext(ipcRenderer) {
  return typeof ipcRenderer.sendToHost === 'function';
}

export function shouldInjectWebviewExtensionApi(ipcRenderer) {
  return isGuestRendererContext(ipcRenderer) && !isChromeExtensionUrl();
}

export function getUrlOrigin(input, fallback = '') {
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

export function prefixFromAddress(address) {
  const value = safeString(address, 256);
  const index = value.indexOf('1');
  return index > 0 ? value.slice(0, index).toLowerCase() : 'lmn';
}

export function normalizeBytes(value) {
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

export function buildBech32Config(input, fallbackPrefix) {
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

export function getProviderFallbackStateSync(ipcRenderer) {
  try {
    const state = ipcRenderer.sendSync('extensions:getProviderFallbackStateSync');
    if (state && typeof state === 'object') return state;
  } catch {
    // ignore
  }
  return { keplr: true, leap: true, ethereum: true };
}

export function isLumenUrl(input) {
  return /^lumen:\/\//i.test(webview_utils.safeString(input, 4096));
}

export function isChromeWebStoreUrl(href = currentHref()) {
  try {
    const url = new URL(String(href || ''));
    const host = String(url.hostname || '').trim().toLowerCase();
    return host === 'chromewebstore.google.com' || host.endsWith('.chromewebstore.google.com');
  } catch {
    return false;
  }
}

export function closestInstallTrigger(target) {
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