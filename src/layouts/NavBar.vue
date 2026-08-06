<template>
  <!-- ####### NavBar TOP BAR (shared across all pages) ####### -->
  <header class="flex-align-center gap-12px py-8px px-12px bg-primary border-bottom-default min-h-48px">
    <!-- Navigation Controls -->
    <div class="flex-align-center gap-4px">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :disabled="!canGoBack"
        title="Back"
        @click="previous" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <ArrowLeft :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" :disabled="!canGoForward"
        title="Forward"
        @click="next" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <ArrowRight :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" v-if="!isExtensionTab"
        :aria-busy="loading ? 'true' : 'false'"
        :disabled="loading"
        :title="loading ? 'Loading…' : 'Refresh'"
        @click="refresh" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <UiSpinner v-if="loading" size="sm" />
        <RefreshCw v-else :size="16" />
      </UiButton>
    </div>

    <!-- URL Bar -->
    <div class="appregion-no-drag flex-align-center flex-1 relative min-w-0">
      <Search :size="15" stroke-width="2" class="color-text-tertiary absolute cursor-events-none left-12px" />
      <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-13px" padding-class="pt-8px pr-48px pb-8px pl-40px" :focus-ring="false" :value="urlField"
        @input="onInput"
        placeholder="Search or enter a URL"
        @keydown.enter="onEnter" class="navbar-url-bar-input border-default focus-outline-none focus-bg-primary focus-ring focus-shadow placeholder-tertiary" />
      <UiButton
        variant="icon"
        icon-radius-class="border-radius-8px"
        icon-padding-class=""
        class="flex-inline-align-justify-center size-28px color-text-tertiary absolute top-half translate-y-center right-6px"
        :class="{ 'color-yellow-override': favActive }"
        :title="favActive ? 'Remove from shortcuts' : 'Add to shortcuts'"
        :aria-label="favActive ? 'Remove from shortcuts' : 'Add to shortcuts'"
        :aria-pressed="favActive ? 'true' : 'false'"
        @mousedown.prevent
        @click="onToggleFavourite"
      >
        <Star :size="16" :fill="favActive ? 'currentColor' : 'none'" />
      </UiButton>
    </div>

    <!-- Quick Actions -->
    <div class="flex-align-center gap-4px">
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" title="Home"
        @click="$emit('goto', 'lumen://home')" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <House :size="16" />
      </UiButton>
      <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" title="Drive"
        @click="$emit('goto', 'lumen://drive')" class="active-scale-98 disabled-opacity-35-not-allowed flex-inline-align-justify-center size-32px">
        <Cloud :size="16" />
      </UiButton>
    </div>

    <div class="appregion-no-drag relative ml-n8px">
      <UiButton
        variant="icon"
        icon-radius-class="border-radius-10px"
        icon-padding-class=""
        class="active-scale-98 disabled-opacity-35-not-allowed extensions-trigger flex-inline-align-justify-center size-32px"
        :class="{ 'color-yellow-override': showExtensionsMenu }"
        title="Extensions"
        @click.stop="toggleExtensionsMenu"
      >
        <Puzzle :size="16" />
      </UiButton>

      <UiCard padding="none" :shadow="false" v-if="showExtensionsMenu" role="menu" class="navbar-extensions-menu absolute p-8px shadow-xl z-100 right-0 w-340px max-w-min-92vw-340px calc-top-100-6px">
        <div class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em p-0px pr-8px pb-8px pl-8px">Extensions</div>

        <div v-if="extensions.length" class="flex flex-column gap-6px overflow-y-auto pr-4px max-h-280px">
          <div
            v-for="ext in extensions"
            :key="ext.id"
            class="flex-align-start gap-10px p-10px border-radius-12px bg-secondary border-05-light"
          >
            <div class="flex-1 min-w-0">
              <div class="text-13px txt-weight-light color-text-primary truncate">{{ ext.name }}</div>
              <div class="flex-align-center flex-wrap-wrap gap-6px mt-4px">
                <span class="text-11px color-text-tertiary" :class="{ 'color-error': !!ext.lastError, disabled: !ext.enabled }">
                  {{ extensionStateLabel(ext) }}
                </span>
                <span v-if="ext.version" class="text-11px color-text-tertiary">v{{ ext.version }}</span>
              </div>
              <div v-if="ext.lastError" class="color-error text-11px mt-4px break-word line-height-14">{{ ext.lastError }}</div>
            </div>

            <div class="flex-align-center gap-6px">
              <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" type="button"
                title="Open extension"
                :disabled="extensionsBusy || !ext.enabled || !ext.launchUrl"
                @click.stop="openExtension(ext)" class="flex-inline-align-justify-center disabled-fade-50 size-28px">
                <ExternalLink :size="14" />
              </UiButton>

              <UiToggle
                size="sm"
                :title="ext.enabled ? 'Disable extension' : 'Enable extension'"
                :model-value="ext.enabled"
                :disabled="extensionsBusy"
                @update:model-value="toggleExtensionEnabled(ext)"
              />

              <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" type="button"
                title="Reload extension"
                :disabled="extensionsBusy || !ext.enabled"
                @click.stop="reloadExtension(ext.id)" class="flex-inline-align-justify-center disabled-fade-50 size-28px">
                <RefreshCw :size="14" />
              </UiButton>

              <UiButton variant="danger" type="button"
                title="Remove extension"
                :disabled="extensionsBusy"
                @click.stop="removeExtension(ext.id)" class="flex-inline-align-justify-center disabled-fade-50 size-28px navbar-extension-remove-btn">
                <Trash2 :size="14" />
              </UiButton>
            </div>
          </div>
        </div>

        <div v-else class="text-center text-12px color-text-tertiary py-14px px-8px">
          No extensions installed yet.
        </div>

        <div class="flex flex-column gap-8px mt-8px pt-8px border-top-05-border-light">
          <UiMenuItem :disabled="extensionsBusy" @click.stop="loadUnpackedExtension">
            Load unpacked extension
          </UiMenuItem>

          <UiButton variant="primary" type="button"
            :disabled="extensionsBusy"
            @click.stop="openChromeWebStore" class="disabled-fade-50 transition-bg-fast">
            <span>Import from Chrome Web Store</span>
            <ExternalLink :size="13" />
          </UiButton>

          <div v-if="extensionsMessage" class="text-12px color-text-tertiary py-0px px-2px">
            {{ extensionsMessage }}
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Profile -->
    <div class="appregion-no-drag relative">
      <UiButton variant="secondary" size="xs" type="button" :title="activeProfileDisplay" @click.stop="toggleProfileMenu" class="navbar-profile-trigger border-radius-full border-none">
        <ProfileAvatar :profile="activeProfile" :size="24" :title="activeProfileDisplay" />
        <span class="text-13px fw-500 color-text-primary truncate max-w-100px">{{ activeProfileDisplay }}</span>
        <ChevronDown :size="14" class="color-text-tertiary ml-n2px" />
      </UiButton>

      <UiCard padding="none" :shadow="false" v-if="showProfileMenu"
        role="menu" class="navbar-profile-menu absolute p-8px shadow-xl z-100 right-0 min-w-260px max-w-300px calc-top-100-6px">
        <ActiveProfileCard
          v-if="activeProfile"
          :profile="activeProfile"
          dense
          :label="isGuestOnly ? 'Guest mode' : 'Active profile'"
        />

        <div v-if="hasProfiles && !isGuestOnly">
          <div class="text-11px txt-weight-light color-text-tertiary text-uppercase mt-8px letter-spacing-005em py-0px px-8px mb-4px">Profiles</div>
          <ul class="flex flex-column p-0px m-0px gap-2px list-style-none overflow-y-auto max-h-200px">
            <li
              v-for="p in profiles"
              :key="p.id"
              class="reveal-on-hover hover-bg-hover flex-align-center border-radius-10px gap-6px p-4px"
              :class="{ 'bg-primary-a10': p.id === activeProfileId }"
              role="menuitem"
            >
              <UiButton variant="none" type="button" @click.stop="selectProfile(p.id)" class="flex-1 flex-align-center gap-6px border-none bg-transparent cursor-pointer color-text-primary text-13px fw-500 border-radius-10px py-4px px-8px transition-all-fast text-left w-full min-w-0">
                <ProfileAvatar :profile="p" :size="26" :title="p.name || p.id" />
                <span class="text-13px fw-500 color-text-primary truncate">{{ p.name || p.id }}</span>
              </UiButton>

              <button type="button" class="reveal-target hover-bg-error-a10-color-error h-24px flex-inline-align-justify-center border-radius-10px cursor-pointer color-text-tertiary border-none bg-transparent transition-all-fast opacity-0 w-24px" title="Delete profile" @click.stop="requestDeleteProfile(p)">
                <Trash2 :size="14" />
              </button>
            </li>
          </ul>
        </div>

        <div v-else class="text-12px color-text-tertiary text-center p-0px pt-12px pr-8px pb-12px pl-8px">
          {{ isGuestOnly
            ? 'Guest mode active. Create or import a profile to get started.'
            : 'No profiles yet.' }}
        </div>

        <div class="flex flex-column gap-2px mt-8px pt-8px border-top-05-border-light">
          <UiMenuItem @click.stop="onCreateProfileClick">
            New profile…
          </UiMenuItem>
          <UiMenuItem :disabled="!activeProfileId" @click.stop="onExportProfile">
            Export active profile…
          </UiMenuItem>
          <UiMenuItem @click.stop="onImportProfileClick">
            Import profile…
          </UiMenuItem>

          <div v-if="creatingProfile" class="flex flex-column mt-8px pt-8px gap-6px border-top-05-border-light">
            <UiInput bg-class="bg-fill-primary" radius-class="border-radius-10px" font-size-class="text-13px" padding-class="py-8px px-10px" :focus-ring="false" v-model="newProfileName" placeholder="Profile name" class="fw-500 border-default focus-outline-none focus-bg-fill-primary placeholder-tertiary-a60" />
            <div class="flex gap-6px">
              <UiButton variant="primary" class="flex-1" @click="confirmCreateProfile">
                Create
              </UiButton>
              <UiButton variant="secondary" class="flex-1" @click="cancelCreateProfile">
                Cancel
              </UiButton>
            </div>
          </div>

          <div v-if="profileMessage" class="mt-8px text-12px color-text-tertiary py-4px px-6px">
            {{ profileMessage }}
          </div>
        </div>
      </UiCard>
    </div>
  </header>

  <!-- ####### NavBar EXPORT OPTIONS MODAL ####### -->
  <ExportProfileDialog :model-value="showExportModal" :password="exportPassword" :password-confirm="exportPasswordConfirm" :encrypted="exportEncrypted" :requires-password="exportRequiresPassword" :error="exportError" @update:model-value="cancelExportModal" @update:password="exportPassword = $event" @update:password-confirm="exportPasswordConfirm = $event" @update:encrypted="exportEncrypted = $event" @submit="confirmExportProfile" />

  <!-- ####### NavBar IMPORT MODAL ####### -->
  <ImportProfileDialog :model-value="showImportModal" :mode="importMode" :form="manualImportForm" :error="importModalError" :busy="importBusy" @update:model-value="cancelImportModal" @update:mode="setImportMode" @update:field="setManualImportField" @pick-profile-source="loadManualProfileSourceIntoForm" @pick-pqc-source="loadManualPqcSourceIntoForm" @submit="importMode === 'file' ? startFileImport() : confirmManualImport()" />

  <!-- ####### NavBar IMPORT PASSWORD MODAL (encrypted backups) ####### -->
  <ImportPasswordDialog :model-value="showImportPasswordModal" :password="importPassword" :error="importError" @update:model-value="cancelImportPasswordModal" @update:password="importPassword = $event" @submit="confirmImportEncrypted" />

  <!-- Delete Profile Confirm Modal -->
  <ConfirmDialog
    :model-value="showDeleteProfileModal"
    title="Delete profile?"
    panel-class="min-w-360px max-w-90vw"
    button-class="flex-1"
    confirm-label="Delete"
    @update:model-value="cancelDeleteProfileModal"
    @confirm="confirmDeleteProfile"
  >
    <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
      You are about to permanently delete <strong>{{ pendingDeleteProfileName }}</strong>.
      This cannot be recovered.
    </p>
  </ConfirmDialog>

  <!-- PQC Link Notice -->
  <PqcLinkedDialog :model-value="showPqcLinkedModal" :profile-name="pqcLinkedProfileDisplay" @dismiss="dismissPqcLinkedModal" @export="exportAfterPqcLinked" />
