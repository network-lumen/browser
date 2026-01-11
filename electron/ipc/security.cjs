const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  hashPassword,
  verifyPassword,
  encryptMnemonicWithPassword,
  decryptMnemonicWithPassword,
  encryptMnemonicLocal,
  decryptMnemonicLocal,
  isPasswordProtected,
  encryptWithPassword,
  decryptWithPassword
} = require('../utils/crypto.cjs');
const {
  getSecurityStatus,
  setSecurityPassword,
  removeSecurityPassword,
  getStoredPasswordHash
} = require('../settings.cjs');
const { userDataPath, readJson, ensureDir } = require('../utils/fs.cjs');

// In-memory password cache for session (cleared on app quit)
// This allows us to not ask for password on every single operation
let sessionPassword = null;
let sessionPasswordExpiry = 0;
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function profileDir(id) {
  return userDataPath('profiles', id);
}

function keystorePath(id) {
  return path.join(profileDir(id), 'keystore.json');
}

function pqcKeysDir() {
  return userDataPath('pqc_keys');
}

/**
 * Clear session password
 */
function clearSessionPassword() {
  sessionPassword = null;
  sessionPasswordExpiry = 0;
}

/**
 * Set session password with expiry
 */
function setSessionPassword(password) {
  sessionPassword = password;
  sessionPasswordExpiry = Date.now() + SESSION_TIMEOUT_MS;
}

/**
 * Get session password if still valid
 */
function getSessionPassword() {
  if (!sessionPassword) return null;
  if (Date.now() > sessionPasswordExpiry) {
    clearSessionPassword();
    return null;
  }
  // Extend session on use
  sessionPasswordExpiry = Date.now() + SESSION_TIMEOUT_MS;
  return sessionPassword;
}

/**
 * Check if password is required for operations
 */
function isPasswordRequired() {
  const status = getSecurityStatus();
  return status.passwordEnabled && status.hasPassword;
}

/**
 * Verify provided password against stored hash
 */
function verifyStoredPassword(password) {
  const storedHash = getStoredPasswordHash();
  if (!storedHash) return false;
  return verifyPassword(password, storedHash);
}

/**
 * Re-encrypt all keystores from app-secret to password-based
 */
