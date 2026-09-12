const { ipcMain } = require('electron');
const { Buffer } = require('buffer');
const Long = require('long');
const { getNetworkPool } = require('../daemons/peers/pool_singleton.cjs');
const { readState } = require('../chain/client.cjs');
const { userDataPath, readJson } = require('../utils/fs.cjs');
const { decryptMnemonicLocal, decryptMnemonicWithPassword, isPasswordProtected, sha256 } = require('../utils/crypto.cjs');
const { arePqcKeysEncrypted, tempDecryptPqcKeys } = require('../utils/pqc-keys.cjs');
const { zeroFee, toBaseUnits, describeBroadcastFailure } = require('../utils/tx.cjs');
const { leadingZeroBits } = require('../utils/pow.cjs');
const { camelizeKeysDeep } = require('../utils/strings.cjs');
const { isPasswordRequired, getSessionPassword, verifyStoredPassword } = require('./security.cjs');
const { DEFAULT_BECH32_PREFIXES } = require('../extensions/wallet_injection.cjs');
const { resolvePqcHome, signAndBroadcastWithPqcAutoLink } = require('../utils/pqc_link.cjs');

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

// Derives a module's governance-authority address the same way the chain
// does (sha256("gov") truncated to 20 bytes, bech32-encoded) - used to sign
// authority-gated messages (MsgUpdateParams, MsgValidateRelease, etc.) that
// get wrapped in a MsgSubmitProposal, without needing a REST round-trip.
function moduleAddressBech32(moduleName, bech32Prefix) {
  const bech32 = require('bech32');
  if (!bech32 || typeof bech32.encode !== 'function' || typeof bech32.toWords !== 'function') {
    throw new Error('bech32_unavailable');
  }
  const hash = sha256(String(moduleName || ''), { bytes: true }).subarray(0, 20);
  return bech32.encode(String(bech32Prefix || 'lmn'), bech32.toWords(hash));
}

// The @lumen-chain/sdk client doesn't expose a stable public property for
// its internal protobuf registry, so probe the handful of shapes it (or a
// standard cosmjs SigningStargateClient) might use.
function getRegistryForEncode(client) {
  const candidates = [
    client?._registry,
    client?.registry,
    client?.protoRegistry,
    client?.signing?.protoRegistry,
    client?.stargate?.registry,
    client?.signingClient?.registry,
    client?.client?.registry
  ].filter(Boolean);
  return candidates.find((r) => typeof r.encode === 'function') || null;
}

async function connectSigningClientWithFailover(mod, signer, connectArgs, { timeoutMs = 15_000 } = {}) {
  const pool = getNetworkPool();

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
    const chainId = String(peer.chainId || pool.networkChainId || '').trim() || undefined;

    try {
      const connectPromise = mod.LumenSigningClient.connectWithSigner(
        signer,
        endpoints,
        chainId,
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

function isNativeLumenSigningTarget({ chainId, address, feeDenom } = {}) {
  const cid = String(chainId || '').trim().toLowerCase();
  if (cid.includes('lumen')) return true;

  const prefix = normalizeBech32Prefix(prefixFromAddress(address), '');
  if (prefix === 'lmn') return true;

  const fee = String(feeDenom || '').trim().toLowerCase();
  if (fee === 'ulmn' || fee === 'ulumen') return true;

  return false;
}

async function connectStandardSigningClient(endpoint, signer, { timeoutMs = 15_000 } = {}) {
  const rpcEndpoint = String(endpoint || '').trim();
  if (!rpcEndpoint) throw new Error('missing_rpc_endpoint');

  const { SigningStargateClient } = require('@cosmjs/stargate');
  const connectPromise = SigningStargateClient.connectWithSigner(rpcEndpoint, signer);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return await Promise.race([connectPromise, timeoutPromise]);
}

// The 13 handlers below that broadcast all answer an unconfirmable broadcast
// the same way; the wording and the "is a retry safe" verdict live in
// utils/tx.cjs, next to the code that establishes it.
const indexingDisabledResult = describeBroadcastFailure;

/**
 * What a *site* is told when a wallet call fails.
 *
 * The six channels below are reachable only from webview-preload - they are
 * the Keplr/Leap shim, so the caller is whatever page the user is visiting.
 * Handing that page `String(e.message)` hands it whatever the failure happened
 * to say, and the realistic ones name a file: an ENOENT on keystore.json
 * discloses the OS username and the profile layout to any site that asks.
 *
 * The detail still goes to the log, where it is useful and stays local.
 */
function siteFacingWalletError(label, error) {
  console.warn(`[wallet] ${label} failed:`, error && error.message ? error.message : error);
  return { ok: false, error: 'wallet_request_failed' };
}

async function signAndBroadcastStandard({ client, address, msgs, fee, memo }) {
  const res = await client.signAndBroadcast(address, msgs, fee, memo);
  if (res && typeof res.code === 'number' && res.code !== 0) {
    const raw = res.rawLog || `broadcast failed (code ${res.code})`;
    const err = new Error(String(raw));
    err.txhash = res.transactionHash || res.txhash || res.hash || '';
    throw err;
  }
  return res;
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

function profilesFile() {
  return userDataPath('profiles.json');
}

function loadProfilesSnapshot() {
  const data = readJson(profilesFile(), { profiles: [], activeId: '' }) || {};
  return {
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    activeId: String(data.activeId || '').trim()
  };
}

function getActiveProfileSnapshot() {
  const { profiles, activeId } = loadProfilesSnapshot();
  return (
    profiles.find((profile) => String(profile?.id || '').trim() === activeId) ||
    profiles[0] ||
    null
  );
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

function prefixFromAddress(address) {
  const a = String(address || '').trim();
  const i = a.indexOf('1');
  return i > 0 ? a.slice(0, i) : 'lmn';
}

function normalizeBech32Prefix(input, fallback = 'lmn') {
  const prefix = String(input || '').trim().toLowerCase();
  return /^[a-z0-9]{2,32}$/.test(prefix) ? prefix : String(fallback || 'lmn').trim().toLowerCase();
}

function buildBech32Config(prefix) {
  const base = normalizeBech32Prefix(prefix || DEFAULT_BECH32_PREFIXES.accountAddress || 'lmn');
  const validatorBase = `${base}valoper`;
  const consensusBase = `${base}valcons`;
  return {
    bech32PrefixAccAddr: base,
    bech32PrefixAccPub: `${base}pub`,
    bech32PrefixValAddr: validatorBase,
    bech32PrefixValPub: `${validatorBase}pub`,
    bech32PrefixConsAddr: consensusBase,
    bech32PrefixConsPub: `${consensusBase}pub`
  };
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Buffer.isBuffer(value)) return new Uint8Array(value);
  if (Array.isArray(value)) {
    return Uint8Array.from(
      value.map((item) => {
        const n = Number(item);
        return Number.isFinite(n) ? Math.max(0, Math.min(255, Math.trunc(n))) : 0;
      })
    );
  }
  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Uint8Array.from(value.data);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Uint8Array();
    try {
      return new Uint8Array(Buffer.from(trimmed, 'base64'));
    } catch {
      return new Uint8Array();
    }
  }
  return new Uint8Array();
}

function toBigIntSafe(value, fallback = 0n) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.max(0, Math.trunc(value)));
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    return BigInt(raw);
  } catch {
    return fallback;
  }
}

function normalizeAminoPubkey(pubkey) {
  const key = pubkey && typeof pubkey === 'object' ? pubkey : {};
  return {
    type: String(key.type || 'tendermint/PubKeySecp256k1'),
    value: String(key.value || '')
  };
}

function normalizeStdSignature(signature) {
  const sig = signature && typeof signature === 'object' ? signature : {};
  return {
    pub_key: normalizeAminoPubkey(sig.pub_key),
    signature: String(sig.signature || '')
  };
}

function normalizeDirectSignResponse(response) {
  const result = response && typeof response === 'object' ? response : {};
  const signature = result.signature && typeof result.signature === 'object' ? result.signature : {};
  const signed = result.signed && typeof result.signed === 'object' ? result.signed : {};
  return {
    signed: {
      chainId: String(signed.chainId || ''),
      accountNumber: String(signed.accountNumber ?? '0'),
      bodyBytes: Array.from(normalizeBytes(signed.bodyBytes)),
      authInfoBytes: Array.from(normalizeBytes(signed.authInfoBytes))
    },
    signature: {
      pub_key: normalizeAminoPubkey(signature.pub_key),
      signature: String(signature.signature || '')
    }
  };
}

async function resolveProfileContext(profileIdInput) {
  const requested = String(profileIdInput || '').trim();
  if (requested) {
    const { profiles } = loadProfilesSnapshot();
    const profile = profiles.find((item) => String(item?.id || '').trim() === requested) || null;
    if (!profile) throw new Error('profile_not_found');
    return { profileId: requested, profile };
  }

  const active = getActiveProfileSnapshot();
  if (!active) throw new Error('active_profile_missing');
  return {
    profileId: String(active.id || '').trim(),
    profile: active
  };
}

