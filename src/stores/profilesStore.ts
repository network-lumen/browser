import { ref } from 'vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import type { Profile, ManualProfileSourceResult, ManualPqcSourceResult } from '../types/profile';

export type { Profile };

function getApi() {
  return useInternalLumen()?.profiles;
}

export const profilesState = ref<Profile[]>([]);
export const activeProfileId = ref<string>('');

export function getActiveProfile(): Profile | null {
  if (!activeProfileId.value) return null;
  return profilesState.value.find((p) => p.id === activeProfileId.value) || null;
}

export async function initProfiles() {
  try {
    const api = getApi();
    if (!api) return;
    const res = await api.list();
    profilesState.value = Array.isArray(res.profiles) ? res.profiles : [];
    activeProfileId.value = res.activeId || profilesState.value[0]?.id || '';
  } catch {
    // ignore
  }
}

export async function setActiveProfile(id: string) {
  try {
    const api = getApi();
    if (!api) return;
    const next = await api.select(id);
    activeProfileId.value = next || activeProfileId.value;
  } catch {
    // ignore
  }
}

export async function createProfile(name: string): Promise<Profile | null> {
  try {
    const api = getApi();
    if (!api) return null;
    const created = await api.create(name);
    if (!created) return null;
    await initProfiles();
    return created;
  } catch {
    return null;
  }
}

export async function updateProfileName(
  id: string,
  name: string,
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  try {
    const api = getApi();
    if (!api || typeof api.updateName !== 'function') {
      return { ok: false, error: 'profiles_api_unavailable' };
    }
    const result = await api.updateName(id, name);
    if (!result?.ok) {
      return { ok: false, error: result?.error || 'update_failed' };
    }
    await initProfiles();
    return {
      ok: true,
      profile: profilesState.value.find((p) => p.id === id) || result.profile,
    };
  } catch {
    return { ok: false, error: 'update_failed' };
  }
}

export async function updateProfileAvatarFromPath(
  id: string,
  sourcePath: string,
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  try {
    const api = getApi();
    if (!api || typeof api.updateAvatar !== 'function') {
      return { ok: false, error: 'profiles_api_unavailable' };
    }
    const result = await api.updateAvatar(id, sourcePath);
    if (!result?.ok) {
      return { ok: false, error: result?.error || 'update_failed' };
    }
    await initProfiles();
    return {
      ok: true,
      profile: profilesState.value.find((p) => p.id === id) || result.profile,
    };
  } catch {
    return { ok: false, error: 'update_failed' };
  }
}

export async function clearProfileAvatar(
  id: string,
): Promise<{ ok: boolean; profile?: Profile; error?: string }> {
  try {
    const api = getApi();
    if (!api || typeof api.clearAvatar !== 'function') {
      return { ok: false, error: 'profiles_api_unavailable' };
    }
    const result = await api.clearAvatar(id);
    if (!result?.ok) {
      return { ok: false, error: result?.error || 'update_failed' };
    }
    await initProfiles();
    return {
      ok: true,
      profile: profilesState.value.find((p) => p.id === id) || result.profile,
    };
  } catch {
    return { ok: false, error: 'update_failed' };
  }
}

export async function deleteProfile(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const api = getApi();
    if (!api) return { ok: false, error: 'profiles_api_unavailable' };
    const res = await api.delete(id);
    if (res && (res as any).ok === false) return res as any;
    await initProfiles();
    return { ok: true };
  } catch {
    return { ok: false, error: 'delete_failed' };
  }
}

export async function exportProfileBackup(id: string, password?: string, encryptOutput?: boolean): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const api = getApi();
    if (!api || typeof api.exportBackup !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.exportBackup(id, password, encryptOutput);
    if (!res) return { ok: false, error: 'backup_failed' };
    return res;
  } catch (e) {
    console.error('[profilesStore] exportProfileBackup error:', e);
    return { ok: false, error: 'backup_failed' };
  }
}

export async function exportProfilesBackup(ids: string[]): Promise<{
  ok: boolean;
  baseDir?: string;
  results?: { id: string; ok: boolean; path?: string; error?: string }[];
  error?: string;
}> {
  try {
    const api = getApi();
    if (!api || typeof api.exportBackups !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.exportBackups(Array.isArray(ids) ? ids : []);
    if (!res) return { ok: false, error: 'backup_failed' };
    return res;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

export async function importProfilesFromBackup(): Promise<{
  ok: boolean;
  selectedId?: string;
  imported?: number;
  results?: { ok: boolean; path: string; id?: string; error?: string }[];
  error?: string;
  encryptedFiles?: string[];
}> {
  try {
    const api = getApi();
    if (!api || typeof api.importBackup !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.importBackup();
    if (!res) return { ok: false, error: 'backup_failed' };
    if (res.ok === false) return res as any;
    await initProfiles();
    return res as any;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

export async function importProfileManually(payload: {
  name: string;
  mnemonic: string;
  pqcPublicKey?: string;
  pqcPrivateKey?: string;
}): Promise<{
  ok: boolean;
  id?: string;
  walletAddress?: string;
  error?: string;
}> {
  try {
    const api = getApi();
    if (!api || typeof api.importManual !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.importManual(payload);
    if (!res) return { ok: false, error: 'backup_failed' };
    if (res.ok === false) return res as any;
    await initProfiles();
    return res as any;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

export async function pickManualProfileSource(): Promise<ManualProfileSourceResult> {
  try {
    const api = getApi();
    if (!api || typeof api.pickManualProfileSource !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.pickManualProfileSource();
    if (!res) return { ok: false, error: 'backup_failed' };
    return res;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

export async function pickManualPqcSource(): Promise<ManualPqcSourceResult> {
  try {
    const api = getApi();
    if (!api || typeof api.pickManualPqcSource !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.pickManualPqcSource();
    if (!res) return { ok: false, error: 'backup_failed' };
    return res;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

// ===== FAVOURITES API =====
export async function getFavourites(): Promise<Record<string, string>> {
  try {
    const api = getApi();
    if (!api || !api.getFavourites) return {};
    return (await api.getFavourites()) || {};
  } catch {
    return {};
  }
}

export async function removeFavourite(domain: string): Promise<boolean> {
  try {
    const api = getApi();
    if (!api || !api.removeFavourite) return false;
    const res = await api.removeFavourite(domain);
    return !!res?.ok;
  } catch {
    return false;
  }
}
