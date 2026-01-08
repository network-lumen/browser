<template>
  <main class="search-page" @keydown.slash.prevent="focusInput">
    <section class="hero">
      <div class="brand">Lumen</div>

      <div class="search-row">
        <div class="search-box">
          <Search :size="18" class="search-icon" />
          <input
            ref="inputEl"
            v-model="q"
            type="text"
            class="search-input"
            placeholder="Search the network"
            @keydown.enter.prevent="submit"
          />
          <button
            class="search-btn"
            type="button"
            @click="submit"
            :disabled="loading || !q.trim()"
          >
            Search
          </button>
        </div>
      </div>

      <div class="tabs">
        <button
          class="pill"
          type="button"
          :class="{ active: selectedType === 'site' }"
          @click="setType('site')"
        >
          <Globe :size="16" />
          Sites
        </button>
        <button
          class="pill"
          type="button"
          :class="{ active: selectedType === 'video' }"
          @click="setType('video')"
          :disabled="true"
          title="Coming soon"
        >
          <Film :size="16" />
          Videos
        </button>
        <button
          class="pill"
          type="button"
          :class="{ active: selectedType === 'image' }"
          @click="setType('image')"
        >
          <Image :size="16" />
          Images
        </button>
        <button
          class="pill"
          type="button"
          :class="{ active: selectedType === '' }"
          @click="setType('')"
        >
          <Compass :size="16" />
          Explore everything
        </button>
      </div>
    </section>

    <section v-if="touched" class="results">
      <div class="meta">
        <div class="txt-xs color-gray-blue">
          <span v-if="!loading && results.length"
            >About {{ results.length }} results</span
          >
          <span v-else-if="!loading && !results.length">No results</span>
        </div>
        <button
          class="debug-toggle txt-xs"
          type="button"
          @click="toggleDebugMode"
          :title="debugMode ? 'Disable debug' : 'Enable debug'"
        >
          <Bug :size="14" />
          Debug
        </button>
        <div v-if="errorMsg" class="txt-xs error">{{ errorMsg }}</div>
      </div>

      <ul v-if="loading" class="skeleton-list">
        <li v-for="i in 5" :key="i" class="skeleton-item">
          <div class="skeleton-title"></div>
          <div class="skeleton-url"></div>
          <div class="skeleton-desc"></div>
        </li>
      </ul>

      <div v-else-if="!results.length" class="empty">
        <div class="empty-title">No results</div>
        <div class="empty-subtitle">
          Try different keywords or remove filters.
        </div>
      </div>

      <div v-else-if="selectedType === 'image'" class="image-grid">
        <button
          v-for="r in imageResults"
          :key="r.id"
          type="button"
          class="image-card"
          @click="openResult(r)"
          :title="r.url"
        >
          <img
            v-if="r.thumbUrl"
            class="image-thumb"
            :src="r.thumbUrl"
            alt=""
            loading="lazy"
          />
          <div v-else class="image-fallback">
            <Image :size="18" />
          </div>
          <div v-if="r.badges?.length" class="image-meta">
            <div class="image-tags">
              <span
                v-for="b in r.badges"
                :key="`${r.id}:${b}`"
                class="image-badge"
                >{{ b }}</span
              >
            </div>
          </div>
        </button>
      </div>

      <ul v-else class="result-list">
        <li v-for="r in results" :key="r.id" class="result-item">
          <button class="result-card" type="button" @click="openResult(r)">
            <div class="result-icon">
              <img
                v-if="r.thumbUrl && !brokenThumbs[r.id]"
                class="thumb"
                :src="r.thumbUrl"
                alt=""
                @error="markThumbBroken(r.id)"
              />
              <component v-else :is="iconFor(r.kind, r.media)" :size="18" />
            </div>
            <div class="result-body">
              <div v-if="r.title" class="result-title">{{ r.title }}</div>
              <div class="result-url mono">{{ r.url }}</div>
              <div v-if="r.description" class="result-desc">
                {{ r.description }}
              </div>
              <div v-if="r.badges?.length" class="badges">
                <span v-for="b in r.badges" :key="b" class="badge">{{
                  b
                }}</span>
              </div>
            </div>
            <span
              v-if="debugMode && canDebugResult(r)"
              class="debug-btn"
              role="button"
              tabindex="0"
              title="Show raw JSON"
              @click.stop.prevent="openDebugForResult(r)"
              @keydown.enter.stop.prevent="openDebugForResult(r)"
            >
              <Bug :size="16" />
            </span>
            <ArrowUpRight :size="18" class="result-open" />
          </button>
        </li>
      </ul>
    </section>

    <div
      v-if="debugOpen"
      class="debug-modal"
      role="dialog"
      aria-modal="true"
      @click.self="closeDebug"
    >
      <div class="debug-panel">
        <div class="debug-head">
          <div class="debug-title mono">{{ debugTitle }}</div>
          <div class="debug-actions">
            <button class="debug-action" type="button" @click="copyDebug">
              Copy
            </button>
            <button class="debug-action" type="button" @click="closeDebug">
              Close
            </button>
          </div>
        </div>
        <pre class="debug-pre mono">{{ debugText }}</pre>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
  Bug,
  Compass,
  Film,
  Globe,
  Hash,
  Image,
  Layers,
  Search,
  Wallet,
} from "lucide-vue-next";
import { LOCAL_IPFS_GATEWAY_BASE } from "../services/contentResolver";

