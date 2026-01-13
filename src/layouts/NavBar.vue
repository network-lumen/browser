<template>
  <header class="navbar">
    <!-- Navigation Controls -->
    <div class="nav-controls">
      <button
        class="nav-btn"
        :disabled="!canGoBack"
        title="Back"
        @click="previous"
      >
        <ArrowLeft :size="16" />
      </button>
      <button
        class="nav-btn"
        :disabled="!canGoForward"
        title="Forward"
        @click="next"
      >
        <ArrowRight :size="16" />
      </button>
      <button
        class="nav-btn"
        :aria-busy="loading ? 'true' : 'false'"
        :disabled="loading"
        :title="loading ? 'Loading…' : 'Refresh'"
        @click="refresh"
      >
        <UiSpinner v-if="loading" size="sm" />
        <RefreshCw v-else :size="16" />
      </button>
    </div>

    <!-- URL Bar -->
    <div class="url-bar-container appregion-no-drag">
      <Search :size="15" stroke-width="2" class="url-bar-icon" />
      <input
        v-model="urlField"
        type="text"
        class="url-bar-input"
        placeholder="Search or enter lumen:// address"
        @keydown.enter="onEnter"
      />
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button
        class="nav-btn"
        :class="{ 'is-active': favActive }"
        title="Toggle favourite"
        @click="onToggleFavourite"
      >
        <Star :size="16" :fill="favActive ? 'currentColor' : 'none'" />
      </button>
      <button
        class="nav-btn"
        title="Home"
        @click="$emit('goto', 'lumen://home')"
      >
        <House :size="16" />
      </button>
      <button
        class="nav-btn"
        title="Drive"
        @click="$emit('goto', 'lumen://drive')"
      >
        <Cloud :size="16" />
      </button>
    </div>

    <!-- Profile -->
    <div class="profile-section appregion-no-drag">
      <button type="button" class="profile-trigger" :title="activeProfileDisplay" @click.stop="toggleProfileMenu">
        <ProfileAvatar :profile="activeProfile" :size="28" :title="activeProfileDisplay" />
        <span class="profile-trigger-name">{{ activeProfileDisplay }}</span>
        <ChevronDown :size="14" class="profile-chevron" />
      </button>

      <div
        v-if="showProfileMenu"
        class="profile-menu"
        role="menu"
      >
        <ActiveProfileCard
          v-if="activeProfile"
          :profile="activeProfile"
          dense
          :label="isGuestOnly ? 'Guest mode' : 'Active profile'"
        />

        <div v-if="hasProfiles && !isGuestOnly" class="profile-menu-section">
          <div class="profile-menu-title">Profiles</div>
          <ul class="profile-list">
            <li
              v-for="p in profiles"
              :key="p.id"
              class="profile-row"
              :class="{ active: p.id === activeProfileId }"
              role="menuitem"
            >
              <button type="button" class="profile-row-btn" @click.stop="selectProfile(p.id)">
                <ProfileAvatar :profile="p" :size="26" :title="p.name || p.id" />
                <span class="profile-row-name">{{ p.name || p.id }}</span>
              </button>

              <button type="button" class="profile-row-delete" title="Delete profile" @click.stop="onDeleteProfile(p.id)">
                <Trash2 :size="14" />
              </button>
            </li>
          </ul>
        </div>

        <div v-else class="profile-menu-hint">
          {{ isGuestOnly
            ? 'Guest mode active. Create or import a profile to get started.'
            : 'No profiles yet.' }}
        </div>

        <div class="profile-menu-actions">
          <UiButton variant="none" class="profile-menu-action" @click.stop="onCreateProfileClick">
            New profile…
          </UiButton>
          <UiButton variant="none" class="profile-menu-action" :disabled="!activeProfileId" @click.stop="onExportProfile">
            Export active profile…
          </UiButton>
          <UiButton variant="none" class="profile-menu-action" @click.stop="onImportProfileClick">
            Import profile…
          </UiButton>

          <div v-if="creatingProfile" class="profile-create">
            <input v-model="newProfileName" type="text" class="profile-create-input" placeholder="Profile name" />
            <div class="profile-create-actions">
              <UiButton variant="none" class="profile-menu-action primary" @click="confirmCreateProfile">
                Create
              </UiButton>
              <UiButton variant="none" class="profile-menu-action" @click="cancelCreateProfile">
                Cancel
              </UiButton>
            </div>
          </div>

          <div v-if="profileMessage" class="profile-menu-message">
            {{ profileMessage }}
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Export Options Modal -->
  <Teleport to="body">
    <div v-if="showExportModal" class="export-modal-overlay" @click.self="cancelExportModal">
      <div class="export-modal">
        <div class="export-modal-header">
          <h3>Export Profile</h3>
          <button type="button" class="export-modal-close" @click="cancelExportModal">×</button>
        </div>
        
        <div class="export-modal-body">
          <p class="export-modal-desc">
            Export your profile backup.
            <template v-if="exportRequiresPassword">
              <br/><strong>Note:</strong> Your wallet is password-protected. Enter your password to include wallet data in the backup.
            </template>
            <template v-else>
              You can optionally encrypt it with a password.
            </template>
          </p>
          
          <!-- Password required for decryption notice -->
          <div v-if="exportRequiresPassword" class="export-password-fields">
            <div class="export-field">
              <label>Wallet Password</label>
              <input 
                type="password" 
                v-model="exportPassword" 
                placeholder="Enter your wallet password"
                class="export-input"
                @keyup.enter="confirmExportProfile"
              />
            </div>
            
            <label class="export-option" style="margin-top: 12px;">
              <input type="checkbox" v-model="exportEncrypted" />
              <span class="export-option-label">Also encrypt the backup file with this password</span>
            </label>
          </div>
          
          <!-- Optional encryption for non-protected wallets -->
          <template v-if="!exportRequiresPassword">
            <label class="export-option">
              <input type="checkbox" v-model="exportEncrypted" />
              <span class="export-option-label">Encrypt backup with password</span>
            </label>
            
            <div v-if="exportEncrypted" class="export-password-fields">
              <div class="export-field">
                <label>Password</label>
                <input 
                  type="password" 
                  v-model="exportPassword" 
                  placeholder="Enter password (min 6 characters)"
                  class="export-input"
                />
              </div>
              <div class="export-field">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  v-model="exportPasswordConfirm" 
                  placeholder="Confirm password"
                  class="export-input"
                  @keyup.enter="confirmExportProfile"
                />
              </div>
            </div>
          </template>
          
          <div v-if="exportError" class="export-error">
            {{ exportError }}
          </div>
          
          <div class="export-modal-actions">
            <UiButton variant="none" class="export-btn cancel" @click="cancelExportModal">
              Cancel
            </UiButton>
            <UiButton variant="none" class="export-btn confirm" @click="confirmExportProfile">
              Export {{ exportEncrypted ? '(Encrypted)' : '' }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Import Password Modal (for encrypted backups) -->
  <Teleport to="body">
    <div v-if="showImportPasswordModal" class="export-modal-overlay" @click.self="cancelImportPasswordModal">
      <div class="export-modal">
        <div class="export-modal-header">
          <h3>Encrypted Backup</h3>
          <button type="button" class="export-modal-close" @click="cancelImportPasswordModal">×</button>
        </div>
        
        <div class="export-modal-body">
          <p class="export-modal-desc">
            This backup is encrypted. Please enter the password to decrypt and import it.
          </p>
          
          <div class="export-password-fields">
            <div class="export-field">
              <label>Backup Password</label>
              <input 
                type="password" 
                v-model="importPassword" 
                placeholder="Enter backup password"
                class="export-input"
                @keyup.enter="confirmImportEncrypted"
              />
            </div>
          </div>
          
          <div v-if="importError" class="export-error">
            {{ importError }}
          </div>
          
          <div class="export-modal-actions">
            <UiButton variant="none" class="export-btn cancel" @click="cancelImportPasswordModal">
              Cancel
            </UiButton>
            <UiButton variant="none" class="export-btn confirm" @click="confirmImportEncrypted">
              Import
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, RefreshCw, Search, House, Cloud, Trash2, Star, ChevronDown } from 'lucide-vue-next';
import ActiveProfileCard from '../components/ActiveProfileCard.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import {
  profilesState,
  activeProfileId,
  setActiveProfile,
  createProfile,
  deleteProfile,
  initProfiles,
  exportProfileBackup,
  importProfilesFromBackup
} from '../internal/profilesStore';
import { useFavourites } from '../internal/favouritesStore';

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  history?: TabHistoryEntry[];
  history_position?: number;
};

