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
      :loading="!activeTabIsExtension && !!activeTab?.loading"
      :is-extension-tab="activeTabIsExtension"
      :current-url="currentUrl()"
      @goto="onGotoFromNavbar"
      @refresh-request="onRefresh"
      @history-step="onHistoryStep"
      @open-settings="openSettings"
    />

    <div class="min-h-0 overflow-hidden relative flex w-full flex-1">
      <TabPane
        v-for="t in tabs"
        :key="t.id"
        :tab="t"
        :active="t.id === tabActive"
      />
      <FindBar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, provide, reactive, watch } from "vue";
import NavBar from "./NavBar.vue";
import TabPane from "./TabPane.vue";
import FindBar from "../components/FindBar.vue";
import { useInternalLumen } from '../composables/useInternalLumen';
import { normalizeTabUrl, parseExtensionTabUrl } from "../internal/services/navigationUrl";
import type { Tab, RegisterFindTargetFn } from "../types/tab";
import { navigateTabToInternalUrl } from '../internal/services/tabHistory';
import { tabCurrentUrl } from '../internal/services/tabPosition';
import { safeNumber } from "../internal/services/coerce";


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
  props.tabs.find((t) => t.id === props.tabActive)
);
const activeTabIsExtension = computed(() => !!parseExtensionTabUrl(currentUrl()));

const findTargets = reactive<Record<string, number | null>>({});

provide("findRegisterTarget", ((tabId: string, targetIdMaybe: number | null) => {
  const id = String(tabId || "").trim();
  if (!id) return;
  const targetId = safeNumber(targetIdMaybe);
  findTargets[id] = targetId;
}) as RegisterFindTargetFn);

const activeFindTarget = computed<number | null>(() => {
  const id = findTargets[String(props.tabActive || "").trim()];
  return safeNumber(id);
});

provide("findActiveTargetWebContentsId", activeFindTarget);

watch(
  () => activeFindTarget.value,
  (targetId) => {
    try {
      const api: any = useInternalLumen()?.find;
      api?.setActiveTarget?.(targetId ?? null);
    } catch {
      // ignore
    }
  },
  { immediate: true },
);

/**
 * What the address bar shows. Unlike the pane below it, a draft wins: while
 * the user is typing, the bar shows what they typed, not where the tab is.
 */
function currentUrl(): string {
  const tab = activeTab.value;
  if (tab?.draftUrl !== undefined) return tab.draftUrl;
  return tabCurrentUrl(tab, { fallback: "lumen://newtab" });
}

function navigateInternal(url: string, opts: { push?: boolean } = {}) {
  navigateTabToInternalUrl(activeTab.value, url, opts);
}

function onGotoFromNavbar(url: string) {
  const target = normalizeTabUrl(url);
  const tab = activeTab.value;
  const current = tab?.url ? normalizeTabUrl(tab.url) : "lumen://newtab";

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
  if (activeTabIsExtension.value) return;
  tab.refreshTick = (tab.refreshTick ?? 0) + 1;
  navigateInternal(tabCurrentUrl(tab, { fallback: "lumen://newtab" }), { push: false });
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
