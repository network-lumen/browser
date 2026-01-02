<template>
  <div class="explorer-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Globe :size="24" />
        </div>
        <span class="logo-text">Explorer</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Browse</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'blocks' }"
            @click="currentView = 'blocks'"
          >
            <Boxes :size="18" />
            <span>Blocks</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'transactions' }"
            @click="currentView = 'transactions'"
          >
            <ArrowLeftRight :size="18" />
            <span>Transactions</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'accounts' }"
            @click="currentView = 'accounts'"
          >
            <Users :size="18" />
            <span>Accounts</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Analytics</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'stats' }"
            @click="currentView = 'stats'"
          >
            <BarChart3 :size="18" />
            <span>Statistics</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'contracts' }"
            @click="currentView = 'contracts'"
          >
            <FileCode :size="18" />
            <span>Contracts</span>
          </button>
        </div>
      </nav>

      <!-- Network Status -->
      <div class="network-status connected">
        <div class="status-dot"></div>
        <span>Mainnet</span>
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
        
        <div class="header-actions">
          <div class="search-box">
            <Search :size="16" />
            <input type="text" placeholder="Search by address, tx hash, block..." v-model="searchQuery" />
          </div>
        </div>
      </header>

      <!-- Blocks View -->
      <div v-if="currentView === 'blocks'" class="blocks-section">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon blue">
              <Boxes :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">19,234,567</span>
              <span class="stat-label">Latest Block</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">
              <Clock :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">12.3s</span>
              <span class="stat-label">Avg Block Time</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">
              <Zap :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">45 Gwei</span>
              <span class="stat-label">Gas Price</span>
            </div>
          </div>
        </div>

        <div class="table-section">
          <div class="section-header">
            <h3>Latest Blocks</h3>
          </div>
          <div class="data-table">
            <div class="table-header">
              <span class="col-block">Block</span>
              <span class="col-age">Age</span>
              <span class="col-txns">Txns</span>
              <span class="col-validator">Validator</span>
              <span class="col-reward">Reward</span>
            </div>
            <div class="table-row" v-for="i in 5" :key="i">
              <span class="col-block"><a href="#">#19234{{ 567 - i }}</a></span>
              <span class="col-age">{{ i * 12 }}s ago</span>
              <span class="col-txns">{{ 100 + i * 23 }}</span>
              <span class="col-validator">0x742d...F4e8</span>
              <span class="col-reward">0.0{{ i }}5 ETH</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transactions View -->
      <div v-else-if="currentView === 'transactions'" class="transactions-section">
        <div class="table-section">
          <div class="section-header">
            <h3>Latest Transactions</h3>
          </div>
          <div class="data-table">
            <div class="table-header">
              <span class="col-hash">Tx Hash</span>
              <span class="col-method">Method</span>
              <span class="col-from">From</span>
              <span class="col-to">To</span>
              <span class="col-value">Value</span>
            </div>
            <div class="table-row" v-for="i in 5" :key="i">
              <span class="col-hash"><a href="#">0x8f7d...{{ i }}e3a</a></span>
              <span class="col-method"><span class="method-badge">Transfer</span></span>
              <span class="col-from">0x123...abc</span>
              <span class="col-to">0x456...def</span>
              <span class="col-value">{{ i }}.{{ i * 2 }} ETH</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Accounts View -->
      <div v-else-if="currentView === 'accounts'" class="accounts-section">
        <div class="empty-state">
          <div class="empty-icon">
            <Users :size="32" />
          </div>
          <h3>Search for Accounts</h3>
          <p>Enter an address to view account details</p>
        </div>
      </div>

      <!-- Stats View -->
      <div v-else-if="currentView === 'stats'" class="stats-section">
        <div class="stats-grid large">
          <div class="stat-card">
            <div class="stat-icon blue">
              <Activity :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">1.2M</span>
              <span class="stat-label">Daily Transactions</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">
              <Users :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">5.4M</span>
              <span class="stat-label">Total Addresses</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">
              <TrendingUp :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">$2,345</span>
              <span class="stat-label">ETH Price</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple">
              <Database :size="20" />
            </div>
            <div class="stat-info">
              <span class="stat-value">120M ETH</span>
              <span class="stat-label">Total Supply</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Contracts View -->
      <div v-else-if="currentView === 'contracts'" class="contracts-section">
        <div class="empty-state">
          <div class="empty-icon">
            <FileCode :size="32" />
          </div>
          <h3>Smart Contracts</h3>
          <p>Search for verified contracts</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  Globe,
  Boxes,
  ArrowLeftRight,
  Users,
  BarChart3,
  FileCode,
  Search,
  Clock,
  Zap,
  Activity,
  TrendingUp,
  Database
} from 'lucide-vue-next';

const currentView = ref<'blocks' | 'transactions' | 'accounts' | 'stats' | 'contracts'>('blocks');
const searchQuery = ref('');

function getViewTitle(): string {
  const titles: Record<string, string> = {
    blocks: 'Block Explorer',
    transactions: 'Transactions',
    accounts: 'Accounts',
    stats: 'Network Statistics',
    contracts: 'Smart Contracts'
  };
  return titles[currentView.value] || 'Explorer';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    blocks: 'Browse and search blockchain blocks',
    transactions: 'View recent and pending transactions',
    accounts: 'Look up account balances and history',
    stats: 'Network analytics and metrics',
    contracts: 'Explore verified smart contracts'
  };
  return descs[currentView.value] || '';
}
</script>

<style scoped>
.explorer-page {
  display: flex;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 1px solid #e5e7eb;
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
  color: #1e293b;
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
  color: #94a3b8;
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
  color: #64748b;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.network-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #bbf7d0;
  color: #16a34a;
  font-size: 0.8rem;
  font-weight: 500;
}

.network-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: #fff;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 16px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  min-width: 300px;
}

.search-box:focus-within {
  border-color: #3498db;
  background: white;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  color: #1e293b;
  outline: none;
}

.search-box input::placeholder {
  color: #94a3b8;
}

.search-box svg {
  color: #94a3b8;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stats-grid.large {
  grid-template-columns: repeat(2, 1fr);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.blue { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); }
.stat-icon.green { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
.stat-icon.orange { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
.stat-icon.purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-label {
  font-size: 0.75rem;
  color: #64748b;
}

/* Table Section */
.table-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.data-table {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: flex;
  padding: 0.875rem 1rem;
  background: #f1f5f9;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
}

.table-row {
  display: flex;
  padding: 0.875rem 1rem;
  font-size: 0.85rem;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.1s;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: #f8fafc;
}

.col-block, .col-hash { flex: 1.5; }
.col-age, .col-method { flex: 1; }
.col-txns, .col-value { flex: 0.8; text-align: right; }
.col-validator, .col-from, .col-to { flex: 1.2; }
.col-reward { flex: 1; text-align: right; }

.table-row a {
  color: #3498db;
  text-decoration: none;
}

.table-row a:hover {
  text-decoration: underline;
}

.method-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  background: #e0f2fe;
  color: #0284c7;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.empty-state h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

/* Other sections */
.blocks-section,
.transactions-section,
.accounts-section,
.stats-section,
.contracts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* Responsive */
@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .search-box {
    min-width: 200px;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .explorer-page {
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
  
  .network-status {
    margin-left: auto;
  }
  
  .network-status span {
    display: none;
  }
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
  
  .search-box {
    min-width: 150px;
  }
}
</style>
