<template>
  <div class="margin-top-87 padding-top-75 border-top-light">
    <button type="button" class="lsb-item lsb-item--dropdown border-none bg-transparent cursor-pointer color-text-secondary" @click="open = !open">
      <span class="fw-600">{{ label }}</span>
      <component :is="open ? ChevronUp : ChevronDown" :size="16" />
    </button>

    <div v-if="open" class="margin-top-37 flex flex-column gap-2px">
      <button
        v-for="r in routes"
        :key="r.key"
        type="button"
        class="lsb-item lsb-item--compact border-none bg-transparent cursor-pointer color-text-secondary"
        :class="{ active: r.key === activeKey }"
        @click="openRoute(r.key)"
      >
        <component :is="iconFor(r.key)" :size="16" />
        <span class="overflow-hidden txt-overflow-ellipsis nowrap">{{ r.title }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
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
  Users,
  Layers,
  History
} from 'lucide-vue-next';

const DEFAULT_EXCLUDE = new Set([
  'ipfs',
  'gateways',
  'release',
  'block',
  'transaction',
  'tx',
  'address'
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
  'explorer',
  'dao',
  'help',
  'newtab'
];

const props = withDefaults(defineProps<{
  activeKey?: string;
  label?: string;
  exclude?: string[];
  defaultOpen?: boolean;
}>(), {
  label: 'All pages',
  exclude: () => [],
  defaultOpen: false
});

const open = ref(!!props.defaultOpen);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

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
    explorer: Globe,
    dao: Users,
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
