const crypto = require('crypto');
const { getNetworkPool } = require('./pool_singleton.cjs');

function nowMs() {
  return Date.now();
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x | 0));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRandom(items, count) {
  const arr = Array.isArray(items) ? items.slice() : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, count | 0));
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex').toUpperCase();
}

function normalizeTxBytes(input) {
  if (!input) return { ok: false, error: 'missing_txBytes' };
  if (Buffer.isBuffer(input)) return { ok: true, bytes: input };
  if (input instanceof Uint8Array) return { ok: true, bytes: Buffer.from(input) };

  const s = String(input || '').trim();
  if (!s) return { ok: false, error: 'missing_txBytes' };

  // Try hex (with or without 0x)
  const hex = s.startsWith('0x') ? s.slice(2) : s;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    return { ok: true, bytes: Buffer.from(hex, 'hex') };
  }

  // Otherwise treat as base64
  try {
    const buf = Buffer.from(s, 'base64');
    if (buf && buf.length) return { ok: true, bytes: buf };
  } catch {}

  return { ok: false, error: 'invalid_txBytes' };
}

async function rpcJsonPost(url, body, timeoutMs) {
  const ms = clampInt(timeoutMs, 1000, 120_000);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(String(url || ''), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, text, json, timeout: false };
  } catch (e) {
    const isTimeout = e && (e.name === 'AbortError' || String(e).includes('aborted'));
    return { ok: false, status: 0, error: String(e && e.message ? e.message : e), timeout: isTimeout };
  } finally {
    try {
      clearTimeout(t);
    } catch {}
  }
}

async function ensureSomeAlive(pool, kind, minCount) {
  const want = Math.max(1, minCount | 0);
  let alive = pool.pickPeers(kind, want, { requireAlive: true });
  if (alive.length >= want) return alive;

  // Ping a few non-dead candidates to bootstrap "alive"
  const candidates = pool.pickPeers(kind, Math.max(3, want * 2), { requireAlive: false });
  for (const p of candidates) {
    await pool.pingPeer(p).catch(() => {});
    alive = pool.pickPeers(kind, want, { requireAlive: true });
    if (alive.length >= want) return alive;
  }
  return alive;
}

async function queryPeerWithStatus(pool, kind, peer, path, options) {
  const statusAgeMaxMs = clampInt(options && options.statusAgeMaxMs ? options.statusAgeMaxMs : 30_000, 1_000, 300_000);
  const timeout = clampInt(options && options.timeout ? options.timeout : 12_000, 1_000, 120_000);

  // Ensure fresh-ish status (chain_id / height)
  const now = nowMs();
  if (!peer.lastSeenAt || !peer.chainId || typeof peer.lastSeenHeight !== 'number' || now - peer.lastSeenAt > statusAgeMaxMs) {
    await pool.pingPeer(peer).catch(() => {});
  }

  const chainId = peer.chainId || null;
  const height = typeof peer.lastSeenHeight === 'number' ? peer.lastSeenHeight : null;

  const res = await pool.requestOnPeer(kind, peer, path, { timeout });
  return {
    peer,
    res,
    chainId,
    height
  };
}

function chooseCoherentGroup(pool, results) {
  const ok = results.filter((r) => r && r.res && r.res.ok && r.chainId && typeof r.height === 'number');
  if (!ok.length) return { chosen: null, suspects: [], reason: 'no_success' };

  const byChain = new Map(); // chainId -> result[]
  for (const r of ok) {
    const arr = byChain.get(r.chainId) || [];
    arr.push(r);
    byChain.set(r.chainId, arr);
  }

  const preferred = pool.networkChainId || null;
  let bestChain = null;
  let bestArr = [];

  for (const [cid, arr] of byChain.entries()) {
    if (preferred && cid === preferred) {
      bestChain = cid;
      bestArr = arr;
      break;
    }
    if (!bestChain) {
      bestChain = cid;
      bestArr = arr;
      continue;
    }
    if (arr.length > bestArr.length) {
      bestChain = cid;
      bestArr = arr;
      continue;
    }
    if (arr.length === bestArr.length) {
      const maxA = Math.max(...arr.map((x) => x.height || 0));
      const maxB = Math.max(...bestArr.map((x) => x.height || 0));
      if (maxA > maxB) {
        bestChain = cid;
        bestArr = arr;
      }
    }
  }

  const maxHeight = Math.max(...bestArr.map((x) => x.height || 0));
  const coherent = bestArr.filter((x) => Math.abs((x.height || 0) - maxHeight) <= 2);
  const coherentSet = new Set(coherent.map((x) => x.peer.rpc));

  const suspects = [];
  for (const r of ok) {
    if (!coherentSet.has(r.peer.rpc)) suspects.push(r.peer);
  }

  // If we somehow filtered everything out, fall back to the highest height in bestChain.
  const chosenArr = coherent.length ? coherent : bestArr;
  chosenArr.sort((a, b) => (b.height || 0) - (a.height || 0) || (a.peer.latencyMs || 9e9) - (b.peer.latencyMs || 9e9));
  return { chosen: chosenArr[0] || null, suspects, reason: 'ok' };
}

