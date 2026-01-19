const { ipcMain } = require('electron');
const { Buffer } = require('buffer');
const { getSetting } = require('../settings.cjs');
const crypto = require('crypto');

function ipfsApiBase() {
  return String(getSetting('ipfsApiBase') || 'http://127.0.0.1:5001').replace(/\/+$/, '');
}

const LIMITS = { maxSubsPerWebContents: 5, pubPerSec: 10, pubBurst: 20, maxMsgBytes: 256 * 1024 };
const ACTIVE_SUBS = new Map(); // subId -> { wcId, topic, stop }
const WC_SUBS = new Map(); // wcId -> Set<subId>
const BUCKETS = new Map(); // wcId -> { cap,tokens,refill,last }

function ensureBucket(wcId) {
  const id = String(wcId || '');
  if (BUCKETS.has(id)) return BUCKETS.get(id);
  const b = { cap: LIMITS.pubBurst, tokens: LIMITS.pubBurst, refill: LIMITS.pubPerSec, last: Date.now() };
  BUCKETS.set(id, b);
  return b;
}

function takeToken(bucket, n = 1) {
  const now = Date.now();
  const dt = (now - bucket.last) / 1000;
  if (dt > 0) {
    bucket.tokens = Math.min(bucket.cap, bucket.tokens + dt * bucket.refill);
    bucket.last = now;
  }
  if (bucket.tokens >= n) {
    bucket.tokens -= n;
    return true;
  }
  return false;
}

function normalizeTopic(s) {
  return String(s || '').trim().replace(/^\/+/, '');
}

// multibase base64url ('u') and base64 ('m')
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toMbB64Url(s) {
  return 'u' + b64url(Buffer.from(String(s || ''), 'utf8'));
}

function toMbB64(s) {
  return 'm' + Buffer.from(String(s || ''), 'utf8').toString('base64');
}

function isProbablyMultibase(s) {
  const str = String(s || '');
  if (str.length < 2) return false;
  const tag = str[0];
  const rest = str.slice(1);
  if (!rest) return false;
  if (tag === 'u') return /^[A-Za-z0-9_-]+$/.test(rest);
  if (tag === 'm') return /^[A-Za-z0-9+/=]+$/.test(rest);
  return false;
}

function decodeMultibaseToBuffer(s) {
  try {
    const str = String(s || '');
    if (!str) return Buffer.alloc(0);
    const tag = str[0];
    if (tag === 'u') {
      const raw = str.slice(1);
      const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4);
      return Buffer.from(padded, 'base64');
    }
    if (tag === 'm') return Buffer.from(str.slice(1), 'base64');
    try { return Buffer.from(str, 'base64'); } catch {}
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    return Buffer.from(padded, 'base64');
  } catch {
    return Buffer.alloc(0);
  }
}

function decodeKuboPubsubDataToBuffer(s) {
  const str = String(s || '').trim();
  if (!str) return Buffer.alloc(0);

  // Kubo `/api/v0/pubsub/sub` encodes `data` as base64 (no multibase prefix).
  // Accept base64url-ish strings too.
  try { return Buffer.from(str, 'base64'); } catch {}
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    return Buffer.from(padded, 'base64');
  } catch {}
  return decodeMultibaseToBuffer(str);
}

function decodePubsubJsonFromDataRaw(dataRaw) {
  // Some environments return `data` as base64; others might return multibase.
  // Try base64 first, then fall back to multibase if JSON parsing fails.
  try {
    const b1 = decodeKuboPubsubDataToBuffer(dataRaw);
    const t1 = b1.toString('utf8');
    try {
      const j1 = JSON.parse(t1);
      return { bin: b1, text: t1, json: j1 };
    } catch {}
  } catch {}

  try {
    const b2 = decodeMultibaseToBuffer(String(dataRaw || ''));
    const t2 = b2.toString('utf8');
    const j2 = JSON.parse(t2);
    return { bin: b2, text: t2, json: j2 };
  } catch {}

  return { bin: decodeKuboPubsubDataToBuffer(dataRaw), text: '', json: null };
}

