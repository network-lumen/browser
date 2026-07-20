<template>
  <aside class="lumen-sidebar color-text-primary flex flex-column padding-100 flex-shrink-0 min-h-0 w-240px backdrop-blur bg-sidebar-bg">
    <div class="lumen-sidebar-header flex gap-62 margin-bottom-100 flex-inline-align-center padding-50-62">
      <div class="lumen-sidebar-icon bg-gradient-primary color-white flex-align-justify-center size-36px border-radius-sm shadow-primary">
        <component :is="icon" :size="20" />
      </div>
      <span class="lumen-sidebar-title color-text-primary txt-weight-medium fs-11rem letter-spacing-n002">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <div v-else class="lumen-sidebar-no-profile bg-fill-tertiary flex flex-column gap-25 border-radius-md margin-bottom-87 padding-87 border-05-light">
      <span class="lumen-sidebar-no-profile-title color-text-primary fs-13px txt-weight-light">No active profile</span>
      <span class="lumen-sidebar-no-profile-sub color-text-tertiary fs-12px line-height-14">Create or import one from the navbar.</span>
    </div>

    <div class="lumen-sidebar-scroll flex-1 min-h-0 overflow-y-auto padding-right-25 overflow-x-hidden">
      <slot />

      <AllPagesDropdown
        v-if="showAllPages"
        :activeKey="activeKey"
        :exclude="allPagesExclude"
      />

      <div v-if="renderedFavouriteEntries.length" class="sidebar-section margin-top-100 padding-top-75">
        <div class="sidebar-section-header flex-align-center-justify-space-between gap-50 margin-bottom-50 padding-0-50">
          <div class="sidebar-section-title color-text-tertiary fs-11px txt-weight-light text-uppercase letter-spacing-005em">Shortcuts</div>
          <div class="sidebar-section-count bg-fill-tertiary color-text-secondary flex-inline-align-justify-center border-radius-full fs-11px txt-weight-medium padding-0-50">{{ renderedFavouriteEntries.length }}</div>
        </div>
        <div class="sidebar-favs flex flex-column gap-35">
          <div
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="sidebar-fav-item flex gap-35"
          >
            <button class="sidebar-fav-hit hover-fill-primary bg-transparent border-none color-text-secondary cursor-pointer flex-align-center flex-1 w-full border-radius-sm text-left min-w-0 gap-62 transition-all-015 padding-50-62" @click="openFavourite(entry.url, $event)">
              <span class="sidebar-fav-avatar color-text-primary bg-fill-tertiary flex-inline-align-justify-center border-radius-10px flex-0-0-auto fs-11px txt-weight-strong letter-spacing-008em border-1-light w-30px h-30px" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="sidebar-fav-copy flex flex-column gap-10 min-w-0">
                <span class="sidebar-fav-title color-text-primary fs-13px txt-weight-light block nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.title }}</span>
                <span class="sidebar-fav-subtitle color-text-tertiary fs-11px block nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.subtitle }}</span>
              </span>
            </button>
            <button
              class="sidebar-fav-remove hover-fill-primary border-none bg-transparent color-text-tertiary cursor-pointer border-radius-10px transition-all-015 w-30px"
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

    <div v-if="showVersion || $slots.footer" class="lumen-sidebar-footer flex flex-column padding-top-75 gap-35">
      <slot name="footer" />
      <div v-if="showVersion" class="lumen-sidebar-version color-text-tertiary text-center fs-11px padding-50">
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
