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
            :disabled="loading"
          >
            Search
          </button>
        </div>
      </div>

      <div class="tabs">
        <button
          class="pill pill-sites"
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
          :class="{ active: selectedType === 'image' }"
          @click="setType('image')"
        >
          <Image :size="16" />
          Images
        </button>
        <button
          class="pill"
          type="button"
          :class="{ active: selectedType === 'all' }"
          @click="setType('all')"
        >
          <Compass :size="16" />
          Explore everything
        </button>
      </div>
    </section>

    <section v-if="touched" class="results">
      <div class="meta">
        <div class="txt-xs color-gray-blue">
          <span v-if="!loading">
            <template v-if="page > 1">Page {{ page }} | </template>
            <template v-if="results.length">About {{ results.length }} results</template>
            <template v-else>No results</template>
          </span>
        </div>
        <div v-if="errorMsg" class="txt-xs error">{{ errorMsg }}</div>
      </div>

      <ul v-if="loading" class="skeleton-list">
        <li v-for="i in 5" :key="i" class="skeleton-item">
          <div class="skeleton-icon"></div>
          <div class="skeleton-content">
            <div class="skeleton-title"></div>
            <div class="skeleton-url"></div>
            <div class="skeleton-desc"></div>
          </div>
        </li>
      </ul>

      <div v-else-if="!results.length" class="empty-state">
        <div class="empty-icon">
          <Search :size="48" />
        </div>
        <div class="empty-content">
          <h3 class="empty-title">No results found</h3>
          <p class="empty-subtitle">
            <template v-if="q.trim()">
              We couldn't find anything matching "<strong>{{ q }}</strong>"
            </template>
            <template v-else-if="selectedType === 'site'">
              We couldn't find any sites yet.
            </template>
            <template v-else-if="selectedType === 'image'">
              We couldn't find any images yet.
            </template>
            <template v-else-if="selectedType === 'all'">
              We couldn't find any content yet.
            </template>
            <template v-else>
              We couldn't find anything.
            </template>
          </p>
          <div class="empty-suggestions">
            <span class="suggestion-label">Try:</span>
            <ul class="suggestion-list">
              <li>Using different keywords</li>
              <li>Searching for a domain (e.g., <code>example.lmn</code>)</li>
              <li>Entering a CID, transaction hash, or address directly</li>
            </ul>
          </div>
        </div>
      </div>

      <div v-else-if="selectedType === 'image'" class="image-grid">
        <div
          v-for="(r, idx) in imageResults"
          :key="r.id"
          class="image-card"
        >
          <button
            type="button"
            class="image-save-btn"
            :class="{ saved: isPinnedImage(r) }"
            :title="isPinnedImage(r) ? 'Remove from local save' : 'Save to local'"
            @click.stop="togglePinImage(r)"
          >
            <Bookmark
              :size="16"
              :fill="isPinnedImage(r) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            type="button"
            class="image-card-btn"
            @click="openResult(r)"
            :title="r.url"
          >
            <div
              v-if="isSearchImageThumb(r) && !brokenThumbs[r.id]"
              class="safe-thumb"
              :class="{ blurred: shouldBlurThumb(r) }"
              @click="onCompactThumbClick(r, $event)"
            >
              <button
                v-if="showHideIcon(r)"
                type="button"
                class="safe-thumb-hide"
                title="Hide content"
                @click.stop.prevent="hideThumb(r)"
              >
                <EyeOff :size="16" />
              </button>
              <img
                class="image-thumb"
                :key="`${r.id}:${corsAttrForThumb(r) || 'no-cors'}`"
                :src="r.thumbUrl"
                alt=""
                :loading="imageThumbLoading(idx)"
                decoding="async"
                :fetchpriority="imageThumbFetchPriority(idx)"
                :crossorigin="corsAttrForThumb(r)"
                @load="onThumbLoad(r, $event)"
                @error="onThumbError(r)"
              />
              <div v-if="shouldBlurThumb(r)" class="safe-thumb-overlay">
                <div
                  class="safe-thumb-reveal"
                  @click.stop.prevent="revealThumb(r)"
                >
                  {{ thumbBlurNoticeText(r) }}
                </div>
              </div>
            </div>
            <div v-else-if="isSearchImageThumb(r) && brokenThumbs[r.id]" class="image-fallback">
              <Image :size="18" />
            </div>
            <img
              v-else-if="r.thumbUrl"
              class="image-thumb"
              :src="r.thumbUrl"
              alt=""
              :loading="imageThumbLoading(idx)"
              decoding="async"
              :fetchpriority="imageThumbFetchPriority(idx)"
            />
            <div v-else class="image-fallback">
              <Image :size="18" />
            </div>
          </button>
          <div class="image-meta">
            <div v-if="r.badges?.length" class="image-tags">
              <span
                v-for="(b, bIdx) in r.badges.slice(0, 4)"
                :key="`${r.id}:${b}`"
                class="image-badge"
                >{{ b }}</span
              >
              <span
                v-if="r.badges.length > 4"
                class="image-badge-more"
                :title="r.badges.slice(4).join(', ')"
                >+{{ r.badges.length - 4 }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <ul v-else class="result-list">
        <li v-for="r in results" :key="r.id" class="result-item">
          <button 
            class="result-card" 
            :class="[
              `result-${r.kind}`,
              r.media ? `media-${r.media}` : '',
              r.fileKind ? `file-${r.fileKind}` : '',
              selectedType === 'all' && r.media === 'image' ? 'explore-image' : ''
            ]"
            type="button" 
            @click="openResult(r)"
          >
            <div class="result-icon" :class="`icon-${r.kind}`">
              <div
                v-if="isSearchImageThumb(r) && !brokenThumbs[r.id]"
                class="safe-thumb safe-thumb--compact"
                :class="{ blurred: shouldBlurThumb(r) }"
                @click="onCompactThumbClick(r, $event)"
              >
                <button
                  v-if="showHideIcon(r)"
                  type="button"
                  class="safe-thumb-hide safe-thumb-hide--compact"
                  title="Hide content"
                  @click.stop.prevent="hideThumb(r)"
                >
                  <EyeOff :size="14" />
                </button>
                <img
                  class="thumb"
                  :key="`${r.id}:${corsAttrForThumb(r) || 'no-cors'}`"
                  :src="r.thumbUrl"
                  alt=""
                  :crossorigin="corsAttrForThumb(r)"
                  @load="onThumbLoad(r, $event)"
                  @error="onListThumbError(r)"
                />
              </div>
              <img
                v-else-if="r.thumbUrl && !brokenThumbs[r.id]"
                class="thumb"
                :src="r.thumbUrl"
                alt=""
                @error="onFaviconError(r)"
              />
              <component v-else :is="iconFor(r)" :size="20" />
            </div>
            <div class="result-body">
              <div class="result-header">
                <span
                  v-if="r.kind !== 'site'"
                  class="result-type-badge"
                  :class="typeBadgeClass(r)"
                >
                  {{ typeBadgeLabel(r) }}
                </span>
                <span
                  v-if="r.uniqueViews7d != null"
                  class="result-metric"
                  :title="`Unique views (7d): ${r.uniqueViews7d}`"
                >
                  <Eye :size="14" />
                  {{ formatCompactCount(r.uniqueViews7d) }} views
                </span>
              </div>
              <div
                v-if="displayTitle(r)"
                class="result-title"
                :class="{ 'result-title--placeholder': isNoTitlePlaceholder(r) }"
              >
                {{ displayTitle(r) }}
              </div>
              <div
                v-if="r.kind === 'site' && r.site?.domain"
                class="site-domain mono"
                :title="r.site.domain"
              >
                <Globe :size="14" />
                {{ r.site.domain }}
              </div>
              <div v-if="shouldShowResultUrl(r)" class="result-url mono">{{ r.url }}</div>
              <pre
                v-if="displayTextPreviewList(r)"
                class="result-desc result-desc--code"
                :class="{ 'result-desc--placeholder': isNoTextPreviewPlaceholder(r) }"
                :title="displayTextPreviewHover(r)"
                v-text="displayTextPreviewList(r)"
              ></pre>
              <div
                v-else-if="displayDescription(r)"
                class="result-desc"
                :class="{ 'result-desc--placeholder': isNoDescriptionPlaceholder(r) }"
                :title="displayDescription(r)"
              >
                {{ displayDescription(r) }}
              </div>
              <div v-if="r.badges?.length" class="badges">
                <span
                  v-for="b in visibleBadges(r)"
                  :key="`${r.id}:${b}`"
                  class="badge"
                  >{{ b }}</span
                >
                <span
                  v-if="hiddenBadges(r).length"
                  class="badge badge-more"
                  :title="hiddenBadges(r).join(', ')"
                  >+{{ hiddenBadges(r).length }}</span
                >
              </div>
            </div>
            <ArrowUpRight :size="18" class="result-open" />
          </button>
        </li>
      </ul>

      <div v-if="showPager" class="pagination-bar">
        <button
          class="page-btn"
          type="button"
          :disabled="loading || page === 1"
          @click="gotoPage(1)"
          title="First page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
        <button
          class="page-btn"
          type="button"
          :disabled="loading || page === 1"
          @click="prevPage"
          title="Previous page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div class="page-numbers">
          <template v-for="(p, idx) in pageNumbers" :key="idx">
            <span v-if="p === '...'" class="page-ellipsis">...</span>
            <button
              v-else
              class="page-num"
              :class="{ active: page === p }"
              :disabled="loading"
              @click="gotoPage(p as number)"
            >
              {{ p }}
            </button>
          </template>
        </div>

        <button
          class="page-btn"
          type="button"
          :disabled="loading || !gatewayHasMore"
          @click="nextPage"
          title="Next page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          v-if="knownTotalPages != null && knownTotalPages > 1"
          class="page-btn"
          type="button"
          :disabled="loading || page === knownTotalPages"
          @click="gotoPage(knownTotalPages)"
          title="Last page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </button>

        <span class="page-info">{{ pageInfoText }}</span>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import {
  ArrowUpRight,
  Bookmark,
  Compass,
  Eye,
  EyeOff,
  Globe,
  Hash,
  Image,
  Layers,
  Search,
  Wallet,
  FileText,
  FileCode,
  FileType,
  File,
  FileQuestion,
  BookOpen,
  Box,
  ExternalLink,
  Sparkles,
} from "lucide-vue-next";
import { localIpfsGatewayBase } from "../services/contentResolver";
import { appSettingsState } from "../services/appSettings";
import { useToast } from "../../composables/useToast";
import {
  getThumbSafetyService,
  blockedCategories,
  isBlockedBySettings,
  isGreyZoneByTags,
  shouldSkipAnalysisAndRenderClear,shouldBlurImmediatelyByTags,
  type ThumbSafetyBlockedCategory,
  type ThumbSafetyScores,
} from "./searchSafety/thumbSafetyService";

const toast = useToast();

type SearchType = "site" | "image" | "all";
type ResultKind = "site" | "ipfs" | "tx" | "block" | "address" | "link";
type ResultItem = {
  id: string;
  title: string;
  url: string;
  description?: string;
  kind: ResultKind;
  badges?: string[];
  thumbUrl?: string;
  media?: "image" | "unknown";
  fileKind?: "image" | "pdf" | "html" | "txt" | "epub" | "docx" | "unknown";
  score?: number;
  uniqueViews7d?: number;
  viewCid?: string;
  gateway?: { id: string; endpoint: string };
  site?: {
    domain?: string | null;
    cid?: string | null;
    entryCid?: string | null;
    entryPath?: string | null;
    wallet?: string | null;
    owned?: boolean;
  };
};

type GatewayView = {
  id: string;
  endpoint: string;
  regions?: string[];
};

