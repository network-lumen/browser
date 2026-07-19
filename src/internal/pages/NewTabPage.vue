<template>
  <div class="newtab-page internal-page">
    <div
      v-if="showOnboarding"
      class="onboarding-overlay absolute inset-0 flex-align-justify-center padding-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lumen-onboarding-title"
      aria-describedby="lumen-onboarding-desc"
    >
      <div class="onboarding-modal" @click.stop>
        <div class="onboarding-brand flex-align-start gap-100 margin-bottom-100">
          <div class="brand-logo" aria-hidden="true">
            <Hexagon :size="22" />
          </div>
          <div class="onboarding-text">
            <div class="section-kicker">Welcome</div>
            <h2 id="lumen-onboarding-title">Learn what Lumen is</h2>
            <p id="lumen-onboarding-desc">
              Domains, IPFS, gateways and browser-native shortcuts, all in one launch page.
            </p>
          </div>
        </div>

        <div class="onboarding-actions">
          <button class="btn btn-primary" type="button" @click="learnLumen">
            Learn Lumen
          </button>
          <button class="btn btn-secondary" type="button" @click="dismissOnboarding">
            Skip
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showShortcutModal"
        class="shortcut-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        @click.self="closeShortcutModal"
      >
        <div class="shortcut-modal">
          <div class="shortcut-modal-head">
            <div>
              <div class="section-kicker">Shortcut</div>
              <h2 id="shortcut-modal-title">
                {{ shortcutModalMode === "create" ? "Add shortcut" : "Edit shortcut" }}
              </h2>
            </div>
            <button
              class="shortcut-modal-close"
              type="button"
              aria-label="Close shortcut editor"
              @click="closeShortcutModal"
            >
              <X :size="16" />
            </button>
          </div>

          <div class="shortcut-form">
            <label class="shortcut-field flex flex-column gap-35">
              <span>Name</span>
              <input
                v-model="shortcutDraft.title"
                type="text"
                placeholder="Optional custom title"
                maxlength="60"
                @keydown.enter.prevent="submitShortcutModal"
              />
            </label>

            <label class="shortcut-field flex flex-column gap-35">
              <span>URL or Lumen page</span>
              <input
                v-model="shortcutDraft.url"
                type="text"
                placeholder="lumen://home or example.lmn"
                @keydown.enter.prevent="submitShortcutModal"
              />
            </label>

            <label class="shortcut-checkbox">
              <input v-model="shortcutDraft.pinned" type="checkbox" />
              <span>Mark this shortcut as favourite</span>
            </label>

            <div v-if="shortcutError" class="shortcut-error">
              {{ shortcutError }}
            </div>
          </div>

          <div class="shortcut-modal-actions">
            <button class="btn btn-secondary" type="button" @click="closeShortcutModal">
              Cancel
            </button>
            <button class="btn btn-primary" type="button" @click="submitShortcutModal">
              {{ shortcutModalMode === "create" ? "Add shortcut" : "Save changes" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="newtab-backdrop" aria-hidden="true">
      <div class="newtab-glow newtab-glow--left"></div>
      <div class="newtab-glow newtab-glow--right"></div>
    </div>

    <div class="newtab-shell">
      <section class="hero">
        <div class="hero-copy">
          <h1>Search Lumen</h1>
          <p>Open your favourite shortcuts, jump into core pages, or go straight to a domain.</p>
        </div>

        <form class="omnibox" @submit.prevent="submitOmnibox">
          <Search :size="18" class="omnibox-icon" />
          <input
            v-model="commandInput"
            type="text"
            class="omnibox-input"
            placeholder="Search Lumen or enter a URL"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            aria-label="Search Lumen or enter a URL"
          />
          <button class="omnibox-submit" type="submit">
            <ArrowUpRight :size="15" />
            <span>Go</span>
          </button>
        </form>

        <div class="quick-links">
          <button
            v-for="link in quickLinks"
            :key="link.url"
            type="button"
            class="quick-link"
            :disabled="link.requiresProfile && !hasProfiles"
            @click="openQuickLink(link, $event)"
          >
            <component :is="link.icon" :size="14" />
            <span>{{ link.label }}</span>
          </button>
        </div>

        <div v-if="!hasProfiles" class="hero-hint">
          Create a profile from the top-right menu to unlock Drive, Wallet, and your personal
          Lumen space.
        </div>
      </section>

      <section class="shortcuts-panel">
        <div class="shortcuts-head">
          <div>
            <div class="section-kicker">Shortcuts</div>
          </div>

          <div class="shortcuts-head-actions">
            <button class="btn btn-secondary" type="button" @click="beginCreateShortcut">
              <Plus :size="15" />
              <span>Add shortcut</span>
            </button>
          </div>
        </div>

        <div class="shortcut-grid">
          <article
            v-for="entry in renderedFavouriteEntries"
            :key="entry.id"
            class="shortcut-card"
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
            <button class="shortcut-card-main" type="button" @click="openTarget(entry.url, $event)">
              <span class="shortcut-avatar" :class="`tone-${entry.kind}`">
                {{ entry.monogram }}
              </span>
              <span class="shortcut-copy">
                <span class="shortcut-title">{{ entry.title }}</span>
                <span class="shortcut-subtitle">{{ entry.subtitle }}</span>
              </span>
            </button>

            <div class="shortcut-card-actions">
              <button
                class="shortcut-action"
                type="button"
                :title="entry.pinned ? 'Remove from favourites' : 'Mark as favourite'"
                @click.stop="togglePinned(entry.id, entry.pinned)"
              >
                <Star :size="14" :fill="entry.pinned ? 'currentColor' : 'none'" />
              </button>
              <button
                class="shortcut-action"
                type="button"
                title="Edit shortcut"
                @click.stop="beginEditShortcut(entry)"
              >
                <Pencil :size="14" />
              </button>
              <button
                class="shortcut-action shortcut-action--danger"
                type="button"
                title="Remove shortcut"
                @click.stop="removeFavouriteById(entry.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>

          </article>
        </div>

        <div v-if="!renderedFavouriteEntries.length" class="shortcuts-empty">
          <div class="shortcuts-empty-copy">
            <h3>No shortcuts yet</h3>
            <p>
              Star a page from the address bar or create a custom shortcut here. Favourite
              shortcuts stay first.
            </p>
          </div>
        </div>
      </section>

      <section
        v-if="historyEnabled && renderedHistoryPreview.length"
        class="shortcuts-panel history-preview-panel"
      >
        <div class="shortcuts-head">
          <div>
            <div class="section-kicker">Recent</div>
          </div>

          <div class="shortcuts-head-actions">
            <button class="btn btn-secondary" type="button" @click="goto('lumen://history')">
              <History :size="15" />
              <span>Open history</span>
            </button>
          </div>
        </div>

        <div class="history-preview-list">
          <button
            v-for="entry in renderedHistoryPreview"
            :key="entry.id"
            type="button"
            class="history-preview-item"
            @click="openTarget(entry.url, $event)"
          >
            <span class="shortcut-avatar" :class="`tone-${entry.kind}`">
              {{ entry.monogram }}
            </span>
            <span class="history-preview-copy">
              <span class="history-preview-title">{{ entry.title }}</span>
              <span class="history-preview-subtitle">{{ entry.subtitle }}</span>
            </span>
            <span class="history-preview-time">{{ formatPreviewTime(entry.lastVisitedAt) }}</span>
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

<style scoped>
.newtab-page {
  position: relative;
  display: block;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 1.5rem 1rem 2rem;
  background:
    radial-gradient(900px 420px at 50% 0%, var(--primary-a10), transparent 72%),
    radial-gradient(700px 340px at 100% 10%, rgba(var(--ios-indigo-rgb), 0.1), transparent 62%),
    var(--bg-tertiary);
}

.newtab-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.newtab-glow {
  position: absolute;
  width: 28rem;
  height: 28rem;
  border-radius: 999px;
  filter: blur(36px);
  opacity: 0.55;
}

.newtab-glow--left {
  top: -14rem;
  left: -10rem;
  background: rgba(var(--ios-blue-rgb), 0.18);
}

.newtab-glow--right {
  top: 2rem;
  right: -12rem;
  background: rgba(var(--ios-indigo-rgb), 0.12);
}

.newtab-shell {
  position: relative;
  z-index: 1;
  width: min(1040px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hero,
.shortcuts-panel,
.onboarding-modal,
.shortcut-modal {
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--card-bg) 94%, transparent);
  box-shadow:
    0 22px 48px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.hero,
.shortcuts-panel {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 28px;
  padding: 1.15rem;
}

.hero {
  padding: 2.3rem 1.15rem;
}

.hero::before,
.shortcuts-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 25%);
  pointer-events: none;
}

.shortcuts-head,
.shortcut-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.shortcuts-head {
  flex-wrap: wrap;
}

.brand-logo {
  --brand-logo-size: 46px;
  --brand-logo-radius: 15px;
  width: var(--brand-logo-size);
  height: var(--brand-logo-size);
  border-radius: var(--brand-logo-radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
  flex: 0 0 auto;
}

.section-kicker {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  color: var(--accent-primary);
}

.hero-copy {
  max-width: 40rem;
  margin: 0 auto;
  text-align: center;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(2.2rem, 7vw, 4.3rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
  color: var(--text-primary);
}

.hero-copy p {
  margin: 0.85rem auto 0;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.55;
}

.omnibox {
  width: min(760px, 100%);
  margin: 1.2rem auto 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--card-bg) 90%, transparent);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.omnibox:focus-within {
  border-color: var(--primary-a50);
  box-shadow:
    0 14px 30px rgba(15, 23, 42, 0.08),
    0 0 0 4px var(--primary-a12);
}

.omnibox-icon {
  color: var(--text-tertiary);
  flex: 0 0 auto;
}

.omnibox-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 1rem;
}

.omnibox-input::placeholder {
  color: var(--text-tertiary);
}

.omnibox-submit,
.btn,
.shortcut-action,
.quick-link,
.shortcut-modal-close {
  border: none;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.2s ease;
}

.omnibox-submit,
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 999px;
  font-weight: 700;
}

