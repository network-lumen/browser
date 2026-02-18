<template>
  <div class="gateways-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Gateways" :icon="Server" activeKey="gateways">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Manage</span>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: true }"
          >
            <List :size="18" />
            <span>My gateways</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>My gateways</h1>
          <p>Register and update on-chain gateway settings.</p>
          <p v-if="gatewayParams" class="content-fees">
            Register fee: {{ registerFeeLabel }} · Update fee: {{ updateFeeLabel }}
          </p>
        </div>
        <div class="manage-head-actions">
          <button
            type="button"
            class="btn-secondary"
            @click="refreshManage"
            :disabled="gatewaysLoading"
          >
            Refresh
          </button>
          <button
            type="button"
            class="btn-primary"
            @click="openCreateModal"
            :disabled="gatewaysLoading || !hasProfile"
          >
            Create gateway
          </button>
        </div>
      </header>

      <!-- Advanced gateway management -->
      <div class="content-area">
        <!-- Private Gateways Section -->
        <div v-if="privateGateways.length > 0" class="private-gateways-section">
          <div class="section-header">
            <h2>Private Gateways</h2>
            <a href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })" class="manage-link">
              Manage Private Gateways →
            </a>
          </div>
          <div class="private-gateways-grid">
            <div v-for="gw in privateGateways" :key="gw.id" class="private-gateway-card">
              <div class="private-gateway-header">
                <div class="gateway-status-dot" :class="{ ok: gw.status === 'active' }"></div>
                <span class="private-badge">Private</span>
              </div>
              <h3 class="private-gateway-name">{{ gw.name }}</h3>
              <p class="private-gateway-url mono">{{ gw.url }}</p>
              <div class="private-gateway-status">
                <span :class="`status-${gw.status}`">{{ gw.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- DAO Gateways Section -->
        <div v-if="hasProfile" class="dao-gateways-section">
          <div class="section-header">
            <h2>DAO Gateways</h2>
          </div>
        </div>

        <div v-if="!hasProfile" class="empty-state-card">
          <h2 class="empty-title">No active profile</h2>
          <p class="empty-sub">
            Select or create a profile to manage gateways.
          </p>
        </div>

        <div v-else class="manage-wrap">
          <div v-if="gatewaysLoading" class="empty-state-card">
            <div class="spinner"></div>
            <p class="empty-sub">Loading gateways…</p>
          </div>

          <div v-else-if="gatewaysError" class="empty-state-card">
            <h2 class="empty-title">Unable to load gateways</h2>
            <p class="empty-sub">{{ gatewaysError }}</p>
            <button class="btn-secondary" @click="refreshManage">Try again</button>
          </div>

          <div v-else-if="!myGateways.length" class="empty-state-card">
            <h2 class="empty-title">No gateways yet</h2>
            <p class="empty-sub">
              Use “Create gateway” to register your first gateway.
            </p>
          </div>

          <div v-else class="manage-list">
            <section v-for="gw in myGateways" :key="gw.id" class="manage-card">
              <header class="manage-card-head">
                <div class="manage-card-title">
                  <div class="gateway-status-dot" :class="{ ok: gw.active }"></div>
                  <span class="manage-card-name" :title="gw.endpoint || `Gateway #${gw.id}`">
                    {{ gw.endpoint || `Gateway #${gw.id}` }}
                  </span>
                  <span class="manage-card-id mono">#{{ gw.id }}</span>
                </div>
                <div class="manage-card-badges">
                  <span class="gateway-badge" :class="gw.active ? 'badge-success' : 'badge-warn'">
                    {{ gw.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </header>

              <div class="manage-grid" v-if="editMap[gw.id]">
                <div class="form-group">
                  <label class="form-label">Endpoint</label>
                  <input v-model="editMap[gw.id].endpoint" class="form-input" placeholder="gateway.city" />
                </div>
                <div class="form-group">
                  <label class="form-label">Regions</label>
                  <input
                    v-model="editMap[gw.id].regions"
                    class="form-input"
                    placeholder="us-east, eu-west"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Payout address</label>
                  <input v-model="editMap[gw.id].payout" class="form-input mono" placeholder="lmn1..." />
                </div>
                <div class="form-group">
                  <label class="form-label">Active</label>
                  <label class="toggle">
                    <input v-model="editMap[gw.id].active" type="checkbox" />
                    <span class="toggle-ui"></span>
                  </label>
                </div>
                <div class="form-group full">
                  <label class="form-label">Metadata (JSON object)</label>
                  <textarea
                    v-model="editMap[gw.id].metadata"
                    class="form-input mono"
                    rows="7"
                    placeholder='{\n  "name": "My gateway"\n}'
                  ></textarea>
                </div>
                <div class="form-group full">
                  <label class="form-label">Memo</label>
                  <input v-model="editMap[gw.id].memo" class="form-input" placeholder="Optional memo" />
                </div>
              </div>

              <div v-if="editMap[gw.id]?.error" class="inline-error">
                {{ editMap[gw.id].error }}
              </div>
              <div v-if="editMap[gw.id]?.txhash" class="inline-success mono">
                tx: {{ editMap[gw.id].txhash }}
              </div>

              <footer class="manage-card-actions">
                <button
                  type="button"
                  class="btn-secondary"
                  @click="resetEdit(gw.id)"
                  :disabled="editMap[gw.id].busy"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  @click="updateGateway(gw.id)"
                  :disabled="editMap[gw.id].busy || !isDirty(gw.id)"
                >
                  <span v-if="!editMap[gw.id].busy">Save changes</span>
                  <span v-else>Submitting…</span>
                </button>
              </footer>
            </section>
          </div>

          <Transition name="modal">
            <div
              v-if="showCreateModal"
              class="modal-overlay"
              @click="closeCreateModal"
            >
              <div class="modal-content" @click.stop>
                <div class="modal-header">
                  <div>
                    <h2 class="modal-title">Create gateway</h2>
                    <p class="modal-sub">Register a new gateway for the active profile.</p>
                  </div>
                  <button type="button" class="icon-btn" @click="closeCreateModal" :disabled="registerState.busy">
                    ×
                  </button>
                </div>

                <div class="modal-body">
                  <div class="form-group">
                    <label class="form-label">Endpoint</label>
                    <input v-model="registerForm.endpoint" class="form-input" placeholder="gateway.city" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Regions</label>
                    <input
                      v-model="registerForm.regions"
                      class="form-input"
                      placeholder="us-east, eu-west"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Payout address</label>
                    <input v-model="registerForm.payout" class="form-input mono" placeholder="lmn1..." />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Metadata (JSON object)</label>
                    <textarea
                      v-model="registerForm.metadata"
                      class="form-input mono"
                      rows="7"
                      placeholder='{\n  "name": "My gateway"\n}'
                    ></textarea>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Memo</label>
                    <input v-model="registerForm.memo" class="form-input" placeholder="Optional memo" />
                  </div>

                  <div v-if="registerState.error" class="inline-error">
                    {{ registerState.error }}
                  </div>
                  <div v-if="registerState.txhash" class="inline-success mono">
                    tx: {{ registerState.txhash }}
                  </div>
                </div>

                <div class="modal-actions">
                  <button type="button" class="btn-secondary" @click="closeCreateModal" :disabled="registerState.busy">
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    @click="registerGateway"
                    :disabled="registerState.busy || !canRegister"
                  >
                    <span v-if="!registerState.busy">Create</span>
                    <span v-else>Submitting…</span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>

          <Transition name="toast">
            <div v-if="toast.show" class="toast" :class="toast.kind">
              {{ toast.message }}
            </div>
          </Transition>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, reactive } from 'vue';
import { Server, List } from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
import InternalSidebar from '../../components/InternalSidebar.vue';

const profiles = profilesState;
const activeProfile = computed(
  () => profiles.value.find((p) => p.id === activeProfileId.value) || null
);
const hasProfile = computed(() => !!activeProfileId.value);
const activeAddress = computed(
  () => String(activeProfile.value?.walletAddress || activeProfile.value?.address || '').trim()
);

// ---------------------------------------------------------------------------
// Advanced gateway management (register/update)
// ---------------------------------------------------------------------------

type GatewayParamsView = {
  registerFeeUlmn: string;
  actionFeeUlmn: string;
};

type GatewayRecord = {
  id: string;
  endpoint: string;
  operator: string;
  payout?: string;
  regions?: string[];
  active: boolean;
  metadata?: Record<string, any>;
};

type GatewayEditState = {
  endpoint: string;
  regions: string;
  payout: string;
  metadata: string;
  active: boolean;
  memo: string;
  error: string;
  txhash: string;
  busy: boolean;
  original: {
    endpoint: string;
    regions: string[];
    payout: string;
    extras: Record<string, any>;
    active: boolean;
  };
};

const gatewayParams = ref<GatewayParamsView | null>(null);
const gateways = ref<GatewayRecord[]>([]);
const gatewaysLoading = ref(false);
const gatewaysError = ref('');

// Private gateways state
const privateGateways = ref<any[]>([]);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

const showCreateModal = ref(false);

const registerForm = reactive({
  endpoint: '',
  regions: '',
  payout: '',
  metadata: '',
  memo: ''
});

const registerState = reactive({
  busy: false,
  error: '',
  txhash: ''
});

const toast = reactive({
  show: false,
  message: '',
  kind: 'success' as 'success' | 'error' | 'info'
});
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function notify(message: string, kind: 'success' | 'error' | 'info' = 'success', ms = 2200) {
  toast.show = true;
  toast.message = message;
  toast.kind = kind;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.show = false;
  }, ms);
}

const myGateways = computed(() => {
  const me = activeAddress.value.trim().toLowerCase();
  if (!me) return [];
  return gateways.value.filter((g) => String(g.operator || '').trim().toLowerCase() === me);
});

const editMap = reactive<Record<string, GatewayEditState>>({});

const registerFeeLabel = computed(() => formatUlmnToLmn(gatewayParams.value?.registerFeeUlmn));
const updateFeeLabel = computed(() => formatUlmnToLmn(gatewayParams.value?.actionFeeUlmn));

watch(activeAddress, (addr) => {
  if (!registerForm.payout) registerForm.payout = addr || '';
  syncEditMap();
});

function openCreateModal() {
  if (!hasProfile.value) return;
  resetRegister();
  showCreateModal.value = true;
}

function closeCreateModal() {
  if (registerState.busy) return;
  showCreateModal.value = false;
  resetRegister();
}

function resetRegister() {
  registerForm.endpoint = '';
  registerForm.regions = '';
  registerForm.metadata = '';
  registerForm.memo = '';
  registerState.error = '';
  registerState.txhash = '';
  registerForm.payout = activeAddress.value || '';
}

const canRegister = computed(() => {
  return !!registerForm.endpoint.trim() && !!registerForm.payout.trim();
});

function getGwApi(): any {
  const api: any = (window as any).lumen;
  return api?.gateway;
}

async function loadGatewayParams() {
  const gwApi = getGwApi();
  if (!gwApi || !gwApi.getParams) return;
  try {
    const res: any = await gwApi.getParams().catch(() => null);
    if (!res || res.ok === false) return;
    const params = res.params || res;
    if (!params) return;
    gatewayParams.value = {
      registerFeeUlmn: String(
        params?.register_gateway_fee_ulmn ?? params?.registerGatewayFeeUlmn ?? '0'
      ),
      actionFeeUlmn: String(params?.action_fee_ulmn ?? params?.actionFeeUlmn ?? '0')
    };
  } catch {
    // ignore
  }
}

function normalizeGateway(raw: any): GatewayRecord {
  const meta =
    raw?.metadata && typeof raw.metadata === 'object'
      ? { ...raw.metadata }
      : typeof raw?.metadata === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw.metadata);
            return parsed && typeof parsed === 'object' ? parsed : undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;

  const endpointMeta = meta?.endpoint ? String(meta.endpoint) : '';
  const endpointRaw = raw?.endpoint ? String(raw.endpoint) : '';
  const endpoint = (endpointMeta || endpointRaw).trim();
  const metaRegions = Array.isArray(meta?.regions)
    ? meta.regions.map((r: any) => String(r || '')).filter(Boolean)
    : undefined;
  const regions = Array.isArray(raw?.regions)
    ? raw.regions.map((r: any) => String(r || '')).filter(Boolean)
    : metaRegions || [];

  return {
    id: String(raw?.id ?? raw?.gatewayId ?? ''),
    endpoint: endpoint || '',
    operator: String(raw?.operator ?? ''),
    payout: String(raw?.payout ?? ''),
    regions,
    active: !!raw?.active,
    metadata: meta
  };
}

