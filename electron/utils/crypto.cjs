const fs = require('fs');
const path = require('path');
const { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash, timingSafeEqual } = require('crypto');
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
// Lower params for password-based encryption to avoid memory issues
// N=2048, r=8 is still secure and uses only ~2MB memory
const SCRYPT_PARAMS_PASSWORD = { N: 2048, r: 8, p: 1, dklen: 32 };

/**
 * Derive a 32-byte key from a password using scrypt
 */
function deriveKeyFromPassword(password, salt) {
  const passwordBuf = Buffer.from(String(password || ''), 'utf8');
  // Explicitly set maxmem to 64MB to avoid memory limit errors
  return scryptSync(passwordBuf, salt, SCRYPT_PARAMS_PASSWORD.dklen, {
    N: SCRYPT_PARAMS_PASSWORD.N,
    r: SCRYPT_PARAMS_PASSWORD.r,
    p: SCRYPT_PARAMS_PASSWORD.p,
    maxmem: 64 * 1024 * 1024
  });
}

/**
 * Hash password for verification storage (not for encryption)
 * Returns { hash, salt } where hash can be stored safely
 */
function hashPassword(password) {
  const salt = randomBytes(32);
  const key = deriveKeyFromPassword(password, salt);
  // Hash the derived key so we don't store the actual key
  const hash = createHash('sha256').update(key).digest();
  return {
    hash: hash.toString('base64'),
    salt: salt.toString('base64'),
    algorithm: 'scrypt-sha256',
    params: SCRYPT_PARAMS_PASSWORD
  };
}

/**
 * Verify a password against stored hash
 */
function verifyPassword(password, stored) {
  if (!stored || !stored.hash || !stored.salt) return false;
  try {
    const salt = Buffer.from(stored.salt, 'base64');
    const key = deriveKeyFromPassword(password, salt);
    const hash = createHash('sha256').update(key).digest();
    const storedHash = Buffer.from(stored.hash, 'base64');
    if (hash.length !== storedHash.length) return false;
    return timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Encrypt data with a password-derived key
 */
function encryptWithPassword(plaintext, password) {
  const salt = randomBytes(16);
  const key = deriveKeyFromPassword(password, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  const ciphertext = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version: 2,
    passwordProtected: true,
    createdAt: Date.now(),
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      kdf: 'scrypt',
      kdfparams: {
        ...SCRYPT_PARAMS_PASSWORD,
        salt: salt.toString('base64')
      }
    }
  };
}

/**
 * Decrypt data that was encrypted with a password
 */
function decryptWithPassword(encrypted, password) {
  if (!encrypted || !encrypted.crypto) {
    throw new Error('Invalid encrypted data');
  }
  const { salt, N, r, p, dklen } = encrypted.crypto.kdfparams;
  const saltBuf = Buffer.from(salt, 'base64');
  // Set maxmem high enough to handle any stored N value
  const key = scryptSync(Buffer.from(String(password || ''), 'utf8'), saltBuf, dklen || 32, { 
    N, r, p, 
    maxmem: 128 * 1024 * 1024 // 128MB to handle large N values
  });
  const iv = Buffer.from(encrypted.crypto.iv, 'base64');
  const tag = Buffer.from(encrypted.crypto.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.crypto.ciphertext, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

/**
 * Encrypt mnemonic - uses password if provided, otherwise app secret
 */
function encryptMnemonicWithPassword(mnemonic, password) {
  return encryptWithPassword(mnemonic, password);
}

/**
 * Decrypt mnemonic that was encrypted with password
 */
function decryptMnemonicWithPassword(keystore, password) {
  return decryptWithPassword(keystore, password);
}

/**
 * Check if a keystore is password-protected
 */
function isPasswordProtected(keystore) {
  return !!(keystore && keystore.passwordProtected === true && keystore.version >= 2);
}

function encryptMnemonicLocal(mnemonic) {
  const appSecret = getPrimarySecret();
  const salt = randomBytes(16);
  const key = scryptSync(appSecret, salt, SCRYPT_PARAMS.dklen, {
    ...SCRYPT_PARAMS,
    maxmem: 128 * 1024 * 1024
  });
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
      const key = scryptSync(appSecret, Buffer.from(salt, 'base64'), dklen, { 
        N, r, p,
        maxmem: 128 * 1024 * 1024 // 128MB to handle any stored N value
      });
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
  decryptMnemonicLocal,
  hashPassword,
  verifyPassword,
  encryptWithPassword,
  decryptWithPassword,
  encryptMnemonicWithPassword,
  decryptMnemonicWithPassword,
  isPasswordProtected,
  deriveKeyFromPassword
};