</template>

<script setup lang="ts">
import UiInput from '../ui/UiInput.vue';
import UiCard from '../ui/UiCard.vue';
import ConfirmDialog from '../dialogs/ConfirmDialog.vue';
import PqcLinkedDialog from '../dialogs/PqcLinkedDialog.vue';
import ImportPasswordDialog from '../dialogs/ImportPasswordDialog.vue';
import ImportProfileDialog from '../dialogs/ImportProfileDialog.vue';
import ExportProfileDialog from '../dialogs/ExportProfileDialog.vue';
import { computed,  onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, RefreshCw, Search, House, Cloud, Trash2, Star, ChevronDown, Puzzle, ExternalLink } from 'lucide-vue-next';
import ActiveProfileCard from '../components/ActiveProfileCard.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiToggle from '../ui/UiToggle.vue';
import UiMenuItem from '../ui/UiMenuItem.vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import {
  profilesState,
  activeProfileId,
  setActiveProfile,
  createProfile,
  deleteProfile,
  initProfiles,
  exportProfileBackup,
  importProfilesFromBackup,
  importProfileManually,
  pickManualProfileSource,
  pickManualPqcSource
} from '../internal/profilesStore';
import { useFavourites } from '../internal/favouritesStore';
import { buildExtensionTabUrl, normalizeAddressInput } from '../internal/navigationUrl';
import type { Ref } from 'vue';
import type { Tab } from '../types/tab';
import type { NavBarExtensionSummary, NavBarImportMode , ManualImportForm } from '../types/navBar';
import { clamp, errorMessage } from '../internal/services/coerce';

