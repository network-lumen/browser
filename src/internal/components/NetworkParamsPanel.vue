<template>
  <section class="padding-200">
    <header class="netparams-header flex margin-bottom-125 flex-wrap-wrap gap-100">
      <div>
        <h1 class="color-text-primary txt-weight-strong margin-0">Params</h1>
        <p class="color-text-secondary">Live view of the blockchain parameters (fetched from the REST API).</p>
      </div>

      <div class="netparams-header-actions flex flex-wrap-wrap gap-75">
        <div class="netparams-endpoint-pill flex-inline-align-center bg-primary gap-50 border-radius-full" :title="restBase">
          <span class="netparams-pill-label color-text-tertiary txt-weight-strong text-uppercase">REST</span>
          <span class="netparams-pill-value color-text-secondary overflow-hidden txt-overflow-ellipsis nowrap">{{ restBase }}</span>
        </div>

        <button class="netparams-btn disabled-fade-60 flex-inline-align-center bg-primary color-text-secondary cursor-pointer gap-50 border-radius-full" type="button" @click="copyAll" :disabled="!hasAnyData">
          <Copy :size="16" />
          Copy all
        </button>

        <button class="netparams-btn disabled-fade-60 flex-inline-align-center bg-primary color-text-secondary cursor-pointer gap-50 border-radius-full" type="button" @click="refreshAll" :disabled="loadingAll">
          <RefreshCw :size="16" :class="{ spinning: loadingAll }" />
          <span>{{ loadingAll ? 'Refreshing…' : 'Refresh' }}</span>
        </button>
      </div>
    </header>

    <div v-if="fatalError" class="netparams-fatal-error color-text-primary padding-125">
      <p class="netparams-fatal-title margin-0 txt-weight-strong">Unable to fetch params</p>
      <p class="netparams-fatal-desc color-text-secondary">{{ fatalError }}</p>
    </div>

    <div v-else class="flex flex-column gap-75">
      <div v-if="loadingAll && !hasAnyData" class="netparams-loading-state flex-align-center bg-primary color-text-secondary gap-75 padding-100">
        <UiSpinner size="sm" />
        <span>Loading params…</span>
      </div>

      <section v-for="s in sections" :key="s.id" class="netparams-section bg-primary">
        <button type="button" class="netparams-section-head w-full flex bg-transparent border-none cursor-pointer gap-100 text-left" @click="toggleSection(s.id)">
          <div class="netparams-section-title flex flex-column gap-25">
            <div class="netparams-title-row flex-align-center">
              <span class="netparams-section-name color-text-primary txt-weight-strong">{{ s.title }}</span>
              <span class="netparams-status-badge bg-transparent color-text-tertiary border-radius-full flex-0-0-auto txt-weight-strong" :class="statusClass(s)">
                {{ statusLabel(s) }}
              </span>
            </div>
            <span class="netparams-section-path color-text-tertiary mono">{{ s.path }}</span>
          </div>

          <div class="netparams-section-actions flex-inline-align-center color-text-tertiary gap-50 flex-0-0-auto">
            <button
              type="button"
              class="netparams-icon-btn disabled-fade-50 bg-transparent color-text-secondary flex-inline-align-justify-center cursor-pointer size-32px border-radius-10px"
              title="Copy JSON"
              :disabled="!s.data"
              @click.stop="copySection(s)"
            >
              <Copy :size="16" />
            </button>
            <component :is="s.open ? ChevronDown : ChevronRight" :size="18" />
          </div>
        </button>

        <div v-if="s.open" class="netparams-section-body">
          <div v-if="s.loading" class="netparams-section-loading flex-align-center color-text-secondary gap-75">
            <UiSpinner size="sm" />
            <span>Loading…</span>
          </div>
          <div v-else-if="s.error" class="netparams-section-error color-error">
            {{ s.error }}
          </div>
          <pre v-else class="netparams-json-block mono bg-primary color-text-primary margin-0 border-radius-12px">{{ pretty(s.data) }}</pre>
        </div>
      </section>
    </div>
  </section>

  <Transition name="netparams-toast">
    <div v-if="toast" class="netparams-toast flex-align-center bg-gradient-primary color-white gap-50 border-radius-10px fs-085rem txt-weight-light">
      <Check :size="16" />
      {{ toast }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
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

const props = defineProps<{
  restBase?: string;
}>();

const restBase = computed(() => String(props.restBase || '').trim());

const lumen = useInternalLumen();

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
  if (!lumen?.net?.restGet && (!restBase.value || !lumen?.http?.get)) {
    throw new Error('Network client unavailable');
  }
  s.loading = true;
  s.error = '';
  try {
    const res = restBase.value
      ? await lumen.http.get(`${restBase.value}${s.path}`)
      : await lumen.net.restGet(s.path);
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
  if (!lumen?.net?.restGet && !lumen?.http?.get) {
    fatalError.value = 'Lumen network bridge is not available in this context.';
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


