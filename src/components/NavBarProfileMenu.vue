<template>
  <div class="appregion-no-drag relative">
    <UiButton variant="secondary" size="xs" type="button" :title="activeProfileDisplay" @click.stop="toggleMenu" class="navbar-profile-trigger border-radius-full border-none">
      <ProfileAvatar :profile="activeProfile" :size="24" :title="activeProfileDisplay" />
      <span class="text-13px fw-500 color-text-primary truncate max-w-100px">{{ activeProfileDisplay }}</span>
      <ChevronDown :size="14" class="color-text-tertiary ml-n2px" />
    </UiButton>

    <UiCard padding="none" :shadow="false" v-if="open"
      role="menu" class="navbar-profile-menu absolute p-8px shadow-xl z-100 right-0 min-w-260px max-w-300px calc-top-100-6px">
      <ActiveProfileCard
        v-if="activeProfile"
        :profile="activeProfile"
        dense
        :label="isGuestOnly ? 'Guest mode' : 'Active profile'"
      />

      <div v-if="hasProfiles && !isGuestOnly">
        <div class="text-11px txt-weight-light color-text-tertiary text-uppercase mt-8px letter-spacing-005em py-0px px-8px mb-4px">{{ t('Profiles') }}</div>
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

            <button type="button" class="reveal-target hover-bg-error-a10-color-error h-24px flex-inline-align-justify-center border-radius-10px cursor-pointer color-text-tertiary border-none bg-transparent transition-all-fast opacity-0 w-24px" :title="t('Delete profile')" @click.stop="requestDeleteProfile(p)">
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
          {{ t('New profile…') }}
        </UiMenuItem>
        <UiMenuItem :disabled="!activeProfileId" @click.stop="onExportProfile">
          {{ t('Export active profile…') }}
        </UiMenuItem>
        <UiMenuItem @click.stop="onImportProfileClick">
          {{ t('Import profile…') }}
        </UiMenuItem>

        <div v-if="creatingProfile" class="flex flex-column mt-8px pt-8px gap-6px border-top-05-border-light">
          <UiInput bg-class="bg-fill-primary" radius-class="border-radius-10px" font-size-class="text-13px" padding-class="py-8px px-10px" :focus-ring="false" v-model="newProfileName" :placeholder="t('Profile name')" class="fw-500 border-default focus-outline-none focus-bg-fill-primary placeholder-tertiary-a60" />
          <div class="flex gap-6px">
            <UiButton variant="primary" class="flex-1" @click="confirmCreateProfile">
              {{ t('Create') }}
            </UiButton>
            <UiButton variant="secondary" class="flex-1" @click="cancelCreateProfile">
              {{ t('Cancel') }}
            </UiButton>
          </div>
        </div>

        <div v-if="profileMessage" class="mt-8px text-12px color-text-tertiary py-4px px-6px">
          {{ profileMessage }}
        </div>
      </div>
    </UiCard>
  </div>

  <ExportProfileDialog :model-value="showExportModal" :password="exportPassword" :password-confirm="exportPasswordConfirm" :encrypted="exportEncrypted" :requires-password="exportRequiresPassword" :error="exportError" @update:model-value="cancelExportModal" @update:password="exportPassword = $event" @update:password-confirm="exportPasswordConfirm = $event" @update:encrypted="exportEncrypted = $event" @submit="confirmExportProfile" />

  <ImportProfileDialog :model-value="showImportModal" :mode="importMode" :form="manualImportForm" :error="importModalError" :busy="importBusy" @update:model-value="cancelImportModal" @update:mode="setImportMode" @update:field="setManualImportField" @pick-profile-source="loadManualProfileSourceIntoForm" @pick-pqc-source="loadManualPqcSourceIntoForm" @submit="importMode === 'file' ? startFileImport() : confirmManualImport()" />

  <ImportPasswordDialog :model-value="showImportPasswordModal" :password="importPassword" :error="importError" @update:model-value="cancelImportPasswordModal" @update:password="importPassword = $event" @submit="confirmImportEncrypted" />

  <ConfirmDialog
    :model-value="showDeleteProfileModal"
    :title="t('Delete profile?')"
    panel-class="min-w-360px max-w-90vw"
    button-class="flex-1"
    :confirm-label="t('Delete')"
    @update:model-value="cancelDeleteProfileModal"
    @confirm="confirmDeleteProfile"
  >
    <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
      {{ t('You are about to permanently delete {name}. This cannot be recovered.', { name: pendingDeleteProfileName }) }}
    </p>
  </ConfirmDialog>

  <PqcLinkedDialog :model-value="showPqcLinkedModal" :profile-name="pqcLinkedProfileDisplay" @dismiss="dismissPqcLinkedModal" @export="exportAfterPqcLinked" />
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, Trash2 } from 'lucide-vue-next';
import ActiveProfileCard from './ActiveProfileCard.vue';
import ProfileAvatar from './ProfileAvatar.vue';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import UiInput from '../ui/UiInput.vue';
import UiMenuItem from '../ui/UiMenuItem.vue';
import ConfirmDialog from '../dialogs/ConfirmDialog.vue';
import ExportProfileDialog from '../dialogs/ExportProfileDialog.vue';
import ImportPasswordDialog from '../dialogs/ImportPasswordDialog.vue';
import ImportProfileDialog from '../dialogs/ImportProfileDialog.vue';
import PqcLinkedDialog from '../dialogs/PqcLinkedDialog.vue';
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
} from '../stores/profilesStore';
import { errorMessage } from '../internal/services/coerce';
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough } from '../internal/services/passwordPolicy';
import { getProfileImportErrorMessage } from '../internal/services/profileImportErrors';
import type { Ref } from 'vue';
import type { NavBarImportMode, ManualImportForm } from '../types/navBar';