import { useTabNavigation } from '../composables/useTabNavigation';
import { isPasswordLongEnough } from '../internal/services/passwordPolicy';
const props = defineProps<{
  tabActive: string;
  tabs: Tab[];
  loading: boolean;
  currentUrl?: string;
  isExtensionTab?: boolean;
}>();

const emit = defineEmits<{
  (e: 'goto', url: string): void;
  (e: 'history-step', payload: { delta: number }): void;
  (e: 'refresh-request'): void;
  (e: 'openSettings'): void;
}>();

const urlField = ref('');
const { toggleFavourite, isFav } = useFavourites();
const favActive = computed(() => {
  if (props.currentUrl == null) return false;
  return isFav(props.currentUrl);
});
function onToggleFavourite() {
  if (props.currentUrl == null) return;
  toggleFavourite(props.currentUrl, { title: currentHistoryTitle.value });
}
const showProfileMenu = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const profileMessage = ref('');

const { openInNewTab, openExtensionPopup } = useTabNavigation();
const showExtensionsMenu = ref(false);
const extensions = ref<NavBarExtensionSummary[]>([]);
const extensionsBusy = ref(false);
const extensionsMessage = ref('');

// Export modal state
const showExportModal = ref(false);
const exportEncrypted = ref(false);
const exportRequiresPassword = ref(false); // true if keystore/pqc is password-protected
const exportPassword = ref('');
const exportPasswordConfirm = ref('');
const exportError = ref('');