.omnibox-submit {
  padding: 0.78rem 1rem;
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
  flex: 0 0 auto;
}

.btn {
  padding: 0.75rem 1rem;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

.btn-secondary {
  background: var(--fill-tertiary);
  color: var(--text-primary);
}

.btn:hover,
.omnibox-submit:hover,
.shortcut-action:hover,
.quick-link:hover {
  transform: translateY(-1px);
}

.quick-links {
  width: min(980px, 100%);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin: 1rem auto 0;
}

.quick-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.56rem 0.74rem;
  border-radius: 999px;
  background: var(--fill-tertiary);
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 650;
}

.quick-link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.hero-hint {
  width: min(760px, 100%);
  margin: 1rem auto 0;
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(var(--ios-orange-rgb), 0.08);
  border: 1px solid rgba(var(--ios-orange-rgb), 0.14);
  color: var(--text-secondary);
  line-height: 1.45;
  text-align: center;
}

.shortcuts-head h2,
.shortcut-modal-head h2,
.shortcuts-empty h3 {
  margin: 0.2rem 0 0;
  color: var(--text-primary);
  letter-spacing: -0.03em;
}

.shortcuts-head p,
.shortcuts-empty p,
.onboarding-text p {
  margin: 0.4rem 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.shortcut-grid {
  margin-top: 1.1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(196px, 1fr));
  gap: 0.8rem;
}

