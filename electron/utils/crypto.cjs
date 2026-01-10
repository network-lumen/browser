const fs = require('fs');
const path = require('path');
const { randomBytes, scryptSync, createCipheriv, createDecipheriv } = require('crypto');
const { userDataPath, ensureDir } = require('./fs.cjs');

function secretFilePath() {
  // Important: compute at call-time so it respects app.setPath('userData', ...)
  // even if this module was imported before Electron finishes booting.
  return userDataPath('secret.bin');
}

function legacySecretFileCandidates() {
  const candidates = [];
  try {
    const { app } = require('electron');
    const base = app.getPath('appData');
    // Known legacy app names that previously affected the default userData path.
    for (const name of ['lumen', 'lumen-browser', 'Lumen Browser', 'Electron']) {
      candidates.push(path.join(base, name, 'secret.bin'));
    }
  } catch {}
  return candidates;
}

function readSecretFile(filePath) {
  try {
    if (!filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    // We expect a 32-byte random secret.
    return buf && buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

function writeSecretFile(filePath, secret) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, secret);
    return true;
  } catch {
    return false;
  }
}

let cachedSecrets = null;

function getSecretCandidates() {
  if (cachedSecrets) return cachedSecrets;

  const primaryFile = secretFilePath();
  const primarySecret = readSecretFile(primaryFile);

  const secrets = [];
  const seen = new Set();

  if (primarySecret) {
    secrets.push(primarySecret);
    seen.add(primarySecret.toString('hex'));
  }

  for (const file of legacySecretFileCandidates()) {
    const f = String(file || '').trim();
    if (!f) continue;
    if (f.toLowerCase() === String(primaryFile || '').toLowerCase()) continue;
    const s = readSecretFile(f);
    if (!s) continue;
    const hex = s.toString('hex');
    if (seen.has(hex)) continue;
    secrets.push(s);
    seen.add(hex);
  }

  // Migrate: if the primary secret doesn't exist yet but a legacy secret does,
  // write it to the primary location so future runs use one stable secret.
  if (!primarySecret && secrets.length) {
    try {
      writeSecretFile(primaryFile, secrets[0]);
    } catch {}
  }

  if (!secrets.length) {
    const s = randomBytes(32);
    writeSecretFile(primaryFile, s);
    secrets.push(s);
  }

  cachedSecrets = secrets;
  return secrets;
}

function getPrimarySecret() {
  return getSecretCandidates()[0];
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dklen: 32 };

function encryptMnemonicLocal(mnemonic) {
  const appSecret = getPrimarySecret();
  const salt = randomBytes(16);
  const key = scryptSync(appSecret, salt, SCRYPT_PARAMS.dklen, SCRYPT_PARAMS);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: 1,
    createdAt: Date.now(),
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      kdf: 'scrypt',
      kdfparams: {
        ...SCRYPT_PARAMS,
        salt: salt.toString('base64')
      }
    }
  };
}

function decryptMnemonicLocal(keystore) {
  let N, r, p, dklen, salt, iv, tag, ciphertext;
  try {
    if (!keystore || !keystore.crypto || !keystore.crypto.kdfparams) return null;
    ({ N, r, p, dklen, salt } = keystore.crypto.kdfparams);
    iv = Buffer.from(keystore.crypto.iv, 'base64');
    tag = Buffer.from(keystore.crypto.tag, 'base64');
    ciphertext = Buffer.from(keystore.crypto.ciphertext, 'base64');
  } catch {
    return null;
  }

  let lastErr = null;
  for (const appSecret of getSecretCandidates()) {
    try {
      const key = scryptSync(appSecret, Buffer.from(salt, 'base64'), dklen, { N, r, p });
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } catch (e) {
      lastErr = e;
    }
  }

  // Hide low-level crypto errors from UI; callers handle null as "failed to decrypt".
  if (lastErr) {
    try {
      console.warn('[crypto] decryptMnemonicLocal failed with all secrets:', lastErr.message || lastErr);
    } catch {}
  }
  return null;
}

module.exports = {
  encryptMnemonicLocal,
  decryptMnemonicLocal
};

