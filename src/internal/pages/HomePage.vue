<template>
  <div class="home-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Hexagon :size="28" />
        </div>
        <span class="logo-text">Lumen</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Menu</span>
          <button 
            v-for="key in mainRoutes" 
            :key="key"
            class="nav-item"
            :class="{ active: key === 'home' }"
            @click="openRoute(key)"
          >
            <component :is="getRouteIcon(key)" :size="18" />
            <span>{{ formatRouteName(key) }}</span>
          </button>
        </div>
        
        <div class="nav-section">
          <button class="dropdown-selector" @click="showAllPages = !showAllPages">
            <span class="dropdown-label">All Pages</span>
            <component :is="showAllPages ? ChevronUp : ChevronDown" :size="16" class="dropdown-icon" />
          </button>
          
          <div v-if="showAllPages" class="all-pages-list">
            <button 
              v-for="key in allRoutes" 
              :key="key"
              class="page-item"
              @click="openRoute(key)"
            >
              <component :is="getRouteIcon(key)" :size="14" />
              <span>{{ formatRouteName(key) }}</span>
            </button>
          </div>
        </div>
      </nav>

      <!-- Profile Info -->
      <div class="profile-card" v-if="activeProfile">
        <div class="avatar">
          <User :size="18" />
        </div>
        <div class="profile-info">
          <span class="profile-label">Active Profile</span>
          <span class="profile-name">{{ activeProfileDisplay }}</span>
        </div>
      </div>

      <!-- Version -->
      <div class="version-info">
        <span>Lumen v1.0.0</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <div v-if="!hasProfiles" class="no-profile-banner">
        <div class="no-profile-title">Vous n'avez pas de profile actuellement</div>
        <div class="no-profile-sub">Créez-en un via le bouton en haut à droite.</div>
      </div>
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title">Welcome to <span class="gradient-text">Lumen</span></h1>
          <p class="hero-subtitle">Make your content universally accessible — uncensorable by design</p>
          <p class="hero-intro">Lumen lets you publish and access content without relying on centralized platforms.</p>
        </div>
        
        <div class="description-features">
              <div class="feature-point">
                <div class="point-icon">🌐</div>
                <div class="point-text">
                  <strong>Decentralized Storage:</strong> Store and share your public content without central servers, using decentralized networks
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">🔐</div>
                <div class="point-text">
                  <strong>All-in-One Control</strong> Manage domains, digital assets, and network interactions in one interface
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">⚡</div>
                <div class="point-text">
                  <strong>Secure by Design:</strong> Encrypted connections, local-first data, and no built-in tracking
                </div>
              </div>
            </div>
        
        <div class="hero-stats">

        </div>
      </section>

      <!-- Quick Actions -->
      <section class="quick-actions">
        <h2 class="section-title">My Space</h2>
        <div class="actions-grid">
          <button class="action-card" @click="openRoute('drive')" :disabled="!hasProfiles">
            <div class="action-icon drive">
              <HardDrive :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Drive</span>
              <span class="action-desc">Store & share files</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('domain')" :disabled="!hasProfiles">
            <div class="action-icon domain">
              <AtSign :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Domains</span>
              <span class="action-desc">Manage your domains</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>
          
          <button class="action-card" @click="openRoute('wallet')" :disabled="!hasProfiles">
            <div class="action-icon wallet">
              <Wallet :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Wallet</span>
              <span class="action-desc">Manage crypto assets</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('dao')">
            <div class="action-icon dao">
              <Vote :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">DAO</span>
              <span class="action-desc">Governance & voting</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('gateways')">
            <div class="action-icon gateways">
              <Globe :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Gateways</span>
              <span class="action-desc">IPFS gateway management</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('settings')">
            <div class="action-icon settings">
              <Settings :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Settings</span>
              <span class="action-desc">Configure preferences</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

        </div>
      </section>

      <section class="quick-actions">
        <h2 class="section-title">Lumen</h2>
        <div class="actions-grid">
                    <button class="action-card" @click="openRoute('explorer')">
            <div class="action-icon explorer">
              <Globe :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Explorer</span>
              <span class="action-desc">Browse the blockchain</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>
          
          <button class="action-card" @click="openRoute('network')">
            <div class="action-icon network">
              <Network :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Network</span>
              <span class="action-desc">View network status</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('search')">
            <div class="action-icon search">
              <Search :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Search</span>
              <span class="action-desc">Find content quickly</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

          <button class="action-card" @click="openRoute('help')">
            <div class="action-icon help">
              <HelpCircle :size="24" />
            </div>
            <div class="action-info">
              <span class="action-title">Help</span>
              <span class="action-desc">Documentation & support</span>
            </div>
            <ArrowUpRight :size="16" class="action-arrow" />
          </button>

        </div>
      </section>

    </main>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, ref } from 'vue';