const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabRefresh = inject<any>("currentTabRefresh", null);
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
const page = ref(1);
const activeQuery = ref("");
const activeType = ref<SearchType>("site");
const gatewayHasMore = ref(false);
const gatewayPageSize = 12;

const lastRunKey = ref("");
let searchSeq = 0;

const gatewaysCache = ref<{ at: number; items: GatewayView[] }>({
  at: 0,
  items: [],
});

const pinnedCids = ref<string[]>([]);

// SearchPage-only: safe-by-default thumbnail rendering for image results.
const thumbSafety = getThumbSafetyService();
const revealedThumbIds = ref<Record<string, true>>({});
const grantedClearThumbIds = ref<Record<string, true>>({});
const thumbSafetyById = ref<
  Record<string, { hash: string; scores: ThumbSafetyScores }>
>({});
const thumbAnalyzeStarted = ref<Record<string, true>>({});
const thumbAnalyzeUrlById = ref<Record<string, string>>({});
const thumbCorsDisabledById = ref<Record<string, true>>({});
const hiddenThumbHashes = ref<Record<string, true>>({});
const hiddenThumbUrls = ref<Record<string, true>>({});

function isSearchImageThumb(r: ResultItem): boolean {
  return r.media === "image" && !!r.thumbUrl;
}

function corsAttrForThumb(r: ResultItem): string | null {
  if (!isSearchImageThumb(r)) return null;
  if (!isGreyZoneByTags(r.badges || [])) return null;
  if (thumbCorsDisabledById.value[r.id]) return null;
  return "anonymous";
}

const IMAGE_EAGER_COUNT = 18;
const IMAGE_HIGH_PRIORITY_COUNT = 8;

function imageThumbLoading(idx: number): "eager" | "lazy" {
  return idx < IMAGE_EAGER_COUNT ? "eager" : "lazy";
}

function imageThumbFetchPriority(idx: number): "high" | "auto" {
  return idx < IMAGE_HIGH_PRIORITY_COUNT ? "high" : "auto";
}

function blockedCatLabel(cat: ThumbSafetyBlockedCategory): string {
  switch (cat) {
    case "sexual":
      return "sexual content";
    case "violence":
      return "violence / gore";
    case "disturbing":
      return "disturbing imagery";
  }
}

function thumbBlurNoticeText(r: ResultItem): string {
  if (!isSearchImageThumb(r)) {
    return "This image may contain sensitive content. Click to reveal.";
  }
  const url = r.thumbUrl || "";
  const fromId = thumbSafetyById.value[r.id]?.scores || null;
  const fromCache = url ? thumbSafety.getCachedScoresByUrl(url)?.scores || null : null;
  const scores = fromId || fromCache;
  if (!scores) return "This image may contain sensitive content. Click to reveal.";

  const cats = blockedCategories(scores, appSettingsState.value);
  if (!cats.length) return "This image may contain sensitive content. Click to reveal.";
  const labels = cats.map(blockedCatLabel);
  if (labels.length === 1) {
    return `This image may contain ${labels[0]}. Click to reveal.`;
  }
  if (labels.length === 2) {
    return `This image may contain ${labels[0]} or ${labels[1]}. Click to reveal.`;
  }
  return `This image may contain ${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}. Click to reveal.`;
}

function shouldBlurThumb(r: ResultItem): boolean {
  if (!isSearchImageThumb(r)) return false;

  const thumbUrl = r.thumbUrl || "";
  const cached = thumbUrl ? thumbSafety.getCachedScoresByUrl(thumbUrl) : null;
  const hash = thumbSafetyById.value[r.id]?.hash || cached?.hash || "";

  if (hash && hiddenThumbHashes.value[hash]) return true;
  if (r.url && hiddenThumbUrls.value[r.url]) return true;
  // Back-compat: older hides stored the thumbnail URL.
  if (thumbUrl && hiddenThumbUrls.value[thumbUrl]) return true;
  if (revealedThumbIds.value[r.id]) return false;
  if (hash && thumbSafety.isRevealedForSession(hash)) return false;

  if (shouldSkipAnalysisAndRenderClear(r.badges || [])) return false;
  if (grantedClearThumbIds.value[r.id]) return false;

  return true;
}


function thumbHashFor(r: ResultItem): string {
  if (!isSearchImageThumb(r)) return "";
  const url = r.thumbUrl || "";
  return (
    thumbSafetyById.value[r.id]?.hash ||
    (url ? thumbSafety.getCachedHashForUrl(url) : null) ||
    ""
  );
}

function showHideIcon(r: ResultItem): boolean {
  if (!isSearchImageThumb(r)) return false;
  if (shouldBlurThumb(r)) return false;
  if (!isGreyZoneByTags(r.badges || [])) return false;
  return true;
}

function revealThumb(r: ResultItem): void {
  if (!isSearchImageThumb(r)) return;
  const thumbUrl = r.thumbUrl || "";
  const key = String(r.url || "").trim();
  const h = thumbHashFor(r);
  if (h && hiddenThumbHashes.value[h]) {
    const next = { ...hiddenThumbHashes.value };
    delete next[h];
    hiddenThumbHashes.value = next;
    thumbSafety.unhideHash(h);
  }
  if (key && hiddenThumbUrls.value[key]) {
    const next = { ...hiddenThumbUrls.value };
    delete next[key];
    hiddenThumbUrls.value = next;
    thumbSafety.unhideUrl(key);
  }
  if (thumbUrl && hiddenThumbUrls.value[thumbUrl]) {
    const next = { ...hiddenThumbUrls.value };
    delete next[thumbUrl];
    hiddenThumbUrls.value = next;
    thumbSafety.unhideUrl(thumbUrl);
  }
  revealedThumbIds.value = { ...revealedThumbIds.value, [r.id]: true };

  const hash =
    thumbSafetyById.value[r.id]?.hash ||
    (thumbUrl ? thumbSafety.getCachedHashForUrl(thumbUrl) : null) ||
    "";
  if (hash) thumbSafety.markRevealedForSession(hash);
}

function hideThumb(r: ResultItem): void {
  if (!isSearchImageThumb(r)) return;
  const key = String(r.url || "").trim();
  const h = thumbHashFor(r);
  if (h) {
    hiddenThumbHashes.value = { ...hiddenThumbHashes.value, [h]: true };
    thumbSafety.hideHash(h);
  } else {
    if (!key) return;
    hiddenThumbUrls.value = { ...hiddenThumbUrls.value, [key]: true };
    thumbSafety.hideUrl(key);
  }
}

function onCompactThumbClick(r: ResultItem, ev: MouseEvent): void {
  if (!shouldBlurThumb(r)) return;
  ev.preventDefault();
  ev.stopPropagation();
  revealThumb(r);
}

function maybeApplyCachedDecision(r: ResultItem): void {
  if (!isSearchImageThumb(r)) return;
  if (shouldSkipAnalysisAndRenderClear(r.badges || [])) return;
  const url = r.thumbUrl || "";
  if (!url) return;

  const cached = thumbSafety.getCachedScoresByUrl(url);
  if (!cached) return;

  thumbSafetyById.value = {
    ...thumbSafetyById.value,
    [r.id]: { hash: cached.hash, scores: cached.scores },
  };

  if (
    thumbSafety.isRevealedForSession(cached.hash) ||
    revealedThumbIds.value[r.id]
  ) {
    grantedClearThumbIds.value = { ...grantedClearThumbIds.value, [r.id]: true };
    return;
  }

  if (!isBlockedBySettings(cached.scores, appSettingsState.value)) {
    grantedClearThumbIds.value = { ...grantedClearThumbIds.value, [r.id]: true };
  }
}

function scheduleThumbAnalysis(r: ResultItem, imgEl: HTMLImageElement): void {
  if (!isSearchImageThumb(r)) return;
  if (shouldSkipAnalysisAndRenderClear(r.badges || [])) return;

  const url = r.thumbUrl || "";
  if (!url) return;

  if (thumbAnalyzeStarted.value[r.id]) return;
  thumbAnalyzeStarted.value = { ...thumbAnalyzeStarted.value, [r.id]: true };
  thumbAnalyzeUrlById.value = { ...thumbAnalyzeUrlById.value, [r.id]: url };

  const run = async () => {
    try {
      const bitmap = await createImageBitmap(imgEl);
      const res = await thumbSafety.analyzeUrlWithBitmap(url, bitmap);
      if (!res) return;
      if (thumbAnalyzeUrlById.value[r.id] !== url) return;

      thumbSafetyById.value = {
        ...thumbSafetyById.value,
        [r.id]: { hash: res.hash, scores: res.scores },
      };

      const key = String(r.url || "").trim();
      if ((key && hiddenThumbUrls.value[key]) || hiddenThumbUrls.value[url]) {
        hiddenThumbHashes.value = { ...hiddenThumbHashes.value, [res.hash]: true };
        thumbSafety.hideHash(res.hash);
        const next = { ...hiddenThumbUrls.value };
        if (key) delete next[key];
        delete next[url];
        hiddenThumbUrls.value = next;
        if (key) thumbSafety.unhideUrl(key);
        thumbSafety.unhideUrl(url);
      }

      if (revealedThumbIds.value[r.id]) thumbSafety.markRevealedForSession(res.hash);

      if (
        thumbSafety.isRevealedForSession(res.hash) ||
        revealedThumbIds.value[r.id]
      ) {
        grantedClearThumbIds.value = { ...grantedClearThumbIds.value, [r.id]: true };
        return;
      }

      if (!isBlockedBySettings(res.scores, appSettingsState.value)) {
        grantedClearThumbIds.value = { ...grantedClearThumbIds.value, [r.id]: true };
      }
    } catch {
      // Keep blurred on any analysis failure (safe-by-default).
    }
  };

  const ric = (window as any)?.requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;
  if (typeof ric === "function") {
    ric(() => void run(), { timeout: 1500 });
  } else {
    setTimeout(() => void run(), 0);
  }
}

function onThumbLoad(r: ResultItem, ev: Event): void {
  if (!isSearchImageThumb(r)) return;
  if (!isGreyZoneByTags(r.badges || [])) return;

  maybeApplyCachedDecision(r);
  if (grantedClearThumbIds.value[r.id]) return;

  const imgEl = ev.target as HTMLImageElement | null;
  if (!imgEl || !imgEl.complete || imgEl.naturalWidth <= 0) return;
  scheduleThumbAnalysis(r, imgEl);
}

function onThumbError(r: ResultItem): void {
  // If the gateway doesn't support CORS, retry without it (thumbnail stays blurred).
  if (!isSearchImageThumb(r)) return;
  if (corsAttrForThumb(r) === "anonymous") {
    thumbCorsDisabledById.value = { ...thumbCorsDisabledById.value, [r.id]: true };
    return;
  }
  markThumbBroken(r.id);
}

function onListThumbError(r: ResultItem): void {
  if (!isSearchImageThumb(r)) {
    markThumbBroken(r.id);
    return;
  }
  if (corsAttrForThumb(r) === "anonymous") {
    thumbCorsDisabledById.value = { ...thumbCorsDisabledById.value, [r.id]: true };
    return;
  }
  markThumbBroken(r.id);
}

