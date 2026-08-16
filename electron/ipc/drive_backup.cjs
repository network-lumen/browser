const { ipcMain } = require('electron');

const { encryptWithPassword, decryptWithPassword } = require('../utils/crypto.cjs');

const ENCRYPTED_ENVELOPE_TYPE = 'lumen.driveBackup.encryptedSnapshot';
const ENCRYPTED_ENVELOPE_VERSION = 2;
const MIN_PASSWORD_LEN = 8;

const SCRYPT_LIMITS = {
  minN: 1024,
  maxN: 131072,
  minR: 1,
  maxR: 32,
  minP: 1,
  maxP: 16,
  minDkLen: 16,
  maxDkLen: 64
};

function isPowerOfTwo(n) {
  return Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0;
}

function normalizePassword(input) {
  return String(input ?? '');
}

function validatePassword(password) {
  const p = normalizePassword(password);
  if (!p) return { ok: false, error: 'missing_password' };
  if (p.length < MIN_PASSWORD_LEN) return { ok: false, error: 'weak_password' };
  return { ok: true, password: p };
}

function normalizeEnvelope(input) {
  const env = input && typeof input === 'object' ? input : null;
  if (!env) return null;

  if (env.type !== ENCRYPTED_ENVELOPE_TYPE) return null;
  if (env.version !== ENCRYPTED_ENVELOPE_VERSION) return null;
  if (env.passwordProtected !== true) return null;

  const crypto = env.crypto && typeof env.crypto === 'object' ? env.crypto : null;
  if (!crypto) return null;

  if (String(crypto.cipher || '').trim() !== 'aes-256-gcm') return null;
  if (String(crypto.kdf || '').trim() !== 'scrypt') return null;

  const ciphertext = typeof crypto.ciphertext === 'string' ? crypto.ciphertext : '';
  const iv = typeof crypto.iv === 'string' ? crypto.iv : '';
  const tag = typeof crypto.tag === 'string' ? crypto.tag : '';

  const kdfparams = crypto.kdfparams && typeof crypto.kdfparams === 'object' ? crypto.kdfparams : null;
  if (!kdfparams) return null;

  const salt = typeof kdfparams.salt === 'string' ? kdfparams.salt : '';
  const N = Number(kdfparams.N);
  const r = Number(kdfparams.r);
  const p = Number(kdfparams.p);
  const dklen = Number(kdfparams.dklen);

  if (!ciphertext || !iv || !tag || !salt) return null;
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(dklen)) return null;

  const nInt = Math.floor(N);
  const rInt = Math.floor(r);
  const pInt = Math.floor(p);
  const dkInt = Math.floor(dklen);

  if (!isPowerOfTwo(nInt)) return null;
  if (nInt < SCRYPT_LIMITS.minN || nInt > SCRYPT_LIMITS.maxN) return null;
  if (rInt < SCRYPT_LIMITS.minR || rInt > SCRYPT_LIMITS.maxR) return null;
  if (pInt < SCRYPT_LIMITS.minP || pInt > SCRYPT_LIMITS.maxP) return null;
  if (dkInt < SCRYPT_LIMITS.minDkLen || dkInt > SCRYPT_LIMITS.maxDkLen) return null;

  const createdAtRaw = Number(env.createdAt);
  const createdAt = Number.isFinite(createdAtRaw) ? createdAtRaw : Date.now();

  return {
    type: ENCRYPTED_ENVELOPE_TYPE,
    version: ENCRYPTED_ENVELOPE_VERSION,
    passwordProtected: true,
    createdAt,
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext,
      iv,
      tag,
      kdf: 'scrypt',
      kdfparams: {
        N: nInt,
        r: rInt,
        p: pInt,
        dklen: dkInt,
        salt
      }
    }
  };
}

function registerDriveBackupIpc() {
  ipcMain.handle('driveBackup:encryptSnapshot', async (_evt, input) => {
    try {
      const snap = input?.snapshot;
      if (!snap || typeof snap !== 'object') return { ok: false, error: 'invalid_snapshot' };

      const passRes = validatePassword(input?.password);
      if (!passRes.ok) return passRes;

      const encrypted = encryptWithPassword(snap, passRes.password);
      encrypted.type = ENCRYPTED_ENVELOPE_TYPE;
      return { ok: true, encrypted };
    } catch (e) {
      return { ok: false, error: String(e?.message || e || 'encrypt_failed') };
    }
  });

  ipcMain.handle('driveBackup:decryptSnapshot', async (_evt, input) => {
    try {
      const passRes = validatePassword(input?.password);
      if (!passRes.ok) return passRes;

      const env = normalizeEnvelope(input?.encrypted);
      if (!env) return { ok: false, error: 'invalid_envelope' };

      const plaintext = decryptWithPassword(env, passRes.password);
      const snapshot = JSON.parse(plaintext);
      return { ok: true, snapshot };
    } catch {
      return { ok: false, error: 'decrypt_failed' };
    }
  });
}

module.exports = {
  registerDriveBackupIpc
};

