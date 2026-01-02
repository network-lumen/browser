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
