<template>
  <!-- ####### NavBar TOP BAR (shared across all pages) ####### -->
  <header class="flex-align-center gap-12px py-8px px-12px bg-primary border-bottom-default min-h-48px">
    <div class="flex-align-center gap-4px">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :disabled="!canGoBack"
        :title="t('Back')"
        @click="previous" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <ArrowLeft :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :disabled="!canGoForward"
        :title="t('Forward')"
        @click="next" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <ArrowRight :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" v-if="!isExtensionTab"
        :aria-busy="loading ? 'true' : 'false'"
        :disabled="loading"
        :title="loading ? t('Loading…') : t('Refresh')"
        @click="refresh" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <UiSpinner v-if="loading" size="sm" />
        <RefreshCw v-else :size="16" />
      </UiButton>
    </div>

    <NavBarAddressBar
      v-model="urlField"
      :favourite="favActive"
      @submit="onSubmit"
      @toggle-favourite="onToggleFavourite"
    />

    <div class="flex-align-center gap-4px">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :title="t('Home')"
        @click="emit('goto', 'lumen://home')" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <House :size="16" />
      </UiButton>
    </div>

    <NavBarExtensionsMenu @goto="emit('goto', $event)" />
    <NavBarProfileMenu />
  </header>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, RefreshCw, House } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import NavBarAddressBar from '../components/NavBarAddressBar.vue';
import NavBarExtensionsMenu from '../components/NavBarExtensionsMenu.vue';
import NavBarProfileMenu from '../components/NavBarProfileMenu.vue';
import { useFavourites } from '../stores/favouritesStore';
import { normalizeAddressInput } from '../internal/navigationUrl';
import { clamp } from '../internal/services/coerce';
import type { Tab } from '../types/tab';

const props = defineProps<{
  tabActive: string;
  tabs: Tab[];
  loading: boolean;
  currentUrl?: string;
  isExtensionTab?: boolean;
}>();

const emit = defineEmits<{
  (e: 'goto', url: string): void;
  (e: 'history-step', payload: { delta: number }): void;
  (e: 'refresh-request'): void;
  (e: 'openSettings'): void;
}>();

const urlField = ref('');

const { toggleFavourite, isFav } = useFavourites();

const favActive = computed(() => {
  if (props.currentUrl == null) return false;
  return isFav(props.currentUrl);
});

function onToggleFavourite() {
  if (props.currentUrl == null) return;
  toggleFavourite(props.currentUrl, { title: currentHistoryTitle.value });
}

const activeTab = computed<Tab | null>(() => props.tabs.find((t) => t.id === props.tabActive) ?? null);

const currentHistoryTitle = computed(() => {
  const tab = activeTab.value;
  if (!tab || !Array.isArray(tab.history) || !tab.history.length) return '';
  const position = Number.isFinite(Number(tab.history_position))
    ? clamp(tab.history_position, 0, tab.history.length - 1)
    : tab.history.length - 1;
  return String(tab.history[position]?.title || '').trim();
});

const canGoBack = computed(() => {
  const tab = activeTab.value;
  if (!tab || !Array.isArray(tab.history)) return false;
  return (tab.history_position ?? 0) > 0;
});

const canGoForward = computed(() => {
  const tab = activeTab.value;
  if (!tab || !Array.isArray(tab.history)) return false;
  return (tab.history_position ?? 0) < tab.history.length - 1;
});

const loading = computed(() => props.loading);
const isExtensionTab = computed(() => !!props.isExtensionTab);

watch(
  () => [props.currentUrl, props.tabActive],
  ([val]) => {
    const v = String(val || '');
    if (urlField.value !== v) urlField.value = v;
  },
  { immediate: true }
);

// Kept on the tab so switching away and back restores what was half-typed.
watch(urlField, (value) => {
  const tab = activeTab.value;
  if (tab) tab.draftUrl = value;
});

const BUILTIN_HOSTS = [
  'home',
  'search',
  'drive',
  'wallet',
  'extensions',
  'network',
  'settings',
  'help',
  'domain',
  'ipfs',
  'gateways',
  'release',
  'newtab'
];

function previous() {
  if (!canGoBack.value) return;
  stepHistory(-1);
}

function next() {
  if (!canGoForward.value) return;
  stepHistory(1);
}

/**
 * Both the emit and the window event, because two different things listen: the
 * parent owns the tab record, and the page currently rendered inside the tab
 * has no path to that emit.
 */
function stepHistory(delta: number) {
  emit('history-step', { delta });
  try {
    window.dispatchEvent(
      new CustomEvent('lumen:tab-history-step', { detail: { delta, tabId: props.tabActive } })
    );
  } catch {
    // ignore
  }
}

function refresh() {
  emit('refresh-request');
}

function onSubmit(raw: string) {
  const target = normalizeAddressInput(raw || '', BUILTIN_HOSTS);
  const tab = activeTab.value;
  if (tab) tab.draftUrl = undefined;
  urlField.value = target;
  emit('goto', target);
}
</script>
