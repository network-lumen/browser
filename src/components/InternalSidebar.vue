<template>
  <aside class="lumen-sidebar color-text-primary flex flex-column p-16px flex-shrink-0 min-h-0 w-240px backdrop-blur bg-sidebar-bg min-w-240px max-w-240px border-right-05-border-color">
    <div class="lumen-sidebar-header flex gap-10px mb-16px flex-inline-align-center py-8px px-10px">
      <div class="lumen-sidebar-icon bg-gradient-primary color-white flex-align-justify-center size-36px border-radius-10px shadow-primary">
        <component :is="icon" :size="20" />
      </div>
      <span class="lumen-sidebar-title color-text-primary txt-weight-medium text-18px letter-spacing-n002">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <div v-else class="lumen-sidebar-no-profile bg-fill-tertiary flex flex-column gap-4px border-radius-12px mb-16px p-14px border-05-light">
      <span class="lumen-sidebar-no-profile-title color-text-primary text-13px txt-weight-light">No active profile</span>
      <span class="lumen-sidebar-no-profile-sub color-text-tertiary text-12px line-height-14">Create or import one from the navbar.</span>
    </div>

    <div class="lumen-sidebar-scroll flex-1 min-h-0 overflow-y-auto pr-4px overflow-x-hidden">
      <slot />

      <AllPagesDropdown
        v-if="showAllPages"
        :activeKey="activeKey"
        :exclude="allPagesExclude"
      />

      <div v-if="renderedFavouriteEntries.length" class="sidebar-section mt-16px pt-12px border-top-05-border-light">
        <div class="sidebar-section-header flex-align-center-justify-space-between gap-8px mb-8px py-0px px-8px">
          <div class="sidebar-section-title color-text-tertiary text-11px txt-weight-light text-uppercase letter-spacing-005em">Shortcuts</div>
          <div class="h-24px bg-fill-tertiary color-text-secondary flex-inline-align-justify-center border-radius-full text-11px txt-weight-medium py-0px px-8px min-w-24px">{{ renderedFavouriteEntries.length }}</div>
        </div>
        <div class="sidebar-favs flex flex-column gap-6px">
          <div
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="sidebar-fav-item flex gap-6px flex-align-stretch"
          >
            <UiButton variant="secondary" @click="openFavourite(entry.url, $event)" class="sidebar-fav-hit">
              <span class="sidebar-fav-avatar color-text-primary bg-fill-tertiary flex-inline-align-justify-center border-radius-10px flex-0-0-auto text-11px txt-weight-strong letter-spacing-008em border-1-light w-32px h-32px" :style="avatarToneStyle(entry.kind)">
                {{ entry.monogram }}
              </span>
              <span class="sidebar-fav-copy flex flex-column gap-2px min-w-0">
                <span class="sidebar-fav-title color-text-primary text-13px txt-weight-light block nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.title }}</span>
                <span class="sidebar-fav-subtitle color-text-tertiary text-11px block nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.subtitle }}</span>
              </span>
            </UiButton>
            <UiButton variant="primary" type="button"
              title="Remove shortcut"
              @click.stop="removeFavouriteById(entry.id)" class="sidebar-fav-remove">
              <X :size="13" />
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showVersion || $slots.footer" class="lumen-sidebar-footer flex flex-column pt-12px gap-6px border-top-05-border-light">
      <slot name="footer" />
      <div v-if="showVersion" class="lumen-sidebar-version color-text-tertiary text-center text-11px p-8px">
        Lumen v{{ appVersion }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import UiButton from '../ui/UiButton.vue';
 import { computed, inject } from 'vue';
 import { X } from 'lucide-vue-next';
 import { profilesState, activeProfileId } from '../internal/profilesStore';
 import { useFavourites } from '../internal/favouritesStore';
 import { avatarToneStyle, describeFavouriteUrl } from '../internal/favouriteMeta';

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