function extractCidFromUrl(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.startsWith("lumen://ipfs/")) {
    const cid = url
      .slice("lumen://ipfs/".length)
      .replace(/^\/+/, "")
      .split(/[\/\?#]/, 1)[0];
    return cid || null;
  }
  return null;
}

function parseLumenIpfsUrl(url: string): { cid: string; subpath: string } | null {
  const raw = String(url || "").trim();
  const m = raw.match(/^lumen:\/\/ipfs\/([^\/?#]+)(\/[^?#]*)?$/i);
  if (!m) return null;
  const cid = String(m[1] || "").trim();
  const subpath = String(m[2] || "")
    .replace(/^\/+/, "")
    .trim();
  if (!cid) return null;
  return { cid, subpath };
}

function isHtmlFileName(name: string): boolean {
  const n = String(name || "").trim().toLowerCase();
  return n.endsWith(".html") || n.endsWith(".htm");
}

function pickBestHtmlAtLevel(entries: any[]): string | null {
  const files = (Array.isArray(entries) ? entries : []).filter(
    (e) => e && String(e.type || "") === "file" && String(e.name || ""),
  );
  if (!files.length) return null;

  const names = files.map((e) => String(e.name || "")).filter(Boolean);
  const index =
    names.find((n) => n.toLowerCase() === "index.html") ||
    names.find((n) => n.toLowerCase() === "index.htm") ||
    null;
  if (index) return index;

  const anyHtml = names.find((n) => isHtmlFileName(n)) || null;
  return anyHtml;
}

async function resolveHtmlEntryForCidRoot(
  cid: string,
): Promise<{ isDir: boolean; entryPath: string | null }> {
  const api: any = (window as any).lumen || null;
  if (!api || typeof api.ipfsLs !== "function") return { isDir: false, entryPath: null };

  const root = String(cid || "").trim();
  if (!root) return { isDir: false, entryPath: null };

  const resRoot = await api.ipfsLs(root).catch(() => null);
  const rootEntries = Array.isArray(resRoot?.entries) ? resRoot.entries : [];
  const isDir = rootEntries.length > 0;
  if (!isDir) return { isDir: false, entryPath: null };

  const bestAtRoot = pickBestHtmlAtLevel(rootEntries);
  if (bestAtRoot) return { isDir: true, entryPath: bestAtRoot };

  const visited = new Set<string>();
  const queue: Array<{ prefix: string; depth: number }> = [];

  for (const e of rootEntries) {
    if (!e || String(e.type || "") !== "dir") continue;
    const name = String(e.name || "").trim();
    if (!name) continue;
    queue.push({ prefix: name, depth: 1 });
    visited.add(name.toLowerCase());
    if (queue.length >= 15) break;
  }

  const maxDepth = 2;
  const maxDirs = 25;
  let processedDirs = 0;

  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    processedDirs += 1;
    if (processedDirs > maxDirs) break;

    const resDir = await api.ipfsLs(`${root}/${cur.prefix}`).catch(() => null);
    const dirEntries = Array.isArray(resDir?.entries) ? resDir.entries : [];
    const best = pickBestHtmlAtLevel(dirEntries);
    if (best) return { isDir: true, entryPath: `${cur.prefix}/${best}` };

    if (cur.depth >= maxDepth) continue;

    for (const e of dirEntries) {
      if (!e || String(e.type || "") !== "dir") continue;
      const name = String(e.name || "").trim();
      if (!name) continue;
      const nextPrefix = `${cur.prefix}/${name}`;
      const key = nextPrefix.toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ prefix: nextPrefix, depth: cur.depth + 1 });
      if (queue.length >= 50) break;
    }
  }

  return { isDir: true, entryPath: null };
}

function parseHtmlHeadMeta(html: string): { title: string | null; description: string | null } {
  const raw = String(html || "");
  if (!raw) return { title: null, description: null };

  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleRaw = titleMatch ? String(titleMatch[1] || "") : "";
  const title = titleRaw.replace(/\s+/g, " ").trim();

  const metaMatch = raw.match(
    /<meta[^>]+name=[\"']description[\"'][^>]+content=[\"']([^\"']*)[\"'][^>]*>/i,
  );
  const descRaw = metaMatch ? String(metaMatch[1] || "") : "";
  const description = descRaw.replace(/\s+/g, " ").trim();

  const clip = (v: string, max: number) => {
    const s = String(v || "").replace(/\s+/g, " ").trim();
    if (!s) return null;
    if (s.length <= max) return s;
    return `${s.slice(0, max).trimEnd()}…`;
  };

  return {
    title: clip(title, 120),
    description: clip(description, 250),
  };
}

async function fetchHtmlHeadMetaForCidPath(
  cid: string,
  entryPath: string,
  { timeoutMs = 2500, maxBytes = 64 * 1024 } = {},
): Promise<{ title: string | null; description: string | null }> {
  const c = String(cid || "").trim();
  const p = String(entryPath || "").trim();
  if (!c || !p) return { title: null, description: null };

  const encoded = encodeUrlPath(p);
  const url = encoded
    ? `${localIpfsGatewayBase()}/ipfs/${c}/${encoded}`
    : `${localIpfsGatewayBase()}/ipfs/${c}`;

  const httpGet = (window as any).lumen?.httpGet;
  const range = `bytes=0-${Math.max(0, Math.floor(maxBytes) - 1)}`;

  try {
    if (typeof httpGet === "function") {
      const res = await httpGet(url, { timeout: timeoutMs, headers: { Range: range } }).catch(
        () => null,
      );
      const bytes = res && Array.isArray(res.data) ? new Uint8Array(res.data) : null;
      if (bytes && bytes.byteLength) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        return parseHtmlHeadMeta(text);
      }
      return { title: null, description: null };
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, { headers: { Range: range }, signal: controller.signal });
    clearTimeout(t);
    if (!resp.ok) return { title: null, description: null };
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return parseHtmlHeadMeta(text);
  } catch {
    return { title: null, description: null };
  }
}

async function enrichFastCidResult(
  base: ResultItem[],
  cid: string,
  seq: number,
): Promise<void> {
  const c = String(cid || "").trim();
  if (!c) return;
  const item = base.find((r) => r && r.kind === "ipfs" && r.id === `ipfs:${c}`);
  if (!item) return;

  const resolved = await resolveHtmlEntryForCidRoot(c).catch(() => null);
  if (seq !== searchSeq) return;
  if (!resolved || !resolved.isDir || !resolved.entryPath) return;

  const encoded = encodeUrlPath(resolved.entryPath);
  item.url = encoded ? `lumen://ipfs/${c}/${encoded}` : `lumen://ipfs/${c}`;

  const meta = await fetchHtmlHeadMetaForCidPath(c, resolved.entryPath);
  if (seq !== searchSeq) return;

  if (meta.title) item.title = meta.title;
  if (meta.description) item.description = meta.description;
}

async function enrichSiteResultsWithEntryPaths(
  items: ResultItem[],
  seq: number,
): Promise<void> {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return;

  const out: ResultItem[] = [];
  for (const r of list) {
    if (seq !== searchSeq) return;
    if (!r || r.kind !== "site") continue;

    // Domain sites are handled by SitePage (it already tries /index.html).
    const domain = String(r.site?.domain || "").trim();
    if (domain) {
      out.push(r);
      continue;
    }

    const parsed = parseLumenIpfsUrl(r.url);
    if (!parsed) {
      out.push(r);
      continue;
    }
    if (parsed.subpath) {
      out.push(r);
      continue;
    }

    const cid = String(r.site?.entryCid || r.site?.cid || parsed.cid || "").trim();
    if (!cid) {
      out.push(r);
      continue;
    }

    const resolved = await resolveHtmlEntryForCidRoot(cid);
    if (seq !== searchSeq) return;

    // Directory with no HTML => not a "site" result.
    if (resolved.isDir && !resolved.entryPath) {
      continue;
    }

    if (resolved.entryPath) {
      const encoded = encodeUrlPath(resolved.entryPath);
      const url = encoded ? `lumen://ipfs/${cid}/${encoded}` : `lumen://ipfs/${cid}`;
      const faviconCid = String(r.site?.cid || cid).trim();
      const thumbUrl =
        r.thumbUrl ||
        (faviconCid ? `${localIpfsGatewayBase()}/ipfs/${faviconCid}/favicon.ico` : undefined);
      out.push({
        ...r,
        url,
        thumbUrl,
        site: {
          ...(r.site || {}),
          entryCid: cid,
          entryPath: resolved.entryPath,
        },
      });
      continue;
    }

    // Treat as a file CID (unknown), keep as-is.
    out.push(r);
  }

  if (seq !== searchSeq) return;
  results.value = out;
}

function isPinnedImage(result: ResultItem): boolean {
  const cid = extractCidFromUrl(result.url);
  return cid ? pinnedCids.value.includes(cid) : false;
}

async function refreshPinnedCids() {
  try {
    const res = await (window as any).lumen?.ipfsPinList?.().catch(() => null);
    const pins =
      res?.ok && Array.isArray(res.pins)
        ? res.pins.map((x: any) => String(x))
        : [];
    pinnedCids.value = pins;
  } catch {
    pinnedCids.value = [];
  }
}

async function togglePinImage(result: ResultItem) {
  const cid = extractCidFromUrl(result.url);
  if (!cid) return;

  const isPinned = pinnedCids.value.includes(cid);

  try {
    const api: any = (window as any).lumen || null;
    if (isPinned) {
      // Unpin
      const unpinFn =
        typeof api?.ipfsUnpin === "function"
          ? api.ipfsUnpin
          : typeof api?.ipfsPinRm === "function"
            ? api.ipfsPinRm
            : null;

      if (!unpinFn) {
        const msg = "Local save API unavailable (missing ipfsUnpin)";
        console.error("[search][local-save] unpin missing API:", { cid });
        toast.error(msg);
        return;
      }

      const res = await unpinFn(cid).catch(() => null);
      if (res?.ok) {
        pinnedCids.value = pinnedCids.value.filter((c) => c !== cid);
        toast.success("Removed from local save");
        void refreshPinnedCids();
      } else {
        const err = String(res?.error || "").trim();
        console.warn("[search][local-save] unpin failed:", { cid, res });
        toast.error(err ? `Failed to remove from local save: ${err}` : "Failed to remove from local save");
      }
    } else {
      // Pin
      if (typeof api?.ipfsPinAdd !== "function") {
        const msg = "Local save API unavailable (missing ipfsPinAdd)";
        console.error("[search][local-save] pin missing API:", { cid });
        toast.error(msg);
        return;
      }

      const res = await api.ipfsPinAdd(cid).catch(() => null);
      if (res?.ok) {
        pinnedCids.value = [...pinnedCids.value, cid];
        toast.success("Saved to local");
        void refreshPinnedCids();
      } else {
        const err = String(res?.error || "").trim();
        console.warn("[search][local-save] pin failed:", { cid, res });
        toast.error(err ? `Failed to save to local: ${err}` : "Failed to save to local");
      }
    }
  } catch (e: any) {
    toast.error(String(e?.message || "Operation failed"));
  }
}

function focusInput() {
  inputEl.value?.focus();
}

onMounted(() => {
  setTimeout(focusInput, 60);

  try {
    const hh = thumbSafety.getHiddenHashes();
    hiddenThumbHashes.value = Object.fromEntries(hh.map((h) => [h, true]));
    const hu = thumbSafety.getHiddenUrls();
    hiddenThumbUrls.value = Object.fromEntries(hu.map((u) => [u, true]));
  } catch {
    hiddenThumbHashes.value = {};
    hiddenThumbUrls.value = {};
  }

  void refreshPinnedCids();
});

function fileKindLabel(k: ResultItem["fileKind"]): string {
  switch (k) {
    case "pdf":
      return "PDF";
    case "docx":
      return "DOCX";
    case "epub":
      return "EPUB";
    case "html":
      return "HTML";
    case "txt":
      return "Text";
    case "image":
      return "Image";
    default:
      return "IPFS";
  }
}

function typeBadgeLabel(r: ResultItem): string {
  if (!r) return "";
  switch (r.kind) {
    case "ipfs":
      return fileKindLabel(r.fileKind || "unknown");
    case "tx":
      return "Transaction";
    case "block":
      return "Block";
    case "address":
      return "Address";
    case "link":
      return "Link";
    case "site":
    default:
      return "Site";
  }
}

function typeBadgeClass(r: ResultItem): string {
  if (!r) return "type-ipfs";
  if (r.kind === "ipfs") {
    const fk = r.fileKind || "unknown";
    if (fk && fk !== "unknown") return `type-${fk}`;
  }
  return `type-${r.kind}`;
}

function iconFor(r: ResultItem) {
  if (!r) return Layers;
  switch (r.kind) {
    case "site":
      return Globe;
    case "ipfs": {
      const fk = r.fileKind || "unknown";
      if (fk === "image" || r.media === "image") return Image;
      if (fk === "pdf") return File;
      if (fk === "docx") return FileType;
      if (fk === "epub") return BookOpen;
      if (fk === "html") return FileCode;
      if (fk === "txt") return FileText;
      return FileQuestion;
    }
    case "tx":
      return Hash;
    case "block":
      return Box;
    case "address":
      return Wallet;
    case "link":
    default:
      return ExternalLink;
  }
}

function isCidTitle(titleValue: any): boolean {
  const t = String(titleValue || "").trim();
  return /^cid\b/i.test(t);
}

function isExploreImageResult(r: ResultItem): boolean {
  if (!r) return false;
  if (selectedType.value !== "all") return false;
  if (r.kind !== "ipfs") return false;
  return r.media === "image" || r.fileKind === "image";
}

function displayTitle(r: ResultItem): string | null {
  if (!r) return null;
  const title = String(r.title || "").trim();

  if (r.kind === "site") {
    if (title && !isCidTitle(title) && !/^\/ipfs\//i.test(title)) return title;
    return null;
  }

  if (selectedType.value === "all") {
    if (isExploreImageResult(r)) return null;
    if (!title) return null;
    if (isCidTitle(title) || isCidLike(title) || /^\/ipfs\//i.test(title)) return null;
  }

  return title || null;
}

function isNoTitlePlaceholder(r: ResultItem): boolean {
  if (!r) return false;
  const title = String(r.title || "").trim();
  if (r.kind === "site") {
    return !title || isCidTitle(title) || /^\/ipfs\//i.test(title);
  }

  if (selectedType.value === "all") {
    return !title || isCidTitle(title) || isCidLike(title) || /^\/ipfs\//i.test(title);
  }

  return false;
}

function shouldShowResultUrl(r: ResultItem): boolean {
  if (!r) return false;
  const url = String(r.url || "").trim();
  if (!url) return false;
  if (selectedType.value === "all") return false;
  // Sites tab: the URL line is redundant (clicking opens it), keep the list compact.
  if (r.kind === "site") return false;
  // Hide the raw lumen://ipfs/... line for "CID ..." results (it’s redundant/noisy in UI).
  if (r.kind === "site" && isCidTitle(r.title)) return false;
  return true;
}

function visibleBadges(r: ResultItem): string[] {
  const list = Array.isArray(r?.badges) ? r.badges : [];
  return list.slice(0, 5);
}

function hiddenBadges(r: ResultItem): string[] {
  const list = Array.isArray(r?.badges) ? r.badges : [];
  return list.slice(5);
}

function formatResultDescription(descValue: any): string {
  const raw = String(descValue || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const max = 250;
  if (raw.length <= max) return raw;
  const clipped = raw.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  const safe = lastSpace > 120 ? clipped.slice(0, lastSpace) : clipped;
  return `${safe.trimEnd()}…`;
}

function isExploreTextPreviewResult(r: ResultItem): boolean {
  if (!r) return false;
  if (selectedType.value !== "all") return false;
  if (r.kind !== "ipfs") return false;
  return r.fileKind === "txt";
}

function formatCodePreviewHover(descValue: any): string {
  const raw = String(descValue || "").replace(/\r/g, "\n");
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const max = 250;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function formatCodePreviewList(descValue: any): string {
  const raw = String(descValue || "").replace(/\r/g, "\n");
  if (!raw.trim()) return "";

  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const joined = lines.join(". ").trim();
  if (!joined) return "";

  const max = 250;
  if (joined.length <= max) return joined;
  const clipped = joined.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  const safe = lastSpace > 120 ? clipped.slice(0, lastSpace) : clipped;
  return `${safe.trimEnd()}…`;
}

function displayTextPreviewList(r: ResultItem): string | null {
  if (!isExploreTextPreviewResult(r)) return null;
  const raw = String(r.description || "");
  const formatted = formatCodePreviewList(raw);
  if (formatted) return formatted;
  return "No preview available";
}

function displayTextPreviewHover(r: ResultItem): string | null {
  if (!isExploreTextPreviewResult(r)) return null;
  const raw = String(r.description || "");
  const formatted = formatCodePreviewHover(raw);
  if (formatted) return formatted;
  return "No preview available";
}

function displayDescription(r: ResultItem): string | null {
  if (!r) return null;
  if (isExploreTextPreviewResult(r)) return null;
  const raw = String(r.description || "").trim();
  if (raw) return formatResultDescription(raw);
  if (r.kind === "site") return "No description available";
  return null;
}

function isNoDescriptionPlaceholder(r: ResultItem): boolean {
  if (!r) return false;
  if (r.kind !== "site") return false;
  return !String(r.description || "").trim();
}

function isNoTextPreviewPlaceholder(r: ResultItem): boolean {
  if (!isExploreTextPreviewResult(r)) return false;
  return !String(r.description || "").trim();
}

function goto(url: string, opts?: { push?: boolean }) {
  if (navigate) {
    navigate(url, opts);
    return;
  }
  openInNewTab?.(url);
}

function parseSearchUrl(raw: string): { q: string; type: SearchType; page: number } {
  const value = String(raw || "").trim();
  if (!value) return { q: "", type: "site", page: 1 };
  try {
    const u = new URL(value);
    const qs = u.searchParams.get("q") || "";
    const type = (u.searchParams.get("type") || "") as SearchType;
    const t: SearchType =
      type === "site" || type === "image" || type === "all" ? type : "site";
    const pageRaw = u.searchParams.get("page") || "";
    const parsedPage = Number.parseInt(pageRaw, 10);
    const p = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    return { q: qs, type: t, page: p };
  } catch {
    return { q: "", type: "site", page: 1 };
  }
}

function makeSearchUrl(query: string, type: SearchType, page = 1): string {
  const s = String(query || "").trim();
  const u = new URL("lumen://search");
  if (s) u.searchParams.set("q", s);
  if (type) u.searchParams.set("type", type);
  const p = Number.isFinite(Number(page)) && Number(page) > 1 ? Math.floor(Number(page)) : 1;
  if (p > 1) u.searchParams.set("page", String(p));
  return u.toString();
}

function setType(t: SearchType) {
  selectedType.value = t;
  page.value = 1;
  const s = q.value.trim();
  const nextUrl = makeSearchUrl(s, t, 1);
  const curUrl = String(currentTabUrl?.value || "").trim();
  if (curUrl && curUrl === nextUrl) {
    activeQuery.value = s;
    activeType.value = t;
    runSearch(s, t, 1);
    return;
  }
  goto(nextUrl, { push: false });
}

function submit() {
  const s = q.value.trim();
  page.value = 1;
  const nextUrl = makeSearchUrl(s, selectedType.value, 1);
  const curUrl = String(currentTabUrl?.value || "").trim();
  if (curUrl && curUrl === nextUrl) {
    activeQuery.value = s;
    activeType.value = selectedType.value;
    runSearch(s, selectedType.value, 1);
    return;
  }
  goto(nextUrl, { push: true });
}

function cidForViewPing(r: ResultItem): string | null {
  const direct = String((r as any)?.viewCid || "").trim();
  if (direct) return direct;

  const cidFromUrl = extractCidFromUrl(String(r?.url || ""));
  if (cidFromUrl) return cidFromUrl;

  const siteCid = String(r?.site?.cid || r?.site?.entryCid || "").trim();
  if (siteCid) return siteCid;

  return null;
}

function pingGatewayViewFromSearch(r: ResultItem) {
  try {
    const gwApi = (window as any).lumen?.gateway;
    if (!gwApi || typeof gwApi.pingViewPq !== "function") return;

    const cid = cidForViewPing(r);
    if (!cid) return;

    const endpoint = String(r?.gateway?.endpoint || "").trim();

    // Defer the IPC work so opening the result stays instant.
    setTimeout(() => {
      try {
        void getActiveProfileId()
          .then((profileId) => {
            const pid = String(profileId || "").trim();
            if (!pid) return;
            gwApi.pingViewPq({ profileId: pid, endpoint, cid, timeoutMs: 2500 });
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }, 0);
  } catch {
    // ignore
  }
}

async function openResult(r: ResultItem) {
  // Open via native lumen:// routes (as before), but ping the gateway in PQ to record a signed view (best-effort).
  pingGatewayViewFromSearch(r);

  const wantsNewTab =
    selectedType.value === "all" ||
    selectedType.value === "image" ||
    (selectedType.value === "site" && r.kind === "site");

  if (r && r.kind === "ipfs") {
    const parsed = parseLumenIpfsUrl(r.url);
    if (parsed && !parsed.subpath) {
      const cid = String(parsed.cid || "").trim();
      if (cid) {
        const resolved = await resolveHtmlEntryForCidRoot(cid).catch(() => null);
        if (resolved && resolved.isDir && resolved.entryPath) {
          const encoded = encodeUrlPath(resolved.entryPath);
          const nextUrl = encoded ? `lumen://ipfs/${cid}/${encoded}` : `lumen://ipfs/${cid}`;
          if (wantsNewTab) {
            if (openInNewTab) openInNewTab(nextUrl);
            else goto(nextUrl, { push: true });
          } else {
            goto(nextUrl, { push: true });
          }
          return;
        }
      }
    }
  }

  if (selectedType.value === "site" && r && r.kind === "site") {
    const domain = String(r.site?.domain || "").trim();
    const parsed = parseLumenIpfsUrl(r.url);
    if (!domain && parsed && !parsed.subpath) {
      const cid = String(r.site?.entryCid || r.site?.cid || parsed.cid || "").trim();
      if (cid) {
        const resolved = await resolveHtmlEntryForCidRoot(cid);
        if (resolved.isDir && resolved.entryPath) {
          const encoded = encodeUrlPath(resolved.entryPath);
          const nextUrl = encoded ? `lumen://ipfs/${cid}/${encoded}` : `lumen://ipfs/${cid}`;
          if (wantsNewTab) {
            if (openInNewTab) openInNewTab(nextUrl);
            else goto(nextUrl, { push: true });
          } else {
            goto(nextUrl, { push: true });
          }
          return;
        }
        if (resolved.isDir && !resolved.entryPath) {
          toast.error("No HTML/HTM page found in this CID");
        }
      }
    }
  }

  if (wantsNewTab) {
    if (openInNewTab) openInNewTab(r.url);
    else goto(r.url, { push: true });
    return;
  }

  goto(r.url, { push: true });
}

const brokenThumbs = ref<Record<string, true>>({});
const faviconFallbackById = ref<Record<string, number>>({});

function markThumbBroken(id: string) {
  const key = String(id || "").trim();
  if (!key) return;
  if (brokenThumbs.value[key]) return;
  brokenThumbs.value = { ...brokenThumbs.value, [key]: true };
}

function cidForFavicon(r: ResultItem): string | null {
  const cid = String(r?.site?.cid || "").trim();
  if (cid) return cid;
  const entryCid = String(r?.site?.entryCid || "").trim();
  if (entryCid) return entryCid;
  return null;
}

function tryNextFavicon(r: ResultItem): boolean {
  if (!r || r.kind !== "site") return false;
  const cid = cidForFavicon(r);
  if (!cid) return false;

  const seq = [
    "favicon.ico",
    "favicon",
    "favicon.png",
    "favicon.svg",
    "favicon.jpg",
    "favicon.jpeg",
  ];

  const cur = String(r.thumbUrl || "").trim();
  const currentIdx = Number(faviconFallbackById.value[r.id] ?? 0);
  let nextIdx = currentIdx;

  // If the current URL doesn't match the expected attempt, try to sync.
  if (cur) {
    const matched = seq.findIndex((s) => cur.toLowerCase().endsWith(`/${s}`));
    if (matched >= 0) nextIdx = matched;
  }

  nextIdx += 1;
  if (nextIdx >= seq.length) return false;

  faviconFallbackById.value = { ...faviconFallbackById.value, [r.id]: nextIdx };
  r.thumbUrl = `${localIpfsGatewayBase()}/ipfs/${cid}/${seq[nextIdx]}`;
  return true;
}

function onFaviconError(r: ResultItem) {
  if (tryNextFavicon(r)) return;
  markThumbBroken(r.id);
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
  return `${localIpfsGatewayBase()}/ipfs/${c}/favicon.ico`;
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

type GatewaySearchResult = {
  items: ResultItem[];
  maybeHasMore: boolean;
};

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
  root_cid?: string;
  path?: string;
  title?: string;
  kind?: string;
  mime?: string;
  ext_guess?: string;
  resourceType?: string;
  tags_json?: any;
  topics?: any;
  snippet?: string;
  views_unique_7d?: number;
  linked_domain?: string;
  rank_signals?: any;
};

type GatewaySiteSearchResult = {
  type?: string;
  domain?: string;
  rootDomain?: string;
  cid?: string;
  entry_cid?: string;
  entry_path?: string;
  wallet?: string;
  score?: number;
  views_unique_7d?: number;
  tags?: any;
  owned?: boolean;
  title?: string;
  snippet?: string;
};

function formatCompactCount(value: any): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.floor(k)}k` : `${k.toFixed(1)}k`;
  }
  const m = n / 1_000_000;
  return m >= 10 ? `${Math.floor(m)}M` : `${m.toFixed(1)}M`;
}

function safePathSuffix(pathValue: any): string {
  const p = String(pathValue ?? "").trim();
  if (!p) return "";
  if (p.startsWith("/")) return p;
  return `/${p}`;
}

function encodeUrlPath(pathValue: any): string {
  const raw = String(pathValue ?? "").trim();
  if (!raw) return "";
  const withoutLeading = raw.startsWith("/") ? raw.slice(1) : raw;
  if (!withoutLeading) return "";
  return withoutLeading
    .split("/")
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function safeEncodedPathSuffix(pathValue: any): string {
  const encoded = encodeUrlPath(pathValue);
  return encoded ? `/${encoded}` : "";
}

function lumenUrlHostAndRest(url: string): { host: string; rest: string } | null {
  const raw = String(url || "").trim();
  if (!/^lumen:\/\//i.test(raw)) return null;
  const without = raw.slice("lumen://".length);
  const idx = without.indexOf("/");
  if (idx === -1) return null;
  const host = (without.slice(0, idx) || "").trim().toLowerCase();
  const rest = (without.slice(idx + 1) || "").trim();
  if (!host) return null;
  return { host, rest };
}

function lumenUrlHasEntryPath(url: string): boolean {
  const parsed = lumenUrlHostAndRest(url);
  if (!parsed) return false;

  const parts = parsed.rest
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parsed.host === "ipfs" || parsed.host === "ipns") {
    // `lumen://ipfs/<cid>` has no "entry path"; `lumen://ipfs/<cid>/<path>` does.
    return parts.length > 1;
  }

  return parts.length > 0;
}

function mapGatewayHitToResult(
  hit: GatewaySearchHit,
  gateway: GatewayView,
  filterType: SearchType,
): ResultItem | null {
  const cid = String(hit?.cid || "").trim();
  if (!cid) return null;
  const rootCid = String(hit?.root_cid || "").trim();
  const path = safePathSuffix(hit?.path);
  const mime = String(hit?.mime || "").trim();
  const rType = String(hit?.resourceType || "").trim();
  const extGuess = String(hit?.ext_guess || "").trim().toLowerCase();
  const pathLower = String(path || "").trim().toLowerCase();
  const mimeLower = String(mime || "").trim().toLowerCase();
  const rTypeLower = String(rType || "").trim().toLowerCase();

  // Search policy: never surface audio/video results in this UI.
  if (rTypeLower === "video" || rTypeLower === "audio") return null;
  if (mimeLower.startsWith("video/") || mimeLower.startsWith("audio/")) return null;

  const extractedTags = extractSearchTags(hit);

  const isImage =
    rTypeLower === "image" || mimeLower.startsWith("image/");
  const media: ResultItem["media"] = isImage
    ? "image"
    : "unknown";

  if (filterType === "image" && !isImage) return null;
  if (filterType === "image" && isImage && extractedTags.length === 0) return null;

  let fileKind: ResultItem["fileKind"] = "unknown";
  if (isImage) fileKind = "image";
  else if (extGuess === "pdf" || mimeLower.includes("pdf") || pathLower.endsWith(".pdf")) fileKind = "pdf";
  else if (extGuess === "epub" || mimeLower.includes("epub") || pathLower.endsWith(".epub")) fileKind = "epub";
  else if (
    extGuess === "docx" ||
    pathLower.endsWith(".docx") ||
    mimeLower.includes("wordprocessingml") ||
    mimeLower.includes("officedocument.wordprocessingml")
  ) fileKind = "docx";
  else if (
    extGuess === "html" ||
    extGuess === "htm" ||
    pathLower.endsWith(".html") ||
    pathLower.endsWith(".htm") ||
    mimeLower.includes("text/html") ||
    mimeLower.includes("application/xhtml+xml")
  ) fileKind = "html";
  else if (extGuess === "txt" || pathLower.endsWith(".txt") || mimeLower.startsWith("text/plain")) fileKind = "txt";

  // When the indexer provides a `root_cid` + `path`, the leaf `cid` is often the file CID.
  // Opening `lumen://ipfs/<leaf>/<path>` is invalid; prefer root+path.
  const hasPath = !!path && path !== "/";
  const openUrl =
    hasPath && rootCid && rootCid !== cid
      ? `lumen://ipfs/${rootCid}${path}`
      : `lumen://ipfs/${cid}${hasPath ? path : ""}`;

  // For thumbnails, prefer the leaf CID to avoid path issues and keep requests simple.
  const thumbUrl = isImage
    ? `${localIpfsGatewayBase()}/ipfs/${cid}`
    : undefined;

  const hitTitle = hit?.title != null ? String(hit.title).trim() : "";
  const title =
    filterType === "all" && fileKind === "txt"
      ? hitTitle
      : hitTitle ||
        (path ? path.split("/").filter(Boolean).slice(-1)[0] : "") ||
        (isImage ? "" : `CID ${cid.slice(0, 10)}…`);

  const snippet = hit?.snippet != null ? String(hit.snippet).trim() : "";

  const viewsRaw = Number((hit as any)?.views_unique_7d);
  const uniqueViews7d = Number.isFinite(viewsRaw)
    ? Math.max(0, Math.floor(viewsRaw))
    : 0;

  const badges: string[] = [];
  const badgeLimit =
    filterType === "image" && isImage ? Number.POSITIVE_INFINITY : 6;

  const linkedDomainRaw = (hit as any)?.linked_domain;
  const linkedDomain =
    typeof linkedDomainRaw === "string" ? linkedDomainRaw.trim().toLowerCase() : "";
  const onchainSignal = String((hit as any)?.rank_signals?.onchain || "")
    .trim()
    .toLowerCase();
  if (linkedDomain) {
    badges.push("Linked");
    badges.push(linkedDomain);
  } else if (onchainSignal === "linked") {
    badges.push("Linked");
  }

  for (const t of extractedTags) {
    if (badges.length >= badgeLimit) break;
    if (!badges.includes(t)) badges.push(t);
  }
  // Fallback: show MIME when we don't have tags (and not in image mode).
  if (!badges.length && mime && !isImage) badges.push(mime);

  return {
    id: `gw:${gateway.id}:${cid}:${path || ""}`,
    title,
    url: openUrl,
    kind: "ipfs",
    description: snippet || undefined,
    badges,
    thumbUrl,
    media,
    fileKind,
    uniqueViews7d,
    viewCid: rootCid || cid,
    gateway: { id: gateway.id, endpoint: gateway.endpoint },
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
  // Non-site routes (CID navigation, explorer, etc.)
  if (host === "ipfs" || host === "ipns" || host === "explorer") return null;
  return host;
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

function leafCidFromResult(r: ResultItem): string | null {
  if (!r) return null;

  const id = String((r as any).id || "").trim();
  if (id.startsWith("gw:")) {
    const parts = id.split(":");
    const cid = parts.length >= 3 ? String(parts[2] || "").trim() : "";
    if (cid && isCidLike(cid)) return cid;
  }

  if (id.startsWith("ipfs:")) {
    const cid = id.slice("ipfs:".length).trim();
    if (cid && isCidLike(cid)) return cid;
  }

  const fromUrl = extractCidFromUrl(String((r as any).url || ""));
  if (fromUrl && isCidLike(fromUrl)) return fromUrl;

  return null;
}

function isPlaceholderTitle(titleValue: any): boolean {
  const t = String(titleValue || "").trim();
  if (!t) return true;
  if (/^cid\s+[a-z0-9]{6,}\S*$/i.test(t)) return true;
  if (isCidLike(t)) return true;
  if (/^\/ipfs\//i.test(t)) return true;
  return false;
}

function choosePreferredIpfsUrl(aUrl: any, bUrl: any, leafCid: string | null): string {
  const a = String(aUrl || "").trim();
  const b = String(bUrl || "").trim();
  if (!a) return b;
  if (!b) return a;

  const aHasPath = lumenUrlHasEntryPath(a);
  const bHasPath = lumenUrlHasEntryPath(b);
  if (aHasPath !== bHasPath) return bHasPath ? b : a;

  if (leafCid) {
    const pa = parseLumenIpfsUrl(a);
    const pb = parseLumenIpfsUrl(b);
    const aRootCtx = !!(pa && pa.cid && pa.cid !== leafCid && aHasPath);
    const bRootCtx = !!(pb && pb.cid && pb.cid !== leafCid && bHasPath);
    if (aRootCtx !== bRootCtx) return bRootCtx ? b : a;
  }

  // Prefer shorter canonical URLs to reduce noisy variants (but keep stable if equal).
  if (a.length !== b.length) return a.length < b.length ? a : b;
  return a;
}

function mergeResultInPlace(base: ResultItem, incoming: ResultItem, leafCid: string | null) {
  if (!base || !incoming) return;

  const baseViews = Number.isFinite(Number(base.uniqueViews7d)) ? Number(base.uniqueViews7d) : 0;
  const incViews = Number.isFinite(Number(incoming.uniqueViews7d)) ? Number(incoming.uniqueViews7d) : 0;
  base.uniqueViews7d = Math.max(baseViews, incViews);

  base.badges = mergeBadges(Array.isArray(base.badges) ? base.badges : [], Array.isArray(incoming.badges) ? incoming.badges : [], 20);

  if (!base.thumbUrl && incoming.thumbUrl) base.thumbUrl = incoming.thumbUrl;

  const baseTitle = String(base.title || "").trim();
  const incTitle = String(incoming.title || "").trim();
  if (isPlaceholderTitle(baseTitle) && incTitle && !isPlaceholderTitle(incTitle)) {
    base.title = incTitle;
  }

  const baseDesc = String((base as any).description || "").trim();
  const incDesc = String((incoming as any).description || "").trim();
  if (!baseDesc && incDesc) {
    (base as any).description = incDesc;
  } else if (incDesc && incDesc.length > baseDesc.length + 24) {
    // Prefer a meaningfully longer snippet.
    (base as any).description = incDesc;
  }

  if (base.kind === "ipfs" && incoming.kind === "ipfs") {
    base.url = choosePreferredIpfsUrl(base.url, incoming.url, leafCid);
  } else if (!base.url && incoming.url) {
    base.url = incoming.url;
  }

  // Prefer a root viewCid (site context) when we are de-duping by leaf cid.
  const baseViewCid = String((base as any).viewCid || "").trim();
  const incViewCid = String((incoming as any).viewCid || "").trim();
  if (incViewCid && isCidLike(incViewCid)) {
    const baseIsLeaf = !!(leafCid && baseViewCid && baseViewCid === leafCid);
    const incIsRoot = !!(leafCid && incViewCid !== leafCid);
    if (!baseViewCid || (baseIsLeaf && incIsRoot)) {
      (base as any).viewCid = incViewCid;
    }
  }

  if (!(base as any).gateway && (incoming as any).gateway) {
    (base as any).gateway = (incoming as any).gateway;
  }
}

function dedupeAllResults(items: ResultItem[]): ResultItem[] {
  const order: string[] = [];
  const byKey = new Map<string, { result: ResultItem; leafCid: string | null }>();

  for (const r of items || []) {
    if (!r) continue;

    if (r.kind === "ipfs") {
      const leaf = leafCidFromResult(r);
      const key = leaf ? `ipfs:${leaf}` : `ipfs:url:${String(r.url || "").trim().toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { result: r, leafCid: leaf });
        order.push(key);
        continue;
      }

      const leafCid = existing.leafCid || leaf;
      const cur = existing.result;

      const curViews = Number.isFinite(Number(cur.uniqueViews7d)) ? Number(cur.uniqueViews7d) : 0;
      const nextViews = Number.isFinite(Number((r as any).uniqueViews7d)) ? Number((r as any).uniqueViews7d) : 0;
      const curHasPath = lumenUrlHasEntryPath(String(cur.url || ""));
      const nextHasPath = lumenUrlHasEntryPath(String(r.url || ""));
      const curRootCtx = !!(leafCid && String((cur as any).viewCid || "").trim() && String((cur as any).viewCid || "").trim() !== leafCid);
      const nextRootCtx = !!(leafCid && String((r as any).viewCid || "").trim() && String((r as any).viewCid || "").trim() !== leafCid);

      const shouldReplace =
        (nextHasPath && !curHasPath) ||
        (nextRootCtx && !curRootCtx) ||
        (nextViews > curViews + 0.5);

      if (shouldReplace) {
        existing.result = r;
        mergeResultInPlace(existing.result, cur, leafCid);
      } else {
        mergeResultInPlace(existing.result, r, leafCid);
      }

      existing.leafCid = leafCid;
      continue;
    }

    if (r.kind === "site") {
      const domain = String(r.site?.domain || domainKeyFromUrl(r.url) || "").trim().toLowerCase();
      const cid = String(r.site?.cid || "").trim();
      const key = domain ? `site:d:${domain}` : cid ? `site:c:${cid}` : `site:url:${String(r.url || "").trim().toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { result: r, leafCid: null });
        order.push(key);
        continue;
      }
      mergeResultInPlace(existing.result, r, null);
      continue;
    }

    // Default: de-dupe by URL when possible.
    const urlKey = String(r.url || "").trim().toLowerCase();
    const key = urlKey ? `${r.kind}:url:${urlKey}` : `${r.kind}:id:${String(r.id || "").trim()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { result: r, leafCid: null });
      order.push(key);
      continue;
    }
    mergeResultInPlace(existing.result, r, null);
  }

  return order.map((k) => byKey.get(k)!.result);
}

function mergeAndRankSites(query: string, items: ResultItem[]): ResultItem[] {
  const byKey = new Map<
    string,
    {
      key: string;
      domain: string | null;
      cid: string | null;
      owned: boolean;
      result: ResultItem;
      gwScore: number;
    }
  >();

  for (const r of items) {
    if (!r || r.kind !== "site") continue;

    const domain = String(r.site?.domain || domainKeyFromUrl(r.url) || "")
      .trim()
      .toLowerCase();
    const cid = String(r.site?.cid || "").trim();
    const key = domain ? `d:${domain}` : cid ? `c:${cid}` : "";
    if (!key) continue;

    const gwScore = Number.isFinite(Number(r.score)) ? Number(r.score) : 0;
    const owned = !!(r.site?.owned || r.site?.wallet);

    const existing = byKey.get(key);
    if (!existing) {
      const title =
        r.title ||
        (domain ? domain : cid ? `CID ${cid.slice(0, 8)}…` : "Site");
      const url =
        String(r.url || "").trim() ||
        (domain ? `lumen://${domain}` : cid ? `lumen://ipfs/${cid}` : "");

      byKey.set(key, {
        key,
        domain: domain || null,
        cid: cid || null,
        owned,
        result: {
          ...r,
          title,
          url,
          badges: Array.isArray(r.badges) ? r.badges.slice(0, 20) : [],
          uniqueViews7d: (() => {
            const v = Number((r as any)?.uniqueViews7d);
            return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
          })(),
          site: {
            domain: domain || null,
            cid: cid || null,
            entryCid: r.site?.entryCid || null,
            entryPath: r.site?.entryPath || null,
            wallet: r.site?.wallet || null,
            owned,
          },
        },
        gwScore,
      });
      continue;
    }

    existing.gwScore = Math.max(existing.gwScore, gwScore);
    existing.owned = existing.owned || owned;
    existing.result.thumbUrl = existing.result.thumbUrl || r.thumbUrl;
    existing.result.uniqueViews7d = Math.max(
      Number.isFinite(Number(existing.result.uniqueViews7d))
        ? Number(existing.result.uniqueViews7d)
        : 0,
      Number.isFinite(Number((r as any).uniqueViews7d))
        ? Number((r as any).uniqueViews7d)
        : 0,
    );
    existing.result.gateway = existing.result.gateway || (r as any).gateway;
    existing.result.viewCid = existing.result.viewCid || (r as any).viewCid;
    existing.result.badges = mergeBadges(
      existing.result.badges || [],
      r.badges || [],
      20,
    );
    existing.result.description = existing.result.description || r.description;

    const nextDomain = existing.domain || domain || null;
    const nextCid = existing.cid || cid || null;
    const nextWallet = existing.result.site?.wallet || r.site?.wallet || null;
    const nextEntryCid = existing.result.site?.entryCid || r.site?.entryCid || null;
    const nextEntryPath = existing.result.site?.entryPath || r.site?.entryPath || null;

    existing.domain = nextDomain;
    existing.cid = nextCid;
    existing.result.site = {
      domain: nextDomain,
      cid: nextCid,
      entryCid: nextEntryCid,
      entryPath: nextEntryPath,
      wallet: nextWallet,
      owned: existing.owned,
    };

    const incomingUrl = String(r.url || "").trim();
    if (
      !lumenUrlHasEntryPath(existing.result.url) &&
      incomingUrl &&
      lumenUrlHasEntryPath(incomingUrl)
    ) {
      existing.result.url = incomingUrl;
    } else if (!existing.result.url && incomingUrl) {
      existing.result.url = incomingUrl;
    }

    // Only normalize to a domain/CID URL if we don't already have a concrete entry path.
    if (!lumenUrlHasEntryPath(existing.result.url)) {
      if (nextDomain) {
        existing.result.url = `lumen://${nextDomain}`;
        if (!existing.result.title) existing.result.title = nextDomain;
      } else if (nextCid) {
        existing.result.url = `lumen://ipfs/${nextCid}`;
        if (!existing.result.title) existing.result.title = `CID ${nextCid.slice(0, 8)}…`;
      }
    }
  }

  const merged = Array.from(byKey.values()).map((x) => {
    const dnsScore = x.domain ? clamp01(scoreDomainMatch(query, x.domain)) : 0;
    const exactBoost = x.domain && isExactDomainMatch(query, x.domain) ? 0.2 : 0;
    const finalScore = clamp01(0.75 * x.gwScore + 0.25 * dnsScore + exactBoost);
    x.result.score = finalScore;
    x.result.site = {
      ...(x.result.site || {}),
      owned: x.owned,
      domain: x.domain,
      cid: x.cid,
      wallet: x.result.site?.wallet || null,
    };
    return x.result;
  });

  merged.sort((a, b) => {
    const da = (a.site?.domain || domainKeyFromUrl(a.url) || "").trim().toLowerCase();
    const db = (b.site?.domain || domainKeyFromUrl(b.url) || "").trim().toLowerCase();
    const aExact = da ? (isExactDomainMatch(query, da) ? 1 : 0) : 0;
    const bExact = db ? (isExactDomainMatch(query, db) ? 1 : 0) : 0;
    if (aExact !== bExact) return bExact - aExact;

    const ao = a.site?.owned ? 1 : 0;
    const bo = b.site?.owned ? 1 : 0;
    if (ao !== bo) return bo - ao;

    const as = Number.isFinite(Number(a.score)) ? Number(a.score) : 0;
    const bs = Number.isFinite(Number(b.score)) ? Number(b.score) : 0;
    if (bs !== as) return bs - as;

    const at = (a.badges || []).length;
    const bt = (b.badges || []).length;
    if (bt !== at) return bt - at;

    const ak = da || (a.site?.cid ? `cid:${a.site.cid}` : a.url);
    const bk = db || (b.site?.cid ? `cid:${b.site.cid}` : b.url);
    return ak.localeCompare(bk);
  });

  return merged;
}

async function searchGateways(
  profileId: string,
  query: string,
  type: SearchType,
  seq: number,
  opts: { pageSize: number; page: number },
): Promise<GatewaySearchResult> {
  const gwApi = (window as any).lumen?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") return { items: [], maybeHasMore: false };

  const gateways = profileId ? await loadGatewaysForSearch(profileId) : [];
  if (seq !== searchSeq) return { items: [], maybeHasMore: false };

  const list: GatewayView[] = gateways.length
    ? gateways
    : [{ id: "default", endpoint: "", regions: [] }];

  const safePage = clampPage(opts.page);
  const pageSizeRaw = Number(opts.pageSize);
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), 50)
    : 12;

  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  type GatewayBatch = { items: ResultItem[]; rawCount: number };

  const wantedType = normalizeGatewayType(type);
  const wantedMode = wantedType === "site" ? "sites" : type === "all" ? "everything" : "";
  // For image results, gateways sometimes return many non-images in the top N,
  // and some images have missing `mime/resourceType` (we infer from extension).
  // Fetch more upfront so the UI page stays filled without extra round-trips.
  const fetchLimit =
    wantedType === "image"
      ? Math.min(Math.max(end * 4, 50), 300)
      : wantedType === "site"
        ? Math.min(Math.max(end * 3, 50), 200)
        : type === "all"
          ? Math.min(Math.max(end * 3, 50), 200)
        : Math.min(end, 50);
  const tasks = list.map(async (g): Promise<GatewayBatch> => {
    const resp = await gwApi
      .searchPq({
        profileId,
        endpoint: g.endpoint,
        query,
        lang: "en",
        limit: fetchLimit,
        offset: 0,
        mode: wantedMode,
        type: wantedType,
      })
      .catch(() => null);
    if (!resp || resp.ok === false) return { items: [], rawCount: 0 };
    const data = resp.data || {};
    const out: ResultItem[] = [];

    // Site mode: gateway returns `results` with `{ type: 'site', domain, cid, score, tags? }`.
    const siteResults: GatewaySiteSearchResult[] = Array.isArray(data.results)
      ? data.results
      : [];
    const rawCountSite = siteResults.length;

    const sites = siteResults.filter((s) => {
      const t = String(s?.type || "").trim().toLowerCase();
      const domain = String(s?.domain || "").trim();
      const cid = String(s?.cid || "").trim();
      return t === "site" && (!!domain || !!cid);
    });

    if (wantedType === "site" && sites.length > 0) {
      for (const s of sites) {
        const domainRaw = String(s.domain || "").trim();
        const domain = domainRaw ? domainRaw.toLowerCase() : "";
        const cid = String(s?.cid || "").trim();
        const entryCidRaw = String(s?.entry_cid || "").trim();
        const entryCid = entryCidRaw || cid;
        const entryPath = String(s?.entry_path || "").trim();
        const entrySuffix = safeEncodedPathSuffix(entryPath);
        const wallet = String(s?.wallet || "").trim();
        const owned = !!wallet || !!s.owned;

        const tags = extractSiteTags(s);
        const badges = tags.length ? tags.slice(0, 20) : [];

        const title =
          String(s.title || "").trim() ||
          (domain ? domain : cid ? `CID ${cid.slice(0, 8)}…` : "Site");
        const snippet = String(s.snippet || "").trim();

        let url = "";
        if (domain) {
          // Prefer the canonical on-chain domain route when present (better UX + reduces "copy" confusion).
          url = `lumen://${domain}${entrySuffix}`;
        } else if (entryCid) {
          url = `lumen://ipfs/${entryCid}${entrySuffix}`;
        } else if (domain) {
          url = `lumen://${domain}${entrySuffix}`;
        }
        if (!url) continue;

        const id = `site:${g.id}:${domain || cid}`;
        out.push({
          id,
          title,
          url,
          kind: "site",
          description: snippet || (domain && cid ? `CID ${cid}` : undefined),
          badges,
          thumbUrl: cid
            ? faviconUrlForCid(cid) || undefined
            : entryCid
              ? faviconUrlForCid(entryCid) || undefined
              : undefined,
          score: Number.isFinite(Number(s?.score)) ? Number(s.score) : 0,
          uniqueViews7d: (() => {
            const v = Number((s as any)?.views_unique_7d);
            return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
          })(),
          viewCid: cid || entryCid || undefined,
          gateway: { id: g.id, endpoint: g.endpoint },
          site: {
            domain: domain || null,
            cid: cid || null,
            entryCid: entryCid || null,
            entryPath: entryPath || null,
            wallet: wallet || null,
            owned,
          },
        });
      }
      return { items: out, rawCount: rawCountSite };
    }

    const hits: GatewaySearchHit[] = Array.isArray(data.hits)
      ? data.hits
      : Array.isArray(data.results)
        ? data.results
        : [];
    const rawCountHits = hits.length;

    for (const h of hits) {
      const mapped = mapGatewayHitToResult(h, g, type);
      if (mapped) out.push(mapped);
    }
    return { items: out, rawCount: rawCountHits };
  });

  const lists = await Promise.all(tasks);
  if (seq !== searchSeq) return { items: [], maybeHasMore: false };

  const flat = lists.flatMap((l) => l.items);
  if (wantedType === "site") {
    const maybeHasMore = lists.some((l) => l.rawCount >= fetchLimit);
    return { items: flat, maybeHasMore };
  }

  const seen = new Set<string>();
  const unique: ResultItem[] = [];
  for (const r of flat) {
    const key = r.url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  const pageItems = unique.slice(start, end);
  const maybeHasMore = unique.length > end || lists.some((l) => l.rawCount >= fetchLimit);
  return { items: pageItems, maybeHasMore };
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

function clampPage(value: any): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function gotoPage(targetPage: number) {
  const s = activeQuery.value.trim();
  if (!s && activeType.value !== "site" && activeType.value !== "image" && activeType.value !== "all") return;
  const p = clampPage(targetPage);
  goto(makeSearchUrl(s, activeType.value, p), { push: true });
}

function nextPage() {
  gotoPage(page.value + 1);
}

function prevPage() {
  if (page.value <= 1) return;
  gotoPage(page.value - 1);
}

const showPager = computed(() => {
  if (!touched.value) return false;
  if (!activeQuery.value.trim() && activeType.value !== "site" && activeType.value !== "image" && activeType.value !== "all") return false;
  return page.value > 1 || gatewayHasMore.value;
});

const knownTotalPages = computed<number | null>(() =>
  gatewayHasMore.value ? null : page.value,
);

const pageNumbers = computed((): (number | string)[] => {
  const total = knownTotalPages.value;
  const current = page.value;
  const pages: (number | string)[] = [];

  if (total != null) {
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      ) {
        pages.push(i);
      }
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  }

  pages.push(1);
  if (current <= 3) {
    for (let i = 2; i <= Math.max(3, current + 1); i++) pages.push(i);
    pages.push("...");
    return pages;
  }

  pages.push("...");
  for (let i = current - 1; i <= current + 1; i++) {
    if (i < 2) continue;
    pages.push(i);
  }
  pages.push("...");
  return pages;
});

const pageInfoText = computed(() => {
  if (!results.value.length) return `Page ${page.value}`;
  const start = (page.value - 1) * gatewayPageSize + 1;
  const end = (page.value - 1) * gatewayPageSize + results.value.length;
  const plus = gatewayHasMore.value ? "+" : "";
  return `${start}-${end}${plus} results`;
});

async function runSearch(query: string, type: SearchType, pageParam = 1) {
  const seq = ++searchSeq;
  const clean = String(query || "").trim();
  const safePage = clampPage(pageParam);
  const refreshTick = Number(currentTabRefresh?.value || 0);
  const runKey = `${type}::${clean}::page=${safePage}::r=${refreshTick}`;
  const allowEmptyQuery = type === "site" || type === "image" || type === "all";
  if (!clean && !allowEmptyQuery) {
    touched.value = false;
    loading.value = false;
    errorMsg.value = "";
    results.value = [];
    lastRunKey.value = "";
    gatewayHasMore.value = false;
    return;
  }
  if (runKey === lastRunKey.value && results.value.length) {
    loading.value = false;
    return;
  }
  lastRunKey.value = runKey;

  touched.value = true;
  loading.value = true;
  errorMsg.value = "";
  results.value = [];
  gatewayHasMore.value = false;

  try {
    // In the Images tab, keep results strictly image-only (avoid "fast actions" like open link/CID
    // that would inflate counts without showing anything in the image grid).
    const base = type === "image" ? [] : buildFastResults(clean);
    const cidMetaPromise =
      safePage === 1 && clean && isCidLike(clean) ? enrichFastCidResult(base, clean, seq) : Promise.resolve();

    const profileId = await getActiveProfileId();

    const domainPromise =
      safePage === 1 && clean && (type === "site" || type === "all")
        ? resolveDomainForQuery(clean)
        : Promise.resolve(null);
    const gatewayPromise = searchGateways(profileId || "", clean, type, seq, {
      pageSize: gatewayPageSize,
      page: safePage,
    });

    const cidSitePromise =
      safePage === 1 && type === "all" && clean && isCidLike(clean) && !!profileId
        ? searchGateways(profileId || "", clean, "site", seq, { pageSize: 1, page: 1 })
        : Promise.resolve(null);

    const [bestDomain, gw, _cidMetaDone, cidSite] = await Promise.all([
      domainPromise,
      gatewayPromise,
      cidMetaPromise,
      cidSitePromise,
    ]);
    if (seq !== searchSeq) return;

    const gwResults = gw.items;
    gatewayHasMore.value = gw.maybeHasMore;

    let domainTags: string[] = [];
    if (safePage === 1 && bestDomain?.cid && profileId) {
      domainTags = await fetchTagsForCid(profileId, bestDomain.cid, seq);
    }
    if (seq !== searchSeq) return;

    if (safePage === 1 && bestDomain?.name) {
      const url = `lumen://${bestDomain.name}`;
      const favicon = bestDomain.cid ? faviconUrlForCid(bestDomain.cid) : null;
      base.push({
        id: `site:${bestDomain.name}`,
        title: bestDomain.name,
        url,
        thumbUrl: favicon || undefined,
        description: bestDomain.cid ? `CID ${bestDomain.cid}` : undefined,
        badges: domainTags.length ? domainTags.slice(0, 20) : [],
        kind: "site",
        site: {
          domain: bestDomain.name.toLowerCase(),
          cid: bestDomain.cid || null,
          wallet: null,
          owned: true,
        },
      });
    }

    if (safePage === 1 && !profileId && type === "all") {
      base.push({
        id: `hint:profile`,
        title: "Create a profile to enable gateway search",
        url: "lumen://home",
        description: "Gateway search requires a profile (wallet + signer).",
        kind: "link",
      });
    }

    if (safePage === 1 && !profileId && type === "site") {
      base.push({
        id: `hint:profile`,
        title: "Create a profile to enable gateway site search",
        url: "lumen://home",
        description: "Gateway site search requires a profile (wallet + signer).",
        kind: "link",
      });
    }

    let merged = [...base, ...gwResults];

    // Explore: when querying a raw CID, prefer the "Sites" entrypoint (gateway-derived) over the generic
    // "IPFS content" quick action + a duplicate HTML hit.
    if (safePage === 1 && type === "all" && clean && isCidLike(clean)) {
      const siteCandidate =
        cidSite && typeof cidSite === "object" && Array.isArray((cidSite as any).items)
          ? ((cidSite as any).items as ResultItem[]).find((r) => r && r.kind === "site")
          : null;

      if (siteCandidate) {
        const parsed = parseLumenIpfsUrl(siteCandidate.url);
        const best =
          parsed && parsed.cid
            ? ({
                id: `cid:${clean}`,
                title: siteCandidate.title,
                url: siteCandidate.url,
                description: siteCandidate.description,
                kind: "ipfs",
                badges: siteCandidate.badges,
                thumbUrl: siteCandidate.thumbUrl,
                media: "unknown",
                fileKind: "html",
              } as ResultItem)
            : siteCandidate;

        // Remove the generic "Open content by CID" quick action.
        merged = merged.filter((r) => !(r && r.kind === "ipfs" && r.id === `ipfs:${clean}`));

        // Remove HTML hits that still point at the raw CID root (we replace them with the entrypoint).
        merged = merged.filter((r) => {
          if (!r || r.kind !== "ipfs") return true;
          if (r.fileKind !== "html") return true;
          return !String(r.url || "").toLowerCase().startsWith(`lumen://ipfs/${clean.toLowerCase()}`);
        });

        // De-dupe by URL.
        const seen = new Set<string>();
        const out: ResultItem[] = [];
        for (const r of [best, ...merged]) {
          const key = String(r?.url || "").trim();
          if (!key) continue;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(r);
        }
        merged = out;
      }
    }

    if (type === "all") {
      merged = dedupeAllResults(merged);
    }

    if (type === "site") {
      const sitesAll = mergeAndRankSites(clean, merged);
      const start = (safePage - 1) * gatewayPageSize;
      const end = start + gatewayPageSize;
      const sites = sitesAll.slice(start, end);
      results.value = sites;
      void enrichSiteResultsWithEntryPaths(sites, seq);
      gatewayHasMore.value = sitesAll.length > end || gw.maybeHasMore;
    } else {
      results.value = merged;
    }
  } catch (e: any) {
    if (seq !== searchSeq) return;
    const errMessage = String(e?.message || e || "search_failed");
    errorMsg.value = errMessage;
    results.value = [];
    toast.error(`Search failed: ${errMessage}`);
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
    const { q: qs, type, page: p } = parseSearchUrl(url);
    if (type !== selectedType.value) selectedType.value = type;
    if (qs !== q.value) q.value = qs;
    activeQuery.value = qs;
    activeType.value = type;
    if (p !== page.value) page.value = p;
    runSearch(qs, type, p);
  },
  { immediate: true },
);

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    void refreshPinnedCids();
    if (activeQuery.value) {
      runSearch(activeQuery.value, activeType.value, page.value);
    }
  }
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
  background: var(--accent-primary);
  color: white;
  font-weight: 600;
  font-size: 0.9375rem;
  padding: 0.75rem 1.5rem;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.search-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.search-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.625rem;
  margin-top: 0.75rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1.5px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  padding: 0.625rem 1.25rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.pill svg {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.pill:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pill:hover:not(:disabled):not(.active) {
  border-color: var(--primary-a40);
  color: var(--text-primary);
  background: var(--bg-secondary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.pill:hover:not(:disabled) svg {
  transform: scale(1.1);
}

.pill.active {
  background: linear-gradient(135deg, var(--ios-blue) 0%, #5856d6 100%);
  border-color: transparent;
  color: white;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
}

.pill.active svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
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

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 0;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-num:hover {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
}

.page-num.active {
  background: var(--gradient-primary);
  border-color: var(--accent-primary);
  color: white;
  font-weight: 600;
}

.page-ellipsis {
  padding: 0 0.25rem;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.page-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-left: 0.5rem;
  white-space: nowrap;
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

.result-card.explore-image {
  align-items: stretch;
  padding: 0;
  gap: 0;
  min-height: 132px;
  max-height: 132px;
}

.result-card.explore-image .result-icon {
  width: 160px;
  height: auto;
  align-self: stretch;
  background: transparent;
  border: none;
  border-radius: 0;
}

.result-card.explore-image .safe-thumb--compact {
  border-radius: 0;
}

.result-card.explore-image .result-body {
  overflow: hidden;
  padding: 1.25rem 1.5rem;
}

.result-card.explore-image .badges {
  flex-wrap: nowrap;
  overflow: hidden;
}

.result-card.explore-image .badge {
  white-space: nowrap;
}

.result-card.explore-image:hover .result-icon {
  transform: none;
  box-shadow: 0 10px 30px var(--primary-a18);
}

/* Result type-specific icon colors */
.icon-site {
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.12) 0%, rgba(88, 86, 214, 0.12) 100%);
  color: var(--ios-blue);
}

.icon-ipfs {
  background: linear-gradient(135deg, rgba(48, 209, 88, 0.12) 0%, rgba(52, 199, 89, 0.12) 100%);
  color: var(--ios-green);
}

.icon-tx {
  background: linear-gradient(135deg, rgba(255, 159, 10, 0.12) 0%, rgba(255, 149, 0, 0.12) 100%);
  color: var(--ios-orange);
}

.icon-block {
  background: linear-gradient(135deg, rgba(88, 86, 214, 0.12) 0%, rgba(175, 82, 222, 0.12) 100%);
  color: var(--ios-purple, #af52de);
}

.icon-address {
  background: linear-gradient(135deg, rgba(90, 200, 250, 0.12) 0%, rgba(0, 122, 255, 0.12) 100%);
  color: var(--ios-teal, #5ac8fa);
}

.icon-link {
  background: linear-gradient(135deg, rgba(142, 142, 147, 0.12) 0%, rgba(99, 99, 102, 0.12) 100%);
  color: var(--ios-gray, #8e8e93);
}

/* Result type badges */
.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.result-type-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.result-metric {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  color: var(--text-secondary);
  background: rgba(142, 142, 147, 0.1);
}

.type-ipfs {
  background: rgba(48, 209, 88, 0.12);
  color: var(--ios-green);
}

.type-image {
  background: rgba(48, 209, 88, 0.12);
  color: var(--ios-green);
}

.type-html {
  background: rgba(0, 122, 255, 0.12);
  color: var(--ios-blue);
}

.type-pdf {
  background: rgba(255, 59, 48, 0.12);
  color: var(--ios-red);
}

.type-txt {
  background: rgba(142, 142, 147, 0.12);
  color: var(--ios-gray, #8e8e93);
}

.type-epub {
  background: rgba(175, 82, 222, 0.12);
  color: var(--ios-purple, #af52de);
}

.type-docx {
  background: rgba(90, 200, 250, 0.12);
  color: var(--ios-teal, #5ac8fa);
}

.type-tx {
  background: rgba(255, 159, 10, 0.12);
  color: var(--ios-orange);
}

.type-block {
  background: rgba(88, 86, 214, 0.12);
  color: var(--ios-purple, #af52de);
}

.type-address {
  background: rgba(90, 200, 250, 0.12);
  color: var(--ios-teal, #5ac8fa);
}

.type-link {
  background: rgba(142, 142, 147, 0.12);
  color: var(--ios-gray, #8e8e93);
}

/* Card accent colors by type */
.result-tx::before {
  background: linear-gradient(180deg, var(--ios-orange) 0%, rgba(255, 159, 10, 0.5) 100%);
}

.result-block::before {
  background: linear-gradient(180deg, var(--ios-purple, #af52de) 0%, rgba(175, 82, 222, 0.5) 100%);
}

.result-address::before {
  background: linear-gradient(180deg, var(--ios-teal, #5ac8fa) 0%, rgba(90, 200, 250, 0.5) 100%);
}

.result-ipfs::before {
  background: linear-gradient(180deg, var(--ios-green) 0%, rgba(48, 209, 88, 0.5) 100%);
}

.result-ipfs.file-html::before {
  background: linear-gradient(180deg, var(--ios-blue) 0%, rgba(0, 122, 255, 0.5) 100%);
}

.result-ipfs.file-pdf::before {
  background: linear-gradient(180deg, var(--ios-red) 0%, rgba(255, 59, 48, 0.5) 100%);
}

.result-ipfs.file-txt::before {
  background: linear-gradient(180deg, var(--ios-gray, #8e8e93) 0%, rgba(142, 142, 147, 0.5) 100%);
}

.result-ipfs.file-epub::before {
  background: linear-gradient(180deg, var(--ios-purple, #af52de) 0%, rgba(175, 82, 222, 0.5) 100%);
}

.result-ipfs.file-docx::before {
  background: linear-gradient(180deg, var(--ios-teal, #5ac8fa) 0%, rgba(90, 200, 250, 0.5) 100%);
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.safe-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-secondary);
}

.safe-thumb.blurred img {
  filter: blur(14px) saturate(0.85) brightness(0.85);
  transform: scale(1.06);
  transition: filter 180ms ease, transform 180ms ease;
}

.safe-thumb:not(.blurred) img {
  filter: none;
  transform: none;
  transition: filter 180ms ease, transform 180ms ease;
}

.safe-thumb-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.45rem 0.5rem;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.02),
    rgba(0, 0, 0, 0.55)
  );
}

.safe-thumb-reveal {
  width: 100%;
  border: none;
  border-radius: 0.5rem;
  padding: 0.45rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  cursor: pointer;
  pointer-events: auto;
}

.safe-thumb-reveal:hover {
  background: rgba(0, 0, 0, 0.45);
}

.safe-thumb--compact {
  border-radius: 0.5rem;
}

.safe-thumb-hide {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  cursor: pointer;
}

.safe-thumb-hide:hover {
  background: rgba(0, 0, 0, 0.5);
}

.safe-thumb-hide--compact {
  top: 0.25rem;
  right: 0.25rem;
  width: 1.65rem;
  height: 1.65rem;
}

.image-card .safe-thumb-hide {
  left: 0.5rem;
  right: auto;
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
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-smooth);
  position: relative;
  content-visibility: auto;
  contain-intrinsic-size: 240px 220px;
}

.image-card:hover {
  transform: translateY(-6px) scale(1.02);
  border-color: var(--primary-a40);
  box-shadow: 0 16px 32px var(--primary-a15);
}

.image-card-btn {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  display: block;
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
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
}

.image-metric {
  flex: 0 0 auto;
  white-space: nowrap;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
}

.image-badge {
  font-size: 0.67rem;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  border-radius: 999px;
  background: rgba(45, 95, 79, 0.08);
  color: var(--accent-primary);
  border: 1px solid rgba(45, 95, 79, 0.16);
  white-space: nowrap;
}

.image-badge-more {
  font-size: 0.67rem;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  white-space: nowrap;
  cursor: help;
  font-weight: 600;
}

.image-save-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
  backdrop-filter: blur(6px);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-save-btn:hover {
  transform: scale(1.06);
  color: var(--accent-primary);
  border-color: var(--primary-a30);
}

.image-save-btn.saved {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.image-save-btn.saved:hover {
  background: var(--error-red);
  border-color: var(--error-red);
  color: white;
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

.result-title--placeholder {
  font-size: 0.95rem;
  font-style: italic;
  font-weight: 500;
  opacity: 0.65;
  letter-spacing: 0;
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

.site-domain {
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-primary);
  font-weight: 600;
  opacity: 0.9;
}

.site-domain svg {
  flex: 0 0 auto;
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
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.result-desc--placeholder {
  font-size: 0.75rem;
  font-style: italic;
  opacity: 0.6;
}

.result-desc--code {
  margin: 0.5rem 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--primary-a06);
  border: 1px solid var(--primary-a12);
  border-radius: 0.5rem;
  padding: 0.4rem 0.55rem;
  line-height: 1.45;
}

.result-open {
  color: var(--text-secondary);
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
  font-weight: 600;
  font-size: 0.56rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--primary-a08);
  color: var(--accent-primary);
  border: 1px solid var(--primary-a20);
  transition: all 0.2s ease;
}

.badge-more {
  opacity: 0.85;
}

.result-card:hover .badge {
  background: var(--primary-a10);
  border-color: var(--primary-a30);
  transform: translateY(-1px);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 2rem;
  border-radius: var(--border-radius-xl);
  border: 2px dashed var(--border-color);
  background: var(--card-bg);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  margin-bottom: 1.5rem;
}

.empty-content {
  max-width: 400px;
}

.empty-state .empty-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.empty-state .empty-subtitle {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.empty-subtitle strong {
  color: var(--text-primary);
}

.empty-suggestions {
  text-align: left;
  padding: 1rem 1.25rem;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-md);
}

.suggestion-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 0.5rem;
}

.suggestion-list {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.7;
}

.suggestion-list code {
  font-size: 0.8125rem;
  padding: 0.15rem 0.4rem;
  background: var(--primary-a08);
  border-radius: 4px;
  color: var(--accent-primary);
}

/* Improved Skeleton */
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.skeleton-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  border-radius: var(--border-radius-xl);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  padding: 1.25rem 1.5rem;
}

.skeleton-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--border-radius-lg);
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.15) 0%, rgba(148, 163, 184, 0.25) 50%, rgba(148, 163, 184, 0.15) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
  min-width: 0;
}

.skeleton-title,
.skeleton-url,
.skeleton-desc {
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.15) 0%, rgba(148, 163, 184, 0.25) 50%, rgba(148, 163, 184, 0.15) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-title {
  height: 1.125rem;
  width: 60%;
}

.skeleton-url {
  height: 0.875rem;
  width: 40%;
  margin-top: 0.625rem;
}

.skeleton-desc {
  height: 2.5rem;
  width: 85%;
  margin-top: 0.625rem;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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