async function buildSignerForProfileContext(profileIdInput, bech32PrefixInput, password) {
  const { profileId, profile } = await resolveProfileContext(profileIdInput);
  const walletAddress = String(profile?.walletAddress || profile?.address || '').trim();
  const prefix = normalizeBech32Prefix(bech32PrefixInput || prefixFromAddress(walletAddress) || 'lmn');

  let mnemonic;
  try {
    mnemonic = loadMnemonic(profileId, password);
  } catch (loadErr) {
    const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
    if (errMsg === 'password_required') throw new Error('password_required');
    if (errMsg === 'invalid_password') throw new Error('invalid_password');
    throw new Error(errMsg || 'mnemonic_unavailable');
  }

  const mod = await loadBridge();
  if (!mod || !mod.walletFromMnemonic) {
    throw new Error('wallet_bridge_unavailable');
  }

  const signer = await mod.walletFromMnemonic(mnemonic, prefix);
  const rawAccounts = await signer.getAccounts();
  const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
  const account = accounts[0] || null;
  if (!account) throw new Error('wallet_account_unavailable');

  return {
    profileId,
    profile,
    signer,
    account,
    bech32Prefix: prefix
  };
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
  const { ripemd160 } = require('@cosmjs/crypto');
  const bech32 = require('bech32');
  if (!bech32 || typeof bech32.encode !== 'function' || typeof bech32.toWords !== 'function') {
    throw new Error('bech32_unavailable');
  }
  const hash = Buffer.from(ripemd160(sha256(pubkeyCompressed, { bytes: true })));
  return bech32.encode(String(prefix || 'lmn'), bech32.toWords(hash));
}

