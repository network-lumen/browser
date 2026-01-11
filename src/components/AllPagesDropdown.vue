<template>
  <div class="all-pages">
    <button type="button" class="lsb-item lsb-item--dropdown" @click="open = !open">
      <span class="all-pages-title">{{ label }}</span>
      <component :is="open ? ChevronUp : ChevronDown" :size="16" />
    </button>

    <div v-if="open" class="all-pages-list">
      <button
        v-for="r in routes"
        :key="r.key"
        type="button"
        class="lsb-item lsb-item--compact"
        :class="{ active: r.key === activeKey }"
        @click="openRoute(r.key)"
      >
        <component :is="iconFor(r.key)" :size="16" />
        <span class="all-pages-name">{{ r.title }}</span>
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
  Layers
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

<style scoped>
.all-pages {
  margin-top: 1rem;
}

.lsb-item--dropdown {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--bg-primary, white);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.lsb-item--dropdown:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.all-pages-title {
  font-weight: 600;
}

.all-pages-list {
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lsb-item--compact {
  padding: 0.55rem 0.75rem;
}

.all-pages-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