function buildMultipartDataBody(buf, boundary) {
  const pre = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="data"; filename="data"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return Buffer.concat([pre, buf, post]);
}

async function post(url, body, headers, signal) {
  const res = await fetch(url, { method: 'POST', body, headers, signal });
  return res;
}

async function tryPublishMultipartArg(base, topicArg, body, headers, withArgEnc) {
  const u = new URL(`${base}/api/v0/pubsub/pub`);
  u.searchParams.set('arg', topicArg);
  if (withArgEnc) u.searchParams.set('arg-enc', 'text');
  const r = await post(u.toString(), body, headers);
  await r.text().catch(() => '');
  return !!r.ok;
}

async function tryPublishLegacyText(base, topicRaw, msgBuf) {
  // Legacy fallbacks (older kubo builds). Note: message is utf8-encoded.
  const txt = msgBuf.toString('utf8');
  const variants = [
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/pub`);
      u.searchParams.set('topic', topicRaw);
      u.searchParams.set('data', txt);
      return u.toString();
    })(),
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/pub`);
      u.searchParams.append('arg', topicRaw);
      u.searchParams.append('arg', txt);
      u.searchParams.set('arg-enc', 'text');
      return u.toString();
    })(),
  ];

  for (const url of variants) {
    try {
      const r = await post(url);
      await r.text().catch(() => '');
      if (r.ok) return true;
    } catch {}
  }
  return false;
}

async function tryPublishToTopicString(base, topicArg, msgBuf, body, headers) {
  try {
    if (await tryPublishMultipartArg(base, topicArg, body, headers, false)) return true;
  } catch {}
  try {
    if (await tryPublishMultipartArg(base, topicArg, body, headers, true)) return true;
  } catch {}
  try {
    if (await tryPublishLegacyText(base, topicArg, msgBuf)) return true;
  } catch {}
  return false;
}

async function tryPublishBuffer(topicRaw, msgBuf) {
  const base = ipfsApiBase();
  const boundary = '----lumenForm-' + crypto.randomBytes(10).toString('hex');
  const body = buildMultipartDataBody(msgBuf, boundary);
  const headers = { 'Content-Type': `multipart/form-data; boundary=${boundary}` };

  // If caller passed an already-multibase topic, only try it as-is. Generating
  // additional multibase variants from it would create different topic strings.
  if (isProbablyMultibase(topicRaw)) {
    return await tryPublishToTopicString(base, topicRaw, msgBuf, body, headers);
  }

  const topicMbU = toMbB64Url(topicRaw);
  const topicMbM = toMbB64(topicRaw);

  // Publish to multiple topic encodings for cross-version compatibility:
  // different kubo builds accept/require different topic encodings.
  let okAny = false;
  try { okAny = (await tryPublishToTopicString(base, topicMbU, msgBuf, body, headers)) || okAny; } catch {}
  try { okAny = (await tryPublishToTopicString(base, topicMbM, msgBuf, body, headers)) || okAny; } catch {}
  try { okAny = (await tryPublishToTopicString(base, topicRaw, msgBuf, body, headers)) || okAny; } catch {}
  return okAny;
}

async function openSubscribeStreams(topic, signal) {
  const base = ipfsApiBase();
  const makeUrl = (arg, withArgEnc) => {
    const u = new URL(`${base}/api/v0/pubsub/sub`);
    u.searchParams.set('arg', arg);
    if (withArgEnc) u.searchParams.set('arg-enc', 'text');
    u.searchParams.set('discover', 'true');
    return u.toString();
  };

  const tryOpen = async (url) => {
    const res = await fetch(url, { method: 'POST', signal });
    if (!res.ok) {
      await res.text().catch(() => '');
      return null;
    }
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    return reader || null;
  };

  const urls = [];
  if (isProbablyMultibase(topic)) {
    urls.push(makeUrl(topic, false));
  } else {
    urls.push(makeUrl(toMbB64Url(topic), false));
    urls.push(makeUrl(toMbB64(topic), false));
    urls.push(makeUrl(topic, false));
    urls.push(makeUrl(topic, true));
  }

  const uniqUrls = Array.from(new Set(urls));
  const readers = [];
  const topics = [];

  for (const url of uniqUrls) {
    try {
      const r = await tryOpen(url);
      if (!r) continue;
      readers.push(r);
      try {
        const u = new URL(url);
        topics.push(String(u.searchParams.get('arg') || '').trim());
      } catch {}
    } catch {}
  }

  return { readers, topics };
}