const showImportModal = ref(false);
const importMode = ref<NavBarImportMode>('file');
const importBusy = ref(false);
const importModalError = ref('');
const manualImportName = ref('');
const manualImportMnemonic = ref('');
const manualImportPqcPublicKey = ref('');
const manualImportPqcPrivateKey = ref('');
const manualImportProfileSourceName = ref('');
const manualImportPqcSourceName = ref('');

/** The six manual-import refs as one object, for the dialog that presents them. */
const manualImportForm = computed<ManualImportForm>(() => ({
  name: manualImportName.value,
  mnemonic: manualImportMnemonic.value,
  pqcPublicKey: manualImportPqcPublicKey.value,
  pqcPrivateKey: manualImportPqcPrivateKey.value,
  profileSourceName: manualImportProfileSourceName.value,
  pqcSourceName: manualImportPqcSourceName.value
}));

const MANUAL_IMPORT_REFS: Record<keyof ManualImportForm, Ref<string>> = {
  name: manualImportName,
  mnemonic: manualImportMnemonic,
  pqcPublicKey: manualImportPqcPublicKey,
  pqcPrivateKey: manualImportPqcPrivateKey,
  profileSourceName: manualImportProfileSourceName,
  pqcSourceName: manualImportPqcSourceName
};

function setManualImportField(field: keyof ManualImportForm, value: string) {
  MANUAL_IMPORT_REFS[field].value = value;
}

// Import encrypted modal state
const showImportPasswordModal = ref(false);
const importPassword = ref('');
const importError = ref('');
const pendingEncryptedFile = ref<string | null>(null);

// Delete confirmation modal state
const showDeleteProfileModal = ref(false);
const pendingDeleteProfileId = ref('');
const pendingDeleteProfileName = ref('');

// PQC link notice state
const showPqcLinkedModal = ref(false);
const pqcLinkedProfileId = ref('');
const pqcLinkedSeen = new Set<string>();

const profiles = profilesState;

const hasProfiles = computed(() => profiles.value.length > 0);

const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const isGuestOnly = computed(
  () => activeProfile.value?.role === 'guest' && profiles.value.length === 1
);

const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || 'Profile'
);

const pqcLinkedProfileDisplay = computed(() => {
  const id = String(pqcLinkedProfileId.value || '').trim();
  if (!id) return 'your profile';
  const p = profiles.value.find((x) => String(x?.id || '') === id) || null;
  return String(p?.name || p?.id || id);
});

const activeTab = computed<Tab | null>(() => {
  const found = props.tabs.find((t) => t.id === props.tabActive) ?? null;
  return found;
});

const currentHistoryTitle = computed(() => {
  const tab = activeTab.value;
  if (!tab || !Array.isArray(tab.history) || !tab.history.length) return "";
  const position = Number.isFinite(Number(tab.history_position))
    ? clamp(tab.history_position, 0, tab.history.length - 1)
    : tab.history.length - 1;
  return String(tab.history[position]?.title || "").trim();
});

const canGoBack = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos > 0;
});

const canGoForward = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos < t.history.length - 1;
});

const loading = computed(() => props.loading);
const isExtensionTab = computed(() => !!props.isExtensionTab);

// Sync displayed URL with current tab URL
watch(
  () => [props.currentUrl, props.tabActive],
  ([val]) => {
    const v = String(val || '');
    if (urlField.value !== v) urlField.value = v;
  },
  { immediate: true }
);

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value;
  urlField.value = value;

  // simpan draft ke tab aktif
  const tab = props.tabs.find(t => t.id === props.tabActive);
  if (tab) {
    tab.draftUrl = value;
  }
}

function previous() {
  if (!canGoBack.value) return;
  emit('history-step', { delta: -1 });
  try {
    window.dispatchEvent(
      new CustomEvent('lumen:tab-history-step', {
        detail: { delta: -1, tabId: props.tabActive },
      })
    );
  } catch {
    // ignore
  }
}