const props = defineProps<{
  tabActive: string;
  tabs: Tab[];
  loading: boolean;
  currentUrl?: string;
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
  toggleFavourite(props.currentUrl);
}
const showProfileMenu = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const profileMessage = ref('');

// Export modal state
const showExportModal = ref(false);
const exportEncrypted = ref(false);
const exportRequiresPassword = ref(false); // true if keystore/pqc is password-protected
const exportPassword = ref('');
const exportPasswordConfirm = ref('');
const exportError = ref('');

// Import encrypted modal state
const showImportPasswordModal = ref(false);
const importPassword = ref('');
const importError = ref('');
const pendingEncryptedFile = ref<string | null>(null);

const profiles = profilesState;

const hasProfiles = computed(() => profiles.value.length > 0);

const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const isGuestOnly = computed(
  () => activeProfile.value?.role === 'guest' && profiles.value.length === 1
);

const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || 'Profile'
);

const activeTab = computed<Tab | null>(() => {
  return props.tabs.find((t) => t.id === props.tabActive) ?? null;
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

// Sync displayed URL with current tab URL
watch(
  () => props.currentUrl,
  (val) => {
    const v = String(val || '').trim();
    if (!v) return;
    urlField.value = v;
  },
  { immediate: true }
);

function previous() {
  if (!canGoBack.value) return;
  emit('history-step', { delta: -1 });
}

function next() {
  if (!canGoForward.value) return;
  emit('history-step', { delta: 1 });
}

function refresh() {
  emit('refresh-request');
}

  function normalizeInput(raw: string): string {
    const v = String(raw || '').trim();
    if (!v) return 'lumen://home';

    // preserve any lumen:// URL as-is (including query/hash)
    if (/^lumen:\/\//i.test(v)) return v;

    // allow http(s) URLs
    if (/^https?:\/\//i.test(v)) return v;

    // allow bare internal routes ("home", "wallet"...)
    const lowered = v.toLowerCase();
    const builtin = [
      'home',
      'search',
      'drive',
      'wallet',
      'network',
      'settings',
      'help',
      'domain',
      'explorer',
      'dao',
      'ipfs',
      'gateways',
      'release',
      'newtab',
    ];
    if (builtin.includes(lowered)) return `lumen://${lowered}`;

    // "mydomain.com" -> lumen://mydomain.com
    if (!/^\w+:/i.test(v) && /\./.test(v) && !/\s/.test(v)) {
      return `lumen://${v}`;
    }

    const q = encodeURIComponent(v);
    return `lumen://search?q=${q}`;
  }

function onEnter(ev: KeyboardEvent) {
  const el = ev.target as HTMLInputElement | null;
  const raw = el?.value ?? urlField.value;
  const target = normalizeInput(raw || '');
  urlField.value = target;
  emit('goto', target);
}

function resetProfileUi() {
  creatingProfile.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
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
    const api = (window as any).lumen?.profiles;
    console.log('[NavBar] checkExportRequiresPassword API available:', !!api?.checkExportRequiresPassword);
    if (api?.checkExportRequiresPassword) {
      const check = await api.checkExportRequiresPassword(id);
      console.log('[NavBar] checkExportRequiresPassword result:', check);
      if (check?.ok && check.requiresPassword) {
        exportRequiresPassword.value = true;
      }
    }
  } catch (e) {
    console.error('[NavBar] checkExportRequiresPassword error:', e);
  }
  
  console.log('[NavBar] exportRequiresPassword after check:', exportRequiresPassword.value);
  
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
    if (exportPassword.value.length < 6) {
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
    const password = exportPassword.value && exportPassword.value.length >= 6 ? exportPassword.value : undefined;
    
    // encryptOutput is true when user explicitly wants to encrypt the backup file
    const encryptOutput = exportEncrypted.value;
    
    // Debug: show an alert with the values before export
    const debugInfo = `Password: ${password ? password.length + ' chars' : 'none'}\nEncrypt output: ${encryptOutput}\nrequiresPassword: ${exportRequiresPassword.value}`;
    console.log('[NavBar] Export debug:', debugInfo);
    
    // Call IPC directly to bypass any module caching issues
    const api = (window as any).lumen?.profiles;
    console.log('[NavBar] Direct IPC call - password:', password ? `${password.length} chars` : 'none', 'encryptOutput:', encryptOutput);
    if (!api || typeof api.exportBackup !== 'function') {
      exportError.value = 'Export API not available';
      return;
    }
    
    const res = await api.exportBackup(id, password, encryptOutput);
    console.log('[NavBar] Direct IPC result:', res);
    
    if (!res || res.ok === false) {
      // Handle specific error messages
      if (res?.error === 'invalid_password') {
        exportError.value = 'Incorrect password. Please try again.';
        return;
      }
      if (res?.error === 'password_required_for_export') {
        exportError.value = 'Password is required to decrypt wallet data.';
        exportRequiresPassword.value = true;
        return;
      }
      exportError.value = res?.error || 'Backup export failed.';
      return;
    }
    
    cancelExportModal();
    profileMessage.value = res.path
      ? `Backup ${exportEncrypted.value ? '(encrypted) ' : ''}created at: ${res.path}`
      : 'Backup folder created for this profile.';
  } catch (e: any) {
    exportError.value = e?.message || 'Backup export failed.';
  }
}

function onImportProfileClick() {
  // Use backup import flow instead of raw JSON.
  importProfilesFromBackup()
    .then((result) => {
      if (result.ok) {
        profileMessage.value = `Imported ${result.imported || 1} profile(s) from backup.`;
        showProfileMenu.value = false;
        resetProfileUi();
      } else if (result.error === 'encrypted_backup_found' && result.encryptedFiles?.length) {
        // Show password modal for encrypted backup
        pendingEncryptedFile.value = result.encryptedFiles[0];
        importPassword.value = '';
        importError.value = '';
        showImportPasswordModal.value = true;
      } else if (result.error === 'canceled') {
        // User canceled, don't show error
      } else {
        profileMessage.value = result.error || 'Backup import failed.';
      }
    })
    .catch(() => {
      profileMessage.value = 'Backup import failed.';
    });
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
    const api = (window as any).lumen?.profiles;
    if (!api || typeof api.importEncryptedBackup !== 'function') {
      importError.value = 'Import API not available.';
      return;
    }

    const res = await api.importEncryptedBackup(pendingEncryptedFile.value, importPassword.value);
    
    if (res && res.ok) {
      cancelImportPasswordModal();
      await initProfiles();
      profileMessage.value = 'Encrypted profile imported successfully.';
      showProfileMenu.value = false;
      resetProfileUi();
    } else if (res?.error === 'invalid_password') {
      importError.value = 'Invalid password. Please try again.';
    } else {
      importError.value = res?.error || 'Import failed.';
    }
  } catch (e: any) {
    importError.value = e?.message || 'Import failed.';
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
    profileMessage.value = 'Error creating profile: ' + (e?.message || e || 'Unknown error');
    console.error('[NavBar] Error creating profile:', e);
  }
}

function cancelCreateProfile() {
  creatingProfile.value = false;
  newProfileName.value = '';
}

async function onDeleteProfile(id: string) {
  const ok = await deleteProfile(id);
  if (!ok) {
    profileMessage.value = 'Failed to delete profile.';
    return;
  }
  profileMessage.value = 'Profile deleted.';
}

function onGlobalClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.profile-trigger') || el.closest('.profile-menu')) return;
  showProfileMenu.value = false;
  resetProfileUi();
}

onMounted(() => {
  void initProfiles();
  window.addEventListener('click', onGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
});
</script>

<style scoped>
/* ===== NAVBAR LAYOUT ===== */
.navbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border-bottom: 0.5px solid var(--border-color);
  min-height: 52px;
}

/* ===== NAVIGATION CONTROLS ===== */
.nav-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--border-radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-btn.is-active {
  color: #FFD60A;
}

/* ===== URL BAR ===== */
.url-bar-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
}

