const { ipcMain, dialog, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { userDataPath, readJson, writeJson, ensureDir } = require('../utils/fs.cjs');
const { encryptMnemonicLocal, decryptMnemonicLocal, encryptWithPassword, decryptWithPassword, isPasswordProtected } = require('../utils/crypto.cjs');
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
const {
  getSessionPassword,
  isPasswordRequired,
  setSessionPassword,
  verifyStoredPassword
} = require('./security.cjs');

// Lazy loader for @lumen-chain/sdk.createWallet (ESM-friendly)
let createWalletFn = null;
let createWalletLoaded = false;
async function getCreateWallet() {
  if (createWalletLoaded) return createWalletFn;
  createWalletLoaded = true;
  try {
    const mod = await import('@lumen-chain/sdk');
    const sdk = (mod && (mod.default || mod)) || mod;
    let fn = null;
    if (sdk && sdk.utils && typeof sdk.utils.createWallet === 'function') {
      fn = sdk.utils.createWallet.bind(sdk.utils);
    } else if (sdk && typeof sdk.createWallet === 'function') {
      fn = sdk.createWallet.bind(sdk);
    }
    createWalletFn = fn;
    return createWalletFn;
  } catch (e) {
    console.warn('[profiles] failed to load @lumen-chain/sdk', e && e.message ? e.message : e);
    createWalletFn = null;
    return null;
  }
}

function profilesFilePath() {
  return userDataPath('profiles.json');
}

function profileDir(id) {
  return userDataPath('profiles', id);
}

function keystorePath(id) {
  return path.join(profileDir(id), 'keystore.json');
}

function profileJsonPath(id) {
  return path.join(profileDir(id), 'profile.json');
}

function pqcKeysDir() {
  return userDataPath('pqc_keys');
}

function pqcKeysFile() {
  return path.join(pqcKeysDir(), 'keys.json');
}

function pqcLinksFile() {
  return path.join(pqcKeysDir(), 'links.json');
}

function isEncryptedPqcKeysObject(obj) {
  return !!(
    obj &&
    typeof obj === 'object' &&
    obj.crypto &&
    (obj._encrypted === true || isPasswordProtected(obj))
  );
}

function readPqcKeysForMerge(password) {
  const keysFile = pqcKeysFile();
  if (!fs.existsSync(keysFile)) {
    return { ok: true, keys: {}, encrypted: false };
  }

  const raw = readJson(keysFile, {}) || {};
  if (!isEncryptedPqcKeysObject(raw)) {
    return { ok: true, keys: raw && typeof raw === 'object' ? raw : {}, encrypted: false };
  }

  if (!password) return { ok: false, error: 'password_required' };

  try {
    const decrypted = decryptWithPassword(raw, password);
    const keys = JSON.parse(decrypted);
    return { ok: true, keys: keys && typeof keys === 'object' ? keys : {}, encrypted: true };
  } catch {
    return { ok: false, error: 'invalid_password' };
  }
}

function writePqcKeysAfterMerge(keys, encrypted, password) {
  const keysFile = pqcKeysFile();
  ensureDir(pqcKeysDir());

  if (encrypted) {
    const encryptedObj = encryptWithPassword(JSON.stringify(keys || {}), password);
    encryptedObj._encrypted = true;
    fs.writeFileSync(keysFile, JSON.stringify(encryptedObj, null, 2), 'utf8');
    return;
  }

  fs.writeFileSync(keysFile, JSON.stringify(keys || {}, null, 2), 'utf8');
}

function loadProfilesFile() {
  const file = profilesFilePath();
  const fallback = { profiles: [], activeId: '' };
  const data = readJson(file, fallback);
  const profiles = (Array.isArray(data.profiles) ? data.profiles : []).map((profile) => {
    if (!profile || typeof profile !== 'object') return profile;
    const clean = { ...profile };
    delete clean.ipnsKeyName;
    delete clean.ipnsName;
    return clean;
  });
  const activeId = typeof data.activeId === 'string' ? data.activeId : '';
  return { profiles, activeId };
}

function saveProfilesFile(data) {
  const file = profilesFilePath();
  try {
    writeJson(file, data);
  } catch (e) {
    console.warn('[profiles] failed to save', e);
  }
}

function normalizeAvatarDataUrl(value) {
  const dataUrl = String(value || '').trim();
  return dataUrl.startsWith('data:image/') ? dataUrl : '';
}

function persistProfileMetadata(profileId, updates) {
  const id = String(profileId || '').trim();
  if (!id || !updates || typeof updates !== 'object') return;
  try {
    const fp = profileJsonPath(id);
    if (!fs.existsSync(fp)) return;
    const current = readJson(fp, null);
    if (!current || typeof current !== 'object') return;
    const updated = { ...current };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null || value === '') {
        delete updated[key];
      } else {
        updated[key] = value;
      }
    }
    fs.writeFileSync(fp, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {
    console.warn('[profiles] failed to persist profile metadata', id, e?.message || e);
  }
}

function persistProfileDisplayName(profileId, nextName) {
  const id = String(profileId || '').trim();
  const name = String(nextName || '').trim();
  if (!id || !name) return;
  persistProfileMetadata(id, { name });
}

function persistProfileAvatarDataUrl(profileId, nextAvatarDataUrl) {
  const avatarDataUrl = normalizeAvatarDataUrl(nextAvatarDataUrl);
  persistProfileMetadata(profileId, { avatarDataUrl: avatarDataUrl || null });
}

function makeProfileId(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `acc_${base}_${suffix}` : `acc_${suffix}`;
}

function hashHue(input) {
  let h = 0;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function colorIndexForName(name) {
  return hashHue(name || '') % 12;
}

function hasKeystore(id) {
  try {
    return fs.existsSync(keystorePath(id));
  } catch {
    return false;
  }
}

const PROFILE_DERIVATION_PATH = "m/44'/118'/0'/0/0";

async function deriveWalletAddressFromMnemonic(mnemonic, prefix = 'lmn') {
  const normalizedMnemonic = String(mnemonic || '').trim().replace(/\s+/g, ' ');
  if (!normalizedMnemonic) throw new Error('missing_mnemonic');

  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(normalizedMnemonic));
  const { privkey } = Slip10.derivePath(
    Slip10Curve.Secp256k1,
    seed,
    stringToPath(PROFILE_DERIVATION_PATH)
  );
  const { pubkey } = await Secp256k1.makeKeypair(privkey);
  const pubkeyCompressed = Secp256k1.compressPubkey(pubkey);
  const sha = new Sha256(pubkeyCompressed).digest();
  const rawAddress = new Ripemd160(sha).digest();
  return toBech32(String(prefix || 'lmn'), rawAddress);
}

function createAvatarDataUrlFromPath(sourcePath) {
  const filePath = String(sourcePath || '').trim();
  if (!filePath) return { ok: false, error: 'missing_avatar_path' };
  if (!fs.existsSync(filePath)) return { ok: false, error: 'avatar_file_not_found' };
  try {
    const image = nativeImage.createFromPath(filePath);
    if (!image || image.isEmpty()) {
      return { ok: false, error: 'invalid_avatar_image' };
    }
    const { width, height } = image.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { ok: false, error: 'invalid_avatar_image' };
    }

    const cropSize = Math.min(width, height);
    const square = image.crop({
      x: Math.max(0, Math.floor((width - cropSize) / 2)),
      y: Math.max(0, Math.floor((height - cropSize) / 2)),
      width: cropSize,
      height: cropSize,
    });
    const avatarDataUrl = normalizeAvatarDataUrl(
      square.resize({ width: 160, height: 160, quality: 'best' }).toDataURL(),
    );
    if (!avatarDataUrl) {
      return { ok: false, error: 'avatar_processing_failed' };
    }
    return { ok: true, avatarDataUrl };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || 'avatar_processing_failed') };
  }
}

