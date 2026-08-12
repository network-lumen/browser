<template>
  <!-- ####### lumen://newtab NEW TAB ####### -->
  <div class="internal-page relative block overflow-y-auto overflow-x-hidden pt-24px pr-16px pb-32px pl-16px">
    <NewTabOnboardingDialog :model-value="showOnboarding" @dismiss="dismissOnboarding" @learn="learnLumen" />

    <ShortcutEditorDialog :model-value="showShortcutModal" :mode="shortcutModalMode" :draft="shortcutDraft" :error="shortcutError" @update:model-value="closeShortcutModal" @submit="submitShortcutModal" />

    <div class="absolute inset-0 overflow-hidden cursor-events-none" aria-hidden="true">
      <div class="h-448px-blur-36px top-n14rem-left-n10rem border-radius-full absolute opacity-55 bg-primary-a15 w-448px"></div>
      <div class="h-448px-blur-36px top-2rem-right-n12rem border-radius-full absolute opacity-55 bg-indigo-a15 w-448px"></div>
    </div>

    <div class="flex flex-column my-0px mx-auto gap-16px relative z-1 w-min-1040px-full">
      <section class="bg-card-a94-shadow-soft border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">{{ t('Search Lumen') }}</div>

        <form class="bg-card-a90 focus-within-shadow-ring-primary-a10 flex-align-center gap-12px border-radius-full border-1-light w-full py-12px px-16px border-color-primary-a50-focus-within mt-12px mx-auto mb-0px" @submit.prevent="submitOmnibox">
          <Search :size="18" class="color-text-tertiary flex-0-0-auto" />
          <input
            v-model="commandInput"
            type="text"
            class="flex-1 border-none outline-none bg-transparent color-text-primary min-w-0 text-16px placeholder-tertiary"
            :placeholder="t('Search or enter a URL')"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            :aria-label="t('Search or enter a URL')"
          />
          <UiButton variant="primary" type="submit" class="transition-lift-015">
            <ArrowUpRight :size="15" />
            <span>{{ t('Go') }}</span>
          </UiButton>
        </form>

        <div v-if="!hasProfiles" class="color-text-secondary border-radius-16px text-center line-height-14 py-12px px-16px w-full m-0px mt-16px">
          {{ t('Create a profile from the top-right menu to unlock Drive, Wallet, and your personal Lumen space.') }}
        </div>
      </section>

      <section class="bg-card-a94-shadow-soft border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">{{ t('Discover') }}</div>
        <div class="flex flex-wrap-wrap gap-12px mt-16px">
          <button type="button" disabled class="disabled-fade-50 flex-align-center gap-8px border-1-light border-radius-full bg-transparent color-text-tertiary text-13px fw-500 py-8px px-16px cursor-not-allowed">
            <Sparkles :size="15" />
            <span>{{ t('Recently created (soon)') }}</span>
          </button>
          <button type="button" disabled class="disabled-fade-50 flex-align-center gap-8px border-1-light border-radius-full bg-transparent color-text-tertiary text-13px fw-500 py-8px px-16px cursor-not-allowed">
            <Flame :size="15" />
            <span>{{ t('Trending (soon)') }}</span>
          </button>
          <UiButton variant="primary" type="button" @click="open('lumen://web.lmn/')" class="outline-none border-radius-full">
            <Globe :size="15" />
            <span>{{ t('All known websites') }}</span>
          </UiButton>
        </div>
      </section>

      <section class="bg-card-a94-shadow-soft border-1-light relative flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="flex-align-center flex-justify-space-between gap-16px">
          <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">{{ t('Shortcuts') }}</div>

          <UiButton variant="primary" type="button" @click="beginCreateShortcut" class="outline-none">
            <Plus :size="15" />
            <span>{{ t('Add shortcut') }}</span>
          </UiButton>
        </div>

        <div class="flex flex-wrap-wrap gap-12px mt-16px">
          <article
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="bg-card-a92 flex flex-column gap-12px relative p-14px border-1-light border-radius-20px shadow-md min-w-180px max-w-240px"
            :class="{
              'card-state-pinned': entry.pinned,
              'card-state-dragging': draggingShortcutId === entry.id,
              'card-state-drop-target': dragOverShortcutId === entry.id && draggingShortcutId !== entry.id,
            }"
            draggable="true"
            @dragstart="onShortcutDragStart($event, entry.id)"
            @dragover.prevent="onShortcutDragOver(entry.id)"
            @drop.prevent="onShortcutDrop(entry.id)"
            @dragend="onShortcutDragEnd"
          >
            <UiButton variant="none" type="button" @click="openTarget(entry.url, $event)" :title="entry.title" class="flex-align-center gap-12px cursor-pointer w-full bg-transparent border-none text-left">
              <span class="flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px text-13px letter-spacing-008em border-1-light bg-fill-tertiary size-48px" :style="avatarToneStyle(entry.kind)">
                {{ entry.monogram }}
              </span>
              <UiTitleSubtitle :title="entry.title" :subtitle="entry.subtitle" gap-class="gap-4px" title-class="txt-weight-strong block text-15px" subtitle-class="block color-text-tertiary text-13px line-height-14" />
            </UiButton>

            <div class="absolute top-8px right-8px">
              <UiButton variant="icon" type="button" :title="t('More actions')"
                class="newtab-shortcut-menu-trigger bg-card-a92"
                @click.stop="toggleShortcutMenu(entry.id)">
                <MoreHorizontal :size="14" />
              </UiButton>

              <UiCard v-if="openShortcutMenuId === entry.id" padding="none" :shadow="false" role="menu"
                class="newtab-shortcut-menu absolute p-4px shadow-xl z-100 right-0 top-full mt-4px w-160px">
                <UiMenuItem @click.stop="beginEditShortcut(entry); openShortcutMenuId = ''">
                  <Pencil :size="14" />
                  <span>{{ t('Edit shortcut') }}</span>
                </UiMenuItem>
                <UiMenuItem @click.stop="removeFavouriteById(entry.id); openShortcutMenuId = ''">
                  <Trash2 :size="14" />
                  <span>{{ t('Remove shortcut') }}</span>
                </UiMenuItem>
              </UiCard>
            </div>

          </article>
        </div>

        <div v-if="!renderedFavouriteEntries.length" class="mt-16px border-radius-20px py-12px px-16px bg-black-a02 border-1-dashed-color">
          <div>
            <h3 class="color-text-primary mt-4px letter-spacing-n002">{{ t('No shortcuts yet') }}</h3>
            <p class="color-text-secondary mt-8px line-height-15">
              {{ t('Star a page from the address bar or create a custom shortcut here. Favourite shortcuts stay first.') }}
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="historyEnabled && renderedHistoryPreview.length"
        class="bg-card-a94-shadow-soft pt-16px pb-16px border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16"
      >
        <div class="flex-align-center flex-justify-space-between gap-16px">
          <div class="txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">{{ t('Recent') }}</div>

          <UiButton variant="primary" type="button" @click="open('lumen://history')" class="outline-none">
            <History :size="15" />
            <span>{{ t('Open history') }}</span>
          </UiButton>
        </div>

        <div class="grid gap-10px mt-8px grid-cols-auto-fit-280">
          <UiButton variant="none" v-for="entry in renderedHistoryPreview"
            :key="entry.id"
            type="button"
            @click="openTarget(entry.url, $event)" class="transition-transform-bg-border-015 flex-align-center gap-12px cursor-pointer w-full bg-transparent border-1-light border-radius-16px text-left p-14px hover-border-primary-a14">
            <span class="flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px text-13px letter-spacing-008em border-1-light bg-fill-tertiary size-48px" :style="avatarToneStyle(entry.kind)">
              {{ entry.monogram }}
            </span>
            <UiTitleSubtitle :title="entry.title" :subtitle="entry.subtitle" wrapper-class="flex-1" title-class="block txt-weight-medium" subtitle-class="block color-text-tertiary text-13px" />
            <span class="flex-0-0-auto txt-weight-medium pl-8px color-text-tertiary text-13px">{{ formatPreviewTime(entry.lastVisitedAt) }}</span>
          </UiButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../../stores/i18nStore';