async function loadGateways() {
  gatewaysLoading.value = true;
  gatewaysError.value = '';
  try {
    const gwApi = getGwApi();
    if (!gwApi || !gwApi.listGateways) {
      gateways.value = [];
      gatewaysError.value = 'Gateway registry API unavailable.';
      return;
    }
    const res: any = await gwApi
      .listGateways({ limit: 800, timeoutMs: 8000, ignoreWhitelist: true })
      .catch(() => null);
    if (!res || res.ok === false) {
      gateways.value = [];
      gatewaysError.value = normalizeError(res?.error || res?.message || 'Unable to load gateways.');
      return;
    }
    const list = Array.isArray(res?.gateways) ? res.gateways : [];
    gateways.value = list.map(normalizeGateway).filter((g: GatewayRecord) => !!g.id);
    syncEditMap();
  } catch (e: any) {
    gateways.value = [];
    gatewaysError.value = String(e?.message || 'Unable to load gateways.');
  } finally {
    gatewaysLoading.value = false;
  }
}

function refreshManage() {
  void loadGatewayParams();
  void loadGateways();
  void loadPrivateGateways();
}

async function loadPrivateGateways() {
  try {
    const result = await (window as any).lumen.settingsLoadGateways();
    privateGateways.value = result || [];
  } catch (e) {
    console.error('Failed to load private gateways:', e);
    privateGateways.value = [];
  }
}