function next() {
  if (!canGoForward.value) return;
  emit('history-step', { delta: 1 });
  try {
    window.dispatchEvent(
      new CustomEvent('lumen:tab-history-step', {
        detail: { delta: 1, tabId: props.tabActive },
      })
    );
  } catch {
    // ignore
  }
}

function refresh() {
  emit('refresh-request');
}

function normalizeInput(raw: string): string {
  const builtin = [
    'home',
    'search',
    'drive',
    'wallet',
    'extensions',
    'network',
    'settings',
    'help',
    'domain',
    'ipfs',
    'gateways',
    'release',
    'newtab',
  ];
  return normalizeAddressInput(raw, builtin);
}

function onEnter() {
  const raw = urlField.value;
  const target = normalizeInput(raw || '');

  const tab = props.tabs.find(t => t.id === props.tabActive);
  if (tab) {
    tab.draftUrl = undefined; // 🔥 clear draft
  }

  urlField.value = target;
  emit('goto', target);
}

function resetProfileUi() {
  creatingProfile.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
}

function normalizeExtensionPayload(payload: any): NavBarExtensionSummary[] {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.extensions)
      ? payload.extensions
      : [];
  return items
    .map((entry: any) => ({
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || 'Unnamed extension').trim() || 'Unnamed extension',
      version: String(entry?.version || '').trim(),
      enabled: !!entry?.enabled,
      loaded: !!entry?.loaded,
      lastError: String(entry?.lastError || '').trim(),
      launchUrl: String(entry?.launchUrl || '').trim()
    }))
    .filter((entry: NavBarExtensionSummary) => !!entry.id)
    .sort((a: NavBarExtensionSummary, b: NavBarExtensionSummary) => a.name.localeCompare(b.name));
}

async function refreshExtensions() {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== 'function') return;
    const result = await api.listExtensions();
    if (result?.ok === false) {
      extensionsMessage.value = result?.error || 'Failed to load extensions.';
      return;
    }
    extensions.value = normalizeExtensionPayload(result);
  } catch {
    extensionsMessage.value = 'Failed to load extensions.';
  }
}

function extensionStateLabel(ext: NavBarExtensionSummary) {
  if (ext.lastError) return 'Unavailable';
  if (!ext.enabled) return 'Disabled';
  if (ext.loaded) return 'Enabled';
  return 'Pending';
}

function toggleExtensionsMenu() {
  showExtensionsMenu.value = !showExtensionsMenu.value;
  if (showExtensionsMenu.value) {
    extensionsMessage.value = '';
    void refreshExtensions();
  }
}

async function runExtensionAction(action: () => Promise<any>, successMessage = '') {
  if (extensionsBusy.value) return;
  extensionsBusy.value = true;
  extensionsMessage.value = '';
  try {
    const result = await action();
    if (!result || result.ok === false) {
      const errorMessage = String(result?.error || '').trim();
      extensionsMessage.value = errorMessage;
      return;
    }
    if (successMessage) {
      extensionsMessage.value = successMessage;
    }
    if (result?.extension || result?.extensions) {
      await refreshExtensions();
    }
  } catch (error) {
    extensionsMessage.value = errorMessage(error, '').trim();
  } finally {
    extensionsBusy.value = false;
  }
}

async function loadUnpackedExtension() {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.loadUnpacked !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.loadUnpacked();
    if (result?.canceled) {
      return { ok: false, error: '' };
    }
    return result;
  }, 'Extension loaded.');
}

async function toggleExtensionEnabled(ext: NavBarExtensionSummary) {
  const api = useInternalLumen()?.extensions;
  if (!api) return;
  if (ext.enabled) {
    await runExtensionAction(() => api.disableExtension(ext.id), 'Extension disabled.');
  } else {
    await runExtensionAction(() => api.enableExtension(ext.id), 'Extension enabled.');
  }
}

async function reloadExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.reloadExtension !== 'function') return;
  await runExtensionAction(() => api.reloadExtension(id), 'Extension reloaded.');
}

async function removeExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.removeExtension !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.removeExtension(id);
    if (result?.ok) {
      extensions.value = extensions.value.filter((entry) => entry.id !== id);
    }
    return result;
  }, 'Extension removed.');
}

async function openExtension(ext: NavBarExtensionSummary) {
  if (!ext?.enabled) return;
  showExtensionsMenu.value = false;
  if (typeof openExtensionPopup === 'function') {
    openExtensionPopup({
      extensionId: ext.id,
      name: String(ext?.name || '').trim(),
      targetUrl: String(ext?.launchUrl || '').trim(),
      userGesture: true,
    });
    return;
  }
  const target = buildExtensionTabUrl(ext.id, { name: String(ext?.name || '').trim() });
  if (typeof openInNewTab === 'function') {
    openInNewTab(target);
    return;
  }
  emit('goto', target);
}

function openChromeWebStore() {
  showExtensionsMenu.value = false;
  emit('goto', 'lumen://extensions');
}

function toggleProfileMenu() {
  showProfileMenu.value = !showProfileMenu.value;
  if (!showProfileMenu.value) {
    resetProfileUi();
  }
}

