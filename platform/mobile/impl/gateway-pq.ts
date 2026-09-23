/**
 * The authenticated envelope every wallet-scoped gateway route demands.
 *
 * `gateway-agent/node_api/src/middleware/authWallet.js` refuses anything
 * without `X-Lumen-PQ: v1`, so `/pin`, `/unpin`, `/wallet/*` are not plain
 * POSTs with a JSON body - the body IS the encryption. An earlier version of
 * the mobile gateway module invented endpoints like `/api/search` and sent
 * bare JSON; none of it could ever have worked.
 *
 * The wire format, ported from `sendGatewayAuthPq` in electron/ipc/gateway.cjs
 * and kept exact because the server verifies every part of it:
 *
 *   canonical  = "<METHOD>|<path>|<nonce>|<timestamp>|<sha256hex(payload)>"
 *   envelope   = { wallet, payload, signature, pubkey, timestamp, nonce }
 *   aesKey     = HKDF-SHA256(mlKem768.sharedSecret, "", "lumen-authwallet-v1", 32)
 *   body       = { kem_ct, ciphertext, iv, tag }   (all base64)
 *
 * The signature covers the canonical string rather than the payload alone,
 * which is what stops a captured request being replayed against another route
 * or another moment - and it is why method and path have to be spelled the way
 * the server sees them.
 */

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { fromBase64, randomBytes, toBase64 } from './crypto';
import { httpRequest } from './native-http';

const enc = new TextEncoder();

/** One gateway's Kyber key, cached: it is stable and the fetch is not free. */
const keyCache = new Map<string, { pubKey: Uint8Array; keyId: string; at: number }>();
const KEY_TTL_MS = 10 * 60 * 1000;

async function kyberKey(base: string) {
  const cached = keyCache.get(base);
  if (cached && Date.now() - cached.at < KEY_TTL_MS) return cached;

  const res = await httpRequest(`${base}/pq/pub`, { timeoutMs: 8_000 });
  if (!res.ok) throw new Error('kyber_pubkey_http_unavailable');

  let body: any;
  try {
    body = JSON.parse(res.text);
  } catch {
    throw new Error('kyber_pubkey_http_unavailable');
  }
  if (typeof body?.pub !== 'string' || !body.pub.trim()) {
    throw new Error('kyber_pubkey_http_unavailable');
  }

  const entry = {
    pubKey: fromBase64(body.pub.trim()),
    keyId: String(body.key_id ?? 'gw-2025-01').trim() || 'gw-2025-01',
    at: Date.now()
  };
  keyCache.set(base, entry);
  return entry;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Signs the canonical string with the profile's secp256k1 key.
 *
 * cosmjs rather than a lighter curve library: the desktop derives this key the
 * same way it derives the signing key, and a signature the gateway rejects
 * would be indistinguishable from a wrong password.
 */
async function signCanonical(mnemonic: string, canonical: string) {
  const { Secp256k1, Slip10, Slip10Curve, Bip39, EnglishMnemonic, sha256: cosmjsSha256 } =
    await import('@cosmjs/crypto');
  const { stringToPath } = await import('@cosmjs/crypto');

  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic.trim()));
  const { privkey } = Slip10.derivePath(
    Slip10Curve.Secp256k1,
    seed,
    stringToPath("m/44'/118'/0'/0/0")
  );

  const digest = cosmjsSha256(enc.encode(canonical));
  const signature = (await Secp256k1.createSignature(digest, privkey)).toFixedLength();
  const { pubkey } = await Secp256k1.makeKeypair(privkey);

  return {
    signatureB64: toBase64(signature),
    pubkeyB64: toBase64(Secp256k1.compressPubkey(pubkey))
  };
}

/** One authenticated gateway call. Throws only on a broken envelope. */
export async function gatewayAuthPq(params: {
  base: string;
  method: 'POST' | 'GET';
  path: string;
  wallet: string;
  mnemonic: string;
  payload: unknown;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const base = params.base.replace(/\/+$/, '');

  let key;
  try {
    key = await kyberKey(base);
  } catch (e) {
    return { ok: false, status: 0, error: String(e instanceof Error ? e.message : e) };
  }

  const payload = params.payload ?? null;
  const canonicalPayload = JSON.stringify(payload);
  const payloadHashHex = hex(sha256(enc.encode(canonicalPayload)));
  const nonce = hex(randomBytes(12));
  const ts = Date.now();
  const canonical = `${params.method}|${params.path}|${nonce}|${ts}|${payloadHashHex}`;

  const { signatureB64, pubkeyB64 } = await signCanonical(params.mnemonic, canonical);

  const envelope = enc.encode(
    JSON.stringify({
      wallet: params.wallet,
      payload,
      signature: signatureB64,
      pubkey: pubkeyB64,
      timestamp: ts,
      nonce
    })
  );

  const { cipherText, sharedSecret } = ml_kem768.encapsulate(key.pubKey);
  // Empty salt and this exact info string: both are part of what the server
  // derives with, so neither is a free choice.
  const aesKey = hkdf(sha256, sharedSecret, new Uint8Array(0), enc.encode('lumen-authwallet-v1'), 32);

  const iv = randomBytes(12);
  const cryptoKey = await crypto.subtle.importKey('raw', aesKey as BufferSource, 'AES-GCM', false, [
    'encrypt'
  ]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
      cryptoKey,
      envelope as BufferSource
    )
  );

  // WebCrypto appends the tag; the server expects it in its own field.
  const body = JSON.stringify({
    kem_ct: toBase64(cipherText),
    ciphertext: toBase64(sealed.slice(0, sealed.length - 16)),
    iv: toBase64(iv),
    tag: toBase64(sealed.slice(-16))
  });

  const res = await httpRequest(`${base}${params.path}`, {
    method: params.method,
    headers: {
      'Content-Type': 'application/json',
      'X-Lumen-PQ': 'v1',
      'X-Lumen-KEM': 'kyber768',
      'X-Lumen-KeyId': key.keyId
    },
    body,
    timeoutMs: params.timeoutMs ?? 20_000
  });

  let data: unknown;
  try {
    data = JSON.parse(res.text);
  } catch {
    data = res.text;
  }

  return res.ok
    ? { ok: true, status: res.status, data }
    : { ok: false, status: res.status, error: (data as any)?.error ?? `http_${res.status}`, data };
}
