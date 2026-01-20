export type ThumbSafetyScores = {
  sexual: number;
  violence: number;
  disturbing: number;
};

export type ThumbSafetySettings = {
  showSexualContent: boolean;
  showViolentContent: boolean;
  showDisturbingImagery: boolean;
};

export type ThumbSafetyBlockedCategory = "sexual" | "violence" | "disturbing";

type PersistedCacheV1 = {
  v: 1;
  at: number;
  urls: Record<string, string>;
  hashes: Record<string, ThumbSafetyScores & { at: number }>;
  hiddenHashes?: Record<string, number>;
  hiddenUrls?: Record<string, number>;
};

const LS_KEY = "lumen-search-thumb-safety-v1.2";
const MAX_HASHES = 1200;
const MAX_URLS = 1600;
const MAX_HIDDEN_HASHES = 2500;
const MAX_HIDDEN_URLS = 2500;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function normalizeTag(t: any): string {
  return String(t || "").trim().toLowerCase();
}

function tagHasAny(tags: string[], needles: string[]): boolean {
  for (const t of tags) {
    const v = normalizeTag(t);
    if (!v) continue;
    for (const n of needles) {
      if (v.includes(n)) return true;
    }
  }
  return false;
}

export function isGreyZoneByTags(tagsRaw: string[] | null | undefined): boolean {
  if (!tagsRaw || tagsRaw.length === 0) return true;

  const tags = Array.isArray(tagsRaw) ? tagsRaw : [];

  const human = tagHasAny(tags, ["human", "person", "people", "man", "woman", "child", "boy", "girl", "baby"]);
  const face = tagHasAny(tags, ["face"]);
  const portrait = tagHasAny(tags, ["portrait", "selfie", "headshot", "closeup", "close-up"]);
  const indoor = tagHasAny(tags, ["indoor", "bedroom", "bathroom", "shower", "toilet", "kitchen", "living"]);

  return human || face || portrait || indoor;
}
export function shouldBlurImmediatelyByTags(tagsRaw: string[] | null | undefined): boolean {
  if (!tagsRaw || tagsRaw.length === 0) return false;

  const tags = Array.isArray(tagsRaw) ? tagsRaw : [];

  return tagHasAny(tags, [
    "nsfw",
    "sexual",
    "explicit",
    "porn",
    "adult",
    "nude",
    "gore",
    "blood",
    "violence",
  ]);
}

export function shouldSkipAnalysisAndRenderClear(tags: string[] | null | undefined): boolean {
  return !isGreyZoneByTags(tags);
}

export function isBlockedBySettings(scores: ThumbSafetyScores, settings: ThumbSafetySettings): boolean {
  return blockedCategories(scores, settings).length > 0;
}

export function blockedCategories(
  scores: ThumbSafetyScores,
  settings: ThumbSafetySettings,
): ThumbSafetyBlockedCategory[] {
  const out: ThumbSafetyBlockedCategory[] = [];
  if (!settings.showSexualContent && scores.sexual > 0.95) out.push("sexual");
  if (!settings.showViolentContent && scores.violence > 0.95) out.push("violence");
  if (!settings.showDisturbingImagery && scores.disturbing > 0.95) out.push("disturbing");
  return out;
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadPersisted(): PersistedCacheV1 {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? safeJsonParse(raw) : null;
    if (!parsed || parsed.v !== 1) throw new Error("bad_cache");
    return {
      v: 1,
      at: Number(parsed.at || Date.now()),
      urls: parsed.urls && typeof parsed.urls === "object" ? parsed.urls : {},
      hashes: parsed.hashes && typeof parsed.hashes === "object" ? parsed.hashes : {},
      hiddenHashes:
        parsed.hiddenHashes && typeof parsed.hiddenHashes === "object"
          ? parsed.hiddenHashes
          : {},
      hiddenUrls:
        parsed.hiddenUrls && typeof parsed.hiddenUrls === "object" ? parsed.hiddenUrls : {},
    };
  } catch {
    return { v: 1, at: Date.now(), urls: {}, hashes: {}, hiddenHashes: {}, hiddenUrls: {} };
  }
}

function prunePersisted(cache: PersistedCacheV1): void {
  const hashEntries = Object.entries(cache.hashes);
  if (hashEntries.length > MAX_HASHES) {
    hashEntries.sort((a, b) => Number(a[1]?.at || 0) - Number(b[1]?.at || 0));
    const toDrop = hashEntries.length - MAX_HASHES;
    for (let i = 0; i < toDrop; i++) {
      const h = hashEntries[i]![0];
      delete cache.hashes[h];
    }
  }

  const urlKeys = Object.keys(cache.urls);
  if (urlKeys.length > MAX_URLS) {
    for (let i = 0; i < urlKeys.length - MAX_URLS; i++) {
      delete cache.urls[urlKeys[i]!]!;
    }
  }

  const hiddenHashes = cache.hiddenHashes || {};
  const hhEntries = Object.entries(hiddenHashes);
  if (hhEntries.length > MAX_HIDDEN_HASHES) {
    hhEntries.sort((a, b) => Number(a[1] || 0) - Number(b[1] || 0));
    const toDrop = hhEntries.length - MAX_HIDDEN_HASHES;
    for (let i = 0; i < toDrop; i++) {
      const h = hhEntries[i]![0];
      delete hiddenHashes[h];
    }
  }
  cache.hiddenHashes = hiddenHashes;

  const hiddenUrls = cache.hiddenUrls || {};
  const huEntries = Object.entries(hiddenUrls);
  if (huEntries.length > MAX_HIDDEN_URLS) {
    huEntries.sort((a, b) => Number(a[1] || 0) - Number(b[1] || 0));
    const toDrop = huEntries.length - MAX_HIDDEN_URLS;
    for (let i = 0; i < toDrop; i++) {
      const u = huEntries[i]![0];
      delete hiddenUrls[u];
    }
  }
  cache.hiddenUrls = hiddenUrls;
}

