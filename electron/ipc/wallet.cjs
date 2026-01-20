const { ipcMain, app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const Long = require('long');
const { getNetworkPool } = require('../network/pool_singleton.cjs');
const { readState, broadcastTx } = require('../network/network_middleware.cjs');
const { userDataPath, readJson } = require('../utils/fs.cjs');
const { decryptMnemonicLocal, decryptMnemonicWithPassword, isPasswordProtected } = require('../utils/crypto.cjs');
const { arePqcKeysEncrypted, tempDecryptPqcKeys } = require('../utils/pqc-keys.cjs');
const { runWithRpcRetry } = require('../utils/tx.cjs');
const { isPasswordRequired, getSessionPassword, verifyStoredPassword } = require('./security.cjs');
let pqcWorker = null;
try {
  pqcWorker = require('../utils/pqc-worker.cjs');
} catch {
  pqcWorker = null;
}

let bridge = null;

function isHtmlInsteadOfJsonError(e) {
  const msg = String(e && e.message ? e.message : e || '');
  return (
    msg.includes("Unexpected token '<'") ||
    msg.includes('is not valid JSON') ||
    msg.toLowerCase().includes('<html') ||
    msg.toLowerCase().includes('text/html')
  );
}

async function connectSigningClientWithFailover(mod, signer, connectArgs, { timeoutMs = 15_000 } = {}) {
  const pool = getNetworkPool();
  pool.start();

  const exclude = new Set();
  let candidates = pool.pickPeers('rpc', 3, { requireAlive: true, exclude });
  if (!candidates.length) {
    candidates = pool.pickPeers('rpc', 3, { requireAlive: false, exclude });
    for (const p of candidates) {
      await pool.pingPeer(p).catch(() => {});
    }
    candidates = pool.pickPeers('rpc', 3, { requireAlive: true, exclude });
  }
  if (!candidates.length) {
    const best = pool.getBestPeer('rpc');
    if (best) candidates = [best];
  }

  let lastErr = null;
  for (const peer of candidates) {
    exclude.add(peer.rpc);
    const rpcBase = peer.rpc;
    if (!rpcBase) continue;

    const restBase = peer.rest || null;
    const endpoints = {
      rpc: rpcBase,
      rest: restBase || rpcBase,
      rpcEndpoint: rpcBase,
      restEndpoint: restBase || rpcBase
    };

    try {
      const connectPromise = mod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        undefined,
        connectArgs
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs)
      );
      return await Promise.race([connectPromise, timeoutPromise]);
    } catch (e) {
      lastErr = e;
      if (isHtmlInsteadOfJsonError(e)) {
        pool.markSuspect(peer);
      } else {
        pool.markFailure(peer, { timeout: /timeout/i.test(String(e && e.message ? e.message : e)) });
      }
    }
  }

  throw lastErr || new Error('connect_failed');
}

function broadcastPqcLinked(payload) {
  try {
    const wins =
      typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const w of wins) {
      try {
        w?.webContents?.send?.('profiles:pqcLinked', payload);
      } catch {
        // ignore per-window failures
      }
    }
  } catch {
    // ignore
  }
}

async function loadBridge() {
  if (bridge) return bridge;
  try {
    // Use dynamic import to support ESM-only builds of @lumen-chain/sdk
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
    console.warn('[wallet] failed to load @lumen-chain/sdk', e && e.message ? e.message : e);
    bridge = null;
    return null;
  }
}

function keystoreFile(profileId) {
  return userDataPath('profiles', profileId, 'keystore.json');
}

/**
 * Load mnemonic from keystore, handling both app-secret and password-protected keystores
 * @param {string} profileId 
 * @param {string|null} password - Password for password-protected keystores (optional if session is active)
 * @returns {string} mnemonic
 */
function loadMnemonic(profileId, password = null) {
  const file = keystoreFile(profileId);
  const ks = readJson(file, null);
  if (!ks) throw new Error(`No keystore for profileId=${profileId}`);
  
  // Check if keystore is password-protected
  if (isPasswordProtected(ks)) {
    // Try session password first, then provided password
    const pwd = password || getSessionPassword();
    if (!pwd) {
      throw new Error('password_required');
    }
    const mnemonic = decryptMnemonicWithPassword(ks, pwd);
    if (!mnemonic) {
      console.warn('[wallet] mnemonic decrypt failed for profileId=', profileId);
      throw new Error('invalid_password');
    }
    return mnemonic;
  }
  
  // Legacy: app-secret encrypted keystore
  const mnemonic = decryptMnemonicLocal(ks);
  if (!mnemonic) throw new Error('Failed to decrypt keystore');
  return mnemonic;
}

/**
 * Check if a signing operation requires password verification
 * @param {string|null} providedPassword - Password provided with the request
 * @returns {{ ok: boolean, error?: string }}
 */
