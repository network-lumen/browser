<template>
  <div class="settings-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Settings :size="24" />
        </div>
        <span class="logo-text">Settings</span>
      </div>

      <div class="profile-card" v-if="activeProfile">
        <div class="avatar">
          <User :size="18" />
        </div>
        <div class="profile-info">
          <span class="profile-label">Active Profile</span>
          <span class="profile-name">{{ activeProfileDisplay }}</span>
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">General</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'appearance' }"
            @click="currentView = 'appearance'"
          >
            <Palette :size="18" />
            <span>Appearance</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'privacy' }"
            @click="currentView = 'privacy'"
          >
            <Shield :size="18" />
            <span>Privacy</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'profiles' }"
            @click="currentView = 'profiles'"
          >
            <User :size="18" />
            <span>Profiles &amp; backups</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Advanced</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'advanced' }"
            @click="currentView = 'advanced'"
          >
            <Code2 :size="18" />
            <span>Developer settings</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'about' }"
            @click="currentView = 'about'"
          >
            <Info :size="18" />
            <span>About</span>
          </button>
        </div>
      </nav>

      <!-- Version -->
      <div class="version-info">
        <span>Lumen v{{ appVersion }}</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
      </header>

      <!-- Appearance View -->
      <div v-if="currentView === 'appearance'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Dark Mode</span>
              <span class="setting-desc">{{ effectiveTheme === 'dark' ? 'Dark mode is enabled' : 'Light mode is enabled' }}</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input 
                  type="checkbox" 
                  :checked="theme === 'dark'"
                  @change="toggleDarkMode"
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Theme Preference</span>
              <span class="setting-desc">Choose your preferred color scheme</span>
            </div>
            <div class="setting-control">
              <div class="theme-selector">
                <button 
                  class="theme-option"
                  :class="{ active: theme === 'light' }"
                  @click="setTheme('light')"
                >
                  <Sun :size="18" />
                  <span>Light</span>
                </button>
                <button 
                  class="theme-option"
                  :class="{ active: theme === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <Moon :size="18" />
                  <span>Dark</span>
                </button>
                <button 
                  class="theme-option"
                  :class="{ active: theme === 'system' }"
                  @click="setTheme('system')"
                >
                  <Monitor :size="18" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Font Size</span>
              <span class="setting-desc">Adjust the default font size</span>
            </div>
            <div class="setting-control">
              <select class="select-control" v-model="fontSize">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Brightness</span>
              <span class="setting-desc">Adjust screen brightness ({{ brightness }}%)</span>
            </div>
            <div class="setting-control brightness-control">
              <Sun :size="16" class="brightness-icon" />
              <input 
                type="range" 
                min="50" 
                max="100" 
                v-model="brightness"
                class="brightness-slider"
              />
              <span class="brightness-value">{{ brightness }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Privacy View -->
      <div v-else-if="currentView === 'privacy'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Block Trackers</span>
              <span class="setting-desc">Prevent websites from tracking you</span>
            </div>
            <div class="setting-control">
              <label class="toggle">
                <input type="checkbox" v-model="blockTrackers" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Clear Browsing Data</span>
              <span class="setting-desc">Remove history, cookies, and cache</span>
            </div>
            <div class="setting-control">
              <button class="btn-secondary">Clear Data</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Profiles View -->
      <div v-else-if="currentView === 'profiles'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item profiles-header">
            <div class="setting-info">
              <span class="setting-label">Profiles</span>
              <span class="setting-desc">Select one or more profiles to export.</span>
            </div>
            <div class="setting-control profile-select-actions">
              <button
                class="btn-secondary"
                type="button"
                @click="selectAllProfiles"
                :disabled="!profiles.length"
              >
                Select all
              </button>
              <button
                class="btn-secondary"
                type="button"
                @click="clearSelectedProfiles"
                :disabled="!selectedProfileIds.length"
              >
                Clear
              </button>
            </div>
          </div>

          <div v-if="profiles.length" class="profiles-list">
            <label
              v-for="p in profiles"
              :key="p.id"
              class="profile-row"
              :class="{ active: p.id === activeProfileId }"
            >
              <input
                class="profile-checkbox"
                type="checkbox"
                :value="p.id"
                v-model="selectedProfileIds"
              />
              <div class="profile-row-main">
                <div class="profile-row-title">
                  <span class="profile-title">{{ p.name || p.id }}</span>
                  <span v-if="p.id === activeProfileId" class="profile-badge">Active</span>
                </div>
                <span class="profile-id">{{ p.id }}</span>
              </div>
            </label>
          </div>
          <p v-else class="setting-hint">No profiles found.</p>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Backups</span>
              <span class="setting-desc">Export or import full backup folders (profiles + PQC keys).</span>
            </div>
            <div class="setting-control profile-backup-actions">
              <button
                class="btn-secondary"
                type="button"
                @click="onExportSelectedBackups"
                :disabled="!selectedProfileIds.length || exportingBackup"
              >
                Export selected ({{ selectedProfileIds.length }})
              </button>
              <button
                class="btn-secondary"
                type="button"
                @click="onImportBackup"
                :disabled="importingBackup"
              >
                Import from backup folder
              </button>
            </div>
          </div>
          <p class="setting-hint">
            Backups include the encrypted keystore, profile metadata and PQC keys (pqc_keys). Export creates one folder per selected profile.
          </p>
          <p v-if="backupExportSummary" class="setting-hint">{{ backupExportSummary }}</p>
          <div v-if="backupExportFailures.length" class="backup-failures">
            <div v-for="f in backupExportFailures" :key="f.id" class="backup-failure">
              {{ f.id }}: {{ f.error || 'failed' }}
            </div>
          </div>
          <p v-if="backupImportSummary" class="setting-hint">{{ backupImportSummary }}</p>
          <div v-if="backupImportFailures.length" class="backup-failures">
            <div v-for="f in backupImportFailures" :key="f.path" class="backup-failure">
              {{ f.path }}: {{ f.error || 'failed' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Developer settings View -->
      <div v-else-if="currentView === 'advanced'" class="settings-section">
        <div class="setting-group">
          <p class="setting-hint">
            These settings are intended for developers. Most users should not need to change them.
          </p>

          <div class="advanced-title">
            <Globe :size="18" />
            <span>Network</span>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Local IPFS Gateway</span>
              <span class="setting-desc">Used for loading IPFS content in the UI</span>
            </div>
            <div class="setting-control">
              <input
                type="text"
                class="input-control wide"
                v-model="localGatewayDraft"
                placeholder="http://127.0.0.1:8080"
              />
            </div>
          </div>

          <div class="advanced-title">
            <Database :size="18" />
            <span>IPFS</span>
          </div>

          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">IPFS API Endpoint</span>
              <span class="setting-desc">Used by the Electron backend (Kubo API)</span>
            </div>
            <div class="setting-control">
              <input
                type="text"
                class="input-control wide"
                v-model="ipfsApiDraft"
                placeholder="http://127.0.0.1:5001"
              />
            </div>
          </div>

          <div v-if="devSettingsError" class="setting-hint" style="color: var(--ios-red);">
            {{ devSettingsError }}
          </div>

          <div class="profile-backup-actions" style="margin-top: 0.75rem;">
            <button
              class="btn-secondary"
              type="button"
              :disabled="devSettingsSaving"
              @click="resetDevSettings"
            >
              Reset
            </button>
            <button
              class="btn-secondary"
              type="button"
              :disabled="devSettingsSaving"
              @click="saveDevSettings"
            >
              {{ devSettingsSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>

          <p class="setting-hint">
            Note: the local IPFS daemon must actually be configured to use these ports/addresses.
          </p>
          <p class="setting-hint">
            Changes are applied automatically (no restart prompt).
          </p>
        </div>
      </div>

      <!-- About View -->
      <div v-else-if="currentView === 'about'" class="settings-section">
        <div class="about-card">
          <div class="about-logo">
            <div class="logo-icon large">
              <Hexagon :size="32" />
            </div>
          </div>
          <h2>Lumen Browser</h2>
          <p class="version">Version {{ appVersion }}</p>
          <p class="description">The Decentralized Internet Stack</p>
          <div class="about-links">
            <a
              href="https://lumen-network.org/"
              class="about-link"
              @click.prevent="openInNewTabSafe('https://lumen-network.org/')"
              >Website</a
            >
            <a
              href="https://github.com/network-lumen"
              class="about-link"
              @click.prevent="openInNewTabSafe('https://github.com/network-lumen')"
              >GitHub</a
            >
            <a
              href="lumen://help"
              class="about-link"
              @click.prevent="openInNewTabSafe('lumen://help')"
              >Documentation</a
            >
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, inject, onMounted } from 'vue';
import { 
  Settings,
  Palette,
  Shield,
  Globe,
  Database,
  Code2,
  Info,
  Hexagon,
  User,
  Sun,
  Moon,
  Monitor
} from 'lucide-vue-next';
import { useTheme } from '../../composables/useTheme';
import { profilesState, activeProfileId } from '../profilesStore';
import { exportProfilesBackup, importProfilesFromBackup } from '../profilesStore';
import pkg from '../../../package.json';
import { appSettingsState, setAppSettings } from '../services/appSettings';

const appVersion = String((pkg as any)?.version || '0.0.0');

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

function openInNewTabSafe(url: string) {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  navigate?.(url, { push: true });
}

const currentView = ref<'appearance' | 'privacy' | 'profiles' | 'advanced' | 'about'>('appearance');
const { theme, effectiveTheme, setTheme, initTheme } = useTheme();
const fontSize = ref(localStorage.getItem('lumen-font-size') || 'medium');
const brightness = ref(parseInt(localStorage.getItem('lumen-brightness') || '100'));
const blockTrackers = ref(true);
const exportingBackup = ref(false);
const importingBackup = ref(false);
const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');
const selectedProfileIds = ref<string[]>([]);
const lastBackupExport = ref<
  | null
  | {
      ok: boolean;
      baseDir?: string;
      results?: { id: string; ok: boolean; path?: string; error?: string }[];
      error?: string;
    }
>(null);
const lastBackupImport = ref<
  | null
  | {
      ok: boolean;
      selectedId?: string;
      imported?: number;
      results?: { ok: boolean; path: string; id?: string; error?: string }[];
      error?: string;
    }
>(null);

const backupExportSummary = computed(() => {
  const res = lastBackupExport.value;
  if (!res) return '';
  if (!res.ok) return 'Backup export failed.';
  const results = Array.isArray(res.results) ? res.results : [];
  const okCount = results.filter((r) => r && r.ok).length;
  const total = results.length || 0;
  const base = res.baseDir ? ` to ${res.baseDir}` : '';
  if (total <= 1) return `Exported ${okCount ? '1 profile' : '0 profiles'}${base}.`;
  if (!okCount) return `Export failed for ${total} profiles${base}.`;
  if (okCount === total) return `Exported ${okCount} profiles${base}.`;
  return `Exported ${okCount}/${total} profiles${base}.`;
});

const backupExportFailures = computed(() => {
  const res = lastBackupExport.value;
  if (!res || !res.ok) return [];
  const results = Array.isArray(res.results) ? res.results : [];
  return results.filter((r) => r && r.ok === false);
});

const backupImportSummary = computed(() => {
  const res = lastBackupImport.value;
  if (!res) return '';
  if (!res.ok) {
    const err = String(res.error || '');
    if (err === 'canceled') return 'Backup import canceled.';
    if (err === 'no_valid_backups_found') return 'No valid backups found.';
    return 'Backup import failed.';
  }
  const count = Number.isFinite(res.imported) ? Number(res.imported) : 0;
  if (count === 1) return 'Imported 1 profile.';
  return `Imported ${count} profiles.`;
});

const backupImportFailures = computed(() => {
  const res = lastBackupImport.value;
  if (!res || !res.ok) return [];
  const results = Array.isArray(res.results) ? res.results : [];
  return results.filter((r) => r && r.ok === false);
});

const localGatewayDraft = ref('');
const ipfsApiDraft = ref('');
const devSettingsSaving = ref(false);
const devSettingsError = ref('');

// Initialize theme on mount
initTheme();

function toggleDarkMode() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark');
}

watch(fontSize, (newSize) => {
  localStorage.setItem('lumen-font-size', newSize);
  document.documentElement.setAttribute('data-font-size', newSize);
});

watch(brightness, (newBrightness) => {
  localStorage.setItem('lumen-brightness', newBrightness.toString());
  document.documentElement.style.setProperty('--screen-brightness', `${newBrightness}%`);
  document.body.style.filter = `brightness(${newBrightness}%)`;
});

// Apply brightness on mount
onMounted(() => {
  document.body.style.filter = `brightness(${brightness.value}%)`;
});

watch(
  () => currentView.value,
  (v) => {
    if (v !== 'advanced') return;
    localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
    ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
    devSettingsError.value = '';
  },
  { immediate: true },
);

function validateUrl(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function resetDevSettings() {
  localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
  ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
  devSettingsError.value = '';
}

async function saveDevSettings() {
  if (devSettingsSaving.value) return;
  const localGatewayBase = validateUrl(localGatewayDraft.value);
  const ipfsApiBase = validateUrl(ipfsApiDraft.value);
  if (!localGatewayBase) {
    devSettingsError.value = 'Invalid Local IPFS Gateway URL.';
    return;
  }
  if (!ipfsApiBase) {
    devSettingsError.value = 'Invalid IPFS API URL.';
    return;
  }

  devSettingsSaving.value = true;
  devSettingsError.value = '';
  try {
    const res = await setAppSettings({ localGatewayBase, ipfsApiBase });
    if (!res.ok) {
      devSettingsError.value = String(res.error || 'Failed to save settings.');
      return;
    }
    localGatewayDraft.value = String(appSettingsState.value.localGatewayBase || '').trim();
    ipfsApiDraft.value = String(appSettingsState.value.ipfsApiBase || '').trim();
  } finally {
    devSettingsSaving.value = false;
  }
}

function getViewTitle(): string {
  const titles: Record<string, string> = {
    appearance: 'Appearance',
    privacy: 'Privacy & Security',
    profiles: 'Profiles & backups',
    advanced: 'Developer settings',
    about: 'About Lumen'
  };
  return titles[currentView.value] || 'Settings';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    appearance: 'Customize the look and feel',
    privacy: 'Manage your privacy settings',
    profiles: 'Backup or restore profiles and PQC keys',
    advanced: 'Advanced network configuration',
    about: 'Information about Lumen'
  };
  return descs[currentView.value] || '';
}

function selectAllProfiles() {
  selectedProfileIds.value = profiles.value.map((p) => p.id);
}

function clearSelectedProfiles() {
  selectedProfileIds.value = [];
  lastBackupExport.value = null;
}

watch(
  () => profiles.value,
  (next) => {
    const valid = new Set(Array.isArray(next) ? next.map((p) => p.id) : []);
    selectedProfileIds.value = selectedProfileIds.value.filter((id) => valid.has(id));
    if (!selectedProfileIds.value.length && activeProfileId.value && valid.has(activeProfileId.value)) {
      selectedProfileIds.value = [activeProfileId.value];
    }
  },
  { immediate: true, deep: true },
);

watch(
  () => currentView.value,
  (v) => {
    if (v !== 'profiles') return;
    if (selectedProfileIds.value.length) return;
    const activeId = activeProfileId.value;
    if (!activeId) return;
    if (profiles.value.some((p) => p.id === activeId)) {
      selectedProfileIds.value = [activeId];
    }
  },
);

async function onExportSelectedBackups() {
  if (exportingBackup.value) return;
  const uniqueIds = Array.from(
    new Set(selectedProfileIds.value.map((x) => String(x || '').trim()).filter(Boolean)),
  );
  if (!uniqueIds.length) return;

  exportingBackup.value = true;
  lastBackupExport.value = null;
  try {
    lastBackupExport.value = await exportProfilesBackup(uniqueIds);
  } catch {
    lastBackupExport.value = { ok: false, error: 'backup_failed' };
  } finally {
    exportingBackup.value = false;
  }
}

async function onImportBackup() {
  if (importingBackup.value) return;
  importingBackup.value = true;
  lastBackupImport.value = null;
  try {
    lastBackupImport.value = await importProfilesFromBackup();
  } catch {
    lastBackupImport.value = { ok: false, error: 'backup_failed' };
  } finally {
    importingBackup.value = false;
  }
}

// Initialize font size on mount
document.documentElement.setAttribute('data-font-size', fontSize.value);
</script>

<style scoped>
.settings-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.logo-icon.large {
  width: 64px;
  height: 64px;
  border-radius: var(--border-radius-xl);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--fill-tertiary);
  border-radius: var(--border-radius-lg);
  margin-bottom: 1.25rem;
  border: var(--border-width) solid var(--border-light);
}

.avatar {
  width: 36px;
  height: 36px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px var(--primary-a20);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-label {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.version-info {
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
  margin: 0;
  border-radius: 0;
}

.content-header {
  margin-bottom: 2rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0 0;
}

/* Settings Section */
.settings-section {
  flex: 1;
  overflow-y: auto;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-fast);
}

.setting-item:hover {
  background: var(--hover-bg);
  border-color: var(--ios-blue);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.setting-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.setting-control {
  display: flex;
  align-items: center;
}

.profile-backup-actions {
  gap: 0.5rem;
}

.profile-select-actions {
  gap: 0.5rem;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.profile-row:hover {
  background: var(--hover-bg);
}

.profile-row.active {
  background: rgba(59, 130, 246, 0.12);
}

.profile-checkbox {
  width: 16px;
  height: 16px;
}

.profile-row-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.profile-row-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.profile-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
}

.profile-badge {
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.18);
  color: var(--text-primary);
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.profile-id {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
}

.backup-failures {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.backup-failure {
  font-size: 0.8rem;
  color: var(--ios-red);
}

.setting-hint {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.advanced-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.select-control {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
}

.input-control {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-primary);
  width: 150px;
}

.input-control.wide {
  width: 320px;
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

/* Theme Selector */
.theme-selector {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-secondary);
  padding: 0.375rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.theme-option:hover {
  background: var(--hover-bg, var(--primary-a10));
  color: var(--text-primary);
}

.theme-option.active {
  background: var(--card-bg, white);
  color: var(--accent-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

/* Toggle */
.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border-color);
  border-radius: 26px;
  transition: all 0.2s;
}

.toggle-slider:before {
  content: '';
  position: absolute;
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background: var(--text-primary);
  border-radius: 50%;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.toggle input:checked + .toggle-slider {
  background: var(--gradient-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

/* Brightness Control */
.brightness-control {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.brightness-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.brightness-slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--border-color);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.brightness-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.brightness-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.4);
}

.brightness-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.brightness-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.4);
}

.brightness-value {
  min-width: 45px;
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.status-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.connected {
  background: var(--fill-success);
  color: var(--ios-green);
}

/* About Card */
.about-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem;
  background: var(--card-bg);
  border-radius: 20px;
  border: 1px solid var(--border-color, transparent);
}

.about-logo {
  margin-bottom: 1.5rem;
}

.about-card h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.about-card .version {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
}

.about-card .description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
}

.about-links {
  display: flex;
  gap: 1rem;
}

.about-link {
  color: var(--accent-primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}

.about-link:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .settings-page {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
  }
  
  .sidebar-header {
    margin-bottom: 0;
    margin-right: 1rem;
  }
  
  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
  }
  
  .nav-section {
    flex-direction: row;
  }
  
  .nav-label {
    display: none;
  }
  
  .nav-item span {
    display: none;
  }
  
  .version-info {
    display: none;
  }
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
  
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}
</style>
