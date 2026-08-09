// PQC dual-signer plumbing shared by every main-process module that signs a
// Lumen transaction (`ipc/wallet.cjs`, `ipc/gateway.cjs`).
//
// It used to live twice, copy-pasted, and the two copies had silently drifted:
// only the wallet one broadcast through the network middleware, only the wallet
// one polled the link through the peer pool, and only the gateway one accepted
// `utils.gas.zeroFee`. This module is the single behaviour - the union of what
// each copy did right.
//
// The chain refuses a tx from an account with no Dilithium key linked on-chain,
// so the whole flow is: make sure a local key exists -> make sure it is linked
// -> only then build and broadcast the real message.
const { BrowserWindow } = require('electron');
const { sha256Hex } = require('./crypto.cjs');
const { userDataPath } = require('./fs.cjs');
const { runWithRpcRetry } = require('./tx.cjs');
const { readState, broadcastTx } = require('../network/network_middleware.cjs');

let pqcWorker = null;
try {
  pqcWorker = require('./pqc-worker.cjs');
} catch {
  pqcWorker = null;
}

const WALLET_ACTIVATION_TOOLTIP = 'To be activated, you must make your first transaction (buy domain/send token etc..) with a minimum of 0.001 LMN in your wallet';

function resolvePqcHome() {
  if (process.env.LUMEN_PQC_HOME) return process.env.LUMEN_PQC_HOME;
  return userDataPath();
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

function broadcastPqcLinked(payload) {
  try {
    const wins = typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const w of wins) {
      try {
        w?.webContents?.send?.('profiles:pqcLinked', payload);
      } catch {}
    }
  } catch {}
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

function resolveZeroFee(bridgeMod) {
  return (
    (bridgeMod && bridgeMod.utils && bridgeMod.utils.gas && bridgeMod.utils.gas.zeroFee) ||
    (bridgeMod && bridgeMod.utils && bridgeMod.utils.zeroFee) ||
    (() => ({ amount: [], gas: '250000' }))
  );
}

// Sign locally, then push the bytes through the peer pool rather than the
// single RPC the signing client happens to be bound to. Clients that expose no
// separate `sign()` fall back to their own signAndBroadcast.
async function signAndBroadcastViaPool(client, address, msgs, fee, memo, fallbackError) {
  if (client && typeof client.sign === 'function') {
    const { TxRaw } = require('cosmjs-types/cosmos/tx/v1beta1/tx');
    const txRaw = await client.sign(address, msgs, fee, memo);
    const txBytes = TxRaw.encode(txRaw).finish();
    const r = await broadcastTx(txBytes, { confirmTimeoutMs: 60_000 });
    if (!r || !r.ok) {
      const err = new Error(String((r && (r.rawLog || r.error)) || fallbackError));
      err.txhash = r && r.transactionHash ? r.transactionHash : '';
      throw err;
    }
    return { ...r, code: r.code || 0, rawLog: r.rawLog || '', transactionHash: r.transactionHash };
  }
  return client.signAndBroadcast(address, msgs, fee, memo);
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
  // Tracks whether this call generated brand-new Dilithium private key
  // material (as opposed to reusing/relinking a key that already existed on
  // disk). This is the signal the caller uses to force the "export your PQC
  // key now" warning - it must fire regardless of whether the on-chain link
  // that follows succeeds, since the unrecoverable risk is losing this local
  // file, not the on-chain link state.
  let createdNew = false;
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
        if (sha256Hex(k.publicKey).toLowerCase() === t) return k;
      } catch {}
    }
    return null;
  };

  if (record && onChain.linked && onChain.pubKeyHash) {
    try {
      const localHash = sha256Hex(record.publicKey).toLowerCase();
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
      } else if (allKeys.length > 0) {
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

    if (!record && onChain.linked) {
      throw new Error(
        'Signer already has a PQC key on-chain but no matching local PQC key is available. Import the dual-signer backup (pqc_keys + dual-signer.json).'
      );
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
        createdNew = true;
      } else {
        record = normalize(record);
      }
      await store.linkAddress(address, keyName);
    }
  }

  if (onChain.linked && onChain.pubKeyHash && record) {
    const localHash = sha256Hex(record.publicKey).toLowerCase();
    const onChainHash = normalizeHashString(onChain.pubKeyHash);
    if (localHash !== onChainHash) {
      console.warn('[pqc-local] hash mismatch', {
        address,
        keyName,
        localHash,
        onChainHash,
        keys: allKeys.map((k) => ({ name: k && k.name, hash: sha256Hex(k.publicKey) }))
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

  return { keyName, record, store, createdNew };
}

async function ensureOnChainPqcLink(bridgeMod, client, address, record, label) {
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

  const zeroFee = resolveZeroFee(bridgeMod);
  const msg = pqcModule.msgLinkAccountPqc(address, {
    scheme: record.scheme,
    pubKey: record.publicKey,
    powNonce
  });

  const res = await runWithRpcRetry(
    () =>
      signAndBroadcastViaPool(client, address, [msg], zeroFee(), '', 'pqc_link_broadcast_failed'),
    label ? `pqc_link:${label}` : 'pqc_link'
  );
  if (res.code !== 0) {
    throw new Error(res.rawLog || `link-account PQC failed (code ${res.code})`);
  }
  return true;
}

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
    msg.includes('not found in local store') ||
    msg.includes('local store') ||
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

async function ensurePqcLinkedBeforeSigning(bridgeMod, client, profileId, address, label) {
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

  // Fire the "export your PQC key" notice as soon as we know brand-new
  // Dilithium key material now sits on disk - BEFORE attempting the
  // on-chain link below, and independent of whether that link submits,
  // broadcasts, or confirms in time. Losing this local file with no
  // backup is unrecoverable, so the user must be warned even if the
  // link itself later throws (e.g. insufficient balance, RPC hiccup) -
  // gating the notice on full on-chain confirmation (as before) meant a
  // slow/failed link silently dropped the warning entirely.
  if (pqcLocal && pqcLocal.createdNew) {
    broadcastPqcLinked({
      profileId: String(profileId || '').trim(),
      address: String(address || '').trim()
    });
  }

  if (pqcLocal && pqcLocal.record) {
    const didLink = await ensureOnChainPqcLink(bridgeMod, client, address, pqcLocal.record, label);
    if (didLink && !pqcLocal.createdNew) {
      // An already-existing local key just got linked on-chain for the
      // first time - also worth a reminder in case it was never
      // exported after being created.
      broadcastPqcLinked({
        profileId: String(profileId || '').trim(),
        address: String(address || '').trim()
      });
    }
    if (didLink) {
      await waitForPqcLinkCommit(address).catch(() => false);
    }
  }
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
    const res = await signAndBroadcastViaPool(
      client,
      address,
      msgs,
      fee,
      memo,
      'broadcast_failed'
    );
    if (res && typeof res.code === 'number' && res.code !== 0) {
      const raw = res.rawLog || `broadcast failed (code ${res.code})`;
      const err = new Error(String(raw));
      err.txhash = res.transactionHash || res.txhash || res.hash || '';
      throw err;
    }
    return res;
  };

  // Preflight: check on-chain whether this address already has a PQC key
  // linked BEFORE ever touching the real message, instead of signing it
  // blindly, catching the resulting "no PQC key linked" error, linking, and
  // retrying the SAME broadcast call. That reactive approach reused a
  // signing client whose internal PQC store/param/sequence caching
  // (@lumen-chain/sdk's LumenSigningClient) isn't designed to be safely
  // "hot swapped" mid-flight, and in practice could let the real message
  // get broadcast with a stale signing context right after the link tx -
  // link and real message ended up as two separate, correctly-ordered
  // transactions, but the send was the fragile one riding on leftover state
  // from the link. Checking first and linking to completion before ever
  // building the real message avoids that whole class of ordering bugs.
  try {
    const onChain = await fetchOnChainPqcStatus(client, address);
    if (!onChain.linked) {
      await ensurePqcLinkedBeforeSigning(bridgeMod, client, profileId, address, label);
    }
  } catch (linkErr) {
    const linkMsg = String(linkErr && linkErr.message ? linkErr.message : linkErr);
    throw new Error(sanitizePqcErrorMessage(linkMsg));
  }

  try {
    return await broadcastOnce();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!isPqcRelatedErrorText(msg)) {
      throw e;
    }

    // Fallback safety net for cases outside the preflight's ability to
    // detect (e.g. a wallet restored from a bare mnemonic import, where the
    // address is already linked on-chain but no matching local PQC key
    // exists yet) - give linking one more shot, then give up with a clear
    // error rather than looping on an unrecoverable local/on-chain mismatch.
    try {
      await ensurePqcLinkedBeforeSigning(bridgeMod, client, profileId, address, label);
    } catch (linkErr) {
      const linkMsg = String(linkErr && linkErr.message ? linkErr.message : linkErr);
      throw new Error(sanitizePqcErrorMessage(linkMsg));
    }

    try {
      return await broadcastOnce();
    } catch (e2) {
      const msg2 = String(e2 && e2.message ? e2.message : e2);
      throw new Error(sanitizePqcErrorMessage(msg2));
    }
  }
}

module.exports = {
  WALLET_ACTIVATION_TOOLTIP,
  resolvePqcHome,
  normalizeHashString,
  fetchOnChainPqcStatus,
  loadPqcParams,
  ensureLocalPqcKey,
  ensureOnChainPqcLink,
  ensurePqcLinkedBeforeSigning,
  waitForPqcLinkCommit,
  isPqcRelatedErrorText,
  isActivationBalanceErrorText,
  sanitizePqcErrorMessage,
  signAndBroadcastWithPqcAutoLink
};