function extrasFromGateway(gateway: GatewayRecord): Record<string, any> {
  const meta = gateway.metadata && typeof gateway.metadata === 'object' ? { ...gateway.metadata } : {};
  delete meta.endpoint;
  delete meta.regions;
  delete meta.score;
  delete (meta as any).base_url;
  return meta;
}

function createEditState(gateway: GatewayRecord): GatewayEditState {
  const extras = extrasFromGateway(gateway);
  const extrasText = Object.keys(extras).length ? JSON.stringify(extras, null, 2) : '';
  return reactive({
    endpoint: gateway.endpoint || '',
    regions: (gateway.regions || []).join(', '),
    payout: gateway.payout || '',
    metadata: extrasText,
    active: !!gateway.active,
    memo: '',
    error: '',
    txhash: '',
    busy: false,
    original: {
      endpoint: gateway.endpoint || '',
      regions: [...(gateway.regions || [])],
      payout: gateway.payout || '',
      extras,
      active: !!gateway.active
    }
  });
}

function syncEditMap() {
  const seen = new Set<string>();
  for (const gateway of myGateways.value) {
    seen.add(gateway.id);
    editMap[gateway.id] = createEditState(gateway);
  }
  for (const id of Object.keys(editMap)) {
    if (!seen.has(id)) delete editMap[id];
  }
}