import UiButton from '../../ui/UiButton.vue';
import UiCard from '../../ui/UiCard.vue';
import UiMenuItem from '../../ui/UiMenuItem.vue';
import UiTitleSubtitle from '../../ui/UiTitleSubtitle.vue';
import { computed,  onBeforeUnmount, onMounted, reactive, ref } from "vue";
import {
  ArrowUpRight,
  Flame,
  Globe, 
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-vue-next";
import { avatarToneStyle, describeFavouriteUrl } from "../favouriteMeta";
import { FavouriteEntry, useFavourites } from "../../stores/favouritesStore";
import { useHistory } from "../../stores/historyStore";
import { profilesState } from "../../stores/profilesStore";
import { normalizeAddressInput } from "../navigationUrl";
import type { ShortcutDraft, ShortcutModalMode } from "../../types/newTabPage";
import ShortcutEditorDialog from "../../dialogs/ShortcutEditorDialog.vue";
import NewTabOnboardingDialog from "../../dialogs/NewTabOnboardingDialog.vue";
import { STORAGE_KEYS, readString, writeString } from "../services/storage";
import { useTabNavigation } from "../../composables/useTabNavigation";
null


  const { open, openInNewTab } = useTabNavigation();
const {
    favouriteEntries,
    removeFavouriteById,
    setFavouritePinned,
    updateFavourite,
    upsertFavourite,
    moveFavourite,
  } = useFavourites();
const { historyEntries, historyEnabled } = useHistory();

const hasProfiles = computed(() => profilesState.value.length > 0);

const renderedFavouriteEntries = computed(() =>
  favouriteEntries.value.map((entry) => ({
    ...entry,
    ...describeFavouriteUrl(entry.url, entry.title),
  })),
);
const renderedHistoryPreview = computed(() =>
  historyEntries.value.slice(0, 6).map((entry) => ({
    ...entry,
    ...describeFavouriteUrl(entry.url, entry.title),
  })),
);

const builtinHosts = [
  "home",
  "search",
  "history",
  "drive",
  "wallet",
  "extensions",
  "network",
  "settings",
  "help",
  "domain",
  "ipfs",
  "gateways",
  "release",
  "newtab",
];

const ONBOARDING_KEY = STORAGE_KEYS.newTabOnboarding;
const showOnboarding = ref(false);
const commandInput = ref("");

const showShortcutModal = ref(false);
const shortcutModalMode = ref<ShortcutModalMode>("create");
const editingShortcutId = ref("");
const shortcutError = ref("");
const draggingShortcutId = ref("");
const dragOverShortcutId = ref("");
const openShortcutMenuId = ref("");

function toggleShortcutMenu(id: string) {
  openShortcutMenuId.value = openShortcutMenuId.value === id ? "" : id;
}

function onShortcutMenuGlobalClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.newtab-shortcut-menu-trigger') || el.closest('.newtab-shortcut-menu')) return;
  openShortcutMenuId.value = "";
}
const shortcutDraft = reactive<ShortcutDraft>({
  title: "",
  url: "",
  pinned: false,
});