/**
 * Validates that a profile has a fully created wallet with all required components.
 * @param {string} profileId - The profile ID to validate
 * @param {object} profile - The profile object (optional, will be loaded if not provided)
 * @returns {object} { ok: boolean, error?: string, details?: object }
 */
function isWalletFullyCreated(profileId, profile = null) {
  try {
    // Load profile if not provided
    if (!profile) {
      const { profiles } = loadProfilesFile();
      profile = profiles.find(p => p.id === profileId);
      if (!profile) {
        return { ok: false, error: 'profile_not_found' };
      }
    }

    // Guest profiles don't have wallets
    if (profile.role === 'guest') {
      return { ok: false, error: 'guest_profile_no_wallet' };
    }

    // Check if wallet address exists
    const walletAddress = profile.walletAddress || profile.address;
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.trim()) {
      return { ok: false, error: 'wallet_address_missing' };
    }

    // Check if keystore exists
    const ksPath = keystorePath(profileId);
    if (!fs.existsSync(ksPath)) {
      return { ok: false, error: 'keystore_missing' };
    }

    // Validate keystore has crypto data
    try {
      const ks = readJson(ksPath, null);
      if (!ks || !ks.crypto) {
        return { ok: false, error: 'keystore_invalid' };
      }
    } catch (e) {
      return { ok: false, error: 'keystore_read_failed' };
    }

    // All checks passed
    return { 
      ok: true, 
      details: {
        hasAddress: true,
        hasKeystore: true,
        address: walletAddress
      }
    };
  } catch (e) {
    return { 
      ok: false, 
      error: 'validation_failed',
      message: e?.message || String(e)
    };
  }
}

