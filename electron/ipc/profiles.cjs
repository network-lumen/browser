const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { userDataPath, readJson, writeJson, ensureDir } = require('../utils/fs.cjs');
const { encryptMnemonicLocal } = require('../utils/crypto.cjs');

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
      walletAddress: p.walletAddress || p.address || null
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
