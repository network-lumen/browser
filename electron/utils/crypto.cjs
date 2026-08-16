const fs = require('fs');
const path = require('path');
const { randomBytes, scryptSync, createCipheriv, createDecipheriv, createHash, timingSafeEqual } = require('crypto');
const { userDataPath, ensureDir , writeFileAtomic } = require('./fs.cjs');

function secretFilePath() { // Important: compute at call-time so it respects app.setPath('userData', ...) even if this module was imported before Electron finishes booting
  return userDataPath('secret.bin');
}

function readSecretFile(filePath) { // We expect a 32-byte random secret
  try {
    if (!filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return buf && buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

function writeSecretFile(filePath, secret) {
  try {
    ensureDir(path.dirname(filePath));
    writeFileAtomic(filePath, secret);
    return true;
  } catch {
    return false;
  }
}

let cachedSecret = null;

function getAppSecret() {
  if (cachedSecret) return cachedSecret;

  const file = secretFilePath();
  const existing = readSecretFile(file);
  if (existing) {
    cachedSecret = existing;
    return cachedSecret;
  }

  const created = randomBytes(32);
  writeSecretFile(file, created);
  cachedSecret = created;
  return cachedSecret;
}

// Lowercase hex by default; `bytes` gives the raw digest, which is what the
// signing paths feed to secp256k1. `length` and `upper` are hex-only.
function sha256(data, { bytes = false, length = 0, upper = false } = {}) {
  const digest = createHash('sha256').update(Buffer.from(data)).digest();
  if (bytes) return digest;
  const hex = digest.toString('hex');
  const out = length > 0 ? hex.slice(0, length) : hex;
  return upper ? out.toUpperCase() : out;
}

// The machine secret is 32 random bytes read from a file. It has full entropy
// already, so stretching it buys nothing - the cost here is inherited, not
// chosen, and it is kept only because existing keystores record it.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dklen: 32 };

/**
 * Work factor for a *human* password, which is the only secret here that a
 * dictionary can reach.
 *
 * This used to be N=2048 - eight times cheaper than the parameters used for the
 * random machine secret, which is precisely backwards: the cost was being spent
 * where it bought nothing and saved where it was the whole defence. N=65536 is
 * ~64 MB and a few hundred milliseconds, which is unnoticeable once per unlock
 * and expensive per guess.
 *
 * Nothing already on disk breaks. Every encrypted blob records the parameters
 * it was made with and is decrypted with those; the stored password hash does
 * too, and `verifyPassword` below honours it. Old material simply keeps its old
 * cost until the user next changes their password, which re-encrypts
 * everything through the transactional path in ipc/security.cjs.
 */
const SCRYPT_PARAMS_PASSWORD = { N: 65536, r: 8, p: 1, dklen: 32 };
/** What a stored hash with no recorded parameters was made with. */
const LEGACY_SCRYPT_PARAMS_PASSWORD = { N: 2048, r: 8, p: 1, dklen: 32 };
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

/**
 * Derive a 32-byte key from a password using scrypt.
 *
 * `params` is what makes an older secret still readable: pass the ones recorded
 * beside it, and omit them only when creating something new.
 */
function deriveKeyFromPassword(password, salt, params = SCRYPT_PARAMS_PASSWORD) {
  const passwordBuf = Buffer.from(String(password || ''), 'utf8');
  const { N, r, p, dklen } = { ...SCRYPT_PARAMS_PASSWORD, ...(params || {}) };
  return scryptSync(passwordBuf, salt, dklen || 32, { N, r, p, maxmem: SCRYPT_MAXMEM });
}

/**
 * Hash password for verification storage (not for encryption)
 * Returns { hash, salt } where hash can be stored safely
 */
function hashPassword(password) {
  const salt = randomBytes(32);
  const key = deriveKeyFromPassword(password, salt, SCRYPT_PARAMS_PASSWORD);
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
 * Verify a password against stored hash.
 *
 * Derives with the parameters recorded next to the hash, not with today's. That
 * distinction is what lets the work factor be raised at all: verifying with the
 * new N against a hash made with the old one fails for every existing user, and
 * they would be locked out of their own wallets by an upgrade.
 */
function verifyPassword(password, stored) {
  if (!stored || !stored.hash || !stored.salt) return false;
  try {
    const salt = Buffer.from(stored.salt, 'base64');
    const params =
      stored.params && Number.isFinite(Number(stored.params.N))
        ? stored.params
        : LEGACY_SCRYPT_PARAMS_PASSWORD;
    const key = deriveKeyFromPassword(password, salt, params);
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
  // The cost comes out of the file, so it is refused rather than attempted when
  // it is absurd: a corrupt or hostile keystore naming a huge N would otherwise
  // be handed straight to scrypt and take the app down with it.
  if (!Number.isInteger(N) || N < 1024 || N > 1_048_576) {
    throw new Error('unsupported_kdf_parameters');
  }
  const key = scryptSync(Buffer.from(String(password || ''), 'utf8'), saltBuf, dklen || 32, {
    N, r, p,
    maxmem: SCRYPT_MAXMEM
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
 * Decrypt mnemonic that was encrypted with password
 */
function decryptMnemonicWithPassword(keystore, password) {
  try {
    return decryptWithPassword(keystore, password);
  } catch (e) {
    try {
      const msg = String(e && e.message ? e.message : e);
      console.warn('[crypto] decryptMnemonicWithPassword failed:', msg);
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Check if a keystore is password-protected
 */
function isPasswordProtected(keystore) {
  return !!(keystore && keystore.passwordProtected === true && keystore.version >= 2);
}

function encryptMnemonicLocal(mnemonic) {
  const appSecret = getAppSecret();
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

  try {
    const key = scryptSync(getAppSecret(), Buffer.from(salt, 'base64'), dklen, {
      N, r, p,
      maxmem: 128 * 1024 * 1024 // 128MB to handle any stored N value
    });
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (e) {
    // Hide low-level crypto errors from UI; callers handle null as "failed to decrypt".
    try {
      console.warn('[crypto] decryptMnemonicLocal failed:', e && e.message ? e.message : e);
    } catch {}
    return null;
  }
}

module.exports = {
  sha256,
  encryptMnemonicLocal,
  decryptMnemonicLocal,
  hashPassword,
  verifyPassword,
  encryptWithPassword,
  decryptWithPassword,
  decryptMnemonicWithPassword,
  isPasswordProtected,
  deriveKeyFromPassword
};

