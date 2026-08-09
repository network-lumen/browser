const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { httpGet } = require('../ipc/http.cjs');
const { safeString, trimSlash } = require('../utils/strings.cjs');
const { clampInt, pickRandom } = require('../utils/values.cjs');

const DEFAULTS = {
  requestTimeoutMs: 12_000,
  statusTimeoutMs: 7_000,
  slowLatencyMs: 2_500,
  staleTtlMs: 20 * 60_000,
  slowTtlMs: 5 * 60_000,
  deathTtlMs: 30 * 60_000,
  onChainRefreshMs: 15 * 60_000
};

// --- the bootstrap list -----------------------------------------------------
// resources/peers.txt is the only way in: the pool has nowhere to ask until it
// has one peer to ask. Everything after that comes from the chain's own
// validator set.

let _cachedPeersFilePath = null;
let _loggedPeersPath = false;

function ensureHttp(u) {
  const trimmed = trimSlash(u);
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

// Packaged and dev builds put the file in different places, and being wrong
// here means starting with no peers at all.
function resolvePeersFilePath() {
  if (_cachedPeersFilePath !== null) return _cachedPeersFilePath || null;

  const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  const packagedResourcesPath = app && app.isPackaged ? process.resourcesPath : null;

  const candidates = [
    ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'peers.txt')] : []),
    ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'resources', 'peers.txt')] : []),
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'), // dev mode: electron/../resources
    path.join(process.cwd(), 'resources', 'peers.txt')
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        if (!_loggedPeersPath) {
          console.log('[net] found peers file at:', file);
          _loggedPeersPath = true;
        }
        _cachedPeersFilePath = file;
        return file;
      }
    } catch {}
  }

  _cachedPeersFilePath = '';
  return null;
}

/** One peer per line: `rpc [rest [grpc]]`, `#` starts a comment. */
function parsePeerLine(line) {
  const cleaned = String(line || '').replace(/#.*/, '').trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (!parts.length) return null;
  const rpc = parts[0];
  if (!rpc) return null;
  const rest = parts[1] || null;
  const grpc = parts[2] || null;
  return { rpc, rest, grpc };
}

function loadBootstrapPeers() {
  const filePath = resolvePeersFilePath();
  if (!filePath) return [];

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const peers = [];
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parsePeerLine(line);
      if (!parsed) continue;
      peers.push({
        rpc: ensureHttp(parsed.rpc),
        rest: parsed.rest ? ensureHttp(parsed.rest) : null,
        grpc: parsed.grpc ? String(parsed.grpc).trim() : null
      });
    }
    return peers;
  } catch (e) {
    console.warn('[net] unable to read peers file:', filePath, e && e.message ? e.message : e);
    return [];
  }
}

// --- the pool ---------------------------------------------------------------

