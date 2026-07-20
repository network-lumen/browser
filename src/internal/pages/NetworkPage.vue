<template>
  <div class="network-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Network" :icon="Network" activeKey="network">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Monitoring</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': activeView === 'status' }"
            @click="activeView = 'status'"
          >
            <svg class="lsb-item-svg flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M18 17l-4-4-4 4-4-4"/>
            </svg>
            <span>Status</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': activeView === 'params' }"
            @click="activeView = 'params'"
          >
            <SlidersHorizontal :size="18" />
            <span>Params</span>
          </button>
          <button
            v-if="activeView === 'status'"
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            @click="refreshData"
            :disabled="refreshing"
          >
            <svg class="lsb-item-svg flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: refreshing }">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            <span>{{ refreshing ? 'Refreshing...' : 'Refresh' }}</span>
          </button>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Metrics</span>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">Block Height</span>
            <span class="color-text-primary txt-weight-light">{{ formatNumber(blockHeight) }}</span>
          </div>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">Validators</span>
            <span class="color-text-primary txt-weight-light">{{ validators.active }}/{{ validators.total }}</span>
          </div>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">Block Time</span>
            <span class="color-text-primary txt-weight-light">{{ blockTime.toFixed(2) }}s</span>
          </div>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">Throughput</span>
            <span class="color-text-primary txt-weight-light">{{ tps.toFixed(1) }} tx/s</span>
          </div>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">Blocks/Hour</span>
            <span class="color-text-primary txt-weight-light">{{ blocksPerHour }}</span>
          </div>
          <div class="netpage-metric-item flex-align-center-justify-space-between fs-13px padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="color-text-secondary fw-500">24h Volume</span>
            <span class="color-text-primary txt-weight-light">{{ formatNumber(txVolume24h) }}</span>
          </div>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Node Info</span>
          <div class="netpage-node-detail flex-align-center-justify-space-between fs-075rem transition-all-02 hover-bg-hover padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="netpage-node-detail-label color-text-tertiary fw-500 fs-11px">Chain ID</span>
            <span class="netpage-node-detail-value color-text-secondary txt-weight-light fs-075rem mono">lumen-1</span>
          </div>
          <div class="netpage-node-detail flex-align-center-justify-space-between fs-075rem transition-all-02 hover-bg-hover padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="netpage-node-detail-label color-text-tertiary fw-500 fs-11px">Network</span>
            <span class="netpage-node-detail-value color-text-secondary txt-weight-light fs-075rem mono">Mainnet</span>
          </div>
          <div class="netpage-node-detail flex-align-center-justify-space-between fs-075rem transition-all-02 hover-bg-hover padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="netpage-node-detail-label color-text-tertiary fw-500 fs-11px">SDK</span>
            <span class="netpage-node-detail-value color-text-secondary txt-weight-light fs-075rem mono">v0.47.0</span>
          </div>
          <div class="netpage-node-detail flex-align-center-justify-space-between fs-075rem transition-all-02 hover-bg-hover padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="netpage-node-detail-label color-text-tertiary fw-500 fs-11px">Peers</span>
            <span class="netpage-node-detail-value color-text-secondary txt-weight-light fs-075rem mono">{{ peers }}</span>
          </div>
          <div class="netpage-node-detail flex-align-center-justify-space-between fs-075rem transition-all-02 hover-bg-hover padding-0 padding-top-50 padding-right-150 padding-bottom-50 padding-left-150">
            <span class="netpage-node-detail-label color-text-tertiary fw-500 fs-11px">Uptime</span>
            <span class="netpage-node-detail-value color-text-secondary txt-weight-light fs-075rem mono">{{ uptime }}</span>
          </div>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <div class="netpage-main flex-1 overflow-y-auto bg-secondary">
      <template v-if="activeView === 'status'">
        <!-- Main Grid Layout -->
        <div class="netpage-main-grid gap-150 padding-200 grid">
        <!-- Left Column: Overview Cards -->
        <div class="netpage-left-column flex flex-column gap-87">
          <div class="netpage-info-card bg-card border-1 border-radius-14px padding-125-150 transition-all-02 hover-bg-tertiary hover-lift-2">
            <div class="netpage-card-label color-text-secondary margin-bottom-100 text-uppercase txt-weight-light fs-075rem letter-spacing-008em">Block Height</div>
            <div class="netpage-card-value color-text-primary txt-weight-medium margin-bottom-75 line-height-1 fs-225rem">{{ formatNumber(blockHeight) }}</div>
            <div class="netpage-card-detail color-text-secondary txt-weight-normal fs-13px">Latest block on chain</div>
          </div>

          <div class="netpage-info-card bg-card border-1 border-radius-14px padding-125-150 transition-all-02 hover-bg-tertiary hover-lift-2">
            <div class="netpage-card-label color-text-secondary margin-bottom-100 text-uppercase txt-weight-light fs-075rem letter-spacing-008em">Validators</div>
            <div class="netpage-card-value color-text-primary txt-weight-medium margin-bottom-75 line-height-1 fs-225rem">{{ validators.active }}<span class="netpage-card-unit color-text-secondary txt-weight-normal fs-18px margin-left-25">/{{ validators.total }}</span></div>
            <div class="netpage-card-detail color-text-secondary txt-weight-normal fs-13px">{{ validatorPercent.toFixed(1) }}% active</div>
          </div>

          <div class="netpage-info-card bg-card border-1 border-radius-14px padding-125-150 transition-all-02 hover-bg-tertiary hover-lift-2">
            <div class="netpage-card-label color-text-secondary margin-bottom-100 text-uppercase txt-weight-light fs-075rem letter-spacing-008em">Block Time</div>
            <div class="netpage-card-value color-text-primary txt-weight-medium margin-bottom-75 line-height-1 fs-225rem">{{ blockTime.toFixed(2) }}<span class="netpage-card-unit color-text-secondary txt-weight-normal fs-18px margin-left-25">s</span></div>
            <div class="netpage-card-detail color-text-secondary txt-weight-normal fs-13px">Avg: {{ avgBlockTime.toFixed(2) }}s</div>
          </div>

          <div class="netpage-info-card bg-card border-1 border-radius-14px padding-125-150 transition-all-02 hover-bg-tertiary hover-lift-2">
            <div class="netpage-card-label color-text-secondary margin-bottom-100 text-uppercase txt-weight-light fs-075rem letter-spacing-008em">Throughput</div>
            <div class="netpage-card-value color-text-primary txt-weight-medium margin-bottom-75 line-height-1 fs-225rem">{{ tps.toFixed(1) }} <span class="netpage-card-unit color-text-secondary txt-weight-normal fs-18px margin-left-25">tx/s</span></div>
            <div class="netpage-card-detail color-text-secondary txt-weight-normal fs-13px">Peak: {{ maxTps.toFixed(1) }} tx/s</div>
          </div>
        </div>

      <!-- Middle Column: Health & Activity -->
      <div class="middle-column flex flex-column gap-125">
        <!-- Network Health -->
        <section class="netpage-health-section bg-card border-1 border-radius-14px padding-125-150">
          <h2 class="netpage-section-title color-text-primary txt-weight-light fs-18px margin-0 margin-bottom-100">Network Health</h2>
          <div class="netpage-health-grid gap-87 grid">
            <div class="netpage-health-card padding-100 bg-secondary border-radius-10px">
              <div class="netpage-health-label color-text-secondary margin-bottom-87 fw-500 text-uppercase fs-11px letter-spacing-005em">Chain Status</div>
              <div class="netpage-health-indicator flex-align-center gap-100">
                <div class="netpage-indicator-bar flex-1 bg-tertiary border-radius-4px overflow-hidden">
                  <div class="netpage-indicator-fill excellent netpage-indicator-fill--w100 h-full w-full border-radius-4px transition-width-03"></div>
                </div>
                <span class="netpage-indicator-value color-text-primary txt-weight-light text-right fs-15px min-w-70px">Synced</span>
              </div>
            </div>

            <div class="netpage-health-card padding-100 bg-secondary border-radius-10px">
              <div class="netpage-health-label color-text-secondary margin-bottom-87 fw-500 text-uppercase fs-11px letter-spacing-005em">Validator Participation</div>
              <div class="netpage-health-indicator flex-align-center gap-100">
                <div class="netpage-indicator-bar flex-1 bg-tertiary border-radius-4px overflow-hidden">
                  <div class="netpage-indicator-fill h-full border-radius-4px transition-width-03" :class="validatorPercent > 80 ? 'excellent' : validatorPercent > 60 ? 'good' : 'normal'" :style="{ width: validatorPercent + '%' }"></div>
                </div>
                <span class="netpage-indicator-value color-text-primary txt-weight-light text-right fs-15px min-w-70px">{{ validatorPercent.toFixed(0) }}%</span>
              </div>
            </div>

            <div class="netpage-health-card padding-100 bg-secondary border-radius-10px">
              <div class="netpage-health-label color-text-secondary margin-bottom-87 fw-500 text-uppercase fs-11px letter-spacing-005em">Block Production</div>
              <div class="netpage-health-indicator flex-align-center gap-100">
                <div class="netpage-indicator-bar flex-1 bg-tertiary border-radius-4px overflow-hidden">
                  <div class="netpage-indicator-fill netpage-indicator-fill--w85 h-full border-radius-4px transition-width-03 w-85pct" :class="blockTimeStatus === 'fast' ? 'excellent' : blockTimeStatus === 'normal' ? 'good' : 'normal'"></div>
                </div>
                <span class="netpage-indicator-value color-text-primary txt-weight-light text-right fs-15px min-w-70px">{{ blockTimeStatus }}</span>
              </div>
            </div>

            <div class="netpage-health-card padding-100 bg-secondary border-radius-10px">
              <div class="netpage-health-label color-text-secondary margin-bottom-87 fw-500 text-uppercase fs-11px letter-spacing-005em">Peer Connections</div>
              <div class="netpage-health-indicator flex-align-center gap-100">
                <div class="netpage-indicator-bar flex-1 bg-tertiary border-radius-4px overflow-hidden">
                  <div class="netpage-indicator-fill good netpage-indicator-fill--w70 h-full border-radius-4px transition-width-03 netpage-indicator-fill-good w-70pct"></div>
                </div>
                <span class="netpage-indicator-value color-text-primary txt-weight-light text-right fs-15px min-w-70px">{{ peers }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Network Activity Chart -->
        <section class="netpage-activity-section bg-card border-1 border-radius-14px padding-125-150">
          <div class="netpage-section-header flex-align-center-justify-space-between margin-bottom-150">
            <h2 class="netpage-section-title color-text-primary txt-weight-light fs-18px margin-0 margin-bottom-100">Network Activity</h2>
            <div class="netpage-chart-tabs flex gap-50">
              <button class="netpage-tab-btn bg-transparent color-text-secondary cursor-pointer fw-500 padding-50-100 border-1 border-radius-8px fs-14px transition-all-02 hover-border-accent hover-color-text-primary" :class="{ active: activeChart === 'blocks' }" @click="activeChart = 'blocks'">Blocks</button>
              <button class="netpage-tab-btn bg-transparent color-text-secondary cursor-pointer fw-500 padding-50-100 border-1 border-radius-8px fs-14px transition-all-02 hover-border-accent hover-color-text-primary" :class="{ active: activeChart === 'txs' }" @click="activeChart = 'txs'">Transactions</button>
              <button class="netpage-tab-btn bg-transparent color-text-secondary cursor-pointer fw-500 padding-50-100 border-1 border-radius-8px fs-14px transition-all-02 hover-border-accent hover-color-text-primary" :class="{ active: activeChart === 'tps' }" @click="activeChart = 'tps'">TPS</button>
            </div>
          </div>
          <div class="netpage-activity-chart padding-150 bg-secondary border-radius-12px">
            <div class="netpage-chart-container w-full relative">
              <svg class="netpage-chart-container-svg w-full h-full" v-if="activeChart === 'blocks'" viewBox="0 0 400 120" preserveAspectRatio="none">
                <path :d="blockChartLinePath" stroke="var(--accent-primary)" stroke-width="2" fill="none" />
                <circle v-for="(point, i) in blockChartPoints" :key="i" :cx="point.x" :cy="point.y" r="3" fill="var(--accent-primary)" />
              </svg>
              <svg class="netpage-chart-container-svg w-full h-full" v-if="activeChart === 'txs'" viewBox="0 0 400 120" preserveAspectRatio="none">
                <rect v-for="(point, i) in txChartPoints" :key="i" :x="point.x - 8" :y="point.y" width="16" :height="120 - point.y" fill="#6366f1" opacity="0.8" rx="2" />
              </svg>
              <svg class="netpage-chart-container-svg w-full h-full" v-if="activeChart === 'tps'" viewBox="0 0 400 120" preserveAspectRatio="none">
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
      <div class="netpage-right-column flex flex-column gap-0">
        <!-- Recent Blocks -->
        <section class="netpage-data-table flex flex-column h-full bg-card border-1 border-radius-14px padding-125-150">
          <h2 class="netpage-section-title color-text-primary txt-weight-light fs-18px margin-0 margin-bottom-100">Recent Blocks</h2>
          <div class="netpage-blocks-list flex flex-column gap-50 margin-top-100 flex-1">
            <div class="netpage-block-card flex-align-center-justify-space-between cursor-pointer bg-secondary border-1 border-radius-10px transition-all-02 padding-87-100 hover-bg-tertiary min-h-64px" v-for="block in recentBlocks" :key="block.height">
              <div class="netpage-block-left flex-align-center gap-87 flex-1 min-w-0">
                <div class="netpage-validator-avatar flex-align-justify-center flex-0-0-auto border-radius-circle size-36px fs-13px txt-weight-medium color-white overflow-hidden border-2-white-a15" :title="block.validator">
                  <img class="netpage-validator-avatar-img w-full h-full object-fit-cover" v-if="block.validatorAvatar" :src="block.validatorAvatar" :alt="block.validator" />
                  <span v-else class="block">{{ block.validator.substring(0, 2).toUpperCase() }}</span>
                </div>
                <div class="netpage-block-info flex flex-column gap-20 flex-1 min-w-0">
                  <div class="netpage-block-height-row flex-align-baseline gap-50">
                    <span class="netpage-height-label color-text-secondary txt-weight-light text-uppercase fs-10px letter-spacing-005em">Block</span>
                    <span class="netpage-height-value color-text-primary txt-weight-medium fs-15px mono">#{{ formatNumber(block.height) }}</span>
                  </div>
                  <div class="block-validator flex-align-center gap-50">
                    <span class="netpage-validator-name-compact color-text-secondary fs-075rem nowrap overflow-hidden txt-overflow-ellipsis line-height-12">{{ block.validator }}</span>
                  </div>
                </div>
              </div>
              <div class="netpage-block-right flex-align-center flex-0-0-auto gap-100">
                <div class="netpage-block-meta flex flex-column flex-align-end gap-35 flex-justify-center">
                  <div class="meta-item flex-align-center gap-50">
                    <span class="netpage-meta-label color-text-secondary txt-weight-light text-uppercase fs-10px">TXS</span>
                    <span class="netpage-meta-value flex-inline-align-justify-center color-text-secondary txt-weight-medium bg-tertiary border-1 border-radius-4px fs-13px padding-0-50 h-22px min-w-30px" :class="{ 'has-txs': block.txs > 0 }">{{ block.txs }}</span>
                  </div>
                  <div class="netpage-meta-time flex-align-center color-text-secondary gap-35 fs-075rem line-height-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.5">
                      <path d="M6 0C2.7 0 0 2.7 0 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm0 10.8c-2.65 0-4.8-2.15-4.8-4.8S3.35 1.2 6 1.2s4.8 2.15 4.8 4.8-2.15 4.8-4.8 4.8z"/>
                      <path d="M6.6 3H5.4v3.3l2.85 1.7.6-1-2.25-1.35V3z"/>
                    </svg>
                    <span class="netpage-time-text nowrap line-height-1">{{ formatTime(block.time) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      </div>
      </template>

      <NetworkParamsPanel v-else />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, inject } from 'vue';
import { Network, SlidersHorizontal } from 'lucide-vue-next';
import { useInternalLumen } from '../../composables/useInternalLumen';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
import InternalSidebar from '../../components/InternalSidebar.vue';
import NetworkParamsPanel from '../components/NetworkParamsPanel.vue';

// Window interface
const lumen = useInternalLumen();
const activeView = ref<'status' | 'params'>('status');

// RPC endpoints


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

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    refreshData();
  }
);

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
    const valSetRes = await lumen.net.rpcGet('/validators');
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
    const res = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200`
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
      const valSet2Res = await lumen.net.rpcGet('/validators');
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
          lumen.net.rpcGet(`/block?height=${height}`)
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
    const netInfoRes = await lumen.net.rpcGet('/net_info');
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

