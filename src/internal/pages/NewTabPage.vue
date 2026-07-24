<template>
  <div class="newtab-page bg-gradient-newtab-page internal-page relative block min-h-full overflow-y-auto overflow-x-hidden pt-24px pr-16px pb-32px pl-16px">
    <UiModal :model-value="showOnboarding" panel-class="bg-card-a94-shadow-soft border-1-light border-radius-24px backdrop-blur-16 w-min-544px-full" :closable="false" @update:model-value="dismissOnboarding">
      <div class="flex-align-start gap-16px mb-16px">
        <div class="newtab-brand-logo flex-align-justify-center flex-0-0-auto bg-gradient-primary color-white shadow-primary border-radius-16px size-48px" aria-hidden="true">
          <Hexagon :size="22" />
        </div>
        <div class="newtab-onboarding-text">
          <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Welcome</div>
          <h2 id="lumen-onboarding-title" class="color-text-primary">Learn what Lumen is</h2>
          <p id="lumen-onboarding-desc" class="color-text-secondary mt-8px line-height-15">
            Domains, IPFS, gateways and browser-native shortcuts, all in one launch page.
          </p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" type="button" @click="dismissOnboarding" class="outline-none">
          Skip
        </UiButton>
        <UiButton variant="primary" type="button" @click="learnLumen" class="outline-none">
          Learn Lumen
        </UiButton>
      </template>
    </UiModal>

    <UiModal :model-value="showShortcutModal" panel-class="bg-card-a94-shadow-soft border-1-light border-radius-24px backdrop-blur-16 w-min-512px-full" @update:model-value="closeShortcutModal">
      <template #header>
        <div>
          <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Shortcut</div>
          <h2 id="shortcut-modal-title" class="color-text-primary">
            {{ shortcutModalMode === "create" ? "Add shortcut" : "Edit shortcut" }}
          </h2>
        </div>
      </template>
          <div class="newtab-shortcut-form flex flex-column gap-12px">
            <UiFormField label="Name" label-class="color-text-secondary text-14px txt-weight-light">
              <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="shortcutDraft.title"
                placeholder="Optional custom title"
                maxlength="60"
                @keydown.enter.prevent="submitShortcutModal" class="border-1-light focus-ring" />
            </UiFormField>

            <UiFormField label="URL or Lumen page" label-class="color-text-secondary text-14px txt-weight-light">
              <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="shortcutDraft.url"
                placeholder="lumen://home or example.lmn"
                @keydown.enter.prevent="submitShortcutModal" class="border-1-light focus-ring" />
            </UiFormField>

            <UiCheckbox v-model="shortcutDraft.pinned">Mark this shortcut as favourite</UiCheckbox>

            <div v-if="shortcutError" class="newtab-shortcut-error color-error txt-weight-light text-14px">
              {{ shortcutError }}
            </div>
          </div>

      <template #footer>
        <UiButton variant="secondary" type="button" @click="closeShortcutModal" class="outline-none">
          Cancel
        </UiButton>
        <UiButton variant="primary" type="button" @click="submitShortcutModal" class="outline-none">
          {{ shortcutModalMode === "create" ? "Add shortcut" : "Save changes" }}
        </UiButton>
      </template>
    </UiModal>

    <div class="newtab-backdrop absolute inset-0 overflow-hidden cursor-events-none" aria-hidden="true">
      <div class="h-448px-blur-36px top-n14rem-left-n10rem border-radius-full absolute opacity-55 bg-primary-a15 w-448px"></div>
      <div class="h-448px-blur-36px top-2rem-right-n12rem border-radius-full absolute opacity-55 bg-indigo-a15 w-448px"></div>
    </div>

    <div class="newtab-shell flex flex-column my-0px mx-auto gap-16px relative z-1 w-min-1040px-full">
      <section class="newtab-hero bg-card-a94-shadow-soft border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Search Lumen</div>

        <form class="bg-card-a90 focus-within-shadow-ring-primary-a10 flex-align-center gap-12px border-radius-full border-1-light w-full py-12px px-16px border-color-primary-a50-focus-within mt-12px mx-auto mb-0px" @submit.prevent="submitOmnibox">
          <Search :size="18" class="newtab-omnibox-icon color-text-tertiary flex-0-0-auto" />
          <input
            v-model="commandInput"
            type="text"
            class="newtab-omnibox-input flex-1 border-none outline-none bg-transparent color-text-primary min-w-0 text-16px placeholder-tertiary"
            placeholder="Search Lumen or enter a URL"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            aria-label="Search Lumen or enter a URL"
          />
          <UiButton variant="primary" type="submit" class="newtab-omnibox-submit transition-lift-015">
            <ArrowUpRight :size="15" />
            <span>Go</span>
          </UiButton>
        </form>

        <div v-if="!hasProfiles" class="newtab-hero-hint color-text-secondary border-radius-16px text-center line-height-14 py-12px px-16px w-full m-0px mt-16px">
          Create a profile from the top-right menu to unlock Drive, Wallet, and your personal
          Lumen space.
        </div>
      </section>

      <section class="bg-card-a94-shadow-soft border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Discover</div>
        <div class="flex flex-wrap-wrap gap-12px mt-16px">
          <button type="button" disabled class="disabled-fade-50 flex-align-center gap-8px border-1-light border-radius-full bg-transparent color-text-tertiary text-13px fw-500 py-8px px-16px cursor-not-allowed">
            <Sparkles :size="15" />
            <span>Recently created</span>
          </button>
          <button type="button" disabled class="disabled-fade-50 flex-align-center gap-8px border-1-light border-radius-full bg-transparent color-text-tertiary text-13px fw-500 py-8px px-16px cursor-not-allowed">
            <Flame :size="15" />
            <span>Trending</span>
          </button>
          <UiButton variant="secondary" type="button" @click="goto('lumen://web.lmn/')" class="outline-none">
            <Globe :size="15" />
            <span>All known websites</span>
          </UiButton>
        </div>
      </section>

      <section class="bg-card-a94-shadow-soft border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16">
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap gap-16px">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Shortcuts</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap gap-10px flex-justify-start w-full">
            <UiButton variant="secondary" type="button" @click="beginCreateShortcut" class="outline-none">
              <Plus :size="15" />
              <span>Add shortcut</span>
            </UiButton>
          </div>
        </div>

        <div class="newtab-shortcut-grid flex flex-wrap-wrap gap-12px mt-16px">
          <article
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="bg-card-a92 flex flex-column gap-12px relative p-14px border-1-light border-radius-20px shadow-lg min-w-180px max-w-240px"
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
            <UiButton variant="none" type="button" @click="openTarget(entry.url, $event)" :title="entry.title" class="newtab-shortcut-card-main flex-align-center gap-12px cursor-pointer w-full bg-transparent border-none text-left">
              <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px text-13px letter-spacing-008em border-1-light bg-fill-tertiary size-48px" :style="avatarToneStyle(entry.kind)">
                {{ entry.monogram }}
              </span>
              <UiTitleSubtitle :title="entry.title" :subtitle="entry.subtitle" gap-class="gap-4px" title-class="txt-weight-strong block text-15px" subtitle-class="block color-text-tertiary text-13px line-height-14" />
            </UiButton>

            <div class="newtab-shortcut-card-actions absolute top-8px right-8px">
              <UiButton variant="icon" type="button" title="More actions"
                class="newtab-shortcut-menu-trigger bg-card-a92"
                @click.stop="toggleShortcutMenu(entry.id)">
                <MoreHorizontal :size="14" />
              </UiButton>

              <UiCard v-if="openShortcutMenuId === entry.id" padding="none" :shadow="false" role="menu"
                class="newtab-shortcut-menu absolute p-4px shadow-xl z-100 right-0 top-full mt-4px w-160px">
                <UiMenuItem @click.stop="beginEditShortcut(entry); openShortcutMenuId = ''">
                  <Pencil :size="14" />
                  <span>Edit shortcut</span>
                </UiMenuItem>
                <UiMenuItem @click.stop="removeFavouriteById(entry.id); openShortcutMenuId = ''">
                  <Trash2 :size="14" />
                  <span>Remove shortcut</span>
                </UiMenuItem>
              </UiCard>
            </div>

          </article>
        </div>

        <div v-if="!renderedFavouriteEntries.length" class="newtab-shortcuts-empty mt-16px border-radius-20px py-12px px-16px bg-black-a02 border-1-dashed-color">
          <div class="newtab-shortcuts-empty-copy">
            <h3 class="color-text-primary mt-4px letter-spacing-n002">No shortcuts yet</h3>
            <p class="color-text-secondary mt-8px line-height-15">
              Star a page from the address bar or create a custom shortcut here. Favourite
              shortcuts stay first.
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="historyEnabled && renderedHistoryPreview.length"
        class="bg-card-a94-shadow-soft newtab-history-preview-panel pt-16px pb-16px border-1-light relative overflow-hidden flex-shrink-0 p-20px border-radius-24px backdrop-blur-16"
      >
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap gap-16px">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary text-12px letter-spacing-01em">Recent</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap gap-10px flex-justify-start w-full">
            <UiButton variant="secondary" type="button" @click="goto('lumen://history')" class="outline-none">
              <History :size="15" />
              <span>Open history</span>
            </UiButton>
          </div>
        </div>

        <div class="newtab-history-preview-list grid gap-10px mt-8px grid-cols-auto-fit-280">
          <UiButton variant="none" v-for="entry in renderedHistoryPreview"
            :key="entry.id"
            type="button"
            @click="openTarget(entry.url, $event)" class="transition-transform-bg-border-015 flex-align-center gap-12px cursor-pointer w-full bg-transparent border-1-light border-radius-16px text-left p-14px hover-border-primary-a14">
            <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px text-13px letter-spacing-008em border-1-light bg-fill-tertiary size-48px" :style="avatarToneStyle(entry.kind)">
              {{ entry.monogram }}
            </span>
            <UiTitleSubtitle :title="entry.title" :subtitle="entry.subtitle" wrapper-class="flex-1" title-class="block txt-weight-medium" subtitle-class="block color-text-tertiary text-13px" />
            <span class="newtab-history-preview-time flex-0-0-auto txt-weight-medium ml-auto pl-8px color-text-tertiary text-13px">{{ formatPreviewTime(entry.lastVisitedAt) }}</span>
          </UiButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiCard from '../../ui/UiCard.vue';
