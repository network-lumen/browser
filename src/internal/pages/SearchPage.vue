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
            <ArrowUpRight :size="18" class="result-open" />
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
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
});

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
  const rec = records.find(
    (r: any) => String(r?.key || "").toLowerCase() === "cid",
  );
  const value = String(rec?.value ?? "").trim();
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

async function resolveDomainForQuery(
  query: string,
): Promise<{ name: string; cid: string | null; score: number } | null> {
  const dnsApi = (window as any).lumen?.dns;
  if (!dnsApi || typeof dnsApi.getDomainInfo !== "function") return null;

  const cands = buildDomainCandidates(query);
  if (!cands.length) return null;

  let best: { name: string; cid: string | null; score: number } | null = null;

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
      best = { name, cid, score };
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
    const hits = Array.isArray(data.hits)
      ? data.hits
      : Array.isArray(data.results)
        ? data.results
        : [];
    const out: ResultItem[] = [];
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
): Promise<string[]> {
  const gwApi = (window as any).lumen?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") return [];
  const gateways = await loadGatewaysForSearch(profileId);
  if (seq !== searchSeq) return [];
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
    if (tags.length) return tags;
  }
  return [];
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
      domainTags = await fetchTagsForCid(profileId, bestDomain.cid, seq);
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
        badges: domainTags.length ? domainTags.slice(0, 6) : [],
        kind: "site",
      });
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
    results.value = merged;
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
  background: linear-gradient(180deg, #f8fafb 0%, #f0f4f8 100%);
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
  color: var(--text-tertiary, #94a3b8);
  -webkit-text-fill-color: var(--text-tertiary, #94a3b8);
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
  background: var(--bg-primary, #ffffff);
  box-shadow:
    0 8px 24px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(226, 232, 240, 0.6);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-box:focus-within {
  border-color: var(--primary-a30);
  box-shadow:
    0 12px 32px var(--primary-a15),
    0 0 0 4px var(--lime-a10);
  transform: translateY(-2px);
}

.search-icon {
  color: var(--text-secondary, #64748b);
  flex: 0 0 auto;
}

.search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-primary, #1e293b);
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
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #64748b);
  padding: 0.625rem 1.125rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pill:hover:not(:disabled) {
  border-color: var(--primary-a40);
  color: var(--text-primary, #1e293b);
  background: rgba(45, 95, 79, 0.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--primary-a10);
}

.pill.active {
  background: linear-gradient(
    135deg,
    var(--primary-a15) 0%,
    var(--primary-a10) 100%
  );
  border-color: var(--primary-a50);
  color: var(--accent-primary);
  font-weight: 600;
  box-shadow:
    0 4px 12px var(--primary-a15),
    inset 0 1px 2px var(--lime-a20);
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

.error {
  color: #b91c1c;
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
  border-radius: 16px;
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  text-align: left;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
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
  border-color: var(--primary-a30);
  box-shadow:
    0 12px 28px var(--primary-a15),
    0 0 0 1px var(--lime-a10);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 1) 0%,
    var(--primary-a08) 100%
  );
}

.result-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    var(--primary-a10) 0%,
    var(--lime-a10) 100%
  );
  color: var(--accent-primary);
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--primary-a15);
  transition: all 0.3s ease;
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
  border: 1.5px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  background: var(--bg-secondary, #f8fafc);
}

.image-fallback {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #64748b);
  background: var(--bg-secondary, #f8fafc);
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
  color: var(--text-primary, #1e293b);
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
  color: var(--text-secondary, #64748b);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-open {
  color: var(--text-secondary, #64748b);
  margin-top: 0.15rem;
  flex: 0 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.5;
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
  border-radius: 14px;
  border: 1px dashed var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  text-align: center;
}

.empty-title {
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.empty-subtitle {
  margin-top: 0.35rem;
  color: var(--text-secondary, #64748b);
  font-size: 0.9rem;
}

.skeleton-item {
  border-radius: 14px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
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
