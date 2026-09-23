/**
 * Giving an account its Dilithium key, without asking the user to.
 *
 * Every Lumen transaction carries two signatures, and the chain refuses one
 * that is missing its post-quantum half. A wallet whose address has never been
 * linked therefore cannot send anything - which is what
 * "No PQC key linked to lmn1…. Import and link a Dilithium key first" means.
 *
 * The desktop never shows that message, because `signAndBroadcastWithPqcAutoLink`
 * does the work in the background: it checks the chain before signing, creates
 * and links a key if there is none, and only then sends what the user asked
 * for. This is that flow, ported.
 *
 * ONE ORDERING DECISION IS DELIBERATE, and copied for the same reason: the
 * "back up your key" notice fires the moment new key material exists on disk,
 * BEFORE the on-chain link is attempted. That link can fail for reasons that
 * have nothing to do with the key - an empty balance, an RPC hiccup - and the
 * file would still be sitting there, unbacked and unrecoverable if lost.
 * Waiting for confirmation would drop the warning exactly when it matters.
 */

import type { Keystore, PqcRecord } from '../../../src/types/platformBridge';
import { fromBase64, toBase64 } from './crypto';
import { notifyPqcLinked } from './profiles';
import { getSessionPassword } from './security';
import { readDoc, writeDoc } from './storage';

const PQC_KEYS_KEY = 'pqc_keys/keys.json';
const PQC_LINKS_KEY = 'pqc_keys/links.json';

/**
 * Two representations of one key, and the line between them.
 *
 * `keys.json` holds base64 strings - that is the format the desktop's SDK key
 * store writes, and the two have to stay readable by each other or a backup
 * exported on one stops importing on the other. Everything downstream of the
 * file wants raw bytes instead: `msgLinkAccountPqc` runs `pubKey` through
 * `normalizeBytes`, `computePowNonce` copies it into a digest buffer, and the
 * signer checks its exact byte length.
 *
 * Crossing that line without converting is what produced "invalid base64
 * string format": `String(uint8array)` is "162,7,219,…", which is neither hex
 * nor base64, so the message encoder refused it. The same mistake read back
 * would have handed the signer a 2604-character string where 1952 bytes were
 * expected, so no mobile transaction could have been signed either.
 */
const DILITHIUM3_PUBLIC_KEY_BYTES = 1952;
const DILITHIUM3_PRIVATE_KEY_BYTES = 4000;

/** Bytes from either shape, so a record written by any version still loads. */
function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return fromBase64(String(value ?? ''));
}

/**
 * Whether a stored record still decodes to a Dilithium key.
 *
 * A build between this file's first version and this fix wrote
 * `String(uint8array)` into `keys.json`. Reusing such a record would fail the
 * same way forever, so it is worth recognising rather than trusting what is on
 * disk.
 */
function isUsableRecord(rec: unknown): boolean {
  const record = rec as Record<string, unknown> | null;
  if (!record) return false;
  try {
    const pub = asBytes(record.publicKey ?? record.public_key);
    const priv = asBytes(record.privateKey ?? record.private_key);
    return (
      pub.length === DILITHIUM3_PUBLIC_KEY_BYTES && priv.length === DILITHIUM3_PRIVATE_KEY_BYTES
    );
  } catch {
    return false;
  }
}

/**
 * The key file, opened whether or not a password sealed it.
 *
 * Setting a password seals `keys.json` whole, so every reader has to know how
 * to open it. `password` comes back with the keys because a writer has to
 * seal the file again with the same one: writing it back in the clear would
 * quietly undo the protection the user asked for.
 *
 * `null` means sealed with no open session. That is not something to work
 * around - a key minted beside a sealed file would strand everything already
 * inside it.
 */
async function openKeyFile(): Promise<{
  keys: Record<string, any>;
  password: string | null;
} | null> {
  const raw = await readDoc<Record<string, any>>(PQC_KEYS_KEY);
  if (!raw) return { keys: {}, password: null };

  if ((raw as any).crypto) {
    const password = getSessionPassword();
    if (!password) return null;
    try {
      const { decryptWithPassword } = await import('./crypto');
      const plain = await decryptWithPassword(raw as unknown as Keystore, password);
      return { keys: JSON.parse(plain), password };
    } catch {
      return null;
    }
  }

  return { keys: raw, password: null };
}

/** Writes the key file back, sealed again if it was sealed. */
async function saveKeyFile(keys: Record<string, any>, password: string | null): Promise<void> {
  if (!password) {
    await writeDoc(PQC_KEYS_KEY, keys);
    return;
  }
  const { encryptWithPassword } = await import('./crypto');
  await writeDoc(PQC_KEYS_KEY, await encryptWithPassword(JSON.stringify(keys), password));
}

/**
 * The PQC key store the SDK expects: `getLink(address)` naming a key, and
 * `getKey(name)` returning it. Both read the same two documents profiles.ts
 * writes, so a key imported through a backup is the key that signs.
 */
