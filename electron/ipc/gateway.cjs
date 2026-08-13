const { ipcMain } = require('electron');
const { existsSync } = require('fs');
const { randomBytes, hkdfSync, createCipheriv, createDecipheriv } = require('crypto');
const { userDataPath, readJson, writeJson } = require('../utils/fs.cjs');
const { getSetting } = require('../settings.cjs');
const {
  decryptMnemonicLocal,
  decryptMnemonicWithPassword,
  encryptMnemonicLocal,
  isPasswordProtected,
  sha256,
} = require('../utils/crypto.cjs');
const { arePqcKeysEncrypted, tempDecryptPqcKeys } = require('../utils/pqc-keys.cjs');
const { zeroFee, describeBroadcastFailure } = require('../utils/tx.cjs');
const { trimSlash } = require('../utils/strings.cjs');
const { getSessionPassword } = require('./security.cjs');
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');
const { resolvePqcHome, signAndBroadcastWithPqcAutoLink } = require('../utils/pqc_link.cjs');
// Finding gateways and resolving one to a base URL is the client's job, in
// gateways/client.cjs. This file is the IPC layer over it.
const {
  getRestBaseUrl,
  resolveGatewayBaseFromEndpoint,
  resolveKyberKeyForGatewayBase,
  fetchGatewaysFromRest,
  mapWithConcurrency,
  parseContractMetadata,
  KYBER_PUBKEY_CACHE,
  KYBER_PUBKEY_CACHE_TTL_MS
} = require('../gateways/client.cjs');
let _gwHttpDebugCached = null;

function parseBoolEnv(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return null;
}

function gatewayHttpDebugEnabled() {
  if (_gwHttpDebugCached !== null) return _gwHttpDebugCached;

  const env = parseBoolEnv(process.env.LUMEN_GATEWAY_HTTP_DEBUG);
  if (env !== null) {
    _gwHttpDebugCached = env;
    return env;
  }

  // Default: enabled in dev/unpackaged builds, disabled in packaged apps.
  try {
    const app = require('electron').app;
    if (app && app.isPackaged === false) {
      _gwHttpDebugCached = true;
      return true;
    }
  } catch {
    // ignore
  }

  _gwHttpDebugCached = false;
  return false;
}

function maskWallet(addr) {
  const s = String(addr || '').trim();
  if (!s) return '';
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function summarizePqPayload(payload) {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'object') return String(payload).slice(0, 120);
  const out = { keys: Object.keys(payload).slice(0, 12) };
  try {
    if (payload && typeof payload.cid === 'string') out.cid = payload.cid.slice(0, 24);
    if (payload && typeof payload.page === 'number') out.page = payload.page;
    if (payload && typeof payload.planId === 'string') out.planId = payload.planId;
    if (payload && typeof payload.plan_id === 'string') out.plan_id = payload.plan_id;
    if (payload && typeof payload.estBytes === 'number') out.estBytes = payload.estBytes;
    if (payload && typeof payload.displayName === 'string') out.displayNameLen = payload.displayName.length;
  } catch {
    // ignore summary errors
  }
  return out;
}

function summarizePqResponse(pathname, data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return String(data).slice(0, 160);

  const out = {};
  try {
    if (typeof data.ok === 'boolean') out.ok = data.ok;
    if (typeof data.error === 'string') out.error = data.error;
    if (typeof data.message === 'string') out.message = String(data.message).slice(0, 120);
    if (typeof data.wallet === 'string') out.wallet = maskWallet(data.wallet);

    if (Array.isArray(data.cids)) {
      out.cids = { count: data.cids.length, sample: data.cids.slice(0, 3) };
    }
    if (Array.isArray(data.items)) {
      out.items = { count: data.items.length };
    }

    if (pathname === '/wallet/usage') {
      const plan = data.plan && typeof data.plan === 'object' ? data.plan : null;
      if (plan && (plan.id || plan.planId)) out.planId = String(plan.id || plan.planId || '');
    }

    if (pathname === '/pq/search') {
      const hits = Array.isArray(data.hits)
        ? data.hits
        : Array.isArray(data.results)
          ? data.results
          : [];

      const safeParseObj = (value) => {
        if (!value) return null;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return null;
        const s = value.trim();
        if (!s) return null;
        try {
          const parsed = JSON.parse(s);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      };

      const summarizeHit = (hit) => {
        if (!hit || typeof hit !== 'object') return null;
        const cid = typeof hit.cid === 'string' ? hit.cid.trim() : '';
        const kind = typeof hit.kind === 'string' ? hit.kind.trim() : '';
        const mime = typeof hit.mime === 'string' ? hit.mime.trim() : '';
        const resourceType =
          typeof hit.resourceType === 'string'
            ? hit.resourceType.trim()
            : typeof hit.resource_type === 'string'
              ? hit.resource_type.trim()
              : '';

        const tags =
          safeParseObj(hit.tags_json) || safeParseObj(hit.tags) || safeParseObj(hit.tagsJson);
        const topicsFromTags = tags && Array.isArray(tags.topics) ? tags.topics : null;
        const topicsFromHit = Array.isArray(hit.topics) ? hit.topics : null;
        const topicsSample = (topicsFromTags || topicsFromHit || [])
          .map((t) => String(t || '').trim())
          .filter(Boolean)
          .slice(0, 3);

        const tokensObj =
          tags && tags.tokens && typeof tags.tokens === 'object' ? tags.tokens : null;
        const tokensCount = tokensObj ? Object.keys(tokensObj).length : null;

        return {
          cid: cid ? cid.slice(0, 24) : undefined,
          kind: kind || undefined,
          resourceType: resourceType || undefined,
          mime: mime || undefined,
          topicsSample: topicsSample.length ? topicsSample : undefined,
          tagsTopicsLen: tags && Array.isArray(tags.topics) ? tags.topics.length : undefined,
          tagsTokensCount: typeof tokensCount === 'number' ? tokensCount : undefined,
        };
      };

      out.search = {
        hits: hits.length,
        hasPrev: typeof data.hasPrev === 'boolean' ? data.hasPrev : undefined,
        hasMore: typeof data.hasMore === 'boolean' ? data.hasMore : undefined,
        pageCursorKeys: data.pageCursor ? Object.keys(data.pageCursor).slice(0, 8) : undefined,
        prevCursorKeys: data.prevCursor ? Object.keys(data.prevCursor).slice(0, 8) : undefined,
        nextCursorKeys: data.nextCursor ? Object.keys(data.nextCursor).slice(0, 8) : undefined,
        first: summarizeHit(hits[0]),
      };
    }
  } catch {
    // ignore
  }

  const keys = Object.keys(out);
  if (!keys.length) return { keys: Object.keys(data).slice(0, 16) };
  return out;
}

function redactUrlForLog(urlStr) {
  try {
    const u = new URL(String(urlStr || ''));
    if (u.searchParams.has('token')) u.searchParams.set('token', '<redacted>');
    return u.toString();
  } catch {
    const s = String(urlStr || '');
    return s.replace(/([?&]token=)[^&#]+/i, '$1<redacted>');
  }
} // normalized endpoint/baseUrl/url hints for gateways marked active=false

const ACTIVE_GATEWAY_PINS = new Map(); // wcId -> { abort: () => void }

let viewPingWorker = null;
try {
  viewPingWorker = require('../workers/view-ping-worker.cjs');
} catch {
  viewPingWorker = null;
}

const {
  Bip39,
  EnglishMnemonic,
  Slip10,
  Slip10Curve,
  Secp256k1,
  Ripemd160,
  Sha256,
  stringToPath,
} = require('@cosmjs/crypto');
const { toBech32 } = require('@cosmjs/encoding');

/**
 * ML-KEM-768, loaded on first use.
 *
 * `@noble/post-quantum` is ESM-only, so a CommonJS file can only reach it
 * through a dynamic import - hence the cache, which every call after the first
 * returns from.
 *
 * There used to be a `catch` here retrying the extensionless
 * `@noble/post-quantum/ml-kem`. That subpath is not in the package's exports
 * map, so it could only ever fail - and it failed with
 * ERR_PACKAGE_PATH_NOT_EXPORTED, which would have replaced whatever the real
 * first failure was on the one path where knowing it matters.
 */
let mlKemModule = null;
async function getMlKem() {
  if (mlKemModule) return mlKemModule;
  const mod = await import('@noble/post-quantum/ml-kem.js');
  mlKemModule = mod.ml_kem768 || mod.default?.ml_kem768 || mod;
  return mlKemModule;
}

let bridge = null;

function ipfsApiBase() {
  return String(getSetting('ipfsApiBase') || 'http://127.0.0.1:5001').replace(/\/+$/, '');
}
async function loadBridge() {
  if (bridge) return bridge;
  try {
    const mod = await import('@lumen-chain/sdk');
    const sdk = (mod && (mod.default || mod)) || mod;
    const out = { ...sdk };

    if (!out.walletFromMnemonic && out.utils && out.utils.walletFromMnemonic) {
      out.walletFromMnemonic = out.utils.walletFromMnemonic;
    }
    if (!out.LumenSigningClient && out.LumenClient) {
      out.LumenSigningClient = out.LumenClient;
    }

    bridge = out;
    return bridge;
  } catch (e) {
    console.warn('[gateway] failed to load @lumen-chain/sdk', e && e.message ? e.message : e);
    bridge = null;
    return null;
  }
}

function profilesFilePath() {
  return userDataPath('profiles.json');
}

function keystoreFile(profileId) {
  return userDataPath('profiles', profileId, 'keystore.json');
}

function guestPqWalletFile() {
  return userDataPath('guest', 'pq', 'wallet.json');
}

function loadProfilesFile() {
  const file = profilesFilePath();
  const fallback = { profiles: [], activeId: '' };
  const data = readJson(file, fallback);
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const activeId = typeof data.activeId === 'string' ? data.activeId : '';
  return { profiles, activeId };
}

const MNEMONIC_CACHE_TTL_MS = 2 * 60 * 1000;
const mnemonicCache = new Map(); // profileId -> { mnemonic, at, mode, sessionKey? }

function loadMnemonic(profileId) {
  try {
    const now = Date.now();
    const cached = mnemonicCache.get(profileId);
    if (cached && now - Number(cached.at || 0) < MNEMONIC_CACHE_TTL_MS) {
      if (cached.mode === 'local' && cached.mnemonic) {
        return cached.mnemonic;
      }
      if (cached.mode === 'password' && cached.mnemonic && cached.sessionKey) {
        const pwd = getSessionPassword();
        if (!pwd) throw new Error('password_required');
        const key = sha256(pwd);
        if (key === cached.sessionKey) {
          return cached.mnemonic;
        }
      }
    }
  } catch {
    // ignore cache errors
  }

  const file = keystoreFile(profileId);
  const raw = existsSync(file) ? readJson(file, null) : null;
  if (!raw) throw new Error(`No keystore for profileId=${profileId}`);

  // Password-protected keystore (v2): require an active security session password.
  if (isPasswordProtected(raw)) {
    const pwd = getSessionPassword();
    if (!pwd) throw new Error('password_required');
    const mnemonic = decryptMnemonicWithPassword(raw, pwd);
    if (!mnemonic) {
      console.warn('[gateway] mnemonic decrypt failed for profileId=', profileId);
      mnemonicCache.delete(profileId);
      throw new Error('invalid_password');
    }
    mnemonicCache.set(profileId, {
      mnemonic,
      at: Date.now(),
      mode: 'password',
      sessionKey: sha256(pwd),
    });
    return mnemonic;
  }

  // Legacy local-secret keystore (v1)
  const mnemonic = decryptMnemonicLocal(raw);
  if (!mnemonic) throw new Error('Failed to decrypt keystore');
  mnemonicCache.set(profileId, { mnemonic, at: Date.now(), mode: 'local' });
  return mnemonic;
}

function getWalletAddressForProfile(profileId) {
  const { profiles } = loadProfilesFile();
  const p = profiles.find((x) => String(x.id || '') === String(profileId || ''));
  const addr = p && (p.walletAddress || p.address);
  return addr ? String(addr).trim() : null;
}

function isGuestProfile(profileId) {
  const pid = String(profileId || '').trim();
  if (!pid) return true;
  const { profiles } = loadProfilesFile();
  const p = profiles.find((x) => String(x.id || '') === pid);
  return !!(p && p.role === 'guest');
}

const GATEWAY_DERIVATION_PATH = "m/44'/118'/0'/0/0";

async function deriveGatewayPrivkey(mnemonic) {
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic));
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(GATEWAY_DERIVATION_PATH));
  return privkey;
}

