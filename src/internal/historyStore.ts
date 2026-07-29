import { computed, ref, watch } from "vue";
import { activeProfileId, profilesState } from "./profilesStore";
import { useInternalLumen } from '../composables/useInternalLumen';
import {
  canonicalizeLumenUrl,
  isExtensionUrl,
  isFileUrl,
  isHttpUrl,
  isLumenUrl,
} from "./navigationUrl";
import type { HistoryEntry, HistorySettings, HistoryMap, HistorySettingsMap } from "../types/history";

export type { HistoryEntry, HistorySettings };

const HISTORY_KEY = "lumen:history:v1";
const SETTINGS_KEY = "lumen:history:settings:v1";
const MAX_HISTORY_ENTRIES = 500;
const MERGE_WINDOW_MS = 90_000;
const CID_V0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;

const cidNormalizationInFlight = new Map<string, Promise<void>>();
let mutationQueue = Promise.resolve();

function now() {
  return Date.now();
}

function makeId() {
  return `hist_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function profileKey(profileId: string) {
  return String(profileId || "").trim() || "default";
}

function normalizeTitle(rawTitle?: string): string | undefined {
  const value = String(rawTitle || "").trim().replace(/\s+/g, " ");
  return value || undefined;
}

function normalizeUrl(rawUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  return isLumenUrl(value) ? canonicalizeLumenUrl(value) : value;
}

function isCidV0(value: string): boolean {
  return CID_V0_RE.test(String(value || "").trim());
}

async function cidV0ToV1(cid: string): Promise<string> {
  const value = String(cid || "").trim();
  if (!isCidV0(value)) return value;
  try {
    const api: any = useInternalLumen();
    if (!api || typeof api.ipfsCidToBase32 !== "function") return value;
    const result = await api.ipfsCidToBase32(value).catch(() => null);
    const next = String(result?.cid || "").trim();
    return next || value;
  } catch {
    return value;
  }
}

async function normalizePreferredHistoryUrl(rawUrl: string): Promise<string> {
  const value = normalizeUrl(rawUrl);
  if (!value) return "";

  if (isLumenUrl(value)) {
    try {
      const url = new URL(value);
      if (String(url.hostname || "").trim().toLowerCase() !== "ipfs") return value;

      const segments = String(url.pathname || "")
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean);
      const cid = String(segments[0] || "").trim();
      if (!isCidV0(cid)) return value;

      const nextCid = await cidV0ToV1(cid);
      if (!nextCid || nextCid === cid) return value;

      segments[0] = nextCid;
      url.pathname = `/${segments.join("/")}`;
      return canonicalizeLumenUrl(url.toString());
    } catch {
      return value;
    }
  }

  if (isHttpUrl(value)) {
    try {
      const url = new URL(value);
      const loweredHost = String(url.hostname || "").trim().toLowerCase();

      const subdomainMatch = loweredHost.match(/^([a-z0-9]+)\.ipfs\.(.+)$/i);
      if (subdomainMatch && isCidV0(subdomainMatch[1] || "")) {
        const nextCid = await cidV0ToV1(subdomainMatch[1] || "");
        if (nextCid && nextCid !== subdomainMatch[1]) {
          url.hostname = `${nextCid}.ipfs.${subdomainMatch[2]}`;
          return url.toString();
        }
      }

      const segments = String(url.pathname || "").split("/");
      if (
        String(segments[1] || "").toLowerCase() === "ipfs" &&
        isCidV0(String(segments[2] || ""))
      ) {
        const nextCid = await cidV0ToV1(String(segments[2] || ""));
        if (nextCid && nextCid !== segments[2]) {
          segments[2] = nextCid;
          url.pathname = segments.join("/");
          return url.toString();
        }
      }
    } catch {
      return value;
    }
  }

  return value;
}

function parseLumenHost(rawUrl: string): string {
  const value = normalizeUrl(rawUrl);
  if (!isLumenUrl(value)) return "";
  const withoutScheme = value.slice("lumen://".length);
  return String(withoutScheme.split(/[/?#]/, 1)[0] || "")
    .trim()
    .toLowerCase();
}

function isProfileScopedContentUrl(rawUrl: string): boolean {
  const value = normalizeUrl(rawUrl);
  if (!value || isExtensionUrl(value)) return false;
  if (isHttpUrl(value) || isFileUrl(value)) return true;
  if (!isLumenUrl(value)) return false;

  const host = parseLumenHost(value);
  if (!host) return false;
  if (host === "ipfs" || host === "ipns") return true;
  return host.includes(".");
}

function createEntry(input: {
  url: string;
  title?: string;
  lastVisitedAt?: number;
  visitCount?: number;
  id?: string;
}): HistoryEntry | null {
  const url = normalizeUrl(input.url);
  if (!isProfileScopedContentUrl(url)) return null;
  return {
    id: String(input.id || "").trim() || makeId(),
    url,
    ...(normalizeTitle(input.title) ? { title: normalizeTitle(input.title) } : {}),
    lastVisitedAt: Number.isFinite(Number(input.lastVisitedAt))
      ? Number(input.lastVisitedAt)
      : now(),
    visitCount: Math.max(1, Math.floor(Number(input.visitCount) || 1)),
  };
}

function mergeEquivalentEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const byUrl = new Map<string, HistoryEntry>();

  for (const entry of entries) {
    const key = normalizeUrl(entry.url);
    if (!key) continue;

    const current = byUrl.get(key);
    if (!current) {
      byUrl.set(key, { ...entry, url: key });
      continue;
    }

    const newer = current.lastVisitedAt >= entry.lastVisitedAt ? current : entry;
    byUrl.set(key, {
      id: String(newer.id || "").trim() || current.id,
      url: key,
      title:
        normalizeTitle(newer.title) ||
        normalizeTitle(current.title) ||
        normalizeTitle(entry.title),
      lastVisitedAt: Math.max(current.lastVisitedAt, entry.lastVisitedAt),
      visitCount: Math.max(1, Number(current.visitCount || 1)) + Math.max(1, Number(entry.visitCount || 1)),
    });
  }

  return Array.from(byUrl.values())
    .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
    .slice(0, MAX_HISTORY_ENTRIES);
}

function sanitizeEntries(raw: unknown): HistoryEntry[] {
  const items = Array.isArray(raw) ? raw : [];
  const result: HistoryEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const entry = createEntry(item as any);
    if (!entry) continue;
    result.push(entry);
  }
  return mergeEquivalentEntries(result);
}

function normalizeHistoryState(raw: unknown): HistoryMap {
  if (!raw || typeof raw !== "object") return {};
  const out: HistoryMap = {};
  for (const [rawProfileId, value] of Object.entries(raw as Record<string, unknown>)) {
    out[profileKey(rawProfileId)] = sanitizeEntries(value);
  }
  return out;
}

function sanitizeSettings(raw: unknown): HistorySettings {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    enabled: value.enabled !== false,
  };
}

function normalizeSettingsState(raw: unknown): HistorySettingsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: HistorySettingsMap = {};
  for (const [rawProfileId, value] of Object.entries(raw as Record<string, unknown>)) {
    out[profileKey(rawProfileId)] = sanitizeSettings(value);
  }
  return out;
}

function loadHistoryState(): HistoryMap {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? normalizeHistoryState(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function loadSettingsState(): HistorySettingsMap {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettingsState(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

const historyData = ref<HistoryMap>(loadHistoryState());
const settingsData = ref<HistorySettingsMap>(loadSettingsState());

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData.value));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsData.value));
}

function enqueueMutation<T>(task: () => Promise<T> | T): Promise<T> {
  const nextTask = mutationQueue.then(task, task);
  mutationQueue = nextTask.then(
    () => undefined,
    () => undefined,
  );
  return nextTask;
}

function listEntries(profileId: string): HistoryEntry[] {
  return historyData.value[profileKey(profileId)] || [];
}

function getSettings(profileId: string): HistorySettings {
  return settingsData.value[profileKey(profileId)] || { enabled: true };
}

function setEntries(profileId: string, entries: HistoryEntry[]) {
  historyData.value[profileKey(profileId)] = sanitizeEntries(entries);
  saveHistory();
}

function setSettings(profileId: string, nextSettings: Partial<HistorySettings>) {
  const pid = profileKey(profileId);
  settingsData.value[pid] = sanitizeSettings({
    ...getSettings(pid),
    ...nextSettings,
  });
  saveSettings();
}

async function ensurePreferredCidUrls(profileId: string): Promise<void> {
  const pid = profileKey(profileId);
  const existing = cidNormalizationInFlight.get(pid);
  if (existing) return existing;

  const task = (async () => {
    const currentEntries = listEntries(pid);
    if (!currentEntries.length) return;

    let changed = false;
    const normalizedEntries = await Promise.all(
      currentEntries.map(async (entry) => {
        const nextUrl = await normalizePreferredHistoryUrl(entry.url);
        if (nextUrl && nextUrl !== entry.url) changed = true;
        return nextUrl && nextUrl !== entry.url ? { ...entry, url: nextUrl } : entry;
      }),
    );

    const mergedEntries = mergeEquivalentEntries(normalizedEntries);
    if (
      changed ||
      mergedEntries.length !== currentEntries.length ||
      mergedEntries.some((entry, index) => {
        const current = currentEntries[index];
        return !current || current.url !== entry.url || current.lastVisitedAt !== entry.lastVisitedAt;
      })
    ) {
      setEntries(pid, mergedEntries);
    }
  })().finally(() => {
    cidNormalizationInFlight.delete(pid);
  });

  cidNormalizationInFlight.set(pid, task);
  return task;
}

async function record(profileId: string, rawUrl: string, options?: { title?: string }) {
  const pid = profileKey(profileId);
  if (!getSettings(pid).enabled) {
    return { ok: false as const, reason: "disabled" };
  }

  return enqueueMutation(async () => {
    await ensurePreferredCidUrls(pid);

    const url = await normalizePreferredHistoryUrl(rawUrl);
    if (!isProfileScopedContentUrl(url)) {
      return { ok: false as const, reason: "filtered" };
    }

    const title = normalizeTitle(options?.title);
    const entries = listEntries(pid);
    const timestamp = now();

    const mergeIndex = entries.findIndex(
      (entry) => entry.url === url && timestamp - entry.lastVisitedAt <= MERGE_WINDOW_MS,
    );

    if (mergeIndex >= 0) {
      const merged: HistoryEntry = {
        ...entries[mergeIndex],
        ...(title ? { title } : {}),
        url,
        lastVisitedAt: timestamp,
        visitCount: Math.max(1, Number(entries[mergeIndex].visitCount || 1)) + 1,
      };
      const next = [merged, ...entries.filter((_, index) => index !== mergeIndex)];
      setEntries(pid, next);
      return { ok: true as const, entry: merged, merged: true };
    }

    const created = createEntry({
      url,
      title,
      lastVisitedAt: timestamp,
      visitCount: 1,
    });
    if (!created) {
      return { ok: false as const, reason: "filtered" };
    }

    setEntries(pid, [created, ...entries]);
    return { ok: true as const, entry: created, merged: false };
  });
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

function clearProfileHistory(profileId: string) {
  setEntries(profileId, []);
}

function pruneState(validProfileIds: string[]) {
  const keep = new Set(validProfileIds.map((id) => profileKey(id)));
  keep.add("default");

  const nextHistory: HistoryMap = {};
  const nextSettings: HistorySettingsMap = {};

  for (const [profileId, entries] of Object.entries(historyData.value)) {
    if (keep.has(profileId)) nextHistory[profileId] = entries;
  }
  for (const [profileId, settings] of Object.entries(settingsData.value)) {
    if (keep.has(profileId)) nextSettings[profileId] = settings;
  }

  historyData.value = nextHistory;
  settingsData.value = nextSettings;
  saveHistory();
  saveSettings();
}

watch(
  () => profilesState.value.map((profile) => String(profile.id || "").trim()).filter(Boolean).join("|"),
  () => {
    if (!profilesState.value.length) return;
    pruneState(profilesState.value.map((profile) => String(profile.id || "").trim()));
  },
);

queueMicrotask(() => {
  for (const profileId of Object.keys(historyData.value)) {
    void ensurePreferredCidUrls(profileId);
  }
});

export function getHistoryEntriesForProfile(profileId: string): HistoryEntry[] {
  return listEntries(profileId).map((entry) => ({ ...entry }));
}

export function setHistoryEntriesForProfile(profileId: string, entries: HistoryEntry[]) {
  setEntries(profileId, entries);
  void ensurePreferredCidUrls(profileKey(profileId));
}

export function getHistorySettingsForProfile(profileId: string): HistorySettings {
  return { ...getSettings(profileId) };
}

export function setHistorySettingsForProfile(profileId: string, settings: Partial<HistorySettings>) {
  setSettings(profileId, settings);
}

export async function normalizeHistoryUrlForComparison(rawUrl: string): Promise<string> {
  return normalizePreferredHistoryUrl(rawUrl);
}

export function useHistory() {
  const currentProfile = computed(() => activeProfileId.value || "default");

  const historyEntries = computed(() => listEntries(currentProfile.value));
  const historySettings = computed(() => getSettings(currentProfile.value));
  const historyEnabled = computed(() => historySettings.value.enabled !== false);

  function recordHistoryVisit(url: string, options?: { title?: string }) {
    return record(currentProfile.value, url, options);
  }

  function removeHistoryEntry(id: string) {
    removeById(currentProfile.value, id);
  }

  function clearHistory() {
    clearProfileHistory(currentProfile.value);
  }

  function setHistoryEnabled(enabled: boolean) {
    setSettings(currentProfile.value, { enabled: !!enabled });
  }

  return {
    historyEntries,
    historySettings,
    historyEnabled,
    recordHistoryVisit,
    removeHistoryEntry,
    clearHistory,
    setHistoryEnabled,
  };
}
