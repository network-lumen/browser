// The gateway client: finding gateways, resolving one to a base URL, and
// keeping track of which ones answer.
//
// Split out of ipc/gateway.cjs, which is now the thin IPC layer over it. Two
// callers, and they want different things from it: the handlers resolve a base
// and a PQ key to serve a user action, while the gateway-health daemon walks
// the whole whitelist to keep those answers warm. Neither owns the other.
const { readFileSync, existsSync } = require('fs');
const path = require('path');
const { trimSlash } = require('../utils/strings.cjs');
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');

// Cache to reduce log spam
let _gwResolvedEndpointsLogged = new Set();

let _gwKyberBaseLogged = new Set();

const KYBER_PUBKEY_CACHE_TTL_MS = (() => {
  const env = Number(process.env.LUMEN_GATEWAY_KYBER_PUBKEY_CACHE_TTL_MS || '');
  if (Number.isFinite(env) && env > 0) return Math.min(Math.floor(env), 24 * 60 * 60 * 1000);
  return 10 * 60 * 1000;
})();

const KYBER_PUBKEY_CACHE = new Map();

// baseUrl -> { ok, checkedAt, alg?, keyId?, pubKey?, error? }
const KYBER_PUBKEY_PENDING = new Map();

// baseUrl -> Promise<{ alg, keyId, pubKey, baseUrl }>
const INACTIVE_GATEWAY_HINTS = new Set();

function resolveGatewaysWhitelistFilePath() {
  const explicit = process.env.LUMEN_GATEWAYS_WHITELIST_FILE;
  const candidates = [];
  if (explicit) candidates.push(explicit);

  const resPath = process.resourcesPath;
  if (resPath) {
    candidates.push(path.join(resPath, 'gateways_whitelist.txt'));
    candidates.push(path.join(resPath, 'resources', 'gateways_whitelist.txt'));
    candidates.push(path.join(resPath, 'app.asar.unpacked', 'gateways_whitelist.txt'));
    candidates.push(path.join(resPath, 'app.asar.unpacked', 'resources', 'gateways_whitelist.txt'));
  }

  const appPath = require('electron').app.getAppPath?.() || process.cwd();
  candidates.push(path.join(appPath, 'resources', 'gateways_whitelist.txt'));
  candidates.push(path.join(process.cwd(), 'resources', 'gateways_whitelist.txt'));

  for (const file of candidates) {
    if (!file) continue;
    try {
      if (existsSync(file)) return file;
    } catch {}
  }
  return null;
}

function loadGatewaysWhitelistIds() {
  const filePath = resolveGatewaysWhitelistFilePath();
  if (!filePath) return ['1'];
  try {
    const raw = readFileSync(filePath, 'utf8');
    const ids = [];
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = String(line || '').replace(/#.*/, '').trim();
      if (!cleaned) continue;
      ids.push(String(cleaned));
    }
    return ids.length ? ids : ['1'];
  } catch (err) {
    console.warn(
      '[gateway] unable to read gateways whitelist file:',
      filePath,
      err && err.message ? err.message : err
    );
    return ['1'];
  }
}

// The peer file is read once, by daemons/peers/peer_pool.cjs, into the pool this asks.
function getRestBaseUrl() {
  try {
    const peer = getNetworkPool().getBestPeer('rest');
    return peer && peer.rest ? String(peer.rest) : null;
  } catch {
    return null;
  }
}

