const { ipcMain, BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  hashPassword,
  verifyPassword,
  decryptMnemonicWithPassword,
  encryptMnemonicLocal,
  decryptMnemonicLocal,
  isPasswordProtected,
  encryptWithPassword,
  decryptWithPassword
} = require('../utils/crypto.cjs');
const {
  getSecurityStatus,
  getSecuritySessionTimeoutMs,
  setSecurityPassword,
  removeSecurityPassword,
  getStoredPasswordHash
} = require('../settings.cjs');
const { userDataPath, readJson, writeFilesAtomic } = require('../utils/fs.cjs');
const { repairPlaintextPqcKeys } = require('../utils/pqc-keys.cjs');

// In-memory password cache for session (cleared on app quit).
// The session stays unlocked until the configured timeout expires, or until
// the app closes when "Until restart" is selected.
let sessionPassword = null;
let sessionPasswordExpiry = null;
let sessionLockTimer = null;
let sessionTouchThrottleAt = 0;
const SESSION_TOUCH_THROTTLE_MS = 1500;

function broadcastSessionChanged(active) {
  try {
    const payload = { active: !!active };
    const wins = typeof BrowserWindow?.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const w of wins) {
      try {
        w?.webContents?.send?.('security:sessionChanged', payload);
      } catch {
        // ignore per-window failures
      }
    }
  } catch {
    // ignore
  }
}

function scheduleSessionAutoLock() {
  try {
    if (sessionLockTimer) {
      clearTimeout(sessionLockTimer);
      sessionLockTimer = null;
    }

    if (!sessionPassword || sessionPasswordExpiry === null) return;

    const now = Date.now();
    const delay = Math.max(0, sessionPasswordExpiry - now) + 50;
    sessionLockTimer = setTimeout(() => {
      try {
        if (!sessionPassword || sessionPasswordExpiry === null) return;
        if (Date.now() < sessionPasswordExpiry) {
          scheduleSessionAutoLock();
          return;
        }
        clearSessionPassword();
      } catch {
        // ignore
      }
    }, delay);
  } catch {
    // ignore
  }
}

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
  sessionPasswordExpiry = null;
  try {
    if (sessionLockTimer) {
      clearTimeout(sessionLockTimer);
      sessionLockTimer = null;
    }
  } catch {}
  broadcastSessionChanged(false);
}

/**
 * Set session password with expiry
 */
function setSessionPassword(password) {
  sessionPassword = password;
  // The first moment in a run where the password is known is the only moment
  // this can be fixed: signing writes the PQC keys out in the clear and puts
  // them back afterwards, so a crash in between leaves them readable until
  // someone signs again. Unlocking is when we can quietly put them back.
  try {
    repairPlaintextPqcKeys(password);
  } catch {
    // Never block an unlock on the repair.
  }
  syncActiveSessionTimeout(getSecuritySessionTimeoutMs());
  broadcastSessionChanged(true);
}

/**
 * Get session password if still valid
 */
function getSessionPassword() {
  if (!sessionPassword) return null;
  if (sessionPasswordExpiry !== null && Date.now() > sessionPasswordExpiry) {
    clearSessionPassword();
    return null;
  }
  return sessionPassword;
}

function touchSession() {
  if (!sessionPassword) return false;
  const now = Date.now();
  if (now - sessionTouchThrottleAt < SESSION_TOUCH_THROTTLE_MS) return true;
  sessionTouchThrottleAt = now;
  const timeoutMs = getSecuritySessionTimeoutMs();
  sessionPasswordExpiry = timeoutMs === null ? null : now + timeoutMs;
  scheduleSessionAutoLock();
  return true;
}

function syncActiveSessionTimeout(timeoutMs = getSecuritySessionTimeoutMs()) {
  if (!sessionPassword) return false;
  sessionPasswordExpiry = timeoutMs === null ? null : Date.now() + timeoutMs;
  scheduleSessionAutoLock();
  return true;
}