function resetEdit(id: string) {
  const gateway = gateways.value.find((g) => g.id === id);
  if (!gateway) return;
  editMap[id] = createEditState(gateway);
}

function arraysEqual(a: string[], b: string[]): boolean {
  const aa = [...a].map((v) => v.toLowerCase());
  const bb = [...b].map((v) => v.toLowerCase());
  aa.sort();
  bb.sort();
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}

function deepEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const keysA = Object.keys(a || {}).sort();
  const keysB = Object.keys(b || {}).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (key !== keysB[i]) return false;
    const valA = (a as any)[key];
    const valB = (b as any)[key];
    if (typeof valA === 'object' && typeof valB === 'object') {
      if (!deepEqual(valA ?? {}, valB ?? {})) return false;
    } else if (String(valA) !== String(valB)) {
      return false;
    }
  }
  return true;
}

function parseRegions(input: string): string[] {
  return input
    .split(/[\s,\n]+/)
    .map((r) => r.trim())
    .filter(Boolean);
}

function parseExtras(text: string): { ok: boolean; value?: Record<string, any>; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: undefined };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Metadata must be a JSON object.' };
    }
    return { ok: true, value: parsed as Record<string, any> };
  } catch (e: any) {
    const raw = e && e.message ? String(e.message) : '';
    const msg = raw.replace(/\s+/g, ' ').trim();
    return { ok: false, error: msg ? `Metadata JSON is invalid: ${msg}` : 'Metadata JSON is invalid.' };
  }
}

function isDirty(id: string): boolean {
  const state = editMap[id];
  if (!state) return false;
  const extras = parseExtras(state.metadata);
  if (!extras.ok && state.metadata.trim()) return true;
  const regions = parseRegions(state.regions);
  return (
    state.endpoint.trim() !== state.original.endpoint.trim() ||
    !arraysEqual(regions, state.original.regions) ||
    state.payout.trim() !== state.original.payout.trim() ||
    !deepEqual(extras.value ?? {}, state.original.extras) ||
    state.active !== state.original.active
  );
}

