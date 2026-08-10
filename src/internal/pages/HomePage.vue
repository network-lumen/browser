<template>
  <!-- ####### lumen://home HOME ####### -->
  <div class="internal-page flex">
    <!-- Sidebar -->
    <InternalSidebar title="Lumen" :icon="Home" activeKey="home" :showAllPages="false">
      <UiButton variant="secondary" type="button" :block="true" @click="showAllPages = !showAllPages" class="flex-justify-space-between">
        <span>All pages</span>
        <component :is="showAllPages ? ChevronUp : ChevronDown" :size="16" />
      </UiButton>

      <div v-if="showAllPages" class="flex flex-column gap-4px pb-4px animate-homepage-fade-down">
        <button
          v-for="key in allRoutes"
          :key="key"
          type="button"
          class="hover-translate-x-2px active-cursor-grabbing w-full flex-align-center bg-transparent border-none color-text-secondary border-radius-10px gap-8px text-13px fw-500 text-left py-8px px-12px transition-all-fast cursor-select-none cursor-grab hover-bg-hover hover-color-text-primary"
          :class="{ 'is-dragging': draggedItem === key, 'is-drag-over-target': dragOverItem === key }"
          draggable="true"
          @dragstart="onItemDragStart($event, key)"
          @dragover.prevent="onItemDragOver($event, key)"
          @dragleave="onItemDragLeave"
          @drop.prevent.stop="onItemDrop($event, key)"
          @dragend="onItemDragEnd"
          @click="onItemClick(key, $event)"
        >
          <component :is="getRouteIcon(key)" :size="16" />
          <span>{{ getInternalTitle(`lumen://${key}`) }}</span>
        </button>
      </div>

    </InternalSidebar>

    <!-- Main Content -->
    <main class="flex-1 flex flex-column m-0px min-w-0 overflow-y-auto py-20px px-24px bg-secondary border-radius-0">
      <UiWarningBox v-if="!hasProfiles" box-class="mb-16px">
        <template #icon></template>
        <div class="txt-weight-light text-13px">No profile found</div>
        <div class="text-12px mt-4px opacity-85">Create one using the button in the top right.</div>
      </UiWarningBox>

      <!-- Quick Actions -->
      <section class="mb-20px">
        <h2 class="flex-align-center-justify-space-between color-text-primary text-15px txt-weight-light mb-12px pb-8px letter-spacing-n001 border-bottom-05-light">My Space</h2>
        <div
          class="gap-10px grid grid-cols-auto-fill-220"
          @dragover.prevent="onMySpaceDragOver"
          @dragleave="onMySpaceDragLeave"
          @drop.prevent="onMySpaceDrop"
        >
          <div
            v-if="mySpaceCards.length === 0"
            class="flex flex-column flex-align-justify-center cursor-pointer color-text-secondary border-radius-12px gap-4px bg-fill-tertiary transition-all-fast py-12px px-16px border-15-dashed-color min-h-100px grid-col-full"
            :class="{ 'is-drag-over-zone': dragOverMySpace }"
            @click="showAllPages = true"
          >
            <div class="color-text-primary txt-weight-light text-13px">No cards yet</div>
            <div class="text-center color-text-secondary text-12px">Drag a page from “All Pages” to add it here.</div>
            <UiButton variant="primary" type="button" @click.stop="restoreMySpaceDefaults">
              Restore defaults
            </UiButton>
          </div>
          <button
            v-for="key in mySpaceCards"
            :key="key"
            class="reveal-on-hover active-translate-y-0 disabled-opacity-55-cursor-not-allowed flex-align-center cursor-pointer gap-12px border-radius-12px text-left relative bg-card border-default transition-all-fast shadow-xs py-12px px-16px backdrop-blur hover-bg-hover hover-lift-2 hover-border-primary-a30"
            :class="{ 'is-drag-over-target': dragOverCardKey === key && draggedItem !== key }"
            draggable="true"
            @dragstart="onCardDragStart($event, key, 'myspace')"
            @dragover.prevent="onCardDragOver($event, key, 'myspace')"
            @dragleave="onCardDragLeave"
            @drop.prevent.stop="onCardDrop($event, key, 'myspace')"
            @dragend="onCardDragEnd"
            @click="handleCardClick($event, key)"
            :disabled="!hasProfiles && ['drive', 'domain', 'wallet'].includes(key)"
          >
            <div
              class="reveal-actions-target hover-bg-border-color-error flex-align-justify-center cursor-pointer color-text-tertiary absolute bg-primary border-default cursor-events-none transition-all-fast h-24px border-radius-full opacity-0 hover-scale-105 w-24px top-6px right-6px z-1"
              @click.stop="removeMySpaceCard(key)"
              title="Remove card"
            >
              <X :size="14" />
            </div>
            <div class="reveal-scale-target flex-align-justify-center flex-0-0-auto size-40px border-radius-10px shadow-sm transition-all-fast" :style="actionIconStyle(key)">
              <component :is="getCardIcon(key)" :size="19" />
            </div>
            <div class="flex flex-column flex-1 min-w-0 gap-2px">
              <span class="color-text-primary text-14px txt-weight-light letter-spacing-n001">{{ getCardTitle(key) }}</span>
              <span class="color-text-secondary text-12px line-height-14">{{ getRouteDescription(key) }}</span>
            </div>
            <ArrowUpRight :size="16" class="reveal-accent-shift-target color-text-tertiary transition-all-fast" />
          </button>
        </div>
      </section>

      <section class="mb-20px">
        <h2 class="flex-align-center-justify-space-between color-text-primary text-15px txt-weight-light mb-12px pb-8px letter-spacing-n001 border-bottom-05-light">Lumen</h2>
        <div
          class="gap-10px grid grid-cols-auto-fill-220"
          @dragover.prevent="onLumenDragOver"
          @dragleave="onLumenDragLeave"
          @drop.prevent="onLumenDrop"
        >
          <div
            v-if="lumenCards.length === 0"
            class="flex flex-column flex-align-justify-center cursor-pointer color-text-secondary border-radius-12px gap-4px bg-fill-tertiary transition-all-fast py-12px px-16px border-15-dashed-color min-h-100px grid-col-full"
            :class="{ 'is-drag-over-zone': dragOverLumen }"
            @click="showAllPages = true"
          >
            <div class="color-text-primary txt-weight-light text-13px">No cards yet</div>
            <div class="text-center color-text-secondary text-12px">Drag a page from “All Pages” to add it here.</div>
            <UiButton variant="primary" type="button" @click.stop="restoreLumenDefaults">
              Restore defaults
            </UiButton>
          </div>
          <button
            v-for="key in lumenCards"
            :key="key"
            class="reveal-on-hover active-translate-y-0 disabled-opacity-55-cursor-not-allowed flex-align-center cursor-pointer gap-12px border-radius-12px text-left relative bg-card border-default transition-all-fast shadow-xs py-12px px-16px backdrop-blur hover-bg-hover hover-lift-2 hover-border-primary-a30"
            :class="{ 'is-drag-over-target': dragOverCardKey === key && draggedItem !== key }"
            draggable="true"
            @dragstart="onCardDragStart($event, key, 'lumen')"
            @dragover.prevent="onCardDragOver($event, key, 'lumen')"
            @dragleave="onCardDragLeave"
            @drop.prevent.stop="onCardDrop($event, key, 'lumen')"
            @dragend="onCardDragEnd"
            @click="handleCardClick($event, key)"
          >
            <div
              class="reveal-actions-target hover-bg-border-color-error flex-align-justify-center cursor-pointer color-text-tertiary absolute bg-primary border-default cursor-events-none transition-all-fast h-24px border-radius-full opacity-0 hover-scale-105 w-24px top-6px right-6px z-1"
              @click.stop="removeLumenCard(key)"
              title="Remove card"
            >
              <X :size="14" />
            </div>
            <div class="reveal-scale-target flex-align-justify-center flex-0-0-auto size-40px border-radius-10px shadow-sm transition-all-fast" :style="actionIconStyle(key)">
              <component :is="getCardIcon(key)" :size="19" />
            </div>
            <div class="flex flex-column flex-1 min-w-0 gap-2px">
              <span class="color-text-primary text-14px txt-weight-light letter-spacing-n001">{{ getCardTitle(key) }}</span>
              <span class="color-text-secondary text-12px line-height-14">{{ getRouteDescription(key) }}</span>
            </div>
            <ArrowUpRight :size="16" class="reveal-accent-shift-target color-text-tertiary transition-all-fast" />
          </button>

        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../../ui/UiButton.vue';
