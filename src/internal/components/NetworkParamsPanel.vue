<template>
  <section class="network-params-panel">
    <header class="content-header">
      <div>
        <h1>Params</h1>
        <p>Live view of the blockchain parameters (fetched from the REST API).</p>
      </div>

      <div class="header-actions">
        <div class="endpoint-pill" :title="restBase">
          <span class="pill-label">REST</span>
          <span class="pill-value mono">{{ restBase }}</span>
        </div>

        <button class="btn" type="button" @click="copyAll" :disabled="!hasAnyData">
          <Copy :size="16" />
          Copy all
        </button>

        <button class="btn" type="button" @click="refreshAll" :disabled="loadingAll">
          <RefreshCw :size="16" :class="{ spinning: loadingAll }" />
          <span>{{ loadingAll ? 'Refreshing…' : 'Refresh' }}</span>
        </button>
      </div>
    </header>

    <div v-if="fatalError" class="fatal-error">
      <p class="fatal-title">Unable to fetch params</p>
      <p class="fatal-desc">{{ fatalError }}</p>
    </div>

    <div v-else class="sections">
      <div v-if="loadingAll && !hasAnyData" class="loading-state">
        <UiSpinner size="sm" />
        <span>Loading params…</span>
      </div>

      <section v-for="s in sections" :key="s.id" class="param-section">
        <button type="button" class="section-head" @click="toggleSection(s.id)">
          <div class="section-title">
            <div class="title-row">
              <span class="section-name">{{ s.title }}</span>
              <span class="status-badge" :class="statusClass(s)">
                {{ statusLabel(s) }}
              </span>
            </div>
            <span class="section-path mono">{{ s.path }}</span>
          </div>

          <div class="section-actions">
            <button
              type="button"
              class="icon-btn"
              title="Copy JSON"
              :disabled="!s.data"
              @click.stop="copySection(s)"
            >
              <Copy :size="16" />
            </button>
            <component :is="s.open ? ChevronDown : ChevronRight" :size="18" />
          </div>
        </button>

        <div v-if="s.open" class="section-body">
          <div v-if="s.loading" class="section-loading">
            <UiSpinner size="sm" />
            <span>Loading…</span>
          </div>
          <div v-else-if="s.error" class="section-error">
            {{ s.error }}
          </div>
          <pre v-else class="json-block mono">{{ pretty(s.data) }}</pre>
        </div>
      </section>
    </div>
  </section>

  <Transition name="toast">
    <div v-if="toast" class="toast">
      <Check :size="16" />
      {{ toast }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  RefreshCw
} from 'lucide-vue-next';
import UiSpinner from '../../ui/UiSpinner.vue';

type ParamSection = {
  id: string;
  title: string;
  path: string;
  open: boolean;
  loading: boolean;
  error: string;
  data: any;
  extract?: (json: any) => any;
};

const DEFAULT_REST_BASE = 'http://142.132.201.187:1317';

const props = defineProps<{
  restBase?: string;
}>();

const restBase = computed(() => String(props.restBase || '').trim() || DEFAULT_REST_BASE);

const lumen = (window as any).lumen;

function extractGovParams(json: any, kind: 'deposit' | 'voting' | 'tallying') {
  if (!json) return null;
  if (kind === 'deposit') return json.deposit_params || json.params?.deposit_params || json.params || json;
  if (kind === 'voting') return json.voting_params || json.params?.voting_params || json.params || json;
  return json.tally_params || json.params?.tally_params || json.params || json;
}

function extractModuleParams(json: any) {
  return json?.data?.params || json?.params || json || null;
}

const sections = ref<ParamSection[]>([
  {
    id: 'gov-deposit',
    title: 'Governance (deposit)',
    path: '/cosmos/gov/v1/params/deposit',
    open: true,
    loading: false,
    error: '',
    data: null,
    extract: (j) => extractGovParams(j, 'deposit')
  },
  {
    id: 'gov-voting',
    title: 'Governance (voting)',
    path: '/cosmos/gov/v1/params/voting',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: (j) => extractGovParams(j, 'voting')
  },
  {
    id: 'gov-tallying',
    title: 'Governance (tallying)',
    path: '/cosmos/gov/v1/params/tallying',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: (j) => extractGovParams(j, 'tallying')
  },
  {
    id: 'slashing',
    title: 'Slashing',
    path: '/cosmos/slashing/v1beta1/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: (j) => j?.params || j || null
  },
  {
    id: 'dns',
    title: 'DNS (x/dns)',
    path: '/lumen/dns/v1/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: extractModuleParams
  },
  {
    id: 'gateways',
    title: 'Gateways (x/gateway)',
    path: '/lumen/gateway/v1/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: extractModuleParams
  },
  {
    id: 'release',
    title: 'Release (x/release)',
    path: '/lumen/release/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: (j) => j?.params || j || null
  },
  {
    id: 'tokenomics',
    title: 'Tokenomics (x/tokenomics)',
    path: '/lumen/tokenomics/v1/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: extractModuleParams
  },
  {
    id: 'pqc',
    title: 'PQC (x/pqc)',
    path: '/lumen/pqc/v1/params',
    open: false,
    loading: false,
    error: '',
    data: null,
    extract: extractModuleParams
  }
]);