function savePersisted(cache: PersistedCacheV1): void {
  try {
    cache.at = Date.now();
    prunePersisted(cache);
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

type WorkerResultMsg = {
  type: "result";
  url: string;
  hash: string;
  sexual: number;
  violence: number;
  disturbing: number;
};

type WorkerErrorMsg = { type: "error"; url: string; error: string };

type Pending = {
  promise: Promise<{ hash: string; scores: ThumbSafetyScores } | null>;
  resolve: (v: { hash: string; scores: ThumbSafetyScores } | null) => void;
};

class ThumbSafetyService {
  private worker: Worker | null = null;
  private persisted: PersistedCacheV1 = loadPersisted();
  private pendingByUrl = new Map<string, Pending>();
  private revealedHashesSession = new Set<string>();

  getHiddenHashes(): string[] {
    return Object.keys(this.persisted.hiddenHashes || {});
  }

  getHiddenUrls(): string[] {
    return Object.keys(this.persisted.hiddenUrls || {});
  }

  hideHash(hash: string): void {
    const h = String(hash || "");
    if (!h) return;
    const hh = this.persisted.hiddenHashes || {};
    hh[h] = Date.now();
    this.persisted.hiddenHashes = hh;
    savePersisted(this.persisted);
  }

  unhideHash(hash: string): void {
    const h = String(hash || "");
    if (!h) return;
    const hh = this.persisted.hiddenHashes || {};
    if (!hh[h]) return;
    delete hh[h];
    this.persisted.hiddenHashes = hh;
    savePersisted(this.persisted);
  }

  hideUrl(url: string): void {
    const u = String(url || "");
    if (!u) return;
    const hu = this.persisted.hiddenUrls || {};
    hu[u] = Date.now();
    this.persisted.hiddenUrls = hu;
    savePersisted(this.persisted);
  }

  unhideUrl(url: string): void {
    const u = String(url || "");
    if (!u) return;
    const hu = this.persisted.hiddenUrls || {};
    if (!hu[u]) return;
    delete hu[u];
    this.persisted.hiddenUrls = hu;
    savePersisted(this.persisted);
  }

  getCachedHashForUrl(url: string): string | null {
    const u = String(url || "");
    return this.persisted.urls[u] || null;
  }

  getCachedScoresByHash(hash: string): ThumbSafetyScores | null {
    const entry = this.persisted.hashes[String(hash || "")];
    if (!entry) return null;
    return {
      sexual: clamp01(Number(entry.sexual)),
      violence: clamp01(Number(entry.violence)),
      disturbing: clamp01(Number(entry.disturbing)),
    };
  }

  getCachedScoresByUrl(url: string): { hash: string; scores: ThumbSafetyScores } | null {
    const h = this.getCachedHashForUrl(url);
    if (!h) return null;
    const scores = this.getCachedScoresByHash(h);
    if (!scores) return null;
    return { hash: h, scores };
  }

  markRevealedForSession(hash: string): void {
    const h = String(hash || "");
    if (!h) return;
    this.revealedHashesSession.add(h);
  }

  isRevealedForSession(hash: string): boolean {
    const h = String(hash || "");
    return !!h && this.revealedHashesSession.has(h);
  }

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    try {
      const w = new Worker(new URL("./thumbSafety.worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (ev: MessageEvent<WorkerResultMsg | WorkerErrorMsg>) => {
        const msg = ev.data as any;
        if (!msg || typeof msg.url !== "string") return;

        const url = msg.url;
        const pending = this.pendingByUrl.get(url);
        if (!pending) return;

        this.pendingByUrl.delete(url);

        if (msg.type === "result") {
          const hash = String(msg.hash || "");
          const scores: ThumbSafetyScores = {
            sexual: clamp01(Number(msg.sexual)),
            violence: clamp01(Number(msg.violence)),
            disturbing: clamp01(Number(msg.disturbing)),
          };

          if (hash) {
            this.persisted.urls[url] = hash;
            this.persisted.hashes[hash] = { ...scores, at: Date.now() };
            savePersisted(this.persisted);
          }
          pending.resolve({ hash, scores });
          return;
        }

        pending.resolve(null);
      };
      this.worker = w;
      return w;
    } catch {
      this.worker = null;
      return null;
    }
  }

  analyzeUrlWithBitmap(url: string, bitmap: ImageBitmap): Promise<{ hash: string; scores: ThumbSafetyScores } | null> {
    const u = String(url || "");
    if (!u) return Promise.resolve(null);

    const cached = this.getCachedScoresByUrl(u);
    if (cached) return Promise.resolve(cached);

    const existing = this.pendingByUrl.get(u);
    if (existing) return existing.promise;

    let resolve!: Pending["resolve"];
    const promise = new Promise<{ hash: string; scores: ThumbSafetyScores } | null>((r) => (resolve = r));
    this.pendingByUrl.set(u, { promise, resolve });

    const w = this.ensureWorker();
    if (!w) {
      this.pendingByUrl.delete(u);
      resolve(null);
      return promise;
    }

    try {
      w.postMessage({ type: "analyze", url: u, bitmap }, [bitmap as any]);
    } catch {
      this.pendingByUrl.delete(u);
      resolve(null);
    }

    return promise;
  }
}

let singleton: ThumbSafetyService | null = null;
export function getThumbSafetyService(): ThumbSafetyService {
  if (!singleton) singleton = new ThumbSafetyService();
  return singleton;
}