.url-bar-icon {
  position: absolute;
  left: 12px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.url-bar-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s ease;
}

.url-bar-input::placeholder {
  color: var(--text-tertiary);
}

.url-bar-input:focus {
  outline: none;
  background: var(--bg-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

/* ===== QUICK ACTIONS ===== */
.quick-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* ===== PROFILE SECTION ===== */
.profile-section {
  position: relative;
}

.profile-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.625rem 0.35rem 0.35rem;
  border-radius: var(--border-radius-full);
  border: 0.5px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.profile-trigger:hover {
  background: var(--hover-bg);
  border-color: var(--border-color);
}

.profile-trigger-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-chevron {
  color: var(--text-tertiary);
  margin-left: -0.125rem;
}

/* ===== PROFILE MENU ===== */
.profile-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  min-width: 260px;
  max-width: 300px;
  background: var(--card-bg);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 0.5rem;
  box-shadow: var(--shadow-xl);
  z-index: 100;
}

.profile-menu-title {
  margin-top: 0.5rem;
  margin-bottom: 0.375rem;
  padding: 0 0.5rem;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: var(--border-radius-sm);
  padding: 0.25rem;
}

.profile-row:hover {
  background: var(--hover-bg);
}

.profile-row.active {
  background: var(--primary-a08);
}

.profile-row-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
}

