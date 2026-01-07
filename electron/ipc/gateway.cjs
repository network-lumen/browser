const { ipcMain } = require('electron');
const { readFileSync, existsSync } = require('fs');
const path = require('path');
const { createHash, randomBytes, hkdfSync, createCipheriv, createDecipheriv } = require('crypto');
const { userDataPath, readJson, writeJson } = require('../utils/fs.cjs');
const { decryptMnemonicLocal, encryptMnemonicLocal } = require('../utils/crypto.cjs');
const { runWithRpcRetry } = require('../utils/tx.cjs');
let pqcWorker = null;
try {
  pqcWorker = require('../utils/pqc-worker.cjs');
} catch {
  pqcWorker = null;
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

let bridge = null;
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

async function fetchOnChainPqcStatus(client, address) {
  try {
    const resp = await client.pqc().account(address);
    const info = (resp && (resp.account || resp)) || null;
    const pubKey =
      info && (info.pubKeyHash || info.pub_key_hash || info.pubKey || info.pub_key);
    const scheme = (info && (info.scheme || info.schemeName)) || null;
    const pubKeyHash = pubKey ? String(pubKey) : '';
    return { linked: !!(pubKey && (pubKey.length || 0) > 0), scheme, pubKeyHash };
  } catch {
    return { linked: false, scheme: null, pubKeyHash: '' };
  }
}

function normalizeHashString(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (/^[0-9a-f]+$/i.test(raw) && raw.length >= 32) return lower;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length > 0) return buf.toString('hex').toLowerCase();
  } catch {
    // ignore
  }
  return lower;
}

function resolvePqcHome() {
  if (process.env.LUMEN_PQC_HOME) return process.env.LUMEN_PQC_HOME;
  return userDataPath();
}

function hashHex(data) {
  return createHash('sha256').update(Buffer.from(data)).digest('hex');
}

async function loadPqcParams(client) {
  try {
    const resp = await client.pqc().params();
    return (resp && (resp.params || resp)) || {};
  } catch {
    return {};
  }
}

async function assertMinBalance(client, address, coin) {
  if (!coin || !coin.denom || !coin.amount) return;
  if (typeof client.getBalance !== 'function') return;
  const bal = await client.getBalance(address, coin.denom);
  const current = BigInt(bal && bal.amount ? bal.amount : '0');
  const required = BigInt(coin.amount);
  if (current < required) {
    throw new Error(
      `PQC link requires at least ${coin.amount}${coin.denom} (balance ${bal && bal.amount ? bal.amount : '0'}${coin.denom})`
    );
  }
}