const open = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const profileMessage = ref('');

const showExportModal = ref(false);
const exportEncrypted = ref(false);
/** The keystore itself is password-protected, so exporting has to decrypt before it can write. */
const exportRequiresPassword = ref(false);
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

function clearManualImportForm() {
  for (const target of Object.values(MANUAL_IMPORT_REFS)) target.value = '';
}

const showImportPasswordModal = ref(false);
const importPassword = ref('');
const importError = ref('');
const pendingEncryptedFile = ref<string | null>(null);

const showDeleteProfileModal = ref(false);
const pendingDeleteProfileId = ref('');
const pendingDeleteProfileName = ref('');

const showPqcLinkedModal = ref(false);
const pqcLinkedProfileId = ref('');
/** One notice per linked address, however many times the main process announces it. */
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
  if (!id) return t('your profile');
  const p = profiles.value.find((x) => String(x?.id || '') === id) || null;
  return String(p?.name || p?.id || id);
});

function resetProfileUi() {
  creatingProfile.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
}

function toggleMenu() {
  open.value = !open.value;
  if (!open.value) resetProfileUi();
}

function selectProfile(id: string) {
  setActiveProfile(id);
  open.value = false;
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

  exportRequiresPassword.value = false;
  try {
    const api = useInternalLumen()?.profiles;
    if (api?.checkExportRequiresPassword) {
      const check = await api.checkExportRequiresPassword(id);
      if (check?.ok && check.requiresPassword) exportRequiresPassword.value = true;
    }
  } catch (e) {
    console.error('[NavBar] checkExportRequiresPassword error:', e);
  }

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

  // A password is needed either to encrypt the output or to decrypt the source,
  // and those are different passwords: only the first one the user is choosing
  // has to be typed twice.
  const needsPassword = exportEncrypted.value || exportRequiresPassword.value;

  if (needsPassword) {
    if (!exportPassword.value) {
      exportError.value = exportRequiresPassword.value
        ? t('Password is required to decrypt your wallet data.')
        : t('Password is required for encrypted export.');
      return;
    }
    if (!isPasswordLongEnough(exportPassword.value)) {
      exportError.value = t('Password must be at least {min} characters.', { min: MIN_PASSWORD_LENGTH });
      return;
    }
    if (exportEncrypted.value && !exportRequiresPassword.value && exportPassword.value !== exportPasswordConfirm.value) {
      exportError.value = t('Passwords do not match.');
      return;
    }
  }

  exportError.value = '';

  try {
    const password = exportPassword.value && isPasswordLongEnough(exportPassword.value) ? exportPassword.value : undefined;
    const res = await exportProfileBackup(id, password, exportEncrypted.value);

    if (!res.ok) {
      if (res.error === 'invalid_password') {
        exportError.value = t('Incorrect password. Please try again.');
        return;
      }
      if (res.error === 'password_required_for_export') {
        exportError.value = t('Password is required to decrypt your wallet data.');
        exportRequiresPassword.value = true;
        return;
      }
      if (res.error === 'backup_api_unavailable') {
        exportError.value = t('Export API not available.');
        return;
      }
      exportError.value = res.error || t('Failed to export the backup.');
      return;
    }

    cancelExportModal();
    profileMessage.value = res.path
      ? (exportEncrypted.value
        ? t('Encrypted backup created at: {path}', { path: res.path })
        : t('Backup created at: {path}', { path: res.path }))
      : t('Backup folder created for this profile.');
  } catch (e) {
    exportError.value = errorMessage(e, t('Failed to export the backup.'));
  }
}

function onImportProfileClick() {
  showImportModal.value = true;
  importMode.value = 'file';
  importBusy.value = false;
  importModalError.value = '';
  clearManualImportForm();
}

function cancelImportModal() {
  showImportModal.value = false;
  importBusy.value = false;
  importModalError.value = '';
  clearManualImportForm();
}

function setImportMode(mode: NavBarImportMode) {
  importMode.value = mode;
  importModalError.value = '';
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
      importModalError.value = getProfileImportErrorMessage(result.error || t('Backup import failed.'));
    }
  } catch {
    importModalError.value = t('Backup import failed.');
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
      importModalError.value = getProfileImportErrorMessage(result.error);
    }
    return;
  }

  if (result.name) manualImportName.value = result.name;
  if (result.mnemonic) manualImportMnemonic.value = result.mnemonic;
  if (result.pqcPublicKey && result.pqcPrivateKey) {
    manualImportPqcPublicKey.value = result.pqcPublicKey;
    manualImportPqcPrivateKey.value = result.pqcPrivateKey;
    manualImportPqcSourceName.value = result.fileName
      ? `${result.fileName} (embedded PQC)`
      : t('Embedded PQC');
  }
  manualImportProfileSourceName.value = result.fileName || t('Loaded profile backup');
}

