const fs = require('fs');
const path = require('path');
const { randomBytes, scryptSync, createCipheriv, createDecipheriv } = require('crypto');
const { userDataPath, ensureDir } = require('./fs.cjs');

const SECRET_FILE = userDataPath('secret.bin');

function getAppSecret() {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE);
    }
  } catch {}
  const s = randomBytes(32);
  try {
    ensureDir(path.dirname(SECRET_FILE));
    fs.writeFileSync(SECRET_FILE, s);
  } catch {}
  return s;
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dklen: 32 };

function encryptMnemonicLocal(mnemonic) {
  const appSecret = getAppSecret();
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
  const appSecret = getAppSecret();
  const { N, r, p, dklen, salt } = keystore.crypto.kdfparams;
  const key = scryptSync(appSecret, Buffer.from(salt, 'base64'), dklen, { N, r, p });
  const iv = Buffer.from(keystore.crypto.iv, 'base64');
  const tag = Buffer.from(keystore.crypto.tag, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(keystore.crypto.ciphertext, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

module.exports = {
  encryptMnemonicLocal,
  decryptMnemonicLocal
};