async function deriveWalletAddressFromMnemonic(mnemonic, prefix = 'lmn') {
  const privkey = await deriveGatewayPrivkey(mnemonic);
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const pubkeyCompressed = Secp256k1.compressPubkey(pubkey);
  const sha = new Sha256(pubkeyCompressed).digest();
  const rawAddress = new Ripemd160(sha).digest();
  return toBech32(prefix, rawAddress);
}

async function signGatewayPayload(mnemonic, payload) {
  const privkey = await deriveGatewayPrivkey(mnemonic);
  const digest = sha256(payload, { bytes: true });
  const sigObj = await Secp256k1.createSignature(digest, privkey);
  const signature = sigObj.toFixedLength();
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const pubkeyCompressed = Secp256k1.compressPubkey(pubkey);
  return {
    signatureB64: Buffer.from(signature).toString('base64'),
    pubkeyB64: Buffer.from(pubkeyCompressed).toString('base64'),
  };
}

function getRpcBaseUrl() {
  try {
    const peer = getNetworkPool().getBestPeer('rpc');
    return peer && peer.rpc ? String(peer.rpc) : null;
  } catch {
    return null;
  }
}

async function sendGatewayAuthPq(params) {
  const base = String(params.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('gateway_base_missing');

  const debug = gatewayHttpDebugEnabled();
  const startedAt = Date.now();
  const requestId = `pq-${startedAt.toString(16)}-${randomBytes(3).toString('hex')}`;

  const timeoutMsRaw = Number(params.timeoutMs ?? 0);
  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 0;
  const outerSignal = params?.signal;

  const controller = timeoutMs || outerSignal ? new AbortController() : null;
  const timeoutId = controller && timeoutMs
    ? setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, timeoutMs)
    : null;

  if (controller && outerSignal) {
    try {
      if (outerSignal.aborted) controller.abort();
      else {
        outerSignal.addEventListener(
          'abort',
          () => {
            try {
              controller.abort();
            } catch {}
          },
          { once: true },
        );
      }
    } catch {
      // ignore
    }
  }

  const { alg, keyId, pubKey } = await resolveKyberKeyForGatewayBase(base, controller ? { signal: controller.signal } : {});
  if (alg !== 'kyber768') throw new Error('unsupported_kyber_alg');

  const payload = params.payload ?? null;
  if (payload !== null && typeof payload !== 'object') {
    throw new Error('invalid_payload');
  }

  const canonicalPayload = JSON.stringify(payload ?? null);
  const payloadHashHex = sha256(canonicalPayload);

  const nonce = randomBytes(12).toString('hex');
  const ts = Date.now();
  const canonical = `${params.method}|${params.path}|${nonce}|${ts}|${payloadHashHex}`;

  const { signatureB64, pubkeyB64 } = await signGatewayPayload(params.mnemonic, canonical);

  const envelope = {
    wallet: params.wallet,
    payload,
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

  const url = `${base}${params.path}`;

  let res;
  try {
    if (debug) {
      console.log('[gateway] sendGatewayAuthPq request', {
        requestId,
        method: params.method,
        path: params.path,
        url,
        timeoutMs: timeoutMs || null,
        wallet: maskWallet(params.wallet),
        payload: summarizePqPayload(payload),
      });
    }
    res = await fetch(url, {
      method: params.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Lumen-PQ': 'v1',
        'X-Lumen-KEM': 'kyber768',
        'X-Lumen-KeyId': keyId,
      },
      body,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (debug) {
      console.log('[gateway] sendGatewayAuthPq response_headers', {
        requestId,
        method: params.method,
        path: params.path,
        status: res.status,
        contentType: res.headers?.get?.('content-type') || null,
      });
    }
  } catch (e) {
    if (debug) {
      console.warn('[gateway] sendGatewayAuthPq fetch_error', {
        requestId,
        method: params.method,
        path: params.path,
        url,
        ms: Date.now() - startedAt,
        error: String(e && e.message ? e.message : e),
      });
    }
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const status = res.status;
  const text = await res.text().catch(() => '');
  let raw = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = text;
  }

  let data = raw;
  if (
    raw &&
    typeof raw === 'object' &&
    typeof raw.ciphertext === 'string' &&
    typeof raw.iv === 'string' &&
    typeof raw.tag === 'string'
  ) {
    try {
      const ctBuf = Buffer.from(raw.ciphertext, 'base64');
      const ivBuf = Buffer.from(raw.iv, 'base64');
      const tagBuf = Buffer.from(raw.tag, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', aesKey, ivBuf);
      decipher.setAuthTag(tagBuf);
      const pt = Buffer.concat([decipher.update(ctBuf), decipher.final()]);
      const json = pt.toString('utf8') || 'null';
      data = JSON.parse(json);
    } catch (e) {
      console.warn('[gateway] sendGatewayAuthPq decrypt_response_error', e && e.message ? e.message : e);
      data = null;
    }
  }

  if (debug) {
    console.log('[gateway] sendGatewayAuthPq done', {
      requestId,
      method: params.method,
      path: params.path,
      status,
      ms: Date.now() - startedAt,
      bytes: typeof text === 'string' ? text.length : null,
      data: summarizePqResponse(params.path, data),
    });
  }

  return { status, data };
}

function extractGatewayContracts(data) {
  if (!data) return [];
  const list = Array.isArray(data?.contracts)
    ? data.contracts
    : Array.isArray(data?.Contracts)
    ? data.Contracts
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];
  return list;
}

function normalizeContract(raw) {
  if (!raw) return null;
  const metadata = parseContractMetadata(raw?.metadata ?? raw?.info ?? raw?.extras);
  const gatewayId = String(
    raw?.gateway_id ?? raw?.gatewayId ?? metadata?.gatewayId ?? ''
  );
  const id = String(raw?.id ?? raw?.contractId ?? '');
  const nextPayoutRaw =
    raw?.next_payout_time ?? raw?.nextPayoutTime ?? metadata?.nextPayoutTime;
  const startTimeRaw = raw?.start_time ?? raw?.startTime;
  const toMs = (value) => {
    if (value == null) return undefined;
    const num = Number(value);
    if (!Number.isFinite(num)) return undefined;
    // heuristic: if <= 10 digits -> seconds
    return num > 1e12 ? num : num * 1000;
  };
  return {
    id,
    gatewayId,
    client: String(raw?.client || ''),
    priceUlmn: Number(raw?.price_ulmn ?? raw?.priceUlmn ?? 0),
    storageGbPerMonth: Number(
      raw?.storage_gb_per_month ?? raw?.storageGbPerMonth ?? 0
    ),
    networkGbPerMonth: Number(
      raw?.network_gb_per_month ?? raw?.networkGbPerMonth ?? 0
    ),
    monthsTotal: Number(raw?.months_total ?? raw?.monthsTotal ?? 0),
    startTime: toMs(startTimeRaw),
    nextPayoutTime: toMs(nextPayoutRaw),
    claimedMonths: Number(
      raw?.claimed_months ??
        raw?.claimedMonths ??
        metadata?.claimedMonths ??
        0
    ),
    escrowUlmn: String(raw?.escrow_ulmn ?? raw?.escrowUlmn ?? ''),
    status: String(raw?.status ?? '').toLowerCase(),
    metadata,
    raw,
  };
}

function mapSubscriptionEntryToCurrent(entry) {
  if (!entry) return null;
  const metadata =
    entry && typeof entry.metadata === 'object' && entry.metadata
      ? entry.metadata
      : {};

  const gatewayId = String(
    entry.gatewayId ??
      metadata.gatewayId ??
      entry.raw?.gatewayId ??
      ''
  ).trim();

  const endpointRaw =
    metadata.gatewayEndpoint ??
    metadata.endpoint ??
    entry.raw?.gatewayEndpoint ??
    (entry.raw?.gateway && entry.raw.gateway.endpoint) ??
    entry.raw?.endpoint ??
    '';
  const endpoint = String(endpointRaw || '').trim();

  const gatewayName =
    endpoint || (gatewayId ? `Gateway ${gatewayId}` : 'Gateway');

  function toMs(value) {
    if (value == null) return undefined;
    const num = Number(value);
    return Number.isFinite(num)
      ? num > 1e12
        ? num
        : num * 1000
      : undefined;
  }

  function preferSlugId() {
    const vals = Array.from(arguments);
    for (const v of vals) {
      const s = String(v ?? '').trim();
      if (!s) continue;
      // slug-like: contains a letter or dash/underscore
      if (/^[a-z0-9_-]+$/i.test(s) && /[a-z]/i.test(s)) return s;
      // some gateways may use lowercase words without dashes
      if (/^[a-z]+$/i.test(s)) return s;
    }
    const first = vals.find((v) => String(v ?? '').trim());
    return String(first ?? '').trim();
  }

  const derivedPlanId = preferSlugId(
    metadata.planId,
    metadata.planName,
    entry.planId,
    entry.raw?.planId
  );
  const planName = String(
    (metadata.planName ?? derivedPlanId) || 'Plan'
  );

  const priceUlmn = Number(
    metadata.planPrice ??
      entry.priceUlmn ??
      metadata.priceUlmn ??
      0
  );
  const monthsTotal = Math.max(
    1,
    Number(entry.monthsTotal ?? metadata.monthsTotal ?? 1)
  );
  const renewsAt = toMs(
    entry.nextPayoutTime ?? metadata.nextPayoutTime
  );
  const quota =
    metadata.quotaGb != null ? Number(metadata.quotaGb) : undefined;
  const used =
    metadata.usedGb != null ? Number(metadata.usedGb) : undefined;

  const contractId = String(
    entry.contractId ?? entry.id ?? metadata.contractId ?? ''
  ).trim();
  const fallbackId = `${gatewayId || 'gw'}:${planName}:${
    Math.random().toString(36).slice(2, 8)
  }`;
  const id = contractId || fallbackId;

  return {
    id,
    contractId: contractId || undefined,
    gatewayId,
    gatewayName,
    endpoint,
    planName,
    planId: String(derivedPlanId || '').trim() || undefined,
    priceUlmn,
    monthsTotal,
    status: String(
      entry.status ?? metadata.status ?? ''
    ).toLowerCase(),
    renewsAt,
    storageGbPerMonth:
      entry.storageGbPerMonth != null
        ? Number(entry.storageGbPerMonth)
        : undefined,
    networkGbPerMonth:
      entry.networkGbPerMonth != null
        ? Number(entry.networkGbPerMonth)
        : undefined,
    quotaGb: quota,
    usedGb: used,
  };
}

let gatewayParamsCache = null;

/**
 * `month_seconds` from the chain's gateway params - how long a paid month
 * lasts, and so the only way to turn a contract's `months_total` into the date
 * it stops covering anything. Cached for a minute: it is a governance
 * parameter, and every contract in a list needs it.
 */
async function getGatewayMonthSeconds() {
  const now = Date.now();
  if (gatewayParamsCache && now - gatewayParamsCache.ts < 60_000) {
    return gatewayParamsCache.monthSeconds;
  }

  const restBase = getRestBaseUrl();
  if (!restBase) return null;

  try {
    const url = new URL('/lumen/gateway/v1/params', trimSlash(restBase));
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) return gatewayParamsCache ? gatewayParamsCache.monthSeconds : null;
    const json = await res.json().catch(() => null);
    const raw = json?.params?.month_seconds ?? json?.params?.monthSeconds;
    const seconds = Number(raw);
    const monthSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    gatewayParamsCache = { ts: now, monthSeconds };
    return monthSeconds;
  } catch {
    return gatewayParamsCache ? gatewayParamsCache.monthSeconds : null;
  }
}

/**
 * When a contract stops covering storage: the moment its paid months run out.
 *
 * The chain leaves `status` at ACTIVE long past that point - a contract is only
 * closed once the operator claims or someone finalizes it - so status alone
 * tells a client nothing about whether the plan is still paid for.
 */
function contractExpiresAt(contract, monthSeconds) {
  if (!contract || !monthSeconds) return undefined;
  const start = Number(contract.startTime);
  const months = Number(contract.monthsTotal);
  if (!Number.isFinite(start) || start <= 0) return undefined;
  if (!Number.isFinite(months) || months <= 0) return undefined;
  return start + months * monthSeconds * 1000;
}

async function listGatewaySubscriptions(address, opts) {
  const addr = String(address || '').trim();
  if (!addr) {
    return { subscriptions: [], error: 'missing_address' };
  }

  const restBase = getRestBaseUrl();
  if (!restBase) {
    return { subscriptions: [], error: 'rest_base_missing' };
  }

  const base = trimSlash(restBase);
  const limitRaw = opts && opts.limit != null ? opts.limit : 200;
  const limit = Math.min(Math.max(Number(limitRaw) || 200, 1), 500);

  try {
    const url = new URL('/lumen/gateway/v1/contracts', base);
    url.searchParams.set('client', addr);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) {
      const status = res.status;
      const text = (await res.text().catch(() => '')).trim();
      const statusLabel = status ? `HTTP ${status}` : 'HTTP error';
      const msg = text ? `${statusLabel}: ${text.slice(0, 160)}` : statusLabel;
      return { subscriptions: [], error: msg };
    }

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    const rawList = extractGatewayContracts(json);
    const list = Array.isArray(rawList)
      ? rawList.map(normalizeContract).filter(Boolean)
      : [];

    const monthSeconds = await getGatewayMonthSeconds();
    for (const contract of list) {
      contract.expiresAt = contractExpiresAt(contract, monthSeconds);
    }

    return { subscriptions: list, error: null };
  } catch (e) {
    return {
      subscriptions: [],
      error: String(e && e.message ? e.message : e),
    };
  }
}

