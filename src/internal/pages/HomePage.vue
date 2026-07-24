<template>
  <div class="home-page internal-page flex">
    <!-- Sidebar -->
    <InternalSidebar title="Lumen" :icon="Hexagon" activeKey="home" :showAllPages="false">
      <UiButton variant="secondary" type="button" :block="true" @click="showAllPages = !showAllPages" class="homepage-toggle-pages flex-justify-space-between">
        <span>All pages</span>
        <component :is="showAllPages ? ChevronUp : ChevronDown" :size="16" />
      </UiButton>

      <div v-if="showAllPages" class="homepage-all-pages-list flex flex-column gap-4px pb-4px animate-homepage-fade-down">
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
    <main class="homepage-main flex-1 flex flex-column m-0px min-w-0 overflow-y-auto py-20px px-24px bg-secondary border-radius-0">
      <div v-if="!hasProfiles" class="homepage-no-profile-banner color-warning border-radius-12px mb-16px py-12px px-16px bg-yellow-a08 border-05-yellow-a40">
        <div class="homepage-no-profile-title txt-weight-light text-13px">No profile found</div>
        <div class="homepage-no-profile-sub text-12px mt-4px opacity-85">Create one using the button in the top right.</div>
      </div>

      <!-- Quick Actions -->
      <section class="homepage-quick-actions mb-20px">
        <h2 class="homepage-section-title flex-align-center-justify-space-between color-text-primary text-15px txt-weight-light mb-12px pb-8px letter-spacing-n001 border-bottom-05-light">My Space</h2>
        <div
          class="homepage-actions-grid gap-10px grid grid-cols-auto-fill-220"
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
            <div class="homepage-empty-title color-text-primary txt-weight-light text-13px">No cards yet</div>
            <div class="homepage-empty-desc text-center color-text-secondary text-12px">Drag a page from “All Pages” to add it here.</div>
            <UiButton variant="primary" type="button" @click.stop="restoreMySpaceDefaults">
              Restore defaults
            </UiButton>
          </div>
          <button
            v-for="key in mySpaceCards"
            :key="key"
            class="reveal-on-hover active-translate-y-0 disabled-opacity-55-cursor-not-allowed flex-align-center cursor-pointer gap-12px border-radius-12px text-left relative bg-card border-default transition-all-fast shadow-xs py-12px px-16px backdrop-blur hover-bg-hover hover-lift-2 hover-border-primary-a30 hover-shadow-md"
            :class="{ 'is-drag-over-target': dragOverMySpace && draggedItem === key }"
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
            <div class="homepage-action-info flex flex-column flex-1 min-w-0 gap-2px">
              <span class="homepage-action-title color-text-primary text-14px txt-weight-light letter-spacing-n001">{{ getCardTitle(key) }}</span>
              <span class="homepage-action-desc color-text-secondary text-12px line-height-14">{{ getCardDescription(key) }}</span>
            </div>
            <ArrowUpRight :size="16" class="reveal-accent-shift-target color-text-tertiary transition-all-fast" />
          </button>
        </div>
      </section>

      <section class="homepage-quick-actions mb-20px">
        <h2 class="homepage-section-title flex-align-center-justify-space-between color-text-primary text-15px txt-weight-light mb-12px pb-8px letter-spacing-n001 border-bottom-05-light">Lumen</h2>
        <div
          class="homepage-actions-grid gap-10px grid grid-cols-auto-fill-220"
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
            <div class="homepage-empty-title color-text-primary txt-weight-light text-13px">No cards yet</div>
            <div class="homepage-empty-desc text-center color-text-secondary text-12px">Drag a page from “All Pages” to add it here.</div>
            <UiButton variant="primary" type="button" @click.stop="restoreLumenDefaults">
              Restore defaults
            </UiButton>
          </div>
          <button
            v-for="key in lumenCards"
            :key="key"
            class="reveal-on-hover active-translate-y-0 disabled-opacity-55-cursor-not-allowed flex-align-center cursor-pointer gap-12px border-radius-12px text-left relative bg-card border-default transition-all-fast shadow-xs py-12px px-16px backdrop-blur hover-bg-hover hover-lift-2 hover-border-primary-a30 hover-shadow-md"
            :class="{ 'is-drag-over-target': dragOverLumen && draggedItem === key }"
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
            <div class="homepage-action-info flex flex-column flex-1 min-w-0 gap-2px">
              <span class="homepage-action-title color-text-primary text-14px txt-weight-light letter-spacing-n001">{{ getCardTitle(key) }}</span>
              <span class="homepage-action-desc color-text-secondary text-12px line-height-14">{{ getCardDescription(key) }}</span>
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
import { inject, computed, ref, watch } from 'vue';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
import { INTERNAL_ROUTE_KEYS, getInternalTitle } from '../routes';
import { profilesState } from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { 
  Home, HardDrive, Wallet, Globe, Settings, 
  ArrowUpRight, Network, FileText, Hexagon,
  Database, Vote, Package, AtSign, Search, History,
  HelpCircle, Layers, ChevronDown, ChevronUp, X
} from 'lucide-vue-next';

