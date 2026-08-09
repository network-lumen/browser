const fs = require('fs');
const path = require('path');
const { userDataPath, readJson } = require('./fs.cjs');
const { encryptWithPassword, decryptWithPassword, isPasswordProtected } = require('./crypto.cjs');

function resolvePqcHomeDir() {
  return process.env.LUMEN_PQC_HOME || userDataPath();
}

function pqcKeysFilePath() {
  return path.join(resolvePqcHomeDir(), 'pqc_keys', 'keys.json');
}

/**
 * Check if PQC keys are password-encrypted.
 */
function arePqcKeysEncrypted() {
  const keysFile = pqcKeysFilePath();
  if (!fs.existsSync(keysFile)) return false;
  try {
    const data = readJson(keysFile, null);
    // Accept both current marker (_encrypted) and legacy password-protected containers.
    return !!(
      data &&
      typeof data === 'object' &&
      !!data.crypto &&
      (data._encrypted === true || isPasswordProtected(data))
    );
  } catch {
    return false;
  }
}

/**
 * Temporarily decrypt PQC keys file for use by SDK.
 * Returns cleanup function to restore encrypted state, or null on failure / no-op.
 */
function tempDecryptPqcKeys(password) {
  const keysFile = pqcKeysFilePath();
  if (!fs.existsSync(keysFile)) return null;

  try {
    const data = readJson(keysFile, null);
    if (!data) return null;

    // Not encrypted -> no action needed
    const encrypted =
      !!data.crypto && (data._encrypted === true || isPasswordProtected(data));
    if (!encrypted) {
      return null;
    }

    const decryptedStr = decryptWithPassword(data, password);
    if (!decryptedStr) {
      return null;
    }

    const decryptedKeys = JSON.parse(decryptedStr);

    // Save decrypted version temporarily and keep encrypted backup as fallback.
    const backup = JSON.stringify(data);
    fs.writeFileSync(keysFile, JSON.stringify(decryptedKeys, null, 2), 'utf8');

    return () => {
      try {
        const current = readJson(keysFile, null);
        const currentIsEncrypted =
          !!current &&
          typeof current === 'object' &&
          !!current.crypto &&
          (current._encrypted === true || isPasswordProtected(current));

        if (currentIsEncrypted) {
          return;
        }

        if (current && typeof current === 'object') {
          const encryptedCurrent = encryptWithPassword(JSON.stringify(current), password);
          encryptedCurrent._encrypted = true;
          fs.writeFileSync(keysFile, JSON.stringify(encryptedCurrent, null, 2), 'utf8');
          return;
        }

        fs.writeFileSync(keysFile, backup, 'utf8');
      } catch (e) {
        console.error('[pqc-keys] failed to restore encrypted PQC keys', e);
      }
    };
  } catch (e) {
    console.error('[pqc-keys] error in tempDecryptPqcKeys', e);
    return null;
  }
}

module.exports = {
  arePqcKeysEncrypted,
  tempDecryptPqcKeys,
};
