<template>
  <div class="flex-1-1-auto flex flex-column">
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
      <KeepAlive>
        <component
          v-if="activeTab"
          :key="`${activeTab.id}::${activeTab.url || ''}`"
          :is="componentForTab(activeTab)"
          class="flex w-full h-full"
        />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue';
import NavBar from './NavBar.vue';
import { resolveInternalComponent, getInternalTitle } from '../internal/routes';

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  url?: string;
  title?: string;
  history?: TabHistoryEntry[];
  history_position?: number;
  loading?: boolean;
};

const props = defineProps<{ tabActive: string; tabs: Tab[]; header_height: number }>();
const emit = defineEmits<{
  (e: 'openInNewTab', url: string): void;
  (e: 'close-tab', payload: { id: string }): void;
}>();

const activeTab = computed<Tab | undefined>(() =>
  props.tabs.find((t) => t.id === props.tabActive)
);

function currentUrl(): string {
  const t = activeTab.value;
  return t?.url || 'lumen://home';
}

// Provide current URL to child components
provide('currentTabUrl', computed(() => currentUrl()));
// Provide in-tab navigation to internal pages
provide('navigate', (url: string, opts?: { push?: boolean }) => {
  navigateInternal(url, opts || {});
});

function normalizeInternalUrl(raw: string): string {
  const v = String(raw || '').trim();
  if (!v) return 'lumen://home';
  if (/^lumen:\/\//i.test(v)) return v;
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
  const current = tab?.url ? normalizeInternalUrl(tab.url) : 'lumen://home';

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
  const history = tab.history || [];
  const pos = tab.history_position ?? history.length - 1;
  const entry = history[pos] || history[history.length - 1];
  const target = entry?.url || tab.url || 'lumen://home';
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
    tab.url = entry.url;
  }
}

function openSettings() {
  emit('openInNewTab', 'lumen://settings');
}

function componentForTab(t: Tab) {
  const url = t.url || 'lumen://home';
  return resolveInternalComponent(url);
}
</script>
