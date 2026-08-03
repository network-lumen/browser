<template>
  <!-- ####### lumen://search SEARCH ####### -->
  <main
    ref="scrollRoot"
    class="flex-align-center flex-column w-full h-full min-h-full overflow-y-auto bg-primary relative overflow-x-hidden pt-32px pr-24px pb-80px pl-24px"
    @scroll.passive="onScroll"
    @keydown="onSlashShortcut"
  >
          <UiButton variant="none" type="button"
        title="How search works"
        aria-label="How search works"
        @click="openHowSearchWorks" class="border-radius-circle border-1 bg-secondary color-text-primary hover-bg-hover cursor-pointer flex-inline-align-justify-center active-translate-y-0 size-36px">
        <HelpCircle :size="18" />
      </UiButton>
    <section class="mt-15vh flex-column flex-inline-align-center gap-24px w-full relative flex z-1">
      <div class="bg-gradient-primary letter-spacing-n002 fw-900 text-56px gradient-text-clip">Lumen</div>
      <div class="text-14px txt-weight-light letter-spacing-015em text-uppercase color-text-tertiary">Search</div>

      <div class="flex-justify-center w-full">
        <div class="focus-within-lift-2px flex-align-center gap-12px border-radius-full bg-card shadow-md transition-all-03 pt-14px pr-16px pb-14px pl-20px w-min-820px-full border-color-primary-focus-within border-2-transparent shadow-shadow-focus-focus-within">
          <Search :size="18" class="color-text-secondary flex-0-0-auto" />
          <input
            ref="inputEl"
            v-model="q"
            type="text"
            class="flex-1-1-auto outline-none color-text-primary min-w-0 border-none bg-transparent text-16px"
            placeholder="Search the network"
            @keydown.enter.prevent="submit"
          />
          <UiButton
            variant="primary"
            class="hover-lift-2-scale-102-enabled active-not-disabled-y0-scale-98 disabled-fade-50"
            type="button"
            @click="submit"
            :disabled="loading"
          >
            Search
          </UiButton>
        </div>
      </div>

      <div class="flex-justify-center flex-wrap-wrap gap-10px mt-12px">
        <UiButton
          variant="tag"
          class="pill-tone-primary-indigo disabled-transform-none hover-lift-2-enabled-not-active fw-500 text-12px line-height-12 disabled-fade-50 border-color-primary-a30-hover-not-disabled-not-active color-text-primary-hover-not-disabled-not-active bg-secondary-hover-not-disabled-not-active shadow-none-disabled shadow-md-hover-not-disabled-not-active"
          type="button"
          :class="{ active: selectedType === 'site' }"
          @click="setType('site')"
        >
          <Globe :size="16" class="flex-shrink-0 transition-transform-02" />
          Sites
        </UiButton>
        <UiButton
          variant="tag"
          class="pill-tone-primary-indigo disabled-transform-none hover-lift-2-enabled-not-active fw-500 text-12px line-height-12 disabled-fade-50 border-color-primary-a30-hover-not-disabled-not-active color-text-primary-hover-not-disabled-not-active bg-secondary-hover-not-disabled-not-active shadow-none-disabled shadow-md-hover-not-disabled-not-active"
          type="button"
          :class="{ active: selectedType === 'image' }"
          @click="setType('image')"
        >
          <Image :size="16" class="flex-shrink-0 transition-transform-02" />
          Images
        </UiButton>
        <UiButton
          variant="tag"
          class="pill-tone-primary-indigo disabled-transform-none hover-lift-2-enabled-not-active fw-500 text-12px line-height-12 disabled-fade-50 border-color-primary-a30-hover-not-disabled-not-active color-text-primary-hover-not-disabled-not-active bg-secondary-hover-not-disabled-not-active shadow-none-disabled shadow-md-hover-not-disabled-not-active"
          type="button"
          :class="{ active: selectedType === 'all' }"
          @click="setType('all')"
        >
          <Compass :size="16" class="flex-shrink-0 transition-transform-02" />
          Explore everything
        </UiButton>
      </div>


    </section>

    <section v-if="touched" class="m-3rem-auto-0 relative z-1 p-0px pr-8px pb-8px pl-8px w-min-920px-full">
      <div class="flex-align-center-justify-space-between gap-16px mb-16px p-0px pr-4px pl-4px">
        <div v-if="errorMsg" class="text-13px fw-500 line-height-12 color-error">{{ errorMsg }}</div>
      </div>

      <div v-if="showLoadPrevious || loadingPrevious" class="flex-justify-center p-0px pb-16px">
        <UiButton variant="primary" type="button"
          :disabled="loadingPrevious"
          @click="loadPrevious" class="disabled-fade-50">
          <template v-if="loadingPrevious">Loading previous…</template>
          <template v-else>Previous results</template>
        </UiButton>
      </div>

      <ul v-if="loading" class="flex flex-column p-0px m-0px list-style-none gap-16px">
        <li v-for="i in 5" :key="i" class="flex-align-start gap-16px border-radius-20px border-default bg-card py-20px px-24px">
          <div class="bg-shimmer border-radius-16px flex-shrink-0 w-48px h-48px"></div>
          <div class="flex-1 min-w-0">
            <div class="bg-shimmer h-20px border-radius-6px w-60pct"></div>
            <div class="bg-shimmer h-14px border-radius-6px mt-8px w-40pct"></div>
            <div class="bg-shimmer h-40px border-radius-6px mt-8px w-85pct"></div>
          </div>
        </li>
      </ul>

      <UiEmptyState v-else-if="!results.length" class="border-radius-20px bg-card border-2-dashed-color" icon-size="80px" title="No results found">
        <Search :size="48" />
        <template #description>
          <p class="m-0px max-w-520px text-14px line-height-15">
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
          <div class="text-left border-radius-12px py-16px px-20px bg-secondary">
            <span class="txt-weight-light color-text-secondary text-13px block mb-8px">Try:</span>
            <ul class="line-height-15 m-0px color-text-secondary text-14px pl-20px">
              <li>Using different keywords</li>
              <li>Searching for a domain (e.g., <code class="text-13px bg-primary-a10 border-radius-4px color-primary py-4px px-6px">example.lmn</code>)</li>
              <li>Entering a CID, transaction hash, or address directly</li>
            </ul>
          </div>
        </template>
      </UiEmptyState>

      <div v-else-if="selectedType === 'image'" class="grid-cols-auto-fill-200 gap-16px grid">
        <UiCard padding="none" :shadow="false" radius="xl" v-for="(r, idx) in imageResults"
          :key="r.id"
          :data-result-index="idx" class="content-visibility-auto-240-220 hover-lift-6-scale-102 overflow-hidden shadow-sm relative transition-smooth-all border-color-primary-a30-hover hover-shadow-primary">
          <button
            type="button"
            class="hover-scale-106 top-50-bg-primary-a80-blur6 flex-align-justify-center size-28px border-radius-full color-text-secondary cursor-pointer absolute border-1 transition-all-02 z-1 right-8px hover-color-accent hover-border-primary-a30"
            :class="{ 'bg-accent border-color-primary color-white hover-bg-border-color-error': isPinnedImage(r) }"
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
            class="w-full p-0px cursor-pointer border-none block bg-transparent"
            @click="openResult(r)"
            :title="r.url"
          >
            <template v-if="shouldMountImageThumb(idx)">
              <div
                v-if="isSearchImageThumb(r) && !brokenThumbs[r.id]"
                class="w-full h-full relative overflow-hidden bg-secondary"
                :class="{ 'bg-shimmer': !thumbLoadedById[r.id] }"
                @click="onCompactThumbClick(r, $event)"
              >
                <button
                  v-if="showHideIcon(r)"
                  type="button"
                  class="top-6px left-8px right-auto z-1 flex-inline-align-justify-center h-32px border-radius-full cursor-pointer absolute border-none bg-black-a35 w-32px backdrop-blur-8 color-white-a92 hover-bg-black-a50"
                  title="Hide content"
                  @click.stop.prevent="hideThumb(r)"
                >
                  <EyeOff :size="16" />
                </button>
                <img
                  class="aspect-4-3 w-full object-fit-cover block bg-secondary"
                  :style="thumbFilterStyle(r)"
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
                <div v-if="shouldBlurThumb(r)" class="bg-gradient-thumb-overlay absolute py-8px px-10px left-0 right-0 bottom-0">
                  <div
                    class="w-full text-12px txt-weight-light cursor-pointer border-none border-radius-8px line-height-12 bg-black-a35 py-8px px-10px backdrop-blur-8 cursor-events-auto color-white-a92 hover-bg-black-a50"
                    @click.stop.prevent="revealThumb(r)"
                  >
                    {{ thumbBlurNoticeText(r) }}
                  </div>
                </div>
              </div>
              <div v-else-if="isSearchImageThumb(r) && brokenThumbs[r.id]" class="aspect-4-3 flex-align-justify-center w-full color-text-secondary bg-secondary">
                <Image :size="18" />
              </div>
              <img
                v-else-if="r.thumbUrl"
                class="aspect-4-3 w-full object-fit-cover block bg-secondary"
                :src="r.thumbUrl"
                alt=""
                :loading="imageThumbLoading(idx)"
                decoding="async"
                :fetchpriority="imageThumbFetchPriority(idx)"
                @load="markThumbLoaded(r.id)"
              />
              <div v-else class="aspect-4-3 flex-align-justify-center w-full color-text-secondary bg-secondary">
                <Image :size="18" />
              </div>
            </template>
            <div v-else class="aspect-4-3 flex-align-justify-center w-full color-text-tertiary bg-secondary">
              <Image :size="18" />
            </div>
          </button>
          <div class="flex-align-center gap-8px flex-justify-start pt-12px pr-12px pb-14px pl-12px">
            <div v-if="r.badges?.length" class="flex flex-wrap-wrap gap-6px flex-1 min-w-0">
              <span
                v-for="b in r.badges.slice(0, 4)"
                :key="`${r.id}:${b}`"
                class="border-radius-full color-primary text-11px line-height-1 bg-primary-a10 nowrap border-1-primary-a15 py-4px px-6px"
                >{{ b }}</span
              >
              <span
                v-if="r.badges.length > 4"
                class="cursor-help border-radius-full color-text-secondary txt-weight-light text-11px line-height-1 bg-primary border-1 nowrap py-4px px-6px"
                :title="r.badges.slice(4).join(', ')"
                >+{{ r.badges.length - 4 }}</span
              >
            </div>
          </div>
        </UiCard>
      </div>

      <ul v-else class="list-style-none p-0px m-0px flex flex-column gap-16px">
        <li
          v-for="(r, idx) in results"
          :key="r.id"
          :data-result-index="idx"
        >
          <button
            class="reveal-on-hover hover-translate-y4-x4 flex-align-start w-full border-radius-20px text-left cursor-pointer py-20px px-24px border-default bg-card shadow-sm relative overflow-hidden transition-smooth-all gap-16px hover-border-primary hover-shadow-primary hover-bg-card"
            :class="[ r.media ? `media-${r.media}` : '', isExploreCompact(r) ? 'media-explore-compact p-0px gap-0px flex-align-stretch min-h-132px max-h-132px' : '' ]"
            type="button"
            @click="openResult(r)"
          >
            <div class="absolute left-0 top-0 bottom-0 w-4px" :style="{ background: resultAccentGradient(r) }"></div>
            <div class="reveal-icon-target flex-align-justify-center border-radius-16px flex-0-0-auto color-primary overflow-hidden border-default transition-smooth-all w-48px h-48px bg-gradient-secondary" :style="resultIconStyle(r)">
              <div
                v-if="isSearchImageThumb(r) && !brokenThumbs[r.id]"
                class="w-full h-full relative overflow-hidden bg-secondary border-radius-8px"
                :class="{ 'bg-shimmer': !thumbLoadedById[r.id], 'border-radius-0': isExploreCompact(r) }"
                @click="onCompactThumbClick(r, $event)"
              >
                <button
                  v-if="showHideIcon(r)"
                  type="button"
                  class="top-6px right-4px z-1 h-24px flex-inline-align-justify-center border-radius-full cursor-pointer absolute border-none bg-black-a35 backdrop-blur-8 color-white-a92 w-24px hover-bg-black-a50"
                  title="Hide content"
                  @click.stop.prevent="hideThumb(r)"
                >
                  <EyeOff :size="14" />
                </button>
                <img
                  class="w-full h-full object-fit-cover"
                  :style="thumbFilterStyle(r)"
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
                class="w-full h-full object-fit-cover"
                :src="r.thumbUrl"
                alt=""
                @error="onFaviconError(r)"
              />
              <component v-else :is="iconFor(r)" :size="20" />
            </div>
            <div class="flex-1-1-auto min-w-0 py-20px px-24px" :class="{ 'overflow-hidden': isExploreCompact(r) }">
              <div class="flex-align-center gap-8px mb-4px">
                <span
                  v-if="r.kind !== 'site'"
                  class="flex-inline-align-center txt-weight-light text-uppercase text-11px letter-spacing-004em border-radius-4px py-4px px-6px"
                  :style="typeBadgeStyle(r)"
                >
                  {{ typeBadgeLabel(r) }}
                </span>
              </div>
              <div
                v-if="displayTitle(r)"
                class="reveal-color-accent-target transition-color-02 m-0px txt-weight-light color-text-primary text-18px line-height-14 letter-spacing-n001"
                :class="{ 'text-15px italic opacity-70 letter-spacing-0': isNoTitlePlaceholder(r) }"
              >
                {{ displayTitle(r) }}
              </div>
              <div
                v-if="r.kind === 'site' && r.site?.domain"
                class="mono flex-inline-align-center mt-8px gap-6px color-primary txt-weight-light text-13px opacity-85"
                :title="r.site.domain"
              >
                <Globe :size="14" class="flex-0-0-auto" />
                {{ r.site.domain }}
              </div>
              <div v-if="shouldShowResultUrl(r)" class="reveal-target mono mt-8px color-primary fw-500 text-13px truncate opacity-85 transition-opacity-02">{{ r.url }}</div>
              <pre
                v-if="displayTextPreviewList(r)"
                class="line-clamp-2 color-text-secondary mt-8px text-14px overflow-hidden break-word border-radius-8px mono pre-wrap m-0px py-8px px-10px bg-primary-a05 border-1-primary-a10"
                :class="{ 'is-placeholder-text': isNoTextPreviewPlaceholder(r) }"
                :title="displayTextPreviewHover(r)"
                v-text="displayTextPreviewList(r)"
              ></pre>
              <div
                v-else-if="displayDescription(r)"
                class="line-clamp-2 color-text-secondary mt-8px text-14px overflow-hidden"
                :class="{ 'is-placeholder-text': isNoDescriptionPlaceholder(r) }"
                :title="displayDescription(r)"
              >
                {{ displayDescription(r) }}
              </div>
              <div v-if="r.badges?.length" class="flex gap-8px mt-12px" :class="isExploreCompact(r) ? 'flex-wrap-nowrap overflow-hidden' : 'flex-wrap-wrap'">
                <span
                  v-for="b in visibleBadges(r)"
                  :key="`${r.id}:${b}`"
                  class="reveal-badge-target txt-weight-light border-radius-full color-primary bg-primary-a10 transition-all-02 border-1-primary-a20 py-4px px-6px text-10px nowrap"
                  >{{ b }}</span
                >
                <span
                  v-if="hiddenBadges(r).length"
                  class="reveal-badge-target txt-weight-light border-radius-full color-primary bg-primary-a10 transition-all-02 border-1-primary-a20 py-4px px-6px text-10px nowrap opacity-85"
                  :title="hiddenBadges(r).join(', ')"
                  >+{{ hiddenBadges(r).length }}</span
                >
              </div>
            </div>
            <ArrowUpRight :size="18" class="reveal-open-target color-text-secondary flex-0-0-auto mt-4px transition-all-03 opacity-55" />
          </button>
        </li>
      </ul>

      <div v-if="showLoadMore" class="flex-justify-center pt-20px pr-0px pb-8px pl-0px">
        <UiButton variant="primary" type="button"
          :disabled="loadingMore || loadingPrevious"
          @click="loadMore" class="disabled-fade-50">
          <template v-if="loadingMore">Loading…</template>
          <template v-else>More results</template>
        </UiButton>
      </div>

      <div ref="paginationSentinel" class="h-1px w-full" aria-hidden="true"></div>
    </section>

    <UiModal :model-value="showHowSearchWorks" panel-class="searchpage-help-modal w-min-760px-full" @update:model-value="closeHowSearchWorks">
      <template #header>
        <div class="flex-align-start gap-12px min-w-0">
          <div class="flex-inline-align-justify-center size-36px border-radius-12px color-text-primary flex-0-0-auto border-1-light bg-primary-a10" aria-hidden="true">
            <HelpCircle :size="18" />
          </div>
          <div>
            <h2 class="m-0px txt-weight-strong color-text-primary text-16px">How search works</h2>
            <p class="color-text-secondary text-14px m-0px mt-4px">Indexing, ranking, and how to get discovered.</p>
          </div>
        </div>
      </template>
          <div class="max-h-min-72vh-720px color-text-primary">
            <div class="grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
              <UiTitledCard title="What gets indexed">
                <p class="m-0px mt-8px color-text-secondary line-height-14">
                  Search results come from content indexed in the Lumen Cloud. When content is
                  uploaded to cloud storage, it’s scanned and tagged so it can be discovered by
                  keywords.
                </p>
                <div class="flex-align-start mt-12px border-radius-14px gap-10px py-12px px-16px bg-indigo-a08 border-1-indigo-a15">
                  <Sparkles :size="16" class="mt-0px color-text-primary flex-0-0-auto opacity-85" />
                  <div class="color-text-secondary line-height-14 text-14px">
                    Local-only content on your machine stays private and won’t appear in network
                    search.
                  </div>
                </div>
              </UiTitledCard>

              <UiTitledCard title="How to get indexed">
                <ol class="flex flex-column p-0px color-text-secondary list-style-none gap-8px line-height-14 m-0px mt-8px">
                  <li class="flex gap-10px">
                    <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">1</span>
                    <span class="min-w-0">
                      Upload your content to the cloud (Drive / cloud upload).
                    </span>
                  </li>
                  <li class="flex gap-10px">
                    <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">2</span>
                    <span class="min-w-0">
                      Indexing is async — it can take a bit before results show up.
                    </span>
                  </li>
                  <li class="flex gap-10px">
                    <span class="flex-inline-align-justify-center flex-0-0-auto w-24px h-24px border-radius-10px border-1-light bg-card color-text-tertiary txt-weight-strong text-12px mt-005rem">3</span>
                    <span class="min-w-0">
                      For websites: publish a folder with an <code>index.html</code> entrypoint.
                    </span>
                  </li>
                </ol>
              </UiTitledCard>

              <UiTitledCard title="How queries work">
                <ul class="list-style-disc pl-20px color-text-secondary line-height-14 m-0px mt-8px">
                  <li class="m-0px mt-8px mb-8px">
                    Queries are tokenized; the index uses an inverted map (token → content) to find
                    matches efficiently.
                  </li>
                  <li class="m-0px mt-8px mb-8px">
                    Very short queries can behave like “Explore” (show recent content) instead of
                    strict keyword matching.
                  </li>
                  <li class="m-0px mt-8px mb-8px">
                    Tabs switch mode: <strong>Sites</strong>, <strong>Images</strong>, or
                    <strong>Explore everything</strong>.
                  </li>
                </ul>
              </UiTitledCard>

              <UiTitledCard title="How results are ranked">
                <ul class="list-style-disc pl-20px color-text-secondary line-height-14 m-0px mt-8px">
                  <li class="m-0px mt-8px mb-8px"><strong>Relevance</strong>: token matches in extracted tags/text.</li>
                  <li class="m-0px mt-8px mb-8px"><strong>Freshness</strong>: recently seen content tends to rank higher.</li>
                  <li class="m-0px mt-8px mb-8px"><strong>Popularity</strong>: signals like views and saves.</li>
                  <li class="m-0px mt-8px mb-8px"><strong>Availability</strong>: prefer content that is reachable and healthy.</li>
                  <li class="m-0px mt-8px mb-8px"><strong>Verified sites</strong>: linked domains can be boosted.</li>
                </ul>
              </UiTitledCard>

              <p class="color-text-secondary border-radius-14px border-1-light bg-primary text-14px py-12px px-16px m-0px mt-4px grid-col-full">
                Results can vary while indexing is in progress and as the network evolves.
              </p>
            </div>
          </div>
    </UiModal>

  </main>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiTitledCard from '../../ui/UiTitledCard.vue';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useTabLoadingSync } from "../useTabLoading";
