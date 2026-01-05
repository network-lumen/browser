const { app, powerMonitor } = require('electron');
const crypto = require('node:crypto');
const os = require('node:os');

const { userDataPath, readJson, writeJson } = require('./utils/fs.cjs');
const {
  fetchGatewaysFromRest,
  resolveGatewayBaseFromEndpoint,
} = require('./ipc/gateway.cjs');

// Seeds are bootstrap entry points only.
// They are NOT assumed to host content.
const STATE_FILE = () => userDataPath('ipfs_seed_state.json');

const MAX_SEEDS_PER_RUN = 8;
const MAX_MULTIADDRS_TOTAL = 50;
const MAX_CONNECT_ATTEMPTS = 20;
const TARGET_CONNECT_SUCCESSES = 5;

const SEED_FETCH_TIMEOUT_MS = 1200;
const SWARM_CONNECT_TIMEOUT_MS = 1500;
const KUBO_LOCAL_TIMEOUT_MS = 1200;

const PEER_LOW_WATERMARK = 5;
const CID_FAILURE_THRESHOLD = 3;
const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

let bootstrapInProgress = false;
let started = false;
let lastAttemptAtMem = 0;
let lastKuboUnavailableLogAt = 0;

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function readState() {
  const fallback = {
    version: 1,
    firstRunDone: false,
    lastAttemptAt: 0,
    lastSuccessAt: 0,
    lastReason: '',
    lastNetworkFingerprint: '',
    cidFailureStreak: 0,
    lastCidFailureAt: 0,
  };
  const st = readJson(STATE_FILE(), fallback);
  return { ...fallback, ...(st || {}) };
}

function writeState(state) {
  try {
    writeJson(STATE_FILE(), state);
  } catch {}
}

function networkFingerprint() {
  try {
    const ifaces = os.networkInterfaces();
    const entries = [];
    for (const name of Object.keys(ifaces).sort()) {
      const addrs = Array.isArray(ifaces[name]) ? ifaces[name] : [];
      for (const a of addrs) {
        if (!a || a.internal) continue;
        const fam = String(a.family || '').toLowerCase();
        const addr = String(a.address || '');
        if (!addr) continue;
        entries.push(`${name}:${fam}:${addr}`);
      }
    }
    const raw = entries.sort().join('|');
    return crypto.createHash('sha256').update(raw).digest('hex');
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    try { clearTimeout(t); } catch {}
  }
}

async function kuboJson(pathname, searchParams, timeoutMs) {
  const url = new URL(`http://127.0.0.1:5001${pathname}`);
  for (const [k, v] of Object.entries(searchParams || {})) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetchWithTimeout(url.toString(), { method: 'POST' }, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`kubo_http_${res.status}${text ? ':' + text.slice(0, 120) : ''}`);
  }
  const json = await res.json().catch(() => null);
  if (!json) throw new Error('kubo_bad_json');
  return json;
}

async function kuboPeersCount() {
  const json = await kuboJson('/api/v0/swarm/peers', { enc: 'json' }, KUBO_LOCAL_TIMEOUT_MS);
  const peers = Array.isArray(json.Peers) ? json.Peers : [];
  return peers.length;
}

async function kuboSwarmConnect(multiaddr) {
  const json = await kuboJson(
    '/api/v0/swarm/connect',
    { arg: String(multiaddr || '') },
    SWARM_CONNECT_TIMEOUT_MS
  );
  return json;
}

