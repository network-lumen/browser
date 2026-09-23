/**
 * The mobile port of `electron/ipc/profiles.cjs`.
 *
 * Profiles, their keystores and the PQC keys linked to them. The documents
 * keep the desktop's names and shapes (see storage.ts), so a backup written by
 * the desktop app imports here and vice versa - that compatibility is the
 * reason this is a port rather than a rewrite.
 *
 * Three things genuinely differ, all of them because a phone is not a laptop:
 *
 *  - there is no file path, so exporting a backup hands the WebView a Blob and
 *    lets the download land in the user's Downloads folder, and importing one
 *    goes through a file input rather than a native dialog;
 *  - `updateAvatar` takes a data URL rather than a path to read from disk;
 *  - `pickManualProfileSource` / `pickManualPqcSource` stay unsupported; they
 *    exist to drive a native picker that returns a path, which is not a thing
 *    that can be honoured here.
 */

import type {
  CreateWalletFn,
  Keystore,
  ProfilesFile
} from '../../../src/types/platformBridge';
import type { Profile } from '../../../src/types/profile';
import {
  decryptKeystore,
  decryptMnemonicLocal,
  decryptWithPassword,
  encryptMnemonicLocal,
  encryptWithPassword,
  isPasswordProtected
} from './crypto';
import { pickTextFile, saveAndShare } from './files';
import {
  PROFILES_KEY,
  keystoreKey,
  profileJsonKey,
  profilePrefix,
  readDoc,
  removeByPrefix,
  removeDoc,
  writeDoc
} from './storage';

const PQC_KEYS_KEY = 'pqc_keys/keys.json';
const PQC_LINKS_KEY = 'pqc_keys/links.json';

const pqcLinkedListeners = new Set<(payload: unknown) => void>();

/**
 * Tells the app a Dilithium key now exists locally, so it can offer a backup.
 *
 * Fired the moment new key material lands, not after the on-chain link
 * confirms: losing that file unbacked is unrecoverable, and a link that is
 * slow or fails for an unrelated reason must not swallow the warning.
 */
export function notifyPqcLinked(payload: { profileId: string; address: string }): void {
  for (const fn of pqcLinkedListeners) {
    try {
      fn(payload);
    } catch {
      // One bad subscriber must not silence the rest.
    }
  }
}

// ---------------------------------------------------------------------------
// The profiles document
// ---------------------------------------------------------------------------

async function loadProfilesFile(): Promise<ProfilesFile> {
  const data = await readDoc<ProfilesFile>(PROFILES_KEY);
  const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
  return { profiles, activeId: typeof data?.activeId === 'string' ? data.activeId : '' };
}

async function saveProfilesFile(data: ProfilesFile): Promise<void> {
  await writeDoc(PROFILES_KEY, data);
}

function makeProfileId(name: string): string {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `acc_${base}_${suffix}` : `acc_${suffix}`;
}