import UiWarningBox from '../../ui/UiWarningBox.vue';
import { computed, ref } from 'vue';

import { INTERNAL_ROUTE_KEYS, getInternalTitle } from '../routes';
import { profilesState } from '../../stores/profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { STORAGE_KEYS, readJson, writeJson } from '../services/storage';
import {
  Home, Cloud, Wallet, Globe, Settings,
  ArrowUpRight, Network, FileText,
  Database, Rocket, Server, Search, History,
  HelpCircle, Layers, ChevronDown, ChevronUp, X
} from 'lucide-vue-next';

import { useTabNavigation } from '../../composables/useTabNavigation';
// My Space section cards, customizable via drag-and-drop
const MY_SPACE_CARDS_KEY = STORAGE_KEYS.homeMySpaceCards;
const DEFAULT_MY_SPACE_CARDS = ['drive', 'domain', 'wallet', 'settings'];
const mySpaceCards = ref<string[]>(readJson<string[]>(MY_SPACE_CARDS_KEY, DEFAULT_MY_SPACE_CARDS.slice()));

// Lumen section cards, customizable via drag-and-drop
const LUMEN_CARDS_KEY = STORAGE_KEYS.homeLumenCards;
const DEFAULT_LUMEN_CARDS = ['network', 'search', 'help'];
const lumenCards = ref<string[]>(readJson<string[]>(LUMEN_CARDS_KEY, DEFAULT_LUMEN_CARDS.slice()));

