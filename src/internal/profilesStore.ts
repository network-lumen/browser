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
        import: (json: string) => Promise<Profile | null>;
        delete: (id: string) => Promise<{ profiles: Profile[]; activeId: string }>;
      };
    };
  }
}

function getApi() {
  return window.lumen?.profiles;
}

export const profilesState = ref<Profile[]>([]);
export const activeProfileId = ref<string>('');

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