/* ---------------- Best-effort rendezvous for small-topic PubSub ---------------- */
const DISCOVERY_LIMITS = {
  tickMs: 5000,
  provideEveryMs: 45_000,
  findprovsTimeoutMs: 12_000,
  connectTimeoutMs: 5000,
  numProviders: 20,
  maxNewPeersPerTick: 6,
  maxAddrsPerPeer: 4,
};

const SELF_ID_CACHE = { id: '', at: 0 };
async function getSelfPeerId() {
  const now = Date.now();
  if (SELF_ID_CACHE.id && now - SELF_ID_CACHE.at < 60_000) return SELF_ID_CACHE.id;
  try {
    const u = new URL(`${ipfsApiBase()}/api/v0/id`);
    u.searchParams.set('enc', 'json');
    const r = await post(u.toString());
    if (!r.ok) return '';
    const j = await r.json().catch(() => ({}));
    const id = String(j?.ID || '').trim();
    if (!id) return '';
    SELF_ID_CACHE.id = id;
    SELF_ID_CACHE.at = now;
    return id;
  } catch {
    return '';
  }
}

function buildMultipartFileBody(buf, boundary) {
  const pre = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="file"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return Buffer.concat([pre, buf, post]);
}

const RENDEZVOUS_CIDS = new Map(); // topic -> cid
async function ensureRendezvousCidForTopic(topic) {
  const key = String(topic || '');
  if (!key) return '';
  if (RENDEZVOUS_CIDS.has(key)) return RENDEZVOUS_CIDS.get(key);
  try {
    const payload = Buffer.from(`lumen.pubsub.rendezvous|v1|${key}`, 'utf8');
    const boundary = '----lumenForm-' + crypto.randomBytes(10).toString('hex');
    const body = buildMultipartFileBody(payload, boundary);

    const u = new URL(`${ipfsApiBase()}/api/v0/add`);
    u.searchParams.set('pin', 'true');
    u.searchParams.set('cid-version', '1');
    u.searchParams.set('raw-leaves', 'true');
    u.searchParams.set('wrap-with-directory', 'false');
    u.searchParams.set('hash', 'sha2-256');

    const r = await post(u.toString(), body, { 'Content-Type': `multipart/form-data; boundary=${boundary}` });
    const txt = await r.text().catch(() => '');
    if (!r.ok) return '';
    const line = txt.trim().split(/\r?\n/).filter(Boolean).pop() || '';
    const j = line ? JSON.parse(line) : {};
    const cid = String(j?.Hash || '').trim();
    if (!cid) return '';
    RENDEZVOUS_CIDS.set(key, cid);
    return cid;
  } catch {
    return '';
  }
}

async function routingProvideBestEffort(cid) {
  let t = null;
  try {
    const u = new URL(`${ipfsApiBase()}/api/v0/routing/provide`);
    u.searchParams.set('arg', String(cid || '').trim());
    const ac = new AbortController();
    t = setTimeout(() => ac.abort(), 12_000);
    const r = await post(u.toString(), undefined, undefined, ac.signal);
    await r.text().catch(() => '');
  } catch {}
  try { if (t) clearTimeout(t); } catch {}
}