async function resolveGatewayBaseFromEndpoint(endpoint, timeoutMs, options) {
  let msArg = timeoutMs;
  let opts = options;
  if (msArg && typeof msArg === 'object' && !opts) {
    opts = msArg;
    msArg = undefined;
  }
  const quiet = !!opts?.quiet;

  const ep = String(endpoint || '').trim();
  if (!ep) return null;

  // If it's already an HTTP(s) URL, use as-is
  if (/^https?:\/\//i.test(ep)) {
    const out = trimSlash(ep);
    // Only log once per endpoint
    if (!_gwResolvedEndpointsLogged.has(ep)) {
      if (!quiet) console.log('[gateway] resolveGatewayBaseFromEndpoint http', ep, '->', out);
      _gwResolvedEndpointsLogged.add(ep);
    }
    return out;
  }

  // Interpret as record.domain and resolve via Lumen DNS on-chain
  const m = ep.match(/^(?:(.*)\.)?([^.]+\.[^.]+)$/);
  if (!m) return null;

  const record = m[1] || '';
  const domain = m[2];
    if (!domain) return null;

  const restBase = getRestBaseUrl();
  if (!restBase) return null;

  // Only log dns query once per domain
  const logKey = `dns:${domain}`;
  const shouldLogQuery = !_gwResolvedEndpointsLogged.has(logKey);

  try {
    const rest = trimSlash(restBase);
    const url = `${rest}/lumen/dns/v1/domain/${encodeURIComponent(domain)}`;
    if (shouldLogQuery && !quiet) {
      console.log('[gateway] resolveGatewayBaseFromEndpoint dns query', domain, 'via', rest);
      _gwResolvedEndpointsLogged.add(logKey);
    }
    const ms =
      typeof msArg === 'number' && Number.isFinite(msArg) && msArg > 0
        ? msArg
        : 2500;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    let res;
    try {
      res = await fetch(url, { method: 'GET', signal: controller.signal });
    } finally {
      try { clearTimeout(t); } catch {}
    }
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const dom = (json && (json.domain || json)) || {};
    const records = Array.isArray(dom.records) ? dom.records : [];

    let value;
    const hit = records.find((x) => String(x?.key ?? '') === record);
    if (hit && hit.value) {
      value = hit.value;
    } else if (!record) {
      const pref =
        records.find((x) => String(x?.key ?? '') === 'gtw') ||
        records[0];
      value = pref && pref.value;
    }

      if (!value) {
        if (!quiet) console.warn('[gateway] resolveGatewayBaseFromEndpoint: no record value for', ep);
        return null;
      }

    let base =
      typeof value === 'string'
        ? value.trim()
        : String(value?.baseUrl || value?.endpoint || value?.url || '').trim();

      if (!base) {
        if (!quiet) console.warn('[gateway] resolveGatewayBaseFromEndpoint: empty base for', ep);
        return null;
      }
      if (!/^https?:\/\//i.test(base)) {
        base = `https://${base}`;
      }
      const out = trimSlash(base);
      // Only log resolution once per endpoint
      if (!_gwResolvedEndpointsLogged.has(ep)) {
        if (!quiet) console.log('[gateway] resolveGatewayBaseFromEndpoint resolved', ep, '->', out);
        _gwResolvedEndpointsLogged.add(ep);
      }
      return out;
  } catch {
    return null;
  }
}