// My Space section cards yang bisa di-customize
const MY_SPACE_CARDS_KEY = 'my_space_cards_order';
const savedMySpaceCards = localStorage.getItem(MY_SPACE_CARDS_KEY);
const DEFAULT_MY_SPACE_CARDS = ['drive', 'domain', 'wallet', 'dao', 'settings'];
const mySpaceCards = ref<string[]>(savedMySpaceCards ? JSON.parse(savedMySpaceCards) : DEFAULT_MY_SPACE_CARDS.slice());

// Lumen section cards yang bisa di-customize
const LUMEN_CARDS_KEY = 'lumen_cards_order';
const savedLumenCards = localStorage.getItem(LUMEN_CARDS_KEY);
const DEFAULT_LUMEN_CARDS = ['explorer', 'network', 'search', 'help'];
const lumenCards = ref<string[]>(savedLumenCards ? JSON.parse(savedLumenCards) : DEFAULT_LUMEN_CARDS.slice());

// Custom order untuk All Pages dengan localStorage
const ORDER_KEY = 'lumen_all_pages_order';
const savedOrder = localStorage.getItem(ORDER_KEY);
const customOrder = ref<string[]>(savedOrder ? JSON.parse(savedOrder) : []);

  const allRoutes = computed(() => {
    const routes = INTERNAL_ROUTE_KEYS.filter(
      (key) => !['home', 'ipfs', 'ipns', 'domains', 'gateways', 'release', 'block', 'transaction', 'tx', 'address', 'extension'].includes(key),
    );
    if (customOrder.value.length === 0) return routes;
    
    // Sort berdasarkan custom order, items yang tidak ada di custom order di akhir
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
  console.log('Drag started from sidebar:', key);
}

function onItemDragOver(e: DragEvent, key: string) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  if (dragOverItem.value !== key) {
    dragOverItem.value = key;
    console.log('Drag over:', key);
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

// Drag handlers untuk cards (support both My Space and Lumen)
const dragSource = ref<'myspace' | 'lumen' | 'sidebar' | null>(null);

function onCardDragStart(e: DragEvent, key: string, source: 'myspace' | 'lumen') {
  wasDragging = true;
  draggedItem.value = key;
  dragSource.value = source;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }
  console.log('Card drag started:', key, 'from', source);
}

function onCardDragLeave(e: DragEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  
  if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
    dragOverLumen.value = false;
    dragOverMySpace.value = false;
  }
}