async function loadManualPqcSourceIntoForm() {
  if (importBusy.value) return;

  importModalError.value = '';
  const result = await pickManualPqcSource();
  if (!result.ok) {
    if (result.error && result.error !== 'canceled') {
      importModalError.value = getProfileImportErrorMessage(result.error);
    }
    return;
  }

  manualImportPqcPublicKey.value = String(result.pqcPublicKey || '');
  manualImportPqcPrivateKey.value = String(result.pqcPrivateKey || '');
  manualImportPqcSourceName.value = result.fileName || t('Loaded Dilithium backup');
}

async function confirmManualImport() {
  if (importBusy.value) return;

  const name = manualImportName.value.trim();
  const mnemonic = manualImportMnemonic.value.trim().replace(/\s+/g, ' ');
  const pqcPublicKey = manualImportPqcPublicKey.value.trim();
  const pqcPrivateKey = manualImportPqcPrivateKey.value.trim();

  if (!name) {
    importModalError.value = t('Profile name is required.');
    return;
  }

  if (!mnemonic) {
    importModalError.value = t('Mnemonic is required.');
    return;
  }

  if ((pqcPublicKey && !pqcPrivateKey) || (!pqcPublicKey && pqcPrivateKey)) {
    importModalError.value = t('Enter both PQC public and private keys, or leave both empty.');
    return;
  }

  importBusy.value = true;
  importModalError.value = '';

  try {
    const result = await importProfileManually({ name, mnemonic, pqcPublicKey, pqcPrivateKey });

    if (!result.ok) {
      importModalError.value = getProfileImportErrorMessage(result.error);
      return;
    }

    cancelImportModal();
    profileMessage.value =
      pqcPublicKey && pqcPrivateKey
        ? t('Profile imported manually.')
        : t('Profile imported manually. PQC keys will be generated automatically when needed.');
  } catch {
    importModalError.value = t('Manual import failed.');
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
    importError.value = t('Password required');
    return;
  }

  importError.value = '';

  try {
    const api = useInternalLumen()?.profiles;
    if (!api || typeof api.importEncryptedBackup !== 'function') {
      importError.value = t('Import API not available.');
      return;
    }

    const res = await api.importEncryptedBackup(pendingEncryptedFile.value, importPassword.value);

    if (res && res.ok) {
      cancelImportPasswordModal();
      await initProfiles();
      profileMessage.value = t('Encrypted profile imported successfully.');
    } else if (res?.error === 'invalid_password') {
      importError.value = t('Invalid password. Please try again.');
    } else {
      importError.value = res?.error || t('Import failed');
    }
  } catch (e) {
    importError.value = errorMessage(e, t('Import failed'));
  }
}

async function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) {
    profileMessage.value = t('Profile name is required.');
    return;
  }
  try {
    const created = await createProfile(name);
    if (created) {
      creatingProfile.value = false;
      profileMessage.value = t('Profile created.');
    } else {
      profileMessage.value = t('Failed to create profile. (No profile returned)');
      console.error('[NavBar] Failed to create profile: createProfile returned null or undefined');
    }
  } catch (e) {
    profileMessage.value = t('Error creating profile: ') + errorMessage(e, t('Unknown error'));
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

async function confirmDeleteProfile() {
  const id = String(pendingDeleteProfileId.value || '').trim();
  if (!id) return;

  const res = await deleteProfile(id);
  if (!res || res.ok !== true) {
    const err = String((res as any)?.error || 'delete_failed');
    profileMessage.value = err === 'password_required'
      ? t('Unlock your wallet to delete this profile.')
      : t('Failed to delete profile.');
    return;
  }

  cancelDeleteProfileModal();
  profileMessage.value = t('Profile deleted.');
}

function dismissPqcLinkedModal() {
  showPqcLinkedModal.value = false;
  pqcLinkedProfileId.value = '';
}

async function exportAfterPqcLinked() {
  const id = String(pqcLinkedProfileId.value || activeProfileId.value || '').trim();
  dismissPqcLinkedModal();
  if (!id) return;
  if (id !== activeProfileId.value) await setActiveProfile(id);
  await onExportProfile();
}

/**
 * A click outside closes the menu - unless one of this component's own modals
 * is open, since those are drawn over everything and their overlay click would
 * otherwise take the menu down with them.
 */
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
  if (el.closest('.navbar-profile-trigger') || el.closest('.navbar-profile-menu')) return;
  open.value = false;
  resetProfileUi();
}

let detachPqcLinkedListener: null | (() => void) = null;

onMounted(() => {
  void initProfiles();
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
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
  try {
    detachPqcLinkedListener?.();
  } catch {
    // ignore
  }
  detachPqcLinkedListener = null;
});
</script>
