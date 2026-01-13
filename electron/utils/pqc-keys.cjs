const fs = require('fs');
const path = require('path');
const { userDataPath, readJson } = require('./fs.cjs');
const { decryptWithPassword } = require('./crypto.cjs');

function pqcKeysFilePath() {
  return path.join(userDataPath('pqc_keys'), 'keys.json');
}

/**
 * Check if PQC keys are password-encrypted.
 */
function arePqcKeysEncrypted() {
  const keysFile = pqcKeysFilePath();
  if (!fs.existsSync(keysFile)) return false;
  try {
    const data = readJson(keysFile, null);
    return !!(data && data._encrypted === true && data.crypto);
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
    if (!data._encrypted || !data.crypto) {
      return null;
    }

    const decryptedStr = decryptWithPassword(data, password);
    if (!decryptedStr) {
      return null;
    }

    const decryptedKeys = JSON.parse(decryptedStr);

    // Save decrypted version temporarily and keep backup to restore
    const backup = JSON.stringify(data);
    fs.writeFileSync(keysFile, JSON.stringify(decryptedKeys, null, 2), 'utf8');

    return () => {
      try {
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
  pqcKeysFilePath,
  arePqcKeysEncrypted,
  tempDecryptPqcKeys,
};