function selectProfile(id: string) {
  setActiveProfile(id);
  showProfileMenu.value = false;
  resetProfileUi();
}

function onCreateProfileClick() {
  creatingProfile.value = true;
  profileMessage.value = '';
  newProfileName.value = '';
}

async function onExportProfile() {
  const id = activeProfileId.value;
  if (!id) return;
  
  // Check if profile requires password to decrypt data
  exportRequiresPassword.value = false;
  try {
    const api = useInternalLumen()?.profiles;
    if (api?.checkExportRequiresPassword) {
      const check = await api.checkExportRequiresPassword(id);
      if (check?.ok && check.requiresPassword) {
        exportRequiresPassword.value = true;
      }
    }
  } catch (e) {
    console.error('[NavBar] checkExportRequiresPassword error:', e);
  }

  // Show export options modal
  showExportModal.value = true;
  exportEncrypted.value = false;
  exportPassword.value = '';
  exportPasswordConfirm.value = '';
  exportError.value = '';
}

function cancelExportModal() {
  showExportModal.value = false;
  exportEncrypted.value = false;
  exportRequiresPassword.value = false;
  exportPassword.value = '';
  exportPasswordConfirm.value = '';
  exportError.value = '';
}

async function confirmExportProfile() {
  const id = activeProfileId.value;
  if (!id) return;
  
  // Password is required if:
  // 1. User wants encrypted output, OR
  // 2. Profile data is password-protected (needs password to decrypt)
  const needsPassword = exportEncrypted.value || exportRequiresPassword.value;
  
  // Validate password
  if (needsPassword) {
    if (!exportPassword.value) {
      exportError.value = exportRequiresPassword.value 
        ? 'Password is required to decrypt your wallet data for export.'
        : 'Password is required for encrypted export.';
      return;
    }
    if (!isPasswordLongEnough(exportPassword.value)) {
      exportError.value = 'Password must be at least 6 characters.';
      return;
    }
    // Only require confirm if encrypting output AND NOT using existing wallet password
    // (when exportRequiresPassword is true, user is entering their existing wallet password)
    if (exportEncrypted.value && !exportRequiresPassword.value && exportPassword.value !== exportPasswordConfirm.value) {
      exportError.value = 'Passwords do not match.';
      return;
    }
  }
  
  exportError.value = '';
  
  try {
    // Always pass password if user entered one (either for decryption or encryption)
    // Don't rely on needsPassword flag - if there's a password entered, send it
    const password = exportPassword.value && isPasswordLongEnough(exportPassword.value) ? exportPassword.value : undefined;
    
    // encryptOutput is true when user explicitly wants to encrypt the backup file
    const encryptOutput = exportEncrypted.value;

    const res = await exportProfileBackup(id, password, encryptOutput);

    if (!res.ok) {
      // Handle specific error messages
      if (res.error === 'invalid_password') {
        exportError.value = 'Incorrect password. Please try again.';
        return;
      }
      if (res.error === 'password_required_for_export') {
        exportError.value = 'Password is required to decrypt wallet data.';
        exportRequiresPassword.value = true;
        return;
      }
      if (res.error === 'backup_api_unavailable') {
        exportError.value = 'Export API not available';
        return;
      }
      exportError.value = res.error || 'Backup export failed.';
      return;
    }
    
    cancelExportModal();
    profileMessage.value = res.path
      ? `Backup ${exportEncrypted.value ? '(encrypted) ' : ''}created at: ${res.path}`
      : 'Backup folder created for this profile.';
  } catch (e) {
    exportError.value = errorMessage(e, 'Backup export failed.');
  }
}

function onImportProfileClick() {
  showImportModal.value = true;
  importMode.value = 'file';
  importBusy.value = false;
  importModalError.value = '';
  manualImportName.value = '';
  manualImportMnemonic.value = '';
  manualImportPqcPublicKey.value = '';
  manualImportPqcPrivateKey.value = '';
  manualImportProfileSourceName.value = '';
  manualImportPqcSourceName.value = '';
}

function cancelImportModal() {
  showImportModal.value = false;
  importBusy.value = false;
  importModalError.value = '';
  manualImportName.value = '';
  manualImportMnemonic.value = '';
  manualImportPqcPublicKey.value = '';
  manualImportPqcPrivateKey.value = '';
  manualImportProfileSourceName.value = '';
  manualImportPqcSourceName.value = '';
}

function setImportMode(mode: NavBarImportMode) {
  importMode.value = mode;
  importModalError.value = '';
}

