const { httpGet } = require('../ipc/http.cjs');
const { trimSlash, ensureHttp } = require('./peers.cjs');

const DEFAULTS = {
  requestTimeoutMs: 12_000,
  statusTimeoutMs: 7_000,
  slowLatencyMs: 2_500,
  staleTtlMs: 20 * 60_000,
  slowTtlMs: 5 * 60_000,
  deathTtlMs: 30 * 60_000,
  onChainRefreshMs: 15 * 60_000
};

function nowMs() {
  return Date.now();
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x | 0));
}

function safeStr(v, maxLen = 2048) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

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

function pickRandom(items, count) {
  const arr = Array.isArray(items) ? items.slice() : [];
  // Fisher-Yates partial shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, count | 0));
}

function parseTendermintStatus(json) {
  const latest =
    json && json.result && json.result.sync_info && json.result.sync_info.latest_block_height;
  const chainId = safeStr(json && json.result && json.result.node_info && json.result.node_info.network, 128);
  const height = Number(latest);
  return {
    ok: Number.isFinite(height) && height > 0 && !!chainId,
    chainId: chainId || null,
    height: Number.isFinite(height) && height > 0 ? height : null
  };
}

function normalizeEndpoint(u) {
  const s = safeStr(u, 4096);
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
    const grpc = input && input.grpc ? safeStr(input.grpc, 512) : null;
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
    const now = nowMs();
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

  getBestPeer(kind = 'rpc') {
    const now = nowMs();
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

  getNetworkHeight() {
    const now = nowMs();
    let best = null;
    for (const p of this.peersByRpc.values()) {
      if (!this._isAlive(p, now)) continue;
      if (typeof p.lastSeenHeight !== 'number') continue;
      if (this.networkChainId && p.chainId && p.chainId !== this.networkChainId) continue;
      if (!best || p.lastSeenHeight > best.lastSeenHeight) best = p;
    }
    return best ? best.lastSeenHeight : null;
  }

  start() {
    if (this._started) return;
    this._started = true;

    // Kick off health loop quickly, then periodically.
    this._scheduleHealth(250);
    this._scheduleOnChainRefresh(1_000);
  }

  stop() {
    this._started = false;
    if (this._healthTimer) clearTimeout(this._healthTimer);
    this._healthTimer = null;
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
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
    const now = nowMs();
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
    const start = nowMs();
    const res = await httpGet(url, { timeout: this.opts.statusTimeoutMs });
    const latencyMs = nowMs() - start;

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
      peer.suspectUntil = nowMs() + this.opts.slowTtlMs;
    }

    return { ok: true, chainId: parsed.chainId, height: parsed.height };
  }

  _markSuccess(peer, { chainId, height, latencyMs }) {
    const now = nowMs();
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
    const now = nowMs();
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

  _choosePeers(kind, count) {
    const now = nowMs();
    this._resurrectExpired(now);

    const peers = Array.from(this.peersByRpc.values()).filter((p) => {
      if (kind === 'rest' && !p.rest) return false;
      if (p.deathUntil > now) return false;
      if (p.lastSeenAt && now - p.lastSeenAt > this.opts.staleTtlMs) return false;
      if (this.networkChainId && p.chainId && p.chainId !== this.networkChainId) return false;
      return true;
    });

    // Prefer non-slow peers when possible, but never permanently exclude.
    const fast = peers.filter((p) => !(p.slowUntil > now));
    const base = fast.length >= count ? fast : peers;
    return pickRandom(base, count);
  }

  _flagSuspectIfDivergent(peers) {
    if (!Array.isArray(peers) || peers.length < 2) return;
    const [a, b] = peers;
    if (!a || !b) return;
    if (typeof a.lastSeenHeight !== 'number' || typeof b.lastSeenHeight !== 'number') return;
    const delta = Math.abs(a.lastSeenHeight - b.lastSeenHeight);
    if (delta <= 2) return;
    const until = nowMs() + this.opts.slowTtlMs;
    a.suspectUntil = Math.max(a.suspectUntil || 0, until);
    b.suspectUntil = Math.max(b.suspectUntil || 0, until);
  }

  async rpcGet(path, options = {}) {
    return this._get('rpc', path, options);
  }

  async restGet(path, options = {}) {
    return this._get('rest', path, options);
  }

  async _get(kind, path, options = {}) {
    this.start();

    const timeout = clampInt(options && options.timeout ? options.timeout : this.opts.requestTimeoutMs, 1000, 120_000);
    const cleanPath = String(path || '').trim();
    const p = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

    let selected = this._choosePeers(kind, 2);
    if (!selected.length) {
      // Force-refresh health a bit and retry selection
      await this._healthTick().catch(() => {});
      selected = this._choosePeers(kind, 2);
      if (!selected.length) return { ok: false, status: 0, error: 'no_peers_available' };
    }

    this._flagSuspectIfDivergent(selected);

    // GETs are safe to race across 2 peers for resilience/anti-censorship.
    const attempts = selected.slice(0, 2).map(async (peer) => {
      const base = kind === 'rpc' ? peer.rpc : peer.rest;
      const url = `${trimSlash(base)}${p}`;
      const start = nowMs();
      const res = await httpGet(url, { timeout });
      const latencyMs = nowMs() - start;

      if (res && res.ok) {
        // Optionally refresh peer status if it hasn't been seen in a while.
        if (!peer.lastSeenAt || nowMs() - peer.lastSeenAt > 30_000) {
          this._pingPeer(peer).catch(() => {});
        } else {
          peer.lastSeenAt = nowMs();
          peer.latencyMs = latencyMs;
        }
        return { ok: true, peer, res };
      }

      if (shouldCountAsPeerFailure(res)) {
        this._markFailure(peer, { latencyMs, timeout: !!(res && res.timeout) });
      }
      return { ok: false, peer, res };
    });

    const settled = await Promise.allSettled(attempts);
    const successes = [];
    const failures = [];
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      (s.value.ok ? successes : failures).push(s.value);
    }

    if (successes.length) {
      successes.sort((a, b) => (a.peer.latencyMs || 0) - (b.peer.latencyMs || 0));
      const win = successes[0];
      return { ...win.res, peer: { rpc: win.peer.rpc, rest: win.peer.rest || null, grpc: win.peer.grpc || null } };
    }

    // Retry with a third peer if both failed.
    const now = nowMs();
    const used = new Set(selected.map((x) => x.rpc));
    const thirdCandidates = Array.from(this.peersByRpc.values()).filter((p) => {
      if (used.has(p.rpc)) return false;
      if (kind === 'rest' && !p.rest) return false;
      if (p.deathUntil > now) return false;
      if (this.networkChainId && p.chainId && p.chainId !== this.networkChainId) return false;
      return true;
    });
    const third = pickRandom(thirdCandidates, 1)[0] || null;
    if (!third) {
      const firstFailure = failures[0];
      return firstFailure && firstFailure.res
        ? { ...firstFailure.res, peer: { rpc: firstFailure.peer.rpc, rest: firstFailure.peer.rest || null, grpc: firstFailure.peer.grpc || null } }
        : { ok: false, status: 0, error: 'all_peers_failed' };
    }

    const base3 = kind === 'rpc' ? third.rpc : third.rest;
    const url3 = `${trimSlash(base3)}${p}`;
    const start3 = nowMs();
    const res3 = await httpGet(url3, { timeout });
    const latencyMs3 = nowMs() - start3;
    if (res3 && res3.ok) {
      if (!third.lastSeenAt || nowMs() - third.lastSeenAt > 30_000) {
        this._pingPeer(third).catch(() => {});
      } else {
        third.lastSeenAt = nowMs();
        third.latencyMs = latencyMs3;
      }
      return { ...res3, peer: { rpc: third.rpc, rest: third.rest || null, grpc: third.grpc || null } };
    }
    if (shouldCountAsPeerFailure(res3)) {
      this._markFailure(third, { latencyMs: latencyMs3, timeout: !!(res3 && res3.timeout) });
    }
    return { ...res3, peer: { rpc: third.rpc, rest: third.rest || null, grpc: third.grpc || null } };
  }

  async refreshFromOnChain() {
    if (this._refreshRunning) return { ok: false, skipped: true };
    this._refreshRunning = true;
    try {
      this.start();

      // Pick a REST peer even if it's stale (it might still be fine); we don't want to deadlock on staleness.
      const now = nowMs();
      this._resurrectExpired(now);
      const restPeers = Array.from(this.peersByRpc.values()).filter((p) => p.rest && !(p.deathUntil > now));
      const chosen = pickRandom(restPeers, 1)[0] || null;
      if (!chosen) return { ok: false, error: 'no_rest_peers' };

      const validators = await this._fetchAllValidators(chosen);
      if (!validators.ok) return validators;

      this.validators = validators.validators;
      this.lastOnChainRefreshAt = nowMs();

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
          operator_address: safeStr(v.operator_address, 256) || null,
          description: {
            website: safeStr(v.description && v.description.website ? v.description.website : '', 1024) || null,
            details: safeStr(v.description && v.description.details ? v.description.details : '', 4096) || null
          },
          status: safeStr(v.status, 64) || null,
          jailed: !!v.jailed
        });
      }

      const pagination = res.json.pagination || {};
      nextKey = safeStr(pagination.next_key, 4096) || null;
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
    const s = safeStr(text, 8192);
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
      const host = safeStr(u.hostname, 512).toLowerCase();
      const port = safeStr(u.port, 16);
      const path = safeStr(u.pathname, 512).toLowerCase();
      const full = trimSlash(u.toString());

      if (!rpc) {
        if (port === '26657' || path.endsWith('/rpc') || host.startsWith('rpc.')) rpc = full;
      }
      if (!rest) {
        if (port === '1317' || path.endsWith('/api') || host.startsWith('api.') || host.includes('lcd')) rest = full;
      }
      if (!grpc) {
        if (host.startsWith('grpc.') || port === '9090') grpc = safeStr(u.host, 512);
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
  PeerPool
};