async function routingFindprovs(cid, numProviders, timeoutMs) {
  const out = new Map(); // peerId -> Set<addr>
  let t = null;
  try {
    const u = new URL(`${ipfsApiBase()}/api/v0/routing/findprovs`);
    u.searchParams.set('arg', String(cid || '').trim());
    u.searchParams.set('num-providers', String(numProviders || 20));
    const ac = new AbortController();
    t = setTimeout(() => ac.abort(), Math.max(500, timeoutMs | 0));
    const res = await fetch(u.toString(), { method: 'POST', signal: ac.signal });
    if (!res.ok) {
      await res.text().catch(() => '');
      return new Map();
    }
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) {
      return new Map();
    }
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || !value.byteLength) continue;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const j = JSON.parse(line);
            const rs = Array.isArray(j?.Responses) ? j.Responses : [];
            for (const r of rs) {
              const peerId = String(r?.ID || '').trim();
              if (!peerId) continue;
              const addrs = Array.isArray(r?.Addrs) ? r.Addrs : [];
              if (!out.has(peerId)) out.set(peerId, new Set());
              const set = out.get(peerId);
              for (const a of addrs) {
                const s = String(a || '').trim();
                if (s) set.add(s);
              }
            }
          } catch {}
        }
      }
    } catch {}
    try { await reader.cancel(); } catch {}
  } catch {
    // ignore
  }
  try { if (t) clearTimeout(t); } catch {}
  const final = new Map();
  for (const [peerId, set] of out.entries()) {
    final.set(peerId, Array.from(set));
  }
  return final;
}

function isLoopbackMultiaddr(ma) {
  const s = String(ma || '');
  return s.includes('/ip4/127.') || s.includes('/ip6/::1');
}

function withPeerId(ma, peerId) {
  const s = String(ma || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  const m = s.match(/\/p2p\/([^/]+)$/);
  if (m) return m[1] === peerId ? s : '';
  return `${s}/p2p/${peerId}`;
}

function scoreAddr(ma) {
  const s = String(ma || '');
  let score = 1000;
  if (s.includes('/p2p-circuit')) score -= 500;
  if (s.startsWith('/dns')) score -= 200;
  if (s.includes('/quic-v1')) score -= 30;
  if (s.includes('/webrtc-direct')) score -= 10;
  if (s.includes('/tcp/')) score -= 5;
  if (isLoopbackMultiaddr(s)) score += 10_000;
  return score;
}

function pickBestAddrs(addrs, peerId, max) {
  const uniq = Array.from(new Set((Array.isArray(addrs) ? addrs : []).map((a) => String(a || '').trim()).filter(Boolean)));
  const enriched = [];
  for (const a of uniq) {
    if (isLoopbackMultiaddr(a)) continue;
    const withPeer = withPeerId(a, peerId);
    if (!withPeer) continue;
    enriched.push({ a: withPeer, s: scoreAddr(withPeer) });
  }
  enriched.sort((x, y) => x.s - y.s);
  return enriched.slice(0, Math.max(1, max | 0)).map((x) => x.a);
}

async function swarmConnectAddr(ma, timeoutMs) {
  const addr = String(ma || '').trim();
  if (!addr) return false;
  let t = null;
  try {
    const u = new URL(`${ipfsApiBase()}/api/v0/swarm/connect`);
    u.searchParams.set('arg', addr);
    const ac = new AbortController();
    t = setTimeout(() => ac.abort(), Math.max(500, timeoutMs | 0));
    const r = await post(u.toString(), undefined, undefined, ac.signal);
    await r.text().catch(() => '');
    return !!r.ok;
  } catch {
    return false;
  } finally {
    try { if (t) clearTimeout(t); } catch {}
  }
}

const TOPIC_DISCOVERY = new Map(); // topic -> { refs:number, stop:()=>void }
function retainTopicDiscovery(topic) {
  const key = String(topic || '');
  if (!key) return () => {};
  const existing = TOPIC_DISCOVERY.get(key);
  if (existing) {
    existing.refs += 1;
    return () => releaseTopicDiscovery(key);
  }

  let stopped = false;
  let inFlight = false;
  let timer = null;
  let cid = '';
  let lastProvideAt = 0;
  const attempts = new Map(); // peerId -> { n, at }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { if (timer) clearInterval(timer); } catch {}
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if (!cid) cid = await ensureRendezvousCidForTopic(key);
      if (!cid) return;
      const selfId = await getSelfPeerId();

      const now = Date.now();
      if (!lastProvideAt || now - lastProvideAt > DISCOVERY_LIMITS.provideEveryMs) {
        lastProvideAt = now;
        void routingProvideBestEffort(cid).catch(() => {});
      }

      const found = await routingFindprovs(cid, DISCOVERY_LIMITS.numProviders, DISCOVERY_LIMITS.findprovsTimeoutMs);
      let peerBudget = DISCOVERY_LIMITS.maxNewPeersPerTick;
      for (const [peerId, addrs] of found.entries()) {
        if (peerBudget <= 0) break;
        if (!peerId) continue;
        if (selfId && peerId === selfId) continue;

        const prev = attempts.get(peerId) || { n: 0, at: 0 };
        if (prev.n >= 6 && now - prev.at < 60_000) continue;
        if (now - prev.at < 10_000) continue;
        attempts.set(peerId, { n: prev.n + 1, at: now });

        const candidates = pickBestAddrs(addrs, peerId, DISCOVERY_LIMITS.maxAddrsPerPeer);
        if (!candidates.length) continue;

        let okAny = false;
        for (const addr of candidates) {
          // Swarm connect can block; keep the budget tight.
          const ok = await swarmConnectAddr(addr, DISCOVERY_LIMITS.connectTimeoutMs);
          if (ok) okAny = true;
        }
        if (okAny) peerBudget -= 1;
      }
    } finally {
      inFlight = false;
    }
  };

  TOPIC_DISCOVERY.set(key, { refs: 1, stop });
  const tickSafe = () => { tick().catch(() => {}); };
  tickSafe();
  timer = setInterval(tickSafe, DISCOVERY_LIMITS.tickMs);

  return () => releaseTopicDiscovery(key);
}

