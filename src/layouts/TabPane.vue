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
import { computed, provide, reactive } from "vue";
import {
  INTERNAL_ROUTE_KEYS,
  resolveInternalComponent,
  getInternalTitle,
} from "../internal/routes";

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  url?: string;
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

provide("navigate", (url: string, opts?: { push?: boolean }) => {
  navigateInternal(url, opts || {});
});

function normalizeInternalUrl(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "lumen://home";
  if (/^https?:\/\//i.test(v)) return v;
  const u = /^lumen:\/\//i.test(v) ? v : `lumen://${v}`;
  // Canonicalize root lumen URLs so history/back doesn't bounce between
  // `lumen://host` and `lumen://host/`.
  try {
    const rest = u.slice("lumen://".length);
    const m = rest.match(/^([^/?#]+)(.*)$/);
    const host = (m?.[1] || "").trim();
    const tail = m?.[2] || "";
    if (host && (!tail || tail.startsWith("?") || tail.startsWith("#"))) {
      return `lumen://${host}/${tail}`;
    }
  } catch {
    // ignore
  }
  return u;
}

const INTERNAL_KEYS = new Set(
  (INTERNAL_ROUTE_KEYS || []).map((k: string) => String(k).toLowerCase()),
);

function cacheKeyForUrl(rawUrl: string): string {
  const s = String(rawUrl || "").trim();
  if (!s) return "home";
  if (/^https?:\/\//i.test(s)) return "web";

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

  const u = normalizeInternalUrl(url);

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
}

function componentForTab(t: Tab) {
  const url = t.url || "lumen://home";
  return resolveInternalComponent(url);
}
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
