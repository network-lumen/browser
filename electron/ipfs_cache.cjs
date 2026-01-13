const { userDataPath, readJson, writeJson } = require('./utils/fs.cjs');
const { ipfsPinAdd, ipfsPinLs, ipfsPinRm, ipfsResolveIPNS, ipfsObjectStat } = require('./ipfs.cjs');

const DEFAULT_TTL_MS = 72 * 60 * 60 * 1000; // 72h
const DEFAULT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10m
const DEFAULT_FLUSH_DEBOUNCE_MS = 1500;
const DEFAULT_CACHE_MAX_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const DEFAULT_CACHE_MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB

const CACHE_FILE = () => userDataPath('ipfs_cache.json');

let started = false;
let cleanupTimer = null;
let flushTimer = null;
let maintenanceSoonTimer = null;
let cleanupRunning = false;
let cleanupQueued = false;

let configuredTtlMs = DEFAULT_TTL_MS;
let configuredFlushDebounceMs = DEFAULT_FLUSH_DEBOUNCE_MS;
let configuredCacheMaxBytes = DEFAULT_CACHE_MAX_BYTES;
let configuredCacheMaxFileBytes = DEFAULT_CACHE_MAX_FILE_BYTES;

/** @type {Map<string, { ipfsPath: string; pinnedAt: number; lastAccess: number; ttlMs: number; sizeBytes: number }>} */
let entries = new Map();
let dirty = false;
let totalCacheBytes = 0;

/** @type {Map<string, Promise<void>>} */
const inflightPins = new Map();

/** @type {Map<string, { cid: string; ts: number }>} */
const ipnsToCidCache = new Map();
const IPNS_CACHE_TTL_MS = 5 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function safeString(v, maxLen = 4096) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function loadCacheFromDisk() {
  const fallback = { version: 1, entries: {} };
  const raw = readJson(CACHE_FILE(), fallback) || fallback;

  const map = new Map();
  const obj = raw && typeof raw === 'object' ? raw : fallback;
  const rec = obj.entries && typeof obj.entries === 'object' ? obj.entries : {};

  for (const [k, v] of Object.entries(rec)) {
    const ipfsPath = safeString(v?.ipfsPath || k, 4096);
    const pinnedAt = Number(v?.pinnedAt ?? 0);
    const lastAccess = Number(v?.lastAccess ?? 0);
    const ttlMs = Number(v?.ttlMs ?? DEFAULT_TTL_MS);
    const sizeBytesRaw = Number(v?.sizeBytes ?? v?.size_bytes ?? -1);
    const sizeBytes =
      Number.isFinite(sizeBytesRaw) && sizeBytesRaw >= 0 ? Math.floor(sizeBytesRaw) : -1;

    if (!ipfsPath) continue;
    if (!Number.isFinite(pinnedAt) || pinnedAt <= 0) continue;
    if (!Number.isFinite(lastAccess) || lastAccess <= 0) continue;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) continue;

    map.set(ipfsPath, { ipfsPath, pinnedAt, lastAccess, ttlMs, sizeBytes });
  }

  entries = map;
  totalCacheBytes = 0;
  for (const e of entries.values()) {
    if (Number.isFinite(e.sizeBytes) && e.sizeBytes > 0) totalCacheBytes += e.sizeBytes;
  }
}

function flushCacheToDisk() {
  const out = {};
  for (const [k, v] of entries.entries()) {
    out[k] = {
      ipfsPath: v.ipfsPath,
      pinnedAt: v.pinnedAt,
      lastAccess: v.lastAccess,
      ttlMs: v.ttlMs,
      sizeBytes: v.sizeBytes
    };
  }
  writeJson(CACHE_FILE(), { version: 1, entries: out, updatedAt: nowMs() });
  dirty = false;
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      if (dirty) flushCacheToDisk();
    } catch (e) {
      console.warn('[electron][ipfs-cache] flush failed', String(e?.message || e));
    }
  }, configuredFlushDebounceMs);
}

function scheduleMaintenanceSoon(delayMs = 1500) {
  if (maintenanceSoonTimer) return;
  maintenanceSoonTimer = setTimeout(() => {
    maintenanceSoonTimer = null;
    void cleanupExpired();
  }, Math.max(0, Number(delayMs) || 0));
  try {
    maintenanceSoonTimer.unref?.();
  } catch {}
}

function headerValue(responseHeaders, headerLower) {
  const h = responseHeaders && typeof responseHeaders === 'object' ? responseHeaders : null;
  if (!h) return '';
  for (const [k, v] of Object.entries(h)) {
    if (String(k || '').toLowerCase() !== headerLower) continue;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    if (typeof v === 'string') return v;
  }
  return '';
}

