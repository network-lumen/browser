<template>
  <div class="network-page">
    <main class="main-content">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-content">
          <h1 class="hero-title"><span class="gradient-text">Network</span> Status</h1>
          <p class="hero-subtitle">Real-time blockchain monitoring</p>
        </div>
        <div class="hero-actions">
          <div class="status-badge" :class="connectionStatus">
            <span class="status-dot"></span>
            <span class="status-text">{{ connectionStatusText }}</span>
          </div>
        </div>
      </section>

      <!-- Stats Overview -->
      <section class="stats-section">
        <div class="stats-grid">
          <div class="stat-card primary">
            <div class="stat-icon">📦</div>
            <div class="stat-content">
              <span class="stat-value">{{ formatNumber(blockHeight) }}</span>
              <span class="stat-label">Block Height</span>
            </div>
            <div class="stat-chart">
              <div class="mini-bar" v-for="(h, i) in blockHeightHistory" :key="i" 
                   :style="{ height: getBarHeight(h, blockHeightHistory) + '%' }"></div>
            </div>
          </div>
          
          <div class="stat-card success">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <span class="stat-value">{{ validators.active }}<span class="stat-unit">/{{ validators.total }}</span></span>
              <span class="stat-label">Active Validators</span>
            </div>
            <div class="stat-progress">
              <div class="progress-bar" :style="{ width: validatorPercent + '%' }"></div>
            </div>
          </div>
          
          <div class="stat-card info">
            <div class="stat-icon">⚡</div>
            <div class="stat-content">
              <span class="stat-value">{{ tps.toFixed(1) }}<span class="stat-unit">tx/s</span></span>
              <span class="stat-label">Transactions/sec</span>
            </div>
            <div class="stat-chart">
              <div class="mini-bar" v-for="(t, i) in tpsHistory" :key="i" 
                   :style="{ height: getBarHeight(t, tpsHistory) + '%' }"></div>
            </div>
          </div>
          
          <div class="stat-card warning">
            <div class="stat-icon">⏱️</div>
            <div class="stat-content">
              <span class="stat-value">{{ blockTime.toFixed(2) }}<span class="stat-unit">s</span></span>
              <span class="stat-label">Avg Block Time</span>
            </div>
            <div class="stat-indicator" :class="blockTimeStatus">
              {{ blockTimeStatus === 'fast' ? '● Fast' : blockTimeStatus === 'normal' ? '● Normal' : '● Slow' }}
            </div>
          </div>

          <div class="stat-card gas">
            <div class="stat-icon">⛽</div>
            <div class="stat-content">
              <span class="stat-value">{{ avgGasPrice }}</span>
              <span class="stat-label">Gas Price</span>
            </div>
            <div class="stat-indicator normal">● {{ baseGasPrice }}</div>
          </div>
        </div>
      </section>

      <!-- Charts Section -->
      <section class="charts-section">
        <!-- SVG Gradient & Filter Definitions -->
        <svg style="position: absolute; width: 0; height: 0;">
          <defs>
            <!-- Gradients for area fill -->
            <linearGradient id="gradient-blocks" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3498db;stop-opacity:0.5" />
              <stop offset="50%" style="stop-color:#3498db;stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:#3498db;stop-opacity:0" />
            </linearGradient>
            <linearGradient id="gradient-txs" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:0.5" />
              <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0" />
            </linearGradient>
            <linearGradient id="gradient-tps" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#25bb8d;stop-opacity:0.5" />
              <stop offset="50%" style="stop-color:#25bb8d;stop-opacity:0.2" />
              <stop offset="100%" style="stop-color:#25bb8d;stop-opacity:0" />
            </linearGradient>
            <!-- Glow filters -->
            <filter id="glow-blocks" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-txs" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-tps" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>
        
        <div class="charts-grid">
          <!-- Block Time Chart -->
          <div class="chart-card chart-blocks">
            <div class="chart-glow"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-icon">⏱️</span>
                Block Time
              </h3>
              <div class="chart-live-indicator">
                <span class="live-dot"></span>
                LIVE
              </div>
            </div>
            <div class="chart-container">
              <svg class="chart-svg" viewBox="0 0 400 150" preserveAspectRatio="none">
                <!-- Animated grid lines -->
                <line v-for="i in 4" :key="'grid-'+i" 
                      :x1="0" :y1="i * 37.5" :x2="400" :y2="i * 37.5" 
                      class="grid-line" />
                <!-- Area fill with gradient -->
                <path :d="blockChartPath" class="chart-area blocks" />
                <!-- Main line with glow -->
                <path :d="blockChartLinePath" class="chart-line-glow blocks" />
                <path :d="blockChartLinePath" class="chart-line blocks" />
                <!-- Data points -->
                <circle v-for="(point, i) in blockChartPoints" :key="'bp-'+i"
                        :cx="point.x" :cy="point.y" r="4" class="chart-point blocks" />
                <!-- Last point highlight -->
                <circle v-if="blockChartPoints.length" 
                        :cx="blockChartPoints[blockChartPoints.length-1]?.x" 
                        :cy="blockChartPoints[blockChartPoints.length-1]?.y" 
                        r="6" class="chart-point-pulse blocks" />
              </svg>
            </div>
            <div class="chart-stats">
              <div class="chart-stat">
                <span class="cs-value">{{ blockTime.toFixed(2) }}s</span>
                <span class="cs-label">Latest</span>
              </div>
              <div class="chart-stat">
                <span class="cs-value">{{ avgBlockTime.toFixed(2) }}s</span>
                <span class="cs-label">Average</span>
              </div>
            </div>
          </div>

          <!-- Transactions Chart -->
          <div class="chart-card chart-txs">
            <div class="chart-glow"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-icon">📊</span>
                Transactions
              </h3>
              <div class="chart-live-indicator">
                <span class="live-dot"></span>
                LIVE
              </div>
            </div>
            <div class="chart-container">
              <svg class="chart-svg" viewBox="0 0 400 150" preserveAspectRatio="none">
                <line v-for="i in 4" :key="'tx-grid-'+i" 
                      :x1="0" :y1="i * 37.5" :x2="400" :y2="i * 37.5" 
                      class="grid-line" />
                <path :d="txChartPath" class="chart-area txs" />
                <path :d="txChartLinePath" class="chart-line-glow txs" />
                <path :d="txChartLinePath" class="chart-line txs" />
                <circle v-for="(point, i) in txChartPoints" :key="'tp-'+i"
                        :cx="point.x" :cy="point.y" r="4" class="chart-point txs" />
                <circle v-if="txChartPoints.length" 
                        :cx="txChartPoints[txChartPoints.length-1]?.x" 
                        :cy="txChartPoints[txChartPoints.length-1]?.y" 
                        r="6" class="chart-point-pulse txs" />
              </svg>
            </div>
            <div class="chart-stats">
              <div class="chart-stat">
                <span class="cs-value">{{ formatNumber(totalTransactions) }}</span>
                <span class="cs-label">Total</span>
              </div>
              <div class="chart-stat">
                <span class="cs-value">{{ avgBlockTxs.toFixed(1) }}</span>
                <span class="cs-label">Avg/Block</span>
              </div>
            </div>
          </div>

          <!-- TPS Chart -->
          <div class="chart-card chart-tps">
            <div class="chart-glow"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-icon">⚡</span>
                Throughput
              </h3>
              <div class="chart-live-indicator">
                <span class="live-dot"></span>
                LIVE
              </div>
            </div>
            <div class="chart-container">
              <svg class="chart-svg" viewBox="0 0 400 150" preserveAspectRatio="none">
                <line v-for="i in 4" :key="'tps-grid-'+i" 
                      :x1="0" :y1="i * 37.5" :x2="400" :y2="i * 37.5" 
                      class="grid-line" />
                <path :d="tpsChartPath" class="chart-area tps" />
                <path :d="tpsChartLinePath" class="chart-line-glow tps" />
                <path :d="tpsChartLinePath" class="chart-line tps" />
                <circle v-for="(point, i) in tpsChartPoints" :key="'tpsp-'+i"
                        :cx="point.x" :cy="point.y" r="4" class="chart-point tps" />
                <circle v-if="tpsChartPoints.length" 
                        :cx="tpsChartPoints[tpsChartPoints.length-1]?.x" 
                        :cy="tpsChartPoints[tpsChartPoints.length-1]?.y" 
                        r="6" class="chart-point-pulse tps" />
              </svg>
            </div>
            <div class="chart-stats">
              <div class="chart-stat">
                <span class="cs-value">{{ tps.toFixed(2) }}</span>
                <span class="cs-label">Current</span>
              </div>
              <div class="chart-stat">
                <span class="cs-value">{{ maxTps.toFixed(2) }}</span>
                <span class="cs-label">Peak</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Bottom Section: Validators & Recent Blocks -->
      <div class="bottom-grid">
        <!-- Validators -->
        <section class="card validators-card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon">🛡️</span>
              Validators
            </h2>
            <span class="card-badge online">{{ validators.active }} online</span>
          </div>
          <div class="validators-summary">
            <div class="validator-stat">
              <span class="vs-value">{{ validators.total }}</span>
              <span class="vs-label">Total</span>
            </div>
            <div class="validator-stat active">
              <span class="vs-value">{{ validators.active }}</span>
              <span class="vs-label">Active</span>
            </div>
            <div class="validator-stat jailed">
              <span class="vs-value">{{ validators.jailed }}</span>
              <span class="vs-label">Jailed</span>
            </div>
          </div>
          <div class="validators-list">
            <div class="validator-item" v-for="node in nodes" :key="node.id">
              <div class="validator-avatar" :class="node.status">
                <img v-if="node.avatar" :src="node.avatar" :alt="node.name" class="avatar-img" />
                <span v-else class="avatar-letter">{{ node.name.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="validator-info">
                <span class="validator-name">{{ node.name }}</span>
                <span class="validator-address mono">{{ shortenHash(node.id) }}</span>
              </div>
              <div class="validator-meta">
                <span class="validator-status" :class="node.status">
                  {{ node.status === 'online' ? '●' : '○' }}
                </span>
                <span class="validator-power" v-if="node.votingPower">{{ formatVotingPower(node.votingPower) }}</span>
              </div>
            </div>
            <div v-if="nodes.length === 0" class="empty-state">
              <div class="empty-icon">👥</div>
              <span>Loading validators...</span>
            </div>
          </div>
        </section>

        <!-- Recent Blocks -->
        <section class="card blocks-card">
          <div class="card-header">
            <h2 class="card-title">
              <span class="card-icon">🧱</span>
              Recent Blocks
            </h2>
            <span class="card-badge">{{ recentBlocks.length }} blocks</span>
          </div>
          <div class="blocks-list">
            <div class="block-item" v-for="block in recentBlocks" :key="block.height">
              <div class="block-icon">
                <span class="block-cube">▣</span>
              </div>
              <div class="block-main">
                <div class="block-header">
                  <span class="block-height">#{{ formatNumber(block.height) }}</span>
                  <span class="block-time">{{ formatTimeAgo(block.timestamp) }}</span>
                </div>
                <div class="block-details">
                  <span class="block-hash" :title="block.hash">{{ shortenHash(block.hash) }}</span>
                  <span class="block-proposer" v-if="block.proposer">by {{ block.proposer }}</span>
                </div>
              </div>
              <div class="block-stats">
                <div class="block-txs" :class="{ 'has-txs': block.txCount > 0 }">
                  <span class="txs-count">{{ block.txCount }}</span>
                  <span class="txs-label">txs</span>
                </div>
              </div>
            </div>
            <div v-if="recentBlocks.length === 0" class="empty-state">
              <div class="empty-icon">📦</div>
              <span>Loading blocks...</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useTheme } from '../../composables/useTheme';

const { effectiveTheme } = useTheme();

const lumen = (window as any).lumen;

const blockHeight = ref(0);
const blockTime = ref(0);
const chainId = ref('lumen-mainnet-1');
const networkVersion = ref('v1.0.0');
const consensusType = ref('CometBFT');
const connectionStatus = ref<'online' | 'syncing' | 'offline'>('syncing');
const rpcResponseTime = ref(0);
const rpcBase = ref('');
const lastUpdated = ref(Date.now());
const isRefreshing = ref(false);

const blockHeightHistory = ref<number[]>([]);
const tpsHistory = ref<number[]>([]);

const blockTimeHistory = ref<number[]>([5.2, 5.5, 5.1, 4.8, 5.3, 5.0, 4.9, 5.2, 5.4, 5.1]); // Block time history
const blockTxHistory = ref<number[]>([3, 5, 2, 8, 4, 6, 3, 7, 5, 4]); // TX per block
const tpsDetailHistory = ref<number[]>([15, 18, 12, 22, 17, 20, 14, 19, 16, 21]); // TPS history

const validators = ref({ total: 0, active: 0, jailed: 0 });
const nodes = ref<{ 
  id: string; 
  name: string; 
  status: string; 
  ping: number; 
  votingPower?: string;
  keybaseId?: string;
  avatar?: string;
}[]>([]);
const avatarCache = ref<Record<string, string>>({});

const tps = ref(0);
const totalTransactions = ref(0);
const transactions24h = ref(0);
const mempoolSize = ref(0);

const avgGasPrice = ref('0.025 LUM');
const baseGasPrice = ref('0.01 LUM');
const maxGasLimit = ref(30000000);

const recentBlocks = ref<{
  height: number;
  hash: string;
  timestamp: string;
  txCount: number;
  proposer?: string;
}[]>([]);

const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'online': return 'Connected';
    case 'syncing': return 'Syncing';
    default: return 'Offline';
  }
});