async function readState(path, options = {}) {
  const kind = options && options.kind === 'rest' ? 'rest' : 'rpc';
  const pool = getNetworkPool();
  pool.start();

  const exclude = new Set();

  // Select 2 alive peers, run in parallel, compare chain/height.
  let peers = await ensureSomeAlive(pool, kind, 2);
  if (peers.length < 2) {
    // If we cannot get 2 alive, still try with what we have (resilience > strictness)
    peers = peers.length ? peers : pool.pickPeers(kind, 1, { requireAlive: false });
  }
  for (const p of peers) exclude.add(p.rpc);

  const firstResults = await Promise.all(
    peers.map((p) => queryPeerWithStatus(pool, kind, p, path, options).catch(() => null))
  );

  let decision = chooseCoherentGroup(pool, firstResults.filter(Boolean));

  // If incoherent or only one good peer, retry with a 3rd alive peer.
  const needThird =
    !decision.chosen ||
    firstResults.filter((r) => r && r.res && r.res.ok).length < 2 ||
    decision.suspects.length > 0;

  if (needThird) {
    let third = pool.pickPeers(kind, 1, { requireAlive: true, exclude })[0] || null;
    if (!third) {
      const boot = await ensureSomeAlive(pool, kind, 1);
      third = boot.find((x) => x && !exclude.has(x.rpc)) || null;
    }
    if (third) {
      exclude.add(third.rpc);
      const thirdResult = await queryPeerWithStatus(pool, kind, third, path, options).catch(() => null);
      const all = [...firstResults.filter(Boolean), ...(thirdResult ? [thirdResult] : [])];
      decision = chooseCoherentGroup(pool, all);
      for (const s of decision.suspects) pool.markSuspect(s);
    } else {
      for (const s of decision.suspects) pool.markSuspect(s);
    }
  }

  if (decision.chosen && decision.chosen.res) return decision.chosen.res;

  // Fall back to first available response
  const firstOk = firstResults.find((r) => r && r.res && r.res.ok);
  if (firstOk) return firstOk.res;
  const firstAny = firstResults.find((r) => r && r.res);
  return firstAny ? firstAny.res : { ok: false, status: 0, error: 'read_failed' };
}

