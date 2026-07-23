<template>
  <section class="bg-gradient-shell flex flex-column w-full h-full relative min-h-100vh">
    <UiToast />
    <div class="app overflow-hidden">
      <div
        class="h-200 pr-24px txt-xs overflow-hidden relative flex-align-center text-center bg-primary border-bottom-default z-1000"
        ref="hdr"
      >
        <div
          v-for="(t, i) in tabs"
          :key="t.id"
          class="mainscreen-tab tone-tab-active reveal-on-active relative h-200 min-w-1500 max-w-3000 flex-0-0-auto pl-8px pr-8px gap-8px cursor-select-none cursor-pointer border-radius-top-left-top-right-10px hover-bg-black-a10 flex-align-justify-center transition-ui border-1-transparent background-transparent"
          :data-id="t.id"
          :class="tabClasses(t)"
          :style="tabStyle(t.id)"
          @pointerdown="onTabPointerDown($event, t.id, i)"
          @click="onTabClick(t.id)"
            @auxclick="(e) => e.button === 1 && closeTab(t.id)"
          >
            <div class="tab-icon flex-align-justify-center border-radius-circle size-100 min-w-16px min-h-16px">
              <UiSpinner v-if="t.loading" size="sm" class="spinner-size-14-stroke-15 color-gray-blue" />
              <img
                v-else-if="t.favicon"
                class="favicon border-radius-4px object-fit-cover w-16px h-16px"
                :src="t.favicon"
                alt=""
                draggable="false"
                @error="onFaviconError(t)"
              />
              <Earth v-else :size="16" class="color-gray-blue" />
            </div>
          <div class="mainscreen-tab-label reveal-color-target txt-overflow-ellipsis nowrap overflow-hidden flex-1-1-0 min-w-0" :title="currentTitle(t)">
            {{ currentTitle(t) }}
          </div>

          <UiButton
            variant="icon"
            class="reveal-color-target"
            title="Close"
            @pointerdown.stop
            @click.stop.prevent="closeTab(t.id)"
          >
            <X :size="14" />
          </UiButton>
        </div>

        <UiButton
          ref="addBtn"
          variant="none"
          title="New tab"
          class="hover-focus-bg-fill-primary ml-4px border-radius-circle p-4px border-none cursor-pointer color-text-primary bg-fill-secondary"
          @click="addTab"
        >
          <Plus :size="16" />
        </UiButton>

        <div class="w-full appregion-drag h-200"></div>

        <div
          v-if="isDragging"
          class="drop-indicator cursor-events-none bg-blue-sky absolute bottom-0 top-25 w-25"
          :style="{ left: dropLeft + 'px' }"
        ></div>
      </div>

      <TabBar
        :header_height="tabsHeaderHeight()"
        :tabActive="activeId"
        :tabs="tabs"
        @openInNewTab="openInNewTab"
      />
    </div>

    <ExtensionPopupHost
      v-if="extensionPopup.visible"
      :extension-id="extensionPopup.extensionId"
      :extension-name="extensionPopup.name"
      :target-url="extensionPopup.targetUrl"
      :user-gesture="extensionPopup.userGesture"
      :source-tab-id="activeId"
      :source-url="currentUrlForTab(getActiveTab())"
      :source-title="activeTabTitle"
      :top-offset="tabsHeaderHeight() + 60"
      @close="closeExtensionPopup"
      @navigate="handleExtensionPopupNavigate"
    />

    <WalletOnboardingModal
      :visible="showOnboarding"
      @complete="handleOnboardingComplete"
      @skip="handleOnboardingSkip"
    />

    <ReleaseUpdatePrompt />
    <ReleaseUpdateOverlay />
    <LumenSiteModalHost />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { Earth, Plus, X } from 'lucide-vue-next';
  import TabBar from '../layouts/TabBar.vue';
  import UiSpinner from '../ui/UiSpinner.vue';
  import UiButton from '../ui/UiButton.vue';
  import UiToast from '../ui/UiToast.vue';
  import ExtensionPopupHost from './ExtensionPopupHost.vue';
  import WalletOnboardingModal from './WalletOnboardingModal.vue';
  import ReleaseUpdatePrompt from './ReleaseUpdatePrompt.vue';
  import ReleaseUpdateOverlay from './ReleaseUpdateOverlay.vue';
  import LumenSiteModalHost from './LumenSiteModalHost.vue';
  import { INTERNAL_ROUTE_KEYS, getInternalTitle } from '../internal/routes';
  import { isBrowserUrl, isExtensionUrl, normalizeTabUrl, parseExtensionTabUrl } from '../internal/navigationUrl';
  import { normalizeHistoryUrlForComparison, useHistory } from '../internal/historyStore';
  import { activeProfileId, initProfiles, profilesState } from '../internal/profilesStore';
  import lumenFavicon from '../img/favicon.ico';