function hashHue(input: string): number {
  let h = 0;
  const s = String(input || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const colorIndexForName = (name: string) => hashHue(name || '') % 12;

const addressOf = (p: Profile | null | undefined) =>
  String(p?.walletAddress || p?.address || '').trim();

async function hasKeystore(id: string): Promise<boolean> {
  return (await readDoc<Keystore>(keystoreKey(id))) !== null;
}

// ---------------------------------------------------------------------------
// Wallet creation
// ---------------------------------------------------------------------------

let createWalletFn: CreateWalletFn | null = null;
let createWalletLoaded = false;

/**
 * The SDK is imported lazily, exactly as the desktop does it: it pulls in the
 * Dilithium WASM, and paying that on startup would delay first paint for every
 * screen that never creates a wallet.
 */
async function getCreateWallet(): Promise<CreateWalletFn | null> {
  if (createWalletLoaded) return createWalletFn;
  createWalletLoaded = true;
  try {
    const mod: any = await import('@lumen-chain/sdk');
    const sdk = mod?.default ?? mod;
    if (typeof sdk?.utils?.createWallet === 'function') {
      createWalletFn = sdk.utils.createWallet.bind(sdk.utils);
    } else if (typeof sdk?.createWallet === 'function') {
      createWalletFn = sdk.createWallet.bind(sdk);
    } else {
      createWalletFn = null;
    }
  } catch (e) {
    console.warn('[platform/mobile] failed to load @lumen-chain/sdk', e);
    createWalletFn = null;
  }
  return createWalletFn;
}

async function ensureWalletForProfile(
  profile: Profile
): Promise<{ ok: boolean; created?: boolean; address?: string; error?: string }> {
  const id = String(profile.id || '').trim();
  if (!id) return { ok: false, error: 'missing_profile_id' };

  // If a keystore already exists, trust it and return the stored address.
  if ((await hasKeystore(id)) && profile.walletAddress) {
    return { ok: true, created: false, address: profile.walletAddress };
  }

  const createWallet = await getCreateWallet();
  if (!createWallet) return { ok: false, error: 'sdk_unavailable' };

  try {
    const w = await createWallet();
    if (!w?.mnemonic || !w?.address) return { ok: false, error: 'wallet_creation_failed' };

    await writeDoc(keystoreKey(id), await encryptMnemonicLocal(w.mnemonic));
    await writeDoc(profileJsonKey(id), {
      id: profile.id,
      name: profile.name,
      address: w.address,
      createdAt: Date.now(),
      ...(profile.avatarDataUrl ? { avatarDataUrl: profile.avatarDataUrl } : {})
    });

    return { ok: true, created: true, address: w.address };
  } catch (e) {
    console.warn('[platform/mobile] ensureWalletForProfile failed', e);
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}

async function isWalletFullyCreated(
  profileId: string,
  profile: Profile | null = null
): Promise<{ ok: boolean; error?: string; details?: unknown; message?: string }> {
  try {
    let target = profile;
    if (!target) {
      const { profiles } = await loadProfilesFile();
      target = profiles.find((p) => p.id === profileId) ?? null;
      if (!target) return { ok: false, error: 'profile_not_found' };
    }

    if (target.role === 'guest') return { ok: false, error: 'guest_profile_no_wallet' };

    const walletAddress = addressOf(target);
    if (!walletAddress) return { ok: false, error: 'wallet_address_missing' };

    const ks = await readDoc<Keystore>(keystoreKey(profileId));
    if (!ks) return { ok: false, error: 'keystore_missing' };
    if (!ks.crypto) return { ok: false, error: 'keystore_invalid' };

    return { ok: true, details: { hasAddress: true, hasKeystore: true, address: walletAddress } };
  } catch (e) {
    return {
      ok: false,
      error: 'validation_failed',
      message: e instanceof Error ? e.message : String(e)
    };
  }
}

// ---------------------------------------------------------------------------
// Re-encryption, used by security.ts when a password is set, changed or removed
//
// Every one of these builds the complete new set in memory and only writes once
// it is whole. A partial write here is the one failure with no way back: a
// keystore sealed with a password the app has not stored yet is unopenable.
// ---------------------------------------------------------------------------

async function allKeystores(): Promise<{ id: string; keystore: Keystore }[]> {
  const { profiles } = await loadProfilesFile();
  const out: { id: string; keystore: Keystore }[] = [];
  for (const p of profiles) {
    const keystore = await readDoc<Keystore>(keystoreKey(p.id));
    if (keystore) out.push({ id: p.id, keystore });
  }
  return out;
}

async function reseal(
  read: (ks: Keystore) => Promise<string | null>,
  write: (mnemonic: string) => Promise<Keystore>
): Promise<{ ok: boolean; error?: string; profileId?: string }> {
  const entries = await allKeystores();
  const staged: { id: string; keystore: Keystore }[] = [];

  for (const { id, keystore } of entries) {
    const mnemonic = await read(keystore);
    if (!mnemonic) return { ok: false, error: 'decrypt_failed', profileId: id };
    staged.push({ id, keystore: await write(mnemonic) });
  }

  for (const { id, keystore } of staged) await writeDoc(keystoreKey(id), keystore);
  return { ok: true };
}

/** No password until now: move every keystore from the device secret to one. */
export const reEncryptAllKeystores = (password: string) =>
  reseal(
    (ks) => (isPasswordProtected(ks) ? decryptWithPassword(ks, password) : decryptMnemonicLocal(ks)),
    (mnemonic) => encryptWithPassword(mnemonic, password)
  );

/** Password removed: move every keystore back under the device secret. */
export const reEncryptToDeviceSecret = (password: string) =>
  reseal((ks) => decryptKeystore(ks, password), encryptMnemonicLocal);

/** Password changed: from the old one to the new one. */
export const changeKeystorePassword = (currentPassword: string, nextPassword: string) =>
  reseal(
    (ks) => decryptKeystore(ks, currentPassword),
    (mnemonic) => encryptWithPassword(mnemonic, nextPassword)
  );

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

async function buildProfileBackupObject(
  p: Profile,
  decryptPassword: string | null
): Promise<Record<string, unknown>> {
  let mnemonicPlain = '';
  try {
    const ks = await readDoc<Keystore>(keystoreKey(p.id));
    if (ks?.crypto) mnemonicPlain = (await decryptKeystore(ks, decryptPassword)) ?? '';
  } catch (e) {
    console.warn('[platform/mobile] backup: failed to decrypt mnemonic', e);
  }

  let pqcKey: Record<string, unknown> | null = null;
  try {
    const addr = addressOf(p);
    const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};
    const keys = (await readPqcKeys(decryptPassword)) ?? {};
    const keyName = addr ? links[addr] : '';
    const rec = keyName ? (keys[keyName] as Record<string, unknown> | undefined) : undefined;
    if (rec) {
      pqcKey = {
        name: rec.name ?? keyName,
        scheme: rec.scheme ?? 'dilithium3',
        publicKey: rec.publicKey ?? rec.public_key,
        privateKey: rec.privateKey ?? rec.private_key,
        createdAt: rec.createdAt ?? rec.created_at ?? null
      };
    }
  } catch (e) {
    console.warn('[platform/mobile] backup: failed to read PQC key', e);
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    profile: { ...p, walletAddress: addressOf(p) || null },
    mnemonic: mnemonicPlain,
    pqcKey
  };
}

async function readPqcKeys(password: string | null): Promise<Record<string, unknown> | null> {
  const raw = await readDoc<Record<string, unknown>>(PQC_KEYS_KEY);
  if (!raw) return {};
  // The whole key file is itself password-sealed once a password is set.
  if ((raw as unknown as Keystore).crypto && isPasswordProtected(raw as unknown as Keystore)) {
    if (!password) return null;
    try {
      return JSON.parse(await decryptWithPassword(raw as unknown as Keystore, password));
    } catch {
      return null;
    }
  }
  return raw;
}


async function importOneBackupObject(
  imported: Record<string, any>,
  profiles: Profile[]
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const source = imported?.profile ?? imported;
  const name = String(source?.name ?? '').trim() || 'Imported';
  const mnemonic = String(imported?.mnemonic ?? '').trim();
  if (!mnemonic) return { ok: false, error: 'missing_mnemonic' };

  const id = makeProfileId(name);
  const address = String(source?.walletAddress ?? source?.address ?? '').trim();

  await writeDoc(keystoreKey(id), await encryptMnemonicLocal(mnemonic));
  await writeDoc(profileJsonKey(id), { id, name, address, createdAt: Date.now() });

  const pqcKey = imported?.pqcKey;
  if (pqcKey?.privateKey && address) {
    const keys = (await readPqcKeys(null)) ?? {};
    const keyName = String(pqcKey.name ?? `profile:${id}`);
    keys[keyName] = pqcKey;
    await writeDoc(PQC_KEYS_KEY, keys);
    const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};
    links[address] = keyName;
    await writeDoc(PQC_LINKS_KEY, links);
  }

  profiles.push({
    id,
    name,
    colorIndex: colorIndexForName(name),
    role: 'user',
    walletAddress: address || undefined,
    ...(source?.avatarDataUrl ? { avatarDataUrl: String(source.avatarDataUrl) } : {})
  });

  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// The bridge members
// ---------------------------------------------------------------------------

async function updateActiveProfile(
  mutate: (p: Profile) => void
): Promise<{ ok: boolean; error?: string }> {
  const { profiles, activeId } = await loadProfilesFile();
  const index = profiles.findIndex((p) => p.id === activeId);
  if (index === -1) return { ok: false, error: 'no_active_profile' };
  mutate(profiles[index]);
  await saveProfilesFile({ profiles, activeId });
  return { ok: true };
}

export const PROFILE_MEMBERS = {
  'profiles.list': async () => {
    const { profiles, activeId } = await loadProfilesFile();
    const updated = profiles.slice();
    let mutated = false;

    // Backfill wallets for user profiles with no address and no keystore yet.
    for (let i = 0; i < updated.length; i++) {
      const p = updated[i];
      if (!p || p.role === 'guest') continue;
      if (!addressOf(p) && !(await hasKeystore(p.id))) {
        const ensured = await ensureWalletForProfile(p);
        if (ensured.ok && ensured.address) {
          updated[i] = { ...p, walletAddress: ensured.address };
          mutated = true;
        }
      }
    }

    const normalized = updated
      .map((p) => ({ ...p, walletAddress: addressOf(p) || undefined, favourites: p.favourites ?? {} }))
      // Guest mode is no longer a supported bootstrap state.
      .filter((p) => p.role !== 'guest');

    let nextActive = activeId;
    if (!normalized.find((p) => p.id === activeId)) nextActive = normalized[0]?.id ?? '';

    if (mutated || normalized.length !== profiles.length || nextActive !== activeId) {
      await saveProfilesFile({ profiles: normalized, activeId: nextActive });
    }

    return { profiles: normalized, activeId: nextActive };
  },

  'profiles.getActive': async () => {
    const { profiles, activeId } = await loadProfilesFile();
    const users = profiles.filter((p) => p.role !== 'guest');
    return users.find((p) => p.id === activeId) ?? users[0] ?? null;
  },

  'profiles.select': async (id: string) => {
    const { profiles } = await loadProfilesFile();
    const target = String(id || '').trim();
    if (!profiles.find((p) => p.id === target)) return '';
    await saveProfilesFile({ profiles, activeId: target });
    return target;
  },

  'profiles.create': async (name: string) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;

    const { profiles } = await loadProfilesFile();
    const id = makeProfileId(trimmed);
    const base: Profile = {
      id,
      name: trimmed,
      colorIndex: colorIndexForName(trimmed),
      role: 'user'
    };

    const ensured = await ensureWalletForProfile(base);
    const profile: Profile = { ...base, walletAddress: ensured.address ?? undefined };

    await saveProfilesFile({
      profiles: [...profiles.filter((p) => p.role !== 'guest'), profile],
      activeId: id
    });
    return profile;
  },

  'profiles.updateName': async (id: string, name: string) => {
    const profileId = String(id || '').trim();
    const nextName = String(name || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };
    if (!nextName) return { ok: false, error: 'missing_profile_name' };

    const { profiles, activeId } = await loadProfilesFile();
    const index = profiles.findIndex((p) => p.id === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const updated = { ...profiles[index], name: nextName, colorIndex: colorIndexForName(nextName) };
    const next = profiles.slice();
    next[index] = updated;
    await saveProfilesFile({ profiles: next, activeId });
    return { ok: true, profile: updated };
  },

  /**
   * Takes a data URL rather than the desktop's path to a file on disk - there
   * is no such path here, and the picker that would produce one lives in the
   * renderer on this target.
   */
  'profiles.updateAvatar': async (id: string, dataUrl: string) => {
    const profileId = String(id || '').trim();
    if (!profileId) return { ok: false, error: 'missing_profile_id' };
    const value = String(dataUrl || '').trim();
    if (!value.startsWith('data:image/')) return { ok: false, error: 'invalid_avatar_source' };

    const { profiles, activeId } = await loadProfilesFile();
    const index = profiles.findIndex((p) => p.id === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const updated = { ...profiles[index], avatarDataUrl: value };
    const next = profiles.slice();
    next[index] = updated;
    await saveProfilesFile({ profiles: next, activeId });
    return { ok: true, profile: updated };
  },

  'profiles.clearAvatar': async (id: string) => {
    const profileId = String(id || '').trim();
    const { profiles, activeId } = await loadProfilesFile();
    const index = profiles.findIndex((p) => p.id === profileId);
    if (index === -1) return { ok: false, error: 'profile_not_found' };

    const updated = { ...profiles[index] };
    delete updated.avatarDataUrl;
    const next = profiles.slice();
    next[index] = updated;
    await saveProfilesFile({ profiles: next, activeId });
    return { ok: true, profile: updated };
  },

  'profiles.export': async (id: string) => {
    const { profiles } = await loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    return p ? JSON.stringify(p, null, 2) : null;
  },

  'profiles.checkExportRequiresPassword': async (id: string) => {
    const ks = await readDoc<Keystore>(keystoreKey(String(id || '').trim()));
    if (!ks) return { ok: false, error: 'keystore_missing' };
    return { ok: true, requiresPassword: isPasswordProtected(ks) };
  },

  'profiles.exportBackup': async (id: string, password?: string) => {
    const { profiles } = await loadProfilesFile();
    const p = profiles.find((x) => x.id === id);
    if (!p) return { ok: false, error: 'profile_not_found' };

    const backup = await buildProfileBackupObject(p, password ?? null);
    if (!backup.mnemonic) return { ok: false, error: 'password_required' };

    const filename = `lumen-backup-${p.name.replace(/[^a-zA-Z0-9-_]+/g, '-')}.json`;
    return saveAndShare(filename, JSON.stringify(backup, null, 2), `Lumen backup - ${p.name}`);
  },

  'profiles.exportBackups': async (ids: string[], password?: string) => {
    const { profiles } = await loadProfilesFile();
    const results: { id: string; ok: boolean; path?: string; error?: string }[] = [];

    for (const id of Array.isArray(ids) ? ids : []) {
      const p = profiles.find((x) => x.id === id);
      if (!p) {
        results.push({ id, ok: false, error: 'profile_not_found' });
        continue;
      }
      const backup = await buildProfileBackupObject(p, password ?? null);
      if (!backup.mnemonic) {
        results.push({ id, ok: false, error: 'password_required' });
        continue;
      }
      const filename = `lumen-backup-${p.name.replace(/[^a-zA-Z0-9-_]+/g, '-')}.json`;
      const saved = await saveAndShare(filename, JSON.stringify(backup, null, 2), `Lumen backup - ${p.name}`);
      results.push({ id, ok: saved.ok, path: saved.path, error: saved.error });
    }

    return { ok: results.some((r) => r.ok), results };
  },

  'profiles.import': async (json: string) => {
    try {
      const parsed = JSON.parse(String(json ?? ''));
      const { profiles, activeId } = await loadProfilesFile();
      const next = profiles.slice();
      const result = await importOneBackupObject(parsed, next);
      if (!result.ok) return null;
      await saveProfilesFile({ profiles: next, activeId: result.id ?? activeId });
      return next[next.length - 1] ?? null;
    } catch {
      return null;
    }
  },

  'profiles.importBackup': async () => {
    const picked = await pickTextFile();
    if (!picked) return { ok: false, error: 'cancelled' };

    try {
      const parsed = JSON.parse(picked.text);
      if (parsed?.crypto && parsed?.passwordProtected) {
        // An encrypted backup needs the password the UI collects separately.
        return { ok: false, error: 'encrypted_backup', encryptedFiles: [picked.name] };
      }
      const { profiles, activeId } = await loadProfilesFile();
      const next = profiles.slice();
      const result = await importOneBackupObject(parsed, next);
      if (!result.ok) return { ok: false, error: result.error };
      await saveProfilesFile({ profiles: next, activeId: result.id ?? activeId });
      return {
        ok: true,
        selectedId: result.id,
        imported: 1,
        results: [{ ok: true, path: picked.name, id: result.id }]
      };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  /**
   * The desktop reads the file named by `filePath`; here the renderer has
   * already read it, so the first argument carries the contents. Both accept
   * the same encrypted object underneath.
   */
  'profiles.importEncryptedBackup': async (contents: string, password: string) => {
    try {
      const sealed = JSON.parse(String(contents ?? '')) as Keystore;
      const plain = await decryptWithPassword(sealed, String(password ?? ''));
      const { profiles, activeId } = await loadProfilesFile();
      const next = profiles.slice();
      const result = await importOneBackupObject(JSON.parse(plain), next);
      if (!result.ok) return { ok: false, error: result.error };
      await saveProfilesFile({ profiles: next, activeId: result.id ?? activeId });
      return { ok: true, id: result.id };
    } catch {
      return { ok: false, error: 'invalid_password_or_file' };
    }
  },

  'profiles.importManual': async (payload: {
    name?: string;
    mnemonic?: string;
    pqcPublicKey?: string;
    pqcPrivateKey?: string;
  }) => {
    const mnemonic = String(payload?.mnemonic ?? '').trim();
    if (!mnemonic) return { ok: false, error: 'missing_mnemonic' };

    const { profiles, activeId } = await loadProfilesFile();
    const next = profiles.slice();
    const result = await importOneBackupObject(
      {
        profile: { name: String(payload?.name ?? '').trim() || 'Imported' },
        mnemonic,
        pqcKey: payload?.pqcPrivateKey
          ? {
              scheme: 'dilithium3',
              publicKey: payload.pqcPublicKey,
              privateKey: payload.pqcPrivateKey
            }
          : null
      },
      next
    );
    if (!result.ok) return { ok: false, error: result.error };

    await saveProfilesFile({ profiles: next, activeId: result.id ?? activeId });
    const created = next[next.length - 1];
    return { ok: true, id: result.id, walletAddress: created?.walletAddress };
  },

  'profiles.delete': async (id: string) => {
    const targetId = String(id || '').trim();
    if (!targetId) return { ok: false, error: 'missing_profile_id' };

    const { profiles, activeId } = await loadProfilesFile();
    const target = profiles.find((p) => p.id === targetId) ?? null;
    if (!target) return { ok: false, error: 'profile_not_found' };

    // Drop the PQC link and key that belonged to this address.
    const addr = addressOf(target);
    if (addr) {
      const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};
      const keyName = links[addr];
      if (keyName) {
        const keys = await readDoc<Record<string, unknown>>(PQC_KEYS_KEY);
        // Only an unsealed key file can be edited without the password; a
        // sealed one is left alone rather than corrupted.
        if (keys && !(keys as unknown as Keystore).crypto) {
          delete keys[keyName];
          await writeDoc(PQC_KEYS_KEY, keys);
        }
        delete links[addr];
        await writeDoc(PQC_LINKS_KEY, links);
      }
    }

    await removeByPrefix(profilePrefix(targetId));
    await removeDoc(keystoreKey(targetId));

    const remaining = profiles.filter((p) => p.id !== targetId);
    const nextActive = activeId === targetId ? (remaining[0]?.id ?? '') : activeId;
    await saveProfilesFile({ profiles: remaining, activeId: nextActive });
    return { profiles: remaining, activeId: nextActive };
  },

  'profiles.isWalletFullyCreated': (id: string) => isWalletFullyCreated(String(id || '').trim()),

  'profiles.getFavourites': async () => {
    const { profiles, activeId } = await loadProfilesFile();
    return profiles.find((p) => p.id === activeId)?.favourites ?? {};
  },

  'profiles.setFavourite': (domain: string, cid: string) =>
    updateActiveProfile((p) => {
      p.favourites = { ...(p.favourites ?? {}), [String(domain)]: String(cid) };
    }),

  'profiles.removeFavourite': (domain: string) =>
    updateActiveProfile((p) => {
      if (p.favourites) delete p.favourites[String(domain)];
    }),

  'profiles.onPqcLinked': (callback: (payload: unknown) => void) => {
    pqcLinkedListeners.add(callback);
    return () => pqcLinkedListeners.delete(callback);
  },

  // The PQC namespace reads the same two documents, so it lives here.
  'pqc.hasLocalKey': async (input: { address?: string } | string) => {
    const addr = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!addr) return { ok: true, hasKey: false };
    const links = (await readDoc<Record<string, string>>(PQC_LINKS_KEY)) ?? {};
    return { ok: true, hasKey: !!links[addr] };
  }
};
