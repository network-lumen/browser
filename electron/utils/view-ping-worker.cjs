const { Worker, isMainThread, parentPort } = require('worker_threads');
const {
  createHash,
  randomBytes,
  hkdfSync,
  createCipheriv,
} = require('crypto');
const { Buffer } = require('buffer');

const {
  Bip39,
  EnglishMnemonic,
  Slip10,
  Slip10Curve,
  Secp256k1,
  Sha256,
  stringToPath,
} = require('@cosmjs/crypto');

let mlKemModule = null;
async function getMlKem() {
  if (mlKemModule) return mlKemModule;
  let mod = null;
  try {
    mod = await import('@noble/post-quantum/ml-kem.js');
  } catch {
    mod = await import('@noble/post-quantum/ml-kem');
  }
  mlKemModule = mod.ml_kem768 || mod.default?.ml_kem768 || mod;
  return mlKemModule;
}

const GATEWAY_DERIVATION_PATH = "m/44'/118'/0'/0/0";

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function normalizeHttpBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return trimSlash(raw);
  return trimSlash(`https://${raw}`);
}

function sha256Utf8(data) {
  return new Sha256(new TextEncoder().encode(String(data ?? ''))).digest();
}

async function deriveGatewayPrivkey(mnemonic) {
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));
  const { privkey } = Slip10.derivePath(
    Slip10Curve.Secp256k1,
    seed,
    stringToPath(GATEWAY_DERIVATION_PATH),
  );
  return privkey;
}

async function signGatewayPayload(mnemonic, payload) {
  const privkey = await deriveGatewayPrivkey(mnemonic);
  const digest = sha256Utf8(payload);
  const sigObj = await Secp256k1.createSignature(digest, privkey);
  const signature = sigObj.toFixedLength();
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const pubkeyCompressed = Secp256k1.compressPubkey(pubkey);
  return {
    signatureB64: Buffer.from(signature).toString('base64'),
    pubkeyB64: Buffer.from(pubkeyCompressed).toString('base64'),
  };
}

const KYBER_PUBKEY_CACHE_TTL_MS = 5 * 60 * 1000;
const kyberPubkeyCache = new Map(); // baseUrl -> { at, alg, keyId, pubKey }

async function resolveKyberKeyForGatewayBase(baseUrl) {
  const base = normalizeHttpBaseUrl(baseUrl);
  if (!base) throw new Error('kyber_pubkey_http_unavailable');

  const cached = kyberPubkeyCache.get(base);
  if (cached && Date.now() - Number(cached.at || 0) < KYBER_PUBKEY_CACHE_TTL_MS) {
    return cached;
  }

  let httpPubB64 = null;
  let httpKeyId = 'gw-2025-01';
  let httpAlg = 'kyber768';

  try {
    const url = `${base}/pq/pub`;
    const res = await fetch(url, { method: 'GET' });
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
      if (data && typeof data.key_id === 'string' && data.key_id.trim()) {
        httpKeyId = data.key_id.trim();
      }
      if (data && typeof data.alg === 'string' && data.alg.trim()) {
        httpAlg = data.alg.trim();
      }
    }
  } catch (e) {
    throw new Error(
      `kyber_pubkey_http_unavailable:${String(e && e.message ? e.message : e)}`,
    );
  }

  if (!httpPubB64) throw new Error('kyber_pubkey_http_unavailable');
  const pubKey = Buffer.from(httpPubB64, 'base64');
  const out = { at: Date.now(), alg: httpAlg || 'kyber768', keyId: httpKeyId || 'gw-2025-01', pubKey };
  kyberPubkeyCache.set(base, out);
  return out;
}

