const { app, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { userDataPath, readJson, writeJson, ensureDir } = require('../utils/fs.cjs');
const { encryptMnemonicLocal, decryptMnemonicLocal, encryptWithPassword, decryptWithPassword, isPasswordProtected } = require('../utils/crypto.cjs');

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

function secretFilePath() {
  return userDataPath('secret.bin');
}

function loadProfilesFile() {
  const file = profilesFilePath();
  const fallback = { profiles: [], activeId: '' };
  const data = readJson(file, fallback);
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
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
  try {
    const addr = String(p.walletAddress || p.address || '').trim();
    const keysFile = path.join(srcPqcDir, 'keys.json');
    const linksFile = path.join(srcPqcDir, 'links.json');
    if (addr && fs.existsSync(keysFile) && fs.existsSync(linksFile)) {
      // First check if keys.json is encrypted
      let keysRaw = readJson(keysFile, {});
      
      // If keys.json is password-protected, decrypt it first
      if (keysRaw && isPasswordProtected(keysRaw)) {
        if (decryptPassword) {
          try {
            const decrypted = decryptWithPassword(keysRaw, decryptPassword);
            keysRaw = JSON.parse(decrypted);
          } catch {
            keysRaw = {};
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

  return {
    version: 1,
    id: p.id,
    name: p.name,
    colorIndex: p.colorIndex,
    role: p.role || 'user',
    walletAddress: p.walletAddress || p.address || null,
      favourites: p.favourites || {},
    favourites: p.favourites || {},
    createdAt: Date.now(),
    mnemonic: mnemonicPlain || null,
    pqc: pqcKey
  };
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

function importOneBackupObject(imported, profiles) {
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

  const profile = {
    id,
    name,
    colorIndex,
    role,
    walletAddress
  };

  profiles.push(profile);

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
      fs.writeFileSync(
        path.join(dstDir, 'profile.json'),
        JSON.stringify(meta, null, 2),
        'utf8'
      );
    }
  } catch {}

  // Merge PQC key if present
  try {
    const pqc = imported.pqc;
    if (pqc && pqc.publicKey && pqc.privateKey && walletAddress) {
      const keysFile = path.join(pqcKeysDir(), 'keys.json');
      const linksFile = path.join(pqcKeysDir(), 'links.json');
      let keys = {};
      let links = {};
      if (fs.existsSync(keysFile)) keys = readJson(keysFile, {}) || {};
      if (fs.existsSync(linksFile)) links = readJson(linksFile, {}) || {};

      const keyName = String(pqc.name || `profile:${id}`);
      keys[keyName] = {
        name: keyName,
        scheme: pqc.scheme || 'dilithium3',
        publicKey: pqc.publicKey,
        privateKey: pqc.privateKey,
        createdAt: pqc.createdAt || new Date().toISOString()
      };
      links[walletAddress] = keyName;

      ensureDir(pqcKeysDir());
      fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), 'utf8');
      fs.writeFileSync(linksFile, JSON.stringify(links, null, 2), 'utf8');
    }
  } catch {}

  return { ok: true, id };
}

function saveProfiles(profiles, activeId) {
  saveProfilesFile({ profiles, activeId });
}

function updateActiveProfile(mutator) {
  const data = loadProfilesFile();
  const idx = data.profiles.findIndex(p => p.id === data.activeId);
  if (idx === -1) return { ok: false };
  const p = { ...data.profiles[idx] };
  mutator(p);
  data.profiles[idx] = p;
  saveProfiles(data);
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
      favourites: p.favourites || {}
    }));

    // No profiles at all -> bootstrap a guest profile without on-chain wallet.
    if (!normalized.length) {
      const name = 'Guest';
      const p = {
        id: 'guest',
        name,
        colorIndex: colorIndexForName(name),
        role: 'guest',
        walletAddress: null
      };
      const next = [p];
      saveProfilesFile({ profiles: next, activeId: p.id });
      return { profiles: next, activeId: p.id };
    }

    // If at least one non-guest profile exists, drop the guest from the list.
    const hasUser = normalized.some((p) => p.role !== 'guest');
    if (hasUser) {
      const filtered = normalized.filter((p) => p.role !== 'guest');
      let nextActive = activeId;
      if (!filtered.find((p) => p.id === activeId)) {
        nextActive = filtered[0] ? filtered[0].id : '';
      }
      saveProfilesFile({ profiles: filtered, activeId: nextActive });
      return { profiles: filtered, activeId: nextActive };
    }

    return { profiles: normalized, activeId };
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
    const active = profiles.find((p) => p.id === activeId) || profiles[0] || null;
    return active || null;
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

    const profile = { ...baseProfile, walletAddress };
    const next = [...profiles, profile];
    saveProfilesFile({ profiles: next, activeId: id });
    return profile;
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
    console.log('[exportBackup] Called with id:', id, 'password provided:', !!password, 'password length:', password?.length, 'encryptOutput:', !!encryptOutput);
    
    const { profiles } = loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'profile_not_found' };

    // Check if we need password to decrypt the data first
    let needsDecryptPassword = false;
    try {
      const ksSrc = path.join(profileDir(p.id), 'keystore.json');
      if (fs.existsSync(ksSrc)) {
        const ks = readJson(ksSrc, null);
        if (ks && isPasswordProtected(ks)) {
          needsDecryptPassword = true;
        }
      }
    } catch {}
    
    if (!needsDecryptPassword) {
      try {
        const keysFile = path.join(pqcKeysDir(), 'keys.json');
        if (fs.existsSync(keysFile)) {
          const keysRaw = readJson(keysFile, null);
          if (keysRaw && isPasswordProtected(keysRaw)) {
            needsDecryptPassword = true;
          }
        }
      } catch {}
    }

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
      const backup = buildProfileBackupObject(p, password);
      
      // Validate that mnemonic was extracted (if keystore exists)
      const ksSrc = path.join(profileDir(p.id), 'keystore.json');
      if (fs.existsSync(ksSrc) && !backup.mnemonic) {
        return { ok: false, error: 'invalid_password' };
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

      return { ok: true, path: backupPath };
    } catch (e) {
      const errMsg = String(e && e.message ? e.message : e);
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
          const backup = buildProfileBackupObject(p);
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

      const baseProfile = {
        id,
        name,
        colorIndex,
        role
      };

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
      let decrypted;
      try {
        const plaintext = decryptWithPassword(encrypted, password);
        decrypted = JSON.parse(plaintext);
      } catch (e) {
        return { ok: false, error: 'invalid_password' };
      }

      // Now import the decrypted backup
      const all = loadProfilesFile();
      let profiles = all.profiles.slice();
      
      const result = importOneBackupObject(decrypted, profiles);
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
    const targetId = String(id || '');
    const nextProfiles = profiles.filter((p) => p.id !== targetId);
    let nextActive = activeId;
    if (activeId === targetId) {
      nextActive = nextProfiles[0] ? nextProfiles[0].id : '';
    }
    saveProfilesFile({ profiles: nextProfiles, activeId: nextActive });
    return { profiles: nextProfiles, activeId: nextActive };
  });
}

module.exports = {
  registerProfilesIpc
};
