/**
 * The mobile port of `electron/utils/crypto.cjs`.
 *
 * Every format here is byte-for-byte the desktop's: same scrypt parameters,
 * same AES-256-GCM, same base64 fields in the same JSON shape. That is not
 * tidiness - a wallet whose backup its own desktop build cannot read is worse
 * than no backup, so the wire format is treated as a contract and only the
 * primitives were swapped underneath it:
 *
 *   node:crypto scryptSync  ->  @noble/hashes scryptAsync
 *   node:crypto aes-256-gcm ->  WebCrypto (crypto.subtle)
 *
 * `scryptAsync` rather than the sync one because N=65536 is ~200ms of solid
 * arithmetic on a laptop and several times that on a phone; the async version
 * yields between blocks so the unlock screen can still paint. WebCrypto needs
 * a secure context, which Capacitor gives us by serving the app over https.
 */

import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { Keystore, PasswordHash, ScryptParams } from '../../../src/types/platformBridge';
import { APP_SECRET_KEY, readDoc, writeDoc } from './storage';

/**
 * Inherited, not chosen: the device secret is already 32 random bytes, so
 * stretching it buys nothing. Kept because existing keystores record it.
 */
const SCRYPT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1, dklen: 32 };

/** The work factor for a human password - the only secret a dictionary reaches. */
const SCRYPT_PARAMS_PASSWORD: ScryptParams = { N: 65536, r: 8, p: 1, dklen: 32 };

/** What a stored hash with no recorded parameters was made with. */
const LEGACY_SCRYPT_PARAMS_PASSWORD: ScryptParams = { N: 2048, r: 8, p: 1, dklen: 32 };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(value: string): Uint8Array {
  const s = atob(value);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(
  secret: Uint8Array,
  salt: Uint8Array,
  params: ScryptParams
): Promise<Uint8Array> {
  const { N, r, p, dklen } = params;
  // A corrupt or hostile keystore naming a huge N would otherwise be handed
  // straight to scrypt and take the app down with it.
  if (!Number.isInteger(N) || N < 1024 || N > 1048576) {
    throw new Error('unsupported_kdf_parameters');
  }
  return scryptAsync(secret, salt, { N, r, p, dkLen: dklen || 32 });
}

const deriveFromPassword = (password: string, salt: Uint8Array, params: ScryptParams) =>
  derive(enc.encode(String(password ?? '')), salt, params);

/**
 * The device secret that protects a password-less wallet.
 *
 * Same role as the desktop's `secret.bin`, and the same weakness: anything
 * that can read the app's storage can decrypt a wallet with no password set.
 * See the note in storage.ts - this is the value that belongs in the Android
 * Keystore, and it is isolated here so that move touches one function.
 */
let cachedSecret: Uint8Array | null = null;

/** Drops the cached device secret. Counterpart of resetSettingsCache(). */
export function resetAppSecretCache(): void {
  cachedSecret = null;
}

async function getAppSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  const existing = await readDoc<string>(APP_SECRET_KEY);
  if (existing) {
    const bytes = fromBase64(existing);
    if (bytes.length === 32) {
      cachedSecret = bytes;
      return cachedSecret;
    }
  }

  const created = randomBytes(32);
  await writeDoc(APP_SECRET_KEY, toBase64(created));
  cachedSecret = created;
  return cachedSecret;
}

async function aesGcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: string
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
    'encrypt'
  ]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
      cryptoKey,
      enc.encode(plaintext) as BufferSource
    )
  );
  // WebCrypto appends the 16-byte tag; node:crypto keeps it in its own field,
  // and the stored format follows node. Splitting it here is what keeps the
  // two readable by each other.
  return { ciphertext: sealed.slice(0, sealed.length - 16), tag: sealed.slice(-16) };
}

async function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
    'decrypt'
  ]);
  const sealed = new Uint8Array(ciphertext.length + tag.length);
  sealed.set(ciphertext, 0);
  sealed.set(tag, ciphertext.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
    cryptoKey,
    sealed as BufferSource
  );
  return dec.decode(plain);
}

function buildKeystore(
  version: number,
  passwordProtected: boolean,
  params: ScryptParams,
  salt: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array
): Keystore {
  const out: Keystore = {
    version,
    createdAt: Date.now(),
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: toBase64(ciphertext),
      iv: toBase64(iv),
      tag: toBase64(tag),
      kdf: 'scrypt',
      kdfparams: { ...params, salt: toBase64(salt) }
    }
  };
  if (passwordProtected) out.passwordProtected = true;
  return out;
}