function maybeDecodeURIComponent(seg) {
  const s = String(seg ?? '');
  if (!s) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function parseGatewayPath(pathnameOrPath) {
  const raw = String(pathnameOrPath || '').trim();
  if (!raw) return null;
  const base = raw.split(/[?#]/, 1)[0] || '';
  const p = base.startsWith('/') ? base : '/' + base;

  const lower = p.toLowerCase();
  if (!lower.startsWith('/ipfs/') && !lower.startsWith('/ipns/')) return null;
  const seg = p;

  const parts = seg.split('/');
  // ['', 'ipfs'|'ipns', '<id>', ...rest]
  if (parts.length < 3) return null;
  const proto = String(parts[1] || '').toLowerCase();
  const id = String(parts[2] || '').trim();
  if (!id || (proto !== 'ipfs' && proto !== 'ipns')) return null;

  const restRaw = parts.slice(3);
  const decodedRest = restRaw.map(maybeDecodeURIComponent);
  const trailingSlash = seg.endsWith('/');

  let rest = decodedRest.length ? '/' + decodedRest.join('/') : '';
  if (trailingSlash && rest && !rest.endsWith('/')) rest += '/';
  if (trailingSlash && !rest) rest = '/';

  return { proto, id, rest };
}

function extractIpfsPathFromUrl(rawUrl, responseHeaders) {
  const hinted = safeString(headerValue(responseHeaders, 'x-ipfs-path'), 4096);
  const hintedParsed = hinted ? parseGatewayPath(hinted) : null;
  if (hintedParsed) {
    return `/${hintedParsed.proto}/${hintedParsed.id}${hintedParsed.rest || ''}`;
  }

  try {
    const u = new URL(String(rawUrl || ''));
    const parsed = parseGatewayPath(u.pathname);
    if (!parsed) return '';
    return `/${parsed.proto}/${parsed.id}${parsed.rest || ''}`;
  } catch {
    return '';
  }
}

function isCacheableIpfsPath(ipfsPath) {
  const p = safeString(ipfsPath, 4096);
  if (!p.startsWith('/ipfs/')) return false;
  if (p.length > 2048) return false;

  // Avoid pinning full roots/directories.
  const rest = p.slice('/ipfs/'.length);
  const idx = rest.indexOf('/');
  if (idx === -1) return true; // "/ipfs/<cid>" (file CID) - allow
  const sub = rest.slice(idx + 1);
  if (!sub) return false; // "/ipfs/<cid>/"
  if (p.endsWith('/')) return false; // directories can be huge

  return true;
}

async function resolveSizeBytes(ipfsPath) {
  try {
    const res = await ipfsObjectStat(ipfsPath).catch(() => null);
    if (!res || res.ok === false) return null;
    const size = Number(res.cumulativeSize ?? NaN);
    if (!Number.isFinite(size) || size < 0) return null;
    return Math.floor(size);
  } catch {
    return null;
  }
}

async function resolveIpnsToIpfsPath(ipnsPath) {
  const parsed = parseGatewayPath(ipnsPath);
  if (!parsed || parsed.proto !== 'ipns') return '';
  const name = parsed.id;
  const rest = parsed.rest || '';
  const now = nowMs();

  const cached = ipnsToCidCache.get(name);
  if (cached && now - cached.ts < IPNS_CACHE_TTL_MS && cached.cid) {
    return `/ipfs/${cached.cid}${rest}`;
  }

  try {
    const res = await ipfsResolveIPNS(name);
    const path = safeString(res?.path || '', 4096);
    const m = path.match(/\/ipfs\/([^/]+)/i);
    const cid = m && m[1] ? String(m[1]).trim() : '';
    if (!cid) return '';
    ipnsToCidCache.set(name, { cid, ts: now });
    return `/ipfs/${cid}${rest}`;
  } catch {
    return '';
  }
}

async function touchIpfsPath(ipfsPath) {
  const p = safeString(ipfsPath, 4096);
  if (!p) return;

  const now = nowMs();

  // Don't pin full site roots. (We still track and refresh if we already manage it.)
  const existing = entries.get(p);
  if (existing) {
    existing.pinnedAt = now;
    existing.lastAccess = now;
    existing.ttlMs = configuredTtlMs;
    entries.set(p, existing);
    scheduleFlush();
    return;
  }

  if (!isCacheableIpfsPath(p)) return;

  // If already pinned (uploads/favourites/etc), don't manage TTL for it.
  const alreadyPinned = await ipfsPinLs(p, 'recursive').catch(() => null);
  if (alreadyPinned && alreadyPinned.ok === true && alreadyPinned.pinned === true) return;

  const inflight = inflightPins.get(p);
  if (inflight) return await inflight.catch(() => {});

  const task = (async () => {
    const res = await ipfsPinAdd(p).catch(() => null);
    if (!res || res.ok === false) return;

    const sizeBytes = await resolveSizeBytes(p);
    if (sizeBytes == null) {
      await ipfsPinRm(p).catch(() => null);
      return;
    }

    if (configuredCacheMaxFileBytes > 0 && sizeBytes > configuredCacheMaxFileBytes) {
      await ipfsPinRm(p).catch(() => null);
      return;
    }

    entries.set(p, {
      ipfsPath: p,
      pinnedAt: now,
      lastAccess: now,
      ttlMs: configuredTtlMs,
      sizeBytes
    });
    if (sizeBytes > 0) totalCacheBytes += sizeBytes;
    scheduleFlush();
    scheduleMaintenanceSoon(2000);
  })();

  inflightPins.set(p, task);
  try {
    await task;
  } finally {
    inflightPins.delete(p);
  }
}

async function cleanupExpired() {
  if (cleanupRunning) {
    cleanupQueued = true;
    return;
  }
  cleanupRunning = true;
  cleanupQueued = false;
  try {
    const now = nowMs();
    let changed = false;

    for (const [key, entry] of entries.entries()) {
      const pinnedAt = Number(entry?.pinnedAt ?? 0);
      const ttlMs = Number(entry?.ttlMs ?? configuredTtlMs);
      if (!Number.isFinite(pinnedAt) || pinnedAt <= 0) continue;
      if (!Number.isFinite(ttlMs) || ttlMs <= 0) continue;

      if (now <= pinnedAt + ttlMs) continue;

      const res = await ipfsPinRm(entry.ipfsPath).catch(() => null);
      if (res && res.ok === true) {
        if (Number.isFinite(entry.sizeBytes) && entry.sizeBytes > 0) totalCacheBytes -= entry.sizeBytes;
        entries.delete(key);
        changed = true;
        continue;
      }

      const msg = safeString(res?.error || '', 2048).toLowerCase();
      if (msg.includes('not pinned') || msg.includes('is not pinned') || msg.includes('not pinned or pinned indirectly')) {
        if (Number.isFinite(entry.sizeBytes) && entry.sizeBytes > 0) totalCacheBytes -= entry.sizeBytes;
        entries.delete(key);
        changed = true;
      }
    }

    // Enforce max single-file size + total cache quota (LRU eviction).
    if (entries.size) {
      // Hydrate missing sizes (best-effort).
      for (const [key, entry] of entries.entries()) {
        if (Number.isFinite(entry.sizeBytes) && entry.sizeBytes >= 0) continue;
        const sizeBytes = await resolveSizeBytes(entry.ipfsPath);
        if (sizeBytes == null) continue;

        entry.sizeBytes = sizeBytes;
        entries.set(key, entry);
        if (sizeBytes > 0) totalCacheBytes += sizeBytes;
        changed = true;
      }

      // Evict oversized items first.
      if (configuredCacheMaxFileBytes > 0) {
        for (const [key, entry] of entries.entries()) {
          const sizeBytes = Number(entry.sizeBytes ?? -1);
          if (!Number.isFinite(sizeBytes) || sizeBytes < 0) continue;
          if (sizeBytes <= configuredCacheMaxFileBytes) continue;

          const res = await ipfsPinRm(entry.ipfsPath).catch(() => null);
          const ok = res && (res.ok === true || String(res.error || '').toLowerCase().includes('not pinned'));
          if (ok) {
            if (sizeBytes > 0) totalCacheBytes -= sizeBytes;
            entries.delete(key);
            changed = true;
          }
        }
      }

      // LRU eviction until under quota.
      if (configuredCacheMaxBytes > 0 && totalCacheBytes > configuredCacheMaxBytes) {
        const list = Array.from(entries.values()).sort(
          (a, b) => (a.lastAccess ?? 0) - (b.lastAccess ?? 0) || (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0),
        );

        for (const entry of list) {
          if (totalCacheBytes <= configuredCacheMaxBytes) break;
          const res = await ipfsPinRm(entry.ipfsPath).catch(() => null);
          const msg = safeString(res?.error || '', 2048).toLowerCase();
          const ok = res && (res.ok === true || msg.includes('not pinned') || msg.includes('is not pinned') || msg.includes('not pinned or pinned indirectly'));
          if (!ok) continue;

          const existing = entries.get(entry.ipfsPath);
          if (existing) {
            if (Number.isFinite(existing.sizeBytes) && existing.sizeBytes > 0) totalCacheBytes -= existing.sizeBytes;
            entries.delete(entry.ipfsPath);
            changed = true;
          }
        }
      }
    }

    if (changed) {
      dirty = true;
      flushCacheToDisk();
    }
  } catch (e) {
    console.warn('[electron][ipfs-cache] cleanup failed', String(e?.message || e));
  } finally {
    cleanupRunning = false;
    if (cleanupQueued) {
      setTimeout(() => {
        void cleanupExpired();
      }, 0);
    }
  }
}

function observeSession(sess) {
  if (!sess || !sess.webRequest) return;

  const filter = { urls: ['*://*/*'] };

  /** @type {Map<number, { responseHeaders: any }>} */
  const reqMeta = new Map();

  sess.webRequest.onHeadersReceived(filter, (details, callback) => {
    try {
      const url = String(details?.url || '');
      if (!url.includes('/ipfs/') && !url.includes('/ipns/')) return callback({});
      reqMeta.set(Number(details.id), { responseHeaders: details.responseHeaders || null });
    } catch {}
    callback({});
  });

  sess.webRequest.onCompleted(filter, async (details) => {
    try {
      const url = String(details?.url || '');
      if (!url.includes('/ipfs/') && !url.includes('/ipns/')) return;

      const status = Number(details?.statusCode ?? 0);
      if (![200, 206, 304].includes(status)) return;

      const method = String(details?.method || 'GET').toUpperCase();
      if (method !== 'GET') return;

      const meta = reqMeta.get(Number(details.id)) || null;
      reqMeta.delete(Number(details.id));

      const ipfsOrIpnsPath = extractIpfsPathFromUrl(url, meta?.responseHeaders);
      if (!ipfsOrIpnsPath) return;

      if (ipfsOrIpnsPath.startsWith('/ipns/')) {
        const ipfsPath = await resolveIpnsToIpfsPath(ipfsOrIpnsPath);
        if (ipfsPath) await touchIpfsPath(ipfsPath);
        return;
      }

      if (ipfsOrIpnsPath.startsWith('/ipfs/')) {
        await touchIpfsPath(ipfsOrIpnsPath);
      }
    } catch {
      // ignore
    }
  });

  sess.webRequest.onErrorOccurred(filter, (details) => {
    try {
      reqMeta.delete(Number(details.id));
    } catch {}
  });
}

function startIpfsCache(opts = {}) {
  if (started) return;
  started = true;

  const ttl = Number(opts.ttlMs ?? DEFAULT_TTL_MS);
  configuredTtlMs = Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_TTL_MS;

  const flushDebounce = Number(opts.flushDebounceMs ?? DEFAULT_FLUSH_DEBOUNCE_MS);
  configuredFlushDebounceMs =
    Number.isFinite(flushDebounce) && flushDebounce >= 0 ? Math.floor(flushDebounce) : DEFAULT_FLUSH_DEBOUNCE_MS;

  const maxBytes = Number(opts.cacheMaxBytes ?? DEFAULT_CACHE_MAX_BYTES);
  configuredCacheMaxBytes =
    Number.isFinite(maxBytes) && maxBytes >= 0 ? Math.floor(maxBytes) : DEFAULT_CACHE_MAX_BYTES;

  const maxFileBytes = Number(opts.cacheMaxFileBytes ?? DEFAULT_CACHE_MAX_FILE_BYTES);
  configuredCacheMaxFileBytes =
    Number.isFinite(maxFileBytes) && maxFileBytes >= 0 ? Math.floor(maxFileBytes) : DEFAULT_CACHE_MAX_FILE_BYTES;

  loadCacheFromDisk();

  const interval = Number(opts.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS);
  const cleanupEvery =
    Number.isFinite(interval) && interval > 5_000 ? Math.floor(interval) : DEFAULT_CLEANUP_INTERVAL_MS;

  cleanupTimer = setInterval(() => {
    void cleanupExpired();
  }, cleanupEvery);
  try {
    cleanupTimer.unref?.();
  } catch {}

  // Best-effort initial cleanup soon after startup.
  setTimeout(() => {
    void cleanupExpired();
  }, 15_000);

  const sessions = Array.isArray(opts.sessions) ? opts.sessions : [];
  for (const s of sessions) observeSession(s);
}

module.exports = {
  startIpfsCache,
  touchIpfsPath
};