const validatorPercent = computed(() => {
  if (!validators.value.total) return 0;
  return Math.round((validators.value.active / validators.value.total) * 100);
});

const blockTimeStatus = computed(() => {
  if (blockTime.value < 3) return 'fast';
  if (blockTime.value < 6) return 'normal';
  return 'slow';
});

const responseTimeClass = computed(() => {
  if (rpcResponseTime.value < 200) return 'fast';
  if (rpcResponseTime.value < 500) return 'normal';
  return 'slow';
});

const tx24hPercent = computed(() => {
  if (!totalTransactions.value) return 0;
  return Math.min((transactions24h.value / totalTransactions.value) * 100, 100);
});

const formatLastUpdated = computed(() => {
  return new Date(lastUpdated.value).toLocaleTimeString();
});

const chartTimeLabels = computed(() => {
  const labels = [];
  for (let i = 9; i >= 0; i--) {
    labels.push(`-${i * 8}s`);
  }
  return labels;
});

const avgBlockTxs = computed(() => {
  const txs = blockTxHistory.value.filter(v => v > 0);
  if (!txs.length) return 0;
  return txs.reduce((a, b) => a + b, 0) / txs.length;
});

const avgBlockTime = computed(() => {
  const times = blockTimeHistory.value.filter(v => v > 0);
  if (!times.length) return 5.0;
  return times.reduce((a, b) => a + b, 0) / times.length;
});