.shortcut-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 150px;
  padding: 0.9rem;
  border-radius: 22px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--card-bg) 92%, transparent);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
}

.shortcut-card.pinned {
  border-color: rgba(var(--ios-blue-rgb), 0.18);
  box-shadow:
    0 14px 28px rgba(15, 23, 42, 0.06),
    inset 0 0 0 1px rgba(var(--ios-blue-rgb), 0.1);
}

.shortcut-card.is-dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

.shortcut-card.is-drop-target {
  border-color: rgba(var(--ios-blue-rgb), 0.28);
  box-shadow:
    0 16px 32px rgba(15, 23, 42, 0.08),
    inset 0 0 0 2px rgba(var(--ios-blue-rgb), 0.18);
}

.shortcut-card-main {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 0.8rem;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.shortcut-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  border: 1px solid var(--border-light);
  background: var(--fill-tertiary);
  color: var(--text-primary);
}

.shortcut-avatar.tone-search {
  background: rgba(var(--ios-blue-rgb), 0.12);
  color: var(--ios-blue);
  border-color: rgba(var(--ios-blue-rgb), 0.18);
}

.shortcut-avatar.tone-internal {
  background: rgba(var(--ios-indigo-rgb), 0.12);
  color: var(--ios-indigo);
  border-color: rgba(var(--ios-indigo-rgb), 0.18);
}

.shortcut-avatar.tone-web {
  background: rgba(var(--ios-green-rgb), 0.12);
  color: var(--ios-green);
  border-color: rgba(var(--ios-green-rgb), 0.18);
}

.shortcut-avatar.tone-file {
  background: rgba(var(--ios-orange-rgb), 0.12);
  color: var(--ios-orange);
  border-color: rgba(var(--ios-orange-rgb), 0.18);
}

.shortcut-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.shortcut-title,
.shortcut-subtitle {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shortcut-title {
  color: var(--text-primary);
  font-size: 0.95rem;
  font-weight: 760;
  white-space: nowrap;
}

.shortcut-subtitle {
  color: var(--text-tertiary);
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: nowrap;
}

.shortcut-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.shortcut-action {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-tertiary);
  color: var(--text-secondary);
}

.shortcut-action--danger:hover {
  background: rgba(var(--ios-red-rgb), 0.12);
  color: var(--ios-red);
}

.shortcuts-empty {
  margin-top: 1rem;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  border: 1px dashed var(--border-color);
  background: var(--black-a02);
}