// Custom order for All Pages, persisted to localStorage
const ORDER_KEY = STORAGE_KEYS.homeAllPagesOrder;
const customOrder = ref<string[]>(readJson<string[]>(ORDER_KEY, []));

const allRoutes = computed(() => {
  const routes = INTERNAL_ROUTE_KEYS.filter(
    (key) => !['home', 'ipfs', 'ipns', 'domains', 'gateways', 'release', 'block', 'transaction', 'tx', 'address', 'extension'].includes(key),
  );
  if (customOrder.value.length === 0) return routes;

  // Sort by custom order, items not in the custom order go last.
  const ordered = [...routes].sort((a, b) => {
    const indexA = customOrder.value.indexOf(a);
    const indexB = customOrder.value.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  return ordered;
});

const showAllPages = ref(false);

// Drag and drop untuk reorder items
const draggedItem = ref<string | null>(null);
const dragOverItem = ref<string | null>(null);
const dragOverLumen = ref(false);
const dragOverMySpace = ref(false);
let wasDragging = false;

function onItemDragStart(e: DragEvent, key: string) {
  wasDragging = true;
  draggedItem.value = key;
  dragSource.value = 'sidebar';
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }
}

function onItemDragOver(e: DragEvent, key: string) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  if (dragOverItem.value !== key) {
    dragOverItem.value = key;
  }
}

function onItemDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    dragOverItem.value = null;
  }
}

