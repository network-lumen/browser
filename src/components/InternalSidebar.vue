<template>
  <aside class="lumen-sidebar">
    <div class="lumen-sidebar-header flex">
      <div class="lumen-sidebar-icon">
        <component :is="icon" :size="20" />
      </div>
      <span class="lumen-sidebar-title">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <div v-else class="lumen-sidebar-no-profile">
      <span class="lumen-sidebar-no-profile-title">No active profile</span>
      <span class="lumen-sidebar-no-profile-sub">Create or import one from the navbar.</span>
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
        <div class="sidebar-favs flex flex-column gap-35">
          <div
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="sidebar-fav-item"
          >
            <button class="sidebar-fav-hit hover-fill-primary" @click="openFavourite(entry.url, $event)">
              <span class="sidebar-fav-avatar" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="sidebar-fav-copy">
                <span class="sidebar-fav-title">{{ entry.title }}</span>
                <span class="sidebar-fav-subtitle">{{ entry.subtitle }}</span>
              </span>
            </button>
            <button
              class="sidebar-fav-remove hover-fill-primary"
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