type SearchType = "site" | "video" | "image" | "";
type ResultKind = "site" | "ipfs" | "tx" | "block" | "address" | "link";
type ResultItem = {
  id: string;
  title: string;
  url: string;
  description?: string;
  kind: ResultKind;
  badges?: string[];
  thumbUrl?: string;
  media?: "image" | "video" | "audio" | "unknown";
  score?: number;
};

type GatewayView = {
  id: string;
  endpoint: string;
  regions?: string[];
};

const currentTabUrl = inject<any>("currentTabUrl", null);
const navigate = inject<
  ((url: string, opts?: { push?: boolean }) => void) | null
>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>(
  "openInNewTab",
  null,
);

const q = ref("");
const selectedType = ref<SearchType>("site");
const touched = ref(false);
const loading = ref(false);
const errorMsg = ref("");
const results = ref<ResultItem[]>([]);
const inputEl = ref<HTMLInputElement | null>(null);

const debugMode = ref(false);
const debugOpen = ref(false);
const debugTitle = ref("");
const debugText = ref("");
const debugByDomain = ref<Record<string, any>>({});

const lastRunKey = ref("");
let searchSeq = 0;

const gatewaysCache = ref<{ at: number; items: GatewayView[] }>({
  at: 0,
  items: [],
});

function focusInput() {
  inputEl.value?.focus();
}

onMounted(() => {
  setTimeout(focusInput, 60);

  try {
    const saved = localStorage.getItem("lumen-search-debug") || "";
    debugMode.value = saved === "1";
  } catch {
    debugMode.value = false;
  }
});

function toggleDebugMode() {
  debugMode.value = !debugMode.value;
  try {
    localStorage.setItem("lumen-search-debug", debugMode.value ? "1" : "0");
  } catch {
    // ignore
  }
}

function iconFor(kind: ResultKind, media?: ResultItem["media"]) {
  switch (kind) {
    case "site":
      return Globe;
    case "ipfs":
      if (media === "video") return Film;
      if (media === "image") return Image;
      return Layers;
    case "tx":
      return Hash;
    case "block":
      return Layers;
    case "address":
      return Wallet;
    case "link":
    default:
      return Search;
  }
}

function goto(url: string, opts?: { push?: boolean }) {
  if (navigate) {
    navigate(url, opts);
    return;
  }
  openInNewTab?.(url);
}

function parseSearchUrl(raw: string): { q: string; type: SearchType } {
  const value = String(raw || "").trim();
  if (!value) return { q: "", type: "site" };
  try {
    const u = new URL(value);
    const qs = u.searchParams.get("q") || "";
    const type = (u.searchParams.get("type") || "") as SearchType;
    const t: SearchType =
      type === "site" || type === "image" || type === "" ? type : "site";
    return { q: qs, type: t };
  } catch {
    return { q: "", type: "site" };
  }
}

function makeSearchUrl(query: string, type: SearchType): string {
  const s = String(query || "").trim();
  const u = new URL("lumen://search");
  if (s) u.searchParams.set("q", s);
  if (type) u.searchParams.set("type", type);
  return u.toString();
}

function setType(t: SearchType) {
  if (t === "video") return;
  selectedType.value = t;
  const s = q.value.trim();
  if (!s) return;
  goto(makeSearchUrl(s, t), { push: false });
}

function submit() {
  const s = q.value.trim();
  if (!s) return;
  touched.value = true;
  errorMsg.value = "";
  results.value = [];
  loading.value = true;
  goto(makeSearchUrl(s, selectedType.value), { push: true });
}

function openResult(r: ResultItem) {
  if (selectedType.value === "site" && r.kind === "site") {
    openInNewTab?.(r.url);
    return;
  }
  goto(r.url, { push: true });
}

const brokenThumbs = ref<Record<string, true>>({});

function markThumbBroken(id: string) {
  const key = String(id || "").trim();
  if (!key) return;
  if (brokenThumbs.value[key]) return;
  brokenThumbs.value = { ...brokenThumbs.value, [key]: true };
}

function isCidLike(v: string): boolean {
  const s = String(v || "").trim();
  if (!s) return false;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(s)) return true;
  if (/^bafy[a-z0-9]{20,}$/i.test(s)) return true;
  return false;
}

function isTxHash(v: string): boolean {
  return /^[0-9a-f]{64}$/i.test(String(v || "").trim());
}

function isAddress(v: string): boolean {
  return /^lmn1[0-9a-z]{20,}$/i.test(String(v || "").trim());
}

function isBlockHeight(v: string): boolean {
  const s = String(v || "").trim();
  return /^\d{1,10}$/.test(s);
}

function faviconUrlForCid(cid: string): string | null {
  const c = String(cid || "").trim();
  if (!c) return null;
  return `${LOCAL_IPFS_GATEWAY_BASE}/ipfs/${c}/favicon.ico`;
}