let activityHooksInstalled = false;
function installActivityHooks() {
  if (activityHooksInstalled) return;
  activityHooksInstalled = true;

  if (!app || typeof app.on !== 'function') return;

  const attach = (contents) => {
    if (!contents || typeof contents.on !== 'function') return;
    try {
      contents.on('before-input-event', () => {
        try {
          touchSession();
        } catch {}
      });
    } catch {
      // ignore
    }
  };

  try {
    for (const w of BrowserWindow.getAllWindows()) {
      attach(w?.webContents);
    }
  } catch {}

  app.on('web-contents-created', (_event, contents) => {
    attach(contents);
  });
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
 * Every secret on disk, decrypted, or nothing at all.
 *
 * This is the half that used to be missing. Re-encrypting used to walk the
 * profiles writing as it went, catching per profile and carrying on, and the
 * new password hash was stored afterwards regardless. A profile that failed to
 * re-encrypt therefore kept the old password while the app believed the new
 * one - and that wallet could never be opened again. There was no backup and
 * no way back.
 *
 * So: read and decrypt everything first. One failure aborts the whole thing
 * before a single byte is written.
 *
 * @param decryptKeystore given the keystore and the profile id, returns
 *   `{ mnemonic }`, `{ skip: true }` for one that needs no conversion, or
 *   `{ error }`.
 * @returns `{ ok: true, keystores, pqcKeys }` or `{ ok: false, error, profileId? }`
 */
function readAllSecrets(decryptKeystore, decryptPqc) {
  let profiles = [];
  try {
    const data = readJson(userDataPath('profiles.json'), { profiles: [] });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
  } catch {
    profiles = [];
  }

  const keystores = [];
  for (const p of profiles) {
    const ksPath = keystorePath(p.id);
    if (!fs.existsSync(ksPath)) continue;

    let ks;
    try {
      ks = readJson(ksPath, null);
    } catch {
      return { ok: false, error: 'keystore_unreadable', profileId: p.id };
    }
    if (!ks || !ks.crypto) continue;

    let outcome;
    try {
      outcome = decryptKeystore(ks, p.id);
    } catch {
      outcome = { error: 'keystore_decrypt_failed' };
    }
    if (outcome.skip) continue;
    if (!outcome.mnemonic) {
      return { ok: false, error: outcome.error || 'keystore_decrypt_failed', profileId: p.id };
    }
    keystores.push({ path: ksPath, mnemonic: outcome.mnemonic });
  }

  const keysFile = path.join(pqcKeysDir(), 'keys.json');
  let pqcKeys = null;
  if (fs.existsSync(keysFile)) {
    let outcome;
    try {
      outcome = decryptPqc(readJson(keysFile, {}) || {});
    } catch {
      outcome = { error: 'pqc_decrypt_failed' };
    }
    if (outcome.error) return { ok: false, error: outcome.error };
    if (!outcome.skip) pqcKeys = { path: keysFile, keys: outcome.keys };
  }

  return { ok: true, keystores, pqcKeys };
}

/** Phase two: everything is in hand, so write it in one batch. */
function writeAllSecrets(secrets, encryptKeystore, encryptPqc) {
  const entries = secrets.keystores.map(({ path: file, mnemonic }) => ({
    file,
    contents: JSON.stringify(encryptKeystore(mnemonic), null, 2)
  }));
  if (secrets.pqcKeys) {
    entries.push({
      file: secrets.pqcKeys.path,
      contents: JSON.stringify(encryptPqc(secrets.pqcKeys.keys), null, 2)
    });
  }
  writeFilesAtomic(entries);
  return { ok: true, changed: entries.length };
}

/**
 * Turns password protection on: every keystore moves from the machine secret
 * to the password.
 */
function reEncryptAllKeystores(password) {
  const secrets = readAllSecrets(
    (ks) => {
      if (isPasswordProtected(ks)) return { skip: true };
      const mnemonic = decryptMnemonicLocal(ks);
      return mnemonic ? { mnemonic } : { error: 'keystore_decrypt_failed' };
    },
    (raw) => (raw && raw._encrypted ? { skip: true } : { keys: raw })
  );
  if (!secrets.ok) return secrets;

  return writeAllSecrets(
    secrets,
    (mnemonic) => encryptWithPassword(mnemonic, password),
    (keys) => {
      const encrypted = encryptWithPassword(JSON.stringify(keys), password);
      encrypted._encrypted = true;
      return encrypted;
    }
  );
}

/** Turns password protection off: everything moves back to the machine secret. */
function reEncryptToAppSecret(currentPassword) {
  const secrets = readAllSecrets(
    (ks) => {
      if (!isPasswordProtected(ks)) return { skip: true };
      const mnemonic = decryptMnemonicWithPassword(ks, currentPassword);
      return mnemonic ? { mnemonic } : { error: 'invalid_password' };
    },
    (raw) => {
      if (!raw || !raw._encrypted || !raw.crypto) return { skip: true };
      try {
        return { keys: JSON.parse(decryptWithPassword(raw, currentPassword)) };
      } catch {
        return { error: 'invalid_password' };
      }
    }
  );
  if (!secrets.ok) return secrets;

  return writeAllSecrets(
    secrets,
    (mnemonic) => encryptMnemonicLocal(mnemonic),
    (keys) => keys
  );
}

/** Moves every secret from one password to another. */
function changePassword(currentPassword, newPassword) {
  const secrets = readAllSecrets(
    (ks) => {
      const mnemonic = isPasswordProtected(ks)
        ? decryptMnemonicWithPassword(ks, currentPassword)
        : decryptMnemonicLocal(ks);
      return mnemonic ? { mnemonic } : { error: 'invalid_password' };
    },
    (raw) => {
      if (!raw || !raw._encrypted || !raw.crypto) return { keys: raw || {} };
      try {
        return { keys: JSON.parse(decryptWithPassword(raw, currentPassword)) };
      } catch {
        return { error: 'invalid_password' };
      }
    }
  );
  if (!secrets.ok) return secrets;

  return writeAllSecrets(
    secrets,
    (mnemonic) => encryptWithPassword(mnemonic, newPassword),
    (keys) => {
      const encrypted = encryptWithPassword(JSON.stringify(keys), newPassword);
      encrypted._encrypted = true;
      return encrypted;
    }
  );
}

function registerSecurityIpc() {
  installActivityHooks();
  // Get security status (password enabled, etc.)
  ipcMain.handle('security:getStatus', async () => {
    const status = getSecurityStatus();
    return {
      passwordEnabled: status.passwordEnabled,
      hasPassword: status.hasPassword,
      sessionActive: !!getSessionPassword(),
      sessionTimeoutMs: status.sessionTimeoutMs
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

      // The order here is the whole point. The secrets are converted first, and
      // the stored hash only moves if every one of them made it. Storing the
      // hash first - or storing it after a conversion that half-failed - leaves
      // a wallet encrypted with a password the app no longer knows, and there
      // is no way back from that.
      const converted = status.hasPassword
        ? (() => {
            if (!currentPassword) return { ok: false, error: 'current_password_required' };
            if (!verifyStoredPassword(currentPassword)) {
              return { ok: false, error: 'invalid_current_password' };
            }
            return changePassword(currentPassword, password);
          })()
        : reEncryptAllKeystores(password);

      if (!converted.ok) {
        console.warn(
          '[security] password change aborted, nothing was written:',
          converted.error,
          converted.profileId ? `profile=${converted.profileId}` : ''
        );
        return converted;
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

      // Same order as setting one: convert first, and only forget the password
      // if every secret came back under the machine secret. Forgetting it while
      // a keystore still needs it is unrecoverable.
      const converted = reEncryptToAppSecret(password);
      if (!converted.ok) {
        console.warn('[security] password removal aborted, nothing was written:', converted.error);
        return converted;
      }

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

  // Touch session (extend idle timeout on user action)
  ipcMain.handle('security:touchSession', async () => {
    const ok = touchSession();
    if (!ok) return { ok: false, error: 'no_active_session' };
    return { ok: true };
  });

  // Check if session is active
  ipcMain.handle('security:checkSession', async () => {
    return { active: !!getSessionPassword() };
  });

  // Extend session timeout
  ipcMain.handle('security:extendSession', async () => {
    const ok = touchSession();
    if (!ok) return { ok: false, error: 'no_active_session' };
    return { ok: true };
  });
}

module.exports = {
  registerSecurityIpc,
  isPasswordRequired,
  getSessionPassword,
  setSessionPassword,
  clearSessionPassword,
  syncActiveSessionTimeout,
  verifyStoredPassword
};
