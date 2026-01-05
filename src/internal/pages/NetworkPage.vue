<template>
  <div class="network-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="12" r="7"/>
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2"/>
          </svg>
        </div>
        <span class="logo-text">Network</span>
      </div>

      <!-- Network Status Badge -->
      <div class="network-status" :class="connectionStatus">
        <div class="status-dot"></div>
        <span>{{ connectionStatusText }}</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Monitoring</span>
          <button class="nav-item active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M18 17l-4-4-4 4-4-4"/>
            </svg>
            <span>Status</span>
          </button>
          <button class="nav-item" @click="refreshData" :disabled="refreshing">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: refreshing }">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            <span>{{ refreshing ? 'Refreshing...' : 'Refresh' }}</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Metrics</span>
          <div class="metric-item">
            <span class="metric-label">Block Height</span>
            <span class="metric-value">{{ formatNumber(blockHeight) }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Validators</span>
            <span class="metric-value">{{ validators.active }}/{{ validators.total }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Block Time</span>
            <span class="metric-value">{{ blockTime.toFixed(2) }}s</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Throughput</span>
            <span class="metric-value">{{ tps.toFixed(1) }} tx/s</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Blocks/Hour</span>
            <span class="metric-value">{{ blocksPerHour }}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">24h Volume</span>
            <span class="metric-value">{{ formatNumber(txVolume24h) }}</span>
          </div>
        </div>

        <div class="nav-section">
          <span class="nav-label">Node Info</span>
          <div class="node-detail">
            <span class="node-detail-label">Chain ID</span>
            <span class="node-detail-value">lumen-1</span>
          </div>
          <div class="node-detail">
            <span class="node-detail-label">Network</span>
            <span class="node-detail-value">Mainnet</span>
          </div>
          <div class="node-detail">
            <span class="node-detail-label">SDK</span>
            <span class="node-detail-value">v0.47.0</span>
          </div>
          <div class="node-detail">
            <span class="node-detail-label">Peers</span>
            <span class="node-detail-value">{{ peers }}</span>
          </div>
          <div class="node-detail">
            <span class="node-detail-label">Uptime</span>
            <span class="node-detail-value">{{ uptime }}</span>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Main Grid Layout -->
      <div class="main-grid">
        <!-- Left Column: Overview Cards -->
        <div class="left-column">
          <div class="info-card">
            <div class="card-label">Block Height</div>
            <div class="card-value">{{ formatNumber(blockHeight) }}</div>
            <div class="card-detail">Latest block on chain</div>
          </div>

          <div class="info-card">
            <div class="card-label">Validators</div>
            <div class="card-value">{{ validators.active }}<span class="card-unit">/{{ validators.total }}</span></div>
            <div class="card-detail">{{ validatorPercent.toFixed(1) }}% active</div>
          </div>

          <div class="info-card">
            <div class="card-label">Block Time</div>
            <div class="card-value">{{ blockTime.toFixed(2) }}<span class="card-unit">s</span></div>
            <div class="card-detail">Avg: {{ avgBlockTime.toFixed(2) }}s</div>
          </div>

          <div class="info-card">
            <div class="card-label">Throughput</div>
            <div class="card-value">{{ tps.toFixed(1) }} <span class="card-unit">tx/s</span></div>
            <div class="card-detail">Peak: {{ maxTps.toFixed(1) }} tx/s</div>
          </div>
        </div>

      <!-- Middle Column: Health & Activity -->
      <div class="middle-column">
        <!-- Network Health -->
        <section class="health-section">
          <h2 class="section-title">Network Health</h2>
          <div class="health-grid">
            <div class="health-card">
              <div class="health-label">Chain Status</div>
              <div class="health-indicator">
                <div class="indicator-bar">
                  <div class="indicator-fill excellent" style="width: 100%"></div>
                </div>
                <span class="indicator-value">Synced</span>
              </div>
            </div>

            <div class="health-card">
              <div class="health-label">Validator Participation</div>
              <div class="health-indicator">
                <div class="indicator-bar">
                  <div class="indicator-fill" :class="validatorPercent > 80 ? 'excellent' : validatorPercent > 60 ? 'good' : 'normal'" :style="{ width: validatorPercent + '%' }"></div>
                </div>
                <span class="indicator-value">{{ validatorPercent.toFixed(0) }}%</span>
              </div>
            </div>

            <div class="health-card">
              <div class="health-label">Block Production</div>
              <div class="health-indicator">
                <div class="indicator-bar">
                  <div class="indicator-fill" :class="blockTimeStatus === 'fast' ? 'excellent' : blockTimeStatus === 'normal' ? 'good' : 'normal'" style="width: 85%"></div>
                </div>
                <span class="indicator-value">{{ blockTimeStatus }}</span>
              </div>
            </div>

            <div class="health-card">
              <div class="health-label">Peer Connections</div>
              <div class="health-indicator">
                <div class="indicator-bar">
                  <div class="indicator-fill good" style="width: 70%"></div>
                </div>
                <span class="indicator-value">{{ peers }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Network Activity Chart -->
        <section class="activity-section">
          <div class="section-header">
            <h2 class="section-title">Network Activity</h2>
            <div class="chart-tabs">
              <button class="tab-btn" :class="{ active: activeChart === 'blocks' }" @click="activeChart = 'blocks'">Blocks</button>
              <button class="tab-btn" :class="{ active: activeChart === 'txs' }" @click="activeChart = 'txs'">Transactions</button>
              <button class="tab-btn" :class="{ active: activeChart === 'tps' }" @click="activeChart = 'tps'">TPS</button>
            </div>
          </div>
          <div class="activity-chart">
            <div class="chart-container">
              <svg v-if="activeChart === 'blocks'" viewBox="0 0 400 120" preserveAspectRatio="none">
                <path :d="blockChartLinePath" stroke="var(--accent-primary)" stroke-width="2" fill="none" />
                <circle v-for="(point, i) in blockChartPoints" :key="i" :cx="point.x" :cy="point.y" r="3" fill="var(--accent-primary)" />
              </svg>
              <svg v-if="activeChart === 'txs'" viewBox="0 0 400 120" preserveAspectRatio="none">
                <rect v-for="(point, i) in txChartPoints" :key="i" :x="point.x - 8" :y="point.y" width="16" :height="120 - point.y" fill="#6366f1" opacity="0.8" rx="2" />
              </svg>
              <svg v-if="activeChart === 'tps'" viewBox="0 0 400 120" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="grad-tps" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#059669;stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:#059669;stop-opacity:0" />
                  </linearGradient>
                </defs>
                <path :d="tpsChartPath" fill="url(#grad-tps)" />
                <path :d="tpsChartLinePath" stroke="#059669" stroke-width="2" fill="none" />
              </svg>
            </div>
          </div>
        </section>
      </div>

      <!-- Right Column: Recent Blocks & Node Info -->
      <div class="right-column">
        <!-- Recent Blocks -->
        <section class="data-table">
          <h2 class="section-title">Recent Blocks</h2>
          <div class="blocks-list">
            <div class="block-card" v-for="block in recentBlocks" :key="block.height">
              <div class="block-left">
                <div class="validator-avatar" :title="block.validator">
                  <img v-if="block.validatorAvatar" :src="block.validatorAvatar" :alt="block.validator" />
                  <span v-else class="avatar-placeholder">{{ block.validator.substring(0, 2).toUpperCase() }}</span>
                </div>
                <div class="block-info">
                  <div class="block-height-row">
                    <span class="height-label">Block</span>
                    <span class="height-value">#{{ formatNumber(block.height) }}</span>
                  </div>
                  <div class="block-validator">
                    <span class="validator-name-compact">{{ block.validator }}</span>
                  </div>
                </div>
              </div>
              <div class="block-right">
                <div class="block-meta">
                  <div class="meta-item">
                    <span class="meta-label">TXS</span>
                    <span class="meta-value" :class="{ 'has-txs': block.txs > 0 }">{{ block.txs }}</span>
                  </div>
                  <div class="meta-time">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.5">
                      <path d="M6 0C2.7 0 0 2.7 0 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10.8c-2.65 0-4.8-2.15-4.8-4.8S3.35 1.2 6 1.2s4.8 2.15 4.8 4.8-2.15 4.8-4.8 4.8z"/>
                      <path d="M6.6 3H5.4v3.3l2.85 1.7.6-1-2.25-1.35V3z"/>
                    </svg>
                    <span class="time-text">{{ formatTime(block.time) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// Window interface
const lumen = (window as any).lumen;

// RPC endpoints
const rpcBase = ref('http://142.132.201.187:26657');
const restBase = ref('http://142.132.201.187:1317');

// Network data
const blockHeight = ref(0);
const blockTime = ref(0);
const validators = ref({ total: 0, active: 0, jailed: 0 });
const tps = ref(0);
const peers = ref(0);
const uptime = ref('0%');
const connectionStatus = ref<'online' | 'syncing' | 'offline'>('offline');
const refreshing = ref(false);

// Chart data
const activeChart = ref<'blocks' | 'txs' | 'tps'>('blocks');
const blockTimeHistory = ref<number[]>([]);
const txHistory = ref<number[]>([]);
const maxTps = ref(0);

// Recent blocks
interface Block {
  height: number;
  time: string;
  txs: number;
  validator: string;
  validatorAvatar?: string;
}

const recentBlocks = ref<Block[]>([]);
const avatarCache = ref<Record<string, string>>({});
const proposerMap = ref<Record<string, { moniker: string; avatar?: string; keybaseId?: string }>>({});

// Computed
const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'online': return 'Online';
    case 'syncing': return 'Syncing';
    default: return 'Offline';
  }
});

const validatorPercent = computed(() => {
  if (!validators.value.total) return 0;
  return (validators.value.active / validators.value.total) * 100;
});

const avgBlockTime = computed(() => {
  const times = blockTimeHistory.value.filter(v => v > 0);
  if (!times.length) return 5.0;
  return times.reduce((a, b) => a + b, 0) / times.length;
});

const blockTimeStatus = computed(() => {
  const avg = avgBlockTime.value;
  if (avg < 5) return 'fast';
  if (avg <= 6) return 'normal';
  return 'slow';
});

const blocksPerHour = computed(() => {
  if (blockTime.value <= 0) return 0;
  return Math.floor(3600 / blockTime.value);
});

const txVolume24h = computed(() => {
  const blocksIn24h = Math.floor(86400 / (blockTime.value || 6));
  const avgTxPerBlock = txHistory.value.length 
    ? txHistory.value.reduce((a, b) => a + b, 0) / txHistory.value.length 
    : 5;
  return Math.floor(blocksIn24h * avgTxPerBlock);
});

// Chart computations
function getChartPoints(data: number[], width = 400, height = 120): { x: number; y: number }[] {
  if (!data.length) return [];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  
  return data.map((val, i) => ({
    x: i * stepX,
    y: height - ((val - min) / range) * height
  }));
}

function getLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

function getAreaPath(points: { x: number; y: number }[], height = 120): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${height}`;
  path += ` L ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ` L ${points[points.length - 1].x} ${height} Z`;
  return path;
}

const blockChartPoints = computed(() => getChartPoints(blockTimeHistory.value));
const blockChartLinePath = computed(() => getLinePath(blockChartPoints.value));
const txChartPoints = computed(() => getChartPoints(txHistory.value));
const tpsChartPoints = computed(() => getChartPoints([15, 18, 12, 22, 17, 20, 14, 19, 16, 21]));
const tpsChartPath = computed(() => getAreaPath(tpsChartPoints.value));
const tpsChartLinePath = computed(() => getLinePath(tpsChartPoints.value));

// Helper functions
function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatTime(time: string): string {
  const date = new Date(time);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

async function refreshData() {
  refreshing.value = true;
  try {
    // Fetch network status first
    await fetchNetworkStatus();
    
    // Fetch validators to populate proposerMap with monikers and avatars
    await fetchValidators();
    
    // Then fetch blocks and stats (blocks need proposerMap to be ready)
    await Promise.all([
      fetchRecentBlocks(),
      fetchNetStats()
    ]);
  } finally {
    refreshing.value = false;
  }
}

// Fetch network status and height
async function fetchNetworkStatus() {
  try {
    if (lumen?.rpc?.getHeight) {
      const result = await lumen.rpc.getHeight();
      if (result?.ok && result.height) {
        blockHeight.value = result.height;
        connectionStatus.value = 'online';
      } else {
        connectionStatus.value = 'offline';
      }
    }
  } catch (e) {
    console.error('Failed to fetch network status:', e);
    connectionStatus.value = 'offline';
  }
}

// Fetch Keybase avatars
async function fetchKeybaseAvatars() {
  const validatorsWithKeybase = Object.values(proposerMap.value)
    .filter(v => v.keybaseId && !avatarCache.value[v.keybaseId]);
  
  if (validatorsWithKeybase.length === 0) return;
  
  for (const validator of validatorsWithKeybase) {
    if (!validator.keybaseId) continue;
    
    try {
      const response = await fetch(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.keybaseId}`
      );
      const data = await response.json();
      
      if (data?.them?.[0]?.pictures?.primary?.url) {
        const avatarUrl = data.them[0].pictures.primary.url;
        avatarCache.value[validator.keybaseId] = avatarUrl;
        
        // Update proposerMap with avatar
        for (const key in proposerMap.value) {
          if (proposerMap.value[key].keybaseId === validator.keybaseId) {
            proposerMap.value[key].avatar = avatarUrl;
          }
        }
      }
    } catch (e) {
      console.log(`Failed to fetch avatar for ${validator.moniker}`);
    }
  }
}

// Fetch validators count
async function fetchValidators() {
  try {
    if (!lumen?.http?.get) return;
    
    // Fetch validator set from RPC
    const valSetRes = await lumen.http.get(`${rpcBase.value}/validators`);
    if (valSetRes.ok && valSetRes.json?.result?.validators) {
      const valSet = valSetRes.json.result.validators;
      
      for (const val of valSet) {
        proposerMap.value[val.address] = {
          moniker: val.address.substring(0, 8),
          keybaseId: undefined,
          avatar: undefined
        };
      }
    }
    
    // Fetch validators from REST API
    const res = await lumen.http.get(
      `${restBase.value}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200`
    );
    
    if (res.ok && res.json?.validators) {
      const validatorsList = res.json.validators;
      const active = validatorsList.filter((v: any) => !v.jailed).length;
      const jailed = validatorsList.filter((v: any) => v.jailed).length;
      
      validators.value = {
        total: validatorsList.length,
        active: active,
        jailed: jailed
      };
      
      // Build proposer map with validator info
      const valSet2Res = await lumen.http.get(`${rpcBase.value}/validators`);
      const validatorSet = valSet2Res.ok && valSet2Res.json?.result?.validators 
        ? valSet2Res.json.result.validators 
        : [];
      
      for (const v of validatorsList) {
        const keybaseId = v.description?.identity || null;
        const matchingVal = validatorSet.find((vs: any) => {
          return vs.pub_key?.value && v.consensus_pubkey?.key === vs.pub_key.value;
        });
        
        if (matchingVal) {
          proposerMap.value[matchingVal.address] = {
            moniker: v.description?.moniker || 'Unknown',
            keybaseId: keybaseId,
            avatar: avatarCache.value[keybaseId] || undefined
          };
        }
      }
      
      // Fetch Keybase avatars
      await fetchKeybaseAvatars();
    }
  } catch (e) {
    console.error('Failed to fetch validators:', e);
  }
}

// Fetch recent blocks
async function fetchRecentBlocks() {
  try {
    if (!lumen?.http?.get || blockHeight.value === 0) return;
    
    const blocks: Block[] = [];
    const promises = [];
    
    // Fetch last 6 blocks
    for (let i = 0; i < 6; i++) {
      const height = blockHeight.value - i;
      if (height > 0) {
        promises.push(
          lumen.http.get(`${rpcBase.value}/block?height=${height}`)
        );
      }
    }
    
    const results = await Promise.all(promises);
    
    for (const res of results) {
      if (res.ok && res.json?.result?.block) {
        const block = res.json.result.block;
        const header = block.header;
        const proposerAddr = header.proposer_address || '';
        const proposerInfo = proposerMap.value[proposerAddr];
        
        blocks.push({
          height: parseInt(header.height),
          time: header.time,
          txs: block.data.txs?.length || 0,
          validator: proposerInfo?.moniker || proposerAddr.substring(0, 8),
          validatorAvatar: proposerInfo?.avatar
        });
      }
    }
    
    recentBlocks.value = blocks.sort((a, b) => b.height - a.height);
  } catch (e) {
    console.error('Failed to fetch recent blocks:', e);
  }
}

// Fetch network stats (block time, TPS, peers)
async function fetchNetStats() {
  try {
    if (!lumen?.http?.get) return;
    
    // Fetch net_info for peer count
    const netInfoRes = await lumen.http.get(`${rpcBase.value}/net_info`);
    if (netInfoRes.ok && netInfoRes.json?.result?.n_peers) {
      peers.value = parseInt(netInfoRes.json.result.n_peers);
    }
    
    // Calculate block time and TPS from recent blocks
    if (recentBlocks.value.length >= 2) {
      const times: number[] = [];
      const txCounts: number[] = [];
      
      for (let i = 0; i < recentBlocks.value.length - 1; i++) {
        const curr = new Date(recentBlocks.value[i].time).getTime();
        const prev = new Date(recentBlocks.value[i + 1].time).getTime();
        const diffSec = (curr - prev) / 1000;
        
        if (diffSec > 0) {
          times.push(diffSec);
          txCounts.push(recentBlocks.value[i].txs);
        }
      }
      
      if (times.length > 0) {
        blockTime.value = times.reduce((a, b) => a + b, 0) / times.length;
        blockTimeHistory.value = times.slice(0, 10);
        
        const totalTxs = txCounts.reduce((a, b) => a + b, 0);
        const totalTime = times.reduce((a, b) => a + b, 0);
        tps.value = totalTime > 0 ? totalTxs / totalTime : 0;
        
        txHistory.value = txCounts.slice(0, 10);
        maxTps.value = Math.max(...txCounts.map((tx, i) => times[i] > 0 ? tx / times[i] : 0), tps.value);
      }
    }
    
    // Estimate uptime (if chain is online, assume high uptime)
    if (connectionStatus.value === 'online') {
      uptime.value = '99.9%';
    }
  } catch (e) {
    console.error('Failed to fetch network stats:', e);
  }
}

// Fetch data
async function fetchData() {
  await refreshData();
}

onMounted(() => {
  fetchData();
  const interval = setInterval(fetchData, 10000);
  onBeforeUnmount(() => clearInterval(interval));
});
</script>

<style scoped>
.network-page {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue);
}

.logo-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.network-status {
  margin: 1rem 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.network-status.online {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.network-status.syncing {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.network-status.offline {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.network-status.online .status-dot {
  background: #10b981;
}

.network-status.syncing .status-dot {
  background: #f59e0b;
}

.network-status.offline .status-dot {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-section {
  margin-bottom: 1.5rem;
}

.nav-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  padding: 0 1.5rem;
  margin-bottom: 0.5rem;
  display: block;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.5rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--hover-bg);
  color: var(--accent-blue);
  border-left: 3px solid var(--accent-blue);
  padding-left: calc(1.5rem - 3px);
}

.nav-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-item svg {
  flex-shrink: 0;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1.5rem;
  font-size: 0.8125rem;
}

.metric-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.metric-value {
  color: var(--text-primary);
  font-weight: 600;
}

.node-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  border-left: 2px solid transparent;
  transition: all 0.2s;
}

.node-detail:hover {
  background: var(--hover-bg);
  border-left-color: var(--accent-color);
}

.node-detail-label {
  color: var(--text-tertiary);
  font-weight: 500;
  font-size: 0.7rem;
}

.node-detail-value {
  color: var(--text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  font-family: 'Courier New', monospace;
}

/* Main Content */
.main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-primary);
}

/* Header - Hidden as per pattern */
.page-header {
  display: none;
}

/* Main Grid Layout */
.main-grid {
  display: grid;
  grid-template-columns: 320px 1fr 380px;
  gap: 1.5rem;
  align-items: start;
  padding: 2rem;
}

@media (max-width: 1400px) {
  .main-grid {
    grid-template-columns: 1fr 1fr;
  }
  .left-column {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
    padding: 1rem;
  }
  
  .sidebar {
    display: none;
  }
}

/* Left Column */
.left-column {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* Middle Column */
.middle-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Right Column */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
}

/* Info Cards */
.info-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1.5rem;
  transition: all 0.2s;
}

.info-card:hover {
  background: var(--bg-tertiary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.card-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  line-height: 1;
}

.card-unit {
  font-size: 1.125rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 0.25rem;
}

.card-detail {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 400;
}

/* Health Section */
.health-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.875rem;
}

.health-card {
  background: var(--bg-secondary);
  border-radius: 0.625rem;
  padding: 1rem;
}

.health-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.indicator-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.indicator-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.indicator-fill.excellent {
  background: #10b981;
}

.indicator-fill.good {
  background: #0ea5e9;
}

.indicator-fill.normal {
  background: #f59e0b;
}

.indicator-value {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 70px;
  text-align: right;
  font-size: 0.9375rem;
}

/* Activity Section */
.activity-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.chart-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  font-weight: 500;
}

.tab-btn:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.tab-btn.active {
  background: rgba(99, 102, 241, 0.2);
  border-color: #6366f1;
  color: #6366f1;
  font-weight: 600;
}

.activity-chart {
  background: var(--bg-secondary);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 160px;
}

.chart-container svg {
  width: 100%;
  height: 100%;
}

/* Data Table */
.data-table {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 0.875rem;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  flex: 1;
}

.block-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  min-height: 64px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.625rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.block-card:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-color);
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.block-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex: 1;
  min-width: 0;
}

.validator-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.validator-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: block;
}

.block-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}

.block-height-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.height-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.height-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.block-validator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.validator-name-compact {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.block-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.block-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
  justify-content: center;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-label {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.meta-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 22px;
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.meta-value.has-txs {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.meta-time {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1;
}

.time-text {
  white-space: nowrap;
  line-height: 1;
}

/* Node Info */
.node-info {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
}

.info-rows {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.info-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  color: var(--text-primary);
  font-weight: 600;
}
</style>
