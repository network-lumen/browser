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
            :class="{ active: currentView === 'network' }"
            @click="currentView = 'network'"
          >
            <Globe :size="18" />
            <span>Network</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'profiles' }"
            @click="currentView = 'profiles'"
          >
            <User :size="18" />
            <span>Profiles</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Advanced</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'ipfs' }"
            @click="currentView = 'ipfs'"
          >
            <Database :size="18" />
            <span>IPFS</span>
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
        <span>Lumen v1.0.0</span>
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

      <!-- Network View -->
      <div v-else-if="currentView === 'network'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Default Gateway</span>
              <span class="setting-desc">IPFS gateway for content loading</span>
            </div>
            <div class="setting-control">
              <input type="text" class="input-control" value="localhost:8088" />
            </div>
          </div>
        </div>
      </div>

      <!-- Profiles View -->
      <div v-else-if="currentView === 'profiles'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Profile backups</span>
              <span class="setting-desc">
                Export or import full backup folders (profiles + PQC keys).
              </span>
            </div>
            <div class="setting-control profile-backup-actions">
              <button
                class="btn-secondary"
                type="button"
                @click="onExportBackup"
                :disabled="!hasActiveProfile || exportingBackup"
              >
                Export active profile backup
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
            Backups include the encrypted keystore, profile metadata and PQC keys (pqc_keys).
          </p>
        </div>
      </div>

      <!-- IPFS View -->
      <div v-else-if="currentView === 'ipfs'" class="settings-section">
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">IPFS Node</span>
              <span class="setting-desc">Local IPFS node configuration</span>
            </div>
            <div class="setting-control">
              <span class="status-badge connected">Running</span>
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">API Port</span>
              <span class="setting-desc">IPFS API endpoint port</span>
            </div>
            <div class="setting-control">
              <input type="text" class="input-control" value="5001" />
            </div>
          </div>
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
          <p class="version">Version 1.0.0</p>
          <p class="description">A decentralized web browser powered by IPFS</p>
          <div class="about-links">
            <a href="#" class="about-link">Website</a>
            <a href="#" class="about-link">GitHub</a>
            <a href="#" class="about-link">Documentation</a>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { 
  Settings,
  Palette,
  Shield,
  Globe,
  Database,
  Info,
  Hexagon,
  User,
  Sun,
  Moon,
  Monitor
} from 'lucide-vue-next';
import { useTheme } from '../../composables/useTheme';
import { profilesState, activeProfileId } from '../profilesStore';
import { exportProfileBackup, importProfileFromBackup } from '../profilesStore';

const currentView = ref<'appearance' | 'privacy' | 'network' | 'profiles' | 'ipfs' | 'about'>('appearance');
const { theme, effectiveTheme, setTheme, initTheme } = useTheme();
const fontSize = ref(localStorage.getItem('lumen-font-size') || 'medium');
const brightness = ref(parseInt(localStorage.getItem('lumen-brightness') || '100'));
const blockTrackers = ref(true);
const exportingBackup = ref(false);
const importingBackup = ref(false);
const hasActiveProfile = computed(() => !!activeProfileId.value);
const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');

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

function getViewTitle(): string {
  const titles: Record<string, string> = {
    appearance: 'Appearance',
    privacy: 'Privacy & Security',
    network: 'Network Settings',
    profiles: 'Profiles & backups',
    ipfs: 'IPFS Configuration',
    about: 'About Lumen'
  };
  return titles[currentView.value] || 'Settings';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    appearance: 'Customize the look and feel',
    privacy: 'Manage your privacy settings',
    network: 'Configure network preferences',
    profiles: 'Backup or restore profiles and PQC keys',
    ipfs: 'IPFS node settings',
    about: 'Information about Lumen'
  };
  return descs[currentView.value] || '';
}

async function onExportBackup() {
  if (!activeProfileId.value || exportingBackup.value) return;
  exportingBackup.value = true;
  try {
    await exportProfileBackup(activeProfileId.value);
  } catch {
    // ignore errors
  } finally {
    exportingBackup.value = false;
  }
}

async function onImportBackup() {
  if (importingBackup.value) return;
  importingBackup.value = true;
  try {
    await importProfileFromBackup();
  } catch {
    // ignore
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

.setting-hint {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
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