function resetShortcutDraft() {
  shortcutDraft.title = "";
  shortcutDraft.url = "";
  shortcutDraft.pinned = false;
  shortcutError.value = "";
  editingShortcutId.value = "";
  shortcutModalMode.value = "create";
}

function closeShortcutModal() {
  showShortcutModal.value = false;
  resetShortcutDraft();
}

function beginCreateShortcut() {
  resetShortcutDraft();
  shortcutDraft.pinned = true;
  showShortcutModal.value = true;
}

function beginEditShortcut(entry: FavouriteEntry) {
  resetShortcutDraft();
  shortcutModalMode.value = "edit";
  editingShortcutId.value = entry.id;
  shortcutDraft.title = String(entry.title || "").trim();
  shortcutDraft.url = entry.url;
  shortcutDraft.pinned = !!entry.pinned;
  showShortcutModal.value = true;
}

function normalizeShortcutUrl(rawUrl: string): string {
  return normalizeAddressInput(rawUrl, builtinHosts);
}

function submitShortcutModal() {
  const nextUrl = normalizeShortcutUrl(shortcutDraft.url);
  if (!String(nextUrl || "").trim()) {
    shortcutError.value = t("Please enter a valid URL or Lumen page.");
    return;
  }

  if (shortcutModalMode.value === "create") {
    const result = upsertFavourite({
      url: nextUrl,
      title: shortcutDraft.title,
      pinned: shortcutDraft.pinned,
    });
    if (!result.ok) {
      shortcutError.value = t("Failed to add this shortcut.");
      return;
    }
    closeShortcutModal();
    return;
  }

  const updateResult = updateFavourite(editingShortcutId.value, {
    url: nextUrl,
    title: shortcutDraft.title,
  });
  if (!updateResult.ok) {
    shortcutError.value =
      updateResult.error === "duplicate_url"
        ? t("A shortcut with this URL already exists.")
        : t("Failed to update this shortcut.");
    return;
  }

  const pinResult = setFavouritePinned(editingShortcutId.value, shortcutDraft.pinned);
  if (!pinResult.ok) {
    shortcutError.value = t("Failed to update the favourite state.");
    return;
  }

  closeShortcutModal();
}

function markOnboardingDone() {
  try {
    writeString(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
}

function dismissOnboarding() {
  markOnboardingDone();
  showOnboarding.value = false;
}

function openTarget(url: string, event?: MouseEvent) {
  const target = String(url || "").trim() || "lumen://newtab";
  const wantsNewTab = !!(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1));
  if (wantsNewTab && openInNewTab) {
    openInNewTab(target);
    return;
  }
  open(target);
}

function submitOmnibox() {
  const target = normalizeAddressInput(commandInput.value, builtinHosts);
  commandInput.value = target;
  open(target);
}

function learnLumen() {
  dismissOnboarding();
  open("lumen://help/discover");
}

function onShortcutDragStart(event: DragEvent, id: string) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }
  draggingShortcutId.value = id;
  dragOverShortcutId.value = id;
}

function onShortcutDragOver(id: string) {
  if (!draggingShortcutId.value || draggingShortcutId.value === id) return;
  dragOverShortcutId.value = id;
}

function onShortcutDrop(id: string) {
  const draggedId = String(draggingShortcutId.value || "").trim();
  if (!draggedId || draggedId === id) {
    onShortcutDragEnd();
    return;
  }
  const targetIndex = renderedFavouriteEntries.value.findIndex((entry) => entry.id === id);
  if (targetIndex >= 0) {
    moveFavourite(draggedId, targetIndex);
  }
  onShortcutDragEnd();
}

function onShortcutDragEnd() {
  draggingShortcutId.value = "";
  dragOverShortcutId.value = "";
}

function formatPreviewTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

onMounted(() => {
  try {
    const seen = readString(ONBOARDING_KEY) === "1";
    showOnboarding.value = !seen;
  } catch {
    showOnboarding.value = true;
  }
  window.addEventListener('click', onShortcutMenuGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onShortcutMenuGlobalClick);
});
</script>