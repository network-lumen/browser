<template>
  <aside class="color-text-primary flex flex-column p-16px flex-shrink-0 min-h-0 w-240px backdrop-blur bg-sidebar-bg min-w-240px max-w-240px border-right-05-border-color">
    <div class="flex gap-10px mb-16px flex-inline-align-center py-8px px-10px">
      <div class="bg-gradient-primary color-white flex-align-justify-center size-36px border-radius-10px shadow-primary">
        <component :is="icon" :size="20" />
      </div>
      <span class="color-text-primary txt-weight-medium text-18px letter-spacing-n002">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <UiNoticeCard v-else :title="t('No active profile')" :description="t('Create or import one from the navbar.')" class="mb-16px" />

    <div class="flex-1 min-h-0 overflow-y-auto pr-4px overflow-x-hidden">
      <slot />

      <AllPagesDropdown v-if="showAllPages" :activeKey="activeKey" />

      <div v-if="renderedFavouriteEntries.length" class="mt-16px pt-12px border-top-05-border-light">
        <div class="flex-align-center-justify-space-between gap-8px mb-8px py-0px px-8px">
          <div class="color-text-tertiary text-11px txt-weight-light text-uppercase letter-spacing-005em">{{ t('Shortcuts') }}</div>
          <UiCountPill :count="renderedFavouriteEntries.length" />
        </div>
        <div class="flex flex-column gap-2px">
          <div
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="reveal-on-hover flex-align-center gap-4px flex"
          >
            <UiButton variant="none" @click="openFavourite(entry.url, $event)" class="flex-align-center gap-8px border-none bg-transparent cursor-pointer color-text-primary border-radius-10px py-6px px-8px text-left hover-bg-hover transition-all-fast flex-1 min-w-0">
              <span class="color-text-primary bg-fill-tertiary flex-inline-align-justify-center border-radius-10px flex-0-0-auto text-11px txt-weight-strong letter-spacing-008em border-1-light size-28px" :style="avatarToneStyle(entry.kind)">
                {{ entry.monogram }}
              </span>
              <UiTitleSubtitle :title="entry.title" :subtitle="entry.subtitle" />
            </UiButton>
            <UiButton variant="icon" type="button"
              :title="t('Remove shortcut')"
              class="reveal-target opacity-0 hover-bg-error-a10-color-error flex-shrink-0"
              @click.stop="removeFavouriteById(entry.id)">
              <X :size="13" />
            </UiButton>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-column pt-12px gap-6px border-top-05-border-light">
      <slot name="footer" />
      <div class="color-text-tertiary text-center text-10px py-2px px-8px">
        Lumen v{{ appVersion }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiButton from '../ui/UiButton.vue';
import UiTitleSubtitle from '../ui/UiTitleSubtitle.vue';
import UiCountPill from '../ui/UiCountPill.vue';
import UiNoticeCard from '../ui/UiNoticeCard.vue';
 import { computed } from 'vue';
 import { X } from 'lucide-vue-next';
 import { profilesState, activeProfileId } from '../stores/profilesStore';
 import { useFavourites } from '../stores/favouritesStore';
 import { avatarToneStyle, describeFavouriteUrl } from '../internal/favouriteMeta';

import ActiveProfileCard from './ActiveProfileCard.vue';
import AllPagesDropdown from './AllPagesDropdown.vue';
import pkg from '../../package.json';

import { useTabNavigation } from '../composables/useTabNavigation';
const { favouriteEntries, removeFavouriteById } = useFavourites();

withDefaults(defineProps<{
  title: string;
  icon: any;
  activeKey?: string;
  showAllPages?: boolean;
}>(), {
  activeKey: undefined,
  showAllPages: true
});

const appVersion = String((pkg as any)?.version || '0.0.0');

 const profiles = profilesState;
 const activeProfile = computed(() =>
   profiles.value.find((p) => p.id === activeProfileId.value) || null
 );


 const { navigate, openInNewTab } = useTabNavigation();
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
