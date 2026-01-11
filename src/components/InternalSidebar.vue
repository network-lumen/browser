<template>
  <aside class="lumen-sidebar">
    <div class="lumen-sidebar-header">
      <div class="lumen-sidebar-icon">
        <component :is="icon" :size="20" />
      </div>
      <span class="lumen-sidebar-title">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <div v-else class="lumen-sidebar-no-profile">
      <span class="no-profile-title">No active profile</span>
      <span class="no-profile-sub">Create or import one from the navbar.</span>
    </div>

    <div class="lumen-sidebar-scroll">
      <slot />

      <AllPagesDropdown
        v-if="showAllPages"
        :activeKey="activeKey"
        :exclude="allPagesExclude"
      />

      <!-- ⭐ FAVOURITES -->
      <div v-if="favourites.length" class="sidebar-section">
        <div class="sidebar-section-title">Favourites</div>
        <button
          class="sidebar-fav-item"
          v-for="url in favourites"
          :key="url"
          @click="$emit('goto', url)"
        >
          <Star :size="14" />
          <span>{{ url.replace('lumen://', '') }}</span>
        </button>
      </div>
    </div>

    <div v-if="showVersion || $slots.footer" class="lumen-sidebar-footer">
      <slot name="footer" />
      <div v-if="showVersion" class="lumen-sidebar-version">
        Lumen v{{ appVersion }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Star } from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../internal/profilesStore';
import { useFavourites } from '../internal/favouritesStore';

import ActiveProfileCard from './ActiveProfileCard.vue';
import AllPagesDropdown from './AllPagesDropdown.vue';
import pkg from '../../package.json';

const { favourites } = useFavourites();

const props = withDefaults(defineProps<{
  title: string;
  icon: any;
  activeKey?: string;
  showAllPages?: boolean;
  allPagesExclude?: string[];
  showVersion?: boolean;
}>(), {
  activeKey: undefined,
  showAllPages: true,
  allPagesExclude: () => [],
  showVersion: true
});

const appVersion = String((pkg as any)?.version || '0.0.0');

const profiles = profilesState;
const activeProfile = computed(() =>
  profiles.value.find((p) => p.id === activeProfileId.value) || null
);
</script>

<style scoped>
/* ===== SIDEBAR BASE ===== */
.lumen-sidebar {
  width: 240px;
  min-width: 240px;
  max-width: 240px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1rem;
  color: var(--text-primary);
  border-right: 0.5px solid var(--border-color);
  flex-shrink: 0;
  min-height: 0;
}

/* ===== HEADER ===== */
.lumen-sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.375rem 0.5rem;
  margin-bottom: 1rem;
}

.lumen-sidebar-icon {
  width: 36px;
  height: 36px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.lumen-sidebar-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

/* ===== NO PROFILE STATE ===== */
.lumen-sidebar-no-profile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem;
  border-radius: var(--border-radius-md);
  background: var(--fill-tertiary);
  border: 0.5px solid var(--border-light);
  margin-bottom: 0.875rem;
}

.no-profile-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.no-profile-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* ===== SCROLL AREA ===== */
.lumen-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: var(--fill-secondary) transparent;
}

.lumen-sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.lumen-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.lumen-sidebar-scroll::-webkit-scrollbar-thumb {
  background: var(--fill-secondary);
  border-radius: 4px;
}

.lumen-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--fill-primary);
}

/* ===== FAVOURITES SECTION ===== */
.sidebar-section {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 0.5px solid var(--border-light);
}

.sidebar-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.5rem;
  margin-bottom: 0.375rem;
}

.sidebar-fav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.625rem;
  border-radius: var(--border-radius-sm);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-fav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.sidebar-fav-item svg {
  color: #FFD60A;
  flex-shrink: 0;
}

/* ===== FOOTER ===== */
.lumen-sidebar-footer {
  padding-top: 0.75rem;
  border-top: 0.5px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.lumen-sidebar-version {
  padding: 0.5rem;
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
