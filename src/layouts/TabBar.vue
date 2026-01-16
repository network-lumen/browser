<template>
  <div
    class="flex flex-column"
    :style="{
      height: `calc(100vh - ${header_height}px)`,
      minHeight: `calc(100vh - ${header_height}px)`,
    }"
  >
    <NavBar
      ref="nav"
      :tabActive="tabActive"
      :tabs="tabs"
      :loading="false"
      :current-url="currentUrl()"
      @goto="onGotoFromNavbar"
      @refresh-request="onRefresh"
      @history-step="onHistoryStep"
      @open-settings="openSettings"
    />

    <div class="content-stack flex w-full flex-1">
      <TabPane
        v-for="t in tabs"
        :key="t.id"
        :tab="t"
        :active="t.id === tabActive"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import NavBar from "./NavBar.vue";
import TabPane from "./TabPane.vue";
import {
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
  tabActive: string;
  tabs: Tab[];
  header_height: number;
}>();
const emit = defineEmits<{
  (e: "openInNewTab", url: string): void;
  (e: "close-tab", payload: { id: string }): void;
}>();

const activeTab = computed<Tab | undefined>(() =>
  (() => {
    const found = props.tabs.find((t) => t.id === props.tabActive);
    return found ? (reactive(found as any) as Tab) : undefined;
  })(),
);

function currentUrl(): string {
  const t = activeTab.value;
  if (!t) return "lumen://home";
  const fallback = t.url || "lumen://home";
  const history = Array.isArray(t.history) ? t.history : [];
  const rawPos =
    typeof t.history_position === "number"
      ? t.history_position
      : history.length - 1;
  const max = Math.max(history.length - 1, 0);
  const pos = Math.min(Math.max(rawPos, 0), max);
  const entry = history[pos] || history[history.length - 1];
  const url = typeof entry?.url === "string" ? entry.url.trim() : "";
  return url || fallback;
}

function normalizeInternalUrl(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "lumen://home";
  if (/^lumen:\/\//i.test(v)) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `lumen://${v}`;
}

function navigateInternal(url: string, opts: { push?: boolean } = {}) {
  const push = opts.push ?? true;
  const tab = activeTab.value;
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

function onGotoFromNavbar(url: string) {
  const target = normalizeInternalUrl(url);
  const tab = activeTab.value;
  const current = tab?.url ? normalizeInternalUrl(tab.url) : "lumen://home";

  // If the user targets the same route as the current one, do not push history.
  if (current === target) {
    navigateInternal(target, { push: false });
  } else {
    navigateInternal(target, { push: true });
  }
}

function onRefresh() {
  const tab = activeTab.value;
  if (!tab) return;
  tab.refreshTick = (tab.refreshTick ?? 0) + 1;
  const history = tab.history || [];
  const pos = tab.history_position ?? history.length - 1;
  const entry = history[pos] || history[history.length - 1];
  const target = entry?.url || tab.url || "lumen://home";
  navigateInternal(target, { push: false });
}

function onHistoryStep(payload: { delta: number }) {
  const tab = activeTab.value;
  if (!tab) return;
  const history = tab.history || [];
  if (!history.length) return;

  const currentPos = tab.history_position ?? history.length - 1;
  let nextPos = currentPos + payload.delta;
  if (nextPos < 0) nextPos = 0;
  if (nextPos > history.length - 1) nextPos = history.length - 1;

  tab.history_position = nextPos;
  const entry = history[nextPos];
  if (entry?.url) {
    navigateInternal(entry.url, { push: false });
  }
}

function openSettings() {
  emit("openInNewTab", "lumen://settings");
}
</script>

<style scoped>
.content-stack {
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>