function reEncryptAllKeystores(password) {
  const profilesFile = userDataPath('profiles.json');
  let profiles = [];
  try {
    const data = readJson(profilesFile, { profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
  } catch {
    profiles = [];
  }

  for (const p of profiles) {
    const ksPath = keystorePath(p.id);
    if (!fs.existsSync(ksPath)) continue;

    try {
      const ks = readJson(ksPath, null);
      if (!ks || !ks.crypto) continue;

      // Skip if already password protected
      if (isPasswordProtected(ks)) continue;

      // Decrypt with app secret
      const mnemonic = decryptMnemonicLocal(ks);
      if (!mnemonic) continue;

      // Re-encrypt with password
      const newKs = encryptMnemonicWithPassword(mnemonic, password);
      fs.writeFileSync(ksPath, JSON.stringify(newKs, null, 2), 'utf8');
    } catch (e) {
      console.warn('[security] failed to re-encrypt keystore for profile', p.id, e);
    }
  }

  // Re-encrypt PQC keys
  reEncryptPqcKeys(password);
}

/**
 * Re-encrypt PQC keys with password
 */
function reEncryptPqcKeys(password) {
  const keysFile = path.join(pqcKeysDir(), 'keys.json');
  if (!fs.existsSync(keysFile)) return;

  try {
    const keys = readJson(keysFile, {});
    if (!keys || typeof keys !== 'object') return;

    // Check if already encrypted
    if (keys._encrypted) return;

    // Encrypt the entire keys object
    const encrypted = encryptWithPassword(JSON.stringify(keys), password);
    encrypted._encrypted = true;
    fs.writeFileSync(keysFile, JSON.stringify(encrypted, null, 2), 'utf8');
  } catch (e) {
    console.warn('[security] failed to re-encrypt PQC keys', e);
  }
}

/**
 * Re-encrypt all keystores from password to app-secret (when removing password)
 */
function reEncryptToAppSecret(currentPassword) {
  const profilesFile = userDataPath('profiles.json');
  let profiles = [];
  try {
    const data = readJson(profilesFile, { profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
  } catch {
    profiles = [];
  }

  for (const p of profiles) {
    const ksPath = keystorePath(p.id);
    if (!fs.existsSync(ksPath)) continue;

    try {
      const ks = readJson(ksPath, null);
      if (!ks || !ks.crypto) continue;

      // Only convert password-protected keystores
      if (!isPasswordProtected(ks)) continue;

      // Decrypt with password
      const mnemonic = decryptMnemonicWithPassword(ks, currentPassword);
      if (!mnemonic) continue;

      // Re-encrypt with app secret
      const newKs = encryptMnemonicLocal(mnemonic);
      fs.writeFileSync(ksPath, JSON.stringify(newKs, null, 2), 'utf8');
    } catch (e) {
      console.warn('[security] failed to re-encrypt keystore to app secret for profile', p.id, e);
    }
  }

  // Decrypt PQC keys back to plain
  decryptPqcKeysToPlain(currentPassword);
}

/**
 * Decrypt PQC keys back to plain storage
 */
function decryptPqcKeysToPlain(password) {
  const keysFile = path.join(pqcKeysDir(), 'keys.json');
  if (!fs.existsSync(keysFile)) return;

  try {
    const encrypted = readJson(keysFile, {});
    if (!encrypted || !encrypted._encrypted || !encrypted.crypto) return;

    const decrypted = decryptWithPassword(encrypted, password);
    const keys = JSON.parse(decrypted);
    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), 'utf8');
  } catch (e) {
    console.warn('[security] failed to decrypt PQC keys', e);
  }
}

/**
 * Change password - re-encrypt all keys with new password
 */
function changePassword(currentPassword, newPassword) {
  // First decrypt everything with current password, then re-encrypt with new
  const profilesFile = userDataPath('profiles.json');
  let profiles = [];
  try {
    const data = readJson(profilesFile, { profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
  } catch {
    profiles = [];
  }

  for (const p of profiles) {
    const ksPath = keystorePath(p.id);
    if (!fs.existsSync(ksPath)) continue;

    try {
      const ks = readJson(ksPath, null);
      if (!ks || !ks.crypto) continue;

      let mnemonic;
      if (isPasswordProtected(ks)) {
        mnemonic = decryptMnemonicWithPassword(ks, currentPassword);
      } else {
        mnemonic = decryptMnemonicLocal(ks);
      }
      if (!mnemonic) continue;

      // Re-encrypt with new password
      const newKs = encryptMnemonicWithPassword(mnemonic, newPassword);
      fs.writeFileSync(ksPath, JSON.stringify(newKs, null, 2), 'utf8');
    } catch (e) {
      console.warn('[security] failed to change password for profile', p.id, e);
    }
  }

  // Re-encrypt PQC keys
  const keysFile = path.join(pqcKeysDir(), 'keys.json');
  if (fs.existsSync(keysFile)) {
    try {
      const encrypted = readJson(keysFile, {});
      let keys;
      if (encrypted._encrypted && encrypted.crypto) {
        const decrypted = decryptWithPassword(encrypted, currentPassword);
        keys = JSON.parse(decrypted);
      } else {
        keys = encrypted;
      }

      const newEncrypted = encryptWithPassword(JSON.stringify(keys), newPassword);
      newEncrypted._encrypted = true;
      fs.writeFileSync(keysFile, JSON.stringify(newEncrypted, null, 2), 'utf8');
    } catch (e) {
      console.warn('[security] failed to change password for PQC keys', e);
    }
  }
}

function registerSecurityIpc() {
  // Get security status (password enabled, etc.)
  ipcMain.handle('security:getStatus', async () => {
    const status = getSecurityStatus();
    return {
      passwordEnabled: status.passwordEnabled,
      hasPassword: status.hasPassword,
      sessionActive: !!getSessionPassword()
    };
  });

  // Set password (first time or change)
  ipcMain.handle('security:setPassword', async (_evt, input) => {
    try {
      const password = String(input?.password || '').trim();
      const currentPassword = String(input?.currentPassword || '').trim();

      if (!password || password.length < 6) {
        return { ok: false, error: 'password_too_short' };
      }

      const status = getSecurityStatus();

      // If already has password, verify current password first
      if (status.hasPassword) {
        if (!currentPassword) {
          return { ok: false, error: 'current_password_required' };
        }
        if (!verifyStoredPassword(currentPassword)) {
          return { ok: false, error: 'invalid_current_password' };
        }
        // Change password
        changePassword(currentPassword, password);
      } else {
        // First time setting password - re-encrypt existing keys
        reEncryptAllKeystores(password);
      }

      // Hash and store the new password
      const passwordHash = hashPassword(password);
      setSecurityPassword(passwordHash);

      // Set session password
      setSessionPassword(password);

      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Verify password (for session unlock)
  ipcMain.handle('security:verifyPassword', async (_evt, input) => {
    try {
      const password = String(input?.password || '').trim();

      if (!password) {
        return { ok: false, error: 'password_required' };
      }

      if (!verifyStoredPassword(password)) {
        return { ok: false, error: 'invalid_password' };
      }

      // Set session password
      setSessionPassword(password);

      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Remove password protection
  ipcMain.handle('security:removePassword', async (_evt, input) => {
    try {
      const password = String(input?.password || '').trim();

      if (!password) {
        return { ok: false, error: 'password_required' };
      }

      if (!verifyStoredPassword(password)) {
        return { ok: false, error: 'invalid_password' };
      }

      // Re-encrypt back to app secret
      reEncryptToAppSecret(password);

      // Remove password from settings
      removeSecurityPassword();

      // Clear session
      clearSessionPassword();

      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Lock session (clear cached password)
  ipcMain.handle('security:lockSession', async () => {
    clearSessionPassword();
    return { ok: true };
  });

  // Check if session is active
  ipcMain.handle('security:checkSession', async () => {
    return { active: !!getSessionPassword() };
  });

  // Extend session timeout
  ipcMain.handle('security:extendSession', async () => {
    if (sessionPassword) {
      sessionPasswordExpiry = Date.now() + SESSION_TIMEOUT_MS;
      return { ok: true };
    }
    return { ok: false, error: 'no_active_session' };
  });
}

module.exports = {
  registerSecurityIpc,
  isPasswordRequired,
  getSessionPassword,
  setSessionPassword,
  clearSessionPassword,
  verifyStoredPassword
};