async function mineUpdatePowNonce(identifier, creator, bits, budgetMs = 2500) {
  identifier = String(identifier || '');
  creator = String(creator || '');
  const end = Date.now() + Math.max(200, budgetMs | 0);
  let nonce = Long.fromNumber(0, true);

  if (!bits || bits <= 0) {
    const payload = `${identifier}|${creator}|${nonce.toString()}`;
    const h = sha256(payload, { bytes: true });
    return { nonce, hashHex: Buffer.from(h).toString('hex') };
  }

  while (Date.now() < end) {
    const payload = `${identifier}|${creator}|${nonce.toString()}`;
    const h = sha256(payload, { bytes: true });
    if (leadingZeroBits(h) >= bits) {
      return { nonce, hashHex: Buffer.from(h).toString('hex') };
    }
    nonce = nonce.add(1);
  }
  return null;
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
      // Exponent and raw text come from the caller: the chain decides the
      // former, and the latter keeps a long decimal exact where a float would
      // already have rounded it. Both default to the pre-existing behaviour.
      const decimals = Number.isFinite(Number(input && input.decimals)) ? Number(input.decimals) : 6;
      const amountText = String(input && input.amountText ? input.amountText : '').trim();
      const memo = String(input && input.memo ? input.memo : '');
      const denom = String(input && input.denom ? input.denom : 'ulmn');
      const rpcEndpoint = String(input && input.rpcEndpoint ? input.rpcEndpoint : '').trim();
      const restEndpoint = String(input && input.restEndpoint ? input.restEndpoint : '').trim();
      const chainId = String(input && input.chainId ? input.chainId : '').trim();
      const feeDenom = String(input && input.feeDenom ? input.feeDenom : 'ulmn').trim() || 'ulmn';
      const feeAmount = String(input && input.feeAmount ? input.feeAmount : '1000').trim() || '1000';
      const feeGas = String(input && input.feeGas ? input.feeGas : '250000').trim() || '250000';
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
      const useRemoteStandardClient =
        !!rpcEndpoint &&
        !isNativeLumenSigningTarget({
          chainId,
          address: from,
          feeDenom
        });

      console.log('[wallet:sendTokens] connecting to client...');
      let client;
      if (useRemoteStandardClient) {
        client = await connectStandardSigningClient(rpcEndpoint, signer, { timeoutMs: 15_000 });
      } else if (rpcEndpoint) {
        const endpoints = {
          rpc: rpcEndpoint,
          rest: restEndpoint || rpcEndpoint,
          rpcEndpoint,
          restEndpoint: restEndpoint || rpcEndpoint
        };
        const connectPromise = mod.LumenSigningClient.connectWithSigner(
          signer,
          endpoints,
          chainId || undefined,
          {
            pqc: {
              homeDir: resolvePqcHome()
            }
          }
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 15000ms')), 15_000)
        );
        client = await Promise.race([connectPromise, timeoutPromise]);
      } else {
        client = await connectSigningClientWithFailover(
          mod,
          signer,
          {
            pqc: {
              homeDir: resolvePqcHome()
            }
          },
          { timeoutMs: 15_000 }
        );
      }
      console.log('[wallet:sendTokens] connected, client:', client ? 'ok' : 'null');

      // Temporarily decrypt PQC keys if password-protected
      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      const keysEncrypted = arePqcKeysEncrypted();
      console.log('[wallet:sendTokens] keysEncrypted:', keysEncrypted, 'hasPassword:', !!password, 'hasSession:', !!getSessionPassword());
      if (!useRemoteStandardClient && keysEncrypted) {
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
        const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx');
        const micro = toBaseUnits(amountText || amount, decimals);
        
        const msg = {
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: MsgSend.fromPartial({
            fromAddress: from,
            toAddress: to,
            amount: [{ denom, amount: String(micro) }]
          })
        };

        const fee = useRemoteStandardClient
          ? {
              amount: [{ denom: feeDenom, amount: feeAmount }],
              gas: feeGas
            }
          : zeroFee();
        console.log('[wallet:sendTokens] broadcasting via', useRemoteStandardClient ? 'standard client' : 'PQC middleware');
        const res = useRemoteStandardClient
          ? await signAndBroadcastStandard({
              client,
              address: from,
              msgs: [msg],
              fee,
              memo
            })
          : await signAndBroadcastWithPqcAutoLink({
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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;

      const raw = String(e && e.message ? e.message : e);

      // Log error without stack trace for expected errors
      console.error('[wallet:sendTokens] error:', e);
      
      // Only log stack trace for unexpected errors
      if (!raw.includes('404') && !raw.includes('transaction indexing')) {
        console.error('[wallet:sendTokens] stack:', e && e.stack ? e.stack : 'no stack');
      }
      
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  ipcMain.handle('wallet:ibcTransfer', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const from = String(input && input.from ? input.from : '').trim();
      const to = String(input && input.to ? input.to : '').trim();
      const amount = Number(input && input.amount ? input.amount : 0);
      // Exponent and raw text come from the caller: the chain decides the
      // former, and the latter keeps a long decimal exact where a float would
      // already have rounded it. Both default to the pre-existing behaviour.
      const decimals = Number.isFinite(Number(input && input.decimals)) ? Number(input.decimals) : 6;
      const amountText = String(input && input.amountText ? input.amountText : '').trim();
      const memo = String(input && input.memo ? input.memo : '');
      const denom = String(input && input.denom ? input.denom : 'ulmn');
      const sourcePort = String(input && input.sourcePort ? input.sourcePort : 'transfer').trim() || 'transfer';
      const sourceChannel = String(input && input.sourceChannel ? input.sourceChannel : '').trim();
      const timeoutSecondsRaw = Number(input && input.timeoutSeconds ? input.timeoutSeconds : 600);
      const timeoutSeconds = Number.isFinite(timeoutSecondsRaw) && timeoutSecondsRaw > 0 ? timeoutSecondsRaw : 600;
      const rpcEndpoint = String(input && input.rpcEndpoint ? input.rpcEndpoint : '').trim();
      const restEndpoint = String(input && input.restEndpoint ? input.restEndpoint : '').trim();
      const chainId = String(input && input.chainId ? input.chainId : '').trim();
      const feeDenom = String(input && input.feeDenom ? input.feeDenom : 'ulmn').trim() || 'ulmn';
      const feeAmount = String(input && input.feeAmount ? input.feeAmount : '1000').trim() || '1000';
      const feeGas = String(input && input.feeGas ? input.feeGas : '350000').trim() || '350000';
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!from || !to || !(amount > 0)) return { ok: false, error: 'missing_from_to_amount' };
      if (!sourceChannel) return { ok: false, error: 'missing_sourceChannel' };

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

      const prefix = prefixFromAddress(from);
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);
      const useRemoteStandardClient =
        !!rpcEndpoint &&
        !isNativeLumenSigningTarget({
          chainId,
          address: from,
          feeDenom
        });

      let client;
      if (useRemoteStandardClient) {
        client = await connectStandardSigningClient(rpcEndpoint, signer, { timeoutMs: 15_000 });
      } else if (rpcEndpoint) {
        const endpoints = {
          rpc: rpcEndpoint,
          rest: restEndpoint || rpcEndpoint,
          rpcEndpoint,
          restEndpoint: restEndpoint || rpcEndpoint
        };
        const connectPromise = mod.LumenSigningClient.connectWithSigner(
          signer,
          endpoints,
          chainId || undefined,
          {
            pqc: {
              homeDir: resolvePqcHome()
            }
          }
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 15000ms')), 15_000)
        );
        client = await Promise.race([connectPromise, timeoutPromise]);
      } else {
        client = await connectSigningClientWithFailover(
          mod,
          signer,
          {
            pqc: {
              homeDir: resolvePqcHome()
            }
          },
          { timeoutMs: 15_000 }
        );
      }

      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      if (!useRemoteStandardClient && arePqcKeysEncrypted()) {
        if (!effectivePassword) {
          return { ok: false, error: 'password_required' };
        }
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) {
          return { ok: false, error: 'invalid_password' };
        }
      }

      try {
        const { MsgTransfer } = await import('cosmjs-types/ibc/applications/transfer/v1/tx');
        const micro = toBaseUnits(amountText || amount, decimals);
        const timeoutTimestamp = BigInt(Date.now() + timeoutSeconds * 1000) * 1_000_000n;

        const msg = {
          typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
          value: MsgTransfer.fromPartial({
            sourcePort,
            sourceChannel,
            token: { denom, amount: String(micro) },
            sender: from,
            receiver: to,
            timeoutTimestamp,
            memo
          })
        };

        const fee = {
          amount: [{ denom: feeDenom, amount: feeAmount }],
          gas: feeGas
        };
        const res = useRemoteStandardClient
          ? await signAndBroadcastStandard({
              client,
              address: from,
              msgs: [msg],
              fee,
              memo
            })
          : await signAndBroadcastWithPqcAutoLink({
              bridgeMod: mod,
              client,
              profileId,
              address: from,
              msgs: [msg],
              fee,
              memo,
              label: 'wallet_ibcTransfer',
            });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;

      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  /**
   * Splits an fqdn into the two fields every dns message carries separately.
   *
   * Renew, bid and settle all act on a name that came back from the chain, so
   * it always has its extension on it. A bare name is refused rather than given
   * a default: the three handlers above each guessed a different one - register
   * assumes `lumen`, transfer assumes `lmn` - and a guess here decides which
   * domain the signature covers.
   */
  function splitFqdn(nameInput) {
    const name = String(nameInput || '').trim().toLowerCase();
    const m = name.match(/^([^.]+)\.([^.]+)$/);
    if (!m) return null;
    return { domain: m[1], ext: m[2] };
  }

  /**
   * The plumbing shared by renew, bid and settle.
   *
   * All three are the same transaction with a different message in the middle:
   * unlock the profile, load the signing bridge, check the signer really is the
   * address the caller claims, decrypt the PQC keys for the length of the
   * signature, broadcast, and map the failures onto the error strings the
   * renderer already understands. That is a hundred lines each, and the part
   * that differs is the two lines `build` returns.
   *
   * @param build receives the module and the parsed name, and returns the
   *   message to sign - or a string, which is returned to the caller as the
   *   error and nothing is signed.
   */
  async function signDnsTx({ input, label, memo, build }) {
    const profileId = String(input && input.profileId ? input.profileId : '').trim();
    const nameRaw = (input && (input.fqdn || input.name)) ? (input.fqdn || input.name) : '';
    const name = String(nameRaw || '').trim();
    const owner = String(
      input && (input.owner || input.address) ? (input.owner || input.address) : ''
    ).trim();
    const password = input && input.password ? String(input.password) : null;

    if (!profileId) return { ok: false, error: 'missing_profileId' };
    if (!name) return { ok: false, error: 'missing_name' };
    if (!owner) return { ok: false, error: 'missing_owner' };

    const parts = splitFqdn(name);
    if (!parts) return { ok: false, error: 'invalid_name' };

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

    const mod = await loadBridge();
    if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
      return { ok: false, error: 'wallet_bridge_unavailable' };
    }

    const prefixMatch = String(owner).match(/^([a-z0-9]+)1/i);
    const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
    const signer = await mod.walletFromMnemonic(mnemonic, prefix);

    let sender = owner;
    try {
      if (signer && typeof signer.getAccounts === 'function') {
        const accounts = await signer.getAccounts();
        const addr = String(
          accounts && accounts[0] && accounts[0].address ? accounts[0].address : ''
        ).trim();
        if (addr) sender = addr;
      }
    } catch {
      // Keep the caller's address: the mismatch check below is what matters.
    }

    // The profile signs with a different address than the page was showing.
    // Deliberately not phrased as "not the owner": settle is sent by whoever
    // closes the auction, so what is wrong here is the profile, not the deed.
    if (owner && sender && owner !== sender) {
      return { ok: false, error: 'signer_address_mismatch', detail: { owner, sender } };
    }

    const client = await connectSigningClientWithFailover(mod, signer, {
      pqc: { homeDir: resolvePqcHome() }
    });

    let cleanupPqc = null;
    const effectivePassword = password || getSessionPassword();
    if (arePqcKeysEncrypted()) {
      if (!effectivePassword) return { ok: false, error: 'password_required' };
      cleanupPqc = tempDecryptPqcKeys(effectivePassword);
      if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
    }

    try {
      const dnsMod = typeof client.dns === 'function' ? client.dns() : client.dns;
      if (!dnsMod) return { ok: false, error: 'dns_module_unavailable' };

      const msg = await build({ dnsMod, sender, domain: parts.domain, ext: parts.ext });
      if (typeof msg === 'string') return { ok: false, error: msg };
      if (!msg || !msg.typeUrl) return { ok: false, error: 'dns_module_unavailable' };

      const res = await signAndBroadcastWithPqcAutoLink({
        bridgeMod: mod,
        client,
        profileId,
        address: sender,
        msgs: [msg],
        fee: zeroFee(),
        memo: String((input && input.memo) || memo),
        label
      });

      return { ok: true, txhash: res.transactionHash || res.hash || '' };
    } finally {
      if (cleanupPqc) cleanupPqc();
    }
  }

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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  ipcMain.handle('dns:transferDomain', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const nameRaw =
        (input && (input.fqdn || input.name)) ? (input.fqdn || input.name) : '';
      const name = String(nameRaw || '').trim();
      const owner = String(input && (input.owner || input.address) ? (input.owner || input.address) : '').trim();
      const newOwner = String(input && (input.newOwner || input.to) ? (input.newOwner || input.to) : '').trim();
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!name) return { ok: false, error: 'missing_name' };
      if (!owner) return { ok: false, error: 'missing_owner' };
      if (!newOwner) return { ok: false, error: 'missing_newOwner' };

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

      let sender = owner;
      try {
        if (signer && typeof signer.getAccounts === 'function') {
          const accounts = await signer.getAccounts();
          const addr = String(accounts && accounts[0] && accounts[0].address ? accounts[0].address : '').trim();
          if (addr) sender = addr;
        }
      } catch {
        // ignore
      }

      if (owner && sender && owner !== sender) {
        return { ok: false, error: 'this profile is not the domain owner', detail: { owner, sender } };
      }

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
        if (!dnsMod || typeof dnsMod.msgTransfer !== 'function') {
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
          ext = 'lmn';
        }

        let msg = null;
        try {
          msg = await dnsMod.msgTransfer(sender, { domain, ext, to: newOwner });
        } catch {
          msg = null;
        }
        const needsFix = !msg || !msg.typeUrl || !msg.value || !('newOwner' in msg.value) || !msg.value.newOwner;
        if (needsFix) {
          msg = {
            typeUrl: '/lumen.dns.v1.MsgTransfer',
            value: { creator: sender, domain, ext, newOwner }
          };
        }

        const memo = String((input && input.memo) || 'dns:transfer');
        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: sender,
          msgs: [msg],
          fee,
          memo,
          label: 'dns_transferDomain',
        });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  /**
   * Buys more time on a domain the profile owns.
   *
   * `duration_days` is priced by the same quote as registration, and the chain
   * reads 0 as "the maximum", so an unset duration is not a cheap no-op - it is
   * the most expensive renewal available. It is required here for that reason.
   */
  ipcMain.handle('dns:renewDomain', async (_evt, input) => {
    try {
      const durationDays = Number(
        input && (input.durationDays ?? input.duration_days ?? input.days)
      );
      if (!Number.isFinite(durationDays) || durationDays <= 0) {
        return { ok: false, error: 'missing_durationDays' };
      }

      return await signDnsTx({
        input,
        label: 'dns_renewDomain',
        memo: 'dns:renew',
        build: ({ dnsMod, sender, domain, ext }) => {
          if (typeof dnsMod.msgRenew !== 'function') return 'dns_module_unavailable';
          // camelCase: the SDK builds MsgRenew from `payload.durationDays` and
          // reads a snake_case key as absent, which the chain then treats as
          // the maximum duration and charges for.
          return dnsMod.msgRenew(sender, {
            domain,
            ext,
            durationDays: Math.floor(durationDays)
          });
        }
      });
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  /**
   * Bids on a domain whose auction window is open.
   *
   * The amount is in ulmn and stays a string the whole way down: a bid is
   * compared against the standing one as an integer on the chain, and passing
   * it through a float is how the last digits of a large bid move.
   */
  ipcMain.handle('dns:bidDomain', async (_evt, input) => {
    try {
      const amount = String(input && (input.amountUlmn ?? input.amount) ? (input.amountUlmn ?? input.amount) : '').trim();
      if (!/^[0-9]+$/.test(amount) || amount === '0') {
        return { ok: false, error: 'invalid_amount' };
      }

      return await signDnsTx({
        input,
        label: 'dns_bidDomain',
        memo: 'dns:bid',
        build: ({ dnsMod, sender, domain, ext }) => {
          if (typeof dnsMod.msgBid !== 'function') return 'dns_module_unavailable';
          return dnsMod.msgBid(sender, { domain, ext, amount });
        }
      });
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      const raw = String(e && e.message ? e.message : e);
      return { ok: false, error: sanitizeDecryptErrorMessage(raw) };
    }
  });

  /**
   * Closes a finished auction: the chain moves the name to the winning bidder
   * and takes the bid. Anyone may send it - the winner is read from the auction
   * row, not from the signer - which is why this one does not belong to the
   * owner the way renew does.
   */
  ipcMain.handle('dns:settleDomain', async (_evt, input) => {
    try {
      return await signDnsTx({
        input,
        label: 'dns_settleDomain',
        memo: 'dns:settle',
        build: ({ dnsMod, sender, domain, ext }) => {
          if (typeof dnsMod.msgSettle !== 'function') return 'dns_module_unavailable';
          return dnsMod.msgSettle(sender, { domain, ext });
        }
      });
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
        const { MsgDelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: MsgDelegate.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress,
            amount: amount
          })
        };

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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
        const { MsgUndelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
          value: MsgUndelegate.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress,
            amount: amount
          })
        };

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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
        const { MsgBeginRedelegate } = await import('cosmjs-types/cosmos/staking/v1beta1/tx');
        
        const msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          value: MsgBeginRedelegate.fromPartial({
            delegatorAddress: address,
            validatorSrcAddress: validatorSrcAddress,
            validatorDstAddress: validatorDstAddress,
            amount: amount
          })
        };

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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
        const { MsgWithdrawDelegatorReward } = await import('cosmjs-types/cosmos/distribution/v1beta1/tx');
        
        const msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
          value: MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: address,
            validatorAddress: validatorAddress
          })
        };

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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  /**
   * Claims staking rewards from every validator at once, on any Cosmos chain.
   *
   * Separate from `wallet:withdrawRewards` above rather than an extension of
   * it, because the two differ in all three of the things that matter. That one
   * claims from a single validator, pays `zeroFee()` and signs through the PQC
   * middleware - correct for Lumen, and wrong everywhere else. Leaving it
   * untouched means the home chain's staking screen cannot regress from this.
   *
   * The chain has no "withdraw everything" message, so claiming all rewards is
   * one `MsgWithdrawDelegatorReward` per validator in a single transaction. The
   * caller supplies the list, having just read it from the delegations it is
   * already showing.
   */
  ipcMain.handle('wallet:withdrawAllRewards', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const validators = Array.isArray(input && input.validatorAddresses)
        ? input.validatorAddresses.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
      const rpcEndpoint = String(input && input.rpcEndpoint ? input.rpcEndpoint : '').trim();
      const chainId = String(input && input.chainId ? input.chainId : '').trim();
      const feeDenom = String(input && input.feeDenom ? input.feeDenom : 'ulmn').trim() || 'ulmn';
      const feeAmount = String(input && input.feeAmount ? input.feeAmount : '0').trim() || '0';
      // 300000 to match zeroFee()'s own default, which is what the
      // single-validator Lumen handler beside this one has always used.
      // Claiming here ran at 250000 and failed on the home chain: PQC
      // dual-signing makes the transaction bigger, and the margin over a plain
      // secp256k1 one is not spare.
      const feeGas = String(input && input.feeGas ? input.feeGas : '300000').trim() || '300000';
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address) return { ok: false, error: 'missing_address' };
      if (!validators.length) return { ok: false, error: 'missing_validators' };

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

      const prefixMatch = String(address || '').match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const useRemoteStandardClient =
        !!rpcEndpoint && !isNativeLumenSigningTarget({ chainId, address, feeDenom });

      const client = useRemoteStandardClient
        ? await connectStandardSigningClient(rpcEndpoint, signer, { timeoutMs: 15_000 })
        : await connectSigningClientWithFailover(
            mod,
            signer,
            { pqc: { homeDir: resolvePqcHome() } },
            { timeoutMs: 15_000 }
          );

      // Only the PQC path needs the keys in the clear; the standard client
      // signs with secp256k1 alone.
      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      if (!useRemoteStandardClient && arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const { MsgWithdrawDelegatorReward } = await import(
          'cosmjs-types/cosmos/distribution/v1beta1/tx'
        );

        const msgs = validators.map((validatorAddress) => ({
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
          value: MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: address,
            validatorAddress
          })
        }));

        // Gas is per message: one claim's worth of gas will not cover five.
        const fee = useRemoteStandardClient
          ? {
              amount: [{ denom: feeDenom, amount: String(BigInt(feeAmount) * BigInt(msgs.length)) }],
              gas: String(BigInt(feeGas) * BigInt(msgs.length))
            }
          : zeroFee(String(BigInt(feeGas) * BigInt(msgs.length)));

        const res = useRemoteStandardClient
          ? await signAndBroadcastStandard({ client, address, msgs, fee, memo: '' })
          : await signAndBroadcastWithPqcAutoLink({
              bridgeMod: mod,
              client,
              profileId,
              address,
              msgs,
              fee,
              memo: '',
              label: 'wallet_withdrawAllRewards'
            });

        return { ok: true, txhash: res.transactionHash || res.hash || '' };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      // Logged as well as returned: the renderer shows one sentence, and the
      // stack is what says which of the four steps above threw.
      console.error('[wallet:withdrawAllRewards]', e);
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  /**
   * Delegate, undelegate or redelegate on any Cosmos chain.
   *
   * One handler for the three because they differ only in their message: the
   * key handling, the client choice, the fee and the broadcast are identical,
   * and three copies of that would be three places for them to drift apart.
   *
   * Separate from the `wallet:delegate` family above rather than replacing it,
   * for the same reason `withdrawAllRewards` was: those pay `zeroFee()` and
   * sign through the PQC middleware, which is right for Lumen and wrong
   * everywhere else. The home chain's staking screen cannot regress from here.
   */
  ipcMain.handle('wallet:cosmosStake', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const action = String(input && input.action ? input.action : '').trim();
      const validatorAddress = String(input && input.validatorAddress ? input.validatorAddress : '').trim();
      const toValidatorAddress = String(input && input.toValidatorAddress ? input.toValidatorAddress : '').trim();
      const amountText = String(input && input.amountText ? input.amountText : '').trim();
      const decimals = Number.isFinite(Number(input && input.decimals)) ? Number(input.decimals) : 6;
      const denom = String(input && input.denom ? input.denom : 'ulmn').trim() || 'ulmn';
      const rpcEndpoint = String(input && input.rpcEndpoint ? input.rpcEndpoint : '').trim();
      const chainId = String(input && input.chainId ? input.chainId : '').trim();
      const feeDenom = String(input && input.feeDenom ? input.feeDenom : 'ulmn').trim() || 'ulmn';
      const feeAmount = String(input && input.feeAmount ? input.feeAmount : '0').trim() || '0';
      const feeGas = String(input && input.feeGas ? input.feeGas : '300000').trim() || '300000';
      const password = input && input.password ? String(input.password) : null;

      // A vote names a proposal and an option where the staking actions name a
      // validator and an amount. Everything below this - the key, the client,
      // the fee, the broadcast - is identical, which is why it lives here
      // rather than in a second handler repeating all of it.
      const voting = action === 'vote';
      const proposalId = String(input && input.proposalId ? input.proposalId : '').trim();
      const voteOption = String(input && input.voteOption ? input.voteOption : '').trim().toUpperCase();

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!['delegate', 'undelegate', 'redelegate', 'vote'].includes(action)) {
        return { ok: false, error: 'unknown_action' };
      }
      if (!address) return { ok: false, error: 'missing_required_fields' };
      if (!voting && !validatorAddress) return { ok: false, error: 'missing_required_fields' };
      if (action === 'redelegate' && !toValidatorAddress) {
        return { ok: false, error: 'missing_destination_validator' };
      }
      if (voting && !/^\d+$/.test(proposalId)) return { ok: false, error: 'missing_proposal' };
      if (voting && !GOV_VOTE_OPTIONS[`VOTE_OPTION_${voteOption}`]) {
        return { ok: false, error: 'unknown_vote_option' };
      }

      const microAmount = voting ? '0' : toBaseUnits(amountText, decimals);
      if (!voting && microAmount === '0') return { ok: false, error: 'missing_amount' };

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

      const prefixMatch = String(address || '').match(/^([a-z0-9]+)1/i);
      const prefix = (prefixMatch && prefixMatch[1]) || 'lmn';
      const signer = await mod.walletFromMnemonic(mnemonic, prefix);

      const useRemoteStandardClient =
        !!rpcEndpoint && !isNativeLumenSigningTarget({ chainId, address, feeDenom });

      const client = useRemoteStandardClient
        ? await connectStandardSigningClient(rpcEndpoint, signer, { timeoutMs: 15_000 })
        : await connectSigningClientWithFailover(
            mod,
            signer,
            { pqc: { homeDir: resolvePqcHome() } },
            { timeoutMs: 15_000 }
          );

      let cleanupPqc = null;
      const effectivePassword = password || getSessionPassword();
      if (!useRemoteStandardClient && arePqcKeysEncrypted()) {
        if (!effectivePassword) return { ok: false, error: 'password_required' };
        cleanupPqc = tempDecryptPqcKeys(effectivePassword);
        if (!cleanupPqc) return { ok: false, error: 'invalid_password' };
      }

      try {
        const amount = { denom, amount: microAmount };

        /**
         * v1beta1, where `wallet:govVote` on the home chain uses v1.
         *
         * The registry spans a decade of SDK releases: v1 does not exist on the
         * chains still below 0.46, and it is absent from the default CosmJS
         * registry the standard client is built with, so encoding one would
         * throw before it ever reached a node. v1beta1 is registered in both
         * and is still served by 0.50, which makes it the only spelling that
         * works everywhere. The home chain keeps v1 because it is known to
         * carry it.
         */
        const voteMsg = async () => {
          const gov = await import('cosmjs-types/cosmos/gov/v1beta1/tx');
          return {
            typeUrl: '/cosmos.gov.v1beta1.MsgVote',
            value: gov.MsgVote.fromPartial({
              proposalId: BigInt(proposalId),
              voter: address,
              option: GOV_VOTE_OPTIONS[`VOTE_OPTION_${voteOption}`]
            })
          };
        };

        const staking = voting ? null : await import('cosmjs-types/cosmos/staking/v1beta1/tx');

        // Redelegating moves stake between validators without unbonding it, so
        // it carries both addresses and no waiting period. The other two carry
        // one, and undelegating starts the unbonding clock.
        const msg = voting
          ? await voteMsg()
          : action === 'redelegate'
            ? {
                typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
                value: staking.MsgBeginRedelegate.fromPartial({
                  delegatorAddress: address,
                  validatorSrcAddress: validatorAddress,
                  validatorDstAddress: toValidatorAddress,
                  amount
                })
              }
            : action === 'undelegate'
              ? {
                  typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
                  value: staking.MsgUndelegate.fromPartial({
                    delegatorAddress: address,
                    validatorAddress,
                    amount
                  })
                }
              : {
                  typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
                  value: staking.MsgDelegate.fromPartial({
                    delegatorAddress: address,
                    validatorAddress,
                    amount
                  })
                };

        const fee = useRemoteStandardClient
          ? { amount: [{ denom: feeDenom, amount: feeAmount }], gas: feeGas }
          : zeroFee(feeGas);

        const res = useRemoteStandardClient
          ? await signAndBroadcastStandard({ client, address, msgs: [msg], fee, memo: '' })
          : await signAndBroadcastWithPqcAutoLink({
              bridgeMod: mod,
              client,
              profileId,
              address,
              msgs: [msg],
              fee,
              memo: '',
              label: `wallet_cosmos_${action}`
            });

        return { ok: true, txhash: res.transactionHash || res.hash || '' };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      console.error('[wallet:cosmosStake]', e);
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  const GOV_VOTE_OPTIONS = {
    VOTE_OPTION_YES: 1,
    VOTE_OPTION_ABSTAIN: 2,
    VOTE_OPTION_NO: 3,
    VOTE_OPTION_NO_WITH_VETO: 4,
  };

  function lmnToUlmn(value) {
    const raw = String(value == null ? '0' : value).trim();
    if (!/^\d*(\.\d{0,6})?$/.test(raw) || raw === '' || raw === '.') {
      throw new Error('invalid_amount');
    }
    const [intPartRaw, fracRaw = ''] = raw.split('.');
    const intPart = intPartRaw || '0';
    const frac = (fracRaw + '000000').slice(0, 6);
    const normalized = `${intPart}${frac}`.replace(/^0+(?=\d)/, '');
    return normalized;
  }

  // --- Governance "action" builders -----------------------------------
  // Each entry mirrors one src/internal/pages/governanceActionTemplates.ts
  // template (same `id`/templateId). Builds a plain EncodeObject via the
  // matching @lumen-chain/sdk module method - the caller Any-encodes it and
  // wraps it into a MsgSubmitProposal.messages[] entry. Only messages whose
  // Go msg_server checks the signer against the module's configured
  // authority (i.e. genuinely gov-gated) are represented here.

  function requireNonEmptyValue(value, fieldName) {
    const v = String(value == null ? '' : value).trim();
    if (!v) throw new Error(`missing_${fieldName}`);
    return v;
  }

  function requireIntValue(value, fieldName) {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`invalid_${fieldName}`);
    return n;
  }

  function requireDecimalStringValue(value, fieldName) {
    const v = String(value == null ? '' : value).trim();
    if (v === '' || !/^\d*(\.\d+)?$/.test(v)) throw new Error(`invalid_${fieldName}`);
    return v;
  }

  function parseLinesValue(value) {
    return String(value || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * "4:40000, 8:20000, 15:10000, 0:5000" -> the dns length tiers.
   *
   * A tier is a max name length and a price multiplier in basis points, and the
   * chain reads them in order, the first whose max_len covers the name winning.
   * A max_len of 0 is the catch-all and belongs last - which is how the current
   * params are shaped, and why the pairs are kept in the order they were typed
   * rather than sorted.
   *
   * Typed as one line rather than a row of inputs because the count varies:
   * this chain ships four domain tiers and three extension tiers, and nothing
   * fixes either number.
   */
  function parseLengthTiers(value, label) {
    const tiers = parseLinesValue(value).map((pair) => {
      const [rawLen, rawBps] = String(pair).split(':');
      if (rawBps === undefined) {
        throw new Error(`${label}: expected "maxLen:multiplierBps" pairs`);
      }
      const maxLen = Number(String(rawLen).trim());
      const multiplierBps = Number(String(rawBps).trim());
      if (!Number.isInteger(maxLen) || maxLen < 0) {
        throw new Error(`${label}: invalid max length "${rawLen}"`);
      }
      if (!Number.isInteger(multiplierBps) || multiplierBps < 0) {
        throw new Error(`${label}: invalid multiplier "${rawBps}"`);
      }
      return { maxLen, multiplierBps };
    });
    if (!tiers.length) throw new Error(`${label}: at least one tier is required`);
    return tiers;
  }

  async function fetchModuleParamsForPatch(client, accessorName) {
    const modAccessor = typeof client[accessorName] === 'function' ? client[accessorName]() : client[accessorName];
    if (!modAccessor || typeof modAccessor.params !== 'function') {
      throw new Error(`${accessorName}_module_unavailable`);
    }
    const raw = await modAccessor.params();
    const fetched = raw && typeof raw === 'object' ? (raw.params ?? raw) : raw;
    if (!fetched || typeof fetched !== 'object') throw new Error(`${accessorName}_params_unavailable`);
    // The query answers over REST, in snake_case; the protobuf types read
    // camelCase and silently zero anything else. Since MsgUpdateParams replaces
    // the whole object, that turned "change one field" into "blank the rest".
    return { modAccessor, params: camelizeKeysDeep(fetched) };
  }

  function moduleAccessor(client, name) {
    return typeof client[name] === 'function' ? client[name]() : client[name];
  }

  const GOVERNANCE_ACTION_BUILDERS = {
    /**
     * One builder for the whole dns module, not one per group of fields.
     *
     * MsgUpdateParams replaces the entire Params object; it does not merge. Two
     * of these in a single proposal is therefore not "two changes" but two full
     * replacements, and the second silently undoes the first - which is what a
     * proposal carrying `dns-update-fee` and `dns-update-guards` together did.
     * With one template per module that cannot be expressed.
     *
     * A blank field keeps its current value, since the base is the params as
     * they stand. base_fee_dns is immutable and the keeper refuses any proposal
     * that changes it, so it is deliberately not offered - it rides along from
     * the fetched params untouched.
     */
    'dns-update-params': async (client, authority, values) => {
      const { modAccessor, params } = await fetchModuleParamsForPatch(client, 'dns');
      const patched = { ...params };
      if (String(values.updateFeeUlmn || '').trim()) {
        patched.updateFeeUlmn = Number(lmnToUlmn(values.updateFeeUlmn));
      }
      if (String(values.transferFeeUlmn || '').trim()) {
        patched.transferFeeUlmn = Number(lmnToUlmn(values.transferFeeUlmn));
      }
      if (String(values.bidFeeUlmn || '').trim()) {
        patched.bidFeeUlmn = Number(lmnToUlmn(values.bidFeeUlmn));
      }
      // Both guards accept 0 as a real setting - no rate limit, no proof of
      // work - so they are read as "was anything typed", not as truthiness.
      if (String(values.updateRateLimitSeconds || '').trim()) {
        patched.updateRateLimitSeconds = requireIntValue(values.updateRateLimitSeconds, 'updateRateLimitSeconds');
      }
      if (String(values.updatePowDifficulty || '').trim()) {
        patched.updatePowDifficulty = requireIntValue(values.updatePowDifficulty, 'updatePowDifficulty');
      }
      // The pricing curve. alpha/floor/ceiling/t are decimal strings on the
      // proto, not numbers, so they go through the decimal validator - passing
      // a Number here would round the string the chain compares against.
      if (String(values.alpha || '').trim()) {
        patched.alpha = requireDecimalStringValue(values.alpha, 'alpha');
      }
      if (String(values.floor || '').trim()) {
        patched.floor = requireDecimalStringValue(values.floor, 'floor');
      }
      if (String(values.ceiling || '').trim()) {
        patched.ceiling = requireDecimalStringValue(values.ceiling, 'ceiling');
      }
      if (String(values.t || '').trim()) {
        patched.t = requireIntValue(values.t, 't');
      }
      if (String(values.graceDays || '').trim()) {
        patched.graceDays = requireIntValue(values.graceDays, 'graceDays');
      }
      if (String(values.auctionDays || '').trim()) {
        patched.auctionDays = requireIntValue(values.auctionDays, 'auctionDays');
      }
      if (String(values.minPriceUlmnPerMonthLmn || '').trim()) {
        patched.minPriceUlmnPerMonth = Number(lmnToUlmn(values.minPriceUlmnPerMonthLmn));
      }
      if (String(values.domainTiers || '').trim()) {
        patched.domainTiers = parseLengthTiers(values.domainTiers, 'domainTiers');
      }
      if (String(values.extTiers || '').trim()) {
        patched.extTiers = parseLengthTiers(values.extTiers, 'extTiers');
      }
      return modAccessor.msgUpdateParams(authority, patched);
    },
    'gateways-update-params': async (client, authority, values) => {
      const { modAccessor, params } = await fetchModuleParamsForPatch(client, 'gateways');
      const patched = { ...params };
      if (String(values.platformCommissionBps || '').trim()) {
        patched.platformCommissionBps = requireIntValue(values.platformCommissionBps, 'platformCommissionBps');
      }
      if (String(values.minPriceUlmnPerMonthLmn || '').trim()) {
        patched.minPriceUlmnPerMonth = Number(lmnToUlmn(values.minPriceUlmnPerMonthLmn));
      }
      if (String(values.actionFeeUlmnLmn || '').trim()) {
        patched.actionFeeUlmn = Number(lmnToUlmn(values.actionFeeUlmnLmn));
      }
      if (String(values.registerGatewayFeeUlmnLmn || '').trim()) {
        patched.registerGatewayFeeUlmn = Number(lmnToUlmn(values.registerGatewayFeeUlmnLmn));
      }
      if (String(values.finalizeDelayMonths || '').trim()) {
        patched.finalizeDelayMonths = requireIntValue(values.finalizeDelayMonths, 'finalizeDelayMonths');
      }
      if (String(values.maxActiveContractsPerGateway || '').trim()) {
        patched.maxActiveContractsPerGateway = requireIntValue(values.maxActiveContractsPerGateway, 'maxActiveContractsPerGateway');
      }
      if (String(values.monthSeconds || '').trim()) {
        patched.monthSeconds = requireIntValue(values.monthSeconds, 'monthSeconds');
      }
      if (String(values.finalizerRewardBps || '').trim()) {
        patched.finalizerRewardBps = requireIntValue(values.finalizerRewardBps, 'finalizerRewardBps');
      }
      return modAccessor.msgUpdateParams(authority, patched);
    },
    /**
     * The three tokenomics params the chain will accept.
     *
     * The other five - denom, decimals, supply_cap_lumn, halving_interval_blocks
     * and initial_reward_per_block_lumn - are refused by ensureImmutableParams
     * in the keeper, so they are not offered; they ride along untouched from the
     * fetched params.
     */
    'tokenomics-update-params': async (client, authority, values) => {
      const { modAccessor, params } = await fetchModuleParamsForPatch(client, 'tokenomics');
      const patched = { ...params };
      if (String(values.txTaxRate || '').trim()) {
        patched.txTaxRate = requireDecimalStringValue(values.txTaxRate, 'txTaxRate');
      }
      if (String(values.minSendUlmn || '').trim()) {
        patched.minSendUlmn = requireIntValue(values.minSendUlmn, 'minSendUlmn');
      }
      if (String(values.distributionIntervalBlocks || '').trim()) {
        patched.distributionIntervalBlocks = requireIntValue(
          values.distributionIntervalBlocks,
          'distributionIntervalBlocks'
        );
      }
      return modAccessor.msgUpdateParams(authority, patched);
    },
    'tokenomics-community-pool-spend': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'tokenomics');
      const recipient = requireNonEmptyValue(values.recipient, 'recipient');
      const amount = lmnToUlmn(requireNonEmptyValue(values.amountLmn, 'amountLmn'));
      return modAccessor.msgCommunityPoolSpend(authority, { recipient, amount: [{ denom: 'ulmn', amount }] });
    },
    'tokenomics-slashing-downtime': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'tokenomics');
      return modAccessor.msgUpdateSlashingDowntimeParams(
        authority,
        requireDecimalStringValue(values.slashFractionDowntime, 'slashFractionDowntime'),
        requireNonEmptyValue(values.downtimeJailDuration, 'downtimeJailDuration')
      );
    },
    'tokenomics-slashing-liveness': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'tokenomics');
      return modAccessor.msgUpdateSlashingLivenessParams(
        authority,
        requireIntValue(values.signedBlocksWindow, 'signedBlocksWindow'),
        requireDecimalStringValue(values.minSignedPerWindow, 'minSignedPerWindow')
      );
    },
    'pqc-add-ibc-relayer': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'pqc');
      return modAccessor.msgAddIbcRelayer(authority, requireNonEmptyValue(values.relayer, 'relayer'));
    },
    'pqc-remove-ibc-relayer': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'pqc');
      return modAccessor.msgRemoveIbcRelayer(authority, requireNonEmptyValue(values.relayer, 'relayer'));
    },
    'release-validate': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'releases');
      return modAccessor.msgValidateRelease(authority, requireIntValue(values.releaseId, 'releaseId'));
    },
    'release-reject': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'releases');
      return modAccessor.msgRejectRelease(authority, requireIntValue(values.releaseId, 'releaseId'));
    },
    'release-update-params': async (client, authority, values) => {
      const { modAccessor, params } = await fetchModuleParamsForPatch(client, 'releases');
      const patched = { ...params };
      if (String(values.allowedPublishers || '').trim()) {
        patched.allowedPublishers = parseLinesValue(values.allowedPublishers);
      }
      if (String(values.channels || '').trim()) {
        patched.channels = parseLinesValue(values.channels);
      }
      if (String(values.maxArtifacts || '').trim()) {
        patched.maxArtifacts = requireIntValue(values.maxArtifacts, 'maxArtifacts');
      }
      if (String(values.maxUrlsPerArt || '').trim()) {
        patched.maxUrlsPerArt = requireIntValue(values.maxUrlsPerArt, 'maxUrlsPerArt');
      }
      if (String(values.maxSigsPerArt || '').trim()) {
        patched.maxSigsPerArt = requireIntValue(values.maxSigsPerArt, 'maxSigsPerArt');
      }
      if (String(values.maxNotesLen || '').trim()) {
        patched.maxNotesLen = requireIntValue(values.maxNotesLen, 'maxNotesLen');
      }
      if (String(values.publishFeeUlmnLmn || '').trim()) {
        patched.publishFeeUlmn = Number(lmnToUlmn(values.publishFeeUlmnLmn));
      }
      if (String(values.maxPendingTtlSeconds || '').trim()) {
        patched.maxPendingTtl = requireIntValue(values.maxPendingTtlSeconds, 'maxPendingTtlSeconds');
      }
      if (String(values.rejectRefundBps || '').trim()) {
        patched.rejectRefundBps = requireIntValue(values.rejectRefundBps, 'rejectRefundBps');
      }
      if (values.requireValidationForStable === 'true' || values.requireValidationForStable === 'false') {
        patched.requireValidationForStable = values.requireValidationForStable === 'true';
      }
      if (String(values.daoPublishers || '').trim()) {
        patched.daoPublishers = parseLinesValue(values.daoPublishers);
      }
      return modAccessor.msgUpdateParams(authority, patched);
    },
    /**
     * Gov params go through tokenomics, not through cosmos.gov.v1.
     *
     * Reaching for /cosmos.gov.v1.MsgUpdateParams looks like the obvious way to
     * set both deposit figures at once - it is the message that carries them -
     * and it cannot execute on this chain. Proposal #7 on the devnet:
     *
     *   invalid authority; expected lmn1pjl3fuyf..., got lmn10d07y265...:
     *   expected gov account as only signer for proposal message
     *
     * gov.SubmitProposal requires every message in a proposal to be signed by
     * the gov module account; gov's own params handler requires its authority
     * to be an account that is not the gov module account. For this message the
     * authority *is* the signer, so the two conditions exclude each other and
     * no proposal can ever satisfy both. Every Lumen module accepts the gov
     * account - proposals #2 to #5 executed - which is why this is the one
     * message that has to come the long way round.
     *
     * The consequence is a real limit, not an app one: min_deposit cannot be
     * raised above expedited_min_deposit from any client, because nothing
     * reachable sets the expedited figure. Lifting it needs a chain change.
     */
    'tokenomics-gov-min-deposit': async (client, authority, values) => {
      const modAccessor = moduleAccessor(client, 'tokenomics');
      const amount = lmnToUlmn(requireNonEmptyValue(values.minDepositLmn, 'minDepositLmn'));
      return modAccessor.msgUpdateGovMinDeposit(authority, [{ denom: 'ulmn', amount }]);
    },
    'upgrade-software': async (client, authority, values, registry) => {
      const { MsgSoftwareUpgrade } = await import('cosmjs-types/cosmos/upgrade/v1beta1/tx');
      const typeUrl = '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade';
      try {
        if (!registry.lookupType(typeUrl)) registry.register(typeUrl, MsgSoftwareUpgrade);
      } catch {
        registry.register(typeUrl, MsgSoftwareUpgrade);
      }
      const name = requireNonEmptyValue(values.name, 'name');
      const height = requireIntValue(values.height, 'height');
      return {
        typeUrl,
        // plan.time is deprecated/rejected by the chain - only name/height/info.
        value: MsgSoftwareUpgrade.fromPartial({
          authority,
          plan: { name, height: BigInt(height), info: String(values.info || '') }
        })
      };
    },
    /**
     * The counterpart to the above, and the reason it matters: a plan scheduled
     * at the wrong height halts the chain at that height, and the only way back
     * is another proposal - which has to pass before the plan fires.
     */
    'upgrade-cancel': async (client, authority, values, registry) => {
      const { MsgCancelUpgrade } = await import('cosmjs-types/cosmos/upgrade/v1beta1/tx');
      const typeUrl = '/cosmos.upgrade.v1beta1.MsgCancelUpgrade';
      try {
        if (!registry.lookupType(typeUrl)) registry.register(typeUrl, MsgCancelUpgrade);
      } catch {
        registry.register(typeUrl, MsgCancelUpgrade);
      }
      // No fields: the module holds at most one plan, so cancelling names none.
      void values;
      return { typeUrl, value: MsgCancelUpgrade.fromPartial({ authority }) };
    }
  };

  ipcMain.handle('wallet:govSubmitProposal', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const title = String(input && input.title ? input.title : '').trim();
      const summary = String(input && input.summary ? input.summary : '').trim();
      const metadata = String(input && input.metadata ? input.metadata : '');
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !title || !summary) {
        return { ok: false, error: 'missing_required_fields' };
      }

      let depositUlmn;
      try {
        depositUlmn = lmnToUlmn(input && input.depositLmn != null ? input.depositLmn : '0');
      } catch {
        return { ok: false, error: 'invalid_deposit' };
      }

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
        const govMod = typeof client.gov === 'function' ? client.gov() : client.gov;
        if (!govMod || typeof govMod.msgSubmitProposal !== 'function') {
          return { ok: false, error: 'gov_module_unavailable' };
        }

        const rawActions = Array.isArray(input && input.actions) ? input.actions : [];
        const encodedMessages = [];

        if (rawActions.length) {
          const registry = getRegistryForEncode(client);
          if (!registry) return { ok: false, error: 'registry_unavailable' };

          const authority = moduleAddressBech32('gov', prefix);
          const { Any } = require('cosmjs-types/google/protobuf/any');

          for (const rawAction of rawActions) {
            const templateId = String(rawAction && rawAction.templateId ? rawAction.templateId : '').trim();
            const builder = GOVERNANCE_ACTION_BUILDERS[templateId];
            if (!builder) return { ok: false, error: `unknown_action_template:${templateId}` };
            const values = rawAction && typeof rawAction.values === 'object' && rawAction.values ? rawAction.values : {};

            let actionMsg;
            try {
              actionMsg = await builder(client, authority, values, registry);
            } catch (buildErr) {
              const buildErrMsg = buildErr && buildErr.message ? buildErr.message : String(buildErr);
              return { ok: false, error: `action_build_failed:${templateId}:${buildErrMsg}` };
            }

            const actionBytes = registry.encode(actionMsg);
            encodedMessages.push(Any.fromPartial({ typeUrl: actionMsg.typeUrl, value: actionBytes }));
          }
        }

        const msg = govMod.msgSubmitProposal(address, {
          messages: encodedMessages,
          initialDeposit: depositUlmn !== '0' ? [{ denom: 'ulmn', amount: depositUlmn }] : [],
          metadata,
          title,
          summary
        });

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: 'dao:submit',
          label: 'wallet_govSubmitProposal',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:govVote', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const address = String(input && input.address ? input.address : '').trim();
      const proposalId = String(input && input.proposalId ? input.proposalId : '').trim();
      const optionKey = String(input && input.option ? input.option : '').trim().toUpperCase();
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!address || !proposalId || !/^\d+$/.test(proposalId)) {
        return { ok: false, error: 'missing_required_fields' };
      }
      const option = GOV_VOTE_OPTIONS[optionKey];
      if (!option) return { ok: false, error: 'invalid_vote_option' };

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
        const { MsgVote } = await import('cosmjs-types/cosmos/gov/v1/tx');

        const msg = {
          typeUrl: '/cosmos.gov.v1.MsgVote',
          value: MsgVote.fromPartial({
            proposalId: BigInt(proposalId),
            voter: address,
            option,
            metadata: ''
          })
        };

        const fee = zeroFee();
        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address,
          msgs: [msg],
          fee,
          memo: 'dao:vote',
          label: 'wallet_govVote',
        });
        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
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
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('release:submitToDao', async (_evt, input) => {
    try {
      const profileId = String(input && input.profileId ? input.profileId : '').trim();
      const proposer = String(input && input.proposer ? input.proposer : input?.creator ? input.creator : '').trim();
      const releaseId = Number(input && input.releaseId != null ? input.releaseId : 0);
      const kind = String(input && input.kind ? input.kind : '').trim().toLowerCase();
      const title = String(input && input.title ? input.title : '').trim();
      const summary = String(input && input.summary ? input.summary : '').trim();
      const metadata = String(input && input.metadata ? input.metadata : '').trim();
      const depositLmnRaw = input && input.depositLmn != null ? String(input.depositLmn) : '0';
      const password = input && input.password ? String(input.password) : null;

      if (!profileId) return { ok: false, error: 'missing_profileId' };
      if (!proposer) return { ok: false, error: 'missing_proposer' };
      if (!Number.isFinite(releaseId) || releaseId <= 0) return { ok: false, error: 'missing_releaseId' };
      if (kind !== 'validate' && kind !== 'reject') return { ok: false, error: 'invalid_kind' };

      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) return { ok: false, error: pwdCheck.error };

      let mnemonic;
      try {
        mnemonic = loadMnemonic(profileId, password);
      } catch (loadErr) {
        const errMsg = loadErr && loadErr.message ? loadErr.message : String(loadErr);
        if (errMsg === 'password_required') return { ok: false, error: 'password_required' };
        if (errMsg === 'invalid_password') return { ok: false, error: 'invalid_password' };
        return { ok: false, error: errMsg };
      }
      if (!mnemonic) return { ok: false, error: 'no_mnemonic_found' };

      const mod = await loadBridge();
      if (!mod || !mod.walletFromMnemonic || !mod.LumenSigningClient) {
        return { ok: false, error: 'wallet_bridge_unavailable' };
      }

      const prefix = prefixFromAddress(proposer);
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
        const govMod = typeof client.gov === 'function' ? client.gov() : client.gov;
        if (!relMod) return { ok: false, error: 'release_module_unavailable' };
        if (!govMod || typeof govMod.msgSubmitProposal !== 'function') return { ok: false, error: 'gov_module_unavailable' };

        const registry = getRegistryForEncode(client);
        if (!registry) return { ok: false, error: 'registry_unavailable' };

        const authority = moduleAddressBech32('gov', prefix);
        const actionReleaseId = Math.trunc(releaseId);
        const actionMsg =
          kind === 'reject'
            ? (typeof relMod.msgRejectRelease === 'function'
                ? relMod.msgRejectRelease(authority, actionReleaseId)
                : { typeUrl: '/lumen.release.v1.MsgRejectRelease', value: { authority, id: actionReleaseId } })
            : (typeof relMod.msgValidateRelease === 'function'
                ? relMod.msgValidateRelease(authority, actionReleaseId)
                : { typeUrl: '/lumen.release.v1.MsgValidateRelease', value: { authority, id: actionReleaseId } });

        const { Any } = require('cosmjs-types/google/protobuf/any');
        const actionBytes = registry.encode(actionMsg);
        const actionAny = Any.fromPartial({ typeUrl: actionMsg.typeUrl, value: actionBytes });

        const depositLmn = Number(String(depositLmnRaw || '0').replace(',', '.'));
        if (!Number.isFinite(depositLmn) || depositLmn < 0) return { ok: false, error: 'invalid_deposit' };
        const depositUlmn = String(Math.round(depositLmn * 1_000_000));
        const initialDeposit =
          depositUlmn !== '0'
            ? [{ denom: String(input?.depositDenom || 'ulmn'), amount: depositUlmn }]
            : [];

        const defaultTitle =
          kind === 'reject'
            ? `Reject release #${Math.trunc(releaseId)}`
            : `Validate release #${Math.trunc(releaseId)}`;
        const defaultSummary =
          kind === 'reject'
            ? `Reject pending release #${Math.trunc(releaseId)}.`
            : `Validate pending release #${Math.trunc(releaseId)}.`;

        const proposalMsg = govMod.msgSubmitProposal(proposer, {
          messages: [actionAny],
          initialDeposit,
          metadata,
          title: title || defaultTitle,
          summary: summary || defaultSummary
        });

        const fee = input && input.fee ? input.fee : zeroFee();
        if (!fee.gas) fee.gas = '500000';
        const memo = String((input && input.memo) || `dao:${kind}:release`);

        const res = await signAndBroadcastWithPqcAutoLink({
          bridgeMod: mod,
          client,
          profileId,
          address: proposer,
          msgs: [proposalMsg],
          fee,
          memo,
          label: `release_submitToDao_${kind}`,
        });

        const txhash = res.transactionHash || res.hash || '';
        return { ok: true, txhash };
      } finally {
        if (cleanupPqc) cleanupPqc();
      }
    } catch (e) {
      const indexing = indexingDisabledResult(e);
      if (indexing) return indexing;
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('wallet:getSignerAccounts', async (_evt, input) => {
    try {
      const password = input && input.password ? String(input.password) : null;
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      const signerContext = await buildSignerForProfileContext(
        input && input.profileId ? String(input.profileId) : '',
        input && input.bech32Prefix ? String(input.bech32Prefix) : '',
        password
      );

      return {
        ok: true,
        profileId: signerContext.profileId,
        bech32Prefix: signerContext.bech32Prefix,
        accounts: [
          {
            address: String(signerContext.account.address || ''),
            algo: String(signerContext.account.algo || 'secp256k1'),
            pubkey: Array.from(normalizeBytes(signerContext.account.pubkey))
          }
        ]
      };
    } catch (e) {
      return siteFacingWalletError('getSignerAccounts', e);
    }
  });

  ipcMain.handle('wallet:getKeyInfo', async (_evt, input) => {
    try {
      const password = input && input.password ? String(input.password) : null;
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      const signerContext = await buildSignerForProfileContext(
        input && input.profileId ? String(input.profileId) : '',
        input && input.bech32Prefix ? String(input.bech32Prefix) : '',
        password
      );
      const profileName = String(signerContext.profile?.name || '').trim();

      return {
        ok: true,
        profileId: signerContext.profileId,
        address: String(signerContext.account.address || ''),
        bech32Address: String(signerContext.account.address || ''),
        bech32PrefixAccAddr: signerContext.bech32Prefix,
        bech32Config: buildBech32Config(signerContext.bech32Prefix),
        algo: String(signerContext.account.algo || 'secp256k1'),
        name: profileName || 'Lumen',
        pubKey: Array.from(normalizeBytes(signerContext.account.pubkey)),
        isNanoLedger: false,
        isKeystone: false
      };
    } catch (e) {
      return siteFacingWalletError('getKeyInfo', e);
    }
  });

  ipcMain.handle('wallet:signAmino', async (_evt, input) => {
    try {
      const password = input && input.password ? String(input.password) : null;
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      const signerContext = await buildSignerForProfileContext(
        input && input.profileId ? String(input.profileId) : '',
        input && input.bech32Prefix ? String(input.bech32Prefix) : '',
        password
      );
      const signerAddress =
        String(input && input.signerAddress ? input.signerAddress : '').trim() ||
        String(signerContext.account.address || '').trim();
      const signDoc = input && input.signDoc && typeof input.signDoc === 'object' ? input.signDoc : null;
      if (!signDoc) return { ok: false, error: 'missing_signDoc' };
      if (typeof signerContext.signer.signAmino !== 'function') {
        return { ok: false, error: 'sign_amino_unavailable' };
      }

      const response = await signerContext.signer.signAmino(signerAddress, signDoc);
      return {
        ok: true,
        signed: response && response.signed ? response.signed : signDoc,
        signature: normalizeStdSignature(response && response.signature ? response.signature : {})
      };
    } catch (e) {
      return siteFacingWalletError('signAmino', e);
    }
  });

  ipcMain.handle('wallet:signDirect', async (_evt, input) => {
    try {
      const password = input && input.password ? String(input.password) : null;
      const pwdCheck = checkPasswordForSigning(password);
      if (!pwdCheck.ok) {
        return { ok: false, error: pwdCheck.error };
      }

      const signerContext = await buildSignerForProfileContext(
        input && input.profileId ? String(input.profileId) : '',
        input && input.bech32Prefix ? String(input.bech32Prefix) : '',
        password
      );
      const signerAddress =
        String(input && input.signerAddress ? input.signerAddress : '').trim() ||
        String(signerContext.account.address || '').trim();
      const signDocRaw = input && input.signDoc && typeof input.signDoc === 'object' ? input.signDoc : null;
      if (!signDocRaw) return { ok: false, error: 'missing_signDoc' };
      if (typeof signerContext.signer.signDirect !== 'function') {
        return { ok: false, error: 'sign_direct_unavailable' };
      }

      const signDoc = {
        bodyBytes: normalizeBytes(signDocRaw.bodyBytes),
        authInfoBytes: normalizeBytes(signDocRaw.authInfoBytes),
        chainId: String(signDocRaw.chainId || ''),
        accountNumber: toBigIntSafe(signDocRaw.accountNumber, 0n)
      };

      const response = await signerContext.signer.signDirect(signerAddress, signDoc);
      return {
        ok: true,
        ...normalizeDirectSignResponse(response)
      };
    } catch (e) {
      return siteFacingWalletError('signDirect', e);
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
        // Anything else here is a failure to read the keystore, and its
        // message names the file. The two codes above are the only ones a
        // site has any use for.
        return siteFacingWalletError('signArbitrary/loadMnemonic', loadErr);
      }

      const privkey = await derivePrivkeyFromMnemonic(mnemonic);
      const { Secp256k1 } = require('@cosmjs/crypto');
      const kp = await Secp256k1.makeKeypair(privkey);
      const pubkeyUncompressed = kp.pubkey;
      const pubkeyCompressed = Secp256k1.compressPubkey(pubkeyUncompressed);

      const digest = sha256(payload, { bytes: true });
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
      return siteFacingWalletError('signArbitrary', e);
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
      const digest = sha256(payload, { bytes: true });
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
