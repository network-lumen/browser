<template>
  <div class="mt-16px pt-12px border-top-light">
    <UiSidebarNavItem spaceBetween @click="open = !open">
      <span class="txt-weight-light">{{ t('All pages') }}</span>
      <component :is="open ? ChevronUp : ChevronDown" :size="16" />
    </UiSidebarNavItem>

    <div v-if="open" class="mt-8px flex flex-column gap-2px">
      <UiSidebarNavItem
        v-for="r in routes"
        :key="r.key"
        :active="r.key === activeKey"
        @click="openRoute(r.key)"
      >
        <component :is="iconFor(r.key)" :size="16" />
        <span class="truncate">{{ r.title }}</span>
      </UiSidebarNavItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiSidebarNavItem from '../ui/UiSidebarNavItem.vue';
import { computed,  ref } from 'vue';
import { INTERNAL_ROUTE_KEYS, getInternalTitle } from '../internal/routes';
import {
  ChevronDown,
  ChevronUp,
  House,
  Cloud,
  Wallet,
  AtSign,
  Settings,
  Search,
  HelpCircle,
  Globe,
  Layers,
  History
} from 'lucide-vue-next';

import { useTabNavigation } from '../composables/useTabNavigation';
const DEFAULT_EXCLUDE = new Set([
  'ipfs',
  'gateways',
  'release',
  'block',
  'transaction',
  'tx',
  'address',
  'extension'
]);

const DEFAULT_ORDER = [
  'home',
  'drive',
  'wallet',
  'domain',
  'network',
  'settings',
  'history',
  'search',
  'help',
  'newtab'
];

const props = withDefaults(defineProps<{
  activeKey?: string;
  exclude?: string[];
}>(), {
  exclude: () => []
});

const open = ref(false);

const { navigate, openInNewTab } = useTabNavigation();

function openUrl(url: string) {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  navigate?.(url, { push: true });
}

function iconFor(key: string) {
  const k = String(key || '').toLowerCase();
  const map: Record<string, any> = {
    home: House,
    drive: Cloud,
    wallet: Wallet,
    domain: AtSign,
    settings: Settings,
    history: History,
    search: Search,
    help: HelpCircle,
    newtab: Layers
  };
  return map[k] || Globe;
}

const routes = computed(() => {
  const excluded = new Set(DEFAULT_EXCLUDE);
  for (const k of props.exclude) excluded.add(String(k || '').toLowerCase());

  const filtered = INTERNAL_ROUTE_KEYS
    .map((k) => String(k || '').toLowerCase())
    .filter((k) => k && !excluded.has(k));

  const uniq = Array.from(new Set(filtered));

  const orderIndex = new Map(DEFAULT_ORDER.map((k, i) => [k, i]));
  uniq.sort((a, b) => {
    const ai = orderIndex.has(a) ? (orderIndex.get(a) as number) : 999;
    const bi = orderIndex.has(b) ? (orderIndex.get(b) as number) : 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  return uniq.map((key) => ({
    key,
    title: getInternalTitle(`lumen://${key}`) || key
  }));
});

function openRoute(key: string) {
  openUrl(`lumen://${key}`);
}
</script>