function buildDomainCandidates(query: string): string[] {
  const value = String(query || "")
    .toLowerCase()
    .trim();
  if (!value) return [];

  const tokens = value
    .replace(/[^a-z0-9.\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const cands = new Set<string>();

  // Common UX: allow searching for DNS sites with slugs (e.g. "test-domain" -> "test-domain.lmn").
  if (
    !value.includes(" ") &&
    !value.includes(".") &&
    /^[a-z0-9-]{2,}$/i.test(value)
  ) {
    cands.add(`${value}.lmn`);
  }

  if (!value.includes(" ") && value.includes(".")) {
    cands.add(value);
  }

  for (const t of tokens) {
    if (t.includes(".")) cands.add(t);
  }

  if (tokens.length === 1 && !tokens[0].includes(".")) {
    cands.add(`${tokens[0]}.lmn`);
  }

  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    const label = tokens.slice(0, -1).join("");
    if (label && last) cands.add(`${label}.${last}`);
  }

  return Array.from(cands);
}

function scoreDomainMatch(query: string, domainName: string): number {
  const qTokens = String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const d = String(domainName || "")
    .toLowerCase()
    .trim();
  if (!qTokens.length || !d) return 0;

  if (qTokens.length === 1 && qTokens[0] === d) return 1;

  const lastDot = d.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === d.length - 1) return 0;

  const label = d.slice(0, lastDot);
  const ext = d.slice(lastDot + 1);
  if (!label || !ext) return 0;

  const wLabel = 0.8;
  const wExt = 0.2;

  let extensionScore = 0;
  for (const tok of qTokens) {
    if (tok === ext) {
      extensionScore = 1;
      break;
    }
  }

  let labelAccum = 0;
  for (const tok of qTokens) {
    if (label.includes(tok)) labelAccum += tok.length / label.length;
  }
  const labelScore = Math.min(labelAccum, 1);

  const score = wLabel * labelScore + wExt * extensionScore;
  if (score <= 0) return 0;
  return score > 1 ? 1 : score;
}