.profile-row-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-row-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--border-radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary);
  opacity: 0;
  transition: all 0.15s ease;
}

.profile-row:hover .profile-row-delete {
  opacity: 1;
}

.profile-row-delete:hover {
  background: rgba(255, 59, 48, 0.1);
  color: var(--error-red);
}

.profile-menu-hint {
  padding: 0.75rem 0.5rem;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.profile-menu-actions {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 0.5px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-menu-action {
  width: 100%;
  justify-content: flex-start;
  padding: 0.5rem 0.625rem;
  border-radius: var(--border-radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.profile-menu-action:hover {
  background: var(--hover-bg);
}

.profile-menu-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.profile-menu-action.primary {
  background: var(--accent-primary);
  color: #fff;
  justify-content: center;
}

.profile-menu-action.primary:hover {
  filter: brightness(1.1);
}

.profile-create {
  margin-top: 0.375rem;
  padding-top: 0.5rem;
  border-top: 0.5px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.profile-create-input {
  width: 100%;
  padding: 0.5rem 0.625rem;
  border-radius: var(--border-radius-sm);
  border: 0.5px solid var(--border-color);
  background: var(--fill-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
}

.profile-create-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.6;
}

.profile-create-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background: var(--fill-primary);
}

.profile-create-actions {
  display: flex;
  gap: 0.375rem;
}

.profile-create-actions .profile-menu-action {
  flex: 1;
  justify-content: center;
}

.profile-menu-message {
  margin-top: 0.375rem;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 0.25rem 0.5rem;
}

/* ===== EXPORT MODAL ===== */
.export-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.export-modal {
  background: var(--card-bg);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-2xl);
  min-width: 360px;
  max-width: 90vw;
  overflow: hidden;
  border: 0.5px solid var(--border-color);
}

.export-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 0.5px solid var(--border-color);
}

.export-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.export-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--hover-bg);
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: 18px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.export-modal-close:hover {
  background: var(--fill-primary);
  color: var(--text-primary);
}

.export-modal-body {
  padding: 1.25rem;
}

.export-modal-desc {
  margin: 0 0 1rem 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem 0.625rem;
  border-radius: var(--border-radius-sm);
  transition: background 0.15s ease;
}

.export-option:hover {
  background: var(--hover-bg);
}

.export-option input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-primary);
}

.export-option-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.export-password-fields {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-md);
  border: 0.5px solid var(--border-light);
}

.export-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.export-field label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.export-input {
  padding: 0.5rem 0.625rem;
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.export-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.export-error {
  margin-top: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: rgba(255, 59, 48, 0.1);
  border: 0.5px solid rgba(255, 59, 48, 0.25);
  border-radius: var(--border-radius-sm);
  color: var(--error-red);
  font-size: 12px;
}

.export-modal-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.export-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.export-btn.cancel {
  background: var(--bg-secondary);
  border: 0.5px solid var(--border-color);
  color: var(--text-secondary);
}

.export-btn.cancel:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.export-btn.confirm {
  background: var(--accent-primary);
  border: none;
  color: #fff;
}

.export-btn.confirm:hover {
  filter: brightness(1.1);
}
</style>