function sanitizeGatewayRegions(input) {
  const source = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? String(input)
        .split(/[\s,\n]+/)
        .filter(Boolean)
    : [];

  return source
    .map((r) => String(r || '').trim())
    .filter(Boolean)
    .map((r) => (r.length > 32 ? r.slice(0, 32) : r));
}

function normalizeGatewayEndpoint(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const value = raw.toLowerCase();
  if (value.length > 120) throw new Error('Invalid endpoint: too long');
  if (!/^[a-z0-9.-]+$/.test(value)) throw new Error('Invalid endpoint: characters');
  if (value.includes('..')) throw new Error('Invalid endpoint: empty label');
  const labels = value.split('.');
  if (labels.length < 2) throw new Error('Invalid endpoint: format');
  const ext = labels.pop();
  if (!/^[a-z]{2,14}$/.test(ext)) throw new Error('Invalid endpoint: extension format');
  for (const label of labels) {
    if (!label) throw new Error('Invalid endpoint: empty label');
    if (!/^[a-z0-9-]{1,63}$/.test(label)) throw new Error('Invalid endpoint: domain format');
  }
  const domain = labels.join('.');
  if (!domain) throw new Error('Invalid endpoint: format');
  return `${domain}.${ext}`;
}

function buildGatewayMetadata(opts) {
  const meta = {};
  if (opts?.endpoint) meta.endpoint = opts.endpoint;
  if (Array.isArray(opts?.regions)) meta.regions = opts.regions;
  if (opts?.extras && typeof opts.extras === 'object') {
    for (const [k, v] of Object.entries(opts.extras)) {
      if (meta[k] === undefined) meta[k] = v;
    }
  }
  return Object.keys(meta).length ? JSON.stringify(meta) : '';
}

function normalizePlan(raw, gateway, fallbackIndex) {
  if (!raw) return null;
  const gatewayId = String(gateway?.id ?? gateway?.gatewayId ?? '');
  const endpoint = String(gateway?.endpoint ?? '').trim();
  const gatewayName =
    (gateway?.metadata && (gateway.metadata.name || gateway.metadata.label)) ||
    endpoint ||
    `${gatewayId || ''}`;
  const priceLmn = Number(raw?.priceLMN);
  const priceUlmnRaw = Math.round(priceLmn * 1_000_000);
  const priceUlmn = Number(priceUlmnRaw ?? 0);
  const planKey =
    raw?.plan_id ??
    raw?.planId ??
    raw?.id ??
    raw?.name ??
    raw?.title ??
    `plan-${fallbackIndex}`;
  const description = raw?.description ?? raw?.notes ?? '';
  const storageGbPerMonth = Number(raw?.gbMonth ?? 0);
  const networkGbPerMonth = Number(raw?.maxEgressGBMonth ?? 0);
  const priceLabel = `${(priceUlmn / 1_000_000).toFixed(2)} LMN / mo`;
  return {
    id: gatewayId ? `${gatewayId}:${String(planKey)}` : String(planKey),
    planId: String(planKey),
    gatewayId,
    gatewayName: String(gatewayName),
    gatewayEndpoint: endpoint,
    priceUlmn,
    priceLabel,
    storageGbPerMonth,
    networkGbPerMonth,
    monthsTotal: 1,
    description: String(description || ''),
    raw,
  };
}