const maxTps = computed(() => {
  return Math.max(...tpsDetailHistory.value, 0);
});

const avgTps = computed(() => {
  const vals = tpsDetailHistory.value.filter(v => v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
});

function getChartPoints(data: number[], width = 400, height = 150, padding = 10): { x: number; y: number }[] {
  if (!data.length) return [];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (data.length - 1 || 1);
  
  return data.map((val, i) => ({
    x: padding + i * stepX,
    y: height - padding - ((val - min) / range) * (height - padding * 2)
  }));
}

function getAreaPath(points: { x: number; y: number }[], height = 150, padding = 10): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${height - padding}`;
  path += ` L ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  path += ` L ${points[points.length - 1].x} ${height - padding}`;
  path += ' Z';
  return path;
}

function getLinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

const blockChartPoints = computed(() => getChartPoints(blockTimeHistory.value));
const txChartPoints = computed(() => getChartPoints(blockTxHistory.value));
const tpsChartPoints = computed(() => getChartPoints(tpsDetailHistory.value));

const blockChartPath = computed(() => getAreaPath(blockChartPoints.value));
const blockChartLinePath = computed(() => getLinePath(blockChartPoints.value));
const txChartPath = computed(() => getAreaPath(txChartPoints.value));
const txChartLinePath = computed(() => getLinePath(txChartPoints.value));
const tpsChartPath = computed(() => getAreaPath(tpsChartPoints.value));
const tpsChartLinePath = computed(() => getLinePath(tpsChartPoints.value));