.history-preview-panel {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.history-preview-list {
  margin-top: 0.65rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.65rem;
}

.history-preview-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem;
  border-radius: 18px;
  border: 1px solid var(--border-light);
  background: var(--black-a02);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.history-preview-item:hover {
  transform: translateY(-1px);
  background: var(--fill-tertiary);
  border-color: rgba(var(--ios-blue-rgb), 0.14);
}

.history-preview-copy {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.12rem;
}

.history-preview-title,
.history-preview-subtitle {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-preview-title {
  font-weight: 700;
}

.history-preview-subtitle,
.history-preview-time {
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

.history-preview-time {
  flex: 0 0 auto;
  font-weight: 700;
  margin-left: auto;
  padding-left: 0.5rem;
}

.shortcuts-head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: flex-end;
}

.shortcuts-head-actions .btn {
  white-space: nowrap;
}

.onboarding-overlay,
.shortcut-modal-overlay {
  background: rgba(2, 6, 23, 0.56);
  z-index: 20;
}

.shortcut-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.onboarding-modal,
.shortcut-modal {
  width: min(34rem, 100%);
  border-radius: 24px;
  padding: 1.2rem;
}

.shortcut-modal {
  width: min(32rem, 100%);
}

.shortcut-modal-close {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  background: var(--fill-tertiary);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.shortcut-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.shortcut-field span,
.shortcut-checkbox span {
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
}

.shortcut-field input {
  width: 100%;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 0.8rem 0.9rem;
  background: var(--black-a02);
  color: var(--text-primary);
  outline: none;
}

.shortcut-field input:focus {
  border-color: var(--primary-a50);
  box-shadow: 0 0 0 4px var(--primary-a12);
}

.shortcut-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
}

.shortcut-error {
  color: var(--ios-red);
  font-size: 0.84rem;
  font-weight: 600;
}

.shortcut-modal-actions,
.onboarding-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  flex-wrap: wrap;
}

@media (max-width: 1040px) {
  .newtab-page {
    padding-inline: 0.85rem;
  }

  .hero {
    padding: 2rem 1rem;
  }

  .hero-copy {
    max-width: 34rem;
  }

  .quick-links {
    width: min(880px, 100%);
    gap: 0.5rem;
  }
}

@media (max-height: 760px) {
  .newtab-page {
    padding-top: 1rem;
    padding-bottom: 1.25rem;
  }

  .newtab-shell {
    gap: 0.85rem;
  }

  .hero,
  .shortcuts-panel {
    border-radius: 24px;
    padding: 1rem;
  }

  .hero {
    padding: 1.5rem 1rem 1rem;
  }

  .hero-copy {
    max-width: 32rem;
  }

  .hero-copy h1 {
    font-size: clamp(2.3rem, 9vh, 3.7rem);
  }

  .hero-copy p {
    margin-top: 0.6rem;
    font-size: 0.95rem;
  }

  .omnibox {
    margin-top: 0.95rem;
    padding: 0.75rem 0.82rem;
  }

  .quick-links {
    margin-top: 0.75rem;
  }
}

@media (max-height: 680px) {
  .newtab-page {
    padding-top: 0.85rem;
  }

  .hero {
    padding-top: 1.2rem;
    padding-bottom: 0.9rem;
  }

  .hero-copy h1 {
    font-size: clamp(2.05rem, 8vh, 3.2rem);
  }

  .hero-copy p {
    font-size: 0.9rem;
  }

  .omnibox {
    margin-top: 0.8rem;
  }
}

@media (max-width: 1180px) {
  .shortcuts-head-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 900px) {
  .shortcut-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .newtab-page {
    padding: 0.85rem 0.75rem 1.2rem;
  }

  .hero,
  .shortcuts-panel {
    border-radius: 22px;
    padding: 0.95rem;
  }

  .hero {
    padding: 1.9rem 0.95rem;
  }

  .shortcuts-head {
    flex-direction: column;
  }

  .omnibox {
    flex-wrap: wrap;
    border-radius: 24px;
  }

  .omnibox-submit {
    width: 100%;
  }

  .shortcut-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .history-preview-list {
    grid-template-columns: 1fr;
  }

  .history-preview-item {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .history-preview-time {
    width: calc(100% - 3.75rem);
    margin-left: 3.75rem;
    padding-left: 0;
  }

  .shortcut-card {
    min-height: 0;
  }
}

@media (max-width: 520px) {
  .hero-copy h1 {
    font-size: 2.45rem;
  }

  .hero-copy p {
    font-size: 0.92rem;
  }

  .quick-links {
    justify-content: flex-start;
  }

  .quick-link {
    flex: 1 1 calc(50% - 0.5rem);
    justify-content: center;
  }

  .shortcut-grid {
    grid-template-columns: 1fr;
  }

  .shortcut-card-actions {
    justify-content: flex-start;
  }
}
</style>