// Drag handlers for cards (support both My Space and Lumen)
const dragSource = ref<'myspace' | 'lumen' | 'sidebar' | null>(null);
// Tracks which specific card is currently being hovered as a drop target
// (distinct from draggedItem, which is the card being dragged).
const dragOverCardKey = ref<string | null>(null);

function onCardDragStart(e: DragEvent, key: string, source: 'myspace' | 'lumen') {
  wasDragging = true;
  draggedItem.value = key;
  dragSource.value = source;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }
}

function onCardDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;

  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    dragOverLumen.value = false;
    dragOverMySpace.value = false;
    dragOverCardKey.value = null;
  }
}

function onCardDragEnd() {
  draggedItem.value = null;
  dragSource.value = null;
  dragOverLumen.value = false;
  dragOverMySpace.value = false;
  dragOverCardKey.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function handleCardClick(e: MouseEvent, key: string) {
  if (wasDragging) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  openRoute(key);
}

// My Space drag handlers
function onMySpaceDragOver(e: DragEvent) {
  e.preventDefault();
  dragOverMySpace.value = true;
}

function onMySpaceDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    dragOverMySpace.value = false;
  }
}

function onMySpaceDrop(e: DragEvent) {
  e.preventDefault();
  dragOverMySpace.value = false;
  
  if (!draggedItem.value) return;
  
  // Add to the end of My Space cards when dropped on the empty area.
  if (!mySpaceCards.value.includes(draggedItem.value)) {
    // Ensure a card lives in only one section.
    if (lumenCards.value.includes(draggedItem.value)) {
      lumenCards.value = lumenCards.value.filter((k) => k !== draggedItem.value);
      writeJson(LUMEN_CARDS_KEY, lumenCards.value);
    }
    mySpaceCards.value.push(draggedItem.value);
    writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
  }
  
  draggedItem.value = null;
  dragSource.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function removeMySpaceCard(key: string) {
  mySpaceCards.value = mySpaceCards.value.filter(k => k !== key);
  writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
}

// Lumen drag handlers
function onLumenDragOver(e: DragEvent) {
  e.preventDefault();
  dragOverLumen.value = true;
}

function onLumenDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    dragOverLumen.value = false;
  }
}

function onCardDragOver(e: DragEvent, key: string, _section: 'myspace' | 'lumen') {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  if (dragOverCardKey.value !== key) {
    dragOverCardKey.value = key;
  }
}