async function ensureLocalPqcKey(bridgeMod, client, profileId, address) {
  if (!address) return undefined;
  const pqc = bridgeMod && bridgeMod.pqc;
  if (!pqc || !pqc.PqcKeyStore) throw new Error('PQC helpers unavailable');

  const createInWorker =
    pqcWorker && typeof pqcWorker.createPqcKeyPairInWorker === 'function'
      ? pqcWorker.createPqcKeyPairInWorker
      : null;

  const store = await pqc.PqcKeyStore.open(resolvePqcHome());
  const existingLink = store.getLink(address);
  const normalize = (rec) =>
    !rec
      ? rec
      : {
          name: rec.name,
          scheme: rec.scheme || rec.Scheme,
          publicKey: rec.publicKey || rec.public_key,
          privateKey: rec.privateKey || rec.private_key,
          createdAt: rec.createdAt || rec.created_at,
        };

  let keyName = existingLink;
  let record = keyName ? normalize(store.getKey(keyName)) : undefined;

  const onChain = await fetchOnChainPqcStatus(client, address);
  const preferred = `profile:${profileId}`;
  const preferredRecord = normalize(store.getKey(preferred));
  const allKeys = store.listKeys().map(normalize);

  const findByHash = (target) => {
    const t = normalizeHashString(target);
    for (const k of allKeys) {
      try {
        if (hashHex(k.publicKey).toLowerCase() === t) return k;
      } catch {}
    }
    return null;
  };

  if (record && onChain.linked && onChain.pubKeyHash) {
    try {
      const localHash = hashHex(record.publicKey).toLowerCase();
      const targetHash = normalizeHashString(onChain.pubKeyHash);
      if (localHash !== targetHash) {
        const match = findByHash(targetHash);
        if (match) {
          keyName = match.name;
          record = match;
          await store.linkAddress(address, keyName);
        }
      }
    } catch {}
  }

  if (!record) {
    if (onChain.linked && onChain.pubKeyHash) {
      const match = findByHash(onChain.pubKeyHash);
      if (match) {
        keyName = match.name;
        record = match;
      }
    }
    if (!record && onChain.linked && !existingLink) {
      if (preferredRecord) {
        keyName = preferred;
        record = preferredRecord;
      } else if (allKeys.length === 1) {
        keyName = allKeys[0].name;
        record = allKeys[0];
      } else if (allKeys.length > 1) {
        keyName = allKeys[0].name;
        record = allKeys[0];
      }
      if (!record) {
        throw new Error(
          'Signer already has a PQC key on-chain but no local PQC key is available. Import the dual-signer backup (pqc_keys + dual-signer.json).'
        );
      }
      await store.linkAddress(address, keyName);
    }

    if (!record) {
      keyName = preferred;
      record = store.getKey(keyName);
      if (!record) {
        const pair = createInWorker ? await createInWorker() : await pqc.createKeyPair();
        record = {
          name: keyName,
          scheme: pqc.DEFAULT_SCHEME || 'dilithium3',
          publicKey: pair.publicKey,
          privateKey: pair.privateKey,
          createdAt: new Date()
        };
        await store.saveKey(record);
      } else {
        record = normalize(record);
      }
      await store.linkAddress(address, keyName);
    }
  }

  if (onChain.linked && onChain.pubKeyHash && record) {
    const localHash = hashHex(record.publicKey).toLowerCase();
    const onChainHash = normalizeHashString(onChain.pubKeyHash);
    if (localHash !== onChainHash) {
      console.warn('[pqc-local] hash mismatch', {
        address,
        keyName,
        localHash,
        onChainHash,
        keys: allKeys.map((k) => ({ name: k && k.name, hash: hashHex(k.publicKey) }))
      });
      throw new Error(
        'PQC key mismatch: local key does not match on-chain hash. Import the correct PQC backup.'
      );
    }
  }

  try {
    if (!store.getLink(address)) {
      await store.linkAddress(address, keyName);
    }
  } catch {}

  return { keyName, record, store };
}