async function fetchPlansForGateway(gateway, timeoutMs) {
  const endpoint = String(gateway?.endpoint || '').trim();
  if (!endpoint) {
    return { plans: [], error: 'endpoint_missing' };
  }

  // Resolve DNS-based endpoints (e.g. gw-1.lumen...) into HTTP base URLs.
  const resolvedBase =
    (await resolveGatewayBaseFromEndpoint(endpoint).catch(() => null)) ||
    endpoint;
  const baseStr = String(resolvedBase || '').trim();
  if (!baseStr) return { plans: [], error: 'pricing_unavailable' };

  const withScheme = /^[a-z]+:\/\//i.test(baseStr)
    ? baseStr
    : `https://${baseStr}`;
  const urlBase = trimSlash(withScheme);
  if (!urlBase) return { plans: [], error: 'pricing_unavailable' };

  const ms =
    typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : 3000;

  async function getJsonWithTimeout(target) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(target, { method: 'GET', signal: controller.signal });
      clearTimeout(id);
      const text = await res.text().catch(() => '');
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, json, text };
    } catch (e) {
      clearTimeout(id);
      return { ok: false, status: 0, error: String(e && e.message ? e.message : e) };
    }
  }

  try {
    // Important UX: if the gateway base is already known to be offline from the PQ Kyber
    // pubkey health cache, skip the pricing call entirely to avoid waiting on timeouts.
    // This also matches the SearchPage behavior which filters gateways by PQ health.
    const now = Date.now();
    const cached =
      KYBER_PUBKEY_CACHE.get(urlBase) ||
      KYBER_PUBKEY_CACHE.get(urlBase.toLowerCase());
    if (cached && now - cached.checkedAt < KYBER_PUBKEY_CACHE_TTL_MS && cached.ok === false) {
      return { plans: [], error: 'gateway_offline_cached' };
    }

    let res = await getJsonWithTimeout(urlBase + '/pricing');
    if (!res.ok) {
      const status = Number(res.status || 0) || 0;
      const shouldFallback = status === 404 || status === 405;
      if (shouldFallback) {
        console.warn('[gateway] pricing /pricing failed, fallback to /price', {
          status: res.status,
        });
        res = await getJsonWithTimeout(urlBase + '/price');
      }
    }
    if (!res.ok) {
      console.warn('[gateway] pricing fetch failed', {
        status: res.status,
        text: String(res.text || '').slice(0, 160),
      });
      return { plans: [], error: 'pricing_unavailable' };
    }
    const payload = res.json && res.json.data ? res.json.data : res.json;
    if (!Array.isArray(payload) || !payload.length) {
      return { plans: [], error: 'pricing_empty' };
    }
    const plans = payload
      .map((p, idx) => normalizePlan(p, gateway, idx))
      .filter(Boolean);
    if (plans.length) return { plans, source: urlBase };
    return { plans: [], error: 'pricing_unavailable' };
  } catch (e) {
    console.error('[gateway] fetchPlansForGateway error:', e && e.message ? e.message : e);
    return { plans: [], error: 'pricing_unavailable' };
  }
}

  async function listAvailableGatewayPlans(limit, timeoutMs, options) {
    const lim = Math.min(Math.max(Number(limit || 200), 1), 500);
    const ms =
      typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : 6000;

    const { gateways, error } = await fetchGatewaysFromRest(lim, ms);
    if (!gateways.length && error) {
      return { plans: [], gateways: [], errors: { _all: error } };
    }

    // Deduplicate gateways by endpoint (or id fallback) to avoid querying
    // the same gateway multiple times. When multiple gateway IDs share the
    // same endpoint (e.g. old records), prefer the newest/highest id and
    // the one carrying crypto metadata.
    const gatewayIdNumber = (gw) => {
      const raw = gw?.id ?? gw?.gatewayId ?? gw?.gateway_id ?? gw?.ID ?? '';
      const n = Number(String(raw).trim());
      return Number.isFinite(n) ? n : -1;
    };
    const hasCrypto = (gw) => {
      const meta = gw?.metadata || {};
      return !!(meta.crypto || meta.kyber || meta.crypto?.kyber);
    };
    const chooseBetterGateway = (a, b) => {
      const aId = gatewayIdNumber(a);
      const bId = gatewayIdNumber(b);
      if (aId !== bId) return bId > aId ? b : a;
      const aCrypto = hasCrypto(a);
      const bCrypto = hasCrypto(b);
      if (aCrypto !== bCrypto) return bCrypto ? b : a;
      const aActive = a?.active !== false;
      const bActive = b?.active !== false;
      if (aActive !== bActive) return bActive ? b : a;
      return a;
    };

    const bestByKey = new Map();
    for (const gw of gateways) {
      const endpointKey = String(gw?.endpoint || gw?.baseUrl || '').trim().toLowerCase();
      const idKey = String(gw?.id || gw?.gatewayId || gw?.gateway_id || '').trim().toLowerCase();
      const key = endpointKey || idKey;
      if (!key) continue;
      const prev = bestByKey.get(key);
      bestByKey.set(key, prev ? chooseBetterGateway(prev, gw) : gw);
    }
    const deduped = Array.from(bestByKey.values());

    const includePricing = options?.includePricing !== false;
    if (!includePricing) {
      return { plans: [], gateways: deduped, errors: {} };
    }

    const pricingTimeout = Math.max(800, Math.min(ms, 6000));
    const plans = [];
    const planErrors = {};

    // Fetch pricing with bounded concurrency to avoid a single dead gateway
    // blocking the full plans list.
    const results = await mapWithConcurrency(deduped, 4, async (gateway) => {
      // Avoid querying gateways that are explicitly marked offline/inactive on-chain.
      // This keeps DrivePage sidebar + "Cloud plans" modal snappy even when many inactive
      // gateway endpoints are unreachable.
      if (gateway && gateway.active === false) {
        return { gateway, gid: String(gateway?.id || ''), result: { plans: [] } };
      }
      const gid = String(gateway?.id || '');
      const result = await fetchPlansForGateway(gateway, pricingTimeout);
      return { gateway, gid, result };
    });

    for (const row of results) {
      const gid = String(row?.gid || '');
      const gateway = row?.gateway;
      const result = row?.result || {};

      if (result.plans && result.plans.length) {
        for (const plan of result.plans) {
          plans.push({ ...plan, gatewayId: plan.gatewayId || gid });
        }
        continue;
      }

      if (result.error) {
        // Skip reporting cached offline gateways as "errors" since the whole point
        // is to keep the UI snappy by avoiding known-dead bases.
        if (result.error === 'gateway_offline_cached') continue;
        const key = gid || gateway?.endpoint || `gateway-${plans.length}`;
        planErrors[key] = result.error;
      }
    }

    return { plans, gateways: deduped, errors: planErrors };
  }
  
  async function resolveGatewayBaseFromGatewayId(gatewayId) {
  const id = String(gatewayId || '').trim();
  if (!id) return null;

  const restBase = getRestBaseUrl();
  if (!restBase) return null;
  const base = trimSlash(restBase);

  try {
    const url = `${base}/lumen/gateway/v1/gateways/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const gateway =
      json?.gateway ??
      json?.Gateway ??
      json?.data?.gateway ??
      json;
    if (!gateway) return null;

    const meta = parseContractMetadata(
      gateway.metadata ?? gateway.meta ?? gateway.MetaData ?? gateway.info
    );
    const endpointRaw =
      meta.endpoint ??
      gateway.endpoint ??
      gateway.baseUrl ??
      gateway.url ??
      '';
    const ep = String(endpointRaw || '').trim();
    if (!ep) return null;

    const resolved = await resolveGatewayBaseFromEndpoint(ep);
    return resolved || ep;
  } catch {
    return null;
  }
}

  async function resolveGatewayBaseUrlFromPlans(profileId, fallbackBase) {
  const profile = String(profileId || '').trim();
  const fallback = String(fallbackBase || '').trim() || null;
  if (!profile) return fallback;

  const walletAddr = getWalletAddressForProfile(profile);
  if (!walletAddr) return fallback;

  const { subscriptions, error } = await listGatewaySubscriptions(
    walletAddr,
    {}
  );
  if (error && !subscriptions.length) {
    console.warn('[gateway] listGatewaySubscriptions error:', error);
  }
  if (!subscriptions.length) return fallback;

  const active = subscriptions.filter(
    (x) =>
      String(x.status || '').toLowerCase() !== 'contract_status_canceled'
  );
  const toUse = active.length ? active : subscriptions;
  const mapped = toUse
    .map(mapSubscriptionEntryToCurrent)
    .filter(Boolean);
  if (!mapped.length) return fallback;

  const plan = mapped[0];
  const endpoint = String(plan.endpoint || '').trim();
  let baseCandidate = null;

  if (endpoint) {
    baseCandidate =
      (await resolveGatewayBaseFromEndpoint(endpoint).catch(() => null)) ||
      endpoint;
  }

  if (!baseCandidate && plan.gatewayId) {
    baseCandidate = await resolveGatewayBaseFromGatewayId(
      plan.gatewayId
    ).catch(() => null);
  }

    if (!baseCandidate) baseCandidate = fallback;
    return baseCandidate ? trimSlash(baseCandidate) : null;
  }
  
  async function getPlansOverviewForProfile(profileId, opts) {
    const pid = String(profileId || '').trim();
    if (!pid) {
      return {
        plans: [],
        subscriptions: [],
        gateways: [],
        errors: { _all: 'missing_profileId' },
      };
    }
  
    const { plans, gateways, errors: planErrors } = await listAvailableGatewayPlans(
      opts && opts.limit,
      opts && opts.timeoutMs,
      { includePricing: opts?.includePricing !== false }
    );
  
    const walletAddr = getWalletAddressForProfile(pid);
    let subs = [];
    let subsError = null;
    if (walletAddr) {
      const res = await listGatewaySubscriptions(walletAddr, {});
      subs = res.subscriptions || [];
      subsError = res.error || null;
    } else {
      subsError = 'wallet_unavailable';
    }
  
    const errors = { ...(planErrors || {}) };
    if (subsError && !subs.length) {
      errors._subs = subsError;
    }
  
    return { plans, subscriptions: subs, gateways, errors };
  }

function defaultGatewayBase() {
  const env = process.env.LUMEN_GATEWAY_BASE;
  if (env && typeof env === 'string' && env.trim()) return env.trim().replace(/\/+$/, '');
  return 'http://127.0.0.1:8787';
}

function registerGatewayIpc() {
  ipcMain.handle('gateway:getWalletUsage', async (_e, input) => {
    try {
      const debug = gatewayHttpDebugEnabled();
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';

      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      const wallet = getWalletAddressForProfile(profileId);
      if (!wallet) return { ok: false, error: 'wallet_unavailable' };
      const mnemonic = loadMnemonic(profileId);

      if (debug) {
        console.log('[gateway] getWalletUsage', {
          profileId,
          baseHint: baseHint || null,
          baseUrl: trimSlash(baseUrl),
          wallet: maskWallet(wallet),
        });
      }

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/usage',
        method: 'POST',
        wallet,
        mnemonic,
        payload: null,
      });

      if (status < 200 || status >= 300) {
        if (debug) {
          console.warn('[gateway] getWalletUsage failed', {
            profileId,
            baseUrl: trimSlash(baseUrl),
            status,
            error: (data && data.error) || 'usage_failed',
          });
        }
        return { ok: false, status, error: (data && data.error) || 'usage_failed' };
      }

      if (debug) {
        console.log('[gateway] getWalletUsage ok', {
          profileId,
          baseUrl: trimSlash(baseUrl),
          status,
        });
      }
      return { ok: true, status, data };
    } catch (e) {
      if (gatewayHttpDebugEnabled()) {
        console.warn('[gateway] getWalletUsage threw', {
          error: String(e && e.message ? e.message : e),
        });
      }
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:getWalletPinnedCids', async (_e, input) => {
    try {
      const debug = gatewayHttpDebugEnabled();
      const profileId = String(input?.profileId || '').trim();
      const pageRaw = input?.page != null ? String(input.page) : '';
      if (!profileId) return { ok: false, error: 'missing_profileId' };

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';

      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      let page = parseInt(pageRaw, 10);
      if (!Number.isFinite(page) || page < 1) page = 1;

      const wallet = getWalletAddressForProfile(profileId);
      if (!wallet) return { ok: false, error: 'wallet_unavailable' };
      const mnemonic = loadMnemonic(profileId);

      if (debug) {
        console.log('[gateway] getWalletPinnedCids', {
          profileId,
          page,
          baseHint: baseHint || null,
          baseUrl: trimSlash(baseUrl),
          wallet: maskWallet(wallet),
        });
      }

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/cids',
        method: 'POST',
        wallet,
        mnemonic,
        payload: { page },
      });

      if (status < 200 || status >= 300) {
        if (debug) {
          console.warn('[gateway] getWalletPinnedCids failed', {
            profileId,
            baseUrl: trimSlash(baseUrl),
            status,
            error: (data && data.error) || 'wallet_cids_failed',
          });
        }
        return { ok: false, status, error: (data && data.error) || 'wallet_cids_failed' };
      }

      // Some gateway versions may return placeholder strings (e.g. "Unknown").
      // Filter them so UI doesn't try to treat them as real CIDs.
      try {
        const cidsRaw = Array.isArray(data?.cids) ? data.cids : null;
        if (cidsRaw) {
          const cids = cidsRaw
            .map((x) => String(x || '').trim())
            .filter((x) => x && x.toLowerCase() !== 'unknown');
          if (debug) {
            console.log('[gateway] getWalletPinnedCids ok', {
              profileId,
              baseUrl: trimSlash(baseUrl),
              status,
              cids: cids.length,
            });
          }
          return { ok: true, status, data: { ...data, cids } };
        }
      } catch {
        // ignore and return raw data
      }

      if (debug) {
        const count = Array.isArray(data?.cids) ? data.cids.length : null;
        console.log('[gateway] getWalletPinnedCids ok', {
          profileId,
          baseUrl: trimSlash(baseUrl),
          status,
          cids: count,
        });
      }
      return { ok: true, status, data };
    } catch (e) {
      if (gatewayHttpDebugEnabled()) {
        console.warn('[gateway] getWalletPinnedCids threw', {
          error: String(e && e.message ? e.message : e),
        });
      }
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:getBaseUrl', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';
      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      return { ok: true, baseUrl };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:checkAlive', async (_e, input) => {
    try {
      const endpoint =
        typeof input?.endpoint === 'string'
          ? String(input.endpoint).trim()
          : typeof input?.gatewayEndpoint === 'string'
          ? String(input.gatewayEndpoint).trim()
          : '';

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : endpoint;
      if (!baseHint) return { ok: false, error: 'missing_endpoint' };

      const timeoutMsRaw = input?.timeoutMs != null ? Number(input.timeoutMs) : 2500;
      const timeoutMs =
        Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
          ? Math.min(Math.floor(timeoutMsRaw), 30_000)
          : 2500;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const { baseUrl } = await resolveKyberKeyForGatewayBase(baseHint, {
          quiet: true,
          timeoutMs,
          signal: controller.signal,
        });
        return { ok: true, endpoint: endpoint || baseHint, baseUrl: trimSlash(baseUrl) };
      } finally {
        try { clearTimeout(t); } catch {}
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:cancelPinCid', async (evt) => {
    const wcId = String(evt?.sender?.id || '');
    const job = wcId ? ACTIVE_GATEWAY_PINS.get(wcId) : null;
    if (!job) return { ok: false, error: 'no_active_job' };
    try {
      job.abort?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'cancel_failed') };
    }
  });

  ipcMain.handle('gateway:pinCid', async (_e, input) => {
    try {
      const debug = gatewayHttpDebugEnabled();
      const wcId = String(_e?.sender?.id || '');
      if (wcId && ACTIVE_GATEWAY_PINS.has(wcId)) {
        return { ok: false, error: 'pin_in_progress' };
      }

      const controller = new AbortController();
      const abort = () => {
        try {
          controller.abort();
        } catch {}
      };
      if (wcId) ACTIVE_GATEWAY_PINS.set(wcId, { abort });

      const sendProgress = (() => {
        let lastAt = 0;
        let lastPct = -1;
        let lastSent = -1;
        return (payload) => {
          try {
            const stage = String(payload?.stage || '');
            const sent = typeof payload?.sentBytes === 'number' && Number.isFinite(payload.sentBytes) ? payload.sentBytes : null;
            const total = typeof payload?.totalBytes === 'number' && Number.isFinite(payload.totalBytes) ? payload.totalBytes : null;
            const pctRaw = payload?.percent;
            const pct =
              typeof pctRaw === 'number' && Number.isFinite(pctRaw)
                ? Math.max(0, Math.min(100, Math.round(pctRaw)))
                : null;

            const now = Date.now();
            const shouldEmit = stage === 'done' || stage === 'preflight' || stage === 'exporting' ||
              pct !== lastPct || sent !== lastSent || now - lastAt >= 120;
            if (!shouldEmit) return;
            lastAt = now;
            lastPct = pct == null ? -1 : pct;
            lastSent = sent == null ? -1 : sent;

            _e?.sender?.send?.('gateway:ingestProgress', {
              stage,
              percent: pct,
              sentBytes: sent,
              totalBytes: total,
            });
          } catch {}
        };
      })();

      const profileId = String(input?.profileId || '').trim();
      const cid = String(input?.cid || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!cid) return { ok: false, error: 'missing_cid' };

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';
      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      const wallet = getWalletAddressForProfile(profileId);
      if (!wallet) return { ok: false, error: 'wallet_unavailable' };
      const mnemonic = loadMnemonic(profileId);

      if (debug) {
        console.log('[gateway] pinCid start', {
          profileId,
          cid,
          baseHint: baseHint || null,
          baseUrl: trimSlash(baseUrl),
          wallet: maskWallet(wallet),
        });
      }

      // Preflight: check auth + plan (PQ-protected)
      sendProgress({ stage: 'preflight', percent: 0 });
      const preflight = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/usage',
        method: 'POST',
        wallet,
        mnemonic,
        payload: null,
        signal: controller.signal,
      });
      if (preflight.status < 200 || preflight.status >= 300) {
        return {
          ok: false,
          status: preflight.status,
          error: (preflight.data && preflight.data.error) || 'usage_failed',
        };
      }

      // Try to get total DAG size to help the gateway pre-check quotas
      let dagSize = null;
      try {
        const statRes = await fetch(
          `${ipfsApiBase()}/api/v0/dag/stat?arg=${encodeURIComponent(cid)}&enc=json`,
          { method: 'POST', signal: controller.signal }
        );
        if (statRes.ok) {
          const j = await statRes.json().catch(() => null);
          const s = Number(j?.Size ?? j?.size ?? j?.TotalSize);
          if (Number.isFinite(s) && s > 0) dagSize = s;
        }
      } catch {
        dagSize = null;
      }

      const planIdRaw = input?.planId ?? input?.plan_id ?? null;
      const planId = planIdRaw != null ? String(planIdRaw).trim() : '';

      const displayNameRaw = input?.displayName ?? input?.display_name ?? input?.name ?? null;
      const displayName =
        displayNameRaw != null ? String(displayNameRaw).trim() : '';
      const safeDisplayName =
        displayName && displayName.toLowerCase() !== 'unknown' ? displayName : null;

      if (debug) {
        console.log('[gateway] ingestInit', {
          profileId,
          cid,
          baseUrl: trimSlash(baseUrl),
          planId: planId || null,
          estBytes: dagSize,
          displayNameLen: safeDisplayName ? safeDisplayName.length : null,
        });
      }

      const init = await sendGatewayAuthPq({
        baseUrl,
        path: '/ingest/init',
        method: 'POST',
        wallet,
        mnemonic,
        payload: {
          planId: planId || null,
          estBytes: dagSize,
          displayName: safeDisplayName,
        },
        signal: controller.signal,
      });

      const uploadToken =
        init.status >= 200 &&
        init.status < 300 &&
        init.data &&
        typeof init.data === 'object' &&
        typeof init.data.upload_token === 'string'
          ? String(init.data.upload_token)
          : null;

      if (!uploadToken) {
        const details =
          init.data &&
          typeof init.data === 'object' &&
          typeof init.data.error === 'string'
            ? String(init.data.error)
            : 'ingest_init_failed';
        if (debug) {
          console.warn('[gateway] ingestInit failed', {
            profileId,
            cid,
            baseUrl: trimSlash(baseUrl),
            status: init.status,
            error: String(details || '').slice(0, 160),
          });
        }
        return { ok: false, status: init.status, error: details };
      }

      sendProgress({ stage: 'exporting', percent: 0 });
      const exportUrl = `${ipfsApiBase()}/api/v0/dag/export?arg=${encodeURIComponent(cid)}`;
      const exportRes = await fetch(exportUrl, { method: 'POST', signal: controller.signal });
      if (!exportRes.ok) {
        return { ok: false, status: exportRes.status, error: 'ipfs_dag_export_failed' };
      }
      if (!exportRes.body) {
        return { ok: false, status: exportRes.status, error: 'ipfs_dag_export_no_body' };
      }

      const totalBytes = (() => {
        try {
          const h = exportRes.headers?.get?.('content-length');
          const n = h ? Number(h) : NaN;
          if (Number.isFinite(n) && n > 0) return n;
        } catch {}
        if (typeof dagSize === 'number' && Number.isFinite(dagSize) && dagSize > 0) return dagSize;
        return null;
      })();

      let sentBytes = 0;
      const reader = exportRes.body.getReader();
      const uploadStream = new ReadableStream({
        async pull(streamController) {
          try {
            if (controller.signal.aborted) {
              streamController.error(new Error('cancelled'));
              return;
            }
            const { value, done } = await reader.read();
            if (done) {
              streamController.close();
              return;
            }
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || []);
            sentBytes += chunk.byteLength;
            const pct =
              totalBytes && totalBytes > 0
                ? Math.max(0, Math.min(99, Math.floor((sentBytes / totalBytes) * 100)))
                : null;
            sendProgress({ stage: 'uploading', sentBytes, totalBytes, percent: pct });
            streamController.enqueue(chunk);
          } catch (e) {
            streamController.error(e);
          }
        },
        cancel() {
          try {
            reader.cancel();
          } catch {}
        },
      });

      const ingestUrl = `${trimSlash(baseUrl)}/ingest/car?token=${encodeURIComponent(uploadToken)}`;
      const ingestStartedAt = Date.now();
      if (debug) {
        console.log('[gateway] ingestCar request', {
          cid,
          baseUrl: trimSlash(baseUrl),
          url: redactUrlForLog(ingestUrl),
        });
      }
      const upResp = await fetch(ingestUrl, {
        method: 'POST',
        body: uploadStream,
        // Required by Node fetch for streaming request bodies
        duplex: 'half',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!upResp.ok) {
        const txt = await upResp.text().catch(() => '');
        const details = txt?.slice?.(0, 240) || `HTTP ${upResp.status}`;
        if (debug) {
          console.warn('[gateway] ingestCar failed', {
            cid,
            baseUrl: trimSlash(baseUrl),
            url: redactUrlForLog(ingestUrl),
            status: upResp.status,
            ms: Date.now() - ingestStartedAt,
            details: String(details || '').slice(0, 160),
          });
        }
        return { ok: false, status: upResp.status, error: details };
      }

      const upText = await upResp.text().catch(() => '');
      if (debug) {
        let jobId = null;
        try {
          const j = upText ? JSON.parse(upText) : null;
          jobId = j?.meta?.jobId || j?.meta?.job_id || null;
        } catch {}
        console.log('[gateway] ingestCar ok', {
          cid,
          baseUrl: trimSlash(baseUrl),
          status: upResp.status,
          ms: Date.now() - ingestStartedAt,
          bytes: upText.length,
          jobId,
        });
      }
      sendProgress({ stage: 'done', percent: 100 });
      return { ok: true, cid, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const lower = msg.toLowerCase();
      if (gatewayHttpDebugEnabled()) {
        console.warn('[gateway] pinCid threw', {
          error: msg,
          name: String(e?.name || ''),
        });
      }
      if (
        lower.includes('abort') ||
        lower.includes('aborted') ||
        lower.includes('cancel') ||
        String(e?.name || '') === 'AbortError'
      ) {
        return { ok: false, error: 'cancelled' };
      }
      return { ok: false, error: msg };
    } finally {
      const wcId = String(_e?.sender?.id || '');
      if (wcId) ACTIVE_GATEWAY_PINS.delete(wcId);
    }
  });

  ipcMain.handle('gateway:unpinCid', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      const cid = String(input?.cid || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!cid) return { ok: false, error: 'missing_cid' };

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';
      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      const wallet = getWalletAddressForProfile(profileId);
      if (!wallet) return { ok: false, error: 'wallet_unavailable' };
      const mnemonic = loadMnemonic(profileId);

      console.log('[gateway] unpinCid', {
        profileId,
        baseUrl: trimSlash(baseUrl),
        cid,
      });

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/unpin',
        method: 'POST',
        wallet,
        mnemonic,
        payload: { cid },
      });

      if (status < 200 || status >= 300) {
        return { ok: false, status, error: (data && data.error) || 'unpin_failed' };
      }

      console.log('[gateway] unpinCid ok', { status, cid });
      return { ok: true, status, data, cid, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:renameCid', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      const cid = String(input?.cid || '').trim();
      const nameRaw = input?.displayName ?? input?.display_name ?? input?.name;
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!cid) return { ok: false, error: 'missing_cid' };
      if (nameRaw === undefined || nameRaw === null) return { ok: false, error: 'missing_displayName' };

      const displayName = typeof nameRaw === 'string' ? nameRaw : String(nameRaw);

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : '';
      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      const wallet = getWalletAddressForProfile(profileId);
      if (!wallet) return { ok: false, error: 'wallet_unavailable' };
      const mnemonic = loadMnemonic(profileId);

      console.log('[gateway] renameCid', {
        profileId,
        baseUrl: trimSlash(baseUrl),
        cid,
      });

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/cid/rename',
        method: 'POST',
        wallet,
        mnemonic,
        payload: { cid, displayName },
      });

      if (status < 200 || status >= 300) {
        return { ok: false, status, error: (data && data.error) || 'rename_failed' };
      }

      return { ok: true, status, data, cid, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:searchPq', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();

      const mode = typeof input?.mode === 'string' ? String(input.mode) : '';
      const type = typeof input?.type === 'string' ? String(input.type) : '';
      const allowEmptyQuery =
        String(type || '').trim().toLowerCase() === 'site' ||
        String(type || '').trim().toLowerCase() === 'image' ||
        String(mode || '').trim().toLowerCase() === 'sites' ||
        String(mode || '').trim().toLowerCase() === 'everything';

      const query = String(input?.query || '').trim();
      if (!query && !allowEmptyQuery) return { ok: false, error: 'missing_query' };

      const endpoint =
        typeof input?.endpoint === 'string'
          ? String(input.endpoint).trim()
          : typeof input?.gatewayEndpoint === 'string'
          ? String(input.gatewayEndpoint).trim()
          : '';

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : endpoint;

      const baseUrl = baseHint
        ? (await resolveGatewayBaseFromEndpoint(baseHint).catch(() => null)) || baseHint
        : await resolveGatewayBaseUrlFromPlans(profileId, defaultGatewayBase());
      if (!baseUrl) return { ok: false, error: 'missing_baseUrl' };

      const guestTtlMsEnv = Number(process.env.LUMEN_GUEST_PQ_TTL_MS || '');
      const guestTtlMs = Number.isFinite(guestTtlMsEnv) && guestTtlMsEnv > 0
        ? guestTtlMsEnv
        : 24 * 60 * 60 * 1000;
      const useGuest = !profileId || isGuestProfile(profileId);
      let wallet = null;
      let mnemonic = null;

       async function ensureGuestWallet() {
         const file = guestPqWalletFile();
         const now = Date.now();
         const current = readJson(file, null);
         const expiresAt = Number(current?.expiresAt ?? 0);
         const ks = current?.keystore ?? null;
         const addrRaw = current?.walletAddress ?? null;
         const shouldRotate = !expiresAt || !Number.isFinite(expiresAt) || expiresAt <= now;
         if (!shouldRotate && ks && addrRaw) {
           try {
             mnemonic = decryptMnemonicLocal(ks);
             wallet = String(addrRaw || '').trim();
           } catch {
             mnemonic = null;
             wallet = null;
           }
         }
         if (!mnemonic || !wallet || shouldRotate) {
           const mnemonicObj = Bip39.encode(randomBytes(32), EnglishMnemonic.wordlist);
           mnemonic = String(mnemonicObj);
           wallet = await deriveWalletAddressFromMnemonic(mnemonic, 'lmn');
           const createdAt = now;
           const next = {
             version: 1,
             createdAt,
             expiresAt: createdAt + guestTtlMs,
             walletAddress: wallet,
             keystore: encryptMnemonicLocal(mnemonic),
           };
           writeJson(file, next);
         }
       }

      if (useGuest) {
        await ensureGuestWallet();
      } else {
        wallet = getWalletAddressForProfile(profileId);
        if (!wallet) return { ok: false, error: 'wallet_unavailable' };
        try {
          mnemonic = loadMnemonic(profileId);
        } catch (e) {
          // Search shouldn't hard-fail if the user keystore is locked (password) or can't be decrypted.
          // Fall back to a short-lived guest wallet to keep search available.
          console.warn(
            '[gateway] searchPq using guest wallet fallback:',
            e && e.message ? e.message : e
          );
          await ensureGuestWallet();
        }
      }

      const lang =
        typeof input?.lang === 'string' && input.lang.trim()
          ? String(input.lang).trim()
          : 'en';
      const limitRaw = input?.limit != null ? Number(input.limit) : 10;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
      const offsetRaw = input?.offset != null ? Number(input.offset) : 0;
      const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
      const cursor = input?.cursor != null ? input.cursor : null;
      const rankAtRaw = input?.rankAt != null ? Number(input.rankAt) : null;
      const rankAt = Number.isFinite(rankAtRaw) && rankAtRaw > 0 ? Math.floor(rankAtRaw) : null;
      const timeoutMsRaw = input?.timeoutMs != null ? Number(input.timeoutMs) : 15_000;
      const timeoutMs =
        Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
          ? Math.min(timeoutMsRaw, 60_000)
          : 15_000;

      console.log('[gateway] searchPq', {
        profileId: profileId || 'guest',
        endpoint: endpoint || undefined,
        baseUrl: trimSlash(baseUrl),
        q: query,
        type: type || undefined,
        limit,
        offset,
        cursor: cursor
          ? {
              score: cursor?.score,
              id: cursor?.id,
              rankAt: cursor?.rankAt ?? cursor?.rank_at,
            }
          : undefined,
        rankAt: rankAt || undefined,
      });

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/pq/search',
        method: 'POST',
        wallet,
        mnemonic,
        timeoutMs,
        payload: {
          q: query,
          lang,
          limit,
          offset,
          cursor,
          rankAt,
          mode,
          type,
        },
      });

      if (status < 200 || status >= 300) {
        console.warn('[gateway] searchPq bad_status', {
          status,
          error: (data && data.error) || 'search_failed',
        });
        return {
          ok: false,
          status,
          error: (data && data.error) || 'search_failed',
        };
      }

      console.log('[gateway] searchPq ok', {
        status,
        hits: Array.isArray(data?.hits) ? data.hits.length : undefined,
        results: Array.isArray(data?.results) ? data.results.length : undefined,
        hasPrev: typeof data?.hasPrev === 'boolean' ? data.hasPrev : undefined,
        hasMore: typeof data?.hasMore === 'boolean' ? data.hasMore : undefined,
      });
      return { ok: true, status, data, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      const low = msg.toLowerCase();
      // Expected when a whitelisted gateway is offline or timing out.
      const expected =
        low.includes('kyber_pubkey_http_unavailable') ||
        low.includes('aborterror') ||
        low.includes('aborted') ||
        low.includes('fetch failed');
      if (!expected) {
        console.warn('[gateway] searchPq error', msg);
      }
      return { ok: false, error: msg };
    }
  });

  ipcMain.on('gateway:pingViewPq', (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return;
      if (isGuestProfile(profileId)) return;

      const cid = String(input?.cid || '').trim();
      if (!cid) return;

      const endpoint =
        typeof input?.endpoint === 'string'
          ? String(input.endpoint).trim()
          : typeof input?.gatewayEndpoint === 'string'
          ? String(input.gatewayEndpoint).trim()
          : '';

      const baseHint =
        typeof input?.baseUrl === 'string'
          ? String(input.baseUrl).trim()
          : endpoint;

      const timeoutMsRaw = input?.timeoutMs != null ? Number(input.timeoutMs) : 2500;
      const timeoutMs =
        Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
          ? Math.min(timeoutMsRaw, 10_000)
          : 2500;

      // Fire-and-forget: offload PQ crypto + HTTP to a worker so the main process stays responsive.
      setImmediate(() => {
        try {
          const wallet = getWalletAddressForProfile(profileId);
          if (!wallet) return;

          let mnemonic;
          try {
            mnemonic = loadMnemonic(profileId);
          } catch {
            return;
          }

          (async () => {
            try {
              let resolvedBase = null;
              if (baseHint) {
                resolvedBase =
                  (await resolveGatewayBaseFromEndpoint(baseHint, timeoutMs, { quiet: true }).catch(
                    () => null,
                  )) || baseHint;
              } else {
                resolvedBase = await resolveGatewayBaseUrlFromPlans(
                  profileId,
                  defaultGatewayBase(),
                ).catch(() => null);
              }

              let baseUrl = String(resolvedBase || '').trim();
              if (!baseUrl) return;
              if (!/^https?:\/\//i.test(baseUrl)) {
                // If it's not a DNS-resolved http(s) base, treat it as a raw host[:port] and default to http://.
                baseUrl = `http://${baseUrl}`;
              }
              baseUrl = trimSlash(baseUrl);

              if (viewPingWorker && typeof viewPingWorker.enqueueViewPing === 'function') {
                viewPingWorker.enqueueViewPing({ baseUrl, wallet, mnemonic, cid, timeoutMs });
                return;
              }

              void sendGatewayAuthPq({
                baseUrl,
                path: '/pq/view',
                method: 'POST',
                wallet,
                mnemonic,
                timeoutMs,
                payload: { cid },
              }).catch(() => {});
            } catch {
              // ignore
            }
          })();

        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  });

  ipcMain.handle('gateway:getPlansOverview', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      const opts = {
        limit: input?.limit,
        timeoutMs: input?.timeoutMs,
        includePricing: input?.includePricing,
      };
      const overview = await getPlansOverviewForProfile(profileId, opts);
      return { ok: true, ...overview };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:subscribePlan', async (_e, input) => {
    const startedAt = Date.now();
    const mark = (step, extra) => {
      try {
        console.log('[gateway] subscribePlan timing', {
          step,
          ms: Date.now() - startedAt,
          ...(extra || {})
        });
      } catch {}
    };
    try {
      mark('start');
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      const password = input?.password ? String(input.password) : null;

      const planInput = input?.plan || {};
      const gatewayIdRaw = input?.gatewayId ?? planInput.gatewayId ?? planInput.gateway_id;
      const gatewayIdStr = String(gatewayIdRaw ?? '').trim();
      const gatewayId = gatewayIdStr ? Number(gatewayIdStr) : NaN;

      const priceUlmn = Math.max(
        0,
        Number(input?.priceUlmn ?? planInput.priceUlmn ?? planInput.price_ulmn ?? 0)
      );
      const storageGb = Math.max(
        0,
        Number(
          input?.storageGbPerMonth ??
            planInput.storageGbPerMonth ??
            planInput.storage_gb_per_month ??
            planInput.storageGb ??
            0
        )
      );
      const networkGb = Math.max(
        0,
        Number(
          input?.networkGbPerMonth ??
            planInput.networkGbPerMonth ??
            planInput.network_gb_per_month ??
            planInput.networkGb ??
            0
        )
      );
      const monthsTotal = Math.max(
        1,
        Number(input?.months ?? planInput.monthsTotal ?? planInput.months_total ?? 1)
      );

      const planId = String(
        input?.planId ?? planInput.planId ?? planInput.plan_id ?? planInput.id ?? ''
      ).trim();
      if (!planId) return { ok: false, error: 'missing_planId' };
      if (!Number.isFinite(gatewayId)) return { ok: false, error: 'missing_gatewayId' };

      const walletAddr = getWalletAddressForProfile(profileId);
      if (!walletAddr) return { ok: false, error: 'wallet_unavailable' };

      const mnemonic = loadMnemonic(profileId);
      const bech32Prefix = walletAddr.startsWith('lmn') ? 'lmn' : 'lumen';

      const restBase = getRestBaseUrl();
      const rpcBase = getRpcBaseUrl();
      const endpoints = {
        rpc: rpcBase || undefined,
        rest: restBase || rpcBase || undefined,
        rpcEndpoint: rpcBase || undefined,
        restEndpoint: restBase || rpcBase || undefined,
      };

      const bridgeMod = await loadBridge();
      if (!bridgeMod || !bridgeMod.walletFromMnemonic || !bridgeMod.LumenSigningClient) {
        return { ok: false, error: 'bridge_unavailable' };
      }

      mark('walletFromMnemonic.start');
      const signer = await bridgeMod.walletFromMnemonic(mnemonic, bech32Prefix);
      mark('walletFromMnemonic.done');
      const chainId =
        input?.chainId || 'lumen';

      mark('connectWithSigner.start', { rpc: endpoints.rpcEndpoint, rest: endpoints.restEndpoint });
      const client = await bridgeMod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        chainId,
        { pqc: { homeDir: resolvePqcHome() } }
      ).catch((err) => {
        console.log(err)
        return null
      });
      if (!client || !client.signAndBroadcast) {
        console.log(client)
        return { ok: false, error: 'client_not_available' };
      }
      mark('connectWithSigner.done');

      // Temporarily decrypt PQC keys if password-protected
      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      if (arePqcKeysEncrypted()) {
        if (!effectivePassword) {
          return { ok: false, error: 'password_required' };
        }
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) {
          return { ok: false, error: 'invalid_password' };
        }
      }

      try {
        const metadata = JSON.stringify({
          kind: 'plan',
          planId,
          gatewayId,
          planPrice: priceUlmn,
          monthsTotal,
          createdAt: Date.now(),
        });

        const gatewayMod = client.gateways?.();
        let msg = null;
        if (gatewayMod?.msgCreateContract) {
          msg = await gatewayMod.msgCreateContract(walletAddr, {
            gatewayId,
            priceUlmn,
            storageGbPerMonth: storageGb,
            networkGbPerMonth: networkGb,
            monthsTotal,
            metadata,
          });
        }
        if (!msg) {
          msg = {
            typeUrl: '/lumen.gateway.v1.MsgCreateContract',
            value: {
              client: walletAddr,
              gatewayId,
              priceUlmn,
              storageGbPerMonth: storageGb,
              networkGbPerMonth: networkGb,
              monthsTotal,
              metadata,
            },
          };
        }

        const memo = String(input?.memo || 'gateway:plan:subscribe');

        const fee = zeroFee();
        console.log('[gateway] subscribePlan broadcast', {
          planId,
          gatewayId,
          fee,
          typeUrl: msg?.typeUrl,
        });

        mark('broadcast.start', { typeUrl: msg?.typeUrl, planId, gatewayId });
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod,
          client,
          profileId,
          address: walletAddr,
          msgs: [msg],
          fee,
          memo,
          label: 'gateway_subscribePlan',
        });
        const txhash = String(res?.transactionHash || res?.txhash || res?.hash || '');
        mark('broadcast.ok', { txhash });

        return { ok: true, txhash, planId, gatewayId };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      mark('error', { error: String(e && e.message ? e.message : e) });
      const unconfirmable = describeBroadcastFailure(e);
      if (unconfirmable) return unconfirmable;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  /**
   * Closes a gateway contract on chain (`MsgCancelContract`).
   *
   * The chain refunds whole months that were never started; a plan whose paid
   * period has already run out therefore refunds nothing, and cancelling it is
   * purely a way to stop it showing up as a subscription.
   */
  ipcMain.handle('gateway:cancelContract', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (isGuestProfile(profileId)) return { ok: false, error: 'guest_profile' };

      const contractIdRaw = input?.contractId ?? input?.id;
      const contractId = Number(String(contractIdRaw ?? '').trim());
      if (!Number.isFinite(contractId) || contractId < 0) {
        return { ok: false, error: 'missing_contractId' };
      }

      const walletAddr = getWalletAddressForProfile(profileId);
      if (!walletAddr) return { ok: false, error: 'wallet_unavailable' };

      const mnemonic = loadMnemonic(profileId);
      const bech32Prefix = walletAddr.startsWith('lmn') ? 'lmn' : 'lumen';

      const restBase = getRestBaseUrl();
      const rpcBase = getRpcBaseUrl();
      const endpoints = {
        rpc: rpcBase || undefined,
        rest: restBase || rpcBase || undefined,
        rpcEndpoint: rpcBase || undefined,
        restEndpoint: restBase || rpcBase || undefined,
      };

      const bridgeMod = await loadBridge();
      if (!bridgeMod || !bridgeMod.walletFromMnemonic || !bridgeMod.LumenSigningClient) {
        return { ok: false, error: 'bridge_unavailable' };
      }

      const signer = await bridgeMod.walletFromMnemonic(mnemonic, bech32Prefix);
      const chainId = input?.chainId || 'lumen';

      const client = await bridgeMod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        chainId,
        { pqc: { homeDir: resolvePqcHome() } }
      ).catch(() => null);
      if (!client || !client.signAndBroadcast) {
        return { ok: false, error: 'client_not_available' };
      }

      let cleanupPqc = null;
      const effectivePassword = input?.password ? String(input.password) : getSessionPassword();
      if (arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const gatewayMod = client.gateways?.();
        let msg = null;
        if (gatewayMod?.msgCancelContract) {
          // The id itself, not a payload object - unlike msgCreateContract next
          // door. The SDK runs it through Number(), so an object here becomes
          // NaN and surfaces as "NaN cannot be converted to a BigInt" from deep
          // inside protobuf encoding.
          msg = await gatewayMod.msgCancelContract(walletAddr, contractId);
        }
        if (!msg) {
          msg = {
            typeUrl: '/lumen.gateway.v1.MsgCancelContract',
            value: { client: walletAddr, contractId },
          };
        }

        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod,
          client,
          profileId,
          address: walletAddr,
          msgs: [msg],
          fee: zeroFee(),
          memo: String(input?.memo || 'gateway:plan:cancel'),
          label: 'gateway_cancelContract',
        });
        const txhash = String(res?.transactionHash || res?.txhash || res?.hash || '');
        return { ok: true, txhash, contractId };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const unconfirmable = describeBroadcastFailure(e);
      if (unconfirmable) return unconfirmable;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:listGateways', async (_e, input) => {
    try {
      const lim = Math.min(Math.max(Number(input?.limit || 200), 1), 1000);
      const ms = Math.max(500, Number(input?.timeoutMs || 8000));
      const ignoreWhitelist = input?.ignoreWhitelist !== false;
      const { gateways, error } = await fetchGatewaysFromRest(lim, ms, { ignoreWhitelist });
      if (!gateways.length && error) return { ok: false, error };
      return { ok: true, gateways, total: gateways.length };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:getParams', async () => {
    try {
      const restBase = getRestBaseUrl();
      if (!restBase) return { ok: false, error: 'rest_base_missing' };

      const url = new URL('/lumen/gateway/v1/params', trimSlash(restBase));
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(url.toString(), { method: 'GET', signal: controller.signal });
      } finally {
        try { clearTimeout(t); } catch {}
      }

      if (!res.ok) {
        const text = (await res.text().catch(() => '')).trim();
        const statusLabel = res.status ? `HTTP ${res.status}` : 'HTTP error';
        const msg = text ? `${statusLabel}: ${text.slice(0, 180)}` : statusLabel;
        return { ok: false, error: msg };
      }

      const json = await res.json().catch(() => null);
      const params = json?.params || json?.data?.params || json?.data || json;
      return { ok: true, params };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:registerGateway', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (isGuestProfile(profileId)) return { ok: false, error: 'guest_profile' };

      const walletAddr = getWalletAddressForProfile(profileId);
      if (!walletAddr) return { ok: false, error: 'wallet_unavailable' };

      const endpoint = normalizeGatewayEndpoint(input?.endpoint);
      if (!endpoint) return { ok: false, error: 'missing_endpoint' };
      const payout = String(input?.payout || walletAddr).trim();
      const regions = sanitizeGatewayRegions(input?.regions);
      const metadataExtras = typeof input?.metadata === 'object' ? input.metadata : undefined;
      const metadata = buildGatewayMetadata({
        endpoint,
        regions: regions.length ? regions : undefined,
        extras: metadataExtras,
      });

      const mnemonic = loadMnemonic(profileId);
      const bech32Prefix = walletAddr.startsWith('lmn') ? 'lmn' : 'lumen';

      const restBase = getRestBaseUrl();
      const rpcBase = getRpcBaseUrl();
      const endpoints = {
        rpc: rpcBase || undefined,
        rest: restBase || undefined,
        rpcEndpoint: rpcBase || undefined,
        restEndpoint: restBase || undefined,
      };
      if (!endpoints.rpcEndpoint && !endpoints.restEndpoint) {
        return { ok: false, error: 'endpoints_unavailable' };
      }

      const bridgeMod = await loadBridge();
      if (!bridgeMod || !bridgeMod.walletFromMnemonic || !bridgeMod.LumenSigningClient) {
        return { ok: false, error: 'bridge_unavailable' };
      }

      const signer = await bridgeMod.walletFromMnemonic(mnemonic, bech32Prefix);
      const chainId = input?.chainId || 'lumen';

      const client = await bridgeMod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        chainId,
        { pqc: { homeDir: resolvePqcHome() } }
      ).catch(() => null);
      if (!client || !client.signAndBroadcast) {
        return { ok: false, error: 'client_not_available' };
      }

      let cleanupPqc = null;
      const effectivePassword = input?.password ? String(input.password) : getSessionPassword();
      if (arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const gatewayMod = client.gateways?.();
        let msg = null;
        if (gatewayMod?.msgRegisterGateway) {
          msg = await gatewayMod.msgRegisterGateway(walletAddr, { payout, metadata });
        }
        if (!msg) {
          msg = {
            typeUrl: '/lumen.gateway.v1.MsgRegisterGateway',
            value: { operator: walletAddr, payout, metadata },
          };
        }

        const fee = zeroFee();
        const memo = String(input?.memo || 'gateway:register');

        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod,
          client,
          profileId,
          address: walletAddr,
          msgs: [msg],
          fee,
          memo,
          label: 'gateway_registerGateway',
        });
        const txhash = String(res?.transactionHash || res?.txhash || res?.hash || '');
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const unconfirmable = describeBroadcastFailure(e);
      if (unconfirmable) return unconfirmable;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:updateGateway', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (isGuestProfile(profileId)) return { ok: false, error: 'guest_profile' };

      const walletAddr = getWalletAddressForProfile(profileId);
      if (!walletAddr) return { ok: false, error: 'wallet_unavailable' };

      const gatewayIdRaw = input?.gatewayId ?? input?.id;
      const gatewayIdNum = Number(gatewayIdRaw);
      if (!gatewayIdNum) return { ok: false, error: 'missing_gatewayId' };

      const payout = String(input?.payout || '').trim();
      const regionsInputProvided = Array.isArray(input?.regions) || typeof input?.regions === 'string';
      const regions = sanitizeGatewayRegions(input?.regions);
      const endpointRaw = String(input?.endpoint || '').trim();
      const endpoint = endpointRaw ? normalizeGatewayEndpoint(endpointRaw) : '';
      const activeToggleExplicit = typeof input?.active === 'boolean';
      const metadataExtras = typeof input?.metadata === 'object' ? input.metadata : undefined;
      const metadata = buildGatewayMetadata({
        endpoint,
        regions: regionsInputProvided ? regions : undefined,
        extras: metadataExtras,
      });

      if (!payout && !regionsInputProvided && !endpoint && !activeToggleExplicit && !metadataExtras) {
        return { ok: false, error: 'nothing_to_update' };
      }

      const mnemonic = loadMnemonic(profileId);
      const bech32Prefix = walletAddr.startsWith('lmn') ? 'lmn' : 'lumen';

      const restBase = getRestBaseUrl();
      const rpcBase = getRpcBaseUrl();
      const endpoints = {
        rpc: rpcBase || undefined,
        rest: restBase || undefined,
        rpcEndpoint: rpcBase || undefined,
        restEndpoint: restBase || undefined,
      };
      if (!endpoints.rpcEndpoint && !endpoints.restEndpoint) {
        return { ok: false, error: 'endpoints_unavailable' };
      }

      const bridgeMod = await loadBridge();
      if (!bridgeMod || !bridgeMod.walletFromMnemonic || !bridgeMod.LumenSigningClient) {
        return { ok: false, error: 'bridge_unavailable' };
      }

      const signer = await bridgeMod.walletFromMnemonic(mnemonic, bech32Prefix);
      const chainId = input?.chainId || 'lumen';

      const client = await bridgeMod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        chainId,
        { pqc: { homeDir: resolvePqcHome() } }
      ).catch(() => null);
      if (!client || !client.signAndBroadcast) {
        return { ok: false, error: 'client_not_available' };
      }

      let cleanupPqc = null;
      const effectivePassword = input?.password ? String(input.password) : getSessionPassword();
      if (arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const payload = { operator: walletAddr, gatewayId: gatewayIdNum, id: gatewayIdNum };
        if (payout) payload.payout = payout;
        if (metadata) payload.metadata = metadata;
        if (activeToggleExplicit) payload.active = !!input.active;

        const gatewayMod = client.gateways?.();
        let msg = null;
        if (gatewayMod?.msgUpdateGateway) {
          msg = await gatewayMod.msgUpdateGateway(walletAddr, payload);
        }
        if (!msg) {
          msg = { typeUrl: '/lumen.gateway.v1.MsgUpdateGateway', value: payload };
        }

        const fee = zeroFee();
        const memo = String(input?.memo || 'gateway:update');

        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod,
          client,
          profileId,
          address: walletAddr,
          msgs: [msg],
          fee,
          memo,
          label: 'gateway_updateGateway',
        });
        const txhash = String(res?.transactionHash || res?.txhash || res?.hash || '');
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const unconfirmable = describeBroadcastFailure(e);
      if (unconfirmable) return unconfirmable;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

module.exports = {
  registerGatewayIpc,
  loadProfilesFile,
  loadMnemonic,
  getWalletAddressForProfile,
};
