const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const Long = require('long');
const { httpGet } = require('./http.cjs');
const { userDataPath, readJson } = require('../utils/fs.cjs');
const { decryptMnemonicLocal, decryptMnemonicWithPassword, isPasswordProtected, decryptWithPassword, encryptWithPassword } = require('../utils/crypto.cjs');
const { runWithRpcRetry } = require('../utils/tx.cjs');
const { isPasswordRequired, getSessionPassword, verifyStoredPassword } = require('./security.cjs');
let pqcWorker = null;
try {
  pqcWorker = require('../utils/pqc-worker.cjs');
} catch {
  pqcWorker = null;
}

let bridge = null;

/**
 * Temporarily decrypt PQC keys file for use by SDK
 * Returns cleanup function to restore encrypted state
 */
function tempDecryptPqcKeys(password) {
  const keysFile = path.join(userDataPath('pqc_keys'), 'keys.json');
  if (!fs.existsSync(keysFile)) return null;

  try {
    const data = readJson(keysFile, null);
    if (!data) return null;

    // Check if encrypted
    if (!data._encrypted || !data.crypto) {
      // Not encrypted, no action needed
      return null;
    }

    // Decrypt using password
    const decryptedStr = decryptWithPassword(data, password);
    if (!decryptedStr) {
      console.warn('[wallet] failed to decrypt PQC keys');
      return null;
    }

    const decryptedKeys = JSON.parse(decryptedStr);
    
    // Save decrypted version temporarily
    const backup = JSON.stringify(data);
    fs.writeFileSync(keysFile, JSON.stringify(decryptedKeys, null, 2), 'utf8');

    // Return cleanup function
    return () => {
      try {
        fs.writeFileSync(keysFile, backup, 'utf8');
      } catch (e) {
        console.error('[wallet] failed to restore encrypted PQC keys', e);
      }
    };
  } catch (e) {
    console.error('[wallet] error in tempDecryptPqcKeys', e);
    return null;
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

function profilesFilePath() {
  return userDataPath('profiles.json');
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
    if (!mnemonic) throw new Error('Failed to decrypt keystore with password');
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

/**
 * Check if PQC keys are password-encrypted
 */
function arePqcKeysEncrypted() {
  const keysFile = path.join(userDataPath('pqc_keys'), 'keys.json');
  if (!fs.existsSync(keysFile)) return false;
  
  try {
    const data = readJson(keysFile, null);
    return data && data._encrypted === true;
  } catch {
    return false;
  }
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
  // Reuse same peers.txt logic as chain.cjs, but inline minimal version here
  // to avoid circular dependencies.
  let rpc = null;
  let rest = null;
  const peersFile = resolvePeersFilePath();
  if (!peersFile) return '';
  try {
    const raw = fs.readFileSync(peersFile, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = String(line || '').replace(/#.*/, '').trim();
      if (!cleaned) continue;
      const parts = cleaned.split(/[\s,]+/).filter(Boolean);
      if (!parts.length) continue;
      rpc = parts[0] || null;
      rest = parts[1] || null;
      break;
    }
  } catch {}
  const ensureHttp = (u) => {
    const trimmed = String(u || '').replace(/\/+$/, '');
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  };
  if (rest) return ensureHttp(rest);
  if (!rpc) return '';
  try {
    const base = ensureHttp(rpc);
    const url = new URL(base);
    const port = Number(url.port || '');
    if (port === 26657) {
      url.port = '1317';
    }
    return String(url.toString()).replace(/\/+$/, '');
  } catch {
    return ensureHttp(rpc);
  }
}

function getRpcBaseUrl() {
  const peersFile = resolvePeersFilePath();
  if (!peersFile) return '';
  try {
    const raw = fs.readFileSync(peersFile, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = String(line || '').replace(/#.*/, '').trim();
      if (!cleaned) continue;
      const parts = cleaned.split(/[\s,]+/).filter(Boolean);
      if (!parts.length) continue;
      const rpc = parts[0] || null;
      if (!rpc) continue;
      const trimmed = String(rpc || '').replace(/\/+$/, '');
      return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    }
  } catch {}
  return '';
}

function hashHex(data) {
  return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
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
    (bridgeMod.utils && bridgeMod.utils.zeroFee) ||
    (() => ({ amount: [], gas: '250000' }));
  const msg = pqcModule.msgLinkAccountPqc(address, {
    scheme: record.scheme,
    pubKey: record.publicKey,
    powNonce
  });
  const res = await runWithRpcRetry(
    () => client.signAndBroadcast(address, [msg], zeroFee()),
    'pqc_link'
  );
  if (res.code !== 0) {
    throw new Error(res.rawLog || `link-account PQC failed (code ${res.code})`);
  }
}

function registerWalletIpc() {
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) return { ok: false, error: 'rpc_base_missing' };

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const connectPromise = mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
        pqc: {
          homeDir: resolvePqcHome()
        }
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
      );
      
      console.log('[wallet:sendTokens] connecting to client...');
      const client = await Promise.race([connectPromise, timeoutPromise]);
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
        console.log('[wallet:sendTokens] calling ensureLocalPqcKey...');
        const pqcLocal = await ensureLocalPqcKey(mod, client, profileId, from);
        console.log('[wallet:sendTokens] pqcLocal:', pqcLocal);
        
        if (pqcLocal && pqcLocal.record) {
          console.log('[wallet:sendTokens] calling ensureOnChainPqcLink...');
          await ensureOnChainPqcLink(mod, client, from, pqcLocal.record);
          console.log('[wallet:sendTokens] ensureOnChainPqcLink done');
        }

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

        console.log('[wallet:sendTokens] calling signAndBroadcast...');
        const res = await client.signAndBroadcast(from, [msg], zeroFee(), memo);
        console.log('[wallet:sendTokens] signAndBroadcast result:', res);
        
        if (res.code !== 0) {
          throw new Error(res.rawLog || `broadcast failed (code ${res.code})`);
        }
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
      return { ok: false, error: String(e && e.message ? e.message : e) };
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) {
        return { ok: false, error: 'rpc_base_missing' };
      }

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        undefined,
        {
          pqc: {
            homeDir: resolvePqcHome()
          }
        }
      );

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
        const pqcLocal = await ensureLocalPqcKey(mod, client, profileId, owner);
        if (pqcLocal && pqcLocal.record) {
          await ensureOnChainPqcLink(mod, client, owner, pqcLocal.record);
        }
      } catch (err) {
        console.warn(
          '[dns] ensure PQC link failed',
          err && err.message ? err.message : err
        );
      } finally {
        if (cleanupPqc) cleanupPqc();
      }

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
      const res = await client.signAndBroadcast(owner, [msg], zeroFee(), memo);
      if (res.code !== 0) {
        return {
          ok: false,
          error: res.rawLog || `broadcast failed (code ${res.code})`
        };
      }
      const txhash = res.transactionHash || res.hash || '';
      return { ok: true, txhash };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) {
        return { ok: false, error: 'rpc_base_missing' };
      }

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        undefined,
        {
          pqc: {
            homeDir: resolvePqcHome()
          }
        }
      );

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
        const pqcLocal = await ensureLocalPqcKey(mod, client, profileId, owner);
        if (pqcLocal && pqcLocal.record) {
          await ensureOnChainPqcLink(mod, client, owner, pqcLocal.record);
        }
      } catch (err) {
        console.warn(
          '[dns] ensure PQC link (update) failed',
          err && err.message ? err.message : err
        );
      } finally {
        if (cleanupPqc) cleanupPqc();
      }

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
        const rest = restBase || rpcBase;
        const url = `${String(rest).replace(/\/+$/, '')}/lumen/dns/v1/params`;
        const prs = await httpGet(url, { timeout: 5000 });
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
      const res = await client.signAndBroadcast(owner, [msg], zeroFee(), memo);
      if (res.code !== 0) {
        return {
          ok: false,
          error: res.rawLog || `broadcast failed (code ${res.code})`
        };
      }
      const txhash = res.transactionHash || res.hash || '';
      return { ok: true, txhash };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) return { ok: false, error: 'rpc_base_missing' };

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
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

        const res = await client.signAndBroadcast(address, [msg], zeroFee(), '');
        
        if (res.code !== 0) {
          throw new Error(res.rawLog || `delegate failed (code ${res.code})`);
        }
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) return { ok: false, error: 'rpc_base_missing' };

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
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

        const res = await client.signAndBroadcast(address, [msg], zeroFee(), '');
        
        if (res.code !== 0) {
          throw new Error(res.rawLog || `undelegate failed (code ${res.code})`);
        }
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) return { ok: false, error: 'rpc_base_missing' };

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
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

        const res = await client.signAndBroadcast(address, [msg], zeroFee(), '');
        
        if (res.code !== 0) {
          throw new Error(res.rawLog || `redelegate failed (code ${res.code})`);
        }
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

      const rpcBase = getRpcBaseUrl();
      const restBase = getRestBaseUrl();
      if (!rpcBase) return { ok: false, error: 'rpc_base_missing' };

      const endpoints = {
        rpc: rpcBase,
        rest: restBase || rpcBase,
        rpcEndpoint: rpcBase,
        restEndpoint: restBase || rpcBase
      };

      const client = await mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
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

        const res = await client.signAndBroadcast(address, [msg], zeroFee(), '');
        
        if (res.code !== 0) {
          throw new Error(res.rawLog || `withdraw rewards failed (code ${res.code})`);
        }
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

module.exports = {
  registerWalletIpc
};