function getImportErrorMessage(error?: string) {
  const code = String(error || '').trim();
  if (!code) return 'Import failed.';
  if (code === 'backup_api_unavailable') return 'Import API not available.';
  if (code === 'missing_profile_name') return 'Profile name is required.';
  if (code === 'missing_mnemonic') return 'Mnemonic is required.';
  if (code === 'invalid_mnemonic') return 'Invalid mnemonic. Check the words and try again.';
  if (code === 'pqc_keys_incomplete') {
    return 'Enter both PQC public and private keys, or leave both empty.';
  }
  if (code === 'password_required') {
    return 'Unlock the app first to import PQC keys.';
  }
  if (code === 'invalid_password') {
    return 'Unlock the app with the correct password to import PQC keys.';
  }
  if (code === 'invalid_profile_backup') {
    return 'The selected profile backup file is invalid or unsupported.';
  }
  if (code === 'encrypted_backup_source_unsupported') {
    return 'Encrypted backups cannot prefill manual import. Use Via file instead.';
  }
  if (code === 'mnemonic_missing_in_selected_file') {
    return 'The selected file does not contain a mnemonic.';
  }
  if (code === 'pqc_missing_in_selected_file') {
    return 'The selected file does not contain Dilithium key material.';
  }
  if (code === 'invalid_pqc_backup') {
    return 'The selected Dilithium backup is invalid or unsupported.';
  }
  if (code === 'no_valid_backups_found') return 'No valid backup file was found.';
  if (code === 'profile_json_missing') return 'No profile backup file was found.';
  return code;
}

async function startFileImport() {
  if (importBusy.value) return;

  importBusy.value = true;
  importModalError.value = '';

  try {
    const result = await importProfilesFromBackup();
    if (result.ok) {
      cancelImportModal();
      profileMessage.value = `Imported ${result.imported || 1} profile(s) from backup.`;
      return;
    }

    if (result.error === 'encrypted_backup_found' && result.encryptedFiles?.length) {
      pendingEncryptedFile.value = result.encryptedFiles[0];
      importPassword.value = '';
      importError.value = '';
      cancelImportModal();
      showImportPasswordModal.value = true;
      return;
    }

    if (result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error || 'Backup import failed.');
    }
  } catch {
    importModalError.value = 'Backup import failed.';
  } finally {
    importBusy.value = false;
  }
}

async function loadManualProfileSourceIntoForm() {
  if (importBusy.value) return;

  importModalError.value = '';
  const result = await pickManualProfileSource();
  if (!result.ok) {
    if (result.error && result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error);
    }
    return;
  }

  if (result.name) {
    manualImportName.value = result.name;
  }
  if (result.mnemonic) {
    manualImportMnemonic.value = result.mnemonic;
  }
  if (result.pqcPublicKey && result.pqcPrivateKey) {
    manualImportPqcPublicKey.value = result.pqcPublicKey;
    manualImportPqcPrivateKey.value = result.pqcPrivateKey;
    manualImportPqcSourceName.value = result.fileName
      ? `${result.fileName} (embedded PQC)`
      : 'Embedded PQC';
  }
  manualImportProfileSourceName.value = result.fileName || 'Loaded profile backup';
}

async function loadManualPqcSourceIntoForm() {
  if (importBusy.value) return;

  importModalError.value = '';
  const result = await pickManualPqcSource();
  if (!result.ok) {
    if (result.error && result.error !== 'canceled') {
      importModalError.value = getImportErrorMessage(result.error);
    }
    return;
  }

  manualImportPqcPublicKey.value = String(result.pqcPublicKey || '');
  manualImportPqcPrivateKey.value = String(result.pqcPrivateKey || '');
  manualImportPqcSourceName.value = result.fileName || 'Loaded Dilithium backup';
}

async function confirmManualImport() {
  if (importBusy.value) return;

  const name = manualImportName.value.trim();
  const mnemonic = manualImportMnemonic.value.trim().replace(/\s+/g, ' ');
  const pqcPublicKey = manualImportPqcPublicKey.value.trim();
  const pqcPrivateKey = manualImportPqcPrivateKey.value.trim();

  if (!name) {
    importModalError.value = 'Profile name is required.';
    return;
  }

  if (!mnemonic) {
    importModalError.value = 'Mnemonic is required.';
    return;
  }

  if ((pqcPublicKey && !pqcPrivateKey) || (!pqcPublicKey && pqcPrivateKey)) {
    importModalError.value = 'Enter both PQC public and private keys, or leave both empty.';
    return;
  }

  importBusy.value = true;
  importModalError.value = '';

  try {
    const result = await importProfileManually({
      name,
      mnemonic,
      pqcPublicKey,
      pqcPrivateKey,
    });

    if (!result.ok) {
      importModalError.value = getImportErrorMessage(result.error);
      return;
    }

    cancelImportModal();
    profileMessage.value =
      pqcPublicKey && pqcPrivateKey
        ? 'Profile imported manually.'
        : 'Profile imported manually. PQC keys will be generated automatically when needed.';
  } catch {
    importModalError.value = 'Manual import failed.';
  } finally {
    importBusy.value = false;
  }
}

function cancelImportPasswordModal() {
  showImportPasswordModal.value = false;
  importPassword.value = '';
  importError.value = '';
  pendingEncryptedFile.value = null;
}