import { useInternalLumen } from '../../composables/useInternalLumen';
import {
  ArrowUpRight,
  Bookmark,
  Compass,
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
  HelpCircle,
} from "lucide-vue-next";
import { localIpfsGatewayBase } from "../services/contentResolver";
import { appSettingsState } from "../services/appSettings";
import { clamp01 } from "../services/coerce";
import { useToast } from "../../composables/useToast";
import {
  getThumbSafetyService,
  blockedCategories,
  isBlockedBySettings,
  isGreyZoneByTags,
  shouldSkipAnalysisAndRenderClear,
  type ThumbSafetyBlockedCategory,
  type ThumbSafetyScores,
} from "./searchSafety/thumbSafetyService";
import type {
  SearchType,
  ResultItem,
  GatewayView,
  SearchCursor,
  SearchRouteCursorGateway,
  SearchRouteCursor,
  ParsedSearchUrl,
  SearchPageCursorState,
  GatewaySearchResult,
  GatewaySearchHit,
  GatewaySiteSearchResult,
} from "../../types/searchPage";

const toast = useToast();

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
const loadingMore = ref(false);
const errorMsg = ref("");
const results = ref<ResultItem[]>([]);
const imageResults = computed(() =>
  results.value.filter((r) => r.media === "image" || !!r.thumbUrl),
);
const inputEl = ref<HTMLInputElement | null>(null);
const scrollRoot = ref<HTMLElement | null>(null);
const paginationSentinel = ref<HTMLElement | null>(null);
const showHowSearchWorks = ref(false);
const activeQuery = ref("");
const activeType = ref<SearchType>("site");
const gatewayHasPrev = ref(false);
const gatewayPrevCursor = ref<SearchRouteCursor | null>(null);
const gatewayHasMore = ref(false);
const gatewayNextCursor = ref<SearchRouteCursor | null>(null);
const gatewayPageSize = 12;
const activeGateway = ref<GatewayView | null>(null);
const pageCursorStates = ref<SearchPageCursorState[]>([]);
const activeUrlCursor = ref<SearchRouteCursor | null>(null);
const activeUrlGatewayKey = ref("");
const firstVisibleResultIdx = ref(0);
let scrollRaf = 0;
let loadMoreObserver: IntersectionObserver | null = null;
let restoringUrlState = false;
let suppressAutoLoadUntil = 0;
const loadingPrevious = ref(false);

useTabLoadingSync(loading);

const lastRunKey = ref("");
let searchSeq = 0;

const gatewaysCache = ref<{ at: number; items: GatewayView[] }>({
  at: 0,
  items: [],
});

