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

      <div v-if="renderedFavouriteEntries.length" class="sidebar-section">
        <div class="sidebar-section-header">
          <div class="sidebar-section-title">Shortcuts</div>
          <div class="sidebar-section-count">{{ renderedFavouriteEntries.length }}</div>
        </div>
        <div class="sidebar-favs">
          <div
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="sidebar-fav-item"
          >
            <button class="sidebar-fav-hit" @click="openFavourite(entry.url, $event)">
              <span class="sidebar-fav-avatar" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="sidebar-fav-copy">
                <span class="sidebar-fav-title">{{ entry.title }}</span>
                <span class="sidebar-fav-subtitle">{{ entry.subtitle }}</span>
              </span>
            </button>
            <button
              class="sidebar-fav-remove"
              type="button"
              title="Remove shortcut"
              @click.stop="removeFavouriteById(entry.id)"
            >
              <X :size="13" />
            </button>
          </div>
        </div>
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
 import { computed, inject } from 'vue';
 import { X } from 'lucide-vue-next';
 import { profilesState, activeProfileId } from '../internal/profilesStore';
 import { useFavourites } from '../internal/favouritesStore';
 import { describeFavouriteUrl } from '../internal/favouriteMeta';

import ActiveProfileCard from './ActiveProfileCard.vue';
import AllPagesDropdown from './AllPagesDropdown.vue';
import pkg from '../../package.json';

const { favouriteEntries, removeFavouriteById } = useFavourites();

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

 const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
 const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

 const renderedFavouriteEntries = computed(() =>
   favouriteEntries.value.map((entry) => ({
     ...entry,
     ...describeFavouriteUrl(entry.url, entry.title),
   })),
 );

 function openFavourite(url: string, event?: MouseEvent) {
   const target = String(url || '').trim() || 'lumen://newtab';
   const wantsNewTab = !!(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1));
   if (wantsNewTab && openInNewTab) {
     openInNewTab(target);
     return;
   }
   if (navigate) {
     navigate(target, { push: true });
     return;
   }
   openInNewTab?.(target);
 }
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
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.5rem;
  margin-bottom: 0.5rem;
}

.sidebar-section-count {
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  padding: 0 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.sidebar-favs {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.sidebar-fav-item {
  display: flex;
  align-items: stretch;
  gap: 0.375rem;
}

.sidebar-fav-hit {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  text-align: left;
  padding: 0.55rem 0.625rem;
  border-radius: var(--border-radius-sm);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-fav-hit:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.sidebar-fav-avatar {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  background: var(--fill-tertiary);
  border: 1px solid var(--border-light);
}

.sidebar-fav-avatar.tone-search {
  background: rgba(59, 130, 246, 0.12);
  color: var(--ios-blue);
  border-color: rgba(59, 130, 246, 0.18);
}

.sidebar-fav-avatar.tone-internal {
  background: rgba(94, 92, 230, 0.12);
  color: var(--ios-indigo);
  border-color: rgba(94, 92, 230, 0.18);
}

.sidebar-fav-avatar.tone-web {
  background: rgba(52, 199, 89, 0.12);
  color: var(--ios-green);
  border-color: rgba(52, 199, 89, 0.18);
}

.sidebar-fav-avatar.tone-file {
  background: rgba(255, 149, 0, 0.12);
  color: var(--ios-orange);
  border-color: rgba(255, 149, 0, 0.18);
}

.sidebar-fav-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.sidebar-fav-title,
.sidebar-fav-subtitle {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-fav-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-fav-subtitle {
  font-size: 11px;
  color: var(--text-tertiary);
}

.sidebar-fav-remove {
  width: 30px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-fav-remove:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
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