async function confirmImportEncrypted() {
  if (!pendingEncryptedFile.value || !importPassword.value) {
    importError.value = 'Password is required.';
    return;
  }

  importError.value = '';

  try {
    const api = useInternalLumen()?.profiles;
    if (!api || typeof api.importEncryptedBackup !== 'function') {
      importError.value = 'Import API not available.';
      return;
    }

    const res = await api.importEncryptedBackup(pendingEncryptedFile.value, importPassword.value);
    
    if (res && res.ok) {
      cancelImportPasswordModal();
      await initProfiles();
      profileMessage.value = 'Encrypted profile imported successfully.';
    } else if (res?.error === 'invalid_password') {
      importError.value = 'Invalid password. Please try again.';
    } else {
      importError.value = res?.error || 'Import failed.';
    }
  } catch (e) {
    importError.value = errorMessage(e, 'Import failed.');
  }
}

async function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    profileMessage.value = 'Profile name is required.';
    return;
  }
  try {
    const created = await createProfile(name);
    if (created) {
      creatingProfile.value = false;
      profileMessage.value = 'Profile created.';
    } else {
      profileMessage.value = 'Failed to create profile. (No profile returned)';
      console.error('[NavBar] Failed to create profile: createProfile returned null or undefined');
    }
  } catch (e) {
    profileMessage.value = 'Error creating profile: ' + errorMessage(e, 'Unknown error');
    console.error('[NavBar] Error creating profile:', e);
  }
}

function cancelCreateProfile() {
  creatingProfile.value = false;
  newProfileName.value = '';
}

function requestDeleteProfile(p: any) {
  const id = String(p && p.id ? p.id : '').trim();
  if (!id) return;
  pendingDeleteProfileId.value = id;
  pendingDeleteProfileName.value = String(p && (p.name || p.id) ? (p.name || p.id) : id);
  showDeleteProfileModal.value = true;
}

function cancelDeleteProfileModal() {
  showDeleteProfileModal.value = false;
  pendingDeleteProfileId.value = '';
  pendingDeleteProfileName.value = '';
}

function dismissPqcLinkedModal() {
  showPqcLinkedModal.value = false;
  pqcLinkedProfileId.value = '';
}

async function exportAfterPqcLinked() {
  const id = String(pqcLinkedProfileId.value || activeProfileId.value || '').trim();
  dismissPqcLinkedModal();
  if (!id) return;
  if (id !== activeProfileId.value) {
    await setActiveProfile(id);
  }
  await onExportProfile();
}

async function confirmDeleteProfile() {
  const id = String(pendingDeleteProfileId.value || '').trim();
  if (!id) return;

  const res = await deleteProfile(id);
  if (!res || res.ok !== true) {
    const err = String((res as any)?.error || 'delete_failed');
    if (err === 'password_required') {
      profileMessage.value = 'Unlock your wallet to delete this profile.';
    } else {
      profileMessage.value = 'Failed to delete profile.';
    }
    return;
  }

  cancelDeleteProfileModal();
  profileMessage.value = 'Profile deleted.';
}

function onGlobalClick(e: MouseEvent) {
  if (
    showExportModal.value ||
    showImportModal.value ||
    showImportPasswordModal.value ||
    showDeleteProfileModal.value ||
    showPqcLinkedModal.value
  ) {
    return;
  }

  const el = e.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.extensions-trigger') || el.closest('.navbar-extensions-menu')) return;
  if (el.closest('.navbar-profile-trigger') || el.closest('.navbar-profile-menu')) return;
  showExtensionsMenu.value = false;
  showProfileMenu.value = false;
  resetProfileUi();
}

let detachPqcLinkedListener: null | (() => void) = null;
let detachExtensionsListener: null | (() => void) = null;
onMounted(() => {
  void initProfiles();
  void refreshExtensions();
  window.addEventListener('click', onGlobalClick);

  try {
    const api = useInternalLumen()?.profiles;
    if (api && typeof api.onPqcLinked === 'function') {
      detachPqcLinkedListener = api.onPqcLinked((payload: any) => {
        try {
          const profileId = String(payload?.profileId || '').trim();
          const address = String(payload?.address || '').trim();
          if (!profileId) return;
          const key = address || profileId;
          if (pqcLinkedSeen.has(key)) return;
          pqcLinkedSeen.add(key);
          pqcLinkedProfileId.value = profileId;
          showPqcLinkedModal.value = true;
        } catch {
          // ignore handler errors
        }
      });
    }
  } catch {
    // ignore
  }

  try {
    const api = useInternalLumen()?.extensions;
    if (api && typeof api.onChanged === 'function') {
      detachExtensionsListener = api.onChanged((payload: any) => {
        extensions.value = normalizeExtensionPayload(payload);
      });
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
  try {
    detachPqcLinkedListener?.();
  } catch {
    // ignore
  }
  detachPqcLinkedListener = null;
  try {
    detachExtensionsListener?.();
  } catch {
    // ignore
  }
  detachExtensionsListener = null;
});
</script>