function checkPasswordForSigning(providedPassword = null) {
  if (!isPasswordRequired()) {
    return { ok: true };
  }
  
  // Check session password
  const sessionPwd = getSessionPassword();
  if (sessionPwd) {
    return { ok: true };
  }
  
  // Check provided password
  if (providedPassword) {
    if (verifyStoredPassword(providedPassword)) {
      return { ok: true };
    }
    return { ok: false, error: 'invalid_password' };
  }
  
  return { ok: false, error: 'password_required' };
}

function resolvePqcHome() {
  if (process.env.LUMEN_PQC_HOME) return process.env.LUMEN_PQC_HOME;
  // Store PQC data alongside other app metadata in the app's userData folder.
  // PqcKeyStore itself will create/use a "pqc_keys" subdirectory inside this base path.
  return userDataPath();
}

function resolvePeersFilePath() {
  const { app } = require('electron');
  const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  const packagedResourcesPath = app && app.isPackaged ? process.resourcesPath : null;

  const candidates = [
    ...(packagedResourcesPath ? [path.join(packagedResourcesPath, 'peers.txt')] : []),
    ...(packagedResourcesPath
      ? [path.join(packagedResourcesPath, 'resources', 'peers.txt')]
      : []),
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'),
    path.join(process.cwd(), 'resources', 'peers.txt'),
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        console.log('[wallet] found peers file at:', file);
        return file;
      }
    } catch {}
  }

  return null;
}

function getRestBaseUrl() {
  try {
    const peer = getNetworkPool().getBestPeer('rest');
    return peer && peer.rest ? String(peer.rest) : '';
  } catch {
    return '';
  }
}

function getRpcBaseUrl() {
  try {
    const peer = getNetworkPool().getBestPeer('rpc');
    return peer && peer.rpc ? String(peer.rpc) : '';
  } catch {
    return '';
  }
}

function hashHex(data) {
  return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
}

function prefixFromAddress(address) {
  const a = String(address || '').trim();
  const i = a.indexOf('1');
  return i > 0 ? a.slice(0, i) : 'lmn';
}

function sha256Utf8(payload) {
  return crypto.createHash('sha256').update(Buffer.from(String(payload ?? ''), 'utf8')).digest();
}

async function derivePrivkeyFromMnemonic(mnemonic) {
  const { Bip39, EnglishMnemonic, Slip10, Slip10Curve, Slip10RawIndex } = require('@cosmjs/crypto');
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(String(mnemonic || '').trim()));
  const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, [
    Slip10RawIndex.hardened(44),
    Slip10RawIndex.hardened(118),
    Slip10RawIndex.hardened(0),
    Slip10RawIndex.normal(0),
    Slip10RawIndex.normal(0),
  ]);
  return privkey;
}

function pubkeyToAddressBech32(pubkeyCompressed, prefix) {
  const { sha256, ripemd160 } = require('@cosmjs/crypto');
  const bech32 = require('bech32');
  if (!bech32 || typeof bech32.encode !== 'function' || typeof bech32.toWords !== 'function') {
    throw new Error('bech32_unavailable');
  }
  const hash = Buffer.from(ripemd160(sha256(pubkeyCompressed)));
  return bech32.encode(String(prefix || 'lmn'), bech32.toWords(hash));
}

function leadingZeroBits(buf) {
  let bits = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0) {
      bits += 8;
      continue;
    }
    for (let j = 7; j >= 0; j--) {
      if (((b >> j) & 1) === 0) bits++;
      else return bits;
    }
  }
  return bits;
}

function sha256Bytes(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest();
}

async function mineUpdatePowNonce(identifier, creator, bits, budgetMs = 2500) {
  identifier = String(identifier || '');
  creator = String(creator || '');
  const end = Date.now() + Math.max(200, budgetMs | 0);
  let nonce = Long.fromNumber(0, true);

  if (!bits || bits <= 0) {
    const payload = `${identifier}|${creator}|${nonce.toString()}`;
    const h = sha256Bytes(payload);
    return { nonce, hashHex: Buffer.from(h).toString('hex') };
  }

  while (Date.now() < end) {
    const payload = `${identifier}|${creator}|${nonce.toString()}`;
    const h = sha256Bytes(payload);
    if (leadingZeroBits(h) >= bits) {
      return { nonce, hashHex: Buffer.from(h).toString('hex') };
    }
    nonce = nonce.add(1);
  }
  return null;
}

function normalizeHashString(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (/^[0-9a-f]+$/i.test(raw) && raw.length >= 32) return lower;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length > 0) return buf.toString('hex').toLowerCase();
  } catch {}
  return lower;
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

