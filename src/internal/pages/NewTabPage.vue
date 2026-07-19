<template>
  <div class="newtab-page internal-page">
    <div
      v-if="showOnboarding"
      class="newtab-onboarding-overlay absolute inset-0 flex-align-justify-center padding-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lumen-onboarding-title"
      aria-describedby="lumen-onboarding-desc"
    >
      <div class="newtab-onboarding-modal" @click.stop>
        <div class="flex-align-start gap-100 margin-bottom-100">
          <div class="newtab-brand-logo flex-align-justify-center flex-0-0-auto" aria-hidden="true">
            <Hexagon :size="22" />
          </div>
          <div class="newtab-onboarding-text">
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary">Welcome</div>
            <h2 id="lumen-onboarding-title" class="color-text-primary">Learn what Lumen is</h2>
            <p id="lumen-onboarding-desc" class="color-text-secondary">
              Domains, IPFS, gateways and browser-native shortcuts, all in one launch page.
            </p>
          </div>
        </div>

        <div class="newtab-onboarding-actions flex">
          <button class="newtab-btn newtab-btn-primary txt-weight-light txt-sm cursor-pointer outline-none color-white flex-inline-align-justify-center border-none" type="button" @click="learnLumen">
            Learn Lumen
          </button>
          <button class="newtab-btn newtab-btn-secondary txt-weight-light txt-sm cursor-pointer outline-none color-text-primary flex-inline-align-justify-center border-none" type="button" @click="dismissOnboarding">
            Skip
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showShortcutModal"
        class="newtab-shortcut-modal-overlay newtab-onboarding-overlay flex-align-justify-center padding-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        @click.self="closeShortcutModal"
      >
        <div class="newtab-shortcut-modal">
          <div class="newtab-shortcut-modal-head flex-align-start flex-justify-space-between">
            <div>
              <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary">Shortcut</div>
              <h2 id="shortcut-modal-title" class="color-text-primary">
                {{ shortcutModalMode === "create" ? "Add shortcut" : "Edit shortcut" }}
              </h2>
            </div>
            <button
              class="newtab-shortcut-modal-close flex-inline-align-justify-center border-none cursor-pointer h-200 border-radius-full color-text-secondary"
              type="button"
              aria-label="Close shortcut editor"
              @click="closeShortcutModal"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="newtab-shortcut-form flex flex-column margin-top-100 gap-90">
            <label class="newtab-shortcut-field flex flex-column gap-35">
              <span>Name</span>
              <input
                v-model="shortcutDraft.title"
                type="text"
                class="w-full color-text-primary outline-none"
                placeholder="Optional custom title"
                maxlength="60"
                @keydown.enter.prevent="submitShortcutModal"
              />
            </label>

            <label class="newtab-shortcut-field flex flex-column gap-35">
              <span>URL or Lumen page</span>
              <input
                v-model="shortcutDraft.url"
                type="text"
                class="w-full color-text-primary outline-none"
                placeholder="lumen://home or example.lmn"
                @keydown.enter.prevent="submitShortcutModal"
              />
            </label>

            <label class="newtab-shortcut-checkbox flex-inline-align-center">
              <input v-model="shortcutDraft.pinned" type="checkbox" />
              <span>Mark this shortcut as favourite</span>
            </label>

            <div v-if="shortcutError" class="newtab-shortcut-error color-error txt-weight-light">
              {{ shortcutError }}
            </div>
          </div>

          <div class="newtab-shortcut-modal-actions flex">
            <button class="newtab-btn newtab-btn-secondary txt-weight-light txt-sm cursor-pointer outline-none color-text-primary flex-inline-align-justify-center border-none" type="button" @click="closeShortcutModal">
              Cancel
            </button>
            <button class="newtab-btn newtab-btn-primary txt-weight-light txt-sm cursor-pointer outline-none color-white flex-inline-align-justify-center border-none" type="button" @click="submitShortcutModal">
              {{ shortcutModalMode === "create" ? "Add shortcut" : "Save changes" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="newtab-backdrop" aria-hidden="true">
      <div class="newtab-glow newtab-glow--left border-radius-full"></div>
      <div class="newtab-glow newtab-glow--right border-radius-full"></div>
    </div>

    <div class="newtab-shell flex flex-column margin-0-auto gap-100">
      <section class="newtab-hero">
        <div class="newtab-hero-copy text-center margin-0-auto">
          <h1 class="color-text-primary margin-0">Search Lumen</h1>
          <p class="color-text-secondary">Open your favourite shortcuts, jump into core pages, or go straight to a domain.</p>
        </div>

        <form class="newtab-omnibox flex-align-center gap-75 border-radius-full" @submit.prevent="submitOmnibox">
          <Search :size="18" class="newtab-omnibox-icon color-text-tertiary flex-0-0-auto" />
          <input
            v-model="commandInput"
            type="text"
            class="newtab-omnibox-input flex-1 border-none outline-none bg-transparent color-text-primary"
            placeholder="Search Lumen or enter a URL"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            aria-label="Search Lumen or enter a URL"
          />
          <button class="newtab-omnibox-submit flex-inline-align-justify-center color-white flex-0-0-auto border-none cursor-pointer" type="submit">
            <ArrowUpRight :size="15" />
            <span>Go</span>
          </button>
        </form>

        <div class="newtab-quick-links flex flex-wrap-wrap gap-50">
          <button
            v-for="link in quickLinks"
            :key="link.url"
            type="button"
            class="newtab-quick-link flex-inline-align-center border-radius-full color-text-secondary border-none cursor-pointer"
            :disabled="link.requiresProfile && !hasProfiles"
            @click="openQuickLink(link, $event)"
          >
            <component :is="link.icon" :size="14" />
            <span>{{ link.label }}</span>
          </button>
        </div>

        <div v-if="!hasProfiles" class="newtab-hero-hint color-text-secondary border-radius-18px text-center">
          Create a profile from the top-right menu to unlock Drive, Wallet, and your personal
          Lumen space.
        </div>
      </section>

      <section class="newtab-shortcuts-panel">
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary">Shortcuts</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap">
            <button class="newtab-btn newtab-btn-secondary txt-weight-light txt-sm cursor-pointer outline-none color-text-primary flex-inline-align-justify-center border-none" type="button" @click="beginCreateShortcut">
              <Plus :size="15" />
              <span>Add shortcut</span>
            </button>
          </div>
        </div>

        <div class="newtab-shortcut-grid">
          <article
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="newtab-shortcut-card flex flex-column gap-75"
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
            <button class="newtab-shortcut-card-main flex w-full border-none bg-transparent color-text-primary cursor-pointer flex-1 text-left" type="button" @click="openTarget(entry.url, $event)">
              <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="newtab-shortcut-copy flex flex-column">
                <span class="newtab-shortcut-title block">{{ entry.title }}</span>
                <span class="newtab-shortcut-subtitle block color-text-tertiary">{{ entry.subtitle }}</span>
              </span>
            </button>

            <div class="newtab-shortcut-card-actions flex flex-wrap-wrap">
              <button
                class="newtab-shortcut-action flex-inline-align-justify-center h-200 border-radius-full color-text-secondary border-none cursor-pointer"
                type="button"
                :title="entry.pinned ? 'Remove from favourites' : 'Mark as favourite'"
                @click.stop="togglePinned(entry.id, entry.pinned)"
              >
                <Star :size="14" :fill="entry.pinned ? 'currentColor' : 'none'" />
              </button>
              <button
                class="newtab-shortcut-action flex-inline-align-justify-center h-200 border-radius-full color-text-secondary border-none cursor-pointer"
                type="button"
                title="Edit shortcut"
                @click.stop="beginEditShortcut(entry)"
              >
                <Pencil :size="14" />
              </button>
              <button
                class="newtab-shortcut-action newtab-shortcut-action--danger flex-inline-align-justify-center h-200 border-radius-full color-text-secondary border-none cursor-pointer"
                type="button"
                title="Remove shortcut"
                @click.stop="removeFavouriteById(entry.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>

          </article>
        </div>

        <div v-if="!renderedFavouriteEntries.length" class="newtab-shortcuts-empty margin-top-100 border-radius-20px">
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
        class="newtab-shortcuts-panel newtab-history-preview-panel padding-top-100 padding-bottom-100"
      >
        <div class="newtab-shortcuts-head flex-align-start flex-justify-space-between flex-wrap-wrap">
          <div>
            <div class="newtab-section-kicker txt-weight-strong text-uppercase color-primary">Recent</div>
          </div>

          <div class="newtab-shortcuts-head-actions flex flex-wrap-wrap">
            <button class="newtab-btn newtab-btn-secondary txt-weight-light txt-sm cursor-pointer outline-none color-text-primary flex-inline-align-justify-center border-none" type="button" @click="goto('lumen://history')">
              <History :size="15" />
              <span>Open history</span>
            </button>
          </div>
        </div>

        <div class="newtab-history-preview-list">
          <button
            v-for="entry in renderedHistoryPreview"
            :key="entry.id"
            type="button"
            class="newtab-history-preview-item w-full flex-align-center gap-75 cursor-pointer color-text-primary border-radius-18px text-left"
            @click="openTarget(entry.url, $event)"
          >
            <span class="newtab-shortcut-avatar flex-inline-align-justify-center color-text-primary flex-0-0-auto txt-weight-strong" :class="`tone-${entry.kind}`">
              {{ entry.monogram }}
            </span>
            <span class="newtab-history-preview-copy flex flex-column flex-1">
              <span class="newtab-history-preview-title block txt-weight-medium">{{ entry.title }}</span>
              <span class="newtab-history-preview-subtitle block">{{ entry.subtitle }}</span>
            </span>
            <span class="newtab-history-preview-time flex-0-0-auto txt-weight-medium margin-left-auto">{{ formatPreviewTime(entry.lastVisitedAt) }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, reactive, ref } from "vue";
import {
  ArrowUpRight,
  Database,
  Globe,
  HardDrive,
  Hexagon,
  History,
  House,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Star,
  Trash2,
  Vote,
  Wallet,
  X,
} from "lucide-vue-next";
import { describeFavouriteUrl } from "../favouriteMeta";
import { FavouriteEntry, useFavourites } from "../favouritesStore";
import { useHistory } from "../historyStore";
import { profilesState } from "../profilesStore";
import { normalizeAddressInput } from "../navigationUrl";

type QuickLink = {
  url: string;
  label: string;
  icon: any;
  requiresProfile?: boolean;
};

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

const quickLinks: QuickLink[] = [
  { url: "lumen://search", label: "Search", icon: Search },
  { url: "lumen://history", label: "History", icon: History },
  { url: "lumen://home", label: "My space", icon: House, requiresProfile: true },
  { url: "lumen://drive", label: "Drive", icon: HardDrive, requiresProfile: true },
  { url: "lumen://wallet", label: "Wallet", icon: Wallet, requiresProfile: true },
  { url: "lumen://extensions", label: "Extensions", icon: Puzzle },
  { url: "lumen://network", label: "Network", icon: Globe },
  { url: "lumen://dao", label: "DAO", icon: Vote },
  { url: "lumen://ipfs", label: "IPFS", icon: Database },
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

function openQuickLink(link: QuickLink, event?: MouseEvent) {
  if (link.requiresProfile && !hasProfiles.value) return;
  openTarget(link.url, event);
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