async function sendGatewayAuthPq({
  baseUrl,
  path,
  method,
  wallet,
  mnemonic,
  timeoutMs,
  payload,
} = {}) {
  const base = normalizeHttpBaseUrl(baseUrl);
  if (!base) throw new Error('gateway_base_missing');

  const { alg, keyId, pubKey } = await resolveKyberKeyForGatewayBase(base);
  if (alg !== 'kyber768') throw new Error('unsupported_kyber_alg');

  const canonicalPayload = JSON.stringify(payload ?? null);
  const payloadHashHex = createHash('sha256').update(canonicalPayload).digest('hex');
  const nonce = randomBytes(12).toString('hex');
  const ts = Date.now();
  const canonical = `${method}|${path}|${nonce}|${ts}|${payloadHashHex}`;

  const { signatureB64, pubkeyB64 } = await signGatewayPayload(mnemonic, canonical);

  const envelope = {
    wallet,
    payload: payload ?? null,
    signature: signatureB64,
    pubkey: pubkeyB64,
    timestamp: ts,
    nonce,
  };

  const envelopeBytes = Buffer.from(JSON.stringify(envelope), 'utf8');

  const ml_kem768 = await getMlKem();
  const { cipherText: kemCipherText, sharedSecret } = ml_kem768.encapsulate(pubKey);
  const hkdfOut = hkdfSync(
    'sha256',
    Buffer.alloc(0),
    Buffer.from(sharedSecret),
    Buffer.from('lumen-authwallet-v1'),
    32,
  );
  const aesKey = Buffer.from(hkdfOut);
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ct = Buffer.concat([cipher.update(envelopeBytes), cipher.final()]);
  const tag = cipher.getAuthTag();

  const body = JSON.stringify({
    kem_ct: Buffer.from(kemCipherText).toString('base64'),
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  });

  const url = `${base}${path}`;
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, timeoutMs)
      : null;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Lumen-PQ': 'v1',
        'X-Lumen-KEM': 'kyber768',
        'X-Lumen-KeyId': keyId,
      },
      body,
      ...(controller ? { signal: controller.signal } : {}),
    });
    return { status: res.status };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

if (!isMainThread) {
  let queue = Promise.resolve();

  parentPort.on('message', (msg) => {
    queue = queue.then(() => handleMessage(msg)).catch(() => {});
  });

  async function handleMessage(msg) {
    const id = msg && msg.id ? String(msg.id) : '';
    const baseUrl = msg && msg.baseUrl ? String(msg.baseUrl) : '';
    const wallet = msg && msg.wallet ? String(msg.wallet) : '';
    const mnemonic = msg && msg.mnemonic ? String(msg.mnemonic) : '';
    const cid = msg && msg.cid ? String(msg.cid) : '';
    const timeoutMsRaw = msg && msg.timeoutMs != null ? Number(msg.timeoutMs) : 2500;
    const timeoutMs =
      Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
        ? Math.min(timeoutMsRaw, 10_000)
        : 2500;

    if (!baseUrl || !wallet || !mnemonic || !cid) {
      parentPort.postMessage({ id, ok: false, error: 'missing_params' });
      return;
    }

    try {
      const { status } = await sendGatewayAuthPq({
        baseUrl,
        path: '/pq/view',
        method: 'POST',
        wallet,
        mnemonic,
        timeoutMs,
        payload: { cid },
      });

      if (status < 200 || status >= 300) {
        parentPort.postMessage({ id, ok: false, error: 'bad_status', status });
        return;
      }

      parentPort.postMessage({ id, ok: true, status });
    } catch (e) {
      parentPort.postMessage({
        id,
        ok: false,
        error: String(e && e.message ? e.message : e),
      });
    }
  }
} else {
  let worker = null;
  let seq = 0;
  const recentErrors = new Map(); // error -> lastAt
  const ERROR_LOG_TTL_MS = 30_000;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(__filename);
    worker.on('message', (msg) => {
      if (!msg || msg.ok) return;
      const err = String(msg.error || 'view_ping_failed');
      const now = Date.now();
      const last = recentErrors.get(err) || 0;
      if (now - last < ERROR_LOG_TTL_MS) return;
      recentErrors.set(err, now);
      try {
        // eslint-disable-next-line no-console
        console.warn('[gateway] view ping worker error', msg);
      } catch {}
    });
    worker.on('error', (err) => {
      worker = null;
      try {
        // eslint-disable-next-line no-console
        console.warn('[gateway] view ping worker crashed', err);
      } catch {}
    });
    worker.on('exit', () => {
      worker = null;
    });
    return worker;
  }

  function enqueueViewPing({ baseUrl, wallet, mnemonic, cid, timeoutMs } = {}) {
    const w = ensureWorker();
    const id = `${Date.now()}-${seq++}`;
    w.postMessage({
      id,
      baseUrl,
      wallet,
      mnemonic,
      cid,
      timeoutMs,
    });
  }

  module.exports = {
    enqueueViewPing,
  };
}