function releaseTopicDiscovery(topic) {
  const key = String(topic || '');
  if (!key) return;
  const rec = TOPIC_DISCOVERY.get(key);
  if (!rec) return;
  rec.refs -= 1;
  if (rec.refs > 0) return;
  try { rec.stop(); } catch {}
  TOPIC_DISCOVERY.delete(key);
}

function addWcSub(wcId, subId) {
  const id = Number(wcId);
  if (!WC_SUBS.has(id)) WC_SUBS.set(id, new Set());
  WC_SUBS.get(id).add(subId);
}

function removeWcSub(wcId, subId) {
  const id = Number(wcId);
  const s = WC_SUBS.get(id);
  if (!s) return;
  s.delete(subId);
  if (!s.size) WC_SUBS.delete(id);
}

function stopSub(subId) {
  const rec = ACTIVE_SUBS.get(subId);
  if (!rec) return;
  try { rec.stop(); } catch {}
  ACTIVE_SUBS.delete(subId);
  removeWcSub(rec.wcId, subId);
}

function registerIpfsPubsubIpc() {
  ipcMain.handle('ipfs:pubsub:publish', async (evt, args) => {
    const wc = evt && evt.sender ? evt.sender : null;
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'sender_missing' };
    const bucket = ensureBucket(wc.id);
    if (!takeToken(bucket, 1)) return { ok: false, error: 'publish_rate_limited' };

    const topicRaw = normalizeTopic(args && args.topic ? args.topic : '');
    if (!topicRaw) return { ok: false, error: 'missing_topic' };

    const enc = String((args && args.encoding) || '').trim() || 'text';
    let msgBuf;
    try {
      if (enc === 'binary') {
        const b64 = String(args && args.dataB64 ? args.dataB64 : '');
        if (!b64) return { ok: false, error: 'missing_dataB64' };
        msgBuf = Buffer.from(b64, 'base64');
      } else if (enc === 'json') {
        const wire = typeof (args && args.data) === 'string' ? args.data : JSON.stringify((args && args.data) ?? null);
        msgBuf = Buffer.from(wire, 'utf8');
      } else {
        msgBuf = Buffer.from(String((args && args.data) ?? ''), 'utf8');
      }
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'encode_error') };
    }

    if (msgBuf.byteLength > LIMITS.maxMsgBytes) return { ok: false, error: 'message_too_large' };
    const ok = await tryPublishBuffer(topicRaw, msgBuf);
    return ok ? { ok: true } : { ok: false, error: 'publish_failed' };
  });

  ipcMain.handle('ipfs:pubsub:subscribe', async (evt, args) => {
    const wc = evt && evt.sender ? evt.sender : null;
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'sender_missing' };
    const topic = normalizeTopic(args && args.topic ? args.topic : '');
    if (!topic) return { ok: false, error: 'missing_topic' };

    const existing = WC_SUBS.get(wc.id);
    const curCount = existing ? existing.size : 0;
    if (curCount >= LIMITS.maxSubsPerWebContents) return { ok: false, error: 'too_many_subscriptions' };

    const encoding = String((args && args.encoding) || 'text');
    const autoConnect = !!(args && args.autoConnect);
    const subId = `sub_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;

    const ac = new AbortController();
    const { readers, topics } = await openSubscribeStreams(topic, ac.signal);
    if (!readers || !readers.length) return { ok: false, error: 'subscribe_failed' };

    let stopped = false;
    const releaseDiscovery = autoConnect ? retainTopicDiscovery(topic) : null;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try { if (releaseDiscovery) releaseDiscovery(); } catch {}
      for (const r of readers) {
        try { void r.cancel().catch(() => {}); } catch {}
      }
      try { ac.abort(); } catch {}
    };

    ACTIVE_SUBS.set(subId, { wcId: wc.id, topic, stop });
    addWcSub(wc.id, subId);

    try {
      wc.once('destroyed', () => {
        try { stopSub(subId); } catch {}
      });
    } catch {}

    let liveReaders = readers.length;
    const onReaderDone = () => {
      liveReaders -= 1;
      if (liveReaders > 0) return;
      stopSub(subId);
      try { wc.send('ipfs:pubsub:end', { subId }); } catch {}
    };

    // stream readers -> send ipc events (multiple topic encodings for compatibility)
    for (const reader of readers) {
      (async () => {
        const decoder = new TextDecoder();
        let buf = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || stopped) break;
            if (!value || !value.byteLength) continue;
            buf += decoder.decode(value, { stream: true });

            let idx;
            while ((idx = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line) continue;
              try {
                const j = JSON.parse(line);
                const topicId = Array.isArray(j?.topicIDs) && j.topicIDs[0] ? String(j.topicIDs[0]) : topic;
                const dataRaw = String(j?.data ?? '');
                const from = String(j?.from || '');
                const seqnoB64 = String(j?.seqno || '');
                let seqnoHex = '';
                try { seqnoHex = Buffer.from(seqnoB64, 'base64').toString('hex'); } catch {}

                let text;
                let json;
                let binary;
                if (encoding === 'binary') {
                  const bin = decodeKuboPubsubDataToBuffer(dataRaw);
                  binary = Array.from(new Uint8Array(bin));
                } else {
                  if (encoding === 'json') {
                    const decoded = decodePubsubJsonFromDataRaw(dataRaw);
                    text = decoded.text || decoded.bin.toString('utf8');
                    json = decoded.json || undefined;
                  } else {
                    const bin = decodeKuboPubsubDataToBuffer(dataRaw);
                    text = bin.toString('utf8');
                  }
                }
                const payload = { subId, topic: topicId, from, seqno: seqnoHex, dataB64: dataRaw, text, json, binary };
                try { wc.send('ipfs:pubsub:message', payload); } catch {}
              } catch {}
            }
          }
        } catch (e) {
          if (!stopped) {
            try { wc.send('ipfs:pubsub:error', { subId, error: String(e?.message || e || 'stream_error') }); } catch {}
          }
        } finally {
          onReaderDone();
        }
      })();
    }

    return { ok: true, subId, topics };
  });

  ipcMain.handle('ipfs:pubsub:unsubscribe', async (_evt, subId) => {
    const id = String(subId || '').trim();
    if (!id) return { ok: false, error: 'missing_subId' };
    if (!ACTIVE_SUBS.has(id)) return { ok: false, error: 'unknown_subId' };
    stopSub(id);
    return { ok: true };
  });
}

module.exports = { registerIpfsPubsubIpc };