async function registerGateway() {
  if (!hasProfile.value || registerState.busy || !canRegister.value) return;
  const extras = parseExtras(registerForm.metadata);
  if (!extras.ok) {
    registerState.error = extras.error || 'Invalid metadata.';
    notify(registerState.error, 'error');
    return;
  }

  registerState.busy = true;
  registerState.error = '';
  registerState.txhash = '';
  try {
    const gwApi = getGwApi();
    if (!gwApi || !gwApi.registerGateway) {
      throw new Error('Gateway register API unavailable.');
    }
    const result: any = await gwApi.registerGateway({
      profileId: activeProfileId.value,
      payout: registerForm.payout.trim(),
      endpoint: registerForm.endpoint.trim(),
      regions: parseRegions(registerForm.regions),
      metadata: extras.value ?? undefined,
      memo: registerForm.memo || undefined
    });
    if (!result || result.ok === false) {
      const errorMessage = normalizeError(result?.error || result?.message || 'Registration failed.');
      registerState.error = errorMessage;
      notify(errorMessage, 'error');
      return;
    }
    registerState.txhash = String(result.txhash || '');
    notify('Gateway registration submitted', 'success');
    await loadGateways();
    registerForm.endpoint = '';
    registerForm.regions = '';
    registerForm.metadata = '';
    registerForm.memo = '';
  } catch (e: any) {
    const msg = normalizeError(e?.message || e);
    registerState.error = msg;
    notify(msg, 'error');
  } finally {
    registerState.busy = false;
  }
}

async function updateGateway(id: string) {
  const state = editMap[id];
  const gateway = gateways.value.find((g) => g.id === id);
  if (!state || !gateway || state.busy || !hasProfile.value) return;
  const gatewayId = Number(id);
  if (!gatewayId) {
    state.error = 'Gateway identifier missing.';
    notify(state.error, 'error');
    return;
  }
  const extras = parseExtras(state.metadata);
  if (!extras.ok) {
    state.error = extras.error || 'Invalid metadata.';
    notify(state.error, 'error');
    return;
  }
  state.busy = true;
  state.error = '';
  state.txhash = '';
  try {
    const gwApi = getGwApi();
    if (!gwApi || !gwApi.updateGateway) {
      throw new Error('Gateway update API unavailable.');
    }
    const payload: any = {
      profileId: activeProfileId.value,
      gatewayId,
      payout: state.payout.trim() || undefined,
      endpoint: state.endpoint.trim() || undefined,
      regions: parseRegions(state.regions),
      metadata: extras.value ?? undefined,
      active: state.active,
      memo: state.memo || undefined
    };
    const result: any = await gwApi.updateGateway(payload);
    if (!result || result.ok === false) {
      const errorMessage = normalizeError(result?.error || result?.message || 'Update failed.');
      state.error = errorMessage;
      notify(errorMessage, 'error');
      return;
    }
    state.txhash = String(result.txhash || '');
    notify('Gateway update submitted', 'success');
    await loadGateways();
  } catch (e: any) {
    const msg = normalizeError(e?.message || e);
    state.error = msg;
    notify(msg, 'error');
  } finally {
    state.busy = false;
  }
}

function formatUlmnToLmn(value?: string | number | bigint | null): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return '0 LMN';
  return `${(num / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} LMN`;
}

function normalizeError(value: any): string {
  const raw = typeof value === 'string' ? value : value?.message || '';
  const message = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!message) return 'Operation failed. Please try again.';
  const low = message.toLowerCase();
  if (low.includes('password_required')) return 'Unlock your wallet (password required) and try again.';
  if (low.includes('invalid_password')) return 'Invalid password. Unlock your wallet and try again.';
  if (low.includes('wallet_unavailable')) return 'Select an active profile with a wallet first.';
  if (low.includes('guest_profile')) return 'Guest profiles cannot submit on-chain transactions.';
  if (low.includes('missing_profileid')) return 'Select a profile before submitting.';
  if (low.includes('missing_gatewayid')) return 'Gateway identifier missing.';
  if (low.includes('missing_endpoint')) return 'Endpoint is required.';
  if (low.includes('invalid endpoint: format'))
    return 'Invalid endpoint. Use a valid domain or subdomain (e.g. gateway.city or gtw.gateway.city).';
  if (low.includes('invalid endpoint: domain format')) return 'Domain can include letters, numbers, or hyphens only.';
  if (low.includes('invalid endpoint: extension format')) return 'Extension must be 2-14 lowercase letters.';
  if (low.includes('invalid endpoint: characters')) return 'Endpoint may only contain letters, numbers, dots, and hyphens.';
  if (low.includes('invalid endpoint: empty label')) return 'Endpoint labels cannot be empty.';
  if (low.includes('keystore')) return 'Unlock your wallet and try again.';
  return message;
}

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  async () => {
    refreshManage();
  }
);