async function loadPqcParams(client) {
  try {
    const resp = await client.pqc().params();
    return (resp && (resp.params || resp)) || {};
  } catch {
    return {};
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
          createdAt: rec.createdAt || rec.created_at
        };

  let keyName = existingLink;
  let record = keyName ? normalize(store.getKey(keyName)) : undefined;

  const onChain = await fetchOnChainPqcStatus(client, address);
  const preferred = `profile:${profileId}`;
  const preferredRecord = normalize(store.getKey(preferred));
  const allKeys = store.listKeys().map(normalize);
  
  console.log('[ensureLocalPqcKey] existingLink:', existingLink, 'preferred:', preferred);
  console.log('[ensureLocalPqcKey] record found:', !!record, 'preferredRecord found:', !!preferredRecord);
  console.log('[ensureLocalPqcKey] allKeys:', allKeys.map(k => k.name));
  console.log('[ensureLocalPqcKey] onChain:', onChain);

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
  if (!address || !client || !record) return false;
  const status = await fetchOnChainPqcStatus(client, address);
  if (status.linked) return false;

  const pqcModule = typeof client.pqc === 'function' ? client.pqc() : null;
  if (!pqcModule || !pqcModule.msgLinkAccountPqc) {
    throw new Error('PQC module unavailable on client');
  }
  const params = await loadPqcParams(client);
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
    (bridgeMod.utils && bridgeMod.utils.zeroFee) ||
    (() => ({ amount: [], gas: '250000' }));
  const msg = pqcModule.msgLinkAccountPqc(address, {
    scheme: record.scheme,
    pubKey: record.publicKey,
    powNonce
  });
  const signAndBroadcastOnce = async () => {
    if (client && typeof client.sign === 'function') {
      const { TxRaw } = require('cosmjs-types/cosmos/tx/v1beta1/tx');
      const txRaw = await client.sign(address, [msg], zeroFee(), '');
      const txBytes = TxRaw.encode(txRaw).finish();
      const r = await broadcastTx(txBytes, { confirmTimeoutMs: 60_000 });
      if (!r || !r.ok) {
        const err = new Error(String((r && (r.rawLog || r.error)) || 'pqc_link_broadcast_failed'));
        err.txhash = r && r.transactionHash ? r.transactionHash : '';
        throw err;
      }
      return { ...r, code: r.code || 0, rawLog: r.rawLog || '', transactionHash: r.transactionHash };
    }
    return client.signAndBroadcast(address, [msg], zeroFee());
  };
  const res = await runWithRpcRetry(() => signAndBroadcastOnce(), 'pqc_link');
  if (res.code !== 0) {
    throw new Error(res.rawLog || `link-account PQC failed (code ${res.code})`);
  }
  return true;
}

const WALLET_ACTIVATION_TOOLTIP =
  'To be activated, you must make your first transaction (buy domain/send token etc..) with a minimum of 0.001 LMN in your wallet';