const loadingAll = computed(() => sections.value.some((s) => s.loading));
const hasAnyData = computed(() => sections.value.some((s) => s.data));
const fatalError = ref('');

const toast = ref('');
let toastTimer: number | null = null;

function showToast(message: string) {
  toast.value = message;
  if (toastTimer != null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 1400);
}

function toggleSection(id: string) {
  const s = sections.value.find((x) => x.id === id);
  if (s) s.open = !s.open;
}

function pretty(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function statusClass(s: ParamSection): string {
  if (s.loading) return 'loading';
  if (s.error) return 'error';
  if (s.data) return 'ok';
  return 'idle';
}

function statusLabel(s: ParamSection): string {
  if (s.loading) return 'Loading';
  if (s.error) return 'Error';
  if (s.data) return 'OK';
  return 'Idle';
}

async function loadSection(s: ParamSection) {
  if (!lumen?.http?.get) throw new Error('HTTP client unavailable');
  s.loading = true;
  s.error = '';
  try {
    const res = await lumen.http.get(`${restBase.value}${s.path}`);
    if (!res?.ok) {
      const msg = res?.error || `Request failed (${s.path})`;
      throw new Error(msg);
    }
    const raw = res.json ?? null;
    s.data = s.extract ? s.extract(raw) : raw;
  } catch (err: any) {
    s.data = null;
    s.error = String(err?.message || err || 'Unknown error');
  } finally {
    s.loading = false;
  }
}

async function refreshAll() {
  fatalError.value = '';
  if (!lumen?.http?.get) {
    fatalError.value = 'Lumen HTTP bridge is not available in this context.';
    return;
  }
  await Promise.all(sections.value.map((s) => loadSection(s)));
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}

async function copySection(s: ParamSection) {
  if (!s.data) return;
  await copyText(pretty(s.data));
  showToast(`Copied ${s.title}`);
}

const allJson = computed(() => {
  const out: Record<string, any> = {};
  for (const s of sections.value) out[s.id] = s.data ?? null;
  return out;
});

async function copyAll() {
  await copyText(pretty(allJson.value));
  showToast('Copied all params');
}

defineExpose({ refreshAll });

onMounted(() => {
  refreshAll();
});
</script>

<style scoped>
.network-params-panel {
  padding: 2rem;
}

.content-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.content-header h1 {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.content-header p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.endpoint-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  max-width: 420px;
}

.pill-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pill-value {
  font-size: 0.78rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.btn:hover:enabled {
  background: var(--primary-a08);
  border-color: var(--primary-a15);
  color: var(--accent-primary);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fatal-error {
  border: 1px solid rgba(var(--ios-red-rgb), 0.25);
  background: rgba(var(--ios-red-rgb), 0.08);
  border-radius: 16px;
  padding: 1.25rem;
  color: var(--text-primary);
}

.fatal-title {
  margin: 0;
  font-weight: 800;
}

.fatal-desc {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 16px;
}

.param-section {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 16px;
  overflow: hidden;
}

.section-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.section-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.section-name {
  font-weight: 800;
  color: var(--text-primary);
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-path {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  color: var(--text-tertiary);
  background: transparent;
  flex: 0 0 auto;
}

.status-badge.ok {
  background: rgba(var(--ios-green-rgb), 0.12);
  border-color: rgba(var(--ios-green-rgb), 0.25);
  color: var(--ios-green);
}

.status-badge.error {
  background: rgba(var(--ios-red-rgb), 0.12);
  border-color: rgba(var(--ios-red-rgb), 0.25);
  color: var(--ios-red);
}

.status-badge.loading {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.25);
  color: var(--ios-orange);
}

.section-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-tertiary);
  flex: 0 0 auto;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.icon-btn:hover:enabled {
  background: var(--primary-a08);
  border-color: var(--primary-a15);
  color: var(--accent-primary);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.section-body {
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  padding: 0.85rem 1.25rem 1.25rem;
}

.section-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-secondary);
}

.section-error {
  color: var(--ios-red);
  font-size: 0.9rem;
}

.json-block {
  margin: 0;
  padding: 0.85rem;
  border-radius: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: auto;
  max-height: 420px;
  line-height: 1.35;
  font-size: 0.78rem;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  z-index: 100;
  box-shadow: var(--shadow-primary-lg);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>

