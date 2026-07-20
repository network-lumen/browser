<template>
  <div class="newtab-page internal-page relative block min-h-full overflow-y-auto overflow-x-hidden padding-150-100-200">
    <UiModal :model-value="showOnboarding" panel-class="newtab-onboarding-modal border-1-light border-radius-24px" :closable="false" @update:model-value="dismissOnboarding">
      <div class="flex-align-start gap-100 margin-bottom-100">
        <div class="newtab-brand-logo flex-align-justify-center flex-0-0-auto bg-gradient-primary color-white shadow-primary border-radius-brand-logo-radius" aria-hidden="true">
          <Hexagon :size="22" />
        </div>
        <div class="newtab-onboarding-text">
          <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary fs-12px">Welcome</div>
          <h2 id="lumen-onboarding-title" class="color-text-primary">Learn what Lumen is</h2>
          <p id="lumen-onboarding-desc" class="color-text-secondary">
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

    <UiModal :model-value="showShortcutModal" panel-class="newtab-shortcut-modal border-1-light border-radius-24px" @update:model-value="closeShortcutModal">
      <template #header>
        <div>
          <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary fs-12px">Shortcut</div>
          <h2 id="shortcut-modal-title" class="color-text-primary">
            {{ shortcutModalMode === "create" ? "Add shortcut" : "Edit shortcut" }}
          </h2>
        </div>
      </template>
          <div class="newtab-shortcut-form flex flex-column gap-90">
            <label class="newtab-shortcut-field flex flex-column gap-35">
              <span class="newtab-shortcut-field-span color-text-secondary fs-085rem txt-weight-light">Name</span>
              <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="padding-75-87" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="shortcutDraft.title"
               
               
                placeholder="Optional custom title"
                maxlength="60"
                @keydown.enter.prevent="submitShortcutModal" class="newtab-shortcut-field-input border-1-light focus-ring" />
            </label>

            <label class="newtab-shortcut-field flex flex-column gap-35">
              <span class="newtab-shortcut-field-span color-text-secondary fs-085rem txt-weight-light">URL or Lumen page</span>
              <UiInput bg-class="bg-black-a02" radius-class="border-radius-14px" padding-class="padding-75-87" focus-border-class="focus-border-primary-a50" :focus-ring="false" v-model="shortcutDraft.url"
               
               
                placeholder="lumen://home or example.lmn"
                @keydown.enter.prevent="submitShortcutModal" class="newtab-shortcut-field-input border-1-light focus-ring" />
            </label>

            <UiCheckbox v-model="shortcutDraft.pinned">Mark this shortcut as favourite</UiCheckbox>

            <div v-if="shortcutError" class="newtab-shortcut-error color-error txt-weight-light fs-085rem">
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
      <div class="newtab-glow newtab-glow--left border-radius-full absolute opacity-55 bg-ios-blue-a18 w-2800"></div>
      <div class="newtab-glow newtab-glow--right border-radius-full absolute opacity-55 bg-ios-indigo-a12 w-2800"></div>
    </div>

    <div class="newtab-shell flex flex-column margin-0-auto gap-100 relative z-1 w-min-1040px-full">
      <section class="newtab-hero border-1-light relative overflow-hidden flex-shrink-0 padding-125 border-radius-28px">
        <div class="newtab-hero-copy text-center margin-0-auto max-w-4000">
          <h1 class="color-text-primary margin-0 newtab-hero-copy-h1">Search Lumen</h1>
          <p class="color-text-secondary newtab-hero-copy-p fs-16px line-height-155 margin-0 margin-x-auto margin-top-85">Open your favourite shortcuts, jump into core pages, or go straight to a domain.</p>
        </div>

        <form class="newtab-omnibox flex-align-center gap-75 border-radius-full border-1-light w-min-760 padding-75-87 border-color-primary-a50-focus-within shadow-0-14-30-rgba-15-23-42-0-08" @submit.prevent="submitOmnibox">
          <Search :size="18" class="newtab-omnibox-icon color-text-tertiary flex-0-0-auto" />
          <input
            v-model="commandInput"
            type="text"
            class="newtab-omnibox-input flex-1 border-none outline-none bg-transparent color-text-primary min-w-0 fs-16px"
            placeholder="Search Lumen or enter a URL"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            aria-label="Search Lumen or enter a URL"
          />
          <UiButton variant="primary" type="submit" class="newtab-omnibox-submit">
            <ArrowUpRight :size="15" />
            <span>Go</span>
          </UiButton>
        </form>

        <div v-if="!hasProfiles" class="newtab-hero-hint color-text-secondary border-radius-18px text-center line-height-145 padding-87-100 w-min-760 bg-ios-orange-a08 border-1-ios-orange-a14 margin-0 margin-x-auto margin-top-100">
          Create a profile from the top-right menu to unlock Drive, Wallet, and your personal
          Lumen space.
        </div>
      </section>

      <section class="newtab-shortcuts-panel border-1-light relative overflow-hidden flex-shrink-0 padding-125 border-radius-28px">
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap gap-100">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary fs-12px">Shortcuts</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap gap-62 flex-justify-end">
            <UiButton variant="secondary" type="button" @click="beginCreateShortcut" class="outline-none">
              <Plus :size="15" />
              <span>Add shortcut</span>
            </UiButton>
          </div>
        </div>

        <div class="newtab-shortcut-grid grid gap-75 margin-top-100">
          <article
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="newtab-shortcut-card flex flex-column gap-75 relative padding-87 border-1-light border-radius-22px min-h-150px shadow-0-12-24-rgba-15-23-42-0-05"
            :class="{
              pinned: entry.pinned,
              'is-dragging': draggingShortcutId === entry.id,
              'is-drop-target': dragOverShortcutId === entry.id && draggingShortcutId !== entry.id,
            }"
            draggable="true"
            @dragstart="onShortcutDragStart($event, entry.id)"
            @dragover.prevent="onShortcutDragOver(entry.id)"
            @drop.prevent="onShortcutDrop(entry.id)"
            @dragend="onShortcutDragEnd"
          >
            <UiButton variant="none" type="button" @click="openTarget(entry.url, $event)" class="newtab-shortcut-card-main flex-align-center gap-75 cursor-pointer w-full bg-transparent border-none text-left">
              <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px fs-13px letter-spacing-008em border-1-light bg-fill-tertiary w-300" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="newtab-shortcut-copy flex flex-column min-w-0 gap-20">
                <span class="newtab-shortcut-title block fs-15px nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.title }}</span>
                <span class="newtab-shortcut-subtitle block color-text-tertiary fs-13px line-height-145 nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.subtitle }}</span>
              </span>
            </UiButton>

            <div class="newtab-shortcut-card-actions flex flex-wrap-wrap gap-35">
              <UiButton variant="secondary" type="button"
                :title="entry.pinned ? 'Remove from favourites' : 'Mark as favourite'"
                @click.stop="togglePinned(entry.id, entry.pinned)" class="newtab-shortcut-action">
                <Star :size="14" :fill="entry.pinned ? 'currentColor' : 'none'" />
              </UiButton>
              <UiButton variant="secondary" type="button"
                title="Edit shortcut"
                @click.stop="beginEditShortcut(entry)" class="newtab-shortcut-action">
                <Pencil :size="14" />
              </UiButton>
              <UiButton variant="danger" type="button"
                title="Remove shortcut"
                @click.stop="removeFavouriteById(entry.id)" class="newtab-shortcut-action newtab-shortcut-action--danger">
                <Trash2 :size="14" />
              </UiButton>
            </div>

          </article>
        </div>

        <div v-if="!renderedFavouriteEntries.length" class="newtab-shortcuts-empty margin-top-100 border-radius-20px padding-87-100 bg-black-a02 border-1-dashed-color">
          <div class="newtab-shortcuts-empty-copy">
            <h3 class="color-text-primary">No shortcuts yet</h3>
            <p class="color-text-secondary">
              Star a page from the address bar or create a custom shortcut here. Favourite
              shortcuts stay first.
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="historyEnabled && renderedHistoryPreview.length"
        class="newtab-shortcuts-panel newtab-history-preview-panel padding-top-100 padding-bottom-100 border-1-light relative overflow-hidden flex-shrink-0 padding-125 border-radius-28px"
      >
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap gap-100">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary fs-12px">Recent</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap gap-62 flex-justify-end">
            <UiButton variant="secondary" type="button" @click="goto('lumen://history')" class="outline-none">
              <History :size="15" />
              <span>Open history</span>
            </UiButton>
          </div>
        </div>

        <div class="newtab-history-preview-list grid gap-62 margin-top-62">
          <UiButton variant="none" v-for="entry in renderedHistoryPreview"
            :key="entry.id"
            type="button"
            @click="openTarget(entry.url, $event)" class="newtab-history-preview-item flex-align-center gap-75 cursor-pointer w-full bg-transparent border-1-light border-radius-16px text-left padding-87">
            <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong border-radius-16px fs-13px letter-spacing-008em border-1-light bg-fill-tertiary w-300" :class="`tone-${entry.kind}`">
              {{ entry.monogram }}
            </span>
            <span class="newtab-history-preview-copy flex flex-column flex-1 min-w-0 gap-2px">
              <span class="newtab-history-preview-title block txt-weight-medium nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.title }}</span>
              <span class="newtab-history-preview-subtitle block nowrap overflow-hidden txt-overflow-ellipsis color-text-tertiary fs-13px">{{ entry.subtitle }}</span>
            </span>
            <span class="newtab-history-preview-time flex-0-0-auto txt-weight-medium margin-left-auto padding-left-50 color-text-tertiary fs-13px">{{ formatPreviewTime(entry.lastVisitedAt) }}</span>
          </UiButton>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import { computed, inject, onMounted, reactive, ref } from "vue";
import UiCheckbox from "../../ui/UiCheckbox.vue";
import UiModal from "../../ui/UiModal.vue";
import {
  ArrowUpRight,
  Hexagon,
  History,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-vue-next";
import { describeFavouriteUrl } from "../favouriteMeta";
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

function togglePinned(id: string, currentlyPinned: boolean) {
  setFavouritePinned(id, !currentlyPinned);
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
});
</script>