import { useInternalLumen } from '../composables/useInternalLumen';
  import {
    buildCandidateUrl,
    localIpfsGatewayBase,
    loadWhitelistedGatewayBases,
    probeUrl,
    resolveDomainTarget,
    resolveIpnsToCid,
  } from '../internal/services/contentResolver';


type TabHistoryEntry = { url: string; title?: string };
  type Tab = {
    id: string;
    url?: string;
    draftUrl?: string;
    history: TabHistoryEntry[];
    history_position: number;
    loading?: boolean;
    favicon?: string | null;
  };

const tabs = ref<Tab[]>([]);
const activeId = ref<string>('');
const { recordHistoryVisit } = useHistory();
const lastHistoryKeyByTabId = new Map<string, string>();
let historySyncSeq = 0;

const showOnboarding = ref(false);
const ONBOARDING_KEY_PREFIX = 'lumen_wallet_onboarding_completed_';
let onboardingSkippedUntilRestart = false;

const hdr = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragDx = ref(0);
const dropLeft = ref(0);
const addBtn = ref<HTMLElement | null>(null);

const startIndex = ref(-1);
const draggingWidth = ref(0);
const layout = ref<{ id: string; left: number; width: number; center: number }[]>([]);
const dropIndex = ref(-1);
const shifts = ref<Record<string, number>>({});
let tabsOpenUnsub: null | (() => void) = null;

const labelWidth = ref(200);
const MIN_LABEL = 0;
const MAX_LABEL = 220;
let tabSeq = 0;
const pendingOpenTargets = new Set<string>();
let installedExtensionsCache: any[] = [];
let installedExtensionsCacheAt = 0;
const extensionPopup = ref({
  visible: false,
  extensionId: '',
  targetUrl: '',
  name: '',
  originTabId: '',
  userGesture: false,
});
function nextTabId(): string {
  tabSeq += 1;
  return `tab-${tabSeq}-${Date.now().toString(36)}`;
}
const GAP = 1;

function tabClasses(t: Tab) {
  return {
    'active': t.id === activeId.value,
    'dragging z-2 cursor-events-none': draggingId.value === t.id
  };
}

function onTabClick(id: string) {
  if (!id) return;
  activeId.value = id;
}

function tabsHeaderHeight(): number {
  const header = hdr.value;
  return header ? header.clientHeight : 200;
}

onMounted(async () => {
  await nextTick();
  if (!tabs.value.length) {
    addTab();
  }
  recalcLabelWidth();
  createResizeObserver();

  try {
    const api: any = useInternalLumen();
    if (api && typeof api.tabsOnOpenInNewTab === 'function') {
      tabsOpenUnsub = api.tabsOnOpenInNewTab((url: string) => {
        const next = String(url || '').trim();
        if (!next) return;
        openInNewTab(next);
      });
    }
  } catch {
    // ignore
  }

  await initProfiles();

  // Check if onboarding is needed
  await checkOnboardingStatus();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', recalcLabelWidth);
  ro?.disconnect();
  try {
    tabsOpenUnsub?.();
  } catch {}
  tabsOpenUnsub = null;
});

watch(
  () => tabs.value.length,
  () => {
    nextTick(recalcLabelWidth);
  }
);

watch(
  () => activeId.value,
  (next, prev) => {
    if (!extensionPopup.value.visible) return;
    if (!extensionPopup.value.originTabId) return;
    if (prev && next && next !== prev && next !== extensionPopup.value.originTabId) {
      closeExtensionPopup();
    }
  }
);

watch(
  () => tabs.value.map((t) => t.id).join("|"),
  () => {
    if (!extensionPopup.value.visible) return;
    if (!extensionPopup.value.originTabId) return;
    const exists = tabs.value.some((tab) => tab.id === extensionPopup.value.originTabId);
    if (!exists) {
      closeExtensionPopup();
    }
  }
);