async function resolveKyberKeyForGatewayBase(baseUrlHint, opts = {}) {
  const quiet = !!opts?.quiet;
  const initial = String(baseUrlHint || '').trim();
  const normalizeInactiveGatewayHint = (value) => trimSlash(String(value || '').trim()).toLowerCase();
  const initialHint = normalizeInactiveGatewayHint(initial);
  if (initialHint && INACTIVE_GATEWAY_HINTS.has(initialHint)) {
    throw new Error('gateway_inactive');
  }
  const timeoutMs = opts?.timeoutMs;
  const resolvedBase = await resolveGatewayBaseFromEndpoint(initial, timeoutMs, { quiet });
  const trimmedBase = resolvedBase ? resolvedBase : String(initial).replace(/\/+$/, '');
  if (!trimmedBase) throw new Error('kyber_pubkey_http_unavailable');

  const baseUrl = trimSlash(trimmedBase);
  const resolvedHint = normalizeInactiveGatewayHint(baseUrl);
  if (resolvedHint && INACTIVE_GATEWAY_HINTS.has(resolvedHint)) {
    KYBER_PUBKEY_CACHE.set(baseUrl, {
      ok: false,
      checkedAt: Date.now(),
      error: 'gateway_inactive',
    });
    throw new Error('gateway_inactive');
  }
  const now = Date.now();
  const cached = KYBER_PUBKEY_CACHE.get(baseUrl);
  if (cached && now - cached.checkedAt < KYBER_PUBKEY_CACHE_TTL_MS) {
    if (cached.ok && cached.pubKey) {
      return {
        alg: cached.alg || 'kyber768',
        keyId: cached.keyId || 'gw-2025-01',
        pubKey: cached.pubKey,
        baseUrl,
      };
    }
    throw new Error(cached.error || 'kyber_pubkey_http_unavailable');
  }

  const pending = KYBER_PUBKEY_PENDING.get(baseUrl);
  if (pending) return await pending;

  const task = (async () => {
    if (!quiet && !_gwKyberBaseLogged.has(baseUrl)) {
      console.log('[gateway] resolveKyberKeyForGatewayBase base', {
        hint: initial,
        resolved: resolvedBase,
        final: baseUrl,
      });
      _gwKyberBaseLogged.add(baseUrl);
    }

    let httpPubB64 = null;
    let httpKeyId = 'gw-2025-01';
    let httpAlg = 'kyber768';
    try {
      const signal = opts?.signal;
      const url = `${baseUrl}/pq/pub`;
      const res = await fetch(url, { method: 'GET', ...(signal ? { signal } : {}) });
      if (res.ok) {
        const text = await res.text().catch(() => '');
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = null;
        }
        if (data && typeof data.pub === 'string') {
          const candidate = data.pub.trim();
          if (candidate) httpPubB64 = candidate;
        }
        if (data && typeof data.key_id === 'string' && data.key_id.trim()) httpKeyId = data.key_id.trim();
        if (data && typeof data.alg === 'string' && data.alg.trim()) httpAlg = data.alg.trim();
      }
    } catch (e) {
      if (!quiet) {
        console.warn(
          '[gateway] resolveKyberKeyForGatewayBase http error:',
          e && e.message ? e.message : e
        );
      }
    }

    if (!httpPubB64) {
      KYBER_PUBKEY_CACHE.set(baseUrl, {
        ok: false,
        checkedAt: Date.now(),
        error: 'kyber_pubkey_http_unavailable',
      });
      throw new Error('kyber_pubkey_http_unavailable');
    }

    const pubKey = Buffer.from(httpPubB64, 'base64');
    KYBER_PUBKEY_CACHE.set(baseUrl, {
      ok: true,
      checkedAt: Date.now(),
      alg: httpAlg || 'kyber768',
      keyId: httpKeyId || 'gw-2025-01',
      pubKey,
    });

    return {
      alg: httpAlg || 'kyber768',
      keyId: httpKeyId || 'gw-2025-01',
      pubKey,
      baseUrl,
    };
  })();

  KYBER_PUBKEY_PENDING.set(baseUrl, task);
  try {
    return await task;
  } finally {
    KYBER_PUBKEY_PENDING.delete(baseUrl);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const n = Number(concurrency);
  const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  const results = new Array(list.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= list.length) return;
      results[i] = await mapper(list[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, list.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Gateway plans / subscriptions (plan -> endpoint -> HTTP base URL)
// ---------------------------------------------------------------------------

function parseContractMetadata(meta) {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof meta === 'object') return { ...meta };
  return {};
}

// ---------------------------------------------------------------------------
// Gateway registry / plans (available offers, not subscriptions)
// ---------------------------------------------------------------------------

function parseGatewayMetadata(meta) {
  // Same semantics as parseContractMetadata but kept separate for clarity.
  return parseContractMetadata(meta);
}

function coerceGatewayEndpoint(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  try {
    // Keep explicit scheme/port when provided (e.g. http://1.2.3.4:8787),
    // because gateways often serve on non-standard ports and/or HTTP-only.
    const hasScheme = /^[a-z]+:\/\//i.test(raw);
    if (hasScheme) {
      const url = new URL(raw);
      const proto = String(url.protocol || '').toLowerCase();
      if (proto === 'http:' || proto === 'https:') {
        const origin = url.origin || raw;
        if (origin && origin !== 'null') {
          return origin.replace(/\/+$/, '').trim().toLowerCase();
        }
      }
      const host = url.host || url.hostname || raw;
      return String(host).replace(/\/+$/, '').trim().toLowerCase();
    }
  } catch {
    // fall through to the non-URL normalization below
  }

  // No explicit scheme: treat as DNS-style hint (record.domain) or host[:port].
  const head = raw.split(/[/?#]/, 1)[0] || '';
  return head.replace(/\/+$/, '').trim().toLowerCase();
}

function decorateGateway(raw) {
  const meta = parseGatewayMetadata(
    raw?.metadata ?? raw?.meta ?? raw?.MetaData ?? raw?.info
  );
  const endpoint = coerceGatewayEndpoint(
    meta.endpoint ?? raw?.endpoint ?? raw?.baseUrl ?? raw?.url ?? ''
  );
  const regions = Array.isArray(meta.regions)
    ? meta.regions.map((r) => String(r || '')).filter(Boolean)
    : Array.isArray(raw?.regions)
    ? raw.regions.map((r) => String(r || '')).filter(Boolean)
    : [];

  return {
    ...raw,
    id: String(raw?.id ?? raw?.gatewayId ?? raw?.ID ?? ''),
    baseUrl:
      endpoint ||
      String(meta.endpoint ?? raw?.endpoint ?? raw?.baseUrl ?? raw?.url ?? '').trim(),
    endpoint,
    operator: raw?.operator ?? raw?.Operator ?? '',
    payout: raw?.payout ?? raw?.Payout ?? '',
    active:
      typeof raw?.active === 'boolean'
        ? raw.active
        : !!(raw?.Active ?? raw?.isActive ?? true),
    metadata: meta,
    regions,
    score: meta.score ?? raw?.score ?? null,
  };
}

function extractPinGateways(data) {
  if (!data) return [];
  const list = Array.isArray(data?.gateways)
    ? data.gateways
    : Array.isArray(data?.Gateways)
    ? data.Gateways
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];
  return list.map(decorateGateway);
}

async function fetchGatewaysFromRest(limit, timeoutMs) {
  let opts = null;
  if (timeoutMs && typeof timeoutMs === 'object') {
    opts = timeoutMs;
    timeoutMs = opts?.timeoutMs;
  } else if (arguments.length >= 3) {
    opts = arguments[2];
  }
  const ignoreWhitelist = !!opts?.ignoreWhitelist;

  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { gateways: [], error: 'rest_base_missing' };
  }
  const base = trimSlash(restBase);
  const url = new URL('/lumen/gateway/v1/gateways', base);
  url.searchParams.set('limit', String(limit));

  let lastErr = null;
  try {
    const ms =
      typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : 6000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    let res;
    try {
      res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
    } finally {
      try { clearTimeout(t); } catch {}
    }
    const status = res.status;
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).trim();
      const statusLabel = status ? `HTTP ${status}` : 'HTTP error';
      lastErr = text ? `${statusLabel}: ${text.slice(0, 160)}` : statusLabel;
      return { gateways: [], error: lastErr };
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const payload =
      json && (json.gateways ? json : json.data?.gateways ? json.data : json);
    let list = extractPinGateways(payload || json);

    if (!ignoreWhitelist) {
      const whitelistIds = new Set(
        loadGatewaysWhitelistIds()
          .map((x) => String(x).trim())
          .filter(Boolean)
      );
      if (whitelistIds.size) {
        list = list.filter((g) =>
          whitelistIds.has(String(g?.id ?? g?.gatewayId ?? '').trim())
        );
      }
    }

    if (Array.isArray(list) && list.length) {
      return { gateways: list, error: null };
    }
    return { gateways: [], error: 'no_gateways' };
  } catch (e) {
    lastErr = String(e && e.message ? e.message : e);
    console.error('[gateway] fetchGatewaysFromRest error:', lastErr);
    return { gateways: [], error: lastErr };
  }
}

function gatewayHealthMonitorEnabled() {
  const raw = String(process.env.LUMEN_GATEWAY_HEALTH_MONITOR || '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return true;
}

// No re-entrancy guard of its own: the daemon runtime never runs a tick while
// the previous one is still going.
async function refreshWhitelistedGatewayHealth(opts = {}) {
  const timeoutMsRaw = Number(opts?.timeoutMs ?? 0);
  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
      ? Math.min(Math.floor(timeoutMsRaw), 30_000)
      : 2500;

  // Pull the current whitelisted gateways list and prefetch /pq/pub so PQ calls can skip dead bases quickly.
  const { gateways } = await fetchGatewaysFromRest(250, Math.max(timeoutMs, 6000), {
    ignoreWhitelist: false,
  });
  if (!Array.isArray(gateways) || !gateways.length) return;

  const nextInactiveGatewayHints = new Set();
  for (const gateway of gateways) {
    const hints = [gateway.endpoint, gateway.baseUrl, gateway.url];
    for (const hint of hints) {
      const normalized = trimSlash(String(hint || '').trim()).toLowerCase();
      if (!normalized) continue;
      if (gateway && gateway.active === false) {
        nextInactiveGatewayHints.add(normalized);
      }
      if (/^https?:\/\//i.test(normalized) && gateway && gateway.active === false) {
        KYBER_PUBKEY_CACHE.set(trimSlash(normalized), {
          ok: false,
          checkedAt: Date.now(),
          error: 'gateway_inactive',
        });
      } else if (/^https?:\/\//i.test(normalized)) {
        const cached = KYBER_PUBKEY_CACHE.get(trimSlash(normalized));
        if (cached && cached.ok === false && cached.error === 'gateway_inactive') {
          KYBER_PUBKEY_CACHE.delete(trimSlash(normalized));
        }
      }
    }
  }
  INACTIVE_GATEWAY_HINTS.clear();
  for (const hint of nextInactiveGatewayHints) INACTIVE_GATEWAY_HINTS.add(hint);

  const activeGateways = gateways.filter((gateway) => gateway && gateway.active !== false);
  if (!activeGateways.length) return;

  const endpoints = Array.from(
    new Set(
      activeGateways
        .map((g) => String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? '').trim())
        .filter(Boolean),
    ),
  );
  if (!endpoints.length) return;

  await mapWithConcurrency(endpoints, 4, async (endpoint) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await resolveKyberKeyForGatewayBase(endpoint, {
        quiet: true,
        timeoutMs,
        signal: controller.signal,
      });
    } catch {
      // ignore: resolveKyberKeyForGatewayBase caches negative results
    } finally {
      try { clearTimeout(t); } catch {}
    }
  });
}

function gatewayHealthPeriodMs() {
  const raw = Number(process.env.LUMEN_GATEWAY_HEALTH_MONITOR_PERIOD_MS || '');
  return Number.isFinite(raw) && raw > 0 ? Math.max(60_000, Math.floor(raw)) : 10 * 60 * 1000;
}

module.exports = {
  // Read by ipc/gateway.cjs to answer "is this base already known to be down"
  // without a round trip; written here and by the health daemon.
  KYBER_PUBKEY_CACHE,
  KYBER_PUBKEY_CACHE_TTL_MS,
  coerceGatewayEndpoint,
  decorateGateway,
  extractPinGateways,
  fetchGatewaysFromRest,
  gatewayHealthMonitorEnabled,
  gatewayHealthPeriodMs,
  getRestBaseUrl,
  loadGatewaysWhitelistIds,
  mapWithConcurrency,
  parseContractMetadata,
  parseGatewayMetadata,
  refreshWhitelistedGatewayHealth,
  resolveGatewayBaseFromEndpoint,
  resolveGatewaysWhitelistFilePath,
  resolveKyberKeyForGatewayBase
};