import { INTERNAL_ROUTE_KEYS } from '../routes';
import { profilesState, activeProfileId } from '../profilesStore';
import { 
  Home, User, HardDrive, Wallet, Globe, Settings, 
  ArrowUpRight, Zap, Network, FileText, Hexagon,
  Shield, Database, Vote, Package, AtSign, Search,
  HelpCircle, Layers, ChevronDown, ChevronUp
} from 'lucide-vue-next';

const mainRoutes = ['home', 'drive', 'wallet', 'network', 'settings'];
const allRoutes = computed(() => INTERNAL_ROUTE_KEYS);
const showAllPages = ref(true);

const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');
const hasProfiles = computed(() => profiles.value.length > 0);

const openInNewTab = inject<(url: string) => void>('openInNewTab');

function openRoute(key: string) {
  const url = `lumen://${key}`;
  openInNewTab?.(url);
}

function formatRouteName(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getRouteIcon(key: string) {
  const icons: Record<string, any> = {
    home: Home,
    drive: HardDrive,
    wallet: Wallet,
    network: Network,
    settings: Settings,
    explorer: Globe,
    domain: AtSign,
    dao: Vote,
    release: Package,
    newtab: Layers,
    search: Search,
    gateways: Globe,
    help: HelpCircle
  };
  return icons[key] || FileText;
}
</script>

<style scoped>
.home-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary, #f0f2f5);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 2px solid var(--border-color, #e5e7eb);
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
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lime-bright);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dropdown-selector {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 0.5rem;
}

.dropdown-selector:hover {
  background: var(--primary-a08);
  border-color: var(--accent-primary);
}

.dropdown-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.dropdown-icon {
  color: var(--text-secondary, #64748b);
  transition: transform 0.2s ease;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary, #94a3b8);
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
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: var(--lime-bright);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.all-pages-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.all-pages-list::-webkit-scrollbar {
  width: 4px;
}

.all-pages-list::-webkit-scrollbar-track {
  background: rgba(226, 232, 240, 0.3);
  border-radius: 4px;
}

.all-pages-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}

.all-pages-list::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.6);
}

.page-item {
  width: 100%;
  padding: 0.625rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--text-secondary, #64748b);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.page-item:hover {
  background: var(--primary-a08);
  color: var(--accent-primary);
  transform: translateX(4px);
}

.toggle-pages {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  margin: 0.5rem 0;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, white);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
  font-weight: 500;
}

