<template>
  <div class="home-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Lumen" :icon="Hexagon" activeKey="home" :showAllPages="false">
      <button type="button" class="toggle-pages" @click="showAllPages = !showAllPages">
        <span>All pages</span>
        <component :is="showAllPages ? ChevronUp : ChevronDown" :size="16" />
      </button>

      <div v-if="showAllPages" class="all-pages-list">
        <button
          v-for="key in allRoutes"
          :key="key"
          type="button"
          class="page-item"
          :class="{ dragging: draggedItem === key, 'drag-over': dragOverItem === key }"
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
    <main class="main-content">
      <div v-if="!hasProfiles" class="no-profile-banner">
        <div class="no-profile-title">Vous n'avez pas de profile actuellement</div>
        <div class="no-profile-sub">Créez-en un via le bouton en haut à droite.</div>
      </div>
      <!-- Hero Section -->
      <section v-if="showIntroHero" class="hero-section">
        <button class="hero-close" type="button" title="Hide intro" @click="dismissIntroHero">
          <X :size="16" />
        </button>
        <div class="hero-content">
          <h1 class="hero-title">Welcome to <span class="gradient-text">Lumen</span></h1>
          <p class="hero-subtitle">Make your content universally accessible — uncensorable by design</p>
          <p class="hero-intro">Lumen lets you publish and access content without relying on centralized platforms.</p>
        </div>
        
        <div class="description-features">
              <div class="feature-point">
                <div class="point-icon">🌐</div>
                <div class="point-text">
                  <strong>Decentralized Storage:</strong> Store and share your public content without central servers, using decentralized networks
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">🔐</div>
                <div class="point-text">
                  <strong>All-in-One Control</strong> Manage domains, digital assets, and network interactions in one interface
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">⚡</div>
                <div class="point-text">
                  <strong>Secure by Design:</strong> Encrypted connections, local-first data, and no built-in tracking
                </div>
              </div>
            </div>
        
        <div class="hero-stats">

        </div>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <h2 class="section-title">My Space</h2>
        <div 
          class="actions-grid"
          @dragover.prevent="onMySpaceDragOver"
          @dragleave="onMySpaceDragLeave"
          @drop.prevent="onMySpaceDrop"
        >
          <div
            v-if="mySpaceCards.length === 0"
            class="empty-grid"
            :class="{ 'is-drag-over': dragOverMySpace }"
            @click="showAllPages = true"
          >
            <div class="empty-title">No cards yet</div>
            <div class="empty-desc">Drag a page from “All Pages” to add it here.</div>
            <button class="empty-btn" type="button" @click.stop="restoreMySpaceDefaults">
              Restore defaults
            </button>
          </div>
          <button 
            v-for="key in mySpaceCards" 
            :key="key"
            class="action-card"
            :class="{ 'drag-over': dragOverMySpace && draggedItem === key }"
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
              class="remove-card-btn" 
              @click.stop="removeMySpaceCard(key)"
              title="Remove card"
            >
              <X :size="14" />
            </div>
            <component :is="getCardIcon(key)" :size="24" class="action-icon" :class="key" />
            <div class="action-info">
              <span class="action-title">{{ getCardTitle(key) }}</span>
              <span class="action-desc">{{ getCardDescription(key) }}</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>
        </div>
      </section>

      <section class="quick-actions">
        <h2 class="section-title">Lumen</h2>
        <div 
          class="actions-grid"
          @dragover.prevent="onLumenDragOver"
          @dragleave="onLumenDragLeave"
          @drop.prevent="onLumenDrop"
        >
          <div
            v-if="lumenCards.length === 0"
            class="empty-grid"
            :class="{ 'is-drag-over': dragOverLumen }"
            @click="showAllPages = true"
          >
            <div class="empty-title">No cards yet</div>
            <div class="empty-desc">Drag a page from “All Pages” to add it here.</div>
            <button class="empty-btn" type="button" @click.stop="restoreLumenDefaults">
              Restore defaults
            </button>
          </div>
          <button 
            v-for="key in lumenCards" 
            :key="key"
            class="action-card"
            :class="{ 'drag-over': dragOverLumen && draggedItem === key }"
            draggable="true"
            @dragstart="onCardDragStart($event, key, 'lumen')"
            @dragover.prevent="onCardDragOver($event, key, 'lumen')"
            @dragleave="onCardDragLeave"
            @drop.prevent.stop="onCardDrop($event, key, 'lumen')"
            @dragend="onCardDragEnd"
            @click="handleCardClick($event, key)"
          >
            <div 
              class="remove-card-btn" 
              @click.stop="removeLumenCard(key)"
              title="Remove card"
            >
              <X :size="14" />
            </div>
            <component :is="getCardIcon(key)" :size="24" class="action-icon" :class="key" />
            <div class="action-info">
              <span class="action-title">{{ getCardTitle(key) }}</span>
              <span class="action-desc">{{ getCardDescription(key) }}</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue';