function onCardDragEnd() {
  draggedItem.value = null;
  dragSource.value = null;
  dragOverLumen.value = false;
  dragOverMySpace.value = false;
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
  
  // Add ke akhir My Space cards jika drop di area kosong
  if (!mySpaceCards.value.includes(draggedItem.value)) {
    // Ensure a card lives in only one section.
    if (lumenCards.value.includes(draggedItem.value)) {
      lumenCards.value = lumenCards.value.filter((k) => k !== draggedItem.value);
      localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
    }
    mySpaceCards.value.push(draggedItem.value);
    localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
    console.log('Added to end of My Space:', draggedItem.value);
  }
  
  draggedItem.value = null;
  dragSource.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function removeMySpaceCard(key: string) {
  mySpaceCards.value = mySpaceCards.value.filter(k => k !== key);
  localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
  console.log('Removed from My Space:', key);
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

function onCardDragOver(e: DragEvent, key: string, section: 'myspace' | 'lumen') {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
}

function onCardDrop(e: DragEvent, dropKey: string, section: 'myspace' | 'lumen') {
  e.preventDefault();
  e.stopPropagation();
  dragOverLumen.value = false;
  dragOverMySpace.value = false;
  
  console.log('Card drop on:', dropKey, 'in', section, 'Dragged:', draggedItem.value, 'from', dragSource.value);
  
  if (!draggedItem.value) return;
  
  if (section === 'myspace') {
    const draggedIndex = mySpaceCards.value.indexOf(draggedItem.value);
    const dropIndex = mySpaceCards.value.indexOf(dropKey);
    
    if (draggedIndex !== -1 && dropIndex !== -1) {
      // Reorder dalam My Space cards
      const newCards = [...mySpaceCards.value];
      newCards.splice(draggedIndex, 1);
      newCards.splice(dropIndex, 0, draggedItem.value);
      mySpaceCards.value = newCards;
      localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(newCards));
      console.log('Reordered My Space cards:', newCards);
    } else if (draggedIndex === -1) {
      // Add from sidebar/other section ke My Space
      const newCards = [...mySpaceCards.value];
      // Ensure a card lives in only one section.
      if (lumenCards.value.includes(draggedItem.value)) {
        lumenCards.value = lumenCards.value.filter(k => k !== draggedItem.value);
        localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
      }
      newCards.splice(dropIndex, 0, draggedItem.value);
      mySpaceCards.value = newCards;
      localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(newCards));
      console.log('Added to My Space cards:', newCards);
    }
  } else if (section === 'lumen') {
    const draggedIndex = lumenCards.value.indexOf(draggedItem.value);
    const dropIndex = lumenCards.value.indexOf(dropKey);
    
    if (draggedIndex !== -1 && dropIndex !== -1) {
      // Reorder dalam Lumen cards
      const newCards = [...lumenCards.value];
      newCards.splice(draggedIndex, 1);
      newCards.splice(dropIndex, 0, draggedItem.value);
      lumenCards.value = newCards;
      localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(newCards));
      console.log('Reordered Lumen cards:', newCards);
    } else if (draggedIndex === -1) {
      // Add from sidebar/other section ke Lumen
      const newCards = [...lumenCards.value];
      // Ensure a card lives in only one section.
      if (mySpaceCards.value.includes(draggedItem.value)) {
        mySpaceCards.value = mySpaceCards.value.filter(k => k !== draggedItem.value);
        localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
      }
      newCards.splice(dropIndex, 0, draggedItem.value);
      lumenCards.value = newCards;
      localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(newCards));
      console.log('Added to Lumen cards:', newCards);
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
  
  // Add ke akhir Lumen cards jika drop di area kosong
  if (!lumenCards.value.includes(draggedItem.value)) {
    // Ensure a card lives in only one section.
    if (mySpaceCards.value.includes(draggedItem.value)) {
      mySpaceCards.value = mySpaceCards.value.filter(k => k !== draggedItem.value);
      localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
    }
    lumenCards.value.push(draggedItem.value);
    localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
    console.log('Added to end of Lumen:', draggedItem.value);
  }
  
  draggedItem.value = null;
  dragSource.value = null;
  setTimeout(() => {
    wasDragging = false;
  }, 100);
}

function removeLumenCard(key: string) {
  lumenCards.value = lumenCards.value.filter(k => k !== key);
  localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
  console.log('Removed from Lumen:', key);
}

function restoreMySpaceDefaults() {
  mySpaceCards.value = DEFAULT_MY_SPACE_CARDS.slice();
  localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
  // Ensure uniqueness.
  lumenCards.value = lumenCards.value.filter((k) => !mySpaceCards.value.includes(k));
  localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
  showAllPages.value = true;
}

function restoreLumenDefaults() {
  lumenCards.value = DEFAULT_LUMEN_CARDS.slice();
  localStorage.setItem(LUMEN_CARDS_KEY, JSON.stringify(lumenCards.value));
  // Ensure uniqueness.
  mySpaceCards.value = mySpaceCards.value.filter((k) => !lumenCards.value.includes(k));
  localStorage.setItem(MY_SPACE_CARDS_KEY, JSON.stringify(mySpaceCards.value));
  showAllPages.value = true;
}