.toggle-pages:hover {
  background: var(--bg-secondary, #f8fafc);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 12px;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
}

.avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-label {
  font-size: 0.65rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.version-info {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #fff);
  margin: 0;
  border-radius: 0;
}

.no-profile-banner {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  padding: 0.9rem 1rem;
  border-radius: 14px;
  margin-bottom: 1.25rem;
}

.no-profile-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.no-profile-sub {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  opacity: 0.95;
}

.action-card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Hero Section */
.hero-section {
  background: linear-gradient(135deg, var(--primary-a10) 0%, var(--primary-a15) 100%);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--primary-a20);
  box-shadow: 0 8px 32px var(--primary-a15);
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, var(--lime-a15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.hero-content {
  margin-bottom: 1rem;
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary, #0f172a);
  margin-bottom: 0.375rem;
  text-align: center;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 0.9375rem;
  color: var(--text-primary, #475569);
  text-align: center;
  margin-bottom: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.hero-intro {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  line-height: 1.6;
  text-align: center;
  margin-bottom: 1rem;
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px var(--primary-a30));
}

.description-features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.feature-point {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  background: var(--card-bg, #ffffff);
  backdrop-filter: blur(10px);
  padding: 0.875rem;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.feature-point:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px var(--primary-a15), 0 0 0 1px var(--primary-a20);
  border-color: var(--primary-a30);
  background: var(--hover-bg, #f8fafc);
}

.point-icon {
  font-size: 1.125rem;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  border-radius: 10px;
  box-shadow: 0 4px 12px var(--primary-a25), 0 0 0 4px var(--lime-a10);
  position: relative;
}

.point-icon::after {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(135deg, var(--primary-a40), var(--primary-a40));
  border-radius: 12px;
  filter: blur(8px);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.feature-point:hover .point-icon::after {
  opacity: 1;
}

.point-text {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.point-text strong {
  display: block;
  color: var(--text-primary, #0f172a);
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.hero-stats {
  display: flex;
  gap: 0.875rem;
  margin-top: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(226, 232, 240, 0.6));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px var(--primary-a15);
  border-color: var(--primary-a30);
}

.stat-icon {
  width: 36px;
  height: 36px;
  background: var(--gradient-primary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lime-bright);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  letter-spacing: -0.01em;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
  font-weight: 500;
}

/* Sections */
.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin-bottom: 1rem;
  padding-bottom: 0.625rem;
  border-bottom: 2px solid transparent;
  background: linear-gradient(to right, var(--border-color, #e2e8f0) 0%, transparent 100%) no-repeat bottom;
  background-size: 100% 2px;
  letter-spacing: -0.01em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pages-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary, #94a3b8);
  background: var(--hover-bg, #f1f5f9);
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
}

/* Quick Actions */
.quick-actions {
  margin-bottom: 1.5rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.875rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.125rem;
  background: var(--card-bg, #ffffff);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.action-card:hover {
  background: var(--hover-bg, #f8fafc);
  border-color: var(--primary-a50);
  transform: translateY(-3px);
  box-shadow: 0 8px 20px var(--primary-a20), 0 0 0 1px var(--primary-a20);
}

.action-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  position: relative;
}

.action-card:hover .action-icon {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.action-icon.drive {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: var(--accent-primary);
}

.action-icon.wallet {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
}

.action-icon.explorer {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #059669;
}

.action-icon.network {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  color: #db2777;
}

.action-icon.domain {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #6366f1;
}

.action-icon.staking {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #16a34a;
}

.action-icon.dao {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #d97706;
}

.action-icon.gateways {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  color: #059669;
}

.action-icon.search {
  background: linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%);
  color: #65a30d;
}

.action-icon.help {
  background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%);
  color: #ca8a04;
}

.action-icon.settings {
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  color: #9333ea;
}

.action-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
  letter-spacing: -0.01em;
}

.action-desc {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
  line-height: 1.4;
}

.action-arrow {
  color: var(--text-tertiary, #94a3b8);
  transition: all 0.2s;
}

.action-card:hover .action-arrow {
  color: var(--accent-primary);
  transform: translate(2px, -2px);
}

/* Routes Section */
.routes-section {
  margin-bottom: 1.5rem;
}

.routes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.route-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color, rgba(226, 232, 240, 0.8));
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #475569);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.route-chip:hover {
  background: var(--gradient-primary);
  border-color: transparent;
  color: var(--lime-bright);
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 16px var(--primary-a25);
}

/* Responsive */
@media (max-width: 1100px) {
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .hero-stats {
    gap: 1rem;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 220px;
    min-width: 220px;
    max-width: 220px;
    padding: 1rem;
  }
  
  .logo-text {
    font-size: 1.1rem;
  }
  
  .main-content {
    padding: 1.5rem;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-stats {
    flex-direction: column;
  }
}

@media (max-width: 700px) {
  .sidebar {
    width: 70px;
    min-width: 70px;
    max-width: 70px;
    padding: 0.75rem;
  }
  
  .logo-text,
  .nav-label,
  .nav-item span,
  .profile-card,
  .version-info {
    display: none;
  }
  
  .sidebar-header {
    justify-content: center;
    padding: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .logo-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
  
  .nav-item {
    justify-content: center;
    padding: 0.75rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .hero-content h1 {
    font-size: 1.35rem;
  }
  
  .hero-content p {
    font-size: 0.85rem;
  }
  
  .action-card {
    padding: 1rem;
  }
  
  .action-icon {
    width: 40px;
    height: 40px;
  }
}
</style>