const GATEWAY_HEALTH_TTL_MS = 10 * 60 * 1000;
const gatewayHealthCache = new Map<string, { at: number; ok: boolean; baseUrl?: string }>();

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const list = Array.isArray(items) ? items : [];
  const n = Number(concurrency);
  const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  const results = new Array(list.length) as R[];
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= list.length) return;
      results[i] = await mapper(list[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function gatewayHealthKey(g: GatewayView): string {
  const base =
    normalizeBaseUrlLike(String(g?.baseUrl || "")) ||
    normalizeBaseUrlLike(String(g?.endpoint || ""));
  const key = String(base || g?.endpoint || "")
    .trim()
    .toLowerCase();
  return key;
}

async function filterAliveGatewaysForPqSearch(
  list: GatewayView[],
  seq: number,
): Promise<GatewayView[]> {
  try {
    const gwApi = useInternalLumen()?.gateway;
    if (!gwApi || typeof gwApi.checkAlive !== "function") return list;

    const now = Date.now();
    const checked = await mapWithConcurrency(list, 4, async (g) => {
      const key = gatewayHealthKey(g);
      if (!key) return { gateway: g, ok: true };

      const cached = gatewayHealthCache.get(key);
      if (cached && now - cached.at < GATEWAY_HEALTH_TTL_MS) {
        if (!g.baseUrl && cached.baseUrl) g.baseUrl = cached.baseUrl;
        return { gateway: g, ok: cached.ok };
      }

      const res = await gwApi
        .checkAlive({ endpoint: g.endpoint, baseUrl: g.baseUrl, timeoutMs: 2500 })
        .catch(() => null);
      const ok = !!res?.ok;
      const baseUrl = normalizeBaseUrlLike(String(res?.baseUrl || "")) || undefined;

      gatewayHealthCache.set(key, { at: now, ok, baseUrl });
      if (baseUrl) gatewayHealthCache.set(baseUrl.toLowerCase(), { at: now, ok, baseUrl });

      if (!g.baseUrl && baseUrl) g.baseUrl = baseUrl;
      return { gateway: g, ok };
    });

    if (seq !== searchSeq) return [];

    const alive = checked.filter((x) => x && x.ok).map((x) => x.gateway);
    return alive;
  } catch {
    return list;
  }
}

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
const thumbCorsDisabledByOrigin = ref<Record<string, true>>({});
const thumbCorsProbeById = new Set<string>();
const thumbLocalFallbackTriedById = new Set<string>();
const thumbLoadedById = ref<Record<string, true>>({});
const hiddenThumbHashes = ref<Record<string, true>>({});
const hiddenThumbUrls = ref<Record<string, true>>({});

function isSearchImageThumb(r: ResultItem): boolean {
  return r.media === "image" && !!r.thumbUrl;
}

function markThumbLoaded(id: string): void {
  const key = String(id || "").trim();
  if (!key) return;
  if (thumbLoadedById.value[key]) return;
  thumbLoadedById.value[key] = true;
}

function originFromUrl(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function normalizeBaseUrlLike(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function imageThumbUrlForGateway(gateway: GatewayView, cid: string, pathSuffix = ""): string {
  const cleanCid = String(cid || "").trim();
  const localBase = localIpfsGatewayBase().replace(/\/+$/, "");
  const suffix = safeEncodedPathSuffix(pathSuffix);

  const directBase = normalizeBaseUrlLike(gateway?.baseUrl || "");
  if (directBase) return `${directBase}/ipfs/${cleanCid}${suffix}`;

  const endpoint = String(gateway?.endpoint || "").trim();
  if (!endpoint) return `${localBase}/ipfs/${cleanCid}${suffix}`;

  try {
    const u = new URL(endpoint);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return `${localBase}/ipfs/${cleanCid}${suffix}`;
    }
    const path = String(u.pathname || "");
    // If the endpoint includes a path (e.g. `/api`), use origin as a best-effort guess.
    const base = path && path !== "/" ? originFromUrl(endpoint) : normalizeBaseUrlLike(endpoint);
    return `${String(base || localBase).replace(/\/+$/, "")}/ipfs/${cleanCid}${suffix}`;
  } catch {
    return `${localBase}/ipfs/${cleanCid}${suffix}`;
  }
}

function extractIpfsCidAndSubpathFromHttpUrl(
  url: string,
): { cid: string; subpath: string } | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const m = raw.match(/\/ipfs\/([^/?#]+)(\/[^?#]*)?/i);
  if (!m || !m[1]) return null;
  const cid = String(m[1]).trim();
  const subpath = String(m[2] || "").trim();
  return cid ? { cid, subpath } : null;
}

function switchThumbToLocalGateway(r: ResultItem): boolean {
  if (!r || !r.thumbUrl) return false;

  const parsed = extractIpfsCidAndSubpathFromHttpUrl(r.thumbUrl);
  const cid = String(r.thumbCid || parsed?.cid || "").trim();
  if (!cid) return false;
  const subpath = parsed?.cid === cid ? parsed.subpath : "";

  const localBase = localIpfsGatewayBase().replace(/\/+$/, "");
  const desired = `${localBase}/ipfs/${cid}${subpath}`;

  const cur = String(r.thumbUrl || "").trim();
  if (!cur) return false;
  if (cur === desired) return false;
  if (cur.startsWith(`${localBase}/ipfs/`)) return false;

  r.thumbUrl = desired;

  // Retry CORS once on the local gateway (it may be configured).
  if (thumbCorsDisabledById.value[r.id]) {
    const next = { ...thumbCorsDisabledById.value };
    delete next[r.id];
    thumbCorsDisabledById.value = next;
  }

  return true;
}

function corsAttrForThumb(r: ResultItem): string | null {
  if (!isSearchImageThumb(r)) return null;
  if (!isGreyZoneByTags(r.badges || [])) return null;
  if (thumbCorsDisabledById.value[r.id]) return null;
  const origin = originFromUrl(r.thumbUrl || "");
  if (origin && thumbCorsDisabledByOrigin.value[origin]) return null;
  return "anonymous";
}

const IMAGE_EAGER_COUNT = 6;
const IMAGE_HIGH_PRIORITY_COUNT = 3;
const IMAGE_RENDER_BEHIND = 8;
const IMAGE_RENDER_AHEAD = 20;
const LOAD_PREVIOUS_SCROLL_THRESHOLD_PX = 240;
const LOAD_MORE_SCROLL_THRESHOLD_PX = 720;
const RESTORE_AUTO_LOAD_COOLDOWN_MS = 500;

function imageThumbLoading(idx: number): "eager" | "lazy" {
  return idx < IMAGE_EAGER_COUNT ? "eager" : "lazy";
}

function imageThumbFetchPriority(idx: number): "high" | "auto" {
  return idx < IMAGE_HIGH_PRIORITY_COUNT ? "high" : "auto";
}

function shouldMountImageThumb(idx: number): boolean {
  const index = Math.max(0, Math.floor(Number(idx) || 0));
  if (selectedType.value !== "image") return true;
  if (index < IMAGE_EAGER_COUNT) return true;
  const start = Math.max(0, firstVisibleResultIdx.value - IMAGE_RENDER_BEHIND);
  const end = firstVisibleResultIdx.value + IMAGE_RENDER_AHEAD;
  return index >= start && index <= end;
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
  markThumbLoaded(r.id);
  if (!isGreyZoneByTags(r.badges || [])) return;

  const imgEl = ev.target as HTMLImageElement | null;
  if (thumbCorsProbeById.has(r.id)) {
    thumbCorsProbeById.delete(r.id);
    // Only disable origin-wide CORS if we successfully loaded the image without a CORS attribute.
    // This avoids breaking safe analysis when the gateway actually supports CORS.
    const corsAttr = imgEl?.getAttribute("crossorigin");
    if (!corsAttr) {
      const origin = originFromUrl(r.thumbUrl || "");
      if (origin) {
        thumbCorsDisabledByOrigin.value = { ...thumbCorsDisabledByOrigin.value, [origin]: true };
      }
    }
  }

  maybeApplyCachedDecision(r);
  if (grantedClearThumbIds.value[r.id]) return;

  if (!imgEl || !imgEl.complete || imgEl.naturalWidth <= 0) return;
  scheduleThumbAnalysis(r, imgEl);
}

function onThumbError(r: ResultItem): void {
  // If the gateway doesn't support CORS, retry without it (thumbnail stays blurred).
  if (!isSearchImageThumb(r)) return;
  if (corsAttrForThumb(r) === "anonymous") {
    thumbCorsProbeById.add(r.id);
    thumbCorsDisabledById.value = { ...thumbCorsDisabledById.value, [r.id]: true };
    return;
  }
  if (!thumbLocalFallbackTriedById.has(r.id) && switchThumbToLocalGateway(r)) {
    thumbLocalFallbackTriedById.add(r.id);
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
    thumbCorsProbeById.add(r.id);
    thumbCorsDisabledById.value = { ...thumbCorsDisabledById.value, [r.id]: true };
    return;
  }
  if (!thumbLocalFallbackTriedById.has(r.id) && switchThumbToLocalGateway(r)) {
    thumbLocalFallbackTriedById.add(r.id);
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

function parseIpfsLikeQuery(input: string): { cid: string; subpath: string } | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const lumenParsed = parseLumenIpfsUrl(raw);
  if (lumenParsed) {
    const cid = String(lumenParsed.cid || "").trim();
    const subpath = lumenParsed.subpath ? `/${lumenParsed.subpath}` : "";
    return cid ? { cid, subpath } : null;
  }

  const m = raw.match(/^\/?ipfs\/([^\/?#]+)(\/[^?#]*)?$/i);
  if (!m || !m[1]) return null;

  const cid = String(m[1]).trim();
  const subpathRaw = String(m[2] || "").trim();
  const subpath = subpathRaw === "/" ? "" : subpathRaw;
  return cid ? { cid, subpath } : null;
}

function normalizeQueryForGatewaySearch(input: string): {
  raw: string;
  gatewayQuery: string;
  cidForDirect: string | null;
  ipfsLike: { cid: string; subpath: string } | null;
} {
  const raw = String(input || "").trim();
  if (!raw) {
    return { raw: "", gatewayQuery: "", cidForDirect: null, ipfsLike: null };
  }

  if (isCidLike(raw)) {
    return { raw, gatewayQuery: raw, cidForDirect: raw, ipfsLike: null };
  }

  const ipfsLike = parseIpfsLikeQuery(raw);
  if (!ipfsLike || !isCidLike(ipfsLike.cid)) {
    return { raw, gatewayQuery: raw, cidForDirect: null, ipfsLike: null };
  }

  if (!ipfsLike.subpath) {
    return {
      raw,
      gatewayQuery: ipfsLike.cid,
      cidForDirect: ipfsLike.cid,
      ipfsLike,
    };
  }

  const encodedPath = encodeUrlPath(ipfsLike.subpath);
  const gatewayQuery = encodedPath
    ? `lumen://ipfs/${ipfsLike.cid}/${encodedPath}`
    : `lumen://ipfs/${ipfsLike.cid}`;
  return { raw, gatewayQuery, cidForDirect: null, ipfsLike };
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
  const api: any = useInternalLumen() || null;
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

  const httpGet = useInternalLumen()?.httpGet;
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

  const updates = new Map<string, ResultItem>();
  for (const r of list) {
    if (seq !== searchSeq) return;
    if (!r || r.kind !== "site") continue;
    const itemId = String(r.id || "").trim();
    if (!itemId) continue;

    // Domain sites are handled by SitePage (it already tries /index.html).
    const domain = String(r.site?.domain || "").trim();
    if (domain) continue;

    const parsed = parseLumenIpfsUrl(r.url);
    if (!parsed) continue;
    if (parsed.subpath) continue;

    const cid = String(r.site?.entryCid || r.site?.cid || parsed.cid || "").trim();
    if (!cid) continue;

    const resolved = await resolveHtmlEntryForCidRoot(cid);
    if (seq !== searchSeq) return;

    if (resolved.isDir && !resolved.entryPath) continue;

    if (resolved.entryPath) {
      const encoded = encodeUrlPath(resolved.entryPath);
      const url = encoded ? `lumen://ipfs/${cid}/${encoded}` : `lumen://ipfs/${cid}`;
      const faviconCid = String(r.site?.cid || cid).trim();
      const thumbUrl =
        r.thumbUrl ||
        (faviconCid ? `${localIpfsGatewayBase()}/ipfs/${faviconCid}/favicon.ico` : undefined);
      updates.set(itemId, {
        ...r,
        url,
        thumbUrl,
        site: {
          ...(r.site || {}),
          entryCid: cid,
          entryPath: resolved.entryPath,
        },
      });
    }
  }

  if (seq !== searchSeq) return;
  if (!updates.size) return;
  results.value = results.value.map((item) => {
    const itemId = String(item?.id || "").trim();
    return updates.get(itemId) || item;
  });
}

function isPinnedImage(result: ResultItem): boolean {
  const cid = extractCidFromUrl(result.url);
  return cid ? pinnedCids.value.includes(cid) : false;
}

async function refreshPinnedCids() {
  try {
    const res = await useInternalLumen()?.ipfsPinList?.().catch(() => null);
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
    const api: any = useInternalLumen() || null;
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

function onSlashShortcut(e: KeyboardEvent) {
  if (e.key !== "/") return;
  const active = document.activeElement;
  const isTyping =
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable);
  if (isTyping) return;
  e.preventDefault();
  focusInput();
}

function openHowSearchWorks() {
  showHowSearchWorks.value = true;
}

function closeHowSearchWorks() {
  showHowSearchWorks.value = false;
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
  void nextTick().then(() => {
    refreshLoadMoreObserver();
    scheduleScrollUpdate();
  });
});

onBeforeUnmount(() => {
  if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
  scrollRaf = 0;
  disconnectLoadMoreObserver();
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

function resultAccentGradient(r: ResultItem): string {
  if (!r) return "var(--gradient-brand)";
  if (r.kind === "tx") return "linear-gradient(180deg, var(--color-warning) 0%, rgba(var(--color-warning-rgb), 0.5) 100%)";
  if (r.kind === "block") return "linear-gradient(180deg, var(--color-purple) 0%, rgba(var(--color-purple-rgb), 0.5) 100%)";
  if (r.kind === "address") return "linear-gradient(180deg, var(--color-secondary) 0%, rgba(var(--color-secondary-rgb), 0.5) 100%)";
  if (r.kind === "ipfs") {
    switch (r.fileKind) {
      case "epub": return "linear-gradient(180deg, var(--color-purple) 0%, rgba(var(--color-purple-rgb), 0.5) 100%)";
      case "docx": return "linear-gradient(180deg, var(--color-secondary) 0%, rgba(var(--color-secondary-rgb), 0.5) 100%)";
      case "html": return "linear-gradient(180deg, var(--color-primary) 0%, rgba(var(--color-primary-rgb), 0.5) 100%)";
      case "pdf": return "linear-gradient(180deg, var(--color-error) 0%, rgba(var(--color-error-rgb), 0.5) 100%)";
      case "txt": return "linear-gradient(180deg, var(--text-tertiary) 0%, var(--fill-tertiary) 100%)";
      default: return "linear-gradient(180deg, var(--color-success) 0%, rgba(var(--color-success-rgb), 0.5) 100%)";
    }
  }
  return "var(--gradient-brand)";
}

function thumbFilterStyle(r: ResultItem): Record<string, string> {
  const transition = "filter 180ms ease, transform 180ms ease";
  if (shouldBlurThumb(r)) {
    return { filter: "blur(14px) saturate(0.85) brightness(0.85)", transform: "scale(1.06)", transition };
  }
  return { filter: "none", transform: "none", transition };
}

function isExploreCompact(r: ResultItem): boolean {
  return selectedType.value === "all" && r?.media === "image";
}

function resultIconStyle(r: ResultItem): Record<string, string> {
  if (isExploreCompact(r)) {
    return { width: "160px", height: "auto", alignSelf: "stretch", background: "transparent", border: "none", borderRadius: "0" };
  }
  switch (r?.kind) {
    case "site":
      return { background: "linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.12) 0%, rgba(var(--color-indigo-rgb), 0.12) 100%)", color: "var(--color-primary)" };
    case "tx":
      return { background: "rgba(var(--color-warning-rgb), 0.12)" };
    case "block":
      return { background: "linear-gradient(135deg, rgba(var(--color-indigo-rgb), 0.12) 0%, rgba(var(--color-purple-rgb), 0.12) 100%)", color: "var(--color-purple)" };
    case "address":
      return { background: "linear-gradient(135deg, rgba(var(--color-secondary-rgb), 0.12) 0%, rgba(var(--color-primary-rgb), 0.12) 100%)", color: "var(--color-secondary)" };
    case "link":
      return { background: "var(--fill-tertiary)" };
    default:
      return { background: "var(--fill-success)" };
  }
}

function typeBadgeStyle(r: ResultItem): Record<string, string> {
  if (r && r.kind === "ipfs") {
    switch (r.fileKind || "unknown") {
      case "epub": return { background: "rgba(var(--color-purple-rgb), 0.12)", color: "var(--color-purple)" };
      case "docx": return { background: "rgba(var(--color-secondary-rgb), 0.12)", color: "var(--color-secondary)" };
      case "html": return { background: "rgba(var(--color-primary-rgb), 0.12)", color: "var(--color-primary)" };
      case "pdf": return { background: "var(--fill-error)" };
      case "txt": return { background: "var(--fill-tertiary)" };
      default: return { background: "var(--fill-success)" };
    }
  }
  switch (r?.kind) {
    case "tx": return { background: "rgba(var(--color-warning-rgb), 0.12)" };
    case "block": return { background: "rgba(var(--color-indigo-rgb), 0.12)", color: "var(--color-purple)" };
    case "address": return { background: "rgba(var(--color-secondary-rgb), 0.12)", color: "var(--color-secondary)" };
    case "link": return { background: "var(--fill-tertiary)" };
    default: return {};
  }
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
  if (isCidTitle(r.title)) return false;
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

function normalizeSearchCursor(raw: any): SearchCursor | null {
  if (!raw) return null;
  let cur = raw;
  if (typeof cur === "string") {
    const s = cur.trim();
    if (!s) return null;
    try {
      cur = JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (!cur || typeof cur !== "object") return null;
  const score = Number((cur as any).score);
  const id = String((cur as any).id || "").trim();
  if (!Number.isFinite(score) || !id) return null;
  const rankAtRaw = (cur as any).rankAt ?? (cur as any).rank_at ?? null;
  const rankAtNum = Number(rankAtRaw);
  const rankAt =
    Number.isFinite(rankAtNum) && rankAtNum > 0 ? Math.floor(rankAtNum) : null;
  return rankAt ? { score, id, rankAt } : { score, id };
}

function searchCursorRankAt(cursor: SearchCursor | null): number | null {
  const rankAt = Number(cursor?.rankAt ?? null);
  return Number.isFinite(rankAt) && rankAt > 0 ? Math.floor(rankAt) : null;
}

function encodeSearchUrlState(raw: string): string {
  try {
    const bytes = new TextEncoder().encode(String(raw || ""));
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  } catch {
    return "";
  }
}

function decodeSearchUrlState(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = window.atob(`${normalized}${padding}`);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function normalizeSearchRouteAnchorId(raw: any): string {
  return String(raw || "").trim();
}

function parseSearchRouteCursorPayload(raw: any): SearchRouteCursor | null {
  if (!raw || typeof raw !== "object") return null;
  const rankAtRaw = (raw as any).ra ?? (raw as any).rankAt ?? (raw as any).rank_at ?? null;
  const rankAtNum = Number(rankAtRaw);
  const rankAt =
    Number.isFinite(rankAtNum) && rankAtNum > 0 ? Math.floor(rankAtNum) : null;
  const anchorId = normalizeSearchRouteAnchorId(
    (raw as any).a ?? (raw as any).anchorId ?? (raw as any).anchor_id,
  );
  const entriesRaw = Array.isArray((raw as any).g)
    ? (raw as any).g
    : Array.isArray((raw as any).gateways)
      ? (raw as any).gateways
      : [];

  const entries: SearchRouteCursorGateway[] = [];
  const seen = new Set<string>();
  for (const entry of entriesRaw) {
    const rawId = Array.isArray(entry)
      ? entry[0]
      : (entry as any)?.i ?? (entry as any)?.id ?? (entry as any)?.gatewayId;
    const id = String(rawId || "").trim();
    const hasCursorField = Array.isArray(entry)
      ? entry.length > 1
      : !!entry &&
        typeof entry === "object" &&
        (Object.prototype.hasOwnProperty.call(entry, "c") ||
          Object.prototype.hasOwnProperty.call(entry, "cursor"));
    const cursorRaw = Array.isArray(entry) ? entry[1] : (entry as any)?.c ?? (entry as any)?.cursor;
    const cursor = normalizeSearchCursor(cursorRaw);
    const key = id.toLowerCase();
    if (!id || (!cursor && !hasCursorField) || seen.has(key)) continue;
    seen.add(key);
    entries.push({ id, cursor });
  }

  if (!entries.length && !rankAt && !anchorId) return null;
  const routeCursor: SearchRouteCursor = rankAt
    ? { version: 1, rankAt, gateways: entries }
    : { version: 1, gateways: entries };
  if (anchorId) routeCursor.anchorId = anchorId;
  return routeCursor;
}

function normalizeSearchRouteCursor(raw: any): SearchRouteCursor | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value) return null;

    const decoded = decodeSearchUrlState(value);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded);
        const routeCursor = parseSearchRouteCursorPayload(parsed);
        if (routeCursor) return routeCursor;
      } catch {
        // ignore
      }
    }

    try {
      const parsed = JSON.parse(value);
      return parseSearchRouteCursorPayload(parsed);
    } catch {
      return null;
    }
  }
  return parseSearchRouteCursorPayload(raw);
}

function searchRouteCursorRankAt(cursor: SearchRouteCursor | null): number | null {
  const cur = normalizeSearchRouteCursor(cursor);
  const rankAt = Number(cur?.rankAt ?? null);
  if (Number.isFinite(rankAt) && rankAt > 0) return Math.floor(rankAt);
  for (const entry of cur?.gateways || []) {
    const fromCursor = searchCursorRankAt(entry.cursor);
    if (fromCursor) return fromCursor;
  }
  return null;
}

function serializeSearchRouteCursor(cursor: SearchRouteCursor | null): string {
  const cur = normalizeSearchRouteCursor(cursor);
  if (!cur) return "";
  const payload: Record<string, any> = {
    v: 1,
    g: cur.gateways.map((entry) => ({
      i: String(entry.id || "").trim(),
      c: normalizeSearchCursor(entry.cursor),
    })),
  };
  const rankAt = searchRouteCursorRankAt(cur);
  if (rankAt) payload.ra = rankAt;
  if (cur.anchorId) payload.a = cur.anchorId;
  return encodeSearchUrlState(JSON.stringify(payload));
}

function searchRouteCursorKey(cursor: SearchRouteCursor | null): string {
  return serializeSearchRouteCursor(cursor);
}

function pageSearchRouteCursor(cursor: SearchRouteCursor | null): SearchRouteCursor | null {
  const cur = normalizeSearchRouteCursor(cursor);
  if (!cur || !cur.gateways.length) return null;
  const rankAt = searchRouteCursorRankAt(cur);
  return buildSearchRouteCursor(rankAt, cur.gateways);
}

function searchRouteCursorPageKey(cursor: SearchRouteCursor | null): string {
  return serializeSearchRouteCursor(pageSearchRouteCursor(cursor));
}

function cloneSearchRouteCursor(cursor: SearchRouteCursor | null): SearchRouteCursor | null {
  return normalizeSearchRouteCursor(cursor);
}

function buildSearchRouteCursor(
  rankAt: number | null,
  gateways: SearchRouteCursorGateway[],
  anchorId: string | null = null,
): SearchRouteCursor | null {
  const entries: SearchRouteCursorGateway[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(gateways) ? gateways : []) {
    const id = String(entry?.id || "").trim();
    const cursor = normalizeSearchCursor(entry?.cursor);
    const key = id.toLowerCase();
    if (!id || seen.has(key)) continue;
    seen.add(key);
    entries.push({ id, cursor });
  }
  const cleanRankAt =
    Number.isFinite(Number(rankAt)) && Number(rankAt) > 0 ? Math.floor(Number(rankAt)) : null;
  const cleanAnchorId = normalizeSearchRouteAnchorId(anchorId);
  if (!entries.length && !cleanRankAt && !cleanAnchorId) return null;
  const routeCursor: SearchRouteCursor = cleanRankAt
    ? { version: 1, rankAt: cleanRankAt, gateways: entries }
    : { version: 1, gateways: entries };
  if (cleanAnchorId) routeCursor.anchorId = cleanAnchorId;
  return routeCursor;
}

function withSearchRouteAnchor(cursor: SearchRouteCursor | null, anchorId: string | null): SearchRouteCursor | null {
  const cleanAnchorId = normalizeSearchRouteAnchorId(anchorId);
  const cur = normalizeSearchRouteCursor(cursor);
  const rankAt =
    searchRouteCursorRankAt(cur) ||
    searchRouteCursorRankAt(gatewayNextCursor.value) ||
    searchRouteCursorRankAt(activeUrlCursor.value);
  const gateways = cur?.gateways || [];
  return buildSearchRouteCursor(rankAt, gateways, cleanAnchorId);
}

function normalizeGatewayRouteKey(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const base = normalizeBaseUrlLike(raw);
  return String(base || raw).trim().toLowerCase();
}

function gatewayRouteIdForUrl(input: GatewayView | string | null): string {
  if (typeof input === "string") return String(input || "").trim();
  const id = String(input?.id || "").trim();
  if (id) return id;
  return String(input?.endpoint || "").trim();
}

function gatewayMatchesRouteKey(gateway: GatewayView | null | undefined, rawKey: string): boolean {
  const target = normalizeGatewayRouteKey(rawKey);
  if (!gateway || !target) return false;
  return (
    normalizeGatewayRouteKey(String(gateway.id || "")) === target ||
    normalizeGatewayRouteKey(String(gateway.endpoint || "")) === target ||
    normalizeGatewayRouteKey(String(gateway.baseUrl || "")) === target
  );
}

function isSearchRouteUrl(raw: string): boolean {
  const value = String(raw || "").trim();
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol.toLowerCase() === "lumen:" && u.hostname.toLowerCase() === "search";
  } catch {
    return false;
  }
}

function routeCursorForGateway(
  cursorState: SearchRouteCursor | null,
  gateway: GatewayView | null | undefined,
): SearchCursor | null {
  const cur = normalizeSearchRouteCursor(cursorState);
  if (!cur || !gateway) return null;
  const entry =
    cur.gateways.find((candidate) => gatewayMatchesRouteKey(gateway, candidate.id)) || null;
  return normalizeSearchCursor(entry?.cursor);
}

function parseSearchUrl(raw: string): ParsedSearchUrl {
  const value = String(raw || "").trim();
  if (!value) return { q: "", type: "site", cursor: null, gatewayId: null };
  try {
    const u = new URL(value);
    const qs = u.searchParams.get("q") || "";
    const type = (u.searchParams.get("type") || "") as SearchType;
    const t: SearchType =
      type === "site" || type === "image" || type === "all" ? type : "site";
    const cursor = normalizeSearchRouteCursor(
      u.searchParams.get("cursor") || u.searchParams.get("c") || "",
    );
    const gatewayId =
      String(
        u.searchParams.get("gid") ||
          u.searchParams.get("gw") ||
          u.searchParams.get("gateway") ||
          u.searchParams.get("id") ||
          "",
      ).trim() || null;
    return { q: qs, type: t, cursor, gatewayId };
  } catch {
    return { q: "", type: "site", cursor: null, gatewayId: null };
  }
}

function makeSearchUrl(
  query: string,
  type: SearchType,
  cursor: SearchRouteCursor | null = null,
  gateway: GatewayView | string | null = null,
): string {
  const s = String(query || "").trim();
  const u = new URL("lumen://search");
  if (s) u.searchParams.set("q", s);
  if (type) u.searchParams.set("type", type);
  const encodedCursor = serializeSearchRouteCursor(cursor);
  if (encodedCursor) {
    u.searchParams.set("cursor", encodedCursor);
    const gatewayId = gatewayRouteIdForUrl(gateway);
    if (gatewayId) u.searchParams.set("gid", gatewayId);
  }
  return u.toString();
}

function isElementScrollableY(el: HTMLElement): boolean {
  try {
    return el.scrollHeight > el.clientHeight + 1;
  } catch {
    return false;
  }
}

function setActiveUrlState(cursor: SearchRouteCursor | null, gateway: GatewayView | string | null) {
  const cleanCursor = normalizeSearchRouteCursor(cursor);
  activeUrlCursor.value = cleanCursor;
  activeUrlGatewayKey.value = cleanCursor
    ? normalizeGatewayRouteKey(gatewayRouteIdForUrl(gateway))
    : "";
}

function replaceUrlCursor(cursor: SearchRouteCursor | null, gateway: GatewayView | string | null) {
  const cleanCursor = normalizeSearchRouteCursor(cursor);
  const cleanGateway = cleanCursor ? gateway : null;
  setActiveUrlState(cleanCursor, cleanGateway);
  if (!navigate) return;
  const cleanQ = String(activeQuery.value || "").trim();
  const type = activeType.value;
  const nextUrl = makeSearchUrl(cleanQ, type, cleanCursor, cleanGateway);
  const curUrl = String(currentTabUrl?.value || "").trim();
  if (!curUrl || !isSearchRouteUrl(curUrl) || curUrl === nextUrl) return;
  navigate(nextUrl, { push: false });
}

function clearPageCursorStates() {
  pageCursorStates.value = [];
}

function shiftPageCursorStates(offset: number) {
  const delta = Math.floor(Number(offset) || 0);
  if (!delta) return;
  pageCursorStates.value = pageCursorStates.value.map((state) => ({
    ...state,
    startIndex: state.startIndex + delta,
    endIndex: state.endIndex + delta,
  }));
}

function rememberPageCursorState(
  startIndex: number,
  endIndex: number,
  cursor: SearchRouteCursor | null,
  gateway: GatewayView | string | null,
) {
  const start = Math.max(0, Math.floor(Number(startIndex) || 0));
  const end = Math.max(start, Math.floor(Number(endIndex) || 0));
  if (end <= start) return;

  const entry: SearchPageCursorState = {
    startIndex: start,
    endIndex: end,
    cursor: cloneSearchRouteCursor(cursor),
    gatewayId: cursor ? gatewayRouteIdForUrl(gateway) || null : null,
  };

  const next = [...pageCursorStates.value];
  const last = next.length ? next[next.length - 1] : null;
  if (last && last.startIndex === entry.startIndex) {
    next[next.length - 1] = entry;
  } else {
    next.push(entry);
  }
  pageCursorStates.value = next;
}

function prependPageCursorState(
  length: number,
  cursor: SearchRouteCursor | null,
  gateway: GatewayView | string | null,
) {
  const count = Math.max(0, Math.floor(Number(length) || 0));
  if (!count) return;
  shiftPageCursorStates(count);
  const entry: SearchPageCursorState = {
    startIndex: 0,
    endIndex: count,
    cursor: cloneSearchRouteCursor(cursor),
    gatewayId: cursor ? gatewayRouteIdForUrl(gateway) || null : null,
  };
  pageCursorStates.value = [entry, ...pageCursorStates.value];
}

function pageCursorStateForIndex(index: number): SearchPageCursorState | null {
  const states = pageCursorStates.value;
  if (!states.length) return null;
  const idx = Math.max(0, Math.floor(Number(index) || 0));
  for (let i = states.length - 1; i >= 0; i -= 1) {
    const state = states[i];
    if (idx >= state.startIndex) return state;
  }
  return states[0] || null;
}

function pageCursorStateForCursor(cursor: SearchRouteCursor | null): SearchPageCursorState | null {
  const targetKey = searchRouteCursorPageKey(cursor);
  if (!targetKey) return pageCursorStates.value[0] || null;
  return (
    pageCursorStates.value.find((state) => searchRouteCursorPageKey(state.cursor) === targetKey) || null
  );
}

function renderedResultNodes(): HTMLElement[] {
  const root = scrollRoot.value;
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>("[data-result-index]"));
}

function renderedResultItems(): ResultItem[] {
  return selectedType.value === "image" ? imageResults.value : results.value;
}

function resultAnchorIdForIndex(index: number | null | undefined): string {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx < 0) return "";
  return normalizeSearchRouteAnchorId(renderedResultItems()[Math.floor(idx)]?.id);
}

function resultIndexForAnchorId(anchorId: string | null | undefined): number | null {
  const cleanAnchorId = normalizeSearchRouteAnchorId(anchorId);
  if (!cleanAnchorId) return null;
  const idx = renderedResultItems().findIndex(
    (item) => normalizeSearchRouteAnchorId(item?.id) === cleanAnchorId,
  );
  return idx >= 0 ? idx : null;
}

function firstVisibleResultIndex(): number | null {
  const root = scrollRoot.value;
  if (!root) return null;
  const nodes = renderedResultNodes();
  if (!nodes.length) return null;

  const rootRect = root.getBoundingClientRect();
  const threshold = rootRect.top + 24;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom > threshold) {
      const idx = Number(node.dataset.resultIndex);
      return Number.isFinite(idx) && idx >= 0 ? Math.floor(idx) : 0;
    }
  }

  const last = nodes[nodes.length - 1];
  const idx = Number(last?.dataset.resultIndex);
  return Number.isFinite(idx) && idx >= 0 ? Math.floor(idx) : nodes.length - 1;
}

function syncVisibleResultIndex() {
  const idx = firstVisibleResultIndex();
  if (idx == null) return;
  firstVisibleResultIdx.value = idx;
}

function syncUrlToVisibleCursor() {
  if (restoringUrlState) return;
  if (!touched.value) return;
  if (!isSearchRouteUrl(String(currentTabUrl?.value || ""))) return;
  const currentPage = pageCursorStateForIndex(firstVisibleResultIdx.value);
  const anchorId = resultAnchorIdForIndex(firstVisibleResultIdx.value);
  const cursorForUrl = withSearchRouteAnchor(currentPage?.cursor || null, anchorId);
  replaceUrlCursor(cursorForUrl, currentPage?.gatewayId || activeGateway.value);
}

function maybeLoadPreviousFromScroll() {
  if (restoringUrlState) return;
  if (Date.now() < suppressAutoLoadUntil) return;
  if (!gatewayHasPrev.value || loading.value || loadingPrevious.value || loadingMore.value) return;
  const root = scrollRoot.value;
  if (!root) return;
  if (root.scrollTop > LOAD_PREVIOUS_SCROLL_THRESHOLD_PX) return;
  void loadPrevious();
}

function maybeLoadMoreFromScroll() {
  if (restoringUrlState) return;
  if (Date.now() < suppressAutoLoadUntil) return;
  if (!showLoadMore.value || loading.value || loadingPrevious.value || loadingMore.value) return;
  const root = scrollRoot.value;
  if (!root) return;
  const remaining = root.scrollHeight - (root.scrollTop + root.clientHeight);
  if (remaining > LOAD_MORE_SCROLL_THRESHOLD_PX) return;
  void loadMore();
}

function scheduleScrollUpdate() {
  if (scrollRaf) return;
  scrollRaf = window.requestAnimationFrame(() => {
    scrollRaf = 0;
    syncVisibleResultIndex();
    syncUrlToVisibleCursor();
  });
}

function onScroll() {
  scheduleScrollUpdate();
  maybeLoadPreviousFromScroll();
  maybeLoadMoreFromScroll();
}

function disconnectLoadMoreObserver() {
  if (!loadMoreObserver) return;
  loadMoreObserver.disconnect();
  loadMoreObserver = null;
}

function refreshLoadMoreObserver() {
  disconnectLoadMoreObserver();
  const root = scrollRoot.value;
  const sentinel = paginationSentinel.value;
  if (!root || !sentinel) return;
  if (typeof IntersectionObserver === "undefined") return;

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (restoringUrlState) return;
      if (Date.now() < suppressAutoLoadUntil) return;
      if (!showLoadMore.value || loading.value || loadingPrevious.value || loadingMore.value) return;
      void loadMore();
    },
    {
      root,
      rootMargin: "0px 0px 720px 0px",
      threshold: 0.01,
    },
  );
  loadMoreObserver.observe(sentinel);
}

function scrollToTop() {
  const root = scrollRoot.value;
  try {
    if (root && isElementScrollableY(root)) {
      root.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
  } catch {
    // ignore
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function scrollToResultIndex(index: number | null | undefined) {
  const idx = Number(index);
  if (!Number.isFinite(idx) || idx <= 0) {
    scrollToTop();
    return;
  }

  const root = scrollRoot.value;
  if (!root) {
    scrollToTop();
    return;
  }

  const target = root.querySelector<HTMLElement>(`[data-result-index="${Math.floor(idx)}"]`);
  if (!target) {
    scrollToTop();
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const delta = targetRect.top - rootRect.top - 16;
  root.scrollTo({ top: Math.max(0, root.scrollTop + delta), behavior: "auto" });
}

function setType(t: SearchType) {
  selectedType.value = t;
  const s = q.value.trim();
  const nextUrl = makeSearchUrl(s, t, null, null);
  const curUrl = String(currentTabUrl?.value || "").trim();
  if (curUrl && curUrl === nextUrl) {
    activeQuery.value = s;
    activeType.value = t;
    runSearch(s, t, { force: true });
    return;
  }
  goto(nextUrl, { push: false });
}

function submit() {
  const s = q.value.trim();
  const nextUrl = makeSearchUrl(s, selectedType.value, null, null);
  const curUrl = String(currentTabUrl?.value || "").trim();
  if (curUrl && curUrl === nextUrl) {
    activeQuery.value = s;
    activeType.value = selectedType.value;
    runSearch(s, selectedType.value, { force: true });
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
    const gwApi = useInternalLumen()?.gateway;
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
  brokenThumbs.value[key] = true;
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
  const dnsApi = useInternalLumen()?.dns;
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
  const active = await useInternalLumen()?.profiles.getActive().catch(() => null);
  const id = String(active?.id || "").trim();
  return id || null;
}

async function loadGatewaysForSearch(
  profileId: string,
): Promise<GatewayView[]> {
  const now = Date.now();
  const cached = gatewaysCache.value;
  if (cached.items.length && now - cached.at < 60_000) return cached.items;

  const gwApi = useInternalLumen()?.gateway;
  if (!gwApi || typeof gwApi.listGateways !== "function") return [];

  const res = await gwApi
    .listGateways({ limit: 500, timeoutMs: 2500, ignoreWhitelist: false })
    .catch(() => null);
  if (!res || res.ok === false) return [];
  const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];

  const gatewayIdNumber = (gateway: any) => {
    const rawId = gateway?.id ?? gateway?.gatewayId ?? gateway?.gateway_id ?? "";
    const num = Number(String(rawId).trim());
    return Number.isFinite(num) ? num : -1;
  };

  const hasCrypto = (gateway: any) => {
    const meta = gateway?.metadata || {};
    return !!(meta.crypto || meta.kyber || meta.crypto?.kyber);
  };

  const chooseBetterGateway = (a: any, b: any) => {
    const aId = gatewayIdNumber(a);
    const bId = gatewayIdNumber(b);
    if (aId !== bId) return bId > aId ? b : a;
    const aCrypto = hasCrypto(a);
    const bCrypto = hasCrypto(b);
    if (aCrypto !== bCrypto) return bCrypto ? b : a;
    const aActive = a?.active !== false;
    const bActive = b?.active !== false;
    if (aActive !== bActive) return bActive ? b : a;
    return a;
  };

  const bestByKey = new Map<string, any>();
  for (const gateway of gwRaw) {
    const endpointKey = normalizeGatewayRouteKey(
      String(gateway?.endpoint ?? gateway?.baseUrl ?? gateway?.url ?? ""),
    );
    const idKey = normalizeGatewayRouteKey(
      String(gateway?.id ?? gateway?.gatewayId ?? gateway?.gateway_id ?? ""),
    );
    const key = endpointKey || idKey;
    if (!key) continue;
    const prev = bestByKey.get(key);
    bestByKey.set(key, prev ? chooseBetterGateway(prev, gateway) : gateway);
  }

  const items: GatewayView[] = [];
  const seen = new Set<string>();
  for (const g of bestByKey.values()) {
    const id = String(g?.id ?? g?.gatewayId ?? "").trim();
    if (!id || seen.has(id)) continue;
    const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? "").trim();
    if (!endpoint) continue;
    const baseUrlHint = String(g?.baseUrl ?? "").trim();
    const regions = Array.isArray(g?.regions)
      ? g.regions.map((r: any) => String(r || "")).filter(Boolean)
      : [];
    items.push({
      id,
      endpoint,
      baseUrl: normalizeBaseUrlLike(baseUrlHint) || undefined,
      regions,
    });
    seen.add(id);
  }

  gatewaysCache.value = { at: now, items };
  // Best-effort: resolve gateway HTTP base URLs in the background so image thumbnails can load
  // from a fast/pinned source without delaying search results.
  if (typeof gwApi.getBaseUrl === "function") {
    void Promise.all(
      items.map(async (g) => {
        if (g.baseUrl) return;
        const endpoint = String(g.endpoint || "").trim();
        if (!endpoint) return;

        // If the endpoint looks like a plain base URL, keep it (no extra IPC).
        try {
          const u = new URL(endpoint);
          const path = String(u.pathname || "");
          if (!path || path === "/") {
            g.baseUrl = normalizeBaseUrlLike(endpoint) || undefined;
            return;
          }
        } catch {
          // ignore
        }

        const res = await gwApi.getBaseUrl(profileId, endpoint).catch(() => null);
        if (!res || res.ok === false) return;
        const base = String(res?.baseUrl ?? res?.base_url ?? "").trim();
        const normalized = normalizeBaseUrlLike(base);
        if (normalized) g.baseUrl = normalized;
      }),
    ).catch(() => {});
  }
  return items;
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
    .map((seg) => {
      const s = String(seg || "");
      try {
        return encodeURIComponent(decodeURIComponent(s));
      } catch {
        return encodeURIComponent(s);
      }
    })
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
  const kind = String(hit?.kind || "").trim();
  const rType = String(hit?.resourceType || "").trim();
  const extGuess = String(hit?.ext_guess || "").trim().toLowerCase();
  const pathLower = String(path || "").trim().toLowerCase();
  const mimeLower = String(mime || "").trim().toLowerCase();
  const kindLower = String(kind || "").trim().toLowerCase();
  const rTypeLower = String(rType || "").trim().toLowerCase();

  // Search policy: never surface audio/video results in this UI.
  if (rTypeLower === "video" || rTypeLower === "audio") return null;
  if (mimeLower.startsWith("video/") || mimeLower.startsWith("audio/")) return null;

  const extractedTags = extractSearchTags(hit);

  const isImage =
    rTypeLower === "image" || kindLower === "image" || mimeLower.startsWith("image/");
  const media: ResultItem["media"] = isImage
    ? "image"
    : "unknown";

  if (filterType === "image" && !isImage) return null;

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
  const thumbBaseCid = hasPath && rootCid ? rootCid : cid;
  const thumbUrl = isImage
    ? hasPath
      ? imageThumbUrlForGateway(gateway, thumbBaseCid, path)
      : imageThumbUrlForGateway(gateway, cid)
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
  // Fallback: show MIME when we don't have tags.
  if (!badges.length && mime) badges.push(mime);

  return {
    id: `gw:${gateway.id}:${cid}:${path || ""}`,
    title,
    url: openUrl,
    kind: "ipfs",
    description: snippet || undefined,
    badges,
    thumbUrl,
    thumbCid: isImage ? (hasPath ? thumbBaseCid : cid) : undefined,
    media,
    fileKind,
    uniqueViews7d,
    viewCid: rootCid || cid,
    gateway: { id: gateway.id, endpoint: gateway.endpoint },
  };
}

function safeJsonParseObject(value: any): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function extractSearchTags(hit: any): string[] {
  const tagsJson =
    safeJsonParseObject(hit?.tags_json) ||
    safeJsonParseObject(hit?.tags) ||
    safeJsonParseObject(hit?.tagsJson) ||
    null;

  const topics = Array.isArray(tagsJson?.topics)
    ? tagsJson.topics
    : Array.isArray(hit?.topics)
      ? hit.topics
      : [];
  const tokensObj =
    tagsJson && tagsJson.tokens && typeof tagsJson.tokens === "object"
      ? tagsJson.tokens
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
  // Non-site routes (CID navigation, network/explorer, etc.)
  if (host === "ipfs" || host === "ipns" || host === "network") return null;
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

function buildGatewayRouteCursorForResults(
  rankAt: number | null,
  results: Array<{ gateway: GatewayView; cursor: SearchCursor | null; include: boolean }>,
): SearchRouteCursor | null {
  return buildSearchRouteCursor(
    rankAt,
    results.filter((result) => result.include).map((result) => ({
      id: result.gateway.id,
      cursor: result.cursor,
    })),
  );
}

async function searchGateways(
  profileId: string,
  query: string,
  type: SearchType,
  seq: number,
  opts: {
    limit: number;
    cursorState: SearchRouteCursor | null;
    gateway?: GatewayView | null;
    rankAt?: number | null;
  },
): Promise<GatewaySearchResult> {
  const gwApi = useInternalLumen()?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") {
    return {
      items: [],
      hasPrev: false,
      prevCursor: null,
      pageCursor: cloneSearchRouteCursor(opts.cursorState),
      hasMore: false,
      nextCursor: null,
      gateway: null,
    };
  }

  const wantedType = normalizeGatewayType(type);
  const wantedMode = wantedType === "site" ? "sites" : type === "all" ? "everything" : "";

  const limitRaw = Number(opts.limit);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 12;
  const cursorState = normalizeSearchRouteCursor(opts.cursorState);
  const rankAt =
    Number.isFinite(Number(opts.rankAt)) && Number(opts.rankAt) > 0
      ? Math.floor(Number(opts.rankAt))
      : searchRouteCursorRankAt(cursorState);

  const preferredGateway =
    opts.gateway && typeof opts.gateway === "object" ? opts.gateway : null;
  const hasPreferredEndpoint = !!(
    preferredGateway &&
    typeof preferredGateway.endpoint === "string" &&
    preferredGateway.endpoint.trim()
  );
  let gatewaysToQuery: GatewayView[] = [];

  if (hasPreferredEndpoint && preferredGateway) {
    gatewaysToQuery = [preferredGateway];
  } else {
    const gateways = profileId ? await loadGatewaysForSearch(profileId) : [];
    if (seq !== searchSeq) {
      return {
        items: [],
        hasPrev: false,
        prevCursor: null,
        pageCursor: cloneSearchRouteCursor(cursorState),
        hasMore: false,
        nextCursor: null,
        gateway: null,
      };
    }
    if (!gateways.length) {
      return {
        items: [],
        hasPrev: false,
        prevCursor: null,
        pageCursor: cloneSearchRouteCursor(cursorState),
        hasMore: false,
        nextCursor: null,
        gateway: null,
      };
    }

    const aliveList = await filterAliveGatewaysForPqSearch(gateways, seq);
    if (seq !== searchSeq) {
      return {
        items: [],
        hasPrev: false,
        prevCursor: null,
        pageCursor: cloneSearchRouteCursor(cursorState),
        hasMore: false,
        nextCursor: null,
        gateway: null,
      };
    }
    if (!aliveList.length) {
      return {
        items: [],
        hasPrev: false,
        prevCursor: null,
        pageCursor: cloneSearchRouteCursor(cursorState),
        hasMore: false,
        nextCursor: null,
        gateway: null,
      };
    }

    if (cursorState?.gateways?.length) {
      const ordered: GatewayView[] = [];
      const seen = new Set<string>();
      for (const entry of cursorState.gateways) {
        const match = aliveList.find((gateway) => gatewayMatchesRouteKey(gateway, entry.id)) || null;
        if (!match) continue;
        const key = normalizeGatewayRouteKey(String(match.id || ""));
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ordered.push(match);
      }
      gatewaysToQuery = ordered.length ? ordered : aliveList;
    } else {
      gatewaysToQuery = aliveList;
    }
  }

  if (!gatewaysToQuery.length) {
    return {
      items: [],
      hasPrev: false,
      prevCursor: null,
      pageCursor: cloneSearchRouteCursor(cursorState),
      hasMore: false,
      nextCursor: null,
      gateway: null,
    };
  }

  const perGatewayLimitRaw = hasPreferredEndpoint
    ? limit
    : gatewaysToQuery.length > 0
      ? Math.ceil(limit / gatewaysToQuery.length) + 2
      : limit;
  const perGatewayLimit = Math.max(
    1,
    Math.min(50, hasPreferredEndpoint ? limit : Math.floor(perGatewayLimitRaw)),
  );

  const mapGatewayPayload = (gateway: GatewayView, data: any, requestedCursor: SearchCursor | null) => {
    const rawPageCursor = (data as any).pageCursor ?? (data as any).page_cursor ?? null;
    const rawPrevCursor = (data as any).prevCursor ?? (data as any).prev_cursor ?? null;
    const rawHasPrev = (data as any).hasPrev ?? (data as any).has_prev ?? null;
    const rawNextCursor = (data as any).nextCursor ?? (data as any).next_cursor ?? null;
    const rawHasMore = (data as any).hasMore ?? (data as any).has_more ?? null;
    const pageCursor = rawPageCursor == null ? normalizeSearchCursor(requestedCursor) : normalizeSearchCursor(rawPageCursor);
    const prevCursor = normalizeSearchCursor(rawPrevCursor);
    const nextCursor = normalizeSearchCursor(rawNextCursor);
    const hasPrev =
      typeof rawHasPrev === "boolean"
        ? rawHasPrev
        : !!(pageCursor || (requestedCursor && normalizeSearchCursor(requestedCursor)));
    const hasMore = typeof rawHasMore === "boolean" ? rawHasMore : !!nextCursor;

    const items: ResultItem[] = [];

    if (wantedType === "site") {
      const siteResults: GatewaySiteSearchResult[] = Array.isArray((data as any).results)
        ? (data as any).results
        : [];

      for (const siteResult of siteResults) {
        const itemType = String(siteResult?.type || "").trim().toLowerCase();
        if (itemType !== "site") continue;

        const domainRaw = String(siteResult?.domain || "").trim();
        const domain = domainRaw ? domainRaw.toLowerCase() : "";
        const cid = String(siteResult?.cid || "").trim();
        if (!domain && !cid) continue;

        const entryCidRaw = String((siteResult as any)?.entry_cid || "").trim();
        const entryCid = entryCidRaw || cid;
        const entryPath = String((siteResult as any)?.entry_path || "").trim();
        const entrySuffix = safeEncodedPathSuffix(entryPath);
        const wallet = String((siteResult as any)?.wallet || "").trim();
        const owned = !!wallet || !!(siteResult as any)?.owned;

        const tags = extractSiteTags(siteResult);
        const badges = tags.length ? tags.slice(0, 20) : [];

        const title =
          String((siteResult as any)?.title || "").trim() ||
          (domain ? domain : cid ? `CID ${cid.slice(0, 8)}…` : "Site");
        const snippet = String((siteResult as any)?.snippet || "").trim();

        let url = "";
        if (domain) {
          url = entrySuffix ? `lumen://${domain}${entrySuffix}` : `lumen://${domain}`;
        } else if (entryCid && entrySuffix) {
          url = `lumen://ipfs/${entryCid}${entrySuffix}`;
        } else if (entryCid) {
          url = `lumen://ipfs/${entryCid}`;
        } else if (cid) {
          url = `lumen://ipfs/${cid}`;
        }

        const favicon = domain ? faviconUrlForCid(cid || entryCid) : null;

        items.push({
          id: `gw:${gateway.id}:site:${domain || cid || entryCid}:${entryPath || ""}`,
          title,
          url,
          description: snippet || undefined,
          kind: "site",
          badges,
          thumbUrl: favicon || undefined,
          uniqueViews7d: (() => {
            const views = Number((siteResult as any)?.views_unique_7d);
            return Number.isFinite(views) ? Math.max(0, Math.floor(views)) : 0;
          })(),
          viewCid: cid || entryCid || undefined,
          gateway: { id: gateway.id, endpoint: gateway.endpoint },
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
    } else {
      const hits: GatewaySearchHit[] = Array.isArray((data as any).hits)
        ? (data as any).hits
        : Array.isArray((data as any).results)
          ? (data as any).results
          : [];

      for (const hit of hits) {
        const mapped = mapGatewayHitToResult(hit, gateway, type);
        if (mapped) items.push(mapped);
      }
    }

    return { gateway, items, hasPrev, prevCursor, pageCursor, hasMore, nextCursor };
  };

  const results = await mapWithConcurrency(gatewaysToQuery, 3, async (gateway) => {
    if (seq !== searchSeq) return null;
    const gatewayCursor = routeCursorForGateway(cursorState, gateway);
    const resp = await gwApi
      .searchPq({
        profileId,
        endpoint: gateway.endpoint,
        query,
        lang: "en",
        limit: perGatewayLimit,
        offset: 0,
        cursor: gatewayCursor,
        rankAt,
        mode: wantedMode,
        type: wantedType,
    })
      .catch(() => null);
    if (seq !== searchSeq) return null;
    if (!resp || resp.ok === false) return null;
    return mapGatewayPayload(gateway, resp.data || {}, gatewayCursor);
  });

  if (seq !== searchSeq) {
    return {
      items: [],
      hasPrev: false,
      prevCursor: null,
      pageCursor: cloneSearchRouteCursor(cursorState),
      hasMore: false,
      nextCursor: null,
      gateway: null,
    };
  }

  const okResults = results.filter(Boolean) as Array<{
    gateway: GatewayView;
    items: ResultItem[];
    hasPrev: boolean;
    prevCursor: SearchCursor | null;
    pageCursor: SearchCursor | null;
    hasMore: boolean;
    nextCursor: SearchCursor | null;
  }>;
  if (!okResults.length) {
    return {
      items: [],
      hasPrev: false,
      prevCursor: null,
      pageCursor: cloneSearchRouteCursor(cursorState),
      hasMore: false,
      nextCursor: null,
      gateway: null,
    };
  }

  const primary =
    okResults.find((result) => result.items.length && (result.hasMore || result.nextCursor)) ||
    okResults.find((result) => result.items.length) ||
    okResults.find((result) => result.hasMore || result.nextCursor) ||
    okResults[0] ||
    null;
  const primaryGateway = primary?.gateway || null;

  const pageCursor = cloneSearchRouteCursor(cursorState);
  const prevCursor = buildGatewayRouteCursorForResults(
    rankAt,
    okResults.map((result) => ({
      gateway: result.gateway,
      cursor: result.prevCursor,
      include: result.hasPrev,
    })),
  );
  const hasPrev = okResults.some((result) => result.hasPrev);
  const nextCursor = buildGatewayRouteCursorForResults(
    rankAt,
    okResults.map((result) => ({
      gateway: result.gateway,
      cursor: result.nextCursor,
      include: result.hasMore,
    })),
  );
  const hasMore = okResults.some((result) => result.hasMore);

  const all: ResultItem[] = [];
  if (wantedType === "site") {
    for (const result of okResults) all.push(...(result.items || []));
    const merged = mergeAndRankSites(query, all).slice(0, limit);
    return { items: merged, hasPrev, prevCursor, pageCursor, hasMore, nextCursor, gateway: primaryGateway };
  }

  const maxLen = Math.max(...okResults.map((result) => (Array.isArray(result.items) ? result.items.length : 0)));
  for (let i = 0; i < maxLen; i += 1) {
    for (const result of okResults) {
      const item = result.items && result.items[i] ? result.items[i] : null;
      if (item) all.push(item);
    }
  }

  const merged = dedupeAllResults(all).slice(0, limit);
  return { items: merged, hasPrev, prevCursor, pageCursor, hasMore, nextCursor, gateway: primaryGateway };
}

async function collectGatewayResultsPage(
  profileId: string,
  query: string,
  type: SearchType,
  seq: number,
  opts: {
    limit: number;
    cursorState: SearchRouteCursor | null;
    gateway?: GatewayView | null;
    rankAt?: number | null;
    direction?: "next" | "prev";
  },
): Promise<GatewaySearchResult> {
  const limitRaw = Number(opts.limit);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 12;
  const preferredGateway =
    opts.gateway && typeof opts.gateway === "object" ? opts.gateway : null;
  const direction = opts.direction === "prev" ? "prev" : "next";
  let cursorState = cloneSearchRouteCursor(opts.cursorState);
  let pageCursor = cloneSearchRouteCursor(opts.cursorState);
  let hasPrev = false;
  let prevCursor: SearchRouteCursor | null = null;
  let hasMore = false;
  let nextCursor: SearchRouteCursor | null = null;
  let gateway = preferredGateway;
  const items: ResultItem[] = [];
  const prependBatches: ResultItem[][] = [];
  const seen = new Set<string>();
  let attempts = 0;
  let itemCount = 0;
  let firstRound = true;

  while (seq === searchSeq && attempts < 12 && itemCount < limit) {
    attempts += 1;
    const remaining = limit - itemCount;
    const requestCursor = cloneSearchRouteCursor(cursorState);
    const beforeCursorKey = searchRouteCursorKey(requestCursor);

    const round = await searchGateways(profileId, query, type, seq, {
      limit: remaining,
      cursorState: requestCursor,
      gateway: preferredGateway,
      rankAt: opts.rankAt,
    });
    if (seq !== searchSeq) {
      return {
        items: direction === "prev" ? prependBatches.slice().reverse().flat() : items,
        hasPrev,
        prevCursor,
        pageCursor,
        hasMore,
        nextCursor,
        gateway,
      };
    }

    gateway = round.gateway || gateway;
    if (direction === "prev") {
      pageCursor = requestCursor;
      hasPrev = round.hasPrev;
      prevCursor = round.prevCursor;
      if (firstRound) {
        hasMore = round.hasMore;
        nextCursor = round.nextCursor;
      }
    } else {
      if (firstRound) {
        hasPrev = round.hasPrev;
        prevCursor = round.prevCursor;
      }
      pageCursor = cloneSearchRouteCursor(opts.cursorState);
      hasMore = round.hasMore;
      nextCursor = round.nextCursor;
    }
    const continueHas = direction === "prev" ? round.hasPrev : round.hasMore;
    const continueCursor = direction === "prev" ? round.prevCursor : round.nextCursor;
    const afterCursorKey = searchRouteCursorKey(continueCursor);
    let added = 0;
    const prependBatch: ResultItem[] = [];

    for (const item of round.items || []) {
      const key = String(item?.url || item?.id || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (direction === "prev") {
        prependBatch.push(item);
      } else {
        items.push(item);
      }
      added += 1;
      itemCount += 1;
      if (itemCount >= limit) break;
    }
    if (direction === "prev" && prependBatch.length) prependBatches.push(prependBatch);

    if (!continueHas) break;
    if (!added && afterCursorKey === beforeCursorKey) break;
    cursorState = cloneSearchRouteCursor(continueCursor);
    firstRound = false;
  }

  return {
    items: direction === "prev" ? prependBatches.slice().reverse().flat() : items,
    hasPrev,
    prevCursor,
    pageCursor,
    hasMore,
    nextCursor,
    gateway,
  };
}

async function fetchTagsForCid(
  profileId: string,
  cid: string,
  seq: number,
): Promise<string[]> {
  const gwApi = useInternalLumen()?.gateway;
  if (!gwApi || typeof gwApi.searchPq !== "function") return [];
  const gateways = await loadGatewaysForSearch(profileId);
  if (seq !== searchSeq) return [];
  const alive = await filterAliveGatewaysForPqSearch(gateways, seq);
  if (seq !== searchSeq) return [];
  for (const g of alive) {
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

  const ipfsLike = parseIpfsLikeQuery(s);
  const ipfsCid = String(ipfsLike?.cid || "").trim();
  const ipfsCidOk = ipfsCid ? isCidLike(ipfsCid) : false;

  if (/^lumen:\/\//i.test(s) && !(ipfsLike && ipfsCidOk)) {
    list.push({
      id: `link:${s}`,
      title: "Open Lumen link",
      url: s,
      description: s,
      kind: "link",
    });
  }

  if (ipfsLike && ipfsCidOk) {
    const encoded = encodeUrlPath(ipfsLike.subpath || "");
    const url = encoded
      ? `lumen://ipfs/${ipfsCid}/${encoded}`
      : `lumen://ipfs/${ipfsCid}`;
    const title = ipfsLike.subpath ? "IPFS path" : "IPFS content";
    list.push({
      id: `ipfs:${ipfsCid}`,
      title,
      url,
      description: ipfsLike.subpath ? "Open IPFS path" : "Open content by CID",
      kind: "ipfs",
      badges: ["IPFS"],
    });
  } else if (isCidLike(s)) {
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
      url: `lumen://network/tx/${s}`,
      description: "View transaction details",
      kind: "tx",
      badges: ["Explorer"],
    });
  }

  if (isAddress(s)) {
    list.push({
      id: `addr:${s}`,
      title: "Wallet address",
      url: `lumen://network/address/${s}`,
      description: "View address activity",
      kind: "address",
      badges: ["Explorer"],
    });
  }

  if (isBlockHeight(s)) {
    list.push({
      id: `block:${s}`,
      title: "Block",
      url: `lumen://network/block/${s}`,
      description: "View block details",
      kind: "block",
      badges: ["Explorer"],
    });
  }

  return list;
}

async function runSearch(
  query: string,
  type: SearchType,
  opts?: {
    rankAt?: number | null;
    gateway?: GatewayView | null;
    cursorState?: SearchRouteCursor | null;
    pageGateway?: GatewayView | string | null;
    force?: boolean;
  },
) {
  const seq = ++searchSeq;
  const clean = String(query || "").trim();
  const normalizedQuery = normalizeQueryForGatewaySearch(clean);
  const gatewayQuery = normalizedQuery.gatewayQuery;
  const cidForDirect = normalizedQuery.cidForDirect;
  const refreshTick = Number(currentTabRefresh?.value || 0);
  const rankAt =
    Number.isFinite(Number(opts?.rankAt)) && Number(opts?.rankAt) > 0
      ? Math.floor(Number(opts?.rankAt))
      : null;
  const initialPageCursor = pageSearchRouteCursor(opts?.cursorState || null);
  const preferredGateway =
    opts?.gateway && typeof opts.gateway === "object" ? opts.gateway : null;
  const initialPageGateway = initialPageCursor ? opts?.pageGateway || preferredGateway : preferredGateway;
  const preferredGatewayKey = normalizeGatewayRouteKey(gatewayRouteIdForUrl(preferredGateway));
  const initialPageCursorKey = searchRouteCursorPageKey(initialPageCursor);
  const initialPageGatewayKey = normalizeGatewayRouteKey(gatewayRouteIdForUrl(initialPageGateway));
  const runKey = `${type}::${clean}::r=${refreshTick}::ra=${rankAt || 0}::gw=${preferredGatewayKey}::pc=${initialPageCursorKey}::pg=${initialPageGatewayKey}`;
  const allowEmptyQuery = type === "site" || type === "image" || type === "all";
  if (!clean && !allowEmptyQuery) {
    touched.value = false;
    loading.value = false;
    loadingPrevious.value = false;
    loadingMore.value = false;
    errorMsg.value = "";
    results.value = [];
    lastRunKey.value = "";
    gatewayHasPrev.value = false;
    gatewayPrevCursor.value = null;
    gatewayHasMore.value = false;
    gatewayNextCursor.value = null;
    activeGateway.value = null;
    clearPageCursorStates();
    setActiveUrlState(null, null);
    return;
  }
  if (!opts?.force && runKey === lastRunKey.value && results.value.length) {
    loading.value = false;
    return;
  }
  lastRunKey.value = runKey;

  touched.value = true;
  loading.value = true;
  loadingPrevious.value = false;
  loadingMore.value = false;
  errorMsg.value = "";
  results.value = [];
  firstVisibleResultIdx.value = 0;
  gatewayHasPrev.value = false;
  gatewayPrevCursor.value = null;
  gatewayHasMore.value = false;
  gatewayNextCursor.value = null;
  activeGateway.value = null;
  clearPageCursorStates();
  thumbCorsProbeById.clear();
  thumbLocalFallbackTriedById.clear();
  thumbLoadedById.value = {};

  try {
    const includePageOneDecorations = !initialPageCursor;

    // In the Images tab, keep results strictly image-only (avoid "fast actions" like open link/CID
    // that would inflate counts without showing anything in the image grid).
    const base = includePageOneDecorations ? (type === "image" ? [] : buildFastResults(clean)) : [];
    const cidMetaPromise =
      includePageOneDecorations && cidForDirect
        ? enrichFastCidResult(base, cidForDirect, seq)
        : Promise.resolve();

    const profileId = await getActiveProfileId();

    const domainPromise =
      includePageOneDecorations &&
      clean &&
      !cidForDirect &&
      !normalizedQuery.ipfsLike &&
      (type === "site" || type === "all")
        ? resolveDomainForQuery(clean)
        : Promise.resolve(null);

    const gatewayPromise = collectGatewayResultsPage(profileId || "", gatewayQuery, type, seq, {
      limit: gatewayPageSize,
      cursorState: initialPageCursor,
      gateway: preferredGateway,
      rankAt,
    });

    const [bestDomain, _cidMetaDone, gw] = await Promise.all([
      domainPromise,
      cidMetaPromise,
      gatewayPromise,
    ]);
    if (seq !== searchSeq) return;

    const gwResults = gw.items;
    gatewayHasPrev.value = gw.hasPrev;
    gatewayPrevCursor.value = gw.prevCursor;
    gatewayHasMore.value = gw.hasMore;
    gatewayNextCursor.value = gw.nextCursor;
    activeGateway.value = gw.gateway;

    let domainTags: string[] = [];
    if (bestDomain?.cid && profileId) {
      domainTags = await fetchTagsForCid(profileId, bestDomain.cid, seq);
    }
    if (seq !== searchSeq) return;

    if (includePageOneDecorations && bestDomain?.name) {
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

    if (includePageOneDecorations && !profileId && type === "all") {
      base.push({
        id: `hint:profile`,
        title: "Create a profile to enable gateway search",
        url: "lumen://home",
        description: "Gateway search requires a profile (wallet + signer).",
        kind: "link",
      });
    }

    if (includePageOneDecorations && !profileId && type === "site") {
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
    if (includePageOneDecorations && type === "all" && cidForDirect && profileId && activeGateway.value) {
      const cidSite = await searchGateways(profileId || "", cidForDirect, "site", seq, {
        limit: 1,
        cursorState: null,
        gateway: activeGateway.value,
        rankAt,
      });
      if (seq !== searchSeq) return;

      const siteCandidate = (cidSite?.items || []).find((r) => r && r.kind === "site") || null;

      if (siteCandidate) {
        const parsed = parseLumenIpfsUrl(siteCandidate.url);
        const best =
          parsed && parsed.cid
            ? ({
                id: `cid:${cidForDirect}`,
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
        merged = merged.filter((r) => !(r && r.kind === "ipfs" && r.id === `ipfs:${cidForDirect}`));

        // Remove HTML hits that still point at the raw CID root (we replace them with the entrypoint).
        merged = merged.filter((r) => {
          if (!r || r.kind !== "ipfs") return true;
          if (r.fileKind !== "html") return true;
          return !String(r.url || "").toLowerCase().startsWith(`lumen://ipfs/${cidForDirect.toLowerCase()}`);
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

    results.value = merged;
    rememberPageCursorState(0, merged.length, gw.pageCursor, initialPageGateway || gw.gateway);
    if (type === "site") {
      const sites = merged.filter((r) => r && r.kind === "site");
      void enrichSiteResultsWithEntryPaths(sites, seq);
    }
  } catch (e: any) {
    if (seq !== searchSeq) return;
    const errMessage = String(e?.message || e || "search_failed");
    errorMsg.value = errMessage;
    results.value = [];
    clearPageCursorStates();
    toast.error(`Search failed: ${errMessage}`);
  } finally {
    if (seq !== searchSeq) return;
    loading.value = false;
    await nextTick();
    refreshLoadMoreObserver();
    scheduleScrollUpdate();
  }
}

const showLoadMore = computed(() => {
  if (!touched.value) return false;
  if (loading.value) return false;
  return gatewayHasMore.value && !!gatewayNextCursor.value;
});

const showLoadPrevious = computed(() => {
  if (!touched.value) return false;
  if (loading.value) return false;
  return gatewayHasPrev.value;
});

async function loadPrevious() {
  if (loading.value || loadingPrevious.value || loadingMore.value) return;
  if (!gatewayHasPrev.value) return;

  const seq = searchSeq;
  const clean = String(activeQuery.value || "").trim();
  const type = activeType.value;
  const allowEmptyQuery = type === "site" || type === "image" || type === "all";
  if (!clean && !allowEmptyQuery) return;

  const normalizedQuery = normalizeQueryForGatewaySearch(clean);
  const gatewayQuery = normalizedQuery.gatewayQuery;

  loadingPrevious.value = true;
  errorMsg.value = "";

  try {
    const profileId = await getActiveProfileId();
    if (seq !== searchSeq) return;

    const root = scrollRoot.value;
    const prevScrollHeight = root ? root.scrollHeight : 0;
    const prevScrollTop = root ? root.scrollTop : 0;
    const seen = new Set<string>(
      results.value
        .map((r) => String(r?.url || "").trim())
        .filter(Boolean),
    );

    const prependBatches: ResultItem[][] = [];
    let hasPrev = gatewayHasPrev.value;
    let cursor = cloneSearchRouteCursor(gatewayPrevCursor.value);
    let attempts = 0;
    let prependedCount = 0;
    let pageCursorForState = cloneSearchRouteCursor(cursor);
    let pageGatewayForState: GatewayView | string | null = activeGateway.value;

    while (seq === searchSeq && hasPrev && prependedCount < gatewayPageSize && attempts < 12) {
      attempts += 1;
      const remaining = gatewayPageSize - prependedCount;
      if (remaining <= 0) break;

      const requestCursor = cloneSearchRouteCursor(cursor);
      const beforeCursorKey = searchRouteCursorKey(requestCursor);
      const gw = await collectGatewayResultsPage(profileId || "", gatewayQuery, type, seq, {
        limit: remaining,
        cursorState: requestCursor,
        direction: "prev",
      });
      if (seq !== searchSeq) return;

      hasPrev = gw.hasPrev;
      cursor = gw.prevCursor;
      gatewayHasPrev.value = hasPrev;
      gatewayPrevCursor.value = cursor;
      if (gw.gateway) {
        activeGateway.value = gw.gateway;
        pageGatewayForState = gw.gateway;
      }
      const afterCursorKey = searchRouteCursorKey(cursor);

      const batch: ResultItem[] = [];
      for (const item of gw.items) {
        const key = String(item?.url || "").trim();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        batch.push(item);
      }

      if (batch.length) {
        prependBatches.push(batch);
        prependedCount += batch.length;
        pageCursorForState = gw.pageCursor;
      }

      if (!hasPrev) break;
      if (!batch.length && afterCursorKey === beforeCursorKey) break;
    }

    const prepended = prependBatches.slice().reverse().flat();
    if (prepended.length) {
      results.value = [...prepended, ...results.value];
      prependPageCursorState(prepended.length, pageCursorForState, pageGatewayForState);

      if (type === "site") {
        const sites = prepended.filter((r) => r && r.kind === "site");
        void enrichSiteResultsWithEntryPaths(sites, seq);
      }

      await nextTick();
      const nextRoot = scrollRoot.value;
      if (nextRoot) {
        const delta = nextRoot.scrollHeight - prevScrollHeight;
        nextRoot.scrollTo({ top: Math.max(0, prevScrollTop + delta), behavior: "auto" });
      }
    }
  } catch (e: any) {
    if (seq !== searchSeq) return;
    const errMessage = String(e?.message || e || "load_previous_failed");
    errorMsg.value = errMessage;
    toast.error(`Load previous failed: ${errMessage}`);
  } finally {
    if (seq !== searchSeq) return;
    loadingPrevious.value = false;
    await nextTick();
    refreshLoadMoreObserver();
    scheduleScrollUpdate();
  }
}

async function loadMore() {
  if (loading.value || loadingPrevious.value || loadingMore.value) return;
  if (!gatewayHasMore.value || !gatewayNextCursor.value) return;

  const seq = searchSeq;
  const clean = String(activeQuery.value || "").trim();
  const type = activeType.value;
  const allowEmptyQuery = type === "site" || type === "image" || type === "all";
  if (!clean && !allowEmptyQuery) return;

  const normalizedQuery = normalizeQueryForGatewaySearch(clean);
  const gatewayQuery = normalizedQuery.gatewayQuery;

  loadingMore.value = true;
  errorMsg.value = "";

  try {
    const profileId = await getActiveProfileId();
    if (seq !== searchSeq) return;

    const seen = new Set<string>(
      results.value
        .map((r) => String(r?.url || "").trim())
        .filter(Boolean),
    );
    const appended: ResultItem[] = [];
    const appendStartIndex = results.value.length;
    const pageCursor = cloneSearchRouteCursor(gatewayNextCursor.value);

    let hasMore = gatewayHasMore.value;
    let cursor = gatewayNextCursor.value;
    let attempts = 0;

    while (
      seq === searchSeq &&
      hasMore &&
      cursor &&
      appended.length < gatewayPageSize &&
      attempts < 12
    ) {
      attempts += 1;
      const remaining = gatewayPageSize - appended.length;
      if (remaining <= 0) break;
      const prevCursorKey = searchRouteCursorKey(cursor);

      const gw = await collectGatewayResultsPage(profileId || "", gatewayQuery, type, seq, {
        limit: remaining,
        cursorState: cursor,
      });
      if (seq !== searchSeq) return;

      hasMore = gw.hasMore;
      cursor = gw.nextCursor;
      gatewayHasMore.value = hasMore;
      gatewayNextCursor.value = cursor;
      if (gw.gateway) activeGateway.value = gw.gateway;
      const nextCursorKey = searchRouteCursorKey(cursor);

      if (!gw.items.length && nextCursorKey === prevCursorKey) break;

      for (const item of gw.items) {
        const key = String(item?.url || "").trim();
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        appended.push(item);
      }
    }

    if (appended.length) {
      results.value = [...results.value, ...appended];
      rememberPageCursorState(
        appendStartIndex,
        results.value.length,
        pageCursor,
        activeGateway.value,
      );

      if (type === "site") {
        const sites = appended.filter((r) => r && r.kind === "site");
        void enrichSiteResultsWithEntryPaths(sites, seq);
      }
    }
  } catch (e: any) {
    if (seq !== searchSeq) return;
    const errMessage = String(e?.message || e || "load_more_failed");
    errorMsg.value = errMessage;
    toast.error(`Load more failed: ${errMessage}`);
  } finally {
    if (seq !== searchSeq) return;
    loadingMore.value = false;
    await nextTick();
    refreshLoadMoreObserver();
    scheduleScrollUpdate();
  }
}

async function restoreSearchFromUrlState(parsed: ParsedSearchUrl, opts?: { force?: boolean }) {
  const targetCursor = parsed.cursor;
  const targetCursorKey = searchRouteCursorKey(targetCursor);
  const targetPageCursor = pageSearchRouteCursor(targetCursor);
  const targetGatewayKey = normalizeGatewayRouteKey(String(parsed.gatewayId || ""));
  const currentCursorKey = searchRouteCursorKey(activeUrlCursor.value);
  const currentGatewayKey = activeUrlGatewayKey.value;

  if (
    !opts?.force &&
    touched.value &&
    parsed.q === activeQuery.value &&
    parsed.type === activeType.value &&
    targetCursorKey === currentCursorKey &&
    (!(targetCursorKey || currentCursorKey) || targetGatewayKey === currentGatewayKey)
  ) {
    return;
  }

  restoringUrlState = true;
  try {
    scrollToTop();
    const rankAt = searchRouteCursorRankAt(targetCursor);
    await runSearch(parsed.q, parsed.type, {
      rankAt,
      cursorState: targetPageCursor,
      pageGateway: parsed.gatewayId || null,
      force: true,
    });

    let targetPage = pageCursorStateForCursor(targetCursor);
    if (targetPageCursor && !targetPage && !results.value.length) {
      await runSearch(parsed.q, parsed.type, {
        rankAt,
        force: true,
      });
      targetPage = pageCursorStateForCursor(targetCursor);
    }

    if (!targetCursorKey) {
      scrollToTop();
      return;
    }

    const targetAnchorIndex = resultIndexForAnchorId(targetCursor?.anchorId || "");
    const targetIndex = targetAnchorIndex ?? targetPage?.startIndex ?? 0;
    firstVisibleResultIdx.value = Math.max(0, targetIndex);
    await nextTick();
    scrollToResultIndex(targetIndex);
  } finally {
    suppressAutoLoadUntil = Date.now() + RESTORE_AUTO_LOAD_COOLDOWN_MS;
    restoringUrlState = false;
    await nextTick();
    refreshLoadMoreObserver();
    scheduleScrollUpdate();
  }
}

watch(
  () => currentTabUrl?.value,
  (next) => {
    const url = String(next || "").trim();
    if (!url || !isSearchRouteUrl(url)) return;
    const parsed = parseSearchUrl(url);
    const { q: qs, type } = parsed;
    const allowEmptyQuery = type === "site" || type === "image" || type === "all";
    if (type !== selectedType.value) selectedType.value = type;
    if (qs !== q.value) q.value = qs;

    const queryTypeChanged = qs !== activeQuery.value || type !== activeType.value;
    const targetCursorKey = searchRouteCursorKey(parsed.cursor);
    const currentCursorKey = searchRouteCursorKey(activeUrlCursor.value);
    const targetGatewayKey = normalizeGatewayRouteKey(String(parsed.gatewayId || ""));
    const currentGatewayKey = activeUrlGatewayKey.value;
    const paginationChanged =
      targetCursorKey !== currentCursorKey ||
      ((targetCursorKey || currentCursorKey) && targetGatewayKey !== currentGatewayKey);

    activeQuery.value = qs;
    activeType.value = type;

    const needsInitialLoad = !touched.value && !loading.value && (qs || allowEmptyQuery);

    if (queryTypeChanged || paginationChanged || needsInitialLoad) {
      void restoreSearchFromUrlState(parsed);
      return;
    }

    setActiveUrlState(parsed.cursor, parsed.gatewayId);
  },
  { immediate: true },
);

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    if (!isSearchRouteUrl(String(currentTabUrl?.value || ""))) return;
    void refreshPinnedCids();
    const parsed = parseSearchUrl(String(currentTabUrl?.value || ""));
    const allowEmptyQuery =
      parsed.type === "site" || parsed.type === "image" || parsed.type === "all";
    if (parsed.q || allowEmptyQuery) void restoreSearchFromUrlState(parsed, { force: true });
  }
);

</script>