function onCardDrop(e: DragEvent, dropKey: string, section: 'myspace' | 'lumen') {
  e.preventDefault();
  e.stopPropagation();
  dragOverLumen.value = false;
  dragOverMySpace.value = false;
  dragOverCardKey.value = null;

  if (!draggedItem.value) return;

  if (section === 'myspace') {
    const draggedIndex = mySpaceCards.value.indexOf(draggedItem.value);
    const dropIndex = mySpaceCards.value.indexOf(dropKey);

    if (draggedIndex !== -1 && dropIndex !== -1) {
      // Reorder within My Space cards.
      const newCards = [...mySpaceCards.value];
      newCards.splice(draggedIndex, 1);
      newCards.splice(dropIndex, 0, draggedItem.value);
      mySpaceCards.value = newCards;
      writeJson(MY_SPACE_CARDS_KEY, newCards);
    } else if (draggedIndex === -1) {
      // Add from sidebar/other section to My Space.
      const newCards = [...mySpaceCards.value];
      // Ensure a card lives in only one section.
      if (lumenCards.value.includes(draggedItem.value)) {
        lumenCards.value = lumenCards.value.filter(k => k !== draggedItem.value);
        writeJson(LUMEN_CARDS_KEY, lumenCards.value);
      }
      newCards.splice(dropIndex, 0, draggedItem.value);
      mySpaceCards.value = newCards;
      writeJson(MY_SPACE_CARDS_KEY, newCards);
    }
  } else if (section === 'lumen') {
    const draggedIndex = lumenCards.value.indexOf(draggedItem.value);
    const dropIndex = lumenCards.value.indexOf(dropKey);

    if (draggedIndex !== -1 && dropIndex !== -1) {
      // Reorder within Lumen cards.
      const newCards = [...lumenCards.value];
      newCards.splice(draggedIndex, 1);
      newCards.splice(dropIndex, 0, draggedItem.value);
      lumenCards.value = newCards;
      writeJson(LUMEN_CARDS_KEY, newCards);
    } else if (draggedIndex === -1) {
      // Add from sidebar/other section to Lumen.
      const newCards = [...lumenCards.value];
      // Ensure a card lives in only one section.
      if (mySpaceCards.value.includes(draggedItem.value)) {
        mySpaceCards.value = mySpaceCards.value.filter(k => k !== draggedItem.value);
        writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
      }
      newCards.splice(dropIndex, 0, draggedItem.value);
      lumenCards.value = newCards;
      writeJson(LUMEN_CARDS_KEY, newCards);
    }
  }

  draggedItem.value = null;
  dragSource.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function onLumenDrop(e: DragEvent) {
  e.preventDefault();
  dragOverLumen.value = false;
  
  if (!draggedItem.value) return;
  
  // Add to the end of Lumen cards when dropped on the empty area.
  if (!lumenCards.value.includes(draggedItem.value)) {
    // Ensure a card lives in only one section.
    if (mySpaceCards.value.includes(draggedItem.value)) {
      mySpaceCards.value = mySpaceCards.value.filter(k => k !== draggedItem.value);
      writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
    }
    lumenCards.value.push(draggedItem.value);
    writeJson(LUMEN_CARDS_KEY, lumenCards.value);
  }
  
  draggedItem.value = null;
  dragSource.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function removeLumenCard(key: string) {
  lumenCards.value = lumenCards.value.filter(k => k !== key);
  writeJson(LUMEN_CARDS_KEY, lumenCards.value);
}

function restoreMySpaceDefaults() {
  mySpaceCards.value = DEFAULT_MY_SPACE_CARDS.slice();
  writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
  // Ensure uniqueness.
  lumenCards.value = lumenCards.value.filter((k) => !mySpaceCards.value.includes(k));
  writeJson(LUMEN_CARDS_KEY, lumenCards.value);
  showAllPages.value = true;
}

function restoreLumenDefaults() {
  lumenCards.value = DEFAULT_LUMEN_CARDS.slice();
  writeJson(LUMEN_CARDS_KEY, lumenCards.value);
  // Ensure uniqueness.
  mySpaceCards.value = mySpaceCards.value.filter((k) => !lumenCards.value.includes(k));
  writeJson(MY_SPACE_CARDS_KEY, mySpaceCards.value);
  showAllPages.value = true;
}

function onItemDrop(e: DragEvent, dropKey: string) {
  e.preventDefault();
  e.stopPropagation();

  if (dragSource.value !== 'sidebar') {
    draggedItem.value = null;
    dragOverItem.value = null;
    return;
  }
  
  if (!draggedItem.value || draggedItem.value === dropKey) {
    draggedItem.value = null;
    dragOverItem.value = null;
    return;
  }
  
  const currentRoutes = [...allRoutes.value];
  const draggedIndex = currentRoutes.indexOf(draggedItem.value);
  const dropIndex = currentRoutes.indexOf(dropKey);

  if (draggedIndex === -1 || dropIndex === -1) {
    draggedItem.value = null;
    dragOverItem.value = null;
    return;
  }
  
  currentRoutes.splice(draggedIndex, 1);
  currentRoutes.splice(dropIndex, 0, draggedItem.value);

  customOrder.value = currentRoutes;
  writeJson(ORDER_KEY, currentRoutes);

  draggedItem.value = null;
  dragOverItem.value = null;
  
  // Prevent click after drag
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function onItemDragEnd() {
  draggedItem.value = null;
  dragOverItem.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function onItemClick(key: string, e: MouseEvent) {
  if (wasDragging) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  openRoute(key);
}

const profiles = profilesState;
const hasProfiles = computed(() => profiles.value.length > 0);

function openRoute(key: string) {
  const { navigate, openInNewTab } = useTabNavigation();
const url = `lumen://${key}`;
  if (navigate) {
    navigate(url, { push: true });
    return;
  }
  openInNewTab?.(url);
}

function formatRouteName(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getRouteDescription(key: string): string {
  const descriptions: Record<string, string> = {
    network: 'Browse the blockchain & view network status',
    search: 'Find content quickly',
    history: 'Review recent browsing',
    help: 'Documentation & support',
    drive: 'Store & share files',
    wallet: 'Manage crypto assets',
    domain: 'Manage your domains',
    gateways: 'IPFS gateway management',
    settings: 'Configure preferences',
    ipfs: 'IPFS operations',
    release: 'Release notes',
    home: 'Back to home'
  };
  return descriptions[key] || '';
}

function getCardTitle(key: string): string {
  const titles: Record<string, string> = {
    network: 'Network',
    search: 'Search',
    history: 'History',
    help: 'Help',
    drive: 'Drive',
    wallet: 'Wallet',
    domain: 'Domains',
    gateways: 'Gateways',
    settings: 'Settings',
    ipfs: 'IPFS',
    release: 'Release',
    home: 'Home'
  };
  return titles[key] || formatRouteName(key);
}

const ACTION_ICON_STYLES: Record<string, { background: string; color: string }> = {
  drive: { background: "linear-gradient(135deg, var(--color-success) 0%, var(--color-secondary) 100%)", color: "#fff" },
  wallet: { background: "linear-gradient(135deg, var(--color-warning) 0%, var(--color-yellow) 100%)", color: "#fff" },
  gateways: { background: "linear-gradient(135deg, rgba(var(--color-success-rgb), 0.22) 0%, rgba(var(--color-success-rgb), 0.12) 100%)", color: "var(--color-success)" },
  search: { background: "linear-gradient(135deg, rgba(var(--color-success-rgb), 0.22) 0%, rgba(var(--color-success-rgb), 0.12) 100%)", color: "var(--color-success)" },
  network: { background: "linear-gradient(135deg, rgba(var(--color-pink-rgb), 0.22) 0%, rgba(var(--color-pink-rgb), 0.12) 100%)", color: "var(--color-pink)" },
  domain: { background: "linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.22) 0%, rgba(var(--color-primary-rgb), 0.12) 100%)", color: "var(--color-primary)" },
  help: { background: "linear-gradient(135deg, rgba(var(--color-warning-rgb), 0.22) 0%, rgba(var(--color-warning-rgb), 0.12) 100%)", color: "var(--color-warning)" },
  settings: { background: "linear-gradient(135deg, rgba(var(--color-purple-rgb), 0.22) 0%, rgba(var(--color-purple-rgb), 0.12) 100%)", color: "var(--color-purple)" },
};

function actionIconStyle(key: string): Record<string, string> {
  return ACTION_ICON_STYLES[key] || {};
}

function getCardIcon(key: string) {
  const icons: Record<string, any> = {
    home: Home,
    drive: Cloud,
    wallet: Wallet,
    network: Network,
    settings: Settings,
    domain: Globe,
    release: Rocket,
    newtab: Layers,
    search: Search,
    history: History,
    gateways: Server,
    help: HelpCircle,
    ipfs: Database
  };
  return icons[key] || HelpCircle;
}

function getRouteIcon(key: string) {
  const icons: Record<string, any> = {
    home: Home,
    drive: Cloud,
    wallet: Wallet,
    network: Network,
    settings: Settings,
    domain: Globe,
    release: Rocket,
    newtab: Layers,
    search: Search,
    history: History,
    gateways: Server,
    help: HelpCircle
  };
  return icons[key] || FileText;
}
</script>

