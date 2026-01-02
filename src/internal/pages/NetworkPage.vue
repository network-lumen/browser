<template>
  <div class="network-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Network :size="24" />
        </div>
        <span class="logo-text">Network</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Overview</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'status' }"
            @click="currentView = 'status'"
          >
            <Activity :size="18" />
            <span>Status</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'peers' }"
            @click="currentView = 'peers'"
          >
            <Users :size="18" />
            <span>Peers</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Nodes</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'validators' }"
            @click="currentView = 'validators'"
          >
            <Server :size="18" />
            <span>Validators</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'ipfs' }"
            @click="currentView = 'ipfs'"
          >
            <Database :size="18" />
            <span>IPFS Node</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
        <button class="btn-refresh" @click="refreshData">
          <RefreshCw :size="18" />
          Refresh
        </button>
      </header>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <Box :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ latestHeight ?? '...' }}</span>
            <span class="stat-label">Block Height</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon connected">
            <Wifi :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">Connected</span>
            <span class="stat-label">Network Status</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <Users :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">24</span>
            <span class="stat-label">Active Peers</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <Clock :size="20" />
          </div>
          <div class="stat-info">
            <span class="stat-value">2.1s</span>
            <span class="stat-label">Avg Block Time</span>
          </div>
        </div>
      </div>

      <!-- Status View -->
      <div v-if="currentView === 'status'" class="content-area">
        <div class="info-section">
          <h3>Network Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Network ID</span>
              <span class="info-value">lumen-mainnet-1</span>
            </div>
            <div class="info-item">
              <span class="info-label">Chain ID</span>
              <span class="info-value">lumen_1-1</span>
            </div>
            <div class="info-item">
              <span class="info-label">RPC Endpoint</span>
              <span class="info-value">http://localhost:26657</span>
            </div>
            <div class="info-item">
              <span class="info-label">IPFS Gateway</span>
              <span class="info-value">http://localhost:8088</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Peers View -->
      <div v-else-if="currentView === 'peers'" class="content-area">
        <div class="peers-list">
          <div class="peer-item" v-for="i in 5" :key="i">
            <div class="peer-status online"></div>
            <div class="peer-info">
              <span class="peer-id">peer{{ i }}@192.168.1.{{ 100 + i }}:26656</span>
              <span class="peer-location">Node {{ i }}</span>
            </div>
            <div class="peer-stats">
              <span>↓ 1.2 MB/s</span>
              <span>↑ 0.8 MB/s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Validators View -->
      <div v-else-if="currentView === 'validators'" class="content-area">
        <div class="validators-list">
          <div class="validator-item" v-for="i in 4" :key="i">
            <div class="validator-rank">{{ i }}</div>
            <div class="validator-info">
              <span class="validator-name">Validator {{ i }}</span>
              <span class="validator-address">lumenvaloper1...{{ i }}xyz</span>
            </div>
            <div class="validator-stats">
              <span class="validator-stake">{{ 1000000 - i * 100000 }} LMN</span>
              <span class="validator-commission">{{ i + 4 }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- IPFS View -->
      <div v-else-if="currentView === 'ipfs'" class="content-area">
        <div class="ipfs-status">
          <div class="status-card connected">
            <div class="status-icon">
              <CheckCircle :size="32" />
            </div>
            <h3>IPFS Node Running</h3>
            <p>Connected to local IPFS daemon</p>
          </div>
          <div class="ipfs-info">
            <div class="info-item">
              <span class="info-label">API Port</span>
              <span class="info-value">5001</span>
            </div>
            <div class="info-item">
              <span class="info-label">Gateway Port</span>
              <span class="info-value">8088</span>
            </div>
            <div class="info-item">
              <span class="info-label">Peer ID</span>
              <span class="info-value">QmX...abc</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated } from 'vue';
import { 
  Network,
  Activity,
  Users,
  Server,
  Database,
  RefreshCw,
  Box,
  Wifi,
  Clock,
  CheckCircle
} from 'lucide-vue-next';
import { blockHeight, refreshBlockHeight } from '../chainBus';

const currentView = ref<'status' | 'peers' | 'validators' | 'ipfs'>('status');
const latestHeight = blockHeight;

function getViewTitle(): string {
  const titles: Record<string, string> = {
    status: 'Network Status',
    peers: 'Connected Peers',
    validators: 'Validators',
    ipfs: 'IPFS Node'
  };
  return titles[currentView.value] || 'Network';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    status: 'Overview of network health',
    peers: 'Active peer connections',
    validators: 'Network validators list',
    ipfs: 'Local IPFS node status'
  };
  return descs[currentView.value] || '';
}

function refreshData() {
  refreshBlockHeight();
}

onMounted(() => {
  refreshBlockHeight();
});

onActivated(() => {
  refreshBlockHeight();
});
</script>

<style scoped>
.network-page {
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #fff);
  margin: 0;
  border-radius: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0 0;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  color: var(--text-secondary, #64748b);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-refresh:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--bg-secondary, #f8fafc) 0%, var(--hover-bg, #f1f5f9) 100%);
  border-radius: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.connected {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

/* Content Area */
.content-area {
  flex: 1;
  overflow-y: auto;
}

/* Info Section */
.info-section h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 0.75rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 10px;
}

.info-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
}

.info-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
}

/* Peers */
.peers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.peer-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
}

.peer-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #94a3b8;
}

.peer-status.online {
  background: #22c55e;
}

.peer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.peer-id {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  font-family: monospace;
}

.peer-location {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.peer-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

/* Validators */
.validators-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.validator-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
}

.validator-rank {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.85rem;
}

.validator-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.validator-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.validator-address {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
  font-family: monospace;
}

.validator-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
}

.validator-stake {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.validator-commission {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

/* IPFS */
.ipfs-status {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.status-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 16px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.status-card.connected {
  background: var(--card-bg, #f0fdf4);
  border-color: #bbf7d0;
}

.status-card.connected .status-icon {
  color: #22c55e;
}

.status-icon {
  margin-bottom: 1rem;
}

.status-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.status-card p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.ipfs-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
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
  .network-page {
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
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
