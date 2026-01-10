import { ref } from 'vue';
function getApi() {
    return window.lumen?.profiles;
}
export const profilesState = ref([]);
export const activeProfileId = ref('');
export async function initProfiles() {
    try {
        const api = getApi();
        if (!api)
            return;
        const res = await api.list();
        profilesState.value = Array.isArray(res.profiles) ? res.profiles : [];
        activeProfileId.value = res.activeId || profilesState.value[0]?.id || '';
    }
    catch {
        // ignore
    }
}
export async function setActiveProfile(id) {
    try {
        const api = getApi();
        if (!api)
            return;
        const next = await api.select(id);
        activeProfileId.value = next || activeProfileId.value;
    }
    catch {
        // ignore
    }
}
export async function createProfile(name) {
    try {
        const api = getApi();
        if (!api)
            return null;
        const created = await api.create(name);
        if (!created)
            return null;
        await initProfiles();
        return created;
    }
    catch {
        return null;
    }
}
export async function exportProfile(id) {
    try {
        const api = getApi();
        if (!api)
            return null;
        return await api.export(id);
    }
    catch {
        return null;
    }
}
export async function importProfile(json) {
    try {
        const api = getApi();
        if (!api)
            return null;
        const imported = await api.import(json);
        if (!imported)
            return null;
        await initProfiles();
        return imported;
    }
    catch {
        return null;
    }
}
export async function deleteProfile(id) {
    try {
        const api = getApi();
        if (!api)
            return false;
        await api.delete(id);
        await initProfiles();
        return true;
    }
    catch {
        return false;
    }
}
export async function exportProfileBackup(id) {
    try {
        const api = getApi();
        if (!api || typeof api.exportBackup !== 'function') {
            return { ok: false, error: 'backup_api_unavailable' };
        }
        const res = await api.exportBackup(id);
        if (!res)
            return { ok: false, error: 'backup_failed' };
        return res;
    }
    catch {
        return { ok: false, error: 'backup_failed' };
    }
}
export async function exportProfilesBackup(ids) {
    try {
        const api = getApi();
        if (!api || typeof api.exportBackups !== 'function') {
            return { ok: false, error: 'backup_api_unavailable' };
        }
        const res = await api.exportBackups(Array.isArray(ids) ? ids : []);
        if (!res)
            return { ok: false, error: 'backup_failed' };
        return res;
    }
    catch {
        return { ok: false, error: 'backup_failed' };
    }
}
export async function importProfilesFromBackup() {
    try {
        const api = getApi();
        if (!api || typeof api.importBackup !== 'function') {
            return { ok: false, error: 'backup_api_unavailable' };
        }
        const res = await api.importBackup();
        if (!res)
            return { ok: false, error: 'backup_failed' };
        if (res.ok === false)
            return res;
        await initProfiles();
        return res;
    }
    catch {
        return { ok: false, error: 'backup_failed' };
    }
}
export async function importProfileFromBackup() {
    try {
        const res = await importProfilesFromBackup();
        if (!res || res.ok === false)
            return null;
        const id = res.selectedId || activeProfileId.value || profilesState.value[0]?.id || '';
        return profilesState.value.find((p) => p.id === id) || null;
    }
    catch {
        return null;
    }
}
