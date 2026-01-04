import { ref } from 'vue';

export type Profile = {
  id: string;
  name: string;
  colorIndex: number;
  role?: 'guest' | 'user';
  walletAddress?: string;
  address?: string;
};

declare global {
  interface Window {
    lumen?: {
      profiles?: {
        list: () => Promise<{ profiles: Profile[]; activeId: string }>;
        getActive: () => Promise<Profile | null>;
        select: (id: string) => Promise<string>;
        create: (name: string) => Promise<Profile | null>;
        export: (id: string) => Promise<string | null>;
        exportBackup?: (id: string) => Promise<{ ok: boolean; path?: string; error?: string } | null>;
        import: (json: string) => Promise<Profile | null>;
        importBackup?: () => Promise<{ ok: boolean; selectedId?: string; error?: string } | null>;
        delete: (id: string) => Promise<{ profiles: Profile[]; activeId: string }>;
      };
      staking?: {
        getDelegations: (profileId: string) => Promise<any>;
        getValidators: (profileId: string) => Promise<any>;
        getBalance: (profileId: string) => Promise<any>;
        delegate: (profileId: string, validatorAddress: string, amount: string) => Promise<any>;
        undelegate: (profileId: string, validatorAddress: string, amount: string) => Promise<any>;
        claimRewards: (profileId: string, validatorAddress: string) => Promise<any>;
        claimAllRewards: (profileId: string) => Promise<any>;
        redelegate: (profileId: string, fromValidator: string, toValidator: string, amount: string) => Promise<any>;
      };
    };
  }
}

function getApi() {
  return window.lumen?.profiles;
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

export async function exportProfile(id: string): Promise<string | null> {
  try {
    const api = getApi();
    if (!api) return null;
    return await api.export(id);
  } catch {
    return null;
  }
}

export async function importProfile(json: string): Promise<Profile | null> {
  try {
    const api = getApi();
    if (!api) return null;
    const imported = await api.import(json);
    if (!imported) return null;
    await initProfiles();
    return imported;
  } catch {
    return null;
  }
}

export async function deleteProfile(id: string): Promise<boolean> {
  try {
    const api = getApi();
    if (!api) return false;
    await api.delete(id);
    await initProfiles();
    return true;
  } catch {
    return false;
  }
}

export async function exportProfileBackup(id: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const api = getApi();
    if (!api || typeof api.exportBackup !== 'function') {
      return { ok: false, error: 'backup_api_unavailable' };
    }
    const res = await api.exportBackup(id);
    if (!res) return { ok: false, error: 'backup_failed' };
    return res;
  } catch {
    return { ok: false, error: 'backup_failed' };
  }
}

export async function importProfileFromBackup(): Promise<Profile | null> {
  try {
    const api = getApi();
    if (!api || typeof api.importBackup !== 'function') return null;
    const res = await api.importBackup();
    if (!res || res.ok === false) return null;
    await initProfiles();
    const id = res.selectedId || activeProfileId.value || profilesState.value[0]?.id || '';
    return profilesState.value.find((p) => p.id === id) || null;
  } catch {
    return null;
  }
}