async function ensureWalletForProfile(profile) {
  const id = String(profile.id || '').trim();
  if (!id) {
    return { ok: false, error: 'missing_profile_id' };
  }

  // If a keystore already exists, trust it and return the stored address.
  if (hasKeystore(id) && profile.walletAddress) {
    return { ok: true, created: false, address: profile.walletAddress };
  }

  const createWallet = await getCreateWallet();

  // If SDK is not available, keep profile without walletAddress.
  if (!createWallet) {
    console.warn('[profiles] @lumen-chain/sdk not available, cannot create wallet');
    return { ok: false, error: 'sdk_unavailable' };
  }

  try {
    const w = await createWallet();
    if (!w || !w.mnemonic || !w.address) {
      return { ok: false, error: 'wallet_creation_failed' };
    }

    ensureDir(profileDir(id));
    const ks = encryptMnemonicLocal(w.mnemonic);
    fs.writeFileSync(keystorePath(id), JSON.stringify(ks, null, 2), 'utf8');

    const profileRecord = {
      id: profile.id,
      name: profile.name,
      address: w.address,
      createdAt: Date.now()
    };
    const avatarDataUrl = normalizeAvatarDataUrl(profile.avatarDataUrl);
    if (avatarDataUrl) {
      profileRecord.avatarDataUrl = avatarDataUrl;
    }
    fs.writeFileSync(profileJsonPath(id), JSON.stringify(profileRecord, null, 2), 'utf8');

    return { ok: true, created: true, address: w.address };
  } catch (e) {
    console.warn('[profiles] ensureWalletForProfile failed', e);
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

function sanitizeBackupFolderSegment(input) {
  const reserved = new Set([
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9'
  ]);

  const raw = String(input || '').trim();
  if (!raw) return '';
  let name = raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!name) return '';
  if (name.length > 48) name = name.slice(0, 48).trim();
  if (reserved.has(name.toUpperCase())) name = `profile-${name}`;
  return name;
}

function normalizeBinaryKeyToBase64(input) {
  if (input == null) return '';

  if (Array.isArray(input)) {
    try {
      return Buffer.from(input).toString('base64');
    } catch {
      return '';
    }
  }

  const raw = String(input || '').trim().replace(/\s+/g, '');
  if (!raw) return '';

  if (/^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0) {
    try {
      return Buffer.from(raw, 'hex').toString('base64');
    } catch {
      return '';
    }
  }

  try {
    const buf = Buffer.from(raw, 'base64');
    if (!buf.length) return '';
    const canonical = buf.toString('base64').replace(/=+$/g, '');
    const candidate = raw.replace(/=+$/g, '');
    return canonical === candidate ? buf.toString('base64') : '';
  } catch {
    return '';
  }
}

function extractNormalizedPqcBackup(input, fallbackName = 'pqc-import') {
  if (!input || typeof input !== 'object') return { found: false, record: null };

  const raw =
    input.pqc && typeof input.pqc === 'object'
      ? input.pqc
      : input.pqcKey && typeof input.pqcKey === 'object'
        ? input.pqcKey
        : null;

  if (!raw) return { found: false, record: null };

  const publicKey = normalizeBinaryKeyToBase64(raw.publicKey || raw.public_key);
  const privateKey = normalizeBinaryKeyToBase64(raw.privateKey || raw.private_key);
  if (!publicKey || !privateKey) {
    return { found: true, record: null };
  }

  const keyName = String(raw.name || raw.keyName || fallbackName || 'pqc-import').trim();
  return {
    found: true,
    record: {
      name: keyName || 'pqc-import',
      scheme: String(raw.scheme || raw.Scheme || raw.schemeName || 'dilithium3').trim() || 'dilithium3',
      publicKey,
      privateKey,
      createdAt: raw.createdAt || raw.created_at || new Date().toISOString()
    }
  };
}

async function pickSingleJsonFile(title) {
  const res = await dialog.showOpenDialog({
    title,
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (res.canceled || !Array.isArray(res.filePaths) || !res.filePaths.length) {
    return { ok: false, error: 'canceled' };
  }
  const filePath = String(res.filePaths[0] || '').trim();
  if (!filePath) return { ok: false, error: 'canceled' };
  return { ok: true, filePath };
}

function buildProfileBackupObject(p, decryptPassword) {
  const srcProfileDir = profileDir(p.id);
  const srcPqcDir = pqcKeysDir();

  // Decrypt mnemonic from local keystore
  let mnemonicPlain = '';
  try {
    const ksSrc = path.join(srcProfileDir, 'keystore.json');
    if (fs.existsSync(ksSrc)) {
      const ks = readJson(ksSrc, null);
      if (ks && ks.crypto) {
        // Check if password-protected
        if (isPasswordProtected(ks)) {
          if (decryptPassword) {
            mnemonicPlain = decryptWithPassword(ks, decryptPassword);
          }
          // If no password provided, mnemonic stays empty
        } else {
          mnemonicPlain = decryptMnemonicLocal(ks);
        }
      }
    }
  } catch (e) {
    console.warn('[buildProfileBackupObject] Failed to decrypt mnemonic:', e?.message || e);
  }

  // Load PQC key for this profile (if any)
  let pqcKey = null;
  let pqcDecryptFailed = false;
  try {
    const addr = String(p.walletAddress || p.address || '').trim();
    const keysFile = path.join(srcPqcDir, 'keys.json');
    const linksFile = path.join(srcPqcDir, 'links.json');
    if (addr && fs.existsSync(keysFile) && fs.existsSync(linksFile)) {
      // First check if keys.json is encrypted
      let keysRaw = readJson(keysFile, {});
      
      // If keys.json is password-protected, decrypt it first
      if (keysRaw && isEncryptedPqcKeysObject(keysRaw)) {
        if (decryptPassword) {
          try {
            const decrypted = decryptWithPassword(keysRaw, decryptPassword);
            keysRaw = JSON.parse(decrypted);
          } catch {
            keysRaw = {};
            pqcDecryptFailed = true;
          }
        } else {
          keysRaw = {};
        }
      }
      
      const linksRaw = readJson(linksFile, {});
      if (linksRaw && typeof linksRaw === 'object' && keysRaw && typeof keysRaw === 'object') {
        const keyName = typeof linksRaw[addr] === 'string' ? String(linksRaw[addr]) : '';
        const rec = keyName ? keysRaw[keyName] : null;
        if (rec && typeof rec === 'object') {
          pqcKey = {
            name: rec.name || keyName,
            scheme: rec.scheme || rec.Scheme || 'dilithium3',
            publicKey: rec.publicKey || rec.public_key,
            privateKey: rec.privateKey || rec.private_key,
            createdAt: rec.createdAt || rec.created_at || null
          };
        }
      }
    }
  } catch (e) {
    console.warn('[buildProfileBackupObject] Failed to load PQC key:', e?.message || e);
  }

  const backup = {
    version: 1,
    id: p.id,
    name: p.name,
    colorIndex: p.colorIndex,
    role: p.role || 'user',
    walletAddress: p.walletAddress || p.address || null,
    avatarDataUrl: normalizeAvatarDataUrl(p.avatarDataUrl) || null,
    favourites: p.favourites || {},
    createdAt: Date.now(),
    mnemonic: mnemonicPlain || null,
    pqc: pqcKey
  };

  return { backup, pqcDecryptFailed };
}

function collectBackupFiles(selectionPath) {
  const out = [];
  const raw = String(selectionPath || '').trim();
  if (!raw) return out;

  let st = null;
  try {
    st = fs.statSync(raw);
  } catch {
    return out;
  }

  if (st.isFile()) {
    out.push(raw);
    return out;
  }

  if (!st.isDirectory()) return out;

  const direct = path.join(raw, 'profile.json');
  try {
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      out.push(direct);
      return out;
    }
  } catch {}

  let entries = [];
  try {
    entries = fs.readdirSync(raw, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const ent of entries) {
    if (!ent || !ent.isDirectory()) continue;
    const candidate = path.join(raw, ent.name, 'profile.json');
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) out.push(candidate);
    } catch {}
  }
  if (out.length) return out;

  // Fallback: allow selecting a folder that directly contains backup json files.
  for (const ent of entries) {
    if (!ent || !ent.isFile()) continue;
    const name = String(ent.name || '');
    if (!name.toLowerCase().endsWith('.json')) continue;
    out.push(path.join(raw, name));
  }

  return out;
}

function importOneBackupObject(imported, profiles, passwordOverride) {
  if (!imported || typeof imported !== 'object') {
    return { ok: false, error: 'invalid_profile_backup' };
  }

  // Check if this is an encrypted backup
  if (imported.passwordProtected === true && imported.crypto) {
    return { ok: false, error: 'encrypted_backup', encrypted: true };
  }

  const name = String(imported.name || '').trim();
  if (!name) {
    return { ok: false, error: 'missing_profile_name' };
  }

  // Resolve id, avoid conflicts (in-memory list)
  const rawId = String(imported.id || '').trim();
  const baseId = rawId || makeProfileId(name);
  let id = baseId;
  while (profiles.some((p) => p.id === id)) {
    id = makeProfileId(name);
  }

  const colorIndex = Number.isFinite(imported.colorIndex)
    ? Number(imported.colorIndex)
    : colorIndexForName(name);
  const role = imported.role === 'guest' ? 'guest' : 'user';
  const walletAddress = String(imported.walletAddress || imported.address || '').trim() || null;
  const avatarDataUrl = normalizeAvatarDataUrl(imported.avatarDataUrl);

  const profile = {
    id,
    name,
    colorIndex,
    role,
    walletAddress
  };
  if (avatarDataUrl) {
    profile.avatarDataUrl = avatarDataUrl;
  }

  // Merge PQC key if present (supports both camelCase and snake_case backup fields).
  const normalizedPqc = extractNormalizedPqcBackup(imported, `profile:${id}`);

  if (normalizedPqc.record && walletAddress) {
    const effectivePassword = passwordOverride || getSessionPassword();
    const readRes = readPqcKeysForMerge(effectivePassword);
    if (!readRes.ok) {
      return { ok: false, error: readRes.error, requiresPasswordFor: 'pqc_keys' };
    }

    const linksFile = pqcLinksFile();
    let links = {};
    if (fs.existsSync(linksFile)) links = readJson(linksFile, {}) || {};

    const keyName = String(normalizedPqc.record.name || `profile:${id}`);
    const nextKeys = readRes.keys || {};
    nextKeys[keyName] = {
      name: keyName,
      scheme: normalizedPqc.record.scheme || 'dilithium3',
      publicKey: normalizedPqc.record.publicKey,
      privateKey: normalizedPqc.record.privateKey,
      createdAt: normalizedPqc.record.createdAt || new Date().toISOString()
    };
    links[walletAddress] = keyName;

    ensureDir(pqcKeysDir());
    writePqcKeysAfterMerge(nextKeys, readRes.encrypted, effectivePassword);
    fs.writeFileSync(linksFile, JSON.stringify(links, null, 2), 'utf8');

    // Best-effort verification (helps debug cases where links exist but the key isn't persisted).
    try {
      const verifyRes = readPqcKeysForMerge(effectivePassword);
      const exists = !!(verifyRes && verifyRes.ok && verifyRes.keys && verifyRes.keys[keyName]);
      console.log('[profiles] PQC merge keyName=', keyName, 'exists=', exists, 'encrypted=', !!readRes.encrypted);
    } catch {}
  }

  // Rebuild keystore from plaintext mnemonic
  try {
    const m = String(imported.mnemonic || '').trim();
    if (m) {
      const ks = encryptMnemonicLocal(m);
      const dstDir = profileDir(id);
      ensureDir(dstDir);
      fs.writeFileSync(keystorePath(id), JSON.stringify(ks, null, 2), 'utf8');

      const meta = {
        id,
        name,
        address: walletAddress,
        createdAt: imported.createdAt || Date.now()
      };
      if (avatarDataUrl) {
        meta.avatarDataUrl = avatarDataUrl;
      }
      fs.writeFileSync(
        path.join(dstDir, 'profile.json'),
        JSON.stringify(meta, null, 2),
        'utf8'
      );
    }
  } catch {}

  profiles.push(profile);

  return { ok: true, id };
}

function updateActiveProfile(mutator) {
  const data = loadProfilesFile();
  const idx = data.profiles.findIndex(p => p.id === data.activeId);
  if (idx === -1) return { ok: false };
  const p = { ...data.profiles[idx] };
  mutator(p);
  data.profiles[idx] = p;
  // Straight to saveProfilesFile, which takes exactly this shape. It used to
  // go through a saveProfiles(profiles, activeId) wrapper and pass the whole
  // object as the first argument, so the file came back with `profiles` as an
  // object instead of an array - and loadProfilesFile turns any non-array into
  // [], which is every profile gone. Only reachable through setFavourite and
  // removeFavourite, which nothing in the renderer calls yet.
  saveProfilesFile(data);
  return { ok: true, profile: p };
}

function registerProfilesIpc() {
  ipcMain.handle('profiles:list', async () => {
    const { profiles, activeId } = loadProfilesFile();
    let updatedProfiles = profiles.slice();
    let mutated = false;

    // Backfill wallets only for user profiles that have no address at all and no keystore yet.
    for (let i = 0; i < updatedProfiles.length; i++) {
      const p = updatedProfiles[i];
      if (!p || p.role === 'guest') continue;
      const hasAddr = !!(p.walletAddress || p.address);
      if (!hasAddr && !hasKeystore(p.id)) {
        try {
          const ensured = await ensureWalletForProfile(p);
          if (ensured && ensured.ok && ensured.address) {
            updatedProfiles[i] = { ...p, walletAddress: ensured.address };
            mutated = true;
          }
        } catch {
          // ignore per-profile wallet ensure errors
        }
      }
    }

    if (mutated) {
      saveProfilesFile({ profiles: updatedProfiles, activeId });
    }

    // Ensure every profile exposes walletAddress so the renderer keeps working.
    const normalized = updatedProfiles.map((p) => ({
      ...p,
      walletAddress: p.walletAddress || p.address || null,
      avatarDataUrl: normalizeAvatarDataUrl(p.avatarDataUrl) || undefined,
      favourites: p.favourites || {}
    }));

    // Guest mode is no longer a supported bootstrap state.
    const filtered = normalized.filter((p) => p.role !== 'guest');
    let nextActive = activeId;
    if (!filtered.find((p) => p.id === activeId)) {
      nextActive = filtered[0] ? filtered[0].id : '';
    }

    if (filtered.length !== normalized.length || nextActive !== activeId) {
      saveProfilesFile({ profiles: filtered, activeId: nextActive });
    }

    return { profiles: filtered, activeId: nextActive };
  });

ipcMain.handle('profiles:getFavourites', async () => {
    const { profiles, activeId } = loadProfilesFile();
    const p = profiles.find(p => p.id === activeId);
    return (p && p.favourites) || {};
  });

  ipcMain.handle('profiles:setFavourite', async (_evt, domain, cid) => {
    return updateActiveProfile(p => {
      p.favourites = p.favourites || {};
      p.favourites[String(domain)] = String(cid);
    });
  });

  ipcMain.handle('profiles:removeFavourite', async (_evt, domain) => {
    return updateActiveProfile(p => {
      if (p.favourites) delete p.favourites[String(domain)];
    });
  });

  ipcMain.handle('profiles:getActive', async () => {
    const { profiles, activeId } = loadProfilesFile();
    const userProfiles = profiles.filter((p) => p && p.role !== 'guest');
    const active = userProfiles.find((p) => p.id === activeId) || userProfiles[0] || null;
    if (!active) return null;
    return {
      ...active,
      walletAddress: active.walletAddress || active.address || null,
      avatarDataUrl: normalizeAvatarDataUrl(active.avatarDataUrl) || undefined,
      favourites: active.favourites || {},
    };
  });

  ipcMain.handle('profiles:isWalletFullyCreated', async (_evt, id) => {
    const profileId = String(id || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };
    return isWalletFullyCreated(profileId);
  });

  ipcMain.handle('profiles:setActive', async (_evt, id) => {
    const { profiles, activeId } = loadProfilesFile();
    const exists = profiles.some((p) => p.id === id);
    const nextId = exists ? String(id) : activeId;
    saveProfilesFile({ profiles, activeId: nextId });
    return nextId;
  });

  ipcMain.handle('profiles:create', async (_evt, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const { profiles } = loadProfilesFile();
    const userProfiles = profiles.filter((p) => p && p.role !== 'guest');
    const id = makeProfileId(trimmed);
    const baseProfile = {
      id,
      name: trimmed,
      colorIndex: colorIndexForName(trimmed),
      role: 'user'
    };

    // Ensure a real wallet exists for this profile (mnemonic + keystore).
    const ensured = await ensureWalletForProfile(baseProfile);
    const walletAddress = ensured && ensured.address ? ensured.address : null;

    const profile = {
      ...baseProfile,
      walletAddress,
    };
    const next = [...userProfiles, profile];
    saveProfilesFile({ profiles: next, activeId: id });
    return profile;
  });

  ipcMain.handle('profiles:updateName', async (_evt, id, name) => {
    const profileId = String(id || '').trim();
    const nextName = String(name || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };
    if (!nextName) return { ok: false, error: 'missing_profile_name' };

    const { profiles, activeId } = loadProfilesFile();
    const index = profiles.findIndex((p) => String(p && p.id ? p.id : '') === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const current = profiles[index] || {};
    const updated = {
      ...current,
      name: nextName,
      colorIndex: colorIndexForName(nextName),
    };
    const nextProfiles = profiles.slice();
    nextProfiles[index] = updated;
    saveProfilesFile({ profiles: nextProfiles, activeId });
    persistProfileDisplayName(profileId, nextName);
    return { ok: true, profile: updated };
  });

  ipcMain.handle('profiles:updateAvatar', async (_evt, id, sourcePath) => {
    const profileId = String(id || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };

    const avatarResult = createAvatarDataUrlFromPath(sourcePath);
    if (!avatarResult?.ok) {
      return { ok: false, error: avatarResult?.error || 'avatar_processing_failed' };
    }

    const { profiles, activeId } = loadProfilesFile();
    const index = profiles.findIndex((p) => String(p && p.id ? p.id : '') === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const current = profiles[index] || {};
    const updated = {
      ...current,
      avatarDataUrl: avatarResult.avatarDataUrl,
    };
    const nextProfiles = profiles.slice();
    nextProfiles[index] = updated;
    saveProfilesFile({ profiles: nextProfiles, activeId });
    persistProfileAvatarDataUrl(profileId, avatarResult.avatarDataUrl);
    return { ok: true, profile: updated };
  });

  ipcMain.handle('profiles:clearAvatar', async (_evt, id) => {
    const profileId = String(id || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };

    const { profiles, activeId } = loadProfilesFile();
    const index = profiles.findIndex((p) => String(p && p.id ? p.id : '') === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const current = profiles[index] || {};
    const updated = { ...current };
    delete updated.avatarDataUrl;
    const nextProfiles = profiles.slice();
    nextProfiles[index] = updated;
    saveProfilesFile({ profiles: nextProfiles, activeId });
    persistProfileAvatarDataUrl(profileId, '');
    return { ok: true, profile: updated };
  });

  ipcMain.handle('profiles:export', async (_evt, id) => {
    const { profiles } = loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return null;
    return JSON.stringify(p, null, 2);
  });

  // Check if profile requires password to export (keystore or pqc is password-protected)
  ipcMain.handle('profiles:checkExportRequiresPassword', async (_evt, id) => {
    const { profiles } = loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'profile_not_found' };

    let requiresPassword = false;
    
    // Check keystore
    try {
      const ksSrc = path.join(profileDir(p.id), 'keystore.json');
      if (fs.existsSync(ksSrc)) {
        const ks = readJson(ksSrc, null);
        if (ks && isPasswordProtected(ks)) {
          requiresPassword = true;
        }
      }
    } catch {}

    // Check PQC keys
    if (!requiresPassword) {
      try {
        const keysFile = path.join(pqcKeysDir(), 'keys.json');
        if (fs.existsSync(keysFile)) {
          const keysRaw = readJson(keysFile, null);
          if (keysRaw && isPasswordProtected(keysRaw)) {
            requiresPassword = true;
          }
        }
      } catch {}
    }

    return { ok: true, requiresPassword };
  });

  ipcMain.handle('profiles:exportBackup', async (_evt, id, password, encryptOutput) => {
    // Whether a password was given is useful; how long it is narrows a brute
    // force and has no business in a log file.
    console.log('[exportBackup] id:', id, 'password provided:', !!password, 'encryptOutput:', !!encryptOutput);


    const { profiles } = loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'profile_not_found' };

    // CRITICAL FIX: Validate wallet is fully created before allowing export
    const walletValidation = isWalletFullyCreated(id, p);
    if (!walletValidation.ok) {
      console.log('[exportBackup] Wallet validation failed:', walletValidation.error);
      
      // Return user-friendly error messages
      const errorMessages = {
        'guest_profile_no_wallet': 'Guest profiles do not have wallets. Please create a user profile first.',
        'wallet_address_missing': 'No wallet found. Please create a wallet before backing up.',
        'keystore_missing': 'Wallet not fully created. Please complete wallet setup first.',
        'keystore_invalid': 'Wallet data is corrupted. Please create a new wallet.',
        'keystore_read_failed': 'Unable to read wallet data. Please try again.'
      };
      
      return { 
        ok: false, 
        error: walletValidation.error,
        message: errorMessages[walletValidation.error] || 'Wallet is not ready for backup.'
      };
    }

    // Check if we need password to decrypt the data first
    let needsDecryptPassword = false;
    let needsPqcPassword = false;
    try {
      const ksSrc = path.join(profileDir(p.id), 'keystore.json');
      if (fs.existsSync(ksSrc)) {
        const ks = readJson(ksSrc, null);
        if (ks && isPasswordProtected(ks)) {
          needsDecryptPassword = true;
        }
      }
    } catch {}
    
    try {
      const keysFile = path.join(pqcKeysDir(), 'keys.json');
      if (fs.existsSync(keysFile)) {
        const keysRaw = readJson(keysFile, null);
        if (keysRaw && isEncryptedPqcKeysObject(keysRaw)) {
          needsDecryptPassword = true;
          needsPqcPassword = true;
        }
      }
    } catch {}

    console.log('[exportBackup] needsDecryptPassword:', needsDecryptPassword);

    // If data is password-protected but no password provided, return error
    if (needsDecryptPassword && !password) {
      console.log('[exportBackup] Password required but not provided');
      return { ok: false, error: 'password_required_for_export' };
    }

    // Only encrypt output if explicitly requested AND password is valid
    const shouldEncryptOutput = !!(encryptOutput && password && typeof password === 'string' && password.length >= 6);

    try {
      const res = await dialog.showOpenDialog({
        title: 'Select destination folder for backup',
        properties: ['openDirectory', 'createDirectory']
      });
      if (res.canceled || !res.filePaths || !res.filePaths.length) {
        return { ok: false, error: 'canceled' };
      }
      const baseDir = res.filePaths[0];
      ensureDir(baseDir);

      // Build backup with password to decrypt if needed
      const built = buildProfileBackupObject(p, password);
      const backup = built && built.backup ? built.backup : null;
      const pqcDecryptFailed = !!(built && built.pqcDecryptFailed);
      if (!backup) return { ok: false, error: 'backup_failed' };
      
      // CRITICAL FIX: Validate that mnemonic was extracted (if keystore exists)
      const ksSrc = path.join(profileDir(p.id), 'keystore.json');
      if (fs.existsSync(ksSrc)) {
        if (!backup.mnemonic || typeof backup.mnemonic !== 'string' || !backup.mnemonic.trim()) {
          console.log('[exportBackup] Mnemonic is null or empty after extraction');
          return { 
            ok: false, 
            error: needsDecryptPassword ? 'invalid_password' : 'mnemonic_extraction_failed',
            message: needsDecryptPassword 
              ? 'Invalid password. Please try again.' 
              : 'Failed to extract wallet mnemonic. Wallet may be corrupted.'
          };
        }
      }

      // CRITICAL FIX: Validate wallet address in backup
      if (!backup.walletAddress || typeof backup.walletAddress !== 'string' || !backup.walletAddress.trim()) {
        console.log('[exportBackup] Wallet address is null or empty in backup');
        return { 
          ok: false, 
          error: 'wallet_address_missing_in_backup',
          message: 'Wallet address is missing. Cannot create backup.'
        };
      }

      // If PQC store is encrypted, fail hard on wrong password (otherwise we export a backup with no PQC key).
      if (needsPqcPassword) {
        if (pqcDecryptFailed) return { ok: false, error: 'invalid_password' };
        const addr = String(p.walletAddress || p.address || '').trim();
        const linksFile = path.join(pqcKeysDir(), 'links.json');
        if (addr && fs.existsSync(linksFile)) {
          const links = readJson(linksFile, {}) || {};
          const keyName = typeof links[addr] === 'string' ? String(links[addr]) : '';
          if (keyName && !backup.pqc) {
            return { ok: false, error: 'invalid_password' };
          }
        }
      }

      let backupPath;
      if (shouldEncryptOutput) {
        // Encrypt the entire backup object with password
        const encryptedBackup = encryptWithPassword(JSON.stringify(backup), password);
        encryptedBackup.profileName = p.name; // Store name in clear for identification
        encryptedBackup.profileId = p.id;
        backupPath = path.join(baseDir, 'profile.encrypted.json');
        fs.writeFileSync(backupPath, JSON.stringify(encryptedBackup, null, 2), 'utf8');
      } else {
        backupPath = path.join(baseDir, 'profile.json');
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
      }

      console.log('[exportBackup] Backup created successfully:', backupPath);
      return { ok: true, path: backupPath };
    } catch (e) {
      const errMsg = String(e && e.message ? e.message : e);
      console.error('[exportBackup] Export failed:', errMsg);
      if (errMsg.includes('Unsupported state') || errMsg.includes('bad decrypt') || errMsg.includes('authentication')) {
        return { ok: false, error: 'invalid_password' };
      }
      return { ok: false, error: errMsg };
    }
  });

  ipcMain.handle('profiles:exportBackups', async (_evt, ids) => {
    const requested = Array.isArray(ids) ? ids : [];
    const uniqueIds = Array.from(
      new Set(requested.map((x) => String(x || '').trim()).filter(Boolean))
    );
    if (!uniqueIds.length) return { ok: false, error: 'no_profiles_selected' };

    const { profiles } = loadProfilesFile();
    const byId = new Map(profiles.map((p) => [p.id, p]));

    try {
      const res = await dialog.showOpenDialog({
        title: 'Select destination folder for backups',
        properties: ['openDirectory', 'createDirectory']
      });
      if (res.canceled || !res.filePaths || !res.filePaths.length) {
        return { ok: false, error: 'canceled' };
      }
      const baseDir = res.filePaths[0];
      ensureDir(baseDir);

      const results = [];
      for (const id of uniqueIds) {
        const p = byId.get(id);
        if (!p) {
          results.push({ id, ok: false, error: 'profile_not_found' });
          continue;
        }

        try {
          const seg = sanitizeBackupFolderSegment(p.name) || 'profile';
          const baseName = `${seg}-${p.id}`;
          let dirName = baseName;
          let dstDir = path.join(baseDir, dirName);
          let i = 1;
          while (fs.existsSync(dstDir)) {
            dirName = `${baseName}-${i++}`;
            dstDir = path.join(baseDir, dirName);
          }
          ensureDir(dstDir);

          const backupPath = path.join(dstDir, 'profile.json');
          const built = buildProfileBackupObject(p);
          const backup = built && built.backup ? built.backup : null;
          if (!backup) throw new Error('backup_failed');
          fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

          results.push({ id: p.id, ok: true, path: backupPath });
        } catch (e) {
          results.push({
            id: p.id,
            ok: false,
            error: String(e && e.message ? e.message : e)
          });
        }
      }

      return { ok: true, baseDir, results };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('profiles:import', async (_evt, json) => {
    try {
      const parsed = JSON.parse(String(json || ''));
      const name = String(parsed.name || '').trim();
      if (!name) return null;
      const { profiles } = loadProfilesFile();
      const existing = profiles.find((p) => p.id === parsed.id || p.name === name);
      if (existing) {
        saveProfilesFile({ profiles, activeId: existing.id });
        return existing;
      }
      const id = parsed.id ? String(parsed.id) : makeProfileId(name);
      const colorIndex = Number.isFinite(parsed.colorIndex)
        ? Number(parsed.colorIndex)
        : colorIndexForName(name);
      const role = parsed.role === 'guest' ? 'guest' : 'user';
      const avatarDataUrl = normalizeAvatarDataUrl(parsed.avatarDataUrl);

      const baseProfile = {
        id,
        name,
        colorIndex,
        role
      };
      if (avatarDataUrl) {
        baseProfile.avatarDataUrl = avatarDataUrl;
      }

      // Try to preserve/import an existing walletAddress/address if present.
      if (parsed.walletAddress || parsed.address) {
        baseProfile.walletAddress = String(parsed.walletAddress || parsed.address);
      } else {
        const ensured = await ensureWalletForProfile(baseProfile);
        baseProfile.walletAddress = ensured && ensured.address ? ensured.address : null;
      }

      const profile = baseProfile;
      const next = [...profiles, profile];
      saveProfilesFile({ profiles: next, activeId: id });
      return profile;
    } catch {
      return null;
    }
  });

  ipcMain.handle('profiles:importBackup', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Select Lumen profile backup (file or folder)',
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [{ name: 'Profile backup', extensions: ['json'] }]
      });
      if (res.canceled || !res.filePaths || !res.filePaths.length) {
        return { ok: false, error: 'canceled' };
      }

      const selections = Array.from(new Set(res.filePaths.map((p) => String(p || '').trim()).filter(Boolean)));

      const all = loadProfilesFile();
      let profiles = all.profiles.slice();
      let activeId = all.activeId;

      const results = [];
      const seenFiles = new Set();

      for (const sel of selections) {
        const files = collectBackupFiles(sel);
        for (const file of files) {
          const abs = String(file || '').trim();
          if (!abs || seenFiles.has(abs)) continue;
          seenFiles.add(abs);

          try {
            if (!fs.existsSync(abs)) {
              results.push({ ok: false, path: abs, error: 'profile_json_missing' });
              continue;
            }

            const imported = readJson(abs, null);
            const one = importOneBackupObject(imported, profiles);
            if (one.ok) {
              activeId = one.id;
              results.push({ ok: true, path: abs, id: one.id });
            } else if (one.encrypted) {
              results.push({ ok: false, path: abs, error: one.error, encrypted: true });
            } else {
              results.push({ ok: false, path: abs, error: one.error || 'invalid_profile_backup' });
            }
          } catch (e) {
            results.push({ ok: false, path: abs, error: String(e && e.message ? e.message : e) });
          }
        }
      }

      const importedCount = results.filter((r) => r && r.ok).length;
      
      // Check if any files need decryption
      const encryptedFiles = results.filter((r) => r && r.encrypted === true);
      if (encryptedFiles.length > 0 && importedCount === 0) {
        return { 
          ok: false, 
          error: 'encrypted_backup_found',
          encryptedFiles: encryptedFiles.map(f => f.path)
        };
      }
      
      if (!importedCount) {
        return { ok: false, error: results.length ? 'no_valid_backups_found' : 'profile_json_missing' };
      }

      saveProfilesFile({ profiles, activeId });

      return { ok: true, selectedId: activeId, imported: importedCount, results };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('profiles:pickManualProfileSource', async () => {
    try {
      const picked = await pickSingleJsonFile('Select profile backup or dual-signer backup');
      if (!picked.ok) return picked;

      const abs = picked.filePath;
      if (!fs.existsSync(abs)) {
        return { ok: false, error: 'file_not_found' };
      }

      const imported = readJson(abs, null);
      if (!imported || typeof imported !== 'object') {
        return { ok: false, error: 'invalid_profile_backup' };
      }

      if (imported.passwordProtected === true && imported.crypto) {
        return { ok: false, error: 'encrypted_backup_source_unsupported' };
      }

      const mnemonic = String(imported.mnemonic || '').trim().replace(/\s+/g, ' ');
      if (!mnemonic) {
        return { ok: false, error: 'mnemonic_missing_in_selected_file' };
      }

      const fallbackName = path.basename(abs, path.extname(abs)) || 'pqc-import';
      const normalizedPqc = extractNormalizedPqcBackup(imported, fallbackName);

      return {
        ok: true,
        fileName: path.basename(abs),
        sourcePath: abs,
        name: String(imported.name || '').trim(),
        mnemonic,
        pqcPublicKey: normalizedPqc.record ? normalizedPqc.record.publicKey : '',
        pqcPrivateKey: normalizedPqc.record ? normalizedPqc.record.privateKey : '',
        hasPqc: !!normalizedPqc.record
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('profiles:pickManualPqcSource', async () => {
    try {
      const picked = await pickSingleJsonFile('Select Dilithium backup');
      if (!picked.ok) return picked;

      const abs = picked.filePath;
      if (!fs.existsSync(abs)) {
        return { ok: false, error: 'file_not_found' };
      }

      const imported = readJson(abs, null);
      if (!imported || typeof imported !== 'object') {
        return { ok: false, error: 'invalid_pqc_backup' };
      }

      if (imported.passwordProtected === true && imported.crypto) {
        return { ok: false, error: 'encrypted_backup_source_unsupported' };
      }

      const fallbackName = path.basename(abs, path.extname(abs)) || 'pqc-import';
      const normalizedPqc = extractNormalizedPqcBackup(imported, fallbackName);
      if (!normalizedPqc.found) {
        return { ok: false, error: 'pqc_missing_in_selected_file' };
      }
      if (!normalizedPqc.record) {
        return { ok: false, error: 'invalid_pqc_backup' };
      }

      return {
        ok: true,
        fileName: path.basename(abs),
        sourcePath: abs,
        pqcPublicKey: normalizedPqc.record.publicKey,
        pqcPrivateKey: normalizedPqc.record.privateKey,
        scheme: normalizedPqc.record.scheme,
        createdAt: normalizedPqc.record.createdAt
      };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('profiles:importManual', async (_evt, payload) => {
    try {
      const requestedName = String(payload && payload.name ? payload.name : '').trim();
      if (!requestedName) {
        return { ok: false, error: 'missing_profile_name' };
      }

      const mnemonic = String(payload && payload.mnemonic ? payload.mnemonic : '')
        .trim()
        .replace(/\s+/g, ' ');
      if (!mnemonic) {
        return { ok: false, error: 'missing_mnemonic' };
      }

      const pqcPublicKey = String(payload && payload.pqcPublicKey ? payload.pqcPublicKey : '').trim();
      const pqcPrivateKey = String(payload && payload.pqcPrivateKey ? payload.pqcPrivateKey : '').trim();
      if ((pqcPublicKey && !pqcPrivateKey) || (!pqcPublicKey && pqcPrivateKey)) {
        return { ok: false, error: 'pqc_keys_incomplete' };
      }

      const normalizedPqcPublicKey = pqcPublicKey ? normalizeBinaryKeyToBase64(pqcPublicKey) : '';
      const normalizedPqcPrivateKey = pqcPrivateKey ? normalizeBinaryKeyToBase64(pqcPrivateKey) : '';
      if ((pqcPublicKey || pqcPrivateKey) && (!normalizedPqcPublicKey || !normalizedPqcPrivateKey)) {
        return { ok: false, error: 'invalid_pqc_backup' };
      }

      let walletAddress = '';
      try {
        walletAddress = await deriveWalletAddressFromMnemonic(mnemonic, 'lmn');
      } catch {
        return { ok: false, error: 'invalid_mnemonic' };
      }

      const imported = {
        version: 1,
        name: requestedName,
        walletAddress,
        mnemonic,
      };

      if (normalizedPqcPublicKey && normalizedPqcPrivateKey) {
        imported.pqc = {
          publicKey: normalizedPqcPublicKey,
          privateKey: normalizedPqcPrivateKey,
          scheme: 'dilithium3',
          createdAt: new Date().toISOString(),
        };
      }

      const all = loadProfilesFile();
      let profiles = all.profiles.slice();
      const result = importOneBackupObject(imported, profiles);
      if (!result.ok) {
        return { ok: false, error: result.error || 'import_failed' };
      }

      saveProfilesFile({ profiles, activeId: result.id });
      return { ok: true, id: result.id, walletAddress };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  // Import encrypted backup with password
  ipcMain.handle('profiles:importEncryptedBackup', async (_evt, filePath, password) => {
    try {
      if (!filePath || !password) {
        return { ok: false, error: 'missing_parameters' };
      }

      const abs = String(filePath || '').trim();
      if (!fs.existsSync(abs)) {
        return { ok: false, error: 'file_not_found' };
      }

      const encrypted = readJson(abs, null);
      if (!encrypted || !encrypted.passwordProtected || !encrypted.crypto) {
        return { ok: false, error: 'not_encrypted_backup' };
      }

      // Try to decrypt
      const pwd = String(password || '');
      let decrypted;
      try {
        const plaintext = decryptWithPassword(encrypted, pwd);
        decrypted = JSON.parse(plaintext);
      } catch (e) {
        return { ok: false, error: 'invalid_password' };
      }

      try {
        const pqc = decrypted && decrypted.pqc;
        const hasPqc = !!(pqc && (pqc.publicKey || pqc.public_key) && (pqc.privateKey || pqc.private_key));
        const addr = String(decrypted?.walletAddress || decrypted?.address || '').trim();
        console.log('[profiles:importEncryptedBackup] decrypted backup:', {
          hasPqc,
          hasWalletAddress: !!addr,
          id: String(decrypted?.id || ''),
        });
      } catch {}

      // If the app has password protection enabled, unlock the session so follow-up signing works.
      // (Also enables merging into encrypted pqc_keys store.)
      try {
        if (isPasswordRequired() && verifyStoredPassword(pwd)) {
          setSessionPassword(pwd);
        }
      } catch {
        // ignore
      }

      // Now import the decrypted backup
      const all = loadProfilesFile();
      let profiles = all.profiles.slice();
      
      const result = importOneBackupObject(decrypted, profiles, pwd);
      if (!result.ok) {
        return { ok: false, error: result.error || 'import_failed' };
      }

      saveProfilesFile({ profiles, activeId: result.id });

      return { ok: true, id: result.id };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle('profiles:delete', async (_evt, id) => {
    const { profiles, activeId } = loadProfilesFile();
    const targetId = String(id || '').trim();
    if (!targetId) return { ok: false, error: 'missing_profile_id' };

    const target = profiles.find((p) => String(p && p.id ? p.id : '') === targetId) || null;
    const targetAddr = String(
      (target && (target.walletAddress || target.address)) || ''
    ).trim();

    // Clean PQC links + key for this profile.
    try {
      const linksPath = pqcLinksFile();
      let links = {};
      if (fs.existsSync(linksPath)) links = readJson(linksPath, {}) || {};

      const linkedKeyName =
        targetAddr && typeof links[targetAddr] === 'string' ? String(links[targetAddr]) : '';

      if (targetAddr && links && typeof links === 'object') {
        delete links[targetAddr];
        ensureDir(pqcKeysDir());
        fs.writeFileSync(linksPath, JSON.stringify(links, null, 2), 'utf8');
      }

      const candidateNames = Array.from(
        new Set([linkedKeyName, `profile:${targetId}`].filter(Boolean))
      );

      if (candidateNames.length) {
        const keysPath = pqcKeysFile();
        if (fs.existsSync(keysPath)) {
          const raw = readJson(keysPath, null);
          const encrypted = isEncryptedPqcKeysObject(raw);
          const pwd = getSessionPassword();
          if (encrypted && !pwd) {
            return { ok: false, error: 'password_required' };
          }

          const readRes = readPqcKeysForMerge(pwd);
          if (!readRes.ok) {
            return { ok: false, error: readRes.error || 'password_required' };
          }

          const keys = readRes.keys || {};

          for (const keyName of candidateNames) {
            if (!keys || typeof keys !== 'object') break;
            if (!keys[keyName]) continue;
            const stillUsed = Object.values(links || {}).some((v) => String(v || '') === keyName);
            if (!stillUsed) {
              delete keys[keyName];
            }
          }

          writePqcKeysAfterMerge(keys, readRes.encrypted, pwd);
        }
      }
    } catch (e) {
      console.warn('[profiles] failed to cleanup PQC data for profile', targetId, e?.message || e);
    }

    // Best-effort: remove local keystore folder for this profile.
    try {
      const dir = profileDir(targetId);
      if (fs.existsSync(dir)) {
        if (typeof fs.rmSync === 'function') {
          fs.rmSync(dir, { recursive: true, force: true });
        } else if (typeof fs.rmdirSync === 'function') {
          fs.rmdirSync(dir, { recursive: true });
        }
      }
    } catch (e) {
      console.warn('[profiles] failed to remove profile dir', targetId, e?.message || e);
    }

    const nextProfiles = profiles.filter((p) => String(p && p.id ? p.id : '') !== targetId);
    let nextActive = activeId;
    if (activeId === targetId) {
      nextActive = nextProfiles[0] ? nextProfiles[0].id : '';
    }
    saveProfilesFile({ profiles: nextProfiles, activeId: nextActive });
    return { profiles: nextProfiles, activeId: nextActive };
  });
}

module.exports = {
  registerProfilesIpc,
  loadProfilesFile
};
