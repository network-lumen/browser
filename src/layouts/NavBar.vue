<template>
  <!-- ####### NavBar TOP BAR (shared across all pages) ####### -->
  <header class="flex-align-center gap-12px py-8px px-12px bg-primary border-bottom-default min-h-48px">
    <div class="relative narrow-only">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class=""
        :title="t('Menu')"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        @click.stop="menuOpen = !menuOpen"
        class="active-scale-98 flex-inline-align-justify-center size-32px">
        <Menu :size="18" />
      </UiButton>

      <div v-if="menuOpen" class="navbar-narrow-menu" role="menu">
        <UiButton variant="none" :disabled="!canGoBack" @click="runFromMenu(previous)"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover disabled-opacity-35-not-allowed">
          <ArrowLeft :size="16" /><span class="text-13px">{{ t('Back') }}</span>
        </UiButton>
        <UiButton variant="none" :disabled="!canGoForward" @click="runFromMenu(next)"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover disabled-opacity-35-not-allowed">
          <ArrowRight :size="16" /><span class="text-13px">{{ t('Forward') }}</span>
        </UiButton>
        <UiButton v-if="!isExtensionTab" variant="none" :disabled="loading" @click="runFromMenu(refresh)"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover disabled-opacity-35-not-allowed">
          <RefreshCw :size="16" /><span class="text-13px">{{ t('Refresh') }}</span>
        </UiButton>
        <UiButton variant="none" @click="runFromMenu(onToggleFavourite)"
          :class="{ 'color-yellow-override': favActive }"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover">
          <Star :size="16" :fill="favActive ? 'currentColor' : 'none'" />
          <span class="text-13px">{{ favActive ? t('Remove from shortcuts') : t('Add to shortcuts') }}</span>
        </UiButton>
        <UiButton v-if="canOpenExternally" variant="none" @click="runFromMenu(openExternally)"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover">
          <ExternalLink :size="16" /><span class="text-13px">{{ t('Open in system browser') }}</span>
        </UiButton>
        <UiButton variant="none" @click="runFromMenu(() => emit('goto', 'lumen://home'))"
          class="flex-align-center gap-10px w-full text-left border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-8px px-10px hover-bg-hover">
          <House :size="16" /><span class="text-13px">{{ t('Home') }}</span>
        </UiButton>
      </div>
    </div>

    <div class="flex-align-center gap-4px narrow-hide">
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
    >
      <template #trailing>
        <NavBarTabSwitcher
          v-model:open="tabPanelOpen"
          :tabs="tabs"
          :active-id="tabActive"
          @select="emit('select-tab', $event)"
          @close="emit('close-tab', $event)"
          @new-tab="emit('new-tab')"
        />
      </template>
    </NavBarAddressBar>

    <div class="flex-align-center gap-4px narrow-hide">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :title="t('Home')"
        @click="emit('goto', 'lumen://home')" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <House :size="16" />
      </UiButton>
    </div>

    <NavBarExtensionsMenu class="narrow-hide" @goto="emit('goto', $event)" />
    <NavBarProfileMenu />
  </header>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, ExternalLink, Menu, RefreshCw, House, Star } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import NavBarAddressBar from '../components/NavBarAddressBar.vue';
import NavBarExtensionsMenu from '../components/NavBarExtensionsMenu.vue';
import NavBarProfileMenu from '../components/NavBarProfileMenu.vue';
import NavBarTabSwitcher from '../components/NavBarTabSwitcher.vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import { useFavourites } from '../stores/favouritesStore';
import { normalizeAddressInput } from '../internal/services/navigationUrl';
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
  (e: 'select-tab', id: string): void;
  (e: 'close-tab', id: string): void;
  (e: 'new-tab'): void;
}>();

const urlField = ref('');

/** The narrow-viewport menu holding Back, Forward, Refresh, Favourite and Home. */
const menuOpen = ref(false);

/**
 * The tab panel, owned here rather than inside the switcher so that the back
 * gesture and the outside click - both of which live in this file - decide in
 * one place which of the two panels a dismissal applies to.
 */
const tabPanelOpen = ref(false);

/** Every menu entry does its thing and then closes the menu. */
function runFromMenu(action: () => void) {
  action();
  menuOpen.value = false;
}

/**
 * Offered only for a real web address. An iframe is what loads those on the
 * mobile target, and a site that refuses to be framed shows an empty box with
 * no way to tell from the outside - so the way out is always on the menu
 * rather than behind a detection that cannot be made to work.
 */
const canOpenExternally = computed(() => /^https?:\/\//i.test(String(props.currentUrl ?? '')));

function openExternally() {
  const url = String(props.currentUrl ?? '');
  if (url) void useInternalLumen()?.release?.openExternal(url);
}

const closeMenu = () => {
  tabPanelOpen.value = false;
  menuOpen.value = false;
};

/**
 * Android's back gesture, dispatched by platform/mobile/shims/hardware-back.ts.
 *
 * The navbar answers it because the navbar is what owns the active tab's
 * history. Calling preventDefault() claims the gesture; leaving it alone lets
 * the shim exit the app, which is the right thing on the first page.
 */
function onHardwareBack(event: Event) {
  // The panel first: it is what is drawn over everything else, so it is what
  // a back gesture is aimed at while it is open.
  if (tabPanelOpen.value) {
    tabPanelOpen.value = false;
    event.preventDefault();
    return;
  }
  if (menuOpen.value) {
    menuOpen.value = false;
    event.preventDefault();
    return;
  }
  if (!canGoBack.value) return;
  previous();
  event.preventDefault();
}

onMounted(() => {
  window.addEventListener('click', closeMenu);
  window.addEventListener('lumen:hardware-back', onHardwareBack);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu);
  window.removeEventListener('lumen:hardware-back', onHardwareBack);
});

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
