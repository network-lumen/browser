<template>
  <div class="tab-pane" :class="{ active }">
    <KeepAlive>
      <component
        :key="`${tab.id}::${cacheKeyForUrl(tab.url || '')}`"
        :is="componentForTab(tab)"
        class="flex w-full h-full"
      />
    </KeepAlive>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue";
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

function currentUrl(): string {
  return props.tab?.url || "lumen://home";
}

provide(
  "currentTabUrl",
  computed(() => currentUrl()),
);

provide(
  "currentTabId",
  computed(() => props.tab?.id || ""),
);

provide(
  "currentTabRefresh",
  computed(() => props.tab?.refreshTick ?? 0),
);

provide("navigate", (url: string, opts?: { push?: boolean }) => {
  navigateInternal(url, opts || {});
});

function normalizeInternalUrl(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "lumen://home";
  if (/^lumen:\/\//i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `lumen://${v}`;
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
  const tab = props.tab;
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
