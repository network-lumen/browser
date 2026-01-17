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

// multibase base64url (u) and base64 (m)
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
const toMbB64Url = (s) => 'u' + b64url(Buffer.from(String(s || ''), 'utf8'));
const toMbB64 = (s) => 'm' + Buffer.from(String(s || ''), 'utf8').toString('base64');

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

async function tryPublishBuffer(topicRaw, msgBuf) {
  const base = ipfsApiBase();
  const topicMbU = toMbB64Url(topicRaw);
  const topicMbM = toMbB64(topicRaw);
  const variants = [];

  // multipart + arg=mb64url(topic)
  {
    const boundary = '----lumenForm-' + crypto.randomBytes(10).toString('hex');
    const body = buildMultipartDataBody(msgBuf, boundary);
    const u = new URL(`${base}/api/v0/pubsub/pub`);
    u.searchParams.set('arg', topicMbU);
    variants.push({ url: u.toString(), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body });
  }
  // multipart + arg=text & arg-enc=text
  {
    const boundary = '----lumenForm-' + crypto.randomBytes(10).toString('hex');
    const body = buildMultipartDataBody(msgBuf, boundary);
    const u = new URL(`${base}/api/v0/pubsub/pub`);
    u.searchParams.set('arg', topicRaw);
    u.searchParams.set('arg-enc', 'text');
    variants.push({ url: u.toString(), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body });
  }
  // multipart + arg=mb64(topic)
  {
    const boundary = '----lumenForm-' + crypto.randomBytes(10).toString('hex');
    const body = buildMultipartDataBody(msgBuf, boundary);
    const u = new URL(`${base}/api/v0/pubsub/pub`);
    u.searchParams.set('arg', topicMbM);
    variants.push({ url: u.toString(), headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body });
  }
  // query: topic&data (utf8)
  {
    const u = new URL(`${base}/api/v0/pubsub/pub`);
    u.searchParams.set('topic', topicRaw);
    u.searchParams.set('data', msgBuf.toString('utf8'));
    variants.push({ url: u.toString() });
  }
  // legacy: 2x arg
  {
    const u = new URL(`${base}/api/v0/pubsub/pub`);
    u.searchParams.set('arg', topicRaw);
    u.searchParams.append('arg', msgBuf.toString('utf8'));
    u.searchParams.set('arg-enc', 'text');
    variants.push({ url: u.toString() });
  }

  for (const v of variants) {
    try {
      const r = await post(v.url, v.body, v.headers);
      if (r.ok) return true;
      await r.text().catch(() => '');
    } catch {}
  }
  return false;
}

async function openSubscribeStream(topic, signal) {
  const base = ipfsApiBase();
  const mbU = toMbB64Url(topic);
  const mbM = toMbB64(topic);
  const variants = [
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/sub`);
      u.searchParams.set('arg', mbU);
      u.searchParams.set('discover', 'true');
      return u.toString();
    })(),
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/sub`);
      u.searchParams.set('arg', mbM);
      u.searchParams.set('discover', 'true');
      return u.toString();
    })(),
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/sub`);
      u.searchParams.set('arg', topic);
      u.searchParams.set('arg-enc', 'text');
      u.searchParams.set('discover', 'true');
      return u.toString();
    })(),
    (() => {
      const u = new URL(`${base}/api/v0/pubsub/sub`);
      u.searchParams.set('arg', topic);
      u.searchParams.set('discover', 'true');
      return u.toString();
    })(),
  ];

  for (const url of variants) {
    try {
      const res = await fetch(url, { method: 'POST', signal });
      if (!res.ok) {
        await res.text().catch(() => '');
        continue;
      }
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (!reader) continue;
      return { reader };
    } catch {}
  }
  return { reader: null };
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
    const subId = `sub_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;

    const ac = new AbortController();
    const { reader } = await openSubscribeStream(topic, ac.signal);
    if (!reader) return { ok: false, error: 'subscribe_failed' };

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try { reader.cancel(); } catch {}
      try { ac.abort(); } catch {}
    };

    ACTIVE_SUBS.set(subId, { wcId: wc.id, topic, stop });
    addWcSub(wc.id, subId);

    try {
      wc.once('destroyed', () => {
        try { stopSub(subId); } catch {}
      });
    } catch {}

    // stream reader -> send ipc events
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

              const bin = decodeMultibaseToBuffer(dataRaw);
              let text;
              let json;
              let binary;
              if (encoding === 'binary') {
                binary = Array.from(new Uint8Array(bin));
              } else {
                text = bin.toString('utf8');
                if (encoding === 'json') {
                  try { json = JSON.parse(text); } catch {}
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
        stopSub(subId);
        try { wc.send('ipfs:pubsub:end', { subId }); } catch {}
      }
    })();

    return { ok: true, subId };
  });

  ipcMain.handle('ipfs:pubsub:unsubscribe', async (_evt, subId) => {
    const id = String(subId || '').trim();
    if (!id) return { ok: false, error: 'missing_subId' };
    if (!ACTIVE_SUBS.has(id)) return { ok: false, error: 'unknown_subId' };
    stopSub(id);
    return { ok: true };
  });

  ipcMain.handle('ipfs:pubsub:ls', async (evt) => {
    const wc = evt && evt.sender ? evt.sender : null;
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'sender_missing' };
    try {
      const u = new URL(`${ipfsApiBase()}/api/v0/pubsub/ls`);
      const r = await post(u.toString());
      if (!r.ok) return { ok: false, error: 'ls_failed' };
      const j = await r.json().catch(() => ({}));
      const topics = Array.isArray(j?.Strings) ? j.Strings : [];
      return { ok: true, topics };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  ipcMain.handle('ipfs:pubsub:peers', async (evt, topic) => {
    const wc = evt && evt.sender ? evt.sender : null;
    if (!wc || wc.isDestroyed()) return { ok: false, error: 'sender_missing' };
    try {
      const t = topic ? normalizeTopic(topic) : '';
      const u = new URL(`${ipfsApiBase()}/api/v0/pubsub/peers`);
      if (t) u.searchParams.set('arg', toMbB64Url(t));
      const r = await post(u.toString());
      if (!r.ok) return { ok: false, error: 'peers_failed' };
      const j = await r.json().catch(() => ({}));
      const peers = Array.isArray(j?.Strings) ? j.Strings : [];
      return { ok: true, peers };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { registerIpfsPubsubIpc };