function reportTabsState() {
  try {
    const api: any = useInternalLumen();
    api?.tabsReportState?.(tabs.value.map((t) => t.id));
  } catch {
    // ignore
  }
}

watch(
  () => tabs.value.map((t) => t.id).join("|"),
  () => reportTabsState(),
  { immediate: true },
);

// Watch for profile changes and check onboarding status
watch(
  () => activeProfileId.value,
  async (newProfileId, oldProfileId) => {
    if (newProfileId !== oldProfileId) {
      lastHistoryKeyByTabId.clear();
      void syncHistoryTracking();
      if (newProfileId) {
        // Small delay to ensure profile is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await checkOnboardingStatus();
    }
  }
);

watch(
  () => profilesState.value.length,
  async (nextCount, prevCount) => {
    if (nextCount !== prevCount) {
      if (!nextCount) {
        lastHistoryKeyByTabId.clear();
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      await checkOnboardingStatus();
    }
  }
);

function currentTitle(t: Tab): string {
  const h = t.history || [];
  const idx = Math.min(Math.max(t.history_position ?? 0, 0), Math.max(h.length - 1, 0));
  return h[idx]?.title ?? 'New tab';
}

function currentUrlForTab(t: Tab | null | undefined): string {
  if (!t) return '';
  const h = Array.isArray(t.history) ? t.history : [];
  const idx = Math.min(Math.max(t.history_position ?? 0, 0), Math.max(h.length - 1, 0));
  return String(h[idx]?.url || t.url || '').trim();
}

function currentSnapshotForTab(t: Tab): { url: string; title: string } {
  return {
    url: currentUrlForTab(t),
    title: String(currentTitle(t) || '').trim(),
  };
}

function getActiveTab(): Tab | null {
  return tabs.value.find((entry) => entry.id === activeId.value) || null;
}

const activeTabTitle = computed(() => {
  const active = getActiveTab();
  return active ? currentTitle(active) : '';
});

async function syncHistoryTracking() {
  const seq = ++historySyncSeq;
  const snapshots = tabs.value.map((tab) => ({
    id: tab.id,
    ...currentSnapshotForTab(tab),
  }));
  const liveTabIds = new Set(snapshots.map((snapshot) => snapshot.id));

  for (const snapshot of snapshots) {
    if (seq !== historySyncSeq) return;
    if (!snapshot.url) continue;

    const comparisonKey = await normalizeHistoryUrlForComparison(snapshot.url);
    if (seq !== historySyncSeq) return;
    if (!comparisonKey) continue;
    if (lastHistoryKeyByTabId.get(snapshot.id) === comparisonKey) continue;

    lastHistoryKeyByTabId.set(snapshot.id, comparisonKey);
    await recordHistoryVisit(snapshot.url, { title: snapshot.title });
    if (seq !== historySyncSeq) return;
  }

  for (const tabId of Array.from(lastHistoryKeyByTabId.keys())) {
    if (!liveTabIds.has(tabId)) {
      lastHistoryKeyByTabId.delete(tabId);
    }
  }
}

watch(
  () =>
    tabs.value
      .map((tab) => {
        const snapshot = currentSnapshotForTab(tab);
        return `${tab.id}::${snapshot.url}`;
      })
      .join('|'),
  () => {
    void syncHistoryTracking();
  },
  { immediate: true },
);

function getRuntimeIdFromExtensionUrl(rawUrl: string): string {
  try {
    return String(new URL(String(rawUrl || '').trim()).hostname || '').trim();
  } catch {
    return '';
  }
}

async function listInstalledExtensions(force = false): Promise<any[]> {
  const now = Date.now();
  if (!force && installedExtensionsCache.length && now - installedExtensionsCacheAt < 5000) {
    return installedExtensionsCache;
  }
  try {
    const api: any = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== 'function') return installedExtensionsCache;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return installedExtensionsCache;
    installedExtensionsCache = Array.isArray(result.extensions) ? result.extensions : [];
    installedExtensionsCacheAt = now;
  } catch {
    // ignore
  }
  return installedExtensionsCache;
}

function closeExtensionPopup() {
  extensionPopup.value = {
    visible: false,
    extensionId: '',
    targetUrl: '',
    name: '',
    originTabId: '',
    userGesture: false,
  };
}

async function resolveExtensionPopupRequest(input: any): Promise<null | {
  extensionId: string;
  targetUrl: string;
  name: string;
  userGesture: boolean;
}> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const extensionId = String(input.extensionId || '').trim();
    const targetUrl = String(input.targetUrl || input.url || '').trim();
    const name = String(input.name || '').trim();
    const userGesture = !!input.userGesture;
    if (extensionId) {
      return { extensionId, targetUrl, name, userGesture };
    }
    if (targetUrl) {
      input = targetUrl;
    }
  }

  const raw = String(input || '').trim();
  if (!raw) return null;

  const routeInfo = parseExtensionTabUrl(raw);
  if (routeInfo?.extensionId) {
    return {
      extensionId: String(routeInfo.extensionId || '').trim(),
      targetUrl: String(routeInfo.targetUrl || '').trim(),
      name: String(routeInfo.name || '').trim(),
      userGesture: false,
    };
  }

  const normalized = normalizeTabUrl(raw);
  if (!isExtensionUrl(normalized)) return null;

  const runtimeId = getRuntimeIdFromExtensionUrl(normalized);
  if (!runtimeId) return null;

  const installed = await listInstalledExtensions();
  const entry =
    installed.find((item: any) => String(item?.runtimeId || '').trim() === runtimeId) || null;
  if (!entry) return null;

  return {
    extensionId: String(entry?.id || '').trim(),
    targetUrl: normalized,
    name: String(entry?.name || '').trim(),
    userGesture: false,
  };
}