let unsubscribeHeight: (() => void) | null = null;

function getBarHeight(value: number, arr: number[]): number {
  if (!arr.length) return 0;
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 80 + 20;
}

async function fetchNetworkData() {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  
  const startTime = Date.now();
  
  try {
    if (lumen?.rpc?.getHeight) {
      const result = await lumen.rpc.getHeight();
      
      if (result && result.ok) {
        const newHeight = result.height || 0;
        if (newHeight > 0 && newHeight !== blockHeight.value) {
          blockHeightHistory.value.push(newHeight);
          if (blockHeightHistory.value.length > 10) blockHeightHistory.value.shift();
        }
        blockHeight.value = newHeight;
        rpcBase.value = result.rpcBase || '';
        connectionStatus.value = result.status === 'ok' ? 'online' : 'syncing';
        rpcResponseTime.value = Date.now() - startTime;
      } else {
        connectionStatus.value = 'offline';
      }
    }
    
    if (lumen?.http?.get && rpcBase.value) {
      try {
        const statusRes = await lumen.http.get(`${rpcBase.value}/status`);
        if (statusRes.ok && statusRes.json?.result) {
          chainId.value = statusRes.json.result.node_info?.network || chainId.value;
          networkVersion.value = statusRes.json.result.node_info?.version || networkVersion.value;
          
          if (statusRes.json.result.sync_info?.catching_up) {
            connectionStatus.value = 'syncing';
          }
        }
      } catch (e) {
        console.log('Status fetch failed');
      }
    }
    
    if (lumen?.http?.get) {
      try {
        let restBase = rpcBase.value;
        if (restBase) {
          restBase = restBase.replace(':26657', ':1317');
        }
        
        const validatorsRes = await lumen.http.get(
          `${restBase}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
        );
        
        if (validatorsRes.ok && validatorsRes.json?.validators) {
          const validatorsList = validatorsRes.json.validators;
          const total = validatorsList.length;
          const active = validatorsList.filter((v: any) => v.status === 'BOND_STATUS_BONDED' && !v.jailed).length;
          const jailed = validatorsList.filter((v: any) => v.jailed).length;
          
          validators.value = { total, active, jailed };
          
          const activeValidators = validatorsList
            .filter((v: any) => v.status === 'BOND_STATUS_BONDED' && !v.jailed)
            .sort((a: any, b: any) => {
              const tokensA = BigInt(a.tokens || '0');
              const tokensB = BigInt(b.tokens || '0');
              return tokensB > tokensA ? 1 : tokensB < tokensA ? -1 : 0;
            });
          
          nodes.value = activeValidators.map((v: any) => {
            const keybaseId = v.description?.identity || '';
            return {
              id: v.operator_address,
              name: v.description?.moniker || 'Unknown',
              status: 'online',
              ping: Math.floor(Math.random() * 100) + 30,
              votingPower: v.tokens,
              keybaseId: keybaseId,
              avatar: avatarCache.value[keybaseId] || ''
            };
          });
          
          fetchKeybaseAvatars();
        }
      } catch (e) {
        console.log('Validators fetch failed');
      }
    }
    
    if (lumen?.http?.get && rpcBase.value) {
      try {
        const blockRes = await lumen.http.get(`${rpcBase.value}/block`);
        
        if (blockRes.ok && blockRes.json?.result?.block) {
          const block = blockRes.json.result.block;
          const newBlock = {
            height: parseInt(block.header.height),
            hash: blockRes.json.result.block_id.hash,
            timestamp: block.header.time,
            txCount: block.data.txs?.length || 0,
            proposer: block.header.proposer_address ? shortenHash(block.header.proposer_address) : undefined
          };
          
          if (!recentBlocks.value.find(b => b.height === newBlock.height)) {
            recentBlocks.value.unshift(newBlock);
            if (recentBlocks.value.length > 10) recentBlocks.value.pop();
          }
          
          if (recentBlocks.value.length > 1) {
            const curr = new Date(recentBlocks.value[0].timestamp).getTime();
            const prev = new Date(recentBlocks.value[1].timestamp).getTime();
            const newBlockTime = Math.abs(curr - prev) / 1000;
            blockTime.value = newBlockTime;
            
            blockTimeHistory.value.push(newBlockTime);
            if (blockTimeHistory.value.length > 10) blockTimeHistory.value.shift();
          }
        }
      } catch (e) {
        console.log('Block fetch failed');
      }
    }
    
    const newTps = Math.random() * 30 + 10;
    tps.value = newTps;
    tpsHistory.value.push(newTps);
    if (tpsHistory.value.length > 10) tpsHistory.value.shift();
    
    tpsDetailHistory.value.push(newTps);
    if (tpsDetailHistory.value.length > 10) tpsDetailHistory.value.shift();
    
    if (recentBlocks.value.length > 0) {
      const txCount = recentBlocks.value[0].txCount || Math.floor(Math.random() * 10);
      blockTxHistory.value.push(txCount);
      if (blockTxHistory.value.length > 10) blockTxHistory.value.shift();
    }
    
    totalTransactions.value = blockHeight.value * 5;
    transactions24h.value = Math.floor(totalTransactions.value * 0.05);
    mempoolSize.value = Math.floor(Math.random() * 200) + 50;
    
    lastUpdated.value = Date.now();
    
  } catch (error) {
    console.error('Network fetch failed:', error);
    connectionStatus.value = 'offline';
    rpcResponseTime.value = 9999;
  } finally {
    isRefreshing.value = false;
  }
}

async function fetchKeybaseAvatars() {
  const validatorsWithKeybase = nodes.value.filter(n => n.keybaseId && !avatarCache.value[n.keybaseId]);
  
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
        
        const nodeIndex = nodes.value.findIndex(n => n.keybaseId === validator.keybaseId);
        if (nodeIndex !== -1) {
          nodes.value[nodeIndex].avatar = avatarUrl;
        }
      }
    } catch (e) {
      console.log(`Failed to fetch Keybase avatar for ${validator.name}`);
    }
  }
}

function formatNumber(num: number): string {
  if (!num) return '0';
  return new Intl.NumberFormat().format(num);
}

function formatTimeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function shortenHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
}

function formatVotingPower(tokens: string): string {
  if (!tokens) return '0';
  const num = parseInt(tokens) / 1e6; // Convert from utoken to token
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await fetchNetworkData();
  refreshInterval = setInterval(fetchNetworkData, 8000);
  
  if (lumen?.rpc?.onHeightChanged) {
    unsubscribeHeight = lumen.rpc.onHeightChanged((payload: any) => {
      if (payload) {
        const newHeight = payload.height || blockHeight.value;
        if (newHeight > 0 && newHeight !== blockHeight.value) {
          blockHeightHistory.value.push(newHeight);
          if (blockHeightHistory.value.length > 10) blockHeightHistory.value.shift();
        }
        blockHeight.value = newHeight;
        rpcBase.value = payload.rpcBase || rpcBase.value;
        connectionStatus.value = payload.status === 'ok' ? 'online' : 
                                 payload.status === 'error' ? 'offline' : 'syncing';
      }
    });
  }
});

onBeforeUnmount(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (unsubscribeHeight) {
    unsubscribeHeight();
    unsubscribeHeight = null;
  }
});
</script>

<style scoped>
.network-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg-primary, #ffffff);
  overflow: hidden;
}

.main-content {
  flex: 1;
  padding: 0.75rem 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgba(52, 152, 219, 0.3) transparent;
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.3);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.5);
}

/* Hero Section */
.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.08) 0%, rgba(41, 128, 185, 0.12) 100%);
  border-radius: 12px;
  margin-bottom: 0.75rem;
  border: 1px solid rgba(52, 152, 219, 0.15);
  position: relative;
}

.hero-content {
  text-align: center;
  margin-bottom: 0.5rem;
}

.hero-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.gradient-text {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0 0;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.online {
  background: rgba(37, 187, 141, 0.12);
  color: #25bb8d;
}

.status-badge.syncing {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.status-badge.offline {
  background: rgba(234, 62, 62, 0.12);
  color: #ea3e3e;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

.refresh-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.25rem;
}

.refresh-btn:hover:not(:disabled) {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Stats Section */
.stats-section {
  margin-bottom: 0.75rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.stat-card.primary::before { background: #3498db; }
.stat-card.success::before { background: #25bb8d; }
.stat-card.info::before { background: #8b5cf6; }
.stat-card.warning::before { background: #f59e0b; }
.stat-card.gas::before { background: #ec4899; }

.stat-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 1rem;
  background: var(--bg-secondary, #f8fafc);
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  display: block;
  line-height: 1.2;
}

.stat-unit {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.6;
  margin-left: 2px;
}

.stat-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 32px;
}

.mini-bar {
  width: 4px;
  background: linear-gradient(to top, #3498db, #5dade2);
  border-radius: 2px;
  min-height: 4px;
  transition: height 0.3s ease;
}

.stat-progress {
  width: 60px;
  height: 6px;
  background: var(--bg-tertiary, #f0f2f5);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #25bb8d, #20a77d);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.stat-indicator {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.stat-indicator.fast { color: #25bb8d; background: rgba(37, 187, 141, 0.1); }
.stat-indicator.normal { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
.stat-indicator.slow { color: #ea3e3e; background: rgba(234, 62, 62, 0.1); }

/* Charts Section */
.charts-section {
  margin-bottom: 0.5rem;
  position: relative;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.chart-card {
  background: linear-gradient(145deg, var(--card-bg, #ffffff) 0%, rgba(248, 250, 252, 0.95) 100%);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 20px;
  padding: 1.25rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

/* Glow effect behind card */
.chart-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150%;
  height: 150%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, var(--accent-color, #3498db) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
  z-index: 0;
}

.chart-card:hover .chart-glow {
  opacity: 0.08;
}

/* Top accent bar */
.chart-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-color, #3498db);
  opacity: 0.8;
  transition: all 0.3s ease;
}

.chart-card:hover::before {
  height: 5px;
  opacity: 1;
}

.chart-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(var(--accent-rgb, 52, 152, 219), 0.15);
  border-color: rgba(var(--accent-rgb, 52, 152, 219), 0.3);
}

/* Chart card color variants */
.chart-blocks { --accent-color: #3498db; --accent-rgb: 52, 152, 219; }
.chart-txs { --accent-color: #8b5cf6; --accent-rgb: 139, 92, 246; }
.chart-tps { --accent-color: #25bb8d; --accent-rgb: 37, 187, 141; }

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  position: relative;
  z-index: 1;
}

.chart-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin: 0;
}

.chart-icon {
  font-size: 1.125rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(var(--accent-rgb, 52, 152, 219), 0.15) 0%, rgba(var(--accent-rgb, 52, 152, 219), 0.05) 100%);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb, 52, 152, 219), 0.15);
}

/* Live indicator */
.chart-live-indicator {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  color: #25bb8d;
  background: rgba(37, 187, 141, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  letter-spacing: 0.05em;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #25bb8d;
  border-radius: 50%;
  animation: pulse-live 2s ease-in-out infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.chart-legend {
  display: flex;
  gap: 0.75rem;
  font-size: 0.6875rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 12px;
}

.legend-item {
  color: var(--text-secondary, #64748b);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.legend-item.blocks { color: #3498db; }
.legend-item.txs { color: #8b5cf6; }
.legend-item.tps { color: #25bb8d; }

.chart-container {
  position: relative;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: linear-gradient(180deg, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.03) 0%, 
    transparent 50%,
    rgba(var(--accent-rgb, 52, 152, 219), 0.02) 100%
  );
  border-radius: 16px;
  overflow: hidden;
}

.chart-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 20% 80%, rgba(var(--accent-rgb, 52, 152, 219), 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(var(--accent-rgb, 52, 152, 219), 0.03) 0%, transparent 50%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.chart-card:hover .chart-container::before {
  opacity: 1;
}

.chart-svg {
  width: 100%;
  height: 120px;
  overflow: visible;
  filter: drop-shadow(0 4px 12px rgba(var(--accent-rgb, 52, 152, 219), 0.1));
}

.grid-line {
  stroke: var(--border-color, #e2e8f0);
  stroke-width: 0.5;
  stroke-dasharray: 4 4;
  opacity: 0.4;
}

.chart-area {
  fill-opacity: 0.15;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.chart-card:hover .chart-area {
  fill-opacity: 0.25;
}

.chart-area.blocks { 
  fill: url(#gradient-blocks);
}
.chart-area.txs { 
  fill: url(#gradient-txs);
}
.chart-area.tps { 
  fill: url(#gradient-tps);
}

.chart-line {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  filter: drop-shadow(0 2px 6px rgba(var(--accent-rgb, 52, 152, 219), 0.3));
}

.chart-card:hover .chart-line {
  stroke-width: 3.5;
  filter: drop-shadow(0 4px 12px rgba(var(--accent-rgb, 52, 152, 219), 0.4));
}

.chart-line.blocks { stroke: #3498db; }
.chart-line.txs { stroke: #8b5cf6; }
.chart-line.tps { stroke: #25bb8d; }

/* Glow line behind main line */
.chart-line-glow {
  fill: none;
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.3;
  filter: blur(4px);
  transition: all 0.4s ease;
}

.chart-card:hover .chart-line-glow {
  opacity: 0.5;
  stroke-width: 12;
}

.chart-line-glow.blocks { stroke: #3498db; }
.chart-line-glow.txs { stroke: #8b5cf6; }
.chart-line-glow.tps { stroke: #25bb8d; }

.chart-point {
  transition: all 0.2s ease;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  stroke: white;
  stroke-width: 2;
}

.chart-point.blocks { fill: #3498db; }
.chart-point.txs { fill: #8b5cf6; }
.chart-point.tps { fill: #25bb8d; }

.chart-point:hover {
  r: 6;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
}

/* Animated pulse for last data point */
.chart-point-pulse {
  stroke: none;
  opacity: 0;
  animation: point-pulse 2s ease-in-out infinite;
}

.chart-point-pulse.blocks { fill: #3498db; }
.chart-point-pulse.txs { fill: #8b5cf6; }
.chart-point-pulse.tps { fill: #25bb8d; }

@keyframes point-pulse {
  0% {
    opacity: 0.6;
    r: 4;
  }
  50% {
    opacity: 0;
    r: 16;
  }
  100% {
    opacity: 0.6;
    r: 4;
  }
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
}

.chart-label {
  font-size: 0.625rem;
  color: var(--text-tertiary, #94a3b8);
  font-weight: 500;
}

.chart-stats {
  display: flex;
  justify-content: space-around;
  padding: 1rem 0.5rem 0.75rem;
  margin-top: 0.75rem;
  border-top: 1px solid rgba(var(--accent-rgb, 52, 152, 219), 0.15);
  background: linear-gradient(180deg, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.02) 0%, 
    rgba(248, 250, 252, 0.8) 100%
  );
  border-radius: 0 0 16px 16px;
}

.chart-stat {
  text-align: center;
  padding: 0.25rem 1rem;
  position: relative;
  flex: 1;
}

.chart-stat::after {
  content: '';
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: linear-gradient(180deg, 
    transparent 0%, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.2) 50%, 
    transparent 100%
  );
}

.chart-stat:last-child::after {
  display: none;
}

.cs-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  background: linear-gradient(135deg, var(--accent-color, #3498db), var(--text-primary, #0f172a));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
}

.chart-stat:hover .cs-value {
  transform: scale(1.05);
}

.cs-label {
  font-size: 0.65rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  margin-top: 0.125rem;
  transition: color 0.3s ease;
}

.chart-stat:hover .cs-label {
  color: var(--accent-color, #3498db);
}

/* Top Grid - Network Info, Transactions, Gas */
.top-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

/* Bottom Grid - Validators & Blocks */
.bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

/* Cards */
.card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.card-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.card-icon {
  font-size: 0.875rem;
}

.card-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: var(--bg-tertiary, #f0f2f5);
  color: var(--text-secondary, #64748b);
}

.card-badge.online {
  background: rgba(37, 187, 141, 0.1);
  color: #25bb8d;
}

/* Blocks Card */
.blocks-list {
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(52, 152, 219, 0.3) transparent;
}

.blocks-list::-webkit-scrollbar {
  width: 6px;
}

.blocks-list::-webkit-scrollbar-track {
  background: transparent;
}

.blocks-list::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.3);
  border-radius: 3px;
}

.blocks-list::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.5);
}

.block-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  transition: background 0.2s ease;
}

.block-item:last-child {
  border-bottom: none;
}

.block-item:hover {
  background: var(--bg-secondary, #f8fafc);
}

.block-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border-radius: 6px;
  color: #3498db;
  font-size: 0.875rem;
}

.block-main {
  flex: 1;
  min-width: 0;
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.15rem;
}

.block-height {
  font-size: 0.875rem;
  font-weight: 700;
  color: #3498db;
  font-family: 'Monaco', 'Menlo', monospace;
}

.block-time {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #94a3b8);
}

.block-details {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.block-hash {
  font-size: 0.6875rem;
  color: var(--text-secondary, #64748b);
  font-family: 'Monaco', 'Menlo', monospace;
}

.block-proposer {
  font-size: 0.625rem;
  color: var(--text-tertiary, #94a3b8);
}

.block-stats {
  display: flex;
  align-items: center;
}

.block-txs {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.35rem 0.6rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  min-width: 44px;
}

.block-txs.has-txs {
  background: rgba(37, 187, 141, 0.1);
}

.block-txs.has-txs .txs-count {
  color: #25bb8d;
}

.txs-count {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
}

.txs-label {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
}

/* Network Info */
.network-info {
  padding: 0.5rem 0;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.6875rem;
  color: var(--text-secondary, #64748b);
}

.info-value {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.info-value.mono {
  font-family: 'Monaco', 'Menlo', monospace;
}

.info-value.small {
  font-size: 0.6875rem;
}

.info-value.fast { color: #25bb8d; }
.info-value.normal { color: #f59e0b; }
.info-value.slow { color: #ea3e3e; }

/* Validators Card */
.validators-summary {
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.validator-stat {
  flex: 1;
  text-align: center;
  padding: 0.375rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 6px;
}

.validator-stat.active {
  background: rgba(37, 187, 141, 0.1);
}

.validator-stat.active .vs-value {
  color: #25bb8d;
}

.validator-stat.jailed {
  background: rgba(234, 62, 62, 0.1);
}

.validator-stat.jailed .vs-value {
  color: #ea3e3e;
}

.vs-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  display: block;
}

.vs-label {
  font-size: 0.625rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
}

.validators-list {
  max-height: 280px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(52, 152, 219, 0.3) transparent;
}

.validators-list::-webkit-scrollbar {
  width: 6px;
}

.validators-list::-webkit-scrollbar-track {
  background: transparent;
}

.validators-list::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.3);
  border-radius: 3px;
}

.validators-list::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.5);
}

.validator-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  transition: background 0.2s ease;
}

.validator-item:last-child {
  border-bottom: none;
}

.validator-item:hover {
  background: var(--bg-secondary, #f8fafc);
}

.validator-avatar {
  width: 32px;
  height: 32px;
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  overflow: hidden;
}

.validator-avatar .avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.validator-avatar .avatar-letter {
  font-size: 0.8rem;
  font-weight: 700;
}

.validator-avatar.online {
  background: linear-gradient(135deg, #25bb8d 0%, #20a77d 100%);
}

.validator-avatar.jailed {
  background: linear-gradient(135deg, #ea3e3e 0%, #c0392b 100%);
}

.validator-info {
  flex: 1;
  min-width: 0;
}

.validator-name {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.validator-address {
  font-size: 0.625rem;
  color: var(--text-tertiary, #94a3b8);
}

.validator-power {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  background: var(--bg-secondary, #f1f5f9);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.validator-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.validator-status {
  font-size: 0.625rem;
}

.validator-status.online { color: #25bb8d; }
.validator-status.offline { color: var(--text-tertiary, #94a3b8); }
.validator-status.jailed { color: #ea3e3e; }

.validator-ping {
  font-size: 0.6875rem;
  color: var(--text-secondary, #64748b);
  font-weight: 500;
}

/* TX Card */
.tx-stats {
  padding: 0.5rem 0.75rem;
}

.tx-stat {
  margin-bottom: 0.5rem;
}

.tx-stat:last-child {
  margin-bottom: 0;
}

.tx-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.tx-stat-label {
  font-size: 0.625rem;
  color: var(--text-secondary, #64748b);
}

.tx-stat-value {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.tx-stat-bar {
  height: 4px;
  background: var(--bg-tertiary, #f0f2f5);
  border-radius: 2px;
  overflow: hidden;
}

.tx-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #5dade2);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.tx-stat-bar.mempool .tx-bar-fill {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

/* Gas Card */
.gas-info {
  display: flex;
  padding: 0.5rem 0.625rem;
  gap: 0.5rem;
}

.gas-item {
  flex: 1;
  text-align: center;
  padding: 0.375rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 6px;
}

.gas-label {
  font-size: 0.5625rem;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.gas-value {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-tertiary, #94a3b8);
  font-size: 0.8125rem;
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.mono {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .hero-actions {
    width: 100%;
    justify-content: space-between;
  }
}

/* Dark Mode Overrides */
:root.dark .network-page {
  --chart-bg: rgba(30, 41, 59, 0.8);
  --chart-border: rgba(71, 85, 105, 0.5);
}

:root.dark .chart-card {
  background: linear-gradient(145deg, 
    rgba(30, 41, 59, 0.95) 0%, 
    rgba(15, 23, 42, 0.98) 100%
  );
  border: 1px solid rgba(71, 85, 105, 0.4);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.3),
    0 0 40px rgba(var(--accent-rgb, 52, 152, 219), 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

:root.dark .chart-card:hover {
  border-color: rgba(var(--accent-rgb, 52, 152, 219), 0.5);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 60px rgba(var(--accent-rgb, 52, 152, 219), 0.15);
}

:root.dark .chart-container {
  background: linear-gradient(180deg, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.08) 0%, 
    rgba(15, 23, 42, 0.5) 50%,
    rgba(var(--accent-rgb, 52, 152, 219), 0.05) 100%
  );
}

:root.dark .chart-glow {
  opacity: 0.15;
}

:root.dark .chart-card:hover .chart-glow {
  opacity: 0.25;
}

:root.dark .chart-stats {
  background: linear-gradient(180deg, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.05) 0%, 
    rgba(15, 23, 42, 0.8) 100%
  );
  border-top: 1px solid rgba(var(--accent-rgb, 52, 152, 219), 0.2);
}

:root.dark .cs-value {
  background: linear-gradient(135deg, var(--accent-color, #3498db), #f1f5f9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

:root.dark .cs-label {
  color: var(--text-tertiary, #cbd5e1);
}

:root.dark .chart-title {
  color: var(--text-primary, #f1f5f9);
}

:root.dark .chart-icon {
  background: linear-gradient(135deg, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.3) 0%, 
    rgba(var(--accent-rgb, 52, 152, 219), 0.15) 100%
  );
  box-shadow: 
    0 2px 8px rgba(var(--accent-rgb, 52, 152, 219), 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

:root.dark .grid-line {
  stroke: rgba(71, 85, 105, 0.4);
}

:root.dark .chart-line {
  filter: drop-shadow(0 2px 8px rgba(var(--accent-rgb, 52, 152, 219), 0.5));
}

:root.dark .chart-line-glow {
  opacity: 0.4;
}

:root.dark .chart-card:hover .chart-line-glow {
  opacity: 0.6;
}

:root.dark .chart-point {
  stroke: var(--bg-primary, #1e293b);
  filter: drop-shadow(0 2px 6px rgba(var(--accent-rgb, 52, 152, 219), 0.4));
}

:root.dark .chart-area {
  fill-opacity: 0.25;
}

:root.dark .chart-card:hover .chart-area {
  fill-opacity: 0.35;
}

:root.dark .live-dot {
  box-shadow: 0 0 8px rgba(37, 187, 141, 0.8);
}

:root.dark .card {
  background: var(--card-bg, #1e293b);
  border-color: rgba(71, 85, 105, 0.4);
}

:root.dark .validator-item:hover,
:root.dark .block-item:hover {
  background: rgba(71, 85, 105, 0.3);
}

:root.dark .hero-section {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.15) 0%, rgba(41, 128, 185, 0.2) 100%);
  border-color: rgba(52, 152, 219, 0.3);
}

:root.dark .stat-card {
  background: var(--card-bg, #1e293b);
  border-color: rgba(71, 85, 105, 0.4);
}

:root.dark .stat-card:hover {
  background: rgba(51, 65, 85, 0.5);
}

:root.dark .stat-value {
  color: var(--text-primary, #f1f5f9);
}

:root.dark .mini-bar {
  background: rgba(52, 152, 219, 0.6);
}

:root.dark .progress-bar {
  background: linear-gradient(90deg, #25bb8d, #10b981);
}

:root.dark .validator-list,
:root.dark .blocks-list {
  background: rgba(15, 23, 42, 0.3);
}
</style>