export async function buildPqcStore() {
  const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};

  // A locked session has nothing to sign with, and saying so beats a confusing
  // failure deep inside the SDK.
  const file = await openKeyFile();
  if (!file) throw new Error('wallet_locked');
  const keys = file.keys;

  // Bytes, not the base64 the file holds: the signer measures `publicKey.length`
  // against 1952 and would reject a string of 2604 characters.
  const normalize = (rec: any) =>
    rec && {
      name: rec.name,
      scheme: rec.scheme ?? 'dilithium3',
      publicKey: asBytes(rec.publicKey ?? rec.public_key),
      privateKey: asBytes(rec.privateKey ?? rec.private_key),
      createdAt: new Date(rec.createdAt ?? rec.created_at ?? Date.now())
    };

  return {
    getLink: (address: string) => links[address] ?? null,
    getKey: (name: string) => normalize(keys[name]) ?? null
  };
}

/**
 * What the chain holds for an address: the record, and whether it is linked.
 *
 * TWO THINGS HERE WERE WRONG AND BOTH FAILED SILENTLY.
 *
 * The path is `/lumen/pqc/v1/accounts/…` - PLURAL. The singular spelling is a
 * registered route that answers `501 Not Implemented` to every address, so
 * reading it made every account, linked or not, look unlinked. Nothing threw.
 *
 * And the record is `pub_key_hash`, not `pub_key`: the chain stores a hash of
 * the key, never the key itself. Looking for a field that is never sent is the
 * same silent "no" a second time.
 *
 * "No record" is not a 404 either. The chain answers
 * `500 {"code":2,"message":"…not found: no pqc record for lmn1…"}`, so it is
 * recognised by the body - a bare 500 means the node is broken, and answering
 * "not linked" to that would be a lie.
 */
export async function readPqcAccount(address: string): Promise<{
  ok: boolean;
  linked: boolean;
  account: Record<string, unknown> | null;
  status?: number;
  error?: string;
}> {
  const { readState } = await import('./network');
  const res = await readState(`/lumen/pqc/v1/accounts/${encodeURIComponent(address)}`, {
    kind: 'rest',
    timeout: 10_000
  });

  if (!res.ok) {
    const body = res.json as any;
    const message = String(body?.message ?? res.text ?? '');
    const missing =
      res.status === 404 ||
      /no pqc record/i.test(message) ||
      (Number(body?.code) === 2 && /not found/i.test(message));
    if (missing) return { ok: true, linked: false, account: null };
    return { ok: false, linked: false, account: null, status: res.status, error: `http_${res.status}` };
  }

  const body = res.json as any;
  const account = (body?.account ?? body ?? null) as Record<string, unknown> | null;
  const hash =
    account?.pubKeyHash ?? account?.pub_key_hash ?? account?.pubKey ?? account?.pub_key ?? '';
  return { ok: true, linked: !!String(hash ?? ''), account };
}

/**
 * Whether the chain already knows a key for this address.
 *
 * A node that cannot be read answers "not linked", which sends the caller on
 * to attempt a link the chain will refuse if it was wrong - the desktop makes
 * the same choice. The opposite would leave a wallet unable to link whenever a
 * node is having a bad day.
 */
async function isLinkedOnChain(address: string): Promise<boolean> {
  try {
    return (await readPqcAccount(address)).linked;
  } catch {
    return false;
  }
}

/**
 * The local key for this address, created if there is none.
 *
 * `createdNew` is what drives the backup notice, so it reports whether key
 * material was minted here rather than merely found.
 */
async function ensureLocalKey(
  address: string,
  profileId: string
): Promise<{ record: PqcRecord; createdNew: boolean } | null> {
  const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};

  // Sealed and no open session: nothing can be read or written without
  // stranding what is already inside, so this stops here rather than minting a
  // second key beside the first.
  const file = await openKeyFile();
  if (!file) return null;
  const keys = file.keys;

  const normalize = (rec: any, fallbackName: string): PqcRecord | null =>
    rec
      ? {
          name: String(rec.name ?? fallbackName),
          scheme: String(rec.scheme ?? 'dilithium3'),
          publicKey: String(rec.publicKey ?? rec.public_key ?? ''),
          privateKey: String(rec.privateKey ?? rec.private_key ?? ''),
          createdAt: rec.createdAt ?? rec.created_at
        }
      : null;

  const existingName = links[address];
  const existing = existingName ? normalize(keys[existingName], existingName) : null;

  if (existing?.privateKey) {
    if (isUsableRecord(existing)) return { record: existing, createdNew: false };

    // The key on disk does not decode. If the chain is already committed to a
    // key for this address, minting another one would only add a mismatch on
    // top, and the backup is the sole way back - so say that, rather than
    // quietly making things worse.
    if (await isLinkedOnChain(address)) throw new Error('pqc_key_unreadable_import_backup');
    console.warn('[platform/mobile] PQC key on disk is unreadable, replacing it', existingName);
  }

  const mod: any = await import('@lumen-chain/sdk');
  const sdk = mod?.default ?? mod;
  const pair = await sdk.pqc.createKeyPair('dilithium3');

  // The SDK mints raw bytes; the file holds base64, exactly as the desktop's
  // key store writes it, so a backup stays importable on either side.
  const name = existingName || `profile:${profileId}`;
  const record: PqcRecord = {
    name,
    scheme: 'dilithium3',
    publicKey: toBase64(asBytes(pair.publicKey ?? pair.public_key)),
    privateKey: toBase64(asBytes(pair.privateKey ?? pair.private_key)),
    createdAt: new Date().toISOString()
  };

  keys[name] = record;
  links[address] = name;
  // Sealed again with the same password if it arrived sealed.
  await saveKeyFile(keys, file.password);
  await writeDoc(PQC_LINKS_KEY, links);

  return { record, createdNew: true };
}