async function broadcastTx(txBytes, options = {}) {
  const pool = getNetworkPool();
  pool.start();

  const norm = normalizeTxBytes(txBytes);
  if (!norm.ok) return { ok: false, error: norm.error };
  const bytes = norm.bytes;
  const txB64 = bytes.toString('base64');
  const computedHash = sha256Hex(bytes);

  const timeout = clampInt(options && options.timeout ? options.timeout : 12_000, 1_000, 120_000);
  const confirmTimeoutMs = clampInt(options && options.confirmTimeoutMs ? options.confirmTimeoutMs : 60_000, 1_000, 10 * 60_000);
  const pollIntervalMs = clampInt(options && options.pollIntervalMs ? options.pollIntervalMs : 1500, 250, 10_000);

  const exclude = new Set();
  const candidates = await ensureSomeAlive(pool, 'rpc', 2);
  if (!candidates.length) {
    return { ok: false, error: 'no_rpc_peers_available' };
  }

  // Broadcast sequentially to avoid double-broadcast.
  let broadcastPeer = null;
  let broadcastResult = null;

  const tries = pickRandom(candidates, Math.min(3, candidates.length));
  for (const p of tries) {
    exclude.add(p.rpc);
    const body = { jsonrpc: '2.0', id: `lumen-${Date.now()}`, method: 'broadcast_tx_sync', params: { tx: txB64 } };
    const start = nowMs();
    const r = await rpcJsonPost(p.rpc, body, timeout);
    const latencyMs = nowMs() - start;
    if (!r.ok || !r.json) {
      if (r.timeout) pool.markFailure(p, { latencyMs, timeout: true });
      continue;
    }

    if (r.json.error) {
      // App-level error (do not mark peer death directly)
      broadcastPeer = p;
      broadcastResult = r.json;
      break;
    }

    broadcastPeer = p;
    broadcastResult = r.json;
    break;
  }

  if (!broadcastPeer || !broadcastResult) return { ok: false, error: 'broadcast_failed' };

  const result = broadcastResult.result || null;
  const txhash = (result && (result.hash || result.txhash)) ? String(result.hash || result.txhash).replace(/^0x/i, '').toUpperCase() : computedHash;
  const code = typeof result?.code === 'number' ? result.code : 0;
  const rawLog = String(result?.log || result?.raw_log || '');

  if (code !== 0) {
    return { ok: false, code, rawLog: rawLog || `broadcast failed (code ${code})`, transactionHash: txhash };
  }

  // Confirm via a different peer when possible.
  let confirmPeer = pool.pickPeers('rpc', 1, { requireAlive: true, exclude })[0] || null;
  if (!confirmPeer) {
    // Fall back to another non-dead peer, or ultimately the broadcast peer.
    confirmPeer = pool.pickPeers('rpc', 1, { requireAlive: false, exclude })[0] || broadcastPeer;
  }

  // If the chosen confirmation peer looks inconsistent with the broadcast peer, treat it as suspect.
  try {
    await pool.pingPeer(broadcastPeer).catch(() => {});
    await pool.pingPeer(confirmPeer).catch(() => {});
    const aCid = broadcastPeer.chainId || null;
    const bCid = confirmPeer.chainId || null;
    const aH = typeof broadcastPeer.lastSeenHeight === 'number' ? broadcastPeer.lastSeenHeight : null;
    const bH = typeof confirmPeer.lastSeenHeight === 'number' ? confirmPeer.lastSeenHeight : null;
    if (aCid && bCid && aCid !== bCid) {
      pool.markSuspect(confirmPeer);
      const alt = pool.pickPeers('rpc', 1, { requireAlive: true, exclude })[0] || null;
      if (alt) confirmPeer = alt;
    } else if (typeof aH === 'number' && typeof bH === 'number' && Math.abs(aH - bH) > 2) {
      pool.markSuspect(confirmPeer);
      const alt = pool.pickPeers('rpc', 1, { requireAlive: true, exclude })[0] || null;
      if (alt) confirmPeer = alt;
    }
  } catch {}

  const deadline = nowMs() + confirmTimeoutMs;
  let lastErr = null;

  while (nowMs() < deadline) {
    const peer = confirmPeer;
    const r = await pool.requestOnPeer('rpc', peer, `/tx?hash=0x${txhash}`, { timeout: 8_000 });
    if (r && r.ok && r.json && r.json.result) {
      const h = Number(r.json.result.height);
      const txr = r.json.result.tx_result || {};
      const finalCode = typeof txr.code === 'number' ? txr.code : 0;
      const finalLog = String(txr.log || txr.raw_log || '');
      return {
        ok: finalCode === 0,
        height: Number.isFinite(h) ? h : 0,
        code: finalCode,
        rawLog: finalLog,
        transactionHash: txhash
      };
    }

    // Not found yet or peer problem.
    if (r && r.timeout) {
      pool.markSuspect(peer);
      const alt = pool.pickPeers('rpc', 1, { requireAlive: true, exclude: new Set([broadcastPeer.rpc]) })[0] || null;
      if (alt) confirmPeer = alt;
    }
    lastErr = r && r.error ? r.error : lastErr;
    await sleep(pollIntervalMs);
  }

  return { ok: false, error: 'tx_not_confirmed', transactionHash: txhash, lastError: lastErr };
}

module.exports = {
  readState,
  broadcastTx
};