function onItemDrop(e: DragEvent, dropKey: string) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('Drop on:', dropKey, 'Dragged:', draggedItem.value);

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
  
  console.log('Reordering from', draggedIndex, 'to', dropIndex);
  
  currentRoutes.splice(draggedIndex, 1);
  currentRoutes.splice(dropIndex, 0, draggedItem.value);
  
  customOrder.value = currentRoutes;
  localStorage.setItem(ORDER_KEY, JSON.stringify(currentRoutes));
  
  console.log('New order:', currentRoutes);
  
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
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);
const openInNewTab = inject<(url: string) => void>('openInNewTab');

function openRoute(key: string) {
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
    explorer: 'Browse the blockchain',
    network: 'View network status',
    search: 'Find content quickly',
    history: 'Review recent browsing',
    help: 'Documentation & support',
    drive: 'Store & share files',
    wallet: 'Manage crypto assets',
    domain: 'Manage your domains',
    dao: 'Governance & voting',
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
    explorer: 'Explorer',
    network: 'Network',
    search: 'Search',
    history: 'History',
    help: 'Help',
    drive: 'Drive',
    wallet: 'Wallet',
    domain: 'Domains',
    dao: 'DAO',
    gateways: 'Gateways',
    settings: 'Settings',
    ipfs: 'IPFS',
    release: 'Release',
    home: 'Home'
  };
  return titles[key] || formatRouteName(key);
}

function getCardDescription(key: string): string {
  return getRouteDescription(key);
}

const ACTION_ICON_STYLES: Record<string, { background: string; color: string }> = {
  drive: { background: "linear-gradient(135deg, var(--color-success) 0%, var(--color-secondary) 100%)", color: "#fff" },
  wallet: { background: "linear-gradient(135deg, var(--color-warning) 0%, var(--color-yellow) 100%)", color: "#fff" },
  explorer: { background: "linear-gradient(135deg, rgba(var(--color-success-rgb), 0.22) 0%, rgba(var(--color-success-rgb), 0.12) 100%)", color: "var(--color-success)" },
  gateways: { background: "linear-gradient(135deg, rgba(var(--color-success-rgb), 0.22) 0%, rgba(var(--color-success-rgb), 0.12) 100%)", color: "var(--color-success)" },
  search: { background: "linear-gradient(135deg, rgba(var(--color-success-rgb), 0.22) 0%, rgba(var(--color-success-rgb), 0.12) 100%)", color: "var(--color-success)" },
  network: { background: "linear-gradient(135deg, rgba(var(--color-pink-rgb), 0.22) 0%, rgba(var(--color-pink-rgb), 0.12) 100%)", color: "var(--color-pink)" },
  domain: { background: "linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.22) 0%, rgba(var(--color-primary-rgb), 0.12) 100%)", color: "var(--color-primary)" },
  dao: { background: "linear-gradient(135deg, rgba(var(--color-warning-rgb), 0.22) 0%, rgba(var(--color-warning-rgb), 0.12) 100%)", color: "var(--color-warning)" },
  help: { background: "linear-gradient(135deg, rgba(var(--color-warning-rgb), 0.22) 0%, rgba(var(--color-warning-rgb), 0.12) 100%)", color: "var(--color-warning)" },
  settings: { background: "linear-gradient(135deg, rgba(var(--color-purple-rgb), 0.22) 0%, rgba(var(--color-purple-rgb), 0.12) 100%)", color: "var(--color-purple)" },
};

function actionIconStyle(key: string): Record<string, string> {
  return ACTION_ICON_STYLES[key] || {};
}

function getCardIcon(key: string) {
  const icons: Record<string, any> = {
    home: Home,
    drive: HardDrive,
    wallet: Wallet,
    network: Network,
    settings: Settings,
    explorer: Globe,
    domain: AtSign,
    dao: Vote,
    release: Package,
    newtab: Layers,
    search: Search,
    history: History,
    gateways: Globe,
    help: HelpCircle,
    ipfs: Database
  };
  return icons[key] || HelpCircle;
}

function getRouteIcon(key: string) {
  const icons: Record<string, any> = {
    home: Home,
    drive: HardDrive,
    wallet: Wallet,
    network: Network,
    settings: Settings,
    explorer: Globe,
    domain: AtSign,
    dao: Vote,
    release: Package,
    newtab: Layers,
    search: Search,
    history: History,
    gateways: Globe,
    help: HelpCircle
  };
  return icons[key] || FileText;
}
</script>