import { INTERNAL_ROUTE_KEYS, getInternalTitle } from '../routes';
import { profilesState } from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { 
  Home, HardDrive, Wallet, Globe, Settings, 
  ArrowUpRight, Network, FileText, Hexagon,
  Database, Vote, Package, AtSign, Search,
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
      (key) => !['home', 'ipfs', 'gateways', 'release', 'block', 'transaction', 'tx', 'address'].includes(key),
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

const HOME_INTRO_HIDDEN_KEY = 'lumen-home-intro-hidden';
const showIntroHero = ref(localStorage.getItem(HOME_INTRO_HIDDEN_KEY) !== '1');

function dismissIntroHero() {
  showIntroHero.value = false;
  try {
    localStorage.setItem(HOME_INTRO_HIDDEN_KEY, '1');
  } catch {
    // ignore
  }
}

const openInNewTab = inject<(url: string) => void>('openInNewTab');

function openRoute(key: string) {
  const url = `lumen://${key}`;
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
    gateways: Globe,
    help: HelpCircle
  };
  return icons[key] || FileText;
}
</script>

<style scoped>
/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}

.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.65);
}

.version-info {
  flex-shrink: 0;
  margin-top: 0.75rem;
  border-top: var(--border-width) solid var(--border-light);
  background: var(--sidebar-bg);
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dropdown-selector {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--fill-tertiary);
  border: var(--border-width) solid var(--border-light);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: 0.5rem;
}

.dropdown-selector:hover {
  background: var(--fill-secondary);
  border-color: var(--ios-blue);
}

.dropdown-selector:active {
  transform: scale(0.98);
}

.dropdown-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dropdown-icon {
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  font-weight: 400;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
}

.nav-item:active {
  transform: scale(0.98);
}

.all-pages-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 0.25rem;
  animation: fadeDown 0.18s ease-out;
}

@keyframes fadeDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: grab;
  transition: all 0.15s ease;
  text-align: left;
  user-select: none;
}

.page-item:active {
  cursor: grabbing;
}

.page-item.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.page-item.drag-over {
  background: var(--accent-primary);
  color: white;
  transform: translateX(4px);
}

.page-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
  transform: translateX(2px);
}

.toggle-pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  border: 0.5px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  font-weight: 500;
}

.toggle-pages:hover {
  background: var(--hover-bg);
  border-color: var(--primary-a30);
  color: var(--text-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--fill-tertiary);
  border-radius: var(--border-radius-lg);
  margin-bottom: 0.75rem;
  border: var(--border-width) solid var(--border-light);
}

.avatar {
  width: 36px;
  height: 36px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px var(--primary-a20);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-label {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.version-info {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  background: var(--bg-secondary);
  margin: 0;
  border-radius: 0;
}

.no-profile-banner {
  border: 0.5px solid rgba(255, 204, 0, 0.4);
  background: rgba(255, 204, 0, 0.08);
  color: var(--ios-orange);
  padding: 0.75rem 1rem;
  border-radius: var(--border-radius-md);
  margin-bottom: 1rem;
}

.no-profile-title {
  font-weight: 600;
  font-size: 13px;
}

.no-profile-sub {
  margin-top: 0.125rem;
  font-size: 12px;
  opacity: 0.9;
}

.action-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Hero Section */
.hero-section {
  background: linear-gradient(135deg, var(--primary-a08) 0%, var(--primary-a10) 100%);
  backdrop-filter: blur(10px);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  border: 0.5px solid var(--primary-a20);
  box-shadow: 0 4px 20px var(--primary-a10);
  position: relative;
  overflow: hidden;
}

.hero-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.5px solid var(--border-color);
  background: var(--card-bg);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  z-index: 2;
}

.hero-close:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, var(--primary-a10) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  margin-bottom: 0.75rem;
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  text-align: center;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 14px;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 0.625rem;
  font-weight: 500;
}

.hero-intro {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  text-align: center;
  margin-bottom: 0.75rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 16px var(--primary-a25));
}

.description-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.625rem;
  margin-top: 0.625rem;
}