/** Hash a password for storage. Never a key - only something to compare against. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(32);
  const key = await deriveFromPassword(password, salt, SCRYPT_PARAMS_PASSWORD);
  return {
    hash: toBase64(sha256(key)),
    salt: toBase64(salt),
    algorithm: 'scrypt-sha256',
    params: SCRYPT_PARAMS_PASSWORD
  };
}

/**
 * Verify a password against a stored hash.
 *
 * Derives with the parameters recorded next to the hash, not with today's.
 * That distinction is what lets the work factor be raised at all: verifying
 * with a new N against a hash made with the old one fails for every existing
 * user, and they would be locked out of their own wallets by an upgrade.
 */
export async function verifyPassword(
  password: string,
  stored: PasswordHash | null | undefined
): Promise<boolean> {
  if (!stored?.hash || !stored?.salt) return false;
  try {
    const params =
      stored.params && Number.isFinite(Number(stored.params.N))
        ? stored.params
        : LEGACY_SCRYPT_PARAMS_PASSWORD;
    const key = await deriveFromPassword(password, fromBase64(stored.salt), params);
    const actual = sha256(key);
    const expected = fromBase64(stored.hash);
    if (actual.length !== expected.length) return false;
    // Constant-time: returning early on the first differing byte leaks how much
    // of the hash a guess matched.
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

/** Encrypt with a password-derived key (`version: 2`, `passwordProtected`). */
export async function encryptWithPassword(plaintext: string, password: string): Promise<Keystore> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveFromPassword(password, salt, SCRYPT_PARAMS_PASSWORD);
  const { ciphertext, tag } = await aesGcmEncrypt(key, iv, plaintext);
  return buildKeystore(2, true, SCRYPT_PARAMS_PASSWORD, salt, iv, ciphertext, tag);
}

/** Decrypt what `encryptWithPassword` produced, here or on the desktop. */
export async function decryptWithPassword(encrypted: Keystore, password: string): Promise<string> {
  if (!encrypted?.crypto?.kdfparams) throw new Error('Invalid encrypted data');
  const { salt, ...params } = encrypted.crypto.kdfparams;
  const key = await deriveFromPassword(password, fromBase64(salt), params as ScryptParams);
  return aesGcmDecrypt(
    key,
    fromBase64(encrypted.crypto.iv),
    fromBase64(encrypted.crypto.ciphertext),
    fromBase64(encrypted.crypto.tag)
  );
}

/** True when a keystore needs the user's password rather than the device secret. */
export function isPasswordProtected(keystore: Keystore | null | undefined): boolean {
  return !!(keystore && keystore.passwordProtected === true && keystore.version >= 2);
}

/** Encrypt under the device secret - the no-password-set path (`version: 1`). */
export async function encryptMnemonicLocal(mnemonic: string): Promise<Keystore> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await derive(await getAppSecret(), salt, SCRYPT_PARAMS);
  const { ciphertext, tag } = await aesGcmEncrypt(key, iv, mnemonic);
  return buildKeystore(1, false, SCRYPT_PARAMS, salt, iv, ciphertext, tag);
}

/** Counterpart of `encryptMnemonicLocal`. `null` on any failure, never a throw. */
export async function decryptMnemonicLocal(keystore: Keystore): Promise<string | null> {
  try {
    const { salt, ...params } = keystore.crypto.kdfparams;
    const key = await derive(await getAppSecret(), fromBase64(salt), params as ScryptParams);
    return await aesGcmDecrypt(
      key,
      fromBase64(keystore.crypto.iv),
      fromBase64(keystore.crypto.ciphertext),
      fromBase64(keystore.crypto.tag)
    );
  } catch (e) {
    // Callers handle null as "failed to decrypt"; a low-level crypto error is
    // not something the UI can act on.
    console.warn('[platform/mobile] decryptMnemonicLocal failed:', e);
    return null;
  }
}

/** Reads a keystore whichever way it was sealed. `null` when the password is wrong. */
export async function decryptKeystore(
  keystore: Keystore,
  password: string | null
): Promise<string | null> {
  if (!isPasswordProtected(keystore)) return decryptMnemonicLocal(keystore);
  if (!password) return null;
  try {
    return await decryptWithPassword(keystore, password);
  } catch {
    return null;
  }
}