import UiMenuItem from '../../ui/UiMenuItem.vue';
import UiFormField from '../../ui/UiFormField.vue';
import UiTitleSubtitle from '../../ui/UiTitleSubtitle.vue';
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import UiCheckbox from "../../ui/UiCheckbox.vue";
import UiModal from "../../ui/UiModal.vue";
import {
  ArrowUpRight,
  Flame,
  Globe,
  Hexagon,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-vue-next";
import { avatarToneStyle, describeFavouriteUrl } from "../favouriteMeta";
import { FavouriteEntry, useFavourites } from "../favouritesStore";
import { useHistory } from "../historyStore";
import { profilesState } from "../profilesStore";
import { normalizeAddressInput } from "../navigationUrl";


type ShortcutModalMode = "create" | "edit";

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>("openInNewTab", null);

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
  "explorer",
  "dao",
  "ipfs",
  "gateways",
  "release",
  "newtab",
];

const ONBOARDING_KEY = "lumen:onboarding:discover:v1";
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
const shortcutDraft = reactive({
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
    shortcutError.value = "Please enter a valid URL or Lumen page.";
    return;
  }

  if (shortcutModalMode.value === "create") {
    const result = upsertFavourite({
      url: nextUrl,
      title: shortcutDraft.title,
      pinned: shortcutDraft.pinned,
    });
    if (!result.ok) {
      shortcutError.value = "Unable to add this shortcut.";
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
        ? "A shortcut with this URL already exists."
        : "Unable to update this shortcut.";
    return;
  }

  const pinResult = setFavouritePinned(editingShortcutId.value, shortcutDraft.pinned);
  if (!pinResult.ok) {
    shortcutError.value = "Unable to update the favourite state.";
    return;
  }

  closeShortcutModal();
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // ignore
  }
}

function dismissOnboarding() {
  markOnboardingDone();
  showOnboarding.value = false;
}

function goto(url: string) {
  const target = String(url || "").trim() || "lumen://newtab";
  if (navigate) {
    navigate(target, { push: true });
    return;
  }
  openInNewTab?.(target);
}

function openTarget(url: string, event?: MouseEvent) {
  const target = String(url || "").trim() || "lumen://newtab";
  const wantsNewTab = !!(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1));
  if (wantsNewTab && openInNewTab) {
    openInNewTab(target);
    return;
  }
  goto(target);
}

function submitOmnibox() {
  const target = normalizeAddressInput(commandInput.value, builtinHosts);
  commandInput.value = target;
  goto(target);
}

function learnLumen() {
  dismissOnboarding();
  goto("lumen://help/discover");
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
    const seen = localStorage.getItem(ONBOARDING_KEY) === "1";
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