function findCidFromDomainInfo(info: any): string | null {
  const direct = String(info?.cid || "").trim();
  if (direct && isCidLike(direct)) return direct;

  const records = Array.isArray(info?.records) ? info.records : [];

  function parseCidFromRecordValue(rawValue: any): string | null {
    const value = String(rawValue ?? "").trim();
    if (!value) return null;

    const lower = value.toLowerCase();
    if (lower.startsWith("ipfs://")) {
      const id = value
        .slice("ipfs://".length)
        .replace(/^\/+/, "")
        .split(/[/?#]/, 1)[0];
      return id && isCidLike(id) ? id : null;
    }
    if (lower.startsWith("lumen://ipfs/")) {
      const id = value
        .slice("lumen://ipfs/".length)
        .replace(/^\/+/, "")
        .split(/[/?#]/, 1)[0];
      return id && isCidLike(id) ? id : null;
    }

    return isCidLike(value) ? value : null;
  }

  const preferredKeys = ["cid", "site", "root", "ipfs", "website"];
  for (const key of preferredKeys) {
    const rec = records.find(
      (r: any) => String(r?.key || "").toLowerCase() === key,
    );
    const cid = rec ? parseCidFromRecordValue(rec.value) : null;
    if (cid) return cid;
  }

  return null;
}

async function resolveDomainForQuery(
  query: string,
): Promise<{
  name: string;
  cid: string | null;
  score: number;
  candidates: string[];
  infoRes: any;
} | null> {
  const dnsApi = (window as any).lumen?.dns;
  if (!dnsApi || typeof dnsApi.getDomainInfo !== "function") return null;

  const cands = buildDomainCandidates(query);
  if (!cands.length) return null;

  let best:
    | {
        name: string;
        cid: string | null;
        score: number;
        candidates: string[];
        infoRes: any;
      }
    | null = null;

  for (const name of cands) {
    let infoRes: any;
    try {
      infoRes = await dnsApi.getDomainInfo(name);
    } catch {
      continue;
    }

    if (!infoRes) continue;
    if (infoRes.ok === false) continue;
    const info =
      infoRes?.data?.domain || infoRes?.data || infoRes?.domain || infoRes;
    if (!info) continue;

    const cid = findCidFromDomainInfo(info);
    const score = Math.max(
      scoreDomainMatch(query, name),
      String(query || "")
        .toLowerCase()
        .trim() === name
        ? 1
        : 0,
    );

    if (
      !best ||
      score > best.score ||
      (score === best.score && !!cid && !best.cid)
    ) {
      best = { name, cid, score, candidates: cands.slice(), infoRes };
    }
  }

  return best;
}

function normalizeGatewayType(t: SearchType): string {
  if (t === "site" || t === "image") return t;
  return "";
}

async function getActiveProfileId(): Promise<string | null> {
  const profilesApi = (window as any).lumen?.profiles;
  if (!profilesApi || typeof profilesApi.getActive !== "function") return null;
  const active = await profilesApi.getActive().catch(() => null);
  const id = String(active?.id || "").trim();
  return id || null;
}

async function loadGatewaysForSearch(
  profileId: string,
): Promise<GatewayView[]> {
  const now = Date.now();
  const cached = gatewaysCache.value;
  if (cached.items.length && now - cached.at < 60_000) return cached.items;

  const gwApi = (window as any).lumen?.gateway;
  if (!gwApi || typeof gwApi.getPlansOverview !== "function") return [];

  const res = await gwApi
    .getPlansOverview(profileId, { limit: 50, timeoutMs: 2500 })
    .catch(() => null);
  if (!res || res.ok === false) return [];
  const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];

  const items: GatewayView[] = [];
  const seen = new Set<string>();
  for (const g of gwRaw) {
    const id = String(g?.id ?? g?.gatewayId ?? "").trim();
    if (!id || seen.has(id)) continue;
    const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? "").trim();
    if (!endpoint) continue;
    const regions = Array.isArray(g?.regions)
      ? g.regions.map((r: any) => String(r || "")).filter(Boolean)
      : [];
    items.push({ id, endpoint, regions });
    seen.add(id);
  }

  gatewaysCache.value = { at: now, items };
  return items;
}

type GatewaySearchHit = {
  cid?: string;
  path?: string;
  title?: string;
  mime?: string;
  resourceType?: string;
  tags_json?: any;
  topics?: any;
  snippet?: string;
};

type GatewaySiteSearchResult = {
  type?: string;
  domain?: string;
  rootDomain?: string;
  cid?: string;
  wallet?: string;
  score?: number;
  tags?: any;
};

const LOCAL_IPFS_GATEWAY = "http://127.0.0.1:8088";

function safePathSuffix(pathValue: any): string {
  const p = String(pathValue ?? "").trim();
  if (!p) return "";
  if (p.startsWith("/")) return p;
  return `/${p}`;
}

function mapGatewayHitToResult(
  hit: GatewaySearchHit,
  gateway: GatewayView,
  filterType: SearchType,
): ResultItem | null {
  const cid = String(hit?.cid || "").trim();
  if (!cid) return null;
  const path = safePathSuffix(hit?.path);
  const mime = String(hit?.mime || "").trim();
  const rType = String(hit?.resourceType || "").trim();

  const extractedTags = extractSearchTags(hit);

  const isImage =
    rType.toLowerCase() === "image" || mime.toLowerCase().startsWith("image/");
  const isVideo =
    rType.toLowerCase() === "video" || mime.toLowerCase().startsWith("video/");
  const isAudio =
    rType.toLowerCase() === "audio" || mime.toLowerCase().startsWith("audio/");
  const media: ResultItem["media"] = isImage
    ? "image"
    : isVideo
      ? "video"
      : isAudio
        ? "audio"
        : "unknown";

  if (filterType === "image" && !isImage) return null;
  if (filterType === "video" && !isVideo) return null;
  const thumbUrl = isImage
    ? `${LOCAL_IPFS_GATEWAY_BASE}/ipfs/${cid}${path}`
    : undefined;

  const title =
    (hit?.title != null && String(hit.title).trim()) ||
    (path ? path.split("/").filter(Boolean).slice(-1)[0] : "") ||
    (isImage ? "" : `CID ${cid.slice(0, 10)}…`);

  const snippet = hit?.snippet != null ? String(hit.snippet).trim() : "";

  const badges: string[] = [];
  const badgeLimit =
    filterType === "image" && isImage ? Number.POSITIVE_INFINITY : 6;
  for (const t of extractedTags) {
    if (badges.length >= badgeLimit) break;
    if (!badges.includes(t)) badges.push(t);
  }
  // Fallback: show MIME when we don't have tags (and not in image mode).
  if (!badges.length && mime && !isImage) badges.push(mime);

  return {
    id: `gw:${gateway.id}:${cid}:${path || ""}`,
    title,
    url: `lumen://ipfs/${cid}${path}`,
    kind: "ipfs",
    description: snippet || undefined,
    badges,
    thumbUrl,
    media,
  };
}

function extractSearchTags(hit: any): string[] {
  const topics = Array.isArray(hit?.tags_json?.topics)
    ? hit.tags_json.topics
    : Array.isArray(hit?.topics)
      ? hit.topics
      : [];
  const tokensObj =
    hit?.tags_json &&
    hit.tags_json.tokens &&
    typeof hit.tags_json.tokens === "object"
      ? hit.tags_json.tokens
      : null;

  const out: string[] = [];
  for (const t of topics) {
    const v = String(t || "").trim();
    if (v) out.push(v);
  }

  if (tokensObj) {
    try {
      const keys = Object.keys(tokensObj)
        .map((k) => String(k || "").trim())
        .filter(Boolean)
        .slice(0, 10);
      for (const k of keys) {
        if (!out.includes(k)) out.push(k);
      }
    } catch {
      // ignore
    }
  }

  return out;
}

function extractSiteTags(site: any): string[] {
  const tagsRaw = site?.tags;
  const list = Array.isArray(tagsRaw)
    ? tagsRaw
    : typeof tagsRaw === "string"
      ? tagsRaw.split(/[,;\n]/g)
      : [];

  const out: string[] = [];
  for (const t of list) {
    const v = String(t || "").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function domainKeyFromUrl(url: string): string | null {
  const raw = String(url || "").trim();
  if (!/^lumen:\/\//i.test(raw)) return null;
  const without = raw.slice("lumen://".length);
  const host = (without.split(/[\/?#]/, 1)[0] || "").trim().toLowerCase();
  if (!host || host === "search") return null;
  return host;
}

function canDebugResult(r: ResultItem): boolean {
  if (!r || r.kind !== "site") return false;
  const domain = domainKeyFromUrl(r.url);
  if (!domain) return false;
  return !!debugByDomain.value[domain];
}

function openDebugForResult(r: ResultItem) {
  const domain = domainKeyFromUrl(r.url);
  const payload = domain ? debugByDomain.value[domain] : null;
  debugTitle.value = domain || r.url || r.id;
  try {
    debugText.value = JSON.stringify(payload ?? null, null, 2);
  } catch {
    debugText.value = String(payload ?? "");
  }
  debugOpen.value = true;
}

function closeDebug() {
  debugOpen.value = false;
}

async function copyDebug() {
  try {
    await navigator.clipboard.writeText(debugText.value || "");
  } catch {
    // ignore
  }
}

function isExactDomainMatch(query: string, domain: string): boolean {
  const q = String(query || "").trim().toLowerCase();
  const d = String(domain || "").trim().toLowerCase();
  if (!q || !d) return false;
  if (q === d) return true;
  if (q + ".lmn" === d) return true;
  if (d.endsWith(".lmn") && d.slice(0, -".lmn".length) === q) return true;
  return false;
}

function clamp01(value: any): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v;
}

function mergeBadges(a: string[] = [], b: string[] = [], limit = 20): string[] {
  const out: string[] = [];
  for (const list of [a, b]) {
    for (const t of list || []) {
      const v = String(t || "").trim();
      if (!v) continue;
      if (out.includes(v)) continue;
      out.push(v);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function mergeAndRankSites(query: string, items: ResultItem[]): ResultItem[] {
  const byDomain = new Map<
    string,
    {
      domain: string;
      result: ResultItem;
      gwScore: number;
    }
  >();

  for (const r of items) {
    if (!r || r.kind !== "site") continue;
    const domain = domainKeyFromUrl(r.url);
    if (!domain) continue;

    const gwScore = Number.isFinite(Number(r.score)) ? Number(r.score) : 0;
    const existing = byDomain.get(domain);
    if (!existing) {
      byDomain.set(domain, {
        domain,
        result: {
          ...r,
          title: r.title || domain,
          url: r.url || `lumen://${domain}`,
          badges: Array.isArray(r.badges) ? r.badges.slice(0, 20) : [],
        },
        gwScore,
      });
      continue;
    }

    existing.gwScore = Math.max(existing.gwScore, gwScore);
    existing.result.thumbUrl = existing.result.thumbUrl || r.thumbUrl;
    existing.result.badges = mergeBadges(
      existing.result.badges || [],
      r.badges || [],
      20,
    );
  }

  const merged = Array.from(byDomain.values()).map((x) => {
    const dnsScore = clamp01(scoreDomainMatch(query, x.domain));
    const exactBoost = isExactDomainMatch(query, x.domain) ? 0.2 : 0;
    const finalScore = clamp01(0.75 * x.gwScore + 0.25 * dnsScore + exactBoost);
    x.result.score = finalScore;
    return x.result;
  });

  merged.sort((a, b) => {
    const da = domainKeyFromUrl(a.url) || "";
    const db = domainKeyFromUrl(b.url) || "";
    const aExact = isExactDomainMatch(query, da) ? 1 : 0;
    const bExact = isExactDomainMatch(query, db) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const as = Number.isFinite(Number(a.score)) ? Number(a.score) : 0;
    const bs = Number.isFinite(Number(b.score)) ? Number(b.score) : 0;
    if (bs !== as) return bs - as;

    const at = (a.badges || []).length;
    const bt = (b.badges || []).length;
    if (bt !== at) return bt - at;

    return da.localeCompare(db);
  });

  return merged;
}

async function searchGateways(
  profileId: string,
  query: string,
  type: SearchType,
  seq: number,
): Promise<ResultItem[]> {
  const gwApi = (window as any).lumen?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") return [];

  const gateways = await loadGatewaysForSearch(profileId);
  if (seq !== searchSeq) return [];
  if (!gateways.length) return [];

  const wantedType = normalizeGatewayType(type);
  const tasks = gateways.map(async (g) => {
    const resp = await gwApi
      .searchPq({
        profileId,
        endpoint: g.endpoint,
        query,
        lang: "en",
        limit: 12,
        offset: 0,
        type: wantedType,
      })
      .catch(() => null);
    if (!resp || resp.ok === false) return [];
    const data = resp.data || {};
    const out: ResultItem[] = [];

    // Site mode: gateway returns `results` with `{ type: 'site', domain, cid, score, tags? }`.
    const siteResults: GatewaySiteSearchResult[] = Array.isArray(data.results)
      ? data.results
      : [];
    const sites = siteResults.filter((s) => {
      const t = String(s?.type || "").trim().toLowerCase();
      const domain = String(s?.domain || "").trim();
      return t === "site" && !!domain;
    });

    if (wantedType === "site" && sites.length > 0) {
      for (const s of sites) {
        const domain = String(s.domain || "").trim();
        if (!domain) continue;
        const cid = String(s?.cid || "").trim();
        const tags = extractSiteTags(s);

        const id = `site:${g.id}:${domain}`;
        out.push({
          id,
          title: domain,
          url: `lumen://${domain}`,
          kind: "site",
          badges: tags.length ? tags.slice(0, 20) : [],
          thumbUrl: cid ? faviconUrlForCid(cid) || undefined : undefined,
          score: Number.isFinite(Number(s?.score)) ? Number(s.score) : 0,
        });

        const key = domain.toLowerCase();
        const prev = debugByDomain.value[key] || { domain: key, sources: [] };
        const next = {
          ...prev,
          sources: [
            ...(Array.isArray(prev.sources) ? prev.sources : []),
            {
              source: "gateway",
              gateway: { id: g.id, endpoint: g.endpoint, regions: g.regions },
              response: {
                ok: true,
                status: resp?.status,
                baseUrl: resp?.baseUrl,
              },
              site: s,
            },
          ],
        };
        debugByDomain.value = { ...debugByDomain.value, [key]: next };
      }
      return out;
    }

    const hits: GatewaySearchHit[] = Array.isArray(data.hits)
      ? data.hits
      : Array.isArray(data.results)
        ? data.results
        : [];

    for (const h of hits) {
      const mapped = mapGatewayHitToResult(h, g, type);
      if (mapped) out.push(mapped);
    }
    return out;
  });

  const lists = await Promise.all(tasks);
  if (seq !== searchSeq) return [];
  const flat = lists.flat();

  const seen = new Set<string>();
  const unique: ResultItem[] = [];
  for (const r of flat) {
    const key = r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique;
}

async function fetchTagsForCid(
  profileId: string,
  cid: string,
  seq: number,
): Promise<{ tags: string[]; debug: any }> {
  const gwApi = (window as any).lumen?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") return { tags: [], debug: { error: "gateway_api_missing" } };
  const gateways = await loadGatewaysForSearch(profileId);
  if (seq !== searchSeq) return { tags: [], debug: { canceled: true } };
  const attempts: any[] = [];
  for (const g of gateways) {
    const resp = await gwApi
      .searchPq({
        profileId,
        endpoint: g.endpoint,
        query: cid,
        lang: "en",
        limit: 1,
        offset: 0,
        type: "",
      })
      .catch(() => null);
    attempts.push({
      gateway: { id: g.id, endpoint: g.endpoint, regions: g.regions },
      ok: !!resp && resp.ok !== false,
      status: resp?.status,
      baseUrl: resp?.baseUrl,
      hasHits: Array.isArray(resp?.data?.hits) ? resp.data.hits.length : undefined,
      ui: resp?.data?.ui ?? null,
      params: resp?.data?.params ?? null,
      analysis: resp?.data?.analysis ?? null,
    });
    if (!resp || resp.ok === false) continue;
    const data = resp.data || {};
    const hits = Array.isArray(data.hits)
      ? data.hits
      : Array.isArray(data.results)
        ? data.results
        : [];
    const first = hits[0];
    if (!first) continue;
    const tags = extractSearchTags(first);
    if (tags.length) return { tags, debug: { attempts, matched: { gatewayId: g.id, endpoint: g.endpoint } } };
  }
  return { tags: [], debug: { attempts } };
}

function buildFastResults(query: string): ResultItem[] {
  const s = String(query || "").trim();
  if (!s) return [];

  const list: ResultItem[] = [];

  if (/^lumen:\/\//i.test(s)) {
    list.push({
      id: `link:${s}`,
      title: "Open Lumen link",
      url: s,
      description: s,
      kind: "link",
    });
  }

  if (isCidLike(s)) {
    list.push({
      id: `ipfs:${s}`,
      title: "IPFS content",
      url: `lumen://ipfs/${s}`,
      description: "Open content by CID",
      kind: "ipfs",
      badges: ["IPFS"],
    });
  }

  if (isTxHash(s)) {
    list.push({
      id: `tx:${s}`,
      title: "Transaction",
      url: `lumen://explorer/tx/${s}`,
      description: "View transaction details",
      kind: "tx",
      badges: ["Explorer"],
    });
  }

  if (isAddress(s)) {
    list.push({
      id: `addr:${s}`,
      title: "Wallet address",
      url: `lumen://explorer/address/${s}`,
      description: "View address activity",
      kind: "address",
      badges: ["Explorer"],
    });
  }

  if (isBlockHeight(s)) {
    list.push({
      id: `block:${s}`,
      title: "Block",
      url: `lumen://explorer/block/${s}`,
      description: "View block details",
      kind: "block",
      badges: ["Explorer"],
    });
  }

  return list;
}

async function runSearch(query: string, type: SearchType) {
  const seq = ++searchSeq;
  const clean = String(query || "").trim();
  const runKey = `${type}::${clean}`;
  if (!clean) {
    touched.value = false;
    loading.value = false;
    errorMsg.value = "";
    results.value = [];
    lastRunKey.value = "";
    return;
  }
  if (runKey === lastRunKey.value && results.value.length) return;
  lastRunKey.value = runKey;

  touched.value = true;
  loading.value = true;
  errorMsg.value = "";
  results.value = [];
  debugByDomain.value = {};

  try {
    const base = buildFastResults(clean);

    const profileId = await getActiveProfileId();

    const domainPromise =
      type === "site" || type === ""
        ? resolveDomainForQuery(clean)
        : Promise.resolve(null);
    const gatewayPromise = profileId
      ? searchGateways(profileId, clean, type, seq)
      : Promise.resolve([]);

    const [bestDomain, gwResults] = await Promise.all([
      domainPromise,
      gatewayPromise,
    ]);
    if (seq !== searchSeq) return;

    let domainTags: string[] = [];
    if (bestDomain?.cid && profileId) {
      const tagRes = await fetchTagsForCid(profileId, bestDomain.cid, seq);
      domainTags = tagRes.tags;
      const key = String(bestDomain.name || "").trim().toLowerCase();
      if (key) {
        const prev = debugByDomain.value[key] || { domain: key, sources: [] };
        const next = {
          ...prev,
          sources: [
            ...(Array.isArray(prev.sources) ? prev.sources : []),
            {
              source: "tags_lookup",
              cid: bestDomain.cid,
              profileId,
              debug: tagRes.debug,
            },
          ],
        };
        debugByDomain.value = { ...debugByDomain.value, [key]: next };
      }
    }
    if (seq !== searchSeq) return;

    if (bestDomain?.name) {
      const url = `lumen://${bestDomain.name}`;
      const favicon = bestDomain.cid ? faviconUrlForCid(bestDomain.cid) : null;
      base.push({
        id: `site:${bestDomain.name}`,
        title: bestDomain.name,
        url,
        thumbUrl: favicon || undefined,
        badges: domainTags.length ? domainTags.slice(0, 20) : [],
        kind: "site",
      });

      const key = String(bestDomain.name || "").trim().toLowerCase();
      if (key) {
        const prev = debugByDomain.value[key] || { domain: key, sources: [] };
        const next = {
          ...prev,
          sources: [
            ...(Array.isArray(prev.sources) ? prev.sources : []),
            {
              source: "dns",
              query: clean,
              candidates: bestDomain.candidates || null,
              picked: { name: bestDomain.name, cid: bestDomain.cid, score: bestDomain.score },
              infoRes: bestDomain.infoRes || null,
            },
          ],
        };
        debugByDomain.value = { ...debugByDomain.value, [key]: next };
      }
    }

    if (!profileId && (type === "image" || type === "")) {
      base.push({
        id: `hint:profile`,
        title: "Create a profile to enable gateway search",
        url: "lumen://home",
        description: "Gateway search requires a profile (wallet + signer).",
        kind: "link",
      });
    }

    const merged = [...base, ...gwResults];

    if (type === "site") {
      const sites = mergeAndRankSites(clean, merged);
      const nonSites = merged.filter((r) => r.kind !== "site");
      results.value = [...sites, ...nonSites];
    } else {
      results.value = merged;
    }
  } catch (e: any) {
    if (seq !== searchSeq) return;
    errorMsg.value = String(e?.message || e || "search_failed");
    results.value = [];
  } finally {
    if (seq !== searchSeq) return;
    loading.value = false;
  }
}

watch(
  () => currentTabUrl?.value,
  (next) => {
    const url = String(next || "").trim();
    if (!url) return;
    const { q: qs, type } = parseSearchUrl(url);
    if (type !== selectedType.value) selectedType.value = type;
    if (qs !== q.value) q.value = qs;
    runSearch(qs, type);
  },
  { immediate: true },
);

const imageResults = computed(() =>
  results.value.filter((r) => r.media === "image" || !!r.thumbUrl),
);
</script>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bg-tertiary);
  padding: 2rem 1.5rem 5rem;
  position: relative;
}

.search-page::before {
  content: "";
  position: fixed;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, var(--primary-a08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.hero {
  margin-top: 15vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  position: relative;
  z-index: 1;
}

.brand {
  font-size: 3.5rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  margin-bottom: 0.5rem;
}

.brand::after {
  content: "Search";
  position: absolute;
  bottom: -1.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  -webkit-text-fill-color: var(--text-tertiary);
}

.search-row {
  width: 100%;
  display: flex;
  justify-content: center;
}

.search-box {
  width: min(820px, 100%);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.85rem 1.25rem;
  border-radius: 999px;
  border: 2px solid transparent;
  background: var(--card-bg);
  box-shadow: var(--shadow-md);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-box:focus-within {
  border-color: var(--ios-blue);
  box-shadow: var(--shadow-focus);
  transform: translateY(-2px);
}

.search-icon {
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-primary);
}

.search-btn {
  border: none;
  background: var(--gradient-primary);
  color: var(--lime-bright);
  font-weight: 700;
  font-size: 0.9375rem;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px var(--primary-a25);
  position: relative;
  overflow: hidden;
}

.search-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--lime-a20) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.search-btn:hover::before {
  opacity: 1;
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 20px var(--primary-a30);
}

.search-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  padding: 0.75rem 1.5rem;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9375rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
}

.pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pill:hover:not(:disabled) {
  border-color: var(--ios-blue);
  color: var(--text-primary);
  background: var(--bg-primary);
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 8px 20px rgba(0, 122, 255, 0.2);
}

.pill.active {
  background: var(--ios-blue);
  border-color: var(--ios-blue);
  color: white;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35), 
              0 2px 8px rgba(0, 122, 255, 0.25);
  transform: translateY(-1px);
}

.results {
  width: min(920px, 100%);
  margin: 3rem auto 0;
  padding: 0 0.5rem 0.5rem;
  position: relative;
  z-index: 1;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0 0.25rem;
}

.meta .txt-xs {
  font-weight: 500;
  font-size: 0.8125rem;
}

.debug-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.debug-toggle:hover {
  color: var(--accent-primary);
  border-color: var(--primary-a30);
  background: var(--primary-a08);
}

.error {
  color: var(--ios-red);
}

.result-list,
.skeleton-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.result-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 1.125rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--border-radius-xl);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-smooth);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.result-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--gradient-brand);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.result-card:hover::before {
  opacity: 1;
}

.result-card:hover {
  transform: translateY(-4px) translateX(4px);
  border-color: var(--ios-blue);
  box-shadow: var(--shadow-primary);
  background: var(--card-bg);
}

.result-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--border-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-secondary);
  color: var(--ios-blue);
  flex: 0 0 auto;
  overflow: hidden;
  border: var(--border-width) solid var(--border-color);
  transition: all var(--transition-smooth);
}

.result-card:hover .result-icon {
  transform: scale(1.05) rotate(5deg);
  box-shadow: 0 4px 12px var(--primary-a20);
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.image-card {
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  border-radius: var(--border-radius-xl);
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-smooth);
}

.image-card:hover {
  transform: translateY(-6px) scale(1.02);
  border-color: var(--primary-a40);
  box-shadow: 0 16px 32px var(--primary-a15);
}

.image-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: var(--bg-secondary);
}

.image-fallback {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.image-meta {
  padding: 0.75rem 0.75rem 0.9rem;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-height: 6.5rem;
  overflow: auto;
}

.image-badge {
  font-size: 0.6875rem;
  line-height: 1;
  padding: 0.35rem 0.5rem;
  border-radius: 999px;
  background: rgba(45, 95, 79, 0.08);
  color: var(--accent-primary);
  border: 1px solid rgba(45, 95, 79, 0.16);
  white-space: nowrap;
}

.result-body {
  flex: 1 1 auto;
  min-width: 0;
}

.result-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.01em;
  transition: color 0.2s ease;
}

.result-card:hover .result-title {
  color: var(--accent-primary);
}

.result-url {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  color: var(--accent-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  opacity: 0.85;
  transition: opacity 0.2s ease;
}

.result-card:hover .result-url {
  opacity: 1;
}

.result-desc {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-open {
  color: var(--text-secondary);
  margin-top: 0.15rem;
  flex: 0 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.5;
}

.debug-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  margin-top: 0.05rem;
  color: var(--text-secondary, #64748b);
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  opacity: 0.75;
  transition: all 0.2s ease;
}

.debug-btn:hover {
  opacity: 1;
  color: var(--accent-primary);
  border-color: var(--primary-a20);
  background: var(--primary-a08);
}

.result-card:hover .result-open {
  color: var(--accent-primary);
  transform: translate(4px, -4px) scale(1.1);
  opacity: 1;
}

.badges {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: linear-gradient(
    135deg,
    var(--primary-a10) 0%,
    var(--lime-a10) 100%
  );
  color: var(--accent-primary);
  border: 1px solid var(--primary-a20);
  transition: all 0.2s ease;
}

.result-card:hover .badge {
  background: linear-gradient(
    135deg,
    var(--primary-a15) 0%,
    var(--lime-a15) 100%
  );
  border-color: var(--primary-a30);
  transform: translateY(-1px);
}

.badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--primary-a08);
  color: var(--accent-primary);
  border: 1px solid var(--primary-a20);
}

.empty {
  padding: 1.2rem 1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) dashed var(--border-color);
  background: var(--card-bg);
  text-align: center;
}

.empty-title {
  font-weight: 700;
  color: var(--text-primary);
}

.empty-subtitle {
  margin-top: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.skeleton-item {
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  padding: 0.95rem 1rem;
}

.skeleton-title,
.skeleton-url,
.skeleton-desc {
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.22);
}

.skeleton-title {
  height: 1.05rem;
  width: 55%;
}

.skeleton-url {
  height: 0.8rem;
  width: 38%;
  margin-top: 0.55rem;
}

.skeleton-desc {
  height: 2.1rem;
  width: 75%;
  margin-top: 0.55rem;
}

.debug-modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.debug-panel {
  width: min(980px, 96vw);
  max-height: 80vh;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 50px rgba(2, 6, 23, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(255, 255, 255, 0.9);
}

.debug-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.debug-actions {
  display: inline-flex;
  gap: 0.5rem;
  flex: 0 0 auto;
}

.debug-action {
  padding: 0.35rem 0.65rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  font-size: 0.8rem;
  color: #334155;
}

.debug-action:hover {
  border-color: var(--primary-a30);
  color: var(--accent-primary);
  background: var(--primary-a08);
}

.debug-pre {
  padding: 0.9rem;
  margin: 0;
  overflow: auto;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #0f172a;
}

@media (max-width: 640px) {
  .hero {
    margin-top: 12vh;
  }
  .brand {
    font-size: 2.1rem;
  }
  .search-btn {
    display: none;
  }
}
</style>