async function openExtensionPopup(input: any): Promise<boolean> {
  const request = await resolveExtensionPopupRequest(input);
  if (!request?.extensionId) return false;
  extensionPopup.value = {
    visible: true,
    extensionId: request.extensionId,
    targetUrl: request.targetUrl,
    name: request.name,
    originTabId: activeId.value,
    userGesture: !!request.userGesture,
  };
  return true;
}

function navigateActiveTab(url: string, opts: { push?: boolean } = {}) {
  const tab = getActiveTab();
  if (!tab) return;

  const push = opts.push ?? true;
  const target = normalizeTabUrl(url);
  if (!Array.isArray(tab.history)) tab.history = [];

  const currentPos = tab.history_position ?? tab.history.length - 1;
  const title = getInternalTitle(target);

  if (!push && tab.history.length) {
    const pos = currentPos >= 0 ? currentPos : tab.history.length - 1;
    const entry = tab.history[pos];
    if (entry) {
      entry.url = target;
      entry.title = title;
      tab.history_position = pos;
    }
  } else {
    if (currentPos >= 0 && currentPos < tab.history.length - 1) {
      tab.history = tab.history.slice(0, currentPos + 1);
    }
    tab.history.push({ url: target, title });
    tab.history_position = tab.history.length - 1;
  }

  tab.url = target;
  tab.draftUrl = target;
}

function handleExtensionPopupNavigate(payload: { url: string; openInNewTab?: boolean }) {
  const target = String(payload?.url || '').trim();
  if (!target) return;
  if (payload?.openInNewTab) {
    void openInNewTab(target);
    return;
  }
  if (parseExtensionTabUrl(target) || isExtensionUrl(target)) {
    void openExtensionPopup(target);
    return;
  }
  navigateActiveTab(target, { push: true });
}

async function resolveOpenTargetUrl(rawUrl: string): Promise<string> {
  return normalizeTabUrl(rawUrl);
}

function makeTab(partial?: Partial<Tab>): Tab {
  const id = nextTabId();
  const defaultUrl = 'lumen://newtab';
  const defaultTitle = getInternalTitle(defaultUrl);
  const history = partial?.history || [{ url: defaultUrl, title: defaultTitle }];
  const history_position = partial?.history_position ?? 0;
  const current = history[history_position] || history[0];
  const normalizedHistory = history.map((h) =>
    h && typeof h.url === "string" ? { ...h, url: normalizeTabUrl(h.url) } : h,
  );
  const normalizedCurrent = normalizedHistory[history_position] || normalizedHistory[0];
  return {
    id,
    url: normalizeTabUrl((normalizedCurrent && (normalizedCurrent as any).url) || defaultUrl),
    history: normalizedHistory,
    history_position,
    loading: false
  };
}

function addTab() {
  const t = makeTab();
  tabs.value.push(t);
  activeId.value = t.id;
  nextTick(recalcLabelWidth);
}