/** The chain's proof-of-work difficulty, or zero. */
async function powBits(): Promise<number> {
  try {
    const { readState } = await import('./network');
    const res = await readState('/lumen/pqc/v1/params', { kind: 'rest', timeout: 10_000 });
    if (!res.ok) return 0;
    const params = (res.json as any)?.params ?? res.json ?? {};
    // `??`, never `||`: `pow_difficulty_bits` ships at 0 on purpose, and a
    // falsy-coalescing read would turn that deliberate zero into whatever the
    // fallback says and mine a proof nobody asked for.
    const raw = params.pow_difficulty_bits ?? params.powDifficultyBits ?? 0;
    const bits = Number(raw);
    return Number.isFinite(bits) && bits > 0 ? bits : 0;
  } catch {
    return 0;
  }
}

/**
 * Links the key on-chain. Returns whether a transaction was sent.
 */
async function linkOnChain(client: any, address: string, record: PqcRecord): Promise<boolean> {
  if (await isLinkedOnChain(address)) return false;

  const pqcModule = typeof client?.pqc === 'function' ? client.pqc() : null;
  if (!pqcModule?.msgLinkAccountPqc) throw new Error('pqc_module_unavailable');

  // Decoded once, for both uses below. `computePowNonce` copies this straight
  // into a digest buffer with `set()`, which accepts a string without
  // complaining and fills it with zeroes - a nonce mined against the wrong
  // digest, refused by the chain for a reason that names the proof.
  const publicKey = asBytes(record.publicKey);

  const bits = await powBits();
  let powNonce: Uint8Array = new Uint8Array([0]);
  if (bits > 0) {
    const mod: any = await import('@lumen-chain/sdk');
    const sdk = mod?.default ?? mod;
    // The address is part of the digest the chain checks, not just of the
    // message it signs: sha256(creator || "|" || pubKey || nonce). Mining
    // without it yields a nonce the chain refuses, and the refusal names the
    // proof rather than the address it is missing.
    powNonce = await sdk.pqc.computePowNonce(address, publicKey, bits);
  }

  const msg = pqcModule.msgLinkAccountPqc(address, {
    scheme: record.scheme,
    pubKey: publicKey,
    powNonce
  });

  const result = await client.signAndBroadcast(
    address,
    [msg],
    { amount: [], gas: '300000' },
    'pqc:link'
  );
  const code = Number(result?.code ?? 0);
  if (code !== 0) throw new Error(result?.rawLog || `pqc_link_rejected_${code}`);
  return true;
}

/** True when a failure looks like the chain complaining about the PQC half. */
export function isPqcError(message: string): boolean {
  return /pqc|dilithium|post-?quantum/i.test(message);
}

/**
 * Makes sure this address can sign, creating and linking a key if needed.
 *
 * Safe to call before every transaction: when the key exists and the chain
 * already knows it, this is two reads and nothing else.
 */
export async function ensurePqcLinked(
  client: any,
  profileId: string,
  address: string
): Promise<void> {
  const local = await ensureLocalKey(address, profileId);
  if (!local) return;

  // Before the link, deliberately - see the note at the top of this file.
  if (local.createdNew) notifyPqcLinked({ profileId, address });

  // Both, not just the cache. Clearing `pqcStore` alone sends the SDK back to
  // `pqcConfig.store` - the snapshot handed over at connect time, taken before
  // this key existed - so the signer would look straight past what was just
  // written and fail with the very error this function exists to prevent.
  if (local.createdNew) {
    const refreshed = await buildPqcStore();
    try {
      client.pqcStore = refreshed;
      if (client.pqcConfig) client.pqcConfig.store = refreshed;
    } catch {
      // A client that refuses the assignment rebuilds its store from config.
    }
  }

  const didLink = await linkOnChain(client, address, local.record);

  // An existing local key that was never on the chain is also worth a
  // reminder: it may never have been exported either.
  if (didLink && !local.createdNew) notifyPqcLinked({ profileId, address });
}