async function ensureOnChainPqcLink(bridgeMod, client, address, record) {
  if (!address || !client || !record) return;
  const status = await fetchOnChainPqcStatus(client, address);
  if (status.linked) return;

  const pqcModule = typeof client.pqc === 'function' ? client.pqc() : null;
  if (!pqcModule || !pqcModule.msgLinkAccountPqc) {
    throw new Error('PQC module unavailable on client');
  }

  const params = await loadPqcParams(client);
  const minBalance = params.minBalanceForLink || params.min_balance_for_link;
  if (minBalance) {
    await assertMinBalance(client, address, minBalance);
  }

  const powBitsRaw = params.powDifficultyBits || params.pow_difficulty_bits || 0;
  const powBits = Number(powBitsRaw) || 0;
  let powNonce = new Uint8Array([0]);
  const computePowInWorker =
    pqcWorker && typeof pqcWorker.computePowNonceInWorker === 'function'
      ? pqcWorker.computePowNonceInWorker
      : null;
  if (powBits > 0) {
    if (computePowInWorker) {
      powNonce = await computePowInWorker(record.publicKey, powBits);
    } else if (bridgeMod && bridgeMod.pqc && typeof bridgeMod.pqc.computePowNonce === 'function') {
      powNonce = bridgeMod.pqc.computePowNonce(record.publicKey, powBits);
    }
  }

  const zeroFee =
    (bridgeMod.utils && bridgeMod.utils.gas && bridgeMod.utils.gas.zeroFee) ||
    (bridgeMod.utils && bridgeMod.utils.zeroFee) ||
    (() => ({ amount: [], gas: '250000' }));

  const msg = pqcModule.msgLinkAccountPqc(address, {
    scheme: record.scheme,
    pubKey: record.publicKey,
    powNonce,
  });

  const res = await runWithRpcRetry(
    () => client.signAndBroadcast(address, [msg], zeroFee()),
    'pqc_link_gateway'
  );
  if (res.code !== 0) {
    throw new Error(res.rawLog || `broadcast failed (code ${res.code})`);
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

function loadMnemonic(profileId) {
  const file = keystoreFile(profileId);
  const raw = existsSync(file) ? readJson(file, null) : null;
  if (!raw) throw new Error(`No keystore for profileId=${profileId}`);
  const mnemonic = decryptMnemonicLocal(raw);
  if (!mnemonic) throw new Error('Failed to decrypt keystore');
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

function sha256Utf8(data) {
  return new Sha256(new TextEncoder().encode(String(data ?? ''))).digest();
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

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

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

function loadPeersFromFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const peers = [];
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parsePeerLine(line);
      if (parsed) peers.push(parsed);
    }
    return peers;
  } catch {
    return [];
  }
}

function getRestBaseUrl() {
  const appPath = require('electron').app.getAppPath();
  const candidates = [
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'),
    path.join(process.cwd(), 'resources', 'peers.txt'),
  ];

  let peersFile = null;
  for (const file of candidates) {
    try {
      if (existsSync(file)) {
        peersFile = file;
        break;
      }
    } catch {}
  }
  if (!peersFile) return null;

  const peers = loadPeersFromFile(peersFile);
  if (!peers.length) return null;

  const first = peers[0];
  if (!first) return null;

  let rest = first.rest || '';
  const ensureHttp = (u) => {
    const trimmed = String(u || '').replace(/\/+$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  };

  if (rest) {
    return ensureHttp(rest);
  }

  if (!first.rpc) return null;
  const rpcBase = ensureHttp(first.rpc);
  try {
    const u = new URL(rpcBase);
    const port = Number(u.port || '');
    if (port === 26657) {
      u.port = '1317';
    }
    const derived = trimSlash(u.toString());
    return derived;
  } catch {
    return rpcBase;
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
    if (!quiet) console.log('[gateway] resolveGatewayBaseFromEndpoint http', ep, '->', out);
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

  try {
    const rest = trimSlash(restBase);
    const url = `${rest}/lumen/dns/v1/domain/${encodeURIComponent(domain)}`;
    if (!quiet) console.log('[gateway] resolveGatewayBaseFromEndpoint dns query', domain, 'via', rest);
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
      if (!quiet) console.log('[gateway] resolveGatewayBaseFromEndpoint resolved', ep, '->', out);
      return out;
  } catch {
    return null;
  }
}

async function resolveKyberKeyForGatewayBase(baseUrlHint) {
  const initial = String(baseUrlHint || '').trim();
  const resolvedBase = await resolveGatewayBaseFromEndpoint(initial);
  const trimmedBase = resolvedBase ? resolvedBase : String(initial).replace(/\/+$/, '');
  if (!trimmedBase) throw new Error('kyber_pubkey_http_unavailable');

  console.log('[gateway] resolveKyberKeyForGatewayBase base', {
    hint: initial,
    resolved: resolvedBase,
    final: trimmedBase,
  });

  // In contributor/browser, gateway endpoints come directly from on-chain DNS records
  // and already represent the final HTTP base URL. We just hit /pq/pub on that base.
  let httpPubB64 = null;
  let httpKeyId = 'gw-2025-01';
  let httpAlg = 'kyber768';
  try {
    const url = `${trimmedBase}/pq/pub`;
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
      if (data && typeof data.key_id === 'string' && data.key_id.trim()) httpKeyId = data.key_id.trim();
      if (data && typeof data.alg === 'string' && data.alg.trim()) httpAlg = data.alg.trim();
    }
  } catch (e) {
    console.warn('[gateway] resolveKyberKeyForGatewayBase http error:', e && e.message ? e.message : e);
  }
  if (!httpPubB64) throw new Error('kyber_pubkey_http_unavailable');

  const pubKey = Buffer.from(httpPubB64, 'base64');

  return {
    alg: httpAlg || 'kyber768',
    keyId: httpKeyId || 'gw-2025-01',
    pubKey,
  };
}

async function sendGatewayAuthPq(params) {
  const base = String(params.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('gateway_base_missing');

  const { alg, keyId, pubKey } = await resolveKyberKeyForGatewayBase(base);
  if (alg !== 'kyber768') throw new Error('unsupported_kyber_alg');

  const payload = params.payload ?? null;
  if (payload !== null && typeof payload !== 'object') {
    throw new Error('invalid_payload');
  }

  const canonicalPayload = JSON.stringify(payload ?? null);
  const payloadHashHex = createHash('sha256').update(canonicalPayload).digest('hex');

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
  const res = await fetch(url, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Lumen-PQ': 'v1',
      'X-Lumen-KEM': 'kyber768',
      'X-Lumen-KeyId': keyId,
    },
    body,
  });

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

  return { status, data };
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
    return { subscriptions: list, error: null };
  } catch (e) {
    return {
      subscriptions: [],
      error: String(e && e.message ? e.message : e),
    };
  }
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
    const hasScheme = /^[a-z]+:\/\//i.test(raw);
    const url = new URL(hasScheme ? raw : `https://${raw}`);
    const host = url.hostname || raw;
    return host.replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .trim()
      .toLowerCase();
  }
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

    const whitelistIds = new Set(loadGatewaysWhitelistIds().map((x) => String(x).trim()).filter(Boolean));
    if (whitelistIds.size) {
      list = list.filter((g) => whitelistIds.has(String(g?.id ?? g?.gatewayId ?? '').trim()));
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
    let res = await getJsonWithTimeout(urlBase + '/pricing');
    if (!res.ok) {
      console.warn('[gateway] pricing /pricing failed, fallback to /price', {
        status: res.status,
      });
      res = await getJsonWithTimeout(urlBase + '/price');
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

  async function listAvailableGatewayPlans(limit, timeoutMs) {
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

    const pricingTimeout = Math.max(800, Math.min(ms, 6000));
    const plans = [];
    const planErrors = {};

    for (const gateway of deduped) {
      const gid = String(gateway?.id || '');
      const result = await fetchPlansForGateway(gateway, pricingTimeout);

      if (result.plans.length) {
        for (const plan of result.plans) {
          plans.push({ ...plan, gatewayId: plan.gatewayId || gid });
        }
      } else if (result.error) {
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
      opts && opts.timeoutMs
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

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/usage',
        method: 'POST',
        wallet,
        mnemonic,
        payload: null,
      });

      if (status < 200 || status >= 300) {
        return { ok: false, status, error: (data && data.error) || 'usage_failed' };
      }

      return { ok: true, status, data };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:getWalletPinnedCids', async (_e, input) => {
    try {
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

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/cids',
        method: 'POST',
        wallet,
        mnemonic,
        payload: { page },
      });

      if (status < 200 || status >= 300) {
        return { ok: false, status, error: (data && data.error) || 'wallet_cids_failed' };
      }

      return { ok: true, status, data };
    } catch (e) {
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

  ipcMain.handle('gateway:pinCid', async (_e, input) => {
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

      // Preflight: check auth + plan (PQ-protected)
      const preflight = await sendGatewayAuthPq({
        baseUrl,
        path: '/wallet/usage',
        method: 'POST',
        wallet,
        mnemonic,
        payload: null,
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
          `http://127.0.0.1:5001/api/v0/dag/stat?arg=${encodeURIComponent(cid)}&enc=json`,
          { method: 'POST' }
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

      const init = await sendGatewayAuthPq({
        baseUrl,
        path: '/ingest/init',
        method: 'POST',
        wallet,
        mnemonic,
        payload: {
          planId: planId || null,
          estBytes: dagSize,
        },
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
        return { ok: false, status: init.status, error: details };
      }

      const exportUrl = `http://127.0.0.1:5001/api/v0/dag/export?arg=${encodeURIComponent(cid)}`;
      const exportRes = await fetch(exportUrl, { method: 'POST' });
      if (!exportRes.ok) {
        return { ok: false, status: exportRes.status, error: 'ipfs_dag_export_failed' };
      }

      const ingestUrl = `${trimSlash(baseUrl)}/ingest/car?token=${encodeURIComponent(uploadToken)}`;
      const upResp = await fetch(ingestUrl, {
        method: 'POST',
        body: exportRes.body,
        // Required by Node fetch for streaming request bodies
        duplex: 'half',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!upResp.ok) {
        const txt = await upResp.text().catch(() => '');
        const details = txt?.slice?.(0, 240) || `HTTP ${upResp.status}`;
        return { ok: false, status: upResp.status, error: details };
      }

      await upResp.text().catch(() => '');
      return { ok: true, cid, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
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

  ipcMain.handle('gateway:searchPq', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      const query = String(input?.query || '').trim();
      if (!query) return { ok: false, error: 'missing_query' };

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
      if (useGuest) {
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
      } else {
        wallet = getWalletAddressForProfile(profileId);
        if (!wallet) return { ok: false, error: 'wallet_unavailable' };
        mnemonic = loadMnemonic(profileId);
      }

      const lang =
        typeof input?.lang === 'string' && input.lang.trim()
          ? String(input.lang).trim()
          : 'en';
      const limitRaw = input?.limit != null ? Number(input.limit) : 10;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;
      const offsetRaw = input?.offset != null ? Number(input.offset) : 0;
      const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
      const mode = typeof input?.mode === 'string' ? String(input.mode) : '';
      const type = typeof input?.type === 'string' ? String(input.type) : '';

      console.log('[gateway] searchPq', {
        profileId: profileId || 'guest',
        endpoint: endpoint || undefined,
        baseUrl: trimSlash(baseUrl),
        q: query,
        type: type || undefined,
        limit,
        offset,
      });

      const { status, data } = await sendGatewayAuthPq({
        baseUrl,
        path: '/pq/search',
        method: 'POST',
        wallet,
        mnemonic,
        payload: {
          q: query,
          lang,
          limit,
          offset,
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
      });
      return { ok: true, status, data, baseUrl: trimSlash(baseUrl) };
    } catch (e) {
      console.warn('[gateway] searchPq error', e && e.message ? e.message : e);
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('gateway:getPlansOverview', async (_e, input) => {
    try {
      const profileId = String(input?.profileId || '').trim();
      const opts = {
        limit: input?.limit,
        timeoutMs: input?.timeoutMs,
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
      const rpcBase = restBase ? restBase.replace(':1317', ':26657') : null;
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
      ).catch(() => null);
      if (!client || !client.signAndBroadcast) {
        return { ok: false, error: 'client_not_available' };
      }
      mark('connectWithSigner.done');

      try {
        const pqcStart = Date.now();
        const pqcLocal = await ensureLocalPqcKey(bridgeMod, client, profileId, walletAddr);
        if (pqcLocal && pqcLocal.record) {
          mark('pqc.ensureLocal.done', { ms: Date.now() - pqcStart });
          const linkStart = Date.now();
          await ensureOnChainPqcLink(bridgeMod, client, walletAddr, pqcLocal.record);
          mark('pqc.ensureOnChain.done', { ms: Date.now() - linkStart });
        }
      } catch (err) {
        console.warn(
          '[gateway] ensure PQC link (plan subscribe) failed',
          err && err.message ? err.message : err
        );
      }

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

      const zeroFee =
        (bridgeMod.utils && bridgeMod.utils.gas && bridgeMod.utils.gas.zeroFee) ||
        (bridgeMod.utils && bridgeMod.utils.zeroFee) ||
        (() => ({ amount: [], gas: '250000' }));
      const memo = String(input?.memo || 'gateway:plan:subscribe');

      const fee = zeroFee();
      console.log('[gateway] subscribePlan broadcast', {
        planId,
        gatewayId,
        fee,
        typeUrl: msg?.typeUrl,
      });

      mark('broadcast.start', { typeUrl: msg?.typeUrl, planId, gatewayId });
      const res = await client.signAndBroadcast(walletAddr, [msg], fee, memo);
      if (typeof res?.code === 'number' && res.code !== 0) {
        mark('broadcast.failed', { code: res.code });
        return {
          ok: false,
          error: String(res?.rawLog || `broadcast failed (code ${res.code})`),
          txhash: String(res?.transactionHash || res?.txhash || res?.hash || ''),
        };
      }
      const txhash = String(res?.transactionHash || res?.txhash || res?.hash || '');
      mark('broadcast.ok', { txhash });

      return { ok: true, txhash, planId, gatewayId };
    } catch (e) {
      mark('error', { error: String(e && e.message ? e.message : e) });
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

module.exports = {
  registerGatewayIpc,
  fetchGatewaysFromRest,
  resolveGatewayBaseFromEndpoint,
  getRestBaseUrl,
};
