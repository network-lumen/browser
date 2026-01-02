const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Buffer } = require('buffer');
const { userDataPath, readJson } = require('../utils/fs.cjs');
const { decryptMnemonicLocal } = require('../utils/crypto.cjs');
const { runWithRpcRetry } = require('../utils/tx.cjs');
let pqcWorker = null;
try {
  pqcWorker = require('../utils/pqc-worker.cjs');
} catch {
  pqcWorker = null;
}

let bridge = null;

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

function loadMnemonic(profileId) {
  const file = keystoreFile(profileId);
  const ks = readJson(file, null);
  if (!ks) throw new Error(`No keystore for profileId=${profileId}`);
  const mnemonic = decryptMnemonicLocal(ks);
  if (!mnemonic) throw new Error('Failed to decrypt keystore');
  return mnemonic;
}

function resolvePqcHome() {
  if (process.env.LUMEN_PQC_HOME) return process.env.LUMEN_PQC_HOME;
  // Store PQC data alongside other app metadata in the app's userData folder.
  // PqcKeyStore itself will create/use a "pqc_keys" subdirectory inside this base path.
  return userDataPath();
}

function getRestBaseUrl() {
  // Reuse same peers.txt logic as chain.cjs, but inline minimal version here
  // to avoid circular dependencies.
  const appPath = require('electron').app.getAppPath();
  const candidates = [
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'),
    path.join(process.cwd(), 'resources', 'peers.txt')
  ];
  let rpc = null;
  let rest = null;
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, 'utf8');
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
    if (rpc || rest) break;
  }
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
  const appPath = require('electron').app.getAppPath();
  const candidates = [
    path.join(appPath, 'resources', 'peers.txt'),
    path.join(appPath, '..', 'resources', 'peers.txt'),
    path.join(process.cwd(), 'resources', 'peers.txt')
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, 'utf8');
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
  }
  return '';
}

function hashHex(data) {
  return crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
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
      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!from || !to || !(amount > 0)) return { ok: false, error: 'missing_from_to_amount' };

      const mnemonic = loadMnemonic(profileId);

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const prefixMatch = from.match(/^([a-z0-9]+)1/i);
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

      const client = await mod.LumenSigningClient.connectWithSigner(signer, endpoints, undefined, {
        pqc: {
          homeDir: resolvePqcHome()
        }
      });

      const pqcLocal = await ensureLocalPqcKey(mod, client, profileId, from);
      if (pqcLocal && pqcLocal.record) {
        await ensureOnChainPqcLink(mod, client, from, pqcLocal.record);
      }

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

      // Align with SDK helpers: avoid CosmJS "auto" fee mode that requires gasPrice,
      // and instead use the SDK's zeroFee helper. Taxation on Lumen is handled by
      // tokenomics (tx_tax_rate), not by per-gas coin fees.
      const zeroFee =
        (mod.utils && mod.utils.gas && mod.utils.gas.zeroFee) ||
        (mod.utils && mod.utils.zeroFee) ||
        (() => ({ amount: [], gas: '250000' }));

      const res = await client.signAndBroadcast(from, [msg], zeroFee(), memo);
      if (res.code !== 0) {
        throw new Error(res.rawLog || `broadcast failed (code ${res.code})`);
      }
      const txhash = res.transactionHash || res.hash || '';
      return { ok: true, txhash };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });
}

module.exports = {
  registerWalletIpc
};
