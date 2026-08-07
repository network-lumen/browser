<template>
  <div class="absolute inset-0 min-h-0" :class="active ? 'flex' : 'hidden'">
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
} from "../internal/routes";
import { isBrowserUrl, parseExtensionTabUrl } from "../internal/navigationUrl";
import type { Tab } from "../types/tab";
import { navigateTabToInternalUrl } from '../internal/services/tabHistory';
import { tabCurrentUrl } from '../internal/services/tabPosition';

const props = defineProps<{
  tab: Tab;
  active: boolean;
}>();

const tabState = computed(() => reactive(props.tab as any) as Tab);
const loadCycle = ref(0);
const loadCycleControlled = ref(0);

function isExtensionTabUrl(rawUrl: string): boolean {
  return !!parseExtensionTabUrl(String(rawUrl || "").trim());
}

function currentUrl(): string {
  return tabCurrentUrl(tabState.value, { fallback: "lumen://newtab" });
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
  if (isExtensionTabUrl(currentUrl())) {
    tab.loading = false;
    return;
  }
  loadCycleControlled.value = Math.max(loadCycleControlled.value, loadCycle.value);
  tab.loading = !!next;
}

provide("setCurrentTabLoading", setCurrentTabLoading);

provide("setTabFavicon", (icon: string | null) => {
  const tab = tabState.value;
  if (!tab) return;
  tab.favicon = icon || null;
});

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
  navigateTabToInternalUrl(tabState.value, url, opts);
}

function componentForTab(t: Tab) {
  const url = t.url || "lumen://newtab";
  return resolveInternalComponent(url);
}

async function beginTabLoad() {
  const tab = tabState.value;
  if (!tab) return;
  if (isExtensionTabUrl(currentUrl())) {
    tab.loading = false;
    return;
  }

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
