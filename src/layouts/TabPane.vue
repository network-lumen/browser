<template>
  <div class="tab-pane" :class="{ active }">
    <KeepAlive>
      <component
        :key="`${tabState.id}::${cacheKeyForUrl(tabState.url || '')}`"
        :is="componentForTab(tabState)"
        class="flex w-full h-full"
      />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, reactive, ref, watch } from "vue";
import {
  INTERNAL_ROUTE_KEYS,
  resolveInternalComponent,
  getInternalTitle,
} from "../internal/routes";
import { isBrowserUrl, normalizeTabUrl } from "../internal/navigationUrl";

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  url?: string;
  draftUrl?: string;
  title?: string;
  history?: TabHistoryEntry[];
  history_position?: number;
  loading?: boolean;
  refreshTick?: number;
  favicon?: string | null;
};

const props = defineProps<{
  tab: Tab;
  active: boolean;
}>();

const tabState = computed(() => reactive(props.tab as any) as Tab);
const loadCycle = ref(0);
const loadCycleControlled = ref(0);

function currentUrl(): string {
  const tab = tabState.value;
  const fallback = tab?.url || "lumen://home";
  const history = Array.isArray(tab?.history) ? tab.history : [];
  const rawPos =
    typeof tab?.history_position === "number"
      ? tab.history_position
      : history.length - 1;
  const max = Math.max(history.length - 1, 0);
  const pos = Math.min(Math.max(rawPos, 0), max);
  const entry = history[pos] || history[history.length - 1];
  const url = typeof entry?.url === "string" ? entry.url.trim() : "";
  return url || fallback;
}

provide(
  "currentTabUrl",
  computed(() => currentUrl()),
);

provide(
  "currentTabId",
  computed(() => tabState.value?.id || ""),
);

provide(
  "currentTabRefresh",
  computed(() => tabState.value?.refreshTick ?? 0),
);

provide(
  "currentTabIsActive",
  computed(() => !!props.active),
);

function setCurrentTabLoading(next: boolean) {
  const tab = tabState.value;
  if (!tab) return;
  loadCycleControlled.value = Math.max(loadCycleControlled.value, loadCycle.value);
  tab.loading = !!next;
}

provide("setCurrentTabLoading", setCurrentTabLoading);

provide("navigate", (url: string, opts?: { push?: boolean }) => {
  navigateInternal(url, opts || {});
});

const INTERNAL_KEYS = new Set(
  (INTERNAL_ROUTE_KEYS || []).map((k: string) => String(k).toLowerCase()),
);

function cacheKeyForUrl(rawUrl: string): string {
  const s = String(rawUrl || "").trim();
  if (!s) return "home";
  if (isBrowserUrl(s)) return "web";

  const withoutScheme = /^lumen:\/\//i.test(s) ? s.slice("lumen://".length) : s;
  const host = (withoutScheme.split(/[\/?#]/, 1)[0] || "").toLowerCase();
  if (!host) return "home";
  if (INTERNAL_KEYS.has(host)) return host;
  if (host.includes(".")) return "site";
  return "search";
}

function navigateInternal(url: string, opts: { push?: boolean } = {}) {
  const push = opts.push ?? true;
  const tab = tabState.value;
  if (!tab) return;

  const u = normalizeTabUrl(url);

  if (!Array.isArray(tab.history)) tab.history = [];

  const currentPos = tab.history_position ?? tab.history.length - 1;
  const title = getInternalTitle(u);

  if (!push && tab.history.length) {
    const pos = currentPos >= 0 ? currentPos : tab.history.length - 1;
    const entry = tab.history[pos];
    if (entry) {
      entry.url = u;
      entry.title = title;
      tab.history_position = pos;
    }
  } else {
    if (currentPos >= 0 && currentPos < tab.history.length - 1) {
      tab.history = tab.history.slice(0, currentPos + 1);
    }
    const entry: TabHistoryEntry = { url: u, title };
    tab.history.push(entry);
    tab.history_position = tab.history.length - 1;
  }

  tab.url = u;
  tab.title = title;
  tab.draftUrl = u;
}

function componentForTab(t: Tab) {
  const url = t.url || "lumen://home";
  return resolveInternalComponent(url);
}

async function beginTabLoad() {
  const tab = tabState.value;
  if (!tab) return;

  const cycle = loadCycle.value + 1;
  loadCycle.value = cycle;
  tab.loading = true;

  await nextTick();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  if (loadCycle.value !== cycle) return;
  if (loadCycleControlled.value < cycle) {
    tab.loading = false;
  }
}

watch(
  () => [currentUrl(), Number(tabState.value?.refreshTick ?? 0)],
  () => {
    void beginTabLoad();
  },
  { immediate: true },
);
</script>

<style scoped>
.tab-pane {
  position: absolute;
  inset: 0;
  min-height: 0;
  display: none;
}

.tab-pane.active {
  display: flex;
}
</style>