function isPqcRelatedErrorText(text) {
  const msg = String(text || '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('codespace: pqc')) return true;
  if (msg.includes('pqc_policy_required')) return true;
  if (!msg.includes('pqc')) return false;
  return (
    msg.includes('link') ||
    msg.includes('linked') ||
    msg.includes('missing pqc key') ||
    msg.includes('pqc signature required') ||
    msg.includes('signature required') ||
    msg.includes('pub_key_hash') ||
    msg.includes('pubkeyhash') ||
    msg.includes('pub key hash') ||
    msg.includes('policy')
  );
}

function isActivationBalanceErrorText(text) {
  const msg = String(text || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('min_balance_for_link') ||
    msg.includes('min balance for link') ||
    msg.includes('requires at least') ||
    msg.includes('insufficient funds') ||
    msg.includes('spendable balance')
  );
}

function sanitizePqcErrorMessage(text) {
  if (isActivationBalanceErrorText(text)) {
    return WALLET_ACTIVATION_TOOLTIP;
  }
  return String(text || '').trim();
}

async function waitForPqcLinkCommit(address, timeoutMs = 15_000) {
  const addr = String(address || '').trim();
  if (!addr) return false;

  const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);

  while (Date.now() < deadline) {
    try {
      const res = await readState(`/lumen/pqc/v1/accounts/${encodeURIComponent(addr)}`, {
        kind: 'rest',
        timeout: 6000
      });
      if (res && res.ok) {
        const data = res.json || null;
        const account = (data && (data.account || data)) || null;
        const pubKeyHash =
          account &&
          (account.pubKeyHash ||
            account.pub_key_hash ||
            account.pubKey ||
            account.pub_key);
        if (pubKeyHash && String(pubKeyHash).length > 0) {
          return true;
        }
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

async function signAndBroadcastWithPqcAutoLink({
  bridgeMod,
  client,
  profileId,
  address,
  msgs,
  fee,
  memo,
  label,
}) {
  const broadcastOnce = async () => {
    if (client && typeof client.sign === 'function') {
      const { TxRaw } = require('cosmjs-types/cosmos/tx/v1beta1/tx');
      const txRaw = await client.sign(address, msgs, fee, memo);
      const txBytes = TxRaw.encode(txRaw).finish();
      const r = await broadcastTx(txBytes, { confirmTimeoutMs: 60_000 });
      if (!r || !r.ok) {
        const raw = (r && (r.rawLog || r.error)) || 'broadcast_failed';
        const err = new Error(String(raw));
        err.txhash = r && r.transactionHash ? r.transactionHash : '';
        throw err;
      }
      return { ...r, code: r.code || 0, rawLog: r.rawLog || '', transactionHash: r.transactionHash };
    }

    const res = await client.signAndBroadcast(address, msgs, fee, memo);
    if (res && typeof res.code === 'number' && res.code !== 0) {
      const raw = res.rawLog || `broadcast failed (code ${res.code})`;
      const err = new Error(String(raw));
      err.txhash = res.transactionHash || res.txhash || res.hash || '';
      throw err;
    }
    return res;
  };

  try {
    return await broadcastOnce();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!isPqcRelatedErrorText(msg)) {
      throw e;
    }

    try {
      // The SDK caches the PQC keystore (links/keys) in-memory on first use.
      // If we mutate pqc_keys via a separate keystore instance, the client would keep using stale links.
      // Clear the cache before repairing local PQC state so subsequent sign attempts see fresh data.
      try {
        if (client && typeof client === 'object') {
          client.pqcStore = undefined;
        }
      } catch {}

      const pqcLocal = await ensureLocalPqcKey(bridgeMod, client, profileId, address);
      try {
        if (pqcLocal && pqcLocal.store && client && typeof client === 'object') {
          client.pqcStore = pqcLocal.store;
        }
      } catch {}
      if (pqcLocal && pqcLocal.record) {
        const didLink = await ensureOnChainPqcLink(bridgeMod, client, address, pqcLocal.record);
        const committed = didLink ? await waitForPqcLinkCommit(address).catch(() => false) : false;
        if (didLink && committed) {
          broadcastPqcLinked({
            profileId: String(profileId || '').trim(),
            address: String(address || '').trim()
          });
        }
      }
    } catch (linkErr) {
      const linkMsg = String(linkErr && linkErr.message ? linkErr.message : linkErr);
      throw new Error(sanitizePqcErrorMessage(linkMsg));
    }

    try {
      return await broadcastOnce();
    } catch (e2) {
      const msg2 = String(e2 && e2.message ? e2.message : e2);
      if (isPqcRelatedErrorText(msg2)) {
        await waitForPqcLinkCommit(address, 20_000).catch(() => false);
        try {
          return await broadcastOnce();
        } catch (e3) {
          const msg3 = String(e3 && e3.message ? e3.message : e3);
          throw new Error(sanitizePqcErrorMessage(msg3));
        }
      }
      throw e2;
    }
  }
}

function registerWalletIpc() {
  function sanitizeDecryptErrorMessage(errMsg) {
    const msg = String(errMsg || '').trim();
    const lower = msg.toLowerCase();
    if (
      lower.includes('unable to authenticate data') ||
      lower.includes('unsupported state') ||
      lower.includes('bad decrypt')
    ) {
      return 'invalid_password';
    }
    return msg || 'unknown_error';
  }

  ipcMain.handle('wallet:sendTokens', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const from = String(input && input.from ? input.from : '').trim();
      const to = String(input && input.to ? input.to : '').trim();
      const amount = Number(input && input.amount ? input.amount : 0);
      const memo = String(input && input.memo ? input.memo : '');
      const denom = String(input && input.denom ? input.denom : 'ulmn');
      const password = input && input.password ? String(input.password) : null;
      
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!from || !to || !(amount > 0)) return { ok: false, error: 'missing_from_to_amount' };

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }
      
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      // Ensure from is a valid string before calling match
      const fromStr = String(from || '');
      const prefixMatch = fromStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';

      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      console.log('[wallet:sendTokens] connecting to client...');
      const client = await connectSigningClientWithFailover(
        mod,
        signer,
        {
          pqc: {
            homeDir: resolvePqcHome()
          }
        },
        { timeoutMs: 15_000 }
      );
      console.log('[wallet:sendTokens] connected, client:', client ? 'ok' : 'null');

      // Temporarily decrypt PQC keys if password-protected
      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      const keysEncrypted = arePqcKeysEncrypted();
      console.log('[wallet:sendTokens] keysEncrypted:', keysEncrypted, 'hasPassword:', !!password, 'hasSession:', !!getSessionPassword());
      if (keysEncrypted) {
        if (!effectivePassword) {
          console.log('[wallet:sendTokens] no password available, returning password_required');
          return { ok: false, error: 'password_required' };
        }
        console.log('[wallet:sendTokens] decrypting PQC keys...');
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) {
          console.log('[wallet:sendTokens] decryption failed, returning invalid_password');
          return { ok: false, error: 'invalid_password' };
        }
        console.log('[wallet:sendTokens] PQC keys decrypted successfully');
      }

      try {
        console.log('[wallet:sendTokens] preparing MsgSend...');
        const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx.js');
        const micro = Math.round(amount * 1_000_000);
        
        const msg = {
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: MsgSend.fromPartial({
            fromAddress: from,
            toAddress: to,
            amount: [{ denom, amount: String(micro) }]
          })
        };

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '250000' }));

        const fee = zeroFee();
        console.log('[wallet:sendTokens] calling signAndBroadcast (PQC middleware)...');
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: from,
          msgs: [msg],
          fee,
          memo,
          label: 'wallet_sendTokens',
        });
        console.log('[wallet:sendTokens] signAndBroadcast result:', res);
        
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        // Restore encrypted PQC keys
        if (cleanupPqc) {
          console.log('[wallet:sendTokens] restoring encrypted PQC keys...');
          cleanupPqc();
        }
      }
    } catch (e) {
      console.error('[wallet:sendTokens] error:', e);
      console.error('[wallet:sendTokens] stack:', e && e.stack ? e.stack : 'no stack');
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  ipcMain.handle('dns:createDomain', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const nameRaw =
        (input && (input.fqdn || input.name)) ? (input.fqdn || input.name) : '';
      const name = String(nameRaw || '').trim();
      const owner = String(input && input.owner ? input.owner : '').trim();
      const durationDaysRaw =
        Number(
          input && (input.duration_days ?? input.durationDays ?? input.days)
        ) || 0;
      const durationDays =
        Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
          ? durationDaysRaw
          : 365;
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!name) return { ok: false, error: 'missing_name' };
      if (!owner) return { ok: false, error: 'missing_owner' };

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const ownerStr = String(owner || '');
      const prefixMatch = ownerStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';

      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: {
          homeDir: resolvePqcHome()
        }
      });

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
        const dnsMod =
          typeof client.dns === 'function' ? client.dns() : client.dns;
        if (!dnsMod || typeof dnsMod.msgRegister !== 'function') {
          return { ok: false, error: 'dns_module_unavailable' };
        }

        let domain = '';
        let ext = '';
        const m = name.match(/^([^\.]+)\.([^\.]+)$/);
        if (m) {
          domain = m[1];
          ext = m[2];
        } else {
          domain = name;
          ext = 'lumen';
        }

        const msg = await dnsMod.msgRegister(owner, {
          domain,
          ext,
          cid: input && input.cid ? String(input.cid) : '',
          ipns: input && input.ipns ? String(input.ipns) : '',
          records: Array.isArray(input && input.records ? input.records : [])
            ? input.records
            : [],
          duration_days: durationDays
        });

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '250000' }));

        const memo = String((input && input.memo) || 'dns:register');
        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: owner,
          msgs: [msg],
          fee,
          memo,
          label: 'dns_createDomain',
        });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  ipcMain.handle('dns:updateDomain', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const nameRaw =
        (input && (input.fqdn || input.name)) ? (input.fqdn || input.name) : '';
      const name = String(nameRaw || '').trim();
      const owner = String(input && (input.owner || input.address) ? (input.owner || input.address) : '').trim();
      const recordsRaw = Array.isArray(input && input.records ? input.records : [])
        ? input.records
        : [];
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!name) return { ok: false, error: 'missing_name' };
      if (!owner) return { ok: false, error: 'missing_owner' };

      const records = recordsRaw
        .map((r) => ({
          key: String(r && r.key ? r.key : '').trim(),
          value: String(r && r.value ? r.value : '').trim()
        }))
        .filter((r) => r.key || r.value);
      if (!records.length) {
        return { ok: false, error: 'missing_records' };
      }

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const ownerStr = String(owner || '');
      const prefixMatch = ownerStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';

      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: {
          homeDir: resolvePqcHome()
        }
      });

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
        const dnsMod =
          typeof client.dns === 'function' ? client.dns() : client.dns;
        if (!dnsMod || typeof dnsMod.msgUpdate !== 'function') {
          return { ok: false, error: 'dns_module_unavailable' };
        }

        let domain = '';
        let ext = '';
        const m = name.match(/^([^\.]+)\.([^\.]+)$/);
        if (m) {
          domain = m[1];
          ext = m[2];
        } else {
          domain = name;
          ext = 'lumen';
        }

        const identifier = `${String(domain || '').toLowerCase()}.${String(
          ext || ''
        ).toLowerCase()}`;

        let powBits = 0;
        try {
          const prs = await readState('/lumen/dns/v1/params', { kind: 'rest', timeout: 5000 });
          if (prs && prs.ok && prs.json) {
            const raw = prs.json;
            const params =
              (raw && (raw.params || raw.data?.params)) || raw.data || raw || {};
            const fromRest = Number(
              params.update_pow_difficulty ??
                params.updatePowDifficulty ??
                params.pow_difficulty ??
                params.powDifficulty ??
                0
            );
            if (Number.isFinite(fromRest) && fromRest > 0) {
              powBits = fromRest;
            }
          }
        } catch (e) {
          console.warn(
            '[dns] updateDomain: failed to load dns params for pow',
            e && e.message ? e.message : e
          );
        }

        const budgetMsRaw =
          Number(
            input &&
              (input.powBudgetMs ?? input.pow_budget_ms ?? input.pow_budget_ms)
          ) || 0;
        const budgetMs =
          Number.isFinite(budgetMsRaw) && budgetMsRaw > 0 ? budgetMsRaw : 2500;

        const mined = await mineUpdatePowNonce(identifier, owner, powBits, budgetMs);
        if (!mined) {
          return {
            ok: false,
            error: 'pow_budget_exceeded',
            detail: { bits: powBits, budgetMs }
          };
        }
        const powNonce = mined.nonce;

        const cidEntry = records.find((r) => r.key === 'cid');
        const ipnsEntry = records.find((r) => r.key === 'ipns');
        const cid = cidEntry ? cidEntry.value : String(input && input.cid ? input.cid : '');
        const ipns = ipnsEntry ? ipnsEntry.value : String(input && input.ipns ? input.ipns : '');

        const msg = await dnsMod.msgUpdate(owner, {
          domain,
          ext,
          cid,
          ipns,
          records,
          powNonce
        });

        if (msg && msg.value) {
          msg.value.powNonce = powNonce;
          msg.value.pow_nonce = powNonce;
        }

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '250000' }));

        const memo = String((input && input.memo) || 'dns:update');
        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: owner,
          msgs: [msg],
          fee,
          memo,
          label: 'dns_updateDomain',
        });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  // Staking operations
  ipcMain.handle('wallet:delegate', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const validatorAddress = String(input && input.validatorAddress ? input.validatorAddress : '').trim();
      const amount = input && input.amount ? input.amount : null;
      const password = input && input.password ? String(input.password) : null;
      
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !validatorAddress || !amount) {
        return { ok: false, error: 'missing_required_fields' };
      }

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const addressStr = String(address || '');
      const prefixMatch = addressStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: { homeDir: resolvePqcHome() }
      });

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
        const { MsgDelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx.js');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: MsgDelegate.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress,
            amount: amount
          })
        };

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '300000' }));

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: '',
          label: 'wallet_delegate',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:undelegate', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const validatorAddress = String(input && input.validatorAddress ? input.validatorAddress : '').trim();
      const amount = input && input.amount ? input.amount : null;
      const password = input && input.password ? String(input.password) : null;
      
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !validatorAddress || !amount) {
        return { ok: false, error: 'missing_required_fields' };
      }

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const addressStr = String(address || '');
      const prefixMatch = addressStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: { homeDir: resolvePqcHome() }
      });

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
        const { MsgUndelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx.js');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
          value: MsgUndelegate.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress,
            amount: amount
          })
        };

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '300000' }));

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: '',
          label: 'wallet_undelegate',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:redelegate', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const validatorSrcAddress = String(input && input.validatorSrcAddress ? input.validatorSrcAddress : '').trim();
      const validatorDstAddress = String(input && input.validatorDstAddress ? input.validatorDstAddress : '').trim();
      const amount = input && input.amount ? input.amount : null;
      const password = input && input.password ? String(input.password) : null;
      
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !validatorSrcAddress || !validatorDstAddress || !amount) {
        return { ok: false, error: 'missing_required_fields' };
      }

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const addressStr = String(address || '');
      const prefixMatch = addressStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: { homeDir: resolvePqcHome() }
      });

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
        const { MsgBeginRedelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx.js');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          value: MsgBeginRedelegate.fromPartial({
            delegatorAddress: address,
            validatorSrcAddress: validatorSrcAddress,
            validatorDstAddress: validatorDstAddress,
            amount: amount
          })
        };

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '300000' }));

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: '',
          label: 'wallet_redelegate',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:withdrawRewards', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const validatorAddress = String(input && input.validatorAddress ? input.validatorAddress : '').trim();
      const password = input && input.password ? String(input.password) : null;
      
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !validatorAddress) {
        return { ok: false, error: 'missing_required_fields' };
      }

      // Check password if security is enabled
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') {
          return { ok: false, error: 'password_required' };
        }
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const addressStr = String(address || '');
      const prefixMatch = addressStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: { homeDir: resolvePqcHome() }
      });

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
        const { MsgWithdrawDelegatorReward } = await import('cosmjs-types/cosmos/distribution/v1beta1/tx.js');
        
        const msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
          value: MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress
          })
        };

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '300000' }));

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: '',
          label: 'wallet_withdrawRewards',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('release:publish', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const creator = String(input && input.creator ? input.creator : '').trim();
      const password = input && input.password ? String(input.password) : null;
      const release = input && input.release ? input.release : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!creator) return { ok: false, error: 'missing_creator' };
      if (!release || typeof release !== 'object') return { ok: false, error: 'missing_release' };

      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) return { ok: false, error: pwdCheck.error };

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') return { ok: false, error: 'password_required' };
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const creatorStr = String(creator || '');
      const prefixMatch = creatorStr.match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const client = await connectSigningClientWithFailover(mod, signer, {
        pqc: { homeDir: resolvePqcHome() }
      });

      // Temporarily decrypt PQC keys if password-protected
      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      if (arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const relMod = typeof client.releases === 'function' ? client.releases() : client.releases;
        if (!relMod || typeof relMod.msgPublishRelease !== 'function') {
          return { ok: false, error: 'release_module_unavailable' };
        }

        const reSha256Hex = /^[0-9a-f]{64}$/i;

        function parseUrlsInput(value) {
          if (Array.isArray(value)) {
            return value.map((u) => String(u || '').trim()).filter(Boolean);
          }
          return String(value || '')
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        function parseSupersedesInput(value) {
          if (Array.isArray(value)) {
            return value
              .map((v) => Number(v))
              .filter((n) => Number.isFinite(n) && n > 0)
              .map((n) => Math.trunc(n));
          }
          return String(value || '')
            .split(/[,\s]+/)
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((n) => Math.trunc(n));
        }

        function normalizeArtifactPayload(value, index) {
          if (!value || typeof value !== 'object') {
            throw new Error(`artifact[${index}]: missing`);
          }
          const platform = String(value.platform ?? '').trim();
          if (!platform) throw new Error(`artifact[${index}]: platform required`);
          const kind = String(value.kind ?? '').trim();
          if (!kind) throw new Error(`artifact[${index}]: kind required`);
          const sha = String(value.sha256Hex ?? value.sha256_hex ?? value.sha ?? '').trim().toLowerCase();
          if (!reSha256Hex.test(sha)) throw new Error(`artifact[${index}]: invalid sha256_hex`);
          const sizeRaw = value.size ?? value.bytes ?? 0;
          const size = Number(sizeRaw);
          if (!Number.isFinite(size) || size <= 0) throw new Error(`artifact[${index}]: invalid size`);
          const cid = String(value.cid ?? '').trim();
          const urls = parseUrlsInput(value.urls ?? value.urlsText ?? value.url);
          const out = { platform, kind, sha256Hex: sha, size, urls };
          if (cid) out.cid = cid;
          return out;
        }

        function normalizeReleasePayload(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('release payload missing');
          }
          const version = String(value.version ?? '').trim();
          if (!version) throw new Error('version required');
          const channel = String(value.channel ?? '').trim();
          if (!channel) throw new Error('channel required');
          const artifactsInput = Array.isArray(value.artifacts) ? value.artifacts : [];
          if (!artifactsInput.length) throw new Error('at least one artifact is required');
          const artifacts = artifactsInput.map((a, idx) => normalizeArtifactPayload(a, idx));

          const out = {
            version,
            channel,
            notes: String(value.notes ?? ''),
            artifacts,
          };

          const supersedes = parseSupersedesInput(value.supersedes ?? value.supersedeIds);
          if (supersedes.length) out.supersedes = supersedes;

          const emergencyOk = typeof value.emergencyOk === 'boolean' ? value.emergencyOk : !!value.emergency_ok;
          if (emergencyOk) out.emergencyOk = true;

          const emergencyUntilRaw = value.emergencyUntil ?? value.emergency_until;
          if (emergencyUntilRaw != null && emergencyUntilRaw !== '') {
            const emergencyUntil = Number(emergencyUntilRaw);
            if (Number.isFinite(emergencyUntil) && emergencyUntil > 0) {
              out.emergencyUntil = Math.trunc(emergencyUntil);
            }
          }
          return out;
        }

        const normalizedRelease = normalizeReleasePayload(release);
        const msg = relMod.msgPublishRelease(creator, normalizedRelease);

        const zeroFee =
          (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
          (mod.utils && mod.utils.zeroFee) ||
          (() => ({ amount: [], gas: '550000' }));

        const fee = input && input.fee ? input.fee : zeroFee();
        const memo = String((input && input.memo) || 'release:publish');

        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: creator,
          msgs: [msg],
          fee,
          memo,
          label: 'release_publish',
        });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  // Sign arbitrary payload (ADR-036 style: secp256k1 over sha256(utf8(payload))).
  ipcMain.handle('wallet:signArbitrary', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const payload = String(input && Object.prototype.hasOwnProperty.call(input, 'payload') ? input.payload : '');
      const algo = String(input && input.algo ? input.algo : 'ADR-036');
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address) return { ok: false, error: 'missing_address' };
      if (!payload) return { ok: false, error: 'missing_payload' };

      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') return { ok: false, error: 'password_required' };
        if (errMsg === 'invalid_password') return { ok: false, error: 'invalid_password' };
        return { ok: false, error: errMsg };
      }

      const privkey = await derivePrivkeyFromMnemonic(mnemonic);
      const { Secp256k1 } = require('@cosmjs/crypto');
      const kp = await Secp256k1.makeKeypair(privkey);
      const pubkeyUncompressed = kp.pubkey;
      const pubkeyCompressed = Secp256k1.compressPubkey(pubkeyUncompressed);

      const digest = sha256Utf8(payload);
      const sigObj = await Secp256k1.createSignature(digest, privkey);
      // `Secp256k1.createSignature` returns an ExtendedSecp256k1Signature
      // (r|s|recovery). For Cosmos/ADR-036 we keep the standard 64-byte (r|s).
      const signatureFixed = new Uint8Array([...sigObj.r(32), ...sigObj.s(32)]);

      const prefix = prefixFromAddress(address);
      const derivedAddr = pubkeyToAddressBech32(pubkeyCompressed, prefix);

      return {
        ok: true,
        algo,
        signatureB64: Buffer.from(signatureFixed).toString('base64'),
        pubkeyB64: Buffer.from(pubkeyCompressed).toString('base64'),
        address: derivedAddr,
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  // Verify arbitrary payload signature.
  ipcMain.handle('wallet:verifyArbitrary', async (_evt, input) => {
    try {
      const algo = String(input && input.algo ? input.algo : 'ADR-036');
      const payload = String(input && Object.prototype.hasOwnProperty.call(input, 'payload') ? input.payload : '');
      const signatureB64 = String(input && input.signatureB64 ? input.signatureB64 : '');
      const address = String(input && input.address ? input.address : '').trim();
      const pubkeyB64 = input && input.pubkeyB64 ? String(input.pubkeyB64) : '';

      if (!payload || !signatureB64 || !address) {
        return {
          ok: false,
          algo,
          signatureValid: false,
          addressMatches: false,
          derivedAddress: '',
          error: 'missing_payload_signature_address'
        };
      }
      if (!pubkeyB64) {
        return {
          ok: false,
          algo,
          signatureValid: false,
          addressMatches: false,
          derivedAddress: '',
          error: 'missing_pubkeyB64'
        };
      }

      const { Secp256k1, Secp256k1Signature } = require('@cosmjs/crypto');
      const pubBytesRaw = Buffer.from(pubkeyB64, 'base64');
      const pubUncompressed = pubBytesRaw.length === 33 ? Secp256k1.uncompressPubkey(pubBytesRaw) : pubBytesRaw;
      const pubCompressed = pubBytesRaw.length === 33 ? pubBytesRaw : Secp256k1.compressPubkey(pubBytesRaw);

      const signature = Buffer.from(signatureB64, 'base64');
      const digest = sha256Utf8(payload);
      let sigObj;
      try {
        sigObj = Secp256k1Signature.fromFixedLength(signature);
      } catch (_e) {
        // Backward-compat for older code paths that included the recovery param.
        if (signature.length === 65) sigObj = require('@cosmjs/crypto').ExtendedSecp256k1Signature.fromFixedLength(signature);
        else throw _e;
      }
      const validSig = await Secp256k1.verifySignature(sigObj, digest, pubUncompressed);

      const prefix = prefixFromAddress(address);
      const derivedAddr = pubkeyToAddressBech32(pubCompressed, prefix);
      const signatureValid = !!validSig;
      const addressMatches = derivedAddr === address;
      const ok = signatureValid && addressMatches;
      return { ok, algo, signatureValid, addressMatches, derivedAddress: derivedAddr };
    } catch (e) {
      return {
        ok: false,
        algo: String(input && input.algo ? input.algo : 'ADR-036'),
        signatureValid: false,
        addressMatches: false,
        derivedAddress: '',
        error: String(e && e.message ? e.message : e)
      };
    }
  });
}

module.exports = {
  registerWalletIpc
};
