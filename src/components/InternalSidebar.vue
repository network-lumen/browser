<template>
  <button
    type="button"
    ref="toggleEl"
    class="internal-sidebar-toggle"
    :aria-expanded="open ? 'true' : 'false'"
    aria-controls="internal-sidebar"
    :title="t('Show menu')"
    @click="open = true"
  >
    <PanelLeft :size="22" />
  </button>

  <button
    v-if="open"
    type="button"
    class="internal-sidebar-scrim"
    :aria-label="t('Close menu')"
    @click="open = false"
  ></button>

  <aside
    id="internal-sidebar"
    class="internal-sidebar color-text-primary flex flex-column p-16px flex-shrink-0 min-h-0 w-240px backdrop-blur bg-sidebar-bg min-w-240px max-w-240px border-right-05-border-color"
    :class="{ 'internal-sidebar-open': open }"
    @click="closeAfterNavigation"
  >
    <div class="flex gap-10px mb-16px flex-inline-align-center py-8px px-10px">
      <div class="bg-gradient-primary color-white flex-align-justify-center size-36px border-radius-10px shadow-primary">
        <component :is="icon" :size="20" />
      </div>
      <span class="color-text-primary txt-weight-medium text-18px letter-spacing-n002">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <UiNoticeCard v-else :title="t('No active profile.')" :description="t('Create or import one from the navbar.')" class="mb-16px" />

    <div class="flex-1 min-h-0 overflow-y-auto pr-4px overflow-x-hidden">
      <slot />

      <div v-if="isHome && renderedFavouriteEntries.length" class="mt-16px pt-12px border-top-05-border-light">
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
              <UiSiteIcon
                :url="entry.url"
                :kind="entry.kind"
                :monogram="entry.monogram"
                image-class="size-16px border-radius-4px"
                class="color-text-primary bg-fill-tertiary border-radius-10px text-11px txt-weight-strong letter-spacing-008em border-1-light size-28px"
              />
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
        {{ t('Lumen v{version}', { version: appVersion }) }}
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
import UiSiteIcon from '../ui/UiSiteIcon.vue';
 import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
 import { PanelLeft, X } from 'lucide-vue-next';
 import { profilesState, activeProfileId } from '../stores/profilesStore';
 import { useFavourites } from '../stores/favouritesStore';
 import { describeFavouriteUrl } from '../internal/services/favouriteMeta';

import ActiveProfileCard from './ActiveProfileCard.vue';
import pkg from '../../package.json';

import { useTabNavigation } from '../composables/useTabNavigation';
const { favouriteEntries, removeFavouriteById } = useFavourites();

/**
 * Whether the drawer is showing.
 *
 * Only meaningful below the breakpoint in responsive.css - above it the
 * sidebar is an ordinary column and this flag changes nothing, which is why
 * there is no matchMedia here deciding whether to render one layout or the
 * other. One DOM, two presentations, and the CSS picks.
 */
const open = ref(false);

/** The toggle, used to read back what the stylesheet decided - see onResize. */
const toggleEl = ref<HTMLElement | null>(null);

/**
 * A drawer that stays open after you have chosen where to go is one the user
 * has to dismiss twice. The slot content is each page's own navigation, so
 * rather than asking every one of them to emit something, a click that landed
 * on a link or a button closes it.
 *
 * Walked rather than matched with a selector: the two element types ARE the
 * rule, and naming them is clearer than a selector string that says the same
 * thing less directly.
 */
function closeAfterNavigation(event: MouseEvent) {
  if (!open.value) return;
  for (
    let el = event.target as HTMLElement | null;
    el && el !== event.currentTarget;
    el = el.parentElement
  ) {
    if (el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement) {
      open.value = false;
      return;
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) open.value = false;
}

/**
 * Widening the window with the drawer open leaves the flag set, and with it the
 * scroll lock on the body - so the page behind stays frozen in a layout that no
 * longer has a drawer at all.
 *
 * The breakpoint is not repeated here. The toggle is display:none exactly when
 * the sidebar is a column again, so asking whether it is drawn is the same
 * question as "are we still narrow", answered by the stylesheet that owns it.
 */
function onResize() {
  if (!open.value || !toggleEl.value) return;
  if (getComputedStyle(toggleEl.value).display === 'none') open.value = false;
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
});

// The page behind must not scroll under an open drawer.
watch(open, (isOpen) => {
  document.body.classList.toggle('overflow-hidden', isOpen);
});
onBeforeUnmount(() => document.body.classList.remove('overflow-hidden'));

const props = withDefaults(defineProps<{
  title: string;
  icon: any;
  activeKey?: string;
}>(), {
  activeKey: undefined,
});

/**
 * Shortcuts belong to the home page.
 *
 * They were drawn in every sidebar, under whatever that page's own navigation
 * was - so Settings listed your bookmarks below its sections, and Drive below
 * its subscriptions. They are a way in, not a tool for the page you are on.
 */
const isHome = computed(() => props.activeKey === 'home');

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