function closeTab(id: string) {
  if (tabs.value.length === 1) {
    const only = tabs.value[0];
    if (!only || only.id !== id) return;
    const t = makeTab();
    tabs.value = [t];
    activeId.value = t.id;
    nextTick(recalcLabelWidth);
    return;
  }
  const idx = tabs.value.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const closingActive = activeId.value === id;
  tabs.value.splice(idx, 1);
  if (closingActive) {
    const next = tabs.value[idx] || tabs.value[idx - 1] || tabs.value[0];
    if (next) activeId.value = next.id;
  }
  nextTick(recalcLabelWidth);
}

async function openInNewTab(url: string) {
  if (await openExtensionPopup(url)) {
    return;
  }
  const normalized = await resolveOpenTargetUrl(url);
  if (!normalized) return;
  if (pendingOpenTargets.has(normalized)) return;
  pendingOpenTargets.add(normalized);
  try {
    const existing = tabs.value.find((entry) => currentUrlForTab(entry) === normalized);
    if (existing) {
      activeId.value = existing.id;
      return;
    }

    const title = getInternalTitle(normalized);
    const t = makeTab({ history: [{ url: normalized, title }], history_position: 0 });
    t.url = normalized;
    tabs.value.push(t);
    activeId.value = t.id;
    nextTick(recalcLabelWidth);
  } finally {
    pendingOpenTargets.delete(normalized);
  }
}

  // Expose tab opening to internal pages via provide/inject
  provide('openInNewTab', (url: string) => {
    void openInNewTab(url);
  });
  provide('openExtensionPopup', (input: any) => {
    void openExtensionPopup(input);
  });

  const INTERNAL_KEYS = new Set((INTERNAL_ROUTE_KEYS || []).map((k: string) => String(k).toLowerCase()));

  function parseLumenHost(rawUrl: string): string {
    const s = String(rawUrl || '').trim();
    if (!/^lumen:\/\//i.test(s)) return '';
    const withoutScheme = s.slice('lumen://'.length);
    return (withoutScheme.split(/[\/?#]/, 1)[0] || '').trim().toLowerCase();
  }

  function isDomainHost(host: string): boolean {
    const h = String(host || '').trim().toLowerCase();
    if (!h) return false;
    if (INTERNAL_KEYS.has(h)) return false;
    return h.includes('.');
  }

  const faviconCacheByHost = new Map<string, string | null>();
  const faviconInflightByHost = new Map<string, Promise<string | null>>();

  async function resolveFaviconForHost(host: string): Promise<string | null> {
    const h = String(host || '').trim().toLowerCase();
    if (!isDomainHost(h)) return null;

    try {
      const { target } = await resolveDomainTarget(h);
      const cid =
        target.proto === 'ipfs'
          ? String(target.id || '').trim()
          : await resolveIpnsToCid(target.id).catch(() => null);

      if (!cid) return null;

      const path = '/favicon.ico';
      const ipfsTarget = { proto: 'ipfs' as const, id: cid };

      const localUrl = buildCandidateUrl(localIpfsGatewayBase(), ipfsTarget, path, '');
      if (await probeUrl(localUrl, 1500)) return localUrl;

      const bases = await loadWhitelistedGatewayBases().catch(() => [] as string[]);
      if (!bases.length) return null;

      const probes = bases.map((base) => {
        const url = buildCandidateUrl(base, ipfsTarget, path, '');
        return probeUrl(url, 1500).then((ok) => {
          if (!ok) throw new Error('not_found');
          return url;
        });
      });

      return await Promise.any(probes);
    } catch {
      return null;
    }
  }

  async function getFaviconForHost(host: string): Promise<string | null> {
    const h = String(host || '').trim().toLowerCase();
    if (!h) return null;
    if (faviconCacheByHost.has(h)) return faviconCacheByHost.get(h) ?? null;
    const inflight = faviconInflightByHost.get(h);
    if (inflight) return await inflight;

    const p = resolveFaviconForHost(h)
      .then((res) => {
        faviconCacheByHost.set(h, res ?? null);
        faviconInflightByHost.delete(h);
        return res ?? null;
      })
      .catch(() => {
        faviconCacheByHost.set(h, null);
        faviconInflightByHost.delete(h);
        return null;
      });

    faviconInflightByHost.set(h, p);
    return await p;
  }

  const tabHostById = new Map<string, string>();

  function onFaviconError(t: Tab) {
    t.favicon = null;
  }

  async function ensureTabFavicon(t: Tab) {
    const url = String(t.url || '').trim();
    const host = parseLumenHost(url);

    const prev = tabHostById.get(t.id) || '';
    if (prev === host) return;
    tabHostById.set(t.id, host);

    if (!host) {
      t.favicon = lumenFavicon;
      return;
    }

    if (INTERNAL_KEYS.has(host)) {
      t.favicon = lumenFavicon;
      return;
    }

    if (!isDomainHost(host)) {
      t.favicon = null;
      return;
    }

    const reqHost = host;
    const icon = await getFaviconForHost(reqHost);
    if (tabHostById.get(t.id) !== reqHost) return;
    t.favicon = icon;
  }

  watch(
    () => tabs.value.map((t) => t.url || ''),
    () => {
      tabs.value.forEach((t) => void ensureTabFavicon(t));
    },
    { immediate: true },
  );
  
  function measureLayout() {
    const root = hdr.value;
    if (!root) return;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mainscreen-tab'));
  const rootLeft = root.getBoundingClientRect().left;
  layout.value = nodes.map((n, i) => {
    const r = n.getBoundingClientRect();
    return {
      id: (n.dataset.id as string) || tabs.value[i]?.id || `i${i}`,
      left: r.left - rootLeft,
      width: r.width,
      center: r.left - rootLeft + r.width / 2
    };
  });
}

function currentLeftById() {
  const root = hdr.value;
  if (!root) return {};
  const rootLeft = root.getBoundingClientRect().left;
  const map: Record<string, number> = {};
  root.querySelectorAll<HTMLElement>('.mainscreen-tab').forEach((el) => {
    const id = el.dataset.id as string;
    const rect = el.getBoundingClientRect();
    map[id] = rect.left - rootLeft;
  });
  return map;
}

function tabStyle(id: string) {
  if (draggingId.value === id) {
    return { transform: `translateX(${dragDx.value}px)` };
  }
  const s = shifts.value[id] ?? 0;
  return s ? { transform: `translateX(${s}px)` } : null;
}

function onTabPointerDown(e: PointerEvent, id: string, idx: number) {
  if (e.button !== 0) return;
  activeId.value = id;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;

  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    // ignore
  }

  draggingId.value = id;
  dragStartX.value = e.clientX;
  dragDx.value = 0;
  startIndex.value = idx;
  isDragging.value = false;
  shifts.value = {};

  measureLayout();
  const lay = layout.value[startIndex.value];
  draggingWidth.value = lay?.width ?? 0;
  dropIndex.value = idx;
  dropLeft.value = lay?.left ?? 0;

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - dragStartX.value;

    if (!isDragging.value && Math.abs(dx) > 6) {
      isDragging.value = true;
      document.documentElement.style.userSelect = 'none';
    }
    if (!isDragging.value) return;

    dragDx.value = dx;
    const start = layout.value[startIndex.value];
    if (!start) return;

    const centerX = start.left + dx + start.width / 2;

    let target = layout.value.findIndex((it) => centerX < it.center);
    if (target === -1) target = layout.value.length;

    dropIndex.value = target;

    dropLeft.value =
      target === layout.value.length
        ? (layout.value[target - 1]?.left ?? 0) + (layout.value[target - 1]?.width ?? 0)
        : layout.value[target]?.left ?? 0;

    const from = startIndex.value;
    const to = target;
    const w = draggingWidth.value;
    const sh: Record<string, number> = {};

    if (to > from) {
      for (let i = 0; i < layout.value.length; i++) {
        const idAt = layout.value[i]?.id;
        if (!idAt || idAt === draggingId.value) continue;
        if (i >= from + 1 && i <= to - 1) sh[idAt] = -w;
        if (i === to) sh[idAt] = -w;
      }
    } else if (to < from) {
      for (let i = 0; i < layout.value.length; i++) {
        const idAt = layout.value[i]?.id;
        if (!idAt || idAt === draggingId.value) continue;
        if (i >= to && i <= from - 1) sh[idAt] = +w;
      }
    }
    shifts.value = sh;
  };

  const onUp = async (ev: PointerEvent) => {
    try {
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        // ignore
      }

      const didDrag = isDragging.value;
      isDragging.value = false;

      const before = currentLeftById();

      if (didDrag) {
        const from = startIndex.value;
        let to = dropIndex.value;
        if (to > from) to -= 1;

        if (from !== -1 && to !== -1 && from !== to) {
          const arr = tabs.value.slice();
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
          tabs.value = arr;
          activeId.value = moved.id;

          await nextTick();

          const after = currentLeftById();
          const root = hdr.value;
          if (root) {
            root.querySelectorAll<HTMLElement>('.mainscreen-tab').forEach((node) => {
              const idNode = node.dataset.id as string;
              if (before[idNode] === undefined || after[idNode] === undefined) return;
              const delta = before[idNode] - after[idNode];
              node.style.transform = `translateX(${delta}px)`;
              void node.offsetWidth;
              node.style.transform = '';
            });
          }
        }
      }
    } finally {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.documentElement.style.userSelect = '';

      draggingId.value = null;
      dragDx.value = 0;
      startIndex.value = -1;
      dropIndex.value = -1;
      shifts.value = {};
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

let ro: ResizeObserver | null = null;

function recalcLabelWidth() {
  const root = hdr.value;
  if (!root) return;
  const n = tabs.value.length || 1;
  const total = root.clientWidth;
  const plusW = (addBtn.value?.offsetWidth ?? 36) + 8;
  const firstTab = root.querySelector<HTMLElement>('.mainscreen-tab');
  const firstLabel = root.querySelector<HTMLElement>('.mainscreen-tab .mainscreen-tab-label');
  let extras = 64;
  if (firstTab && firstLabel) {
    extras = firstTab.offsetWidth - firstLabel.offsetWidth;
    if (extras < 40) extras = 40;
  }
  const available = total - plusW - GAP * Math.max(0, n - 1);
  const per = Math.floor((available - n * extras) / n);
  labelWidth.value = Math.max(MIN_LABEL, Math.min(MAX_LABEL, per));
}

function createResizeObserver() {
  if (ro) return;
  ro = new ResizeObserver(() => recalcLabelWidth());
  if (hdr.value) ro.observe(hdr.value);
  window.addEventListener('resize', recalcLabelWidth);
}

async function checkOnboardingStatus() {
  try {
    const hasUserProfiles = profilesState.value.some((profile) => profile?.role !== 'guest');
    if (!hasUserProfiles) {
      showOnboarding.value = true;
      return;
    }

    if (onboardingSkippedUntilRestart) {
      return;
    }

    const profileId = activeProfileId.value;
    if (!profileId) {
      showOnboarding.value = true;
      return;
    }

    // Check if onboarding was already completed for this profile
    const storageKey = ONBOARDING_KEY_PREFIX + profileId;
    const completed = localStorage.getItem(storageKey);
    if (completed === 'true') {
      return;
    }

    // Check if password is already set
    const securityApi = useInternalLumen()?.security;
    if (!securityApi || typeof securityApi.getStatus !== 'function') {
      // Security API not available, skip onboarding
      return;
    }

    const status = await securityApi.getStatus();
    const hasPassword = !!(status?.passwordEnabled && status?.hasPassword);

    const profilesApi = useInternalLumen()?.profiles;
    if (!profilesApi || typeof profilesApi.getActive !== 'function') {
      return;
    }

    const activeProfile = await profilesApi.getActive();
    const isGuestProfile = !!(activeProfile && activeProfile.role === 'guest');
    let walletReady = false;
    if (
      !isGuestProfile &&
      typeof profilesApi.isWalletFullyCreated === 'function' &&
      profileId
    ) {
      const walletStatus = await profilesApi.isWalletFullyCreated(profileId);
      walletReady = !!walletStatus?.ok;
    }

    if (hasPassword && walletReady) {
      localStorage.setItem(storageKey, 'true');
      return;
    }

    // Show onboarding modal
    showOnboarding.value = true;
  } catch (e) {
    console.error('[MainScreen] Error checking onboarding status:', e);
  }
}

function handleOnboardingComplete() {
  const profileId = activeProfileId.value;
  if (profileId) {
    const storageKey = ONBOARDING_KEY_PREFIX + profileId;
    localStorage.setItem(storageKey, 'true');
  }
  showOnboarding.value = false;
}

function handleOnboardingSkip() {
  // User skipped: don't ask again until next launch.
  onboardingSkippedUntilRestart = true;
  showOnboarding.value = false;
}
</script>