function ensureP2pSuffix(addr, peerId) {
  const a = String(addr || '').trim();
  const p = String(peerId || '').trim();
  if (!a || !p) return '';
  if (/(^|\/)(p2p|ipfs)\//i.test(a)) return a;
  return `${trimSlash(a)}/p2p/${p}`;
}

async function fetchSeedFromGateway(baseUrl) {
  const base = trimSlash(String(baseUrl || '').trim());
  if (!base) return { ok: false, error: 'base_missing' };
  const url = `${base}/ipfs/seed`;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { accept: 'application/json' } },
      SEED_FETCH_TIMEOUT_MS
    );
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const json = await res.json().catch(() => null);
    const peerId = String(json?.peerId || '').trim();
    const multiaddrsRaw = Array.isArray(json?.multiaddrs) ? json.multiaddrs : [];
    if (!peerId || !multiaddrsRaw.length) return { ok: false, error: 'bad_payload' };
    const multiaddrs = multiaddrsRaw
      .map((m) => ensureP2pSuffix(m, peerId))
      .map((m) => String(m || '').trim())
      .filter((m) => m.startsWith('/'))
      .slice(0, MAX_MULTIADDRS_TOTAL);
    if (!multiaddrs.length) return { ok: false, error: 'no_addrs' };
    return { ok: true, peerId, multiaddrs };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function shuffle(arr) {
  const a = Array.from(arr || []);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function mapPool(items, concurrency, fn) {
  const list = Array.from(items || []);
  const results = new Array(list.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= list.length) return;
      try {
        results[i] = await fn(list[i], i);
      } catch (e) {
        results[i] = { ok: false, error: String(e && e.message ? e.message : e) };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function collectSeedMultiaddrs(maxGateways) {
  const lim = Math.min(Math.max(Number(maxGateways || MAX_SEEDS_PER_RUN), 1), 20);
  const { gateways, error } = await fetchGatewaysFromRest(250, 1500);
  if (!gateways.length) return { ok: false, multiaddrs: [], error: error || 'no_gateways' };

  const active = gateways.filter((g) => !!g?.active);
  const picked = shuffle(active).slice(0, lim);

  const bases = await mapPool(picked, 4, async (gw) => {
    const endpoint = String(gw?.endpoint || gw?.baseUrl || '').trim();
    if (!endpoint) return null;
    const resolved = await resolveGatewayBaseFromEndpoint(endpoint, 1200, { quiet: true }).catch(() => null);
    const base = trimSlash(String(resolved || endpoint).trim());
    if (!base) return null;
    if (/^https?:\/\//i.test(base)) return base;
    return `https://${base}`;
  });

  const uniqueBases = Array.from(new Set(bases.filter(Boolean)));
  const seedResults = await mapPool(uniqueBases, 4, async (base) => fetchSeedFromGateway(base));

  const addrSet = new Set();
  for (const r of seedResults) {
    if (!r || !r.ok) continue;
    for (const a of r.multiaddrs || []) {
      if (addrSet.size >= MAX_MULTIADDRS_TOTAL) break;
      addrSet.add(a);
    }
  }

  const multiaddrs = Array.from(addrSet);
  return { ok: multiaddrs.length > 0, multiaddrs, error: null };
}

async function connectToSeeds(multiaddrs) {
  const shuffled = shuffle(Array.from(multiaddrs || [])).slice(0, MAX_CONNECT_ATTEMPTS);
  if (!shuffled.length) return { attempted: 0, connected: 0 };

  let connected = 0;
  await mapPool(shuffled, 3, async (addr) => {
    if (connected >= TARGET_CONNECT_SUCCESSES) return { ok: true, skipped: true };
    try {
      await kuboSwarmConnect(addr);
      connected += 1;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  return { attempted: shuffled.length, connected };
}

function shouldAttemptSeedBootstrap(state, ctx) {
  const now = ctx.now;
  const lastAttemptAt = Math.max(Number(state.lastAttemptAt || 0), Number(lastAttemptAtMem || 0));
  const first = !state.firstRunDone;
  const lowPeers = typeof ctx.peerCount === 'number' && ctx.peerCount < PEER_LOW_WATERMARK;
  const netChanged =
    !!state.lastNetworkFingerprint &&
    !!ctx.networkFp &&
    state.lastNetworkFingerprint !== ctx.networkFp;
  const cidFailures = (state.cidFailureStreak || 0) >= CID_FAILURE_THRESHOLD;

  if (!(first || lowPeers || netChanged || cidFailures)) return { ok: false, reason: '' };
  if (lastAttemptAt && now - lastAttemptAt < MIN_REFRESH_INTERVAL_MS) {
    return { ok: false, reason: 'cooldown' };
  }

  const reason = first
    ? 'first_launch'
    : lowPeers
    ? 'low_peers'
    : netChanged
    ? 'network_change'
    : 'cid_failures';
  return { ok: true, reason };
}

async function maybeBootstrapIpfsSeeds(trigger) {
  if (bootstrapInProgress) return { ok: false, skipped: 'in_progress' };
  bootstrapInProgress = true;
  try {
    const state = readState();
    const now = nowMs();
    const fp = networkFingerprint();

    let peerCount;
    try {
      peerCount = await kuboPeersCount();
    } catch (e) {
      const last = Number(lastKuboUnavailableLogAt || 0);
      if (!last || now - last > 5 * 60 * 1000) {
        lastKuboUnavailableLogAt = now;
        console.log('[electron][ipfs-seed] kubo not ready:', String(e?.message || e));
      }
      return { ok: false, skipped: 'kubo_unavailable' };
    }

    const decision = shouldAttemptSeedBootstrap(state, { now, peerCount, networkFp: fp });
    if (!decision.ok) return { ok: false, skipped: decision.reason || 'not_needed' };

    // Prevent recovery storms even if state persistence fails.
    lastAttemptAtMem = now;

    const nextState = {
      ...state,
      firstRunDone: true,
      lastAttemptAt: now,
      lastReason: String(trigger || decision.reason || ''),
      lastNetworkFingerprint: fp || state.lastNetworkFingerprint,
    };
    writeState(nextState);

    console.log('[electron][ipfs-seed] bootstrap start', {
      trigger: String(trigger || ''),
      reason: decision.reason,
      peerCount,
    });

    const seeds = await collectSeedMultiaddrs(MAX_SEEDS_PER_RUN);
    if (!seeds.ok || !seeds.multiaddrs.length) {
      console.log('[electron][ipfs-seed] no seeds collected');
      return { ok: false, skipped: 'no_seeds' };
    }

    const connect = await connectToSeeds(seeds.multiaddrs);
    console.log('[electron][ipfs-seed] bootstrap done', connect);

    const success = connect.connected > 0;
    const finalState = {
      ...readState(),
      lastNetworkFingerprint: fp || state.lastNetworkFingerprint,
      ...(success ? { lastSuccessAt: now, cidFailureStreak: 0 } : {}),
    };
    writeState(finalState);
    return { ok: success, ...connect };
  } finally {
    bootstrapInProgress = false;
  }
}

function recordCidResolutionFailure() {
  try {
    const st = readState();
    const next = {
      ...st,
      cidFailureStreak: Math.min(Number(st.cidFailureStreak || 0) + 1, 1000),
      lastCidFailureAt: nowMs(),
    };
    writeState(next);
    if (next.cidFailureStreak >= CID_FAILURE_THRESHOLD) {
      void maybeBootstrapIpfsSeeds('cid_failure');
    }
  } catch {}
}

function recordCidResolutionSuccess() {
  try {
    const st = readState();
    if (!st.cidFailureStreak) return;
    writeState({ ...st, cidFailureStreak: 0 });
  } catch {}
}

function startIpfsSeedBootstrapper() {
  if (started) return;
  started = true;

  // First launch: wait for Kubo readiness, then attempt a single bootstrap run.
  void (async () => {
    const deadline = nowMs() + 90_000;
    while (nowMs() < deadline) {
      const res = await maybeBootstrapIpfsSeeds('startup');
      if (res?.skipped !== 'kubo_unavailable') return;
      await sleep(1500);
    }
  })();

  // Recovery-only: check occasionally, but only dials when conditions match + cooldown.
  setInterval(() => {
    void maybeBootstrapIpfsSeeds('periodic');
  }, MIN_REFRESH_INTERVAL_MS);

  try {
    powerMonitor?.on?.('resume', () => {
      void maybeBootstrapIpfsSeeds('resume');
    });
  } catch {}

  // Interface changes can happen without a resume event.
  let lastFp = networkFingerprint();
  setInterval(() => {
    const fp = networkFingerprint();
    if (!fp || fp === lastFp) return;
    lastFp = fp;
    void maybeBootstrapIpfsSeeds('network_change');
  }, 5 * 60 * 1000);
}

module.exports = {
  startIpfsSeedBootstrapper,
  maybeBootstrapIpfsSeeds,
  recordCidResolutionFailure,
  recordCidResolutionSuccess,
};
