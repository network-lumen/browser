<template>
  <div class="gateways-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Gateways" :icon="Server" activeKey="gateways">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25 padding-50-62">Manage</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: true }"
          >
            <List :size="18" />
            <span>My gateways</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="gwpage-main flex-1 flex flex-column overflow-hidden min-w-0 padding-200-250 bg-secondary">
      <!-- Header -->
      <header class="gwpage-content-header flex-align-start flex-justify-space-between">
        <div>
          <h1 class="color-text-primary txt-weight-medium margin-0 gwpage-content-header-h1 fs-175rem">My gateways</h1>
          <p class="color-text-secondary gwpage-content-header-p fs-14px margin-0 margin-top-25">Register and update on-chain gateway settings.</p>
          <p v-if="gatewayParams" class="gwpage-content-fees color-text-tertiary fs-12px margin-top-37 gwpage-content-header-p fs-14px margin-0 margin-top-25">
            Register fee: {{ registerFeeLabel }} · Update fee: {{ updateFeeLabel }}
          </p>
        </div>
        <div class="gwpage-manage-head-actions flex-inline">
          <button
            type="button"
            class="gwpage-btn-secondary color-text-primary flex-inline-align-center cursor-pointer padding-50-100 bg-hover border-1 border-radius-8px fs-13px transition-all-02 hover-color-text-primary"
            @click="refreshManage"
            :disabled="gatewaysLoading"
          >
            Refresh
          </button>
          <button
            type="button"
            class="gwpage-btn-primary color-white flex-inline-align-center border-none cursor-pointer padding-75-125 bg-gradient-primary fs-14px transition-all-02 hover-lift-2"
            @click="openCreateModal"
            :disabled="gatewaysLoading || !hasProfile"
          >
            Create gateway
          </button>
        </div>
      </header>

      <!-- Advanced gateway management -->
      <div class="gwpage-content-area overflow-y-auto">
        <!-- Private Gateways Section -->
        <div v-if="privateGateways.length > 0" class="gwpage-private-gateways-section">
          <div class="gwpage-section-header flex-align-center-justify-space-between">
            <h2 class="color-text-primary txt-weight-light margin-0 gwpage-section-header-h2 fs-125rem">Private Gateways</h2>
            <a href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })" class="gwpage-manage-link color-ios-blue fs-14px transition-opacity-02 hover-underline">
              Manage Private Gateways →
            </a>
          </div>
          <div class="gwpage-private-gateways-grid grid">
            <div v-for="gw in privateGateways" :key="gw.id" class="gwpage-private-gateway-card bg-card border-1 transition-all-02 hover-border-ios-blue hover-lift-2">
              <div class="gwpage-private-gateway-header flex-align-center margin-bottom-75">
                <div class="gwpage-status-dot w-10px h-10px bg-text-tertiary" :class="{ ok: gw.status === 'active' }"></div>
                <span class="gwpage-private-badge fs-11px letter-spacing-005em padding-25-75">Private</span>
              </div>
              <h3 class="gwpage-private-gateway-name color-text-primary fs-16px margin-0 margin-bottom-50">{{ gw.name }}</h3>
              <p class="gwpage-private-gateway-url mono color-text-secondary fs-13px break-all margin-0 margin-bottom-75">{{ gw.url }}</p>
              <div class="gwpage-private-gateway-status flex-align-center gap-50">
                <span class="border-radius-12px fw-500 text-capitalize gwpage-private-gateway-status-span padding-25-75 fs-075rem" :class="`status-${gw.status}`">{{ gw.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- DAO Gateways Section -->
        <div v-if="hasProfile" class="gwpage-dao-gateways-section">
          <div class="gwpage-section-header flex-align-center-justify-space-between">
            <h2 class="color-text-primary txt-weight-light margin-0 gwpage-section-header-h2 fs-125rem">DAO Gateways</h2>
          </div>
        </div>

        <div v-if="!hasProfile" class="gwpage-empty-state-card border-radius-16px bg-primary border-1 max-w-520px">
          <h2 class="gwpage-empty-title color-text-primary margin-bottom-50">No active profile</h2>
          <p class="gwpage-empty-sub color-text-secondary fs-14px">
            Select or create a profile to manage gateways.
          </p>
        </div>

        <div v-else class="manage-wrap flex flex-column gap-100">
          <div v-if="gatewaysLoading" class="gwpage-empty-state-card border-radius-16px bg-primary border-1 max-w-520px">
            <div class="gwpage-spinner border-3"></div>
            <p class="gwpage-empty-sub color-text-secondary fs-14px">Loading gateways…</p>
          </div>

          <div v-else-if="gatewaysError" class="gwpage-empty-state-card border-radius-16px bg-primary border-1 max-w-520px">
            <h2 class="gwpage-empty-title color-text-primary margin-bottom-50">Unable to load gateways</h2>
            <p class="gwpage-empty-sub color-text-secondary fs-14px">{{ gatewaysError }}</p>
            <button class="gwpage-btn-secondary color-text-primary flex-inline-align-center cursor-pointer padding-50-100 bg-hover border-1 border-radius-8px fs-13px transition-all-02 hover-color-text-primary" @click="refreshManage">Try again</button>
          </div>

          <div v-else-if="!myGateways.length" class="gwpage-empty-state-card border-radius-16px bg-primary border-1 max-w-520px">
            <h2 class="gwpage-empty-title color-text-primary margin-bottom-50">No gateways yet</h2>
            <p class="gwpage-empty-sub color-text-secondary fs-14px">
              Use “Create gateway” to register your first gateway.
            </p>
          </div>

          <div v-else class="manage-list flex flex-column gap-100">
            <section v-for="gw in myGateways" :key="gw.id" class="gwpage-manage-card bg-primary border-1 border-radius-16px">
              <header class="gwpage-manage-card-head flex-align-center-justify-space-between">
                <div class="gwpage-manage-card-title flex-align-center gap-62 min-w-0">
                  <div class="gwpage-status-dot w-10px h-10px bg-text-tertiary" :class="{ ok: gw.active }"></div>
                  <span class="gwpage-manage-card-name color-text-primary overflow-hidden txt-overflow-ellipsis nowrap max-w-520px" :title="gw.endpoint || `Gateway #${gw.id}`">
                    {{ gw.endpoint || `Gateway #${gw.id}` }}
                  </span>
                  <span class="gwpage-manage-card-id mono color-text-tertiary fs-12px">#{{ gw.id }}</span>
                </div>
                <div class="manage-card-badges">
                  <span class="gwpage-badge fs-11px" :class="gw.active ? 'badge-success' : 'gwpage-badge-warn'">
                    {{ gw.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </header>

              <div class="gwpage-manage-grid grid gap-90-100" v-if="editMap[gw.id]">
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Endpoint</label>
                  <input v-model="editMap[gw.id].endpoint" class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="gateway.city" />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Regions</label>
                  <input
                    v-model="editMap[gw.id].regions"
                    class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow"
                    placeholder="us-east, eu-west"
                  />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Payout address</label>
                  <input v-model="editMap[gw.id].payout" class="gwpage-form-input w-full color-text-primary mono border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="lmn1..." />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Active</label>
                  <label class="gwpage-toggle flex-inline-align-center">
                    <input v-model="editMap[gw.id].active" type="checkbox" />
                    <span class="gwpage-toggle-ui hidden"></span>
                  </label>
                </div>
                <div class="gwpage-form-group full">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Metadata (JSON object)</label>
                  <textarea
                    v-model="editMap[gw.id].metadata"
                    class="gwpage-form-input w-full color-text-primary mono border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow"
                    rows="7"
                    placeholder='{\n  "name": "My gateway"\n}'
                  ></textarea>
                </div>
                <div class="gwpage-form-group full">
                  <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Memo</label>
                  <input v-model="editMap[gw.id].memo" class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="Optional memo" />
                </div>
              </div>

              <div v-if="editMap[gw.id]?.error" class="gwpage-inline-error margin-top-75 padding-75 border-1-ios-red-a25 bg-ios-red-a08">
                {{ editMap[gw.id].error }}
              </div>
              <div v-if="editMap[gw.id]?.txhash" class="gwpage-inline-success mono margin-top-75 padding-75 bg-ios-green-a08 border-1-ios-green-a25">
                tx: {{ editMap[gw.id].txhash }}
              </div>

              <footer class="gwpage-manage-card-actions flex flex-justify-end">
                <button
                  type="button"
                  class="gwpage-btn-secondary color-text-primary flex-inline-align-center cursor-pointer padding-50-100 bg-hover border-1 border-radius-8px fs-13px transition-all-02 hover-color-text-primary"
                  @click="resetEdit(gw.id)"
                  :disabled="editMap[gw.id].busy"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="gwpage-btn-primary color-white flex-inline-align-center border-none cursor-pointer padding-75-125 bg-gradient-primary fs-14px transition-all-02 hover-lift-2"
                  @click="updateGateway(gw.id)"
                  :disabled="editMap[gw.id].busy || !isDirty(gw.id)"
                >
                  <span v-if="!editMap[gw.id].busy">Save changes</span>
                  <span v-else>Submitting…</span>
                </button>
              </footer>
            </section>
          </div>

          <Transition name="gwpage-modal-transition">
            <div
              v-if="showCreateModal"
              class="gwpage-modal-overlay overlay-scrim backdrop-blur-4px bg-black-a35 z-100"
              @click="closeCreateModal"
            >
              <div class="gwpage-modal-content overflow-hidden bg-primary border-1 shadow-primary-lg w-min-760" @click.stop>
                <div class="gwpage-modal-header flex-align-start flex-justify-space-between border-bottom-1-light">
                  <div>
                    <h2 class="gwpage-modal-title color-text-primary">Create gateway</h2>
                    <p class="gwpage-modal-sub color-text-secondary margin-0 margin-top-25">Register a new gateway for the active profile.</p>
                  </div>
                  <button type="button" class="gwpage-icon-btn disabled-fade-60 hover-fill-primary-enabled bg-transparent color-text-secondary flex-inline-align-justify-center cursor-pointer border-1-light line-height-1 w-34px transition-colors-015" @click="closeCreateModal" :disabled="registerState.busy">
                    ×
                  </button>
                </div>

                <div class="gwpage-modal-body grid gap-90-100">
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Endpoint</label>
                    <input v-model="registerForm.endpoint" class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="gateway.city" />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Regions</label>
                    <input
                      v-model="registerForm.regions"
                      class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow"
                      placeholder="us-east, eu-west"
                    />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Payout address</label>
                    <input v-model="registerForm.payout" class="gwpage-form-input w-full color-text-primary mono border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="lmn1..." />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Metadata (JSON object)</label>
                    <textarea
                      v-model="registerForm.metadata"
                      class="gwpage-form-input w-full color-text-primary mono border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow"
                      rows="7"
                      placeholder='{\n  "name": "My gateway"\n}'
                    ></textarea>
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary fs-12px margin-bottom-25">Memo</label>
                    <input v-model="registerForm.memo" class="gwpage-form-input w-full color-text-primary border-1 bg-secondary padding-62-75 focus-border-accent focus-ring focus-outline-none focus-shadow" placeholder="Optional memo" />
                  </div>

                  <div v-if="registerState.error" class="gwpage-inline-error margin-top-75 padding-75 border-1-ios-red-a25 bg-ios-red-a08">
                    {{ registerState.error }}
                  </div>
                  <div v-if="registerState.txhash" class="gwpage-inline-success mono margin-top-75 padding-75 bg-ios-green-a08 border-1-ios-green-a25">
                    tx: {{ registerState.txhash }}
                  </div>
                </div>

                <div class="gwpage-modal-actions flex flex-justify-end border-top-1-light">
                  <button type="button" class="gwpage-btn-secondary color-text-primary flex-inline-align-center cursor-pointer padding-50-100 bg-hover border-1 border-radius-8px fs-13px transition-all-02 hover-color-text-primary" @click="closeCreateModal" :disabled="registerState.busy">
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="gwpage-btn-primary color-white flex-inline-align-center border-none cursor-pointer padding-75-125 bg-gradient-primary fs-14px transition-all-02 hover-lift-2"
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

          <Transition name="gwpage-toast-transition">
            <div v-if="toast.show" class="gwpage-toast flex-align-start border-radius-md fixed padding-75-125 shadow-primary-lg bg-gradient-primary color-white bottom-200 left-half" :class="toast.kind">
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
import { useInternalLumen } from '../../composables/useInternalLumen';

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
  const api: any = useInternalLumen();
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
    const result = await useInternalLumen().settingsLoadGateways();
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