function uniqBy(items, keyFn) {
  const out = [];
  const seen = new Set();
  for (const it of items) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function parseTendermintStatus(json) {
  const latest =
    json && json.result && json.result.sync_info && json.result.sync_info.latest_block_height;
  const chainId = safeString(json && json.result && json.result.node_info && json.result.node_info.network, 128);
  const height = Number(latest);
  return {
    ok: Number.isFinite(height) && height > 0 && !!chainId,
    chainId: chainId || null,
    height: Number.isFinite(height) && height > 0 ? height : null
  };
}

function normalizeEndpoint(u) {
  const s = safeString(u, 4096);
  if (!s) return null;
  return trimSlash(ensureHttp(s));
}

function shouldCountAsPeerFailure(res) {
  if (!res) return true;
  if (res.timeout) return true;
  const status = Number(res.status || 0);
  if (!status) return true;
  return status >= 500 || status === 408;
}

class PeerPool {
  constructor(options = {}) {
    this.opts = { ...DEFAULTS, ...(options || {}) };
    this.peersByRpc = new Map();
    this.networkChainId = null;
    this.lastOnChainRefreshAt = 0;
    this.validators = [];
    this._healthTimer = null;
    this._refreshTimer = null;
    this._started = false;
    this._refreshRunning = false;
  }

  upsertPeer(input) {
    const rpc = normalizeEndpoint(input && input.rpc ? input.rpc : '');
    if (!rpc) return null;
    const rest = input && input.rest ? normalizeEndpoint(input.rest) : null;
    const grpc = input && input.grpc ? safeString(input.grpc, 512) : null;
    const source = input && input.source ? String(input.source) : 'bootstrap';

    const existing = this.peersByRpc.get(rpc);
    if (existing) {
      if (rest && !existing.rest) existing.rest = rest;
      if (grpc && !existing.grpc) existing.grpc = grpc;
      if (source && existing.source !== 'user') {
        // Preserve user-added peers as highest precedence
        existing.source = existing.source === 'user' ? 'user' : source;
      }
      return existing;
    }

    const peer = {
      rpc,
      rest,
      grpc,
      source: source === 'user' || source === 'onchain' ? source : 'bootstrap',
      chainId: null,
      lastSeenHeight: null,
      lastSeenAt: 0,
      latencyMs: null,
      consecutiveFailures: 0,
      slowUntil: 0,
      deathUntil: 0,
      suspectUntil: 0
    };
    this.peersByRpc.set(rpc, peer);
    return peer;
  }

  addBootstrapPeers(peers) {
    for (const p of Array.isArray(peers) ? peers : []) {
      this.upsertPeer({ ...p, source: 'bootstrap' });
    }
  }

  snapshot() {
    const now = Date.now();
    const peers = [];
    for (const p of this.peersByRpc.values()) {
      peers.push({
        rpc: p.rpc,
        rest: p.rest || null,
        grpc: p.grpc || null,
        source: p.source,
        chainId: p.chainId || null,
        lastSeenHeight: p.lastSeenHeight ?? null,
        lastSeenAt: p.lastSeenAt || 0,
        latencyMs: p.latencyMs ?? null,
        flags: {
          alive: this._isAlive(p, now),
          slow: p.slowUntil > now,
          death: p.deathUntil > now,
          suspect: p.suspectUntil > now
        }
      });
    }
    return {
      networkChainId: this.networkChainId,
      lastOnChainRefreshAt: this.lastOnChainRefreshAt,
      peers
    };
  }

  /** Raw peers, for tests to observe what upsert/bootstrap actually stored. */
  listPeers() {
    return Array.from(this.peersByRpc.values());
  }

  getPeerByRpc(rpc) {
    const key = normalizeEndpoint(rpc);
    return key ? this.peersByRpc.get(key) || null : null;
  }

  pickPeers(kind, count, options = {}) {
    const now = Date.now();
    this._resurrectExpired(now);
    const exclude = options && options.exclude ? options.exclude : null;
    const requireAlive = options && Object.prototype.hasOwnProperty.call(options, 'requireAlive')
      ? !!options.requireAlive
      : true;

    const peers = [];
    for (const p of this.peersByRpc.values()) {
      if (exclude && exclude.has && exclude.has(p.rpc)) continue;
      if (kind === 'rest' && !p.rest) continue;
      if (p.deathUntil > now) continue;
      if (this.networkChainId && p.chainId && p.chainId !== this.networkChainId) continue;
      if (requireAlive) {
        if (!this._isAlive(p, now)) continue;
      } else {
        if (p.lastSeenAt && now - p.lastSeenAt > this.opts.staleTtlMs) continue;
      }
      peers.push(p);
    }

    // Prefer non-slow peers, but never exclude if we don't have enough.
    const fast = peers.filter((p) => !(p.slowUntil > now));
    const base = fast.length >= (count | 0) ? fast : peers;
    return pickRandom(base, count);
  }

  async pingPeer(peer) {
    return this._pingPeer(peer);
  }

  markSuspect(peer, ttlMs) {
    const p = peer && typeof peer === 'object' ? peer : this.getPeerByRpc(peer);
    if (!p) return false;
    const until = Date.now() + clampInt(ttlMs || this.opts.slowTtlMs, 1_000, this.opts.deathTtlMs);
    p.suspectUntil = Math.max(p.suspectUntil || 0, until);
    return true;
  }

  markFailure(peer, meta = {}) {
    const p = peer && typeof peer === 'object' ? peer : this.getPeerByRpc(peer);
    if (!p) return false;
    const latencyMs = typeof meta.latencyMs === 'number' ? meta.latencyMs : null;
    const timeout = !!meta.timeout;
    this._markFailure(p, { latencyMs, timeout });
    return true;
  }

  async requestOnPeer(kind, peer, path, options = {}) {
    this.start();
    const p = peer && typeof peer === 'object' ? peer : this.getPeerByRpc(peer);
    if (!p) return { ok: false, status: 0, error: 'peer_missing' };
    const base = kind === 'rest' ? p.rest : p.rpc;
    if (!base) return { ok: false, status: 0, error: 'missing_endpoint' };

    const timeout = clampInt(
      options && options.timeout ? options.timeout : this.opts.requestTimeoutMs,
      1000,
      120_000
    );
    const cleanPath = String(path || '').trim();
    const suffix = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    const url = `${trimSlash(base)}${suffix}`;

    const start = Date.now();
    const res = await httpGet(url, { timeout });
    const latencyMs = Date.now() - start;

    if (res && res.ok) {
      p.lastSeenAt = Date.now();
      p.latencyMs = latencyMs;
      return { ...res, peer: { rpc: p.rpc, rest: p.rest || null, grpc: p.grpc || null } };
    }

    if (shouldCountAsPeerFailure(res)) {
      this._markFailure(p, { latencyMs, timeout: !!(res && res.timeout) });
    }
    return { ...(res || { ok: false, status: 0, error: 'request_failed' }), peer: { rpc: p.rpc, rest: p.rest || null, grpc: p.grpc || null } };
  }

  getBestPeer(kind = 'rpc') {
    const now = Date.now();
    const peers = Array.from(this.peersByRpc.values()).filter((p) => {
      if (kind === 'rest' && !p.rest) return false;
      return this._isAlive(p, now) && !(p.slowUntil > now) && !(p.suspectUntil > now);
    });
    if (peers.length) {
      peers.sort((a, b) => (a.latencyMs || 9e9) - (b.latencyMs || 9e9));
      return peers[0];
    }

    // Fallbacks: allow slow/suspect but still alive, then any non-dead.
    const aliveAny = Array.from(this.peersByRpc.values()).filter((p) => {
      if (kind === 'rest' && !p.rest) return false;
      return this._isAlive(p, now);
    });
    if (aliveAny.length) return pickRandom(aliveAny, 1)[0] || null;

    const nonDead = Array.from(this.peersByRpc.values()).filter((p) => {
      if (kind === 'rest' && !p.rest) return false;
      return !(p.deathUntil > now);
    });
    return pickRandom(nonDead, 1)[0] || null;
  }

  start() {
    if (this._started) return;
    this._started = true;

    // Kick off health loop quickly, then periodically.
    this._scheduleHealth(250);
    this._scheduleOnChainRefresh(1_000);
  }

  _scheduleHealth(delayMs) {
    if (!this._started) return;
    if (this._healthTimer) clearTimeout(this._healthTimer);
    this._healthTimer = setTimeout(() => {
      this._healthTick().catch(() => {});
      this._scheduleHealth(10_000);
    }, clampInt(delayMs, 50, 60_000));
  }

  _scheduleOnChainRefresh(delayMs) {
    if (!this._started) return;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this.refreshFromOnChain().catch(() => {});
      this._scheduleOnChainRefresh(this.opts.onChainRefreshMs);
    }, clampInt(delayMs, 200, this.opts.onChainRefreshMs));
  }

  _isAlive(peer, now) {
    if (peer.deathUntil > now) return false;
    if (!peer.lastSeenAt) return false;
    if (now - peer.lastSeenAt > this.opts.staleTtlMs) return false;
    return true;
  }

  _resurrectExpired(now) {
    for (const p of this.peersByRpc.values()) {
      if (p.deathUntil && p.deathUntil <= now) {
        p.deathUntil = 0;
        p.consecutiveFailures = 0;
      }
      if (p.slowUntil && p.slowUntil <= now) {
        p.slowUntil = 0;
      }
      if (p.suspectUntil && p.suspectUntil <= now) {
        p.suspectUntil = 0;
      }
    }
  }

  async _healthTick() {
    const now = Date.now();
    this._resurrectExpired(now);

    const peers = Array.from(this.peersByRpc.values());
    if (!peers.length) return;

    // Prefer checking peers that are stale, then a couple random.
    const stale = peers.filter((p) => !p.lastSeenAt || now - p.lastSeenAt > this.opts.staleTtlMs);
    const candidates = uniqBy([...stale, ...pickRandom(peers, 3)], (p) => p.rpc);

    await Promise.allSettled(candidates.map((p) => this._pingPeer(p)));
  }

  async _pingPeer(peer) {
    const url = `${trimSlash(peer.rpc)}/status`;
    const start = Date.now();
    const res = await httpGet(url, { timeout: this.opts.statusTimeoutMs });
    const latencyMs = Date.now() - start;

    if (!res || !res.ok || !res.json) {
      if (shouldCountAsPeerFailure(res)) this._markFailure(peer, { latencyMs, timeout: !!(res && res.timeout) });
      return { ok: false };
    }

    const parsed = parseTendermintStatus(res.json);
    if (!parsed.ok) {
      this._markFailure(peer, { latencyMs, timeout: false });
      return { ok: false };
    }

    this._markSuccess(peer, { chainId: parsed.chainId, height: parsed.height, latencyMs });

    if (!this.networkChainId && parsed.chainId) {
      this.networkChainId = parsed.chainId;
    } else if (this.networkChainId && parsed.chainId && this.networkChainId !== parsed.chainId) {
      // Chain ID mismatch -> suspect
      peer.suspectUntil = Date.now() + this.opts.slowTtlMs;
    }

    return { ok: true, chainId: parsed.chainId, height: parsed.height };
  }

  _markSuccess(peer, { chainId, height, latencyMs }) {
    const now = Date.now();
    peer.chainId = chainId || peer.chainId || null;
    peer.lastSeenHeight = typeof height === 'number' ? height : peer.lastSeenHeight;
    peer.lastSeenAt = now;
    peer.latencyMs = typeof latencyMs === 'number' ? latencyMs : peer.latencyMs;
    peer.consecutiveFailures = 0;
    peer.deathUntil = 0;
    if (peer.latencyMs && peer.latencyMs > this.opts.slowLatencyMs) {
      peer.slowUntil = now + this.opts.slowTtlMs;
    } else {
      peer.slowUntil = 0;
    }
  }

  _markFailure(peer, { latencyMs, timeout }) {
    const now = Date.now();
    peer.lastSeenAt = peer.lastSeenAt || 0;
    peer.latencyMs = typeof latencyMs === 'number' ? latencyMs : peer.latencyMs;
    peer.consecutiveFailures = (peer.consecutiveFailures || 0) + 1;

    if (timeout || (peer.latencyMs && peer.latencyMs > this.opts.slowLatencyMs)) {
      peer.slowUntil = now + this.opts.slowTtlMs;
    }

    if (peer.consecutiveFailures >= 3) {
      peer.deathUntil = now + this.opts.deathTtlMs;
    }
  }

  async refreshFromOnChain() {
    if (this._refreshRunning) return { ok: false, skipped: true };
    this._refreshRunning = true;
    try {
      this.start();

      // Pick a REST peer even if it's stale (it might still be fine); we don't want to deadlock on staleness.
      const now = Date.now();
      this._resurrectExpired(now);
      const restPeers = Array.from(this.peersByRpc.values()).filter((p) => p.rest && !(p.deathUntil > now));
      const chosen = pickRandom(restPeers, 1)[0] || null;
      if (!chosen) return { ok: false, error: 'no_rest_peers' };

      const validators = await this._fetchAllValidators(chosen);
      if (!validators.ok) return validators;

      this.validators = validators.validators;
      this.lastOnChainRefreshAt = Date.now();

      // Enrich pool from website/details metadata.
      const added = this._extractAndAddPeersFromValidators(this.validators);
      return { ok: true, validators: this.validators.length, addedPeers: added };
    } finally {
      this._refreshRunning = false;
    }
  }

  async _fetchAllValidators(peer) {
    const out = [];
    let nextKey = null;
    let pages = 0;

    while (pages < 10) {
      pages += 1;
      const u = new URL('/cosmos/staking/v1beta1/validators', trimSlash(peer.rest));
      u.searchParams.set('pagination.limit', '200');
      if (nextKey) u.searchParams.set('pagination.key', nextKey);
      const res = await httpGet(u.toString(), { timeout: 20_000 });
      if (!res || !res.ok || !res.json) return { ok: false, error: 'validators_fetch_failed', status: res && res.status ? res.status : 0 };

      const validators = Array.isArray(res.json.validators) ? res.json.validators : [];
      for (const v of validators) {
        if (!v) continue;
        out.push({
          operator_address: safeString(v.operator_address, 256) || null,
          description: {
            website: safeString(v.description && v.description.website ? v.description.website : '', 1024) || null,
            details: safeString(v.description && v.description.details ? v.description.details : '', 4096) || null
          },
          status: safeString(v.status, 64) || null,
          jailed: !!v.jailed
        });
      }

      const pagination = res.json.pagination || {};
      nextKey = safeString(pagination.next_key, 4096) || null;
      if (!nextKey) break;
    }

    return { ok: true, validators: out };
  }

  _extractAndAddPeersFromValidators(validators) {
    let added = 0;
    for (const v of Array.isArray(validators) ? validators : []) {
      const website = v && v.description ? v.description.website : '';
      const details = v && v.description ? v.description.details : '';
      const text = `${website || ''}\n${details || ''}`;
      const parsed = this._extractEndpoints(text);
      if (!parsed) continue;

      if (!parsed.rpc) continue;
      const before = this.peersByRpc.size;
      this.upsertPeer({
        rpc: parsed.rpc,
        rest: parsed.rest || null,
        grpc: parsed.grpc || null,
        source: 'onchain'
      });
      const after = this.peersByRpc.size;
      if (after > before) added += after - before;
    }
    return added;
  }

  _extractEndpoints(text) {
    const s = safeString(text, 8192);
    if (!s) return null;

    const urls = [];
    const urlRe = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
    let m;
    while ((m = urlRe.exec(s))) {
      urls.push(m[0]);
    }

    // Also consider bare host:port tokens like rpc.foo:26657 or grpc.foo:443
    const tokens = s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    for (const t of tokens) {
      if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?$/i.test(t)) {
        urls.push(`https://${t}`);
      }
      if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}\/(?:rpc|api)\b/i.test(t)) {
        urls.push(`https://${t}`);
      }
    }

    let rpc = null;
    let rest = null;
    let grpc = null;

    for (const raw of uniqBy(urls, (x) => x)) {
      let u;
      try {
        u = new URL(raw);
      } catch {
        continue;
      }
      const host = safeString(u.hostname, 512).toLowerCase();
      const port = safeString(u.port, 16);
      const path = safeString(u.pathname, 512).toLowerCase();
      const full = trimSlash(u.toString());

      if (!rpc) {
        if (port === '26657' || path.endsWith('/rpc') || host.startsWith('rpc.')) rpc = full;
      }
      if (!rest) {
        if (port === '1317' || path.endsWith('/api') || host.startsWith('api.') || host.includes('lcd')) rest = full;
      }
      if (!grpc) {
        if (host.startsWith('grpc.') || port === '9090') grpc = safeString(u.host, 512);
      }
    }

    if (!rpc && !rest && !grpc) return null;

    return {
      rpc: rpc ? normalizeEndpoint(rpc) : null,
      rest: rest ? normalizeEndpoint(rest) : null,
      grpc: grpc || null
    };
  }
}

module.exports = {
  PeerPool,
  loadBootstrapPeers
};
