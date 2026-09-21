/**
 * The mobile stand-in for `electron/utils/fs.cjs`.
 *
 * The desktop main process keeps everything under `userDataPath()`: a settings
 * file, one directory per profile with a `keystore.json` inside, a PQC key
 * file. Android has no such place a WebView can reach, so the same documents
 * live in Capacitor Preferences, keyed by the path they would have had on
 * disk - `profiles/<id>/keystore.json` is a key, not a file.
 *
 * Keeping the *names* means the shapes stored under them stay identical to the
 * desktop ones, which is what lets a backup exported on a laptop import here.
 *
 * SECURITY NOTE, and it is a real one: Preferences is Android SharedPreferences,
 * which is private to the app but readable on a rooted device and included in
 * some backup transports. The keystore stored through it is encrypted, so the
 * exposure is the same as the desktop's `keystore.json` on a stolen laptop -
 * but `secret.bin`, the machine secret that protects a *password-less* wallet,
 * sits beside it exactly as it does on disk. Moving that one secret into the
 * Android Keystore is the obvious next hardening step and the reason
 * `appSecret` is isolated below rather than inlined where it is used.
 */

import { Preferences } from '@capacitor/preferences';

/** Reads one JSON document. Returns `null` when absent or unparseable. */
export async function readDoc<T>(key: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key });
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    // A corrupt document reads as absent, the same way readJson() does on the
    // desktop. Throwing here would brick startup over one bad key.
    return null;
  }
}

/** Writes one JSON document. */
export async function writeDoc(key: string, value: unknown): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

/** Removes one document. */
export async function removeDoc(key: string): Promise<void> {
  await Preferences.remove({ key });
}

/** Every stored key, for the prefix sweeps that deleting a profile needs. */
export async function listKeys(): Promise<string[]> {
  try {
    const { keys } = await Preferences.keys();
    return keys ?? [];
  } catch {
    return [];
  }
}

/** Removes every document whose key starts with `prefix`. */
export async function removeByPrefix(prefix: string): Promise<void> {
  for (const key of await listKeys()) {
    if (key.startsWith(prefix)) await removeDoc(key);
  }
}

export const SETTINGS_KEY = 'settings.json';
export const PROFILES_KEY = 'profiles.json';
export const APP_SECRET_KEY = 'secret.bin';

export const keystoreKey = (id: string) => `profiles/${id}/keystore.json`;
export const profileJsonKey = (id: string) => `profiles/${id}/profile.json`;
export const profilePrefix = (id: string) => `profiles/${id}/`;