.feature-point {
  display: flex;
  gap: 0.625rem;
  align-items: flex-start;
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  padding: 0.75rem;
  border-radius: var(--border-radius-md);
  border: 0.5px solid var(--border-color);
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.feature-point:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--primary-a25);
}

.point-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-primary);
}

.point-text {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.point-text strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.125rem;
  font-size: 13px;
  font-weight: 600;
}

.hero-stats {
  display: flex;
  gap: 0.625rem;
  margin-top: 0.875rem;
  flex-wrap: wrap;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: var(--card-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border-radius: var(--border-radius-md);
  border: 0.5px solid var(--border-light);
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.stat-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 32px;
  height: 32px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Sections */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 0.5px solid var(--border-light);
  letter-spacing: -0.01em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pages-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: var(--hover-bg);
  padding: 0.2rem 0.5rem;
  border-radius: var(--border-radius-xs);
}

/* Quick Actions */
.quick-actions {
  margin-bottom: 1.25rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.625rem;
}

.empty-grid {
  grid-column: 1 / -1;
  min-height: 100px;
  border: 1.5px dashed var(--border-color);
  border-radius: var(--border-radius-md);
  background: var(--fill-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.empty-grid.is-drag-over {
  border-color: var(--accent-primary);
  background: var(--primary-a08);
}

.empty-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.empty-desc {
  font-size: 12px;
  text-align: center;
  color: var(--text-secondary);
}

.empty-btn {
  margin-top: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--border-radius-full);
  border: 0.5px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.empty-btn:hover {
  border-color: var(--accent-primary);
  background: var(--primary-a08);
}

.action-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--card-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  box-shadow: var(--shadow-xs);
}

.action-card:hover .remove-card-btn {
  opacity: 1;
  pointer-events: auto;
}

.remove-card-btn {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-full);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: all 0.15s ease;
  color: var(--text-tertiary);
  z-index: 10;
}

.remove-card-btn:hover {
  background: var(--error-red);
  border-color: var(--error-red);
  color: white;
  transform: scale(1.05);
}

.action-card:hover {
  background: var(--hover-bg);
  border-color: var(--primary-a30);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-card:active {
  transform: translateY(0);
}

.action-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-sm);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  transition: all 0.15s ease;
}

.action-card:hover .action-icon {
  transform: scale(1.03);
}

.action-icon.drive {
  background: linear-gradient(135deg, var(--ios-green) 0%, var(--ios-teal) 100%);
  color: white;
}

.action-icon.wallet {
  background: linear-gradient(135deg, var(--ios-orange) 0%, var(--ios-yellow) 100%);
  color: white;
}

.action-icon.explorer {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: var(--ios-green);
}

.action-icon.network {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: var(--ios-pink);
}

.action-icon.domain {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: var(--ios-blue);
}

.action-icon.staking {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: var(--ios-green);
}

.action-icon.dao {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: var(--ios-orange);
}

.action-icon.gateways {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: var(--ios-green);
}

.action-icon.search {
  background: linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%);
  color: var(--ios-green);
}

.action-icon.help {
  background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%);
  color: var(--ios-orange);
}

.action-icon.settings {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: var(--ios-purple);
}

.action-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.action-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.35;
}

.action-arrow {
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}

.action-card:hover .action-arrow {
  color: var(--accent-primary);
  transform: translateX(2px);
}

/* Routes Section */
.routes-section {
  margin-bottom: 1.25rem;
}

.routes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.route-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  box-shadow: var(--shadow-xs);
}

.route-chip:hover {
  background: var(--gradient-primary);
  border-color: transparent;
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-primary);
}

/* Responsive */
@media (max-width: 1100px) {
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .hero-stats {
    gap: 0.625rem;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 220px;
    min-width: 220px;
    max-width: 220px;
    padding: 1rem;
  }
  
  .logo-text {
    font-size: 1.1rem;
  }
  
  .main-content {
    padding: 1.5rem;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-stats {
    flex-direction: column;
  }
}

@media (max-width: 700px) {
  .sidebar {
    width: 70px;
    min-width: 70px;
    max-width: 70px;
    padding: 0.75rem;
  }
  
  .logo-text,
  .nav-label,
  .nav-item span,
  .profile-card,
  .version-info {
    display: none;
  }
  
  .sidebar-header {
    justify-content: center;
    padding: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .logo-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
  
  .nav-item {
    justify-content: center;
    padding: 0.75rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .hero-content h1 {
    font-size: 1.35rem;
  }
  
  .hero-content p {
    font-size: 0.85rem;
  }
  
  .action-card {
    padding: 1rem;
  }
  
  .action-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