onMounted(async () => {
  refreshManage();
});

watch(
  () => activeProfileId.value,
  () => {
    for (const key of Object.keys(editMap)) delete editMap[key];
    showCreateModal.value = false;
    resetRegister();
    refreshManage();
  }
);
</script>

<style scoped>
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
  margin-bottom: 1.5rem;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--border-radius-lg);
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  font-weight: 400;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
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
  color: var(--text-primary);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0;
}

.content-fees {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  margin-top: 0.35rem;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-a30);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--hover-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.manage-wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manage-head-actions {
  display: inline-flex;
  gap: 0.75rem;
  flex: 0 0 auto;
}

.manage-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manage-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 1.25rem;
}

.manage-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.manage-card-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.manage-card-name {
  font-weight: 800;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 520px;
}

.manage-card-id {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  flex: 0 0 auto;
}

.manage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
}

.form-group.full {
  grid-column: 1 / -1;
}

.form-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  font-size: 0.85rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a15);
}

.manage-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

.gateway-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-tertiary);
  flex: 0 0 auto;
}

.gateway-status-dot.ok {
  background: var(--ios-green);
}

.inline-error {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(var(--ios-red-rgb), 0.25);
  background: rgba(var(--ios-red-rgb), 0.08);
  color: var(--ios-red);
  font-size: 0.85rem;
}

.inline-success {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(var(--ios-green-rgb), 0.25);
  background: rgba(var(--ios-green-rgb), 0.08);
  color: var(--ios-green);
  font-size: 0.85rem;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle input {
  width: 16px;
  height: 16px;
}

.toggle-ui {
  display: none;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  z-index: 100;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal-content {
  width: min(760px, 100%);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: var(--shadow-primary-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-primary);
}

.modal-sub {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.modal-body {
  padding: 1rem 1.25rem 0.25rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem 1rem;
}

.modal-body .form-group:nth-child(4) {
  grid-column: 1 / -1;
}

.modal-actions {
  padding: 1rem 1.25rem 1.25rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid var(--border-light);
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  font-size: 18px;
  line-height: 1;
}

.icon-btn:hover:enabled {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  z-index: 110;
  box-shadow: var(--shadow-primary-lg);
  background: var(--gradient-primary);
  color: white;
}

.toast.error {
  background: rgba(var(--ios-red-rgb), 0.9);
}

.toast.info {
  background: rgba(59, 130, 246, 0.9);
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.gateway-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.badge-success {
  background: var(--fill-success);
  color: var(--ios-green);
}

.badge-warn {
  background: rgba(255, 204, 0, 0.15);
  color: var(--ios-orange);
}

.empty-state-card {
  max-width: 520px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  text-align: center;
}

.empty-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-sub {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  margin: 0 auto 1rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .gateways-page {
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

  .manage-grid {
    grid-template-columns: 1fr;
  }

  .modal-body {
    grid-template-columns: 1fr;
  }
}

/* Private Gateways Section */
.private-gateways-section {
  margin-bottom: 2rem;
}

.dao-gateways-section {
  margin-top: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.manage-link {
  color: var(--ios-blue);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: opacity 0.2s;
}

.manage-link:hover {
  opacity: 0.8;
}

.private-gateways-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.private-gateway-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s;
}

.private-gateway-card:hover {
  border-color: var(--ios-blue);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.private-gateway-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.private-badge {
  padding: 0.25rem 0.625rem;
  background: rgba(94, 92, 230, 0.15);
  color: var(--ios-purple, #5e5ce6);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.private-gateway-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.private-gateway-url {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  margin: 0 0 0.75rem 0;
  word-break: break-all;
}

.private-gateway-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.private-gateway-status span {
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-active {
  background: rgba(52, 199, 89, 0.15);
  color: var(--ios-green);
}

.status-inactive {
  background: rgba(142, 142, 147, 0.15);
  color: var(--text-secondary);
}

.status-error {
  background: rgba(255, 59, 48, 0.15);
  color: var(--ios-red);
}
</style>

