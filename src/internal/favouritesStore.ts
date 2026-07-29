import { computed, ref } from "vue";
import { activeProfileId } from "./profilesStore";
import { canonicalizeLumenUrl, isLumenUrl } from "./navigationUrl";
import type { FavouriteEntry, FavMap, LegacyFavMap } from "../types/favourites";

export type { FavouriteEntry };

const LEGACY_KEY = "lumen:favourites:v1";
const KEY = "lumen:favourites:v2";

function now() {
  return Date.now();
}

function makeId() {
  return `fav_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUrl(rawUrl: string): string {
  const url = String(rawUrl || "").trim();
  if (!url) return "";
  return isLumenUrl(url) ? canonicalizeLumenUrl(url) : url;
}

function normalizeTitle(rawTitle?: string): string | undefined {
  const value = String(rawTitle || "").trim();
  return value || undefined;
}

function createEntry(input: {
  url: string;
  title?: string;
  pinned?: boolean;
  createdAt?: number;
  updatedAt?: number;
  id?: string;
}): FavouriteEntry | null {
  const url = normalizeUrl(input.url);
  if (!url) return null;
  const createdAt = Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now();
  const updatedAt = Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : createdAt;
  return {
    id: String(input.id || "").trim() || makeId(),
    url,
    ...(normalizeTitle(input.title) ? { title: normalizeTitle(input.title) } : {}),
    pinned: !!input.pinned,
    createdAt,
    updatedAt,
  };
}

function sanitizeEntries(raw: unknown): FavouriteEntry[] {
  const items = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const result: FavouriteEntry[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      const entry = createEntry({ url: item });
      if (!entry || seen.has(entry.url)) continue;
      seen.add(entry.url);
      result.push(entry);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const entry = createEntry(item as any);
    if (!entry || seen.has(entry.url)) continue;
    seen.add(entry.url);
    result.push(entry);
  }
  return result;
}

function normalizeState(raw: unknown): FavMap {
  if (!raw || typeof raw !== "object") return {};
  const out: FavMap = {};
  for (const [profileId, value] of Object.entries(raw as Record<string, unknown>)) {
    const pid = String(profileId || "").trim() || "default";
    out[pid] = sanitizeEntries(value);
  }
  return out;
}

function loadInitialState(): FavMap {
  try {
    const nextRaw = localStorage.getItem(KEY);
    if (nextRaw) return normalizeState(JSON.parse(nextRaw));
  } catch {
    // ignore
  }
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) return normalizeState(JSON.parse(legacyRaw) as LegacyFavMap);
  } catch {
    // ignore
  }
  return {};
}

const data = ref<FavMap>(loadInitialState());

function save() {
  localStorage.setItem(KEY, JSON.stringify(data.value));
}

function profileKey(profileId: string): string {
  return String(profileId || "").trim() || "default";
}

function listEntries(profileId: string): FavouriteEntry[] {
  return data.value[profileKey(profileId)] || [];
}

function listUrls(profileId: string): string[] {
  return listEntries(profileId).map((entry) => entry.url);
}

function setEntries(profileId: string, entries: FavouriteEntry[]) {
  data.value[profileKey(profileId)] = entries;
  save();
}

function findEntryIndex(profileId: string, rawUrl: string): number {
  const url = normalizeUrl(rawUrl);
  if (!url) return -1;
  return listEntries(profileId).findIndex((entry) => entry.url === url);
}

function insertEntry(entries: FavouriteEntry[], entry: FavouriteEntry): FavouriteEntry[] {
  if (!entry.pinned) return [...entries, entry];
  const firstUnpinnedIndex = entries.findIndex((item) => !item.pinned);
  if (firstUnpinnedIndex === -1) return [...entries, entry];
  const next = [...entries];
  next.splice(firstUnpinnedIndex, 0, entry);
  return next;
}

function toggle(profileId: string, rawUrl: string, options?: { title?: string; pinned?: boolean }) {
  const pid = profileKey(profileId);
  const entries = listEntries(pid);
  const index = findEntryIndex(pid, rawUrl);
  if (index >= 0) {
    const next = entries.filter((_, entryIndex) => entryIndex !== index);
    setEntries(pid, next);
    return;
  }
  const entry = createEntry({
    url: rawUrl,
    title: options?.title,
    pinned: !!options?.pinned,
  });
  if (!entry) return;
  setEntries(pid, insertEntry(entries, entry));
}

function removeByUrl(profileId: string, rawUrl: string) {
  const pid = profileKey(profileId);
  const url = normalizeUrl(rawUrl);
  if (!url) return;
  setEntries(
    pid,
    listEntries(pid).filter((entry) => entry.url !== url),
  );
}

function removeById(profileId: string, id: string) {
  const pid = profileKey(profileId);
  const targetId = String(id || "").trim();
  if (!targetId) return;
  setEntries(
    pid,
    listEntries(pid).filter((entry) => entry.id !== targetId),
  );
}

function createOrUpdate(profileId: string, input: {
  url: string;
  title?: string;
  pinned?: boolean;
}) {
  const pid = profileKey(profileId);
  const url = normalizeUrl(input.url);
  if (!url) return { ok: false as const, error: "invalid_url" };
  const entries = listEntries(pid);
  const existingIndex = entries.findIndex((entry) => entry.url === url);
  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    const nextPinned = input.pinned == null ? existing.pinned : !!input.pinned;
    const updated = {
      ...existing,
      ...(normalizeTitle(input.title) ? { title: normalizeTitle(input.title) } : {}),
      pinned: nextPinned,
      updatedAt: now(),
    } satisfies FavouriteEntry;
    let next = [...entries];
    if (nextPinned === existing.pinned) {
      next[existingIndex] = updated;
    } else {
      next.splice(existingIndex, 1);
      next = insertEntry(next, updated);
    }
    setEntries(pid, next);
    return { ok: true as const, entry: updated, duplicate: true };
  }

  const created = createEntry(input);
  if (!created) return { ok: false as const, error: "invalid_url" };
  const next = insertEntry(entries, created);
  setEntries(pid, next);
  return { ok: true as const, entry: created, duplicate: false };
}

function updateById(profileId: string, id: string, patch: {
  url?: string;
  title?: string;
}) {
  const pid = profileKey(profileId);
  const targetId = String(id || "").trim();
  if (!targetId) return { ok: false as const, error: "missing_id" };

  const entries = listEntries(pid);
  const index = entries.findIndex((entry) => entry.id === targetId);
  if (index < 0) return { ok: false as const, error: "missing_entry" };

  const current = entries[index];
  const nextUrl = patch.url != null ? normalizeUrl(patch.url) : current.url;
  if (!nextUrl) return { ok: false as const, error: "invalid_url" };

  const duplicate = entries.find((entry) => entry.id !== targetId && entry.url === nextUrl);
  if (duplicate) return { ok: false as const, error: "duplicate_url" };

  const nextEntry: FavouriteEntry = {
    ...current,
    url: nextUrl,
    title: normalizeTitle(patch.title) || undefined,
    updatedAt: now(),
  };
  const nextEntries = [...entries];
  nextEntries[index] = nextEntry;
  setEntries(pid, nextEntries);
  return { ok: true as const, entry: nextEntry };
}

function setPinnedById(profileId: string, id: string, pinned: boolean) {
  const pid = profileKey(profileId);
  const targetId = String(id || "").trim();
  if (!targetId) return { ok: false as const, error: "missing_id" };
  const entries = listEntries(pid);
  const index = entries.findIndex((entry) => entry.id === targetId);
  if (index < 0) return { ok: false as const, error: "missing_entry" };

  const current = entries[index];
  const updated: FavouriteEntry = {
    ...current,
    pinned: !!pinned,
    updatedAt: now(),
  };
  const without = entries.filter((entry) => entry.id !== targetId);
  const next = updated.pinned
    ? insertEntry(without, updated)
    : (() => {
        const pinnedCount = without.filter((entry) => entry.pinned).length;
        const reordered = [...without];
        reordered.splice(pinnedCount, 0, updated);
        return reordered;
      })();

  setEntries(pid, next);
  return { ok: true as const, entry: updated };
}

function moveById(profileId: string, id: string, toIndex: number) {
  const pid = profileKey(profileId);
  const targetId = String(id || "").trim();
  if (!targetId) return { ok: false as const, error: "missing_id" };

  const entries = [...listEntries(pid)];
  const fromIndex = entries.findIndex((entry) => entry.id === targetId);
  if (fromIndex < 0) return { ok: false as const, error: "missing_entry" };

  const [entry] = entries.splice(fromIndex, 1);
  const safeIndex = Number.isFinite(Number(toIndex)) ? Math.floor(Number(toIndex)) : 0;
  if (entry.pinned) {
    const maxPinnedIndex = entries.filter((item) => item.pinned).length;
    const clampedIndex = Math.max(0, Math.min(safeIndex, maxPinnedIndex));
    entries.splice(clampedIndex, 0, entry);
  } else {
    const firstUnpinnedIndex = entries.filter((item) => item.pinned).length;
    const clampedIndex = Math.max(firstUnpinnedIndex, Math.min(safeIndex, entries.length));
    entries.splice(clampedIndex, 0, entry);
  }

  setEntries(pid, entries);
  return { ok: true as const };
}

export function setFavouritesForProfile(profileId: string, urls: string[]) {
  const pid = profileKey(profileId);
  const unique = Array.from(
    new Set((Array.isArray(urls) ? urls : []).map((value) => normalizeUrl(value)).filter(Boolean)),
  );
  const entries = unique
    .map((url) => createEntry({ url }))
    .filter(Boolean) as FavouriteEntry[];
  setEntries(pid, entries);
}

export function getFavouriteEntriesForProfile(profileId: string): FavouriteEntry[] {
  return listEntries(profileId).map((entry) => ({ ...entry }));
}

export function setFavouriteEntriesForProfile(profileId: string, entries: FavouriteEntry[]) {
  const pid = profileKey(profileId);
  setEntries(pid, sanitizeEntries(entries));
}

export function useFavourites() {
  const currentProfile = computed(() => activeProfileId.value || "default");

  const favourites = computed(() => listUrls(currentProfile.value));
  const favouriteEntries = computed(() => listEntries(currentProfile.value));

  function toggleFavourite(url: string, options?: { title?: string; pinned?: boolean }) {
    toggle(currentProfile.value, url, options);
  }

  function isFav(url: string) {
    return findEntryIndex(currentProfile.value, url) >= 0;
  }

  function removeFavourite(url: string) {
    removeByUrl(currentProfile.value, url);
  }

  function removeFavouriteById(id: string) {
    removeById(currentProfile.value, id);
  }

  function upsertFavourite(input: { url: string; title?: string; pinned?: boolean }) {
    return createOrUpdate(currentProfile.value, input);
  }

  function updateFavourite(id: string, patch: { url?: string; title?: string }) {
    return updateById(currentProfile.value, id, patch);
  }

  function setFavouritePinned(id: string, pinned: boolean) {
    return setPinnedById(currentProfile.value, id, pinned);
  }

  function moveFavourite(id: string, toIndex: number) {
    return moveById(currentProfile.value, id, toIndex);
  }

  return {
    favourites,
    favouriteEntries,
    toggleFavourite,
    isFav,
    removeFavourite,
    removeFavouriteById,
    upsertFavourite,
    updateFavourite,
    setFavouritePinned,
    moveFavourite,
    setFavourites: (urls: string[]) => setFavouritesForProfile(currentProfile.value, urls),
    setFavouriteEntries: (entries: FavouriteEntry[]) =>
      setFavouriteEntriesForProfile(currentProfile.value, entries),
  };
}
