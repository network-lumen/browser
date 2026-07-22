<template>
  <div class="gateways-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Gateways" :icon="Server" activeKey="gateways">
      <nav class="lsb-nav flex flex-column gap-12px">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">Manage</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-sm w-full text-13px fw-500 text-left py-8px px-10px transition-all-015"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': true }"
          >
            <List :size="18" />
            <span>My gateways</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="gwpage-main flex-1 flex flex-column overflow-hidden min-w-0 py-32px px-40px bg-secondary">
      <!-- Header -->
      <UiPageHeader title="My gateways">
        <p class="ui-page-header-subtitle">Register and update on-chain gateway settings.</p>
        <p v-if="gatewayParams" class="color-text-tertiary text-12px m-0px mt-6px">
          Register fee: {{ registerFeeLabel }} · Update fee: {{ updateFeeLabel }}
        </p>
        <template #actions>
          <UiButton variant="secondary" type="button"
            @click="refreshManage"
            :disabled="gatewaysLoading">
            Refresh
          </UiButton>
          <UiButton variant="primary" type="button"
            @click="openCreateModal"
            :disabled="gatewaysLoading || !hasProfile">
            Create gateway
          </UiButton>
        </template>
      </UiPageHeader>

      <!-- Advanced gateway management -->
      <div class="gwpage-content-area overflow-y-auto">
        <!-- Private Gateways Section -->
        <div v-if="privateGateways.length > 0" class="gwpage-private-gateways-section">
          <div class="gwpage-section-header flex-align-center-justify-space-between">
            <h2 class="color-text-primary txt-weight-light m-0px gwpage-section-header-h2 text-20px">Private Gateways</h2>
            <a href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })" class="gwpage-manage-link color-ios-blue text-14px transition-opacity-02 hover-underline">
              Manage Private Gateways →
            </a>
          </div>
          <div class="gwpage-private-gateways-grid grid grid-cols-auto-fill-280">
            <UiCard v-for="gw in privateGateways" :key="gw.id" padding="none" border-class="border-1" radius="0" :shadow="false" hoverable hover-class="transition-all-02 hover-border-ios-blue hover-lift-2 shadow-0-4-12-rgba-0-0-0-0-1-hover">
              <div class="gwpage-private-gateway-header flex-align-center mb-12px">
                <div class="gwpage-status-dot w-10px h-10px bg-text-tertiary" :class="{ 'bg-ios-green-active': gw.status === 'active' }"></div>
                <span class="gwpage-private-badge text-11px letter-spacing-005em py-4px px-12px bg-ios-indigo-a15 color-ios-indigo">Private</span>
              </div>
              <h3 class="gwpage-private-gateway-name color-text-primary text-16px m-0px mb-8px">{{ gw.name }}</h3>
              <p class="gwpage-private-gateway-url mono color-text-secondary text-13px break-all m-0px mb-12px">{{ gw.url }}</p>
              <div class="gwpage-private-gateway-status flex-align-center gap-8px">
                <span class="border-radius-12px fw-500 text-capitalize py-4px px-12px text-12px" :class="gw.status === 'active' ? 'badge-success color-success' : 'badge-neutral color-text-secondary'">{{ gw.status }}</span>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- DAO Gateways Section -->
        <div v-if="hasProfile" class="gwpage-dao-gateways-section">
          <div class="gwpage-section-header flex-align-center-justify-space-between">
            <h2 class="color-text-primary txt-weight-light m-0px gwpage-section-header-h2 text-20px">DAO Gateways</h2>
          </div>
        </div>

        <UiEmptyState v-if="!hasProfile" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" title="No active profile" description="Select or create a profile to manage gateways." />

        <div v-else class="manage-wrap flex flex-column gap-16px">
          <UiEmptyState v-if="gatewaysLoading" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" description="Loading gateways…">
            <UiSpinner size="lg" />
          </UiEmptyState>

          <UiEmptyState v-else-if="gatewaysError" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" title="Unable to load gateways" :description="gatewaysError">
            <template #actions>
              <UiButton variant="secondary" @click="refreshManage">Try again</UiButton>
            </template>
          </UiEmptyState>

          <UiEmptyState v-else-if="!myGateways.length" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" title="No gateways yet" description="Use “Create gateway” to register your first gateway." />

          <div v-else class="manage-list flex flex-column gap-16px">
            <UiCard v-for="gw in myGateways" :key="gw.id" padding="none" bg-class="bg-primary" border-class="border-1" radius="16px" :shadow="false">
              <header class="gwpage-manage-card-head flex-align-center-justify-space-between">
                <div class="gwpage-manage-card-title flex-align-center gap-10px min-w-0">
                  <div class="gwpage-status-dot w-10px h-10px bg-text-tertiary" :class="{ 'bg-ios-green-active': gw.active }"></div>
                  <span class="gwpage-manage-card-name color-text-primary overflow-hidden txt-overflow-ellipsis nowrap max-w-520px" :title="gw.endpoint || `Gateway #${gw.id}`">
                    {{ gw.endpoint || `Gateway #${gw.id}` }}
                  </span>
                  <span class="gwpage-manage-card-id mono color-text-tertiary text-12px">#{{ gw.id }}</span>
                </div>
                <div class="manage-card-badges">
                  <span class="gwpage-badge text-11px py-4px px-10px" :class="gw.active ? 'badge-success' : 'bg-ios-yellow-a15'">
                    {{ gw.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </header>

              <div class="gwpage-manage-grid grid gap-y-14px gap-x-16px grid-cols-2-minmax0" v-if="editMap[gw.id]">
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Endpoint</label>
                  <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="editMap[gw.id].endpoint" placeholder="gateway.city" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Regions</label>
                  <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="editMap[gw.id].regions"
                   
                    placeholder="us-east, eu-west" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Payout address</label>
                  <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="editMap[gw.id].payout" placeholder="lmn1..." class="gwpage-form-input mono focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                </div>
                <div class="gwpage-form-group">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Active</label>
                  <label class="gwpage-toggle flex-inline-align-center">
                    <input v-model="editMap[gw.id].active" type="checkbox" class="w-16px h-16px" />
                    <span class="gwpage-toggle-ui hidden"></span>
                  </label>
                </div>
                <div class="gwpage-form-group full grid-col-full">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Metadata (JSON object)</label>
                  <UiInput type="textarea" bg-class="bg-secondary" :focus-ring="false" v-model="editMap[gw.id].metadata"
                   
                    rows="7"
                    placeholder='{\n  "name": "My gateway"\n}' class="gwpage-form-input mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"></UiInput>
                </div>
                <div class="gwpage-form-group full grid-col-full">
                  <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Memo</label>
                  <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="editMap[gw.id].memo" placeholder="Optional memo" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                </div>
              </div>

              <div v-if="editMap[gw.id]?.error" class="gwpage-inline-error mt-12px p-12px border-1-ios-red-a25 bg-ios-red-a08">
                {{ editMap[gw.id].error }}
              </div>
              <div v-if="editMap[gw.id]?.txhash" class="gwpage-inline-success mono mt-12px p-12px bg-ios-green-a08 border-1-ios-green-a25">
                tx: {{ editMap[gw.id].txhash }}
              </div>

              <footer class="gwpage-manage-card-actions flex flex-justify-end">
                <UiButton variant="secondary" type="button"
                 
                  @click="resetEdit(gw.id)"
                  :disabled="editMap[gw.id].busy">
                  Reset
                </UiButton>
                <UiButton variant="primary" type="button"
                 
                  @click="updateGateway(gw.id)"
                  :disabled="editMap[gw.id].busy || !isDirty(gw.id)">
                  <span v-if="!editMap[gw.id].busy">Save changes</span>
                  <span v-else>Submitting…</span>
                </UiButton>
              </footer>
            </UiCard>
          </div>

          <UiModal :model-value="showCreateModal" panel-class="w-min-760" :closable="!registerState.busy" @update:model-value="closeCreateModal">
            <template #header>
              <div>
                <h2 class="gwpage-modal-title color-text-primary text-16px">Create gateway</h2>
                <p class="gwpage-modal-sub color-text-secondary m-0px mt-4px">Register a new gateway for the active profile.</p>
              </div>
            </template>
                <div class="gwpage-modal-body grid gap-y-14px gap-x-16px grid-cols-2-minmax0">
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Endpoint</label>
                    <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="registerForm.endpoint" placeholder="gateway.city" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Regions</label>
                    <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="registerForm.regions"
                     
                      placeholder="us-east, eu-west" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Payout address</label>
                    <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="registerForm.payout" placeholder="lmn1..." class="gwpage-form-input mono focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Metadata (JSON object)</label>
                    <UiInput type="textarea" bg-class="bg-secondary" :focus-ring="false" v-model="registerForm.metadata"
                     
                      rows="7"
                      placeholder='{\n  "name": "My gateway"\n}' class="gwpage-form-input mono focus-ring focus-outline-none focus-shadow placeholder-tertiary"></UiInput>
                  </div>
                  <div class="gwpage-form-group">
                    <label class="gwpage-form-label block color-text-tertiary text-12px mb-4px letter-spacing-006em">Memo</label>
                    <UiInput bg-class="bg-secondary" :focus-ring="false" v-model="registerForm.memo" placeholder="Optional memo" class="gwpage-form-input focus-ring focus-outline-none focus-shadow placeholder-tertiary" />
                  </div>

                  <div v-if="registerState.error" class="gwpage-inline-error mt-12px p-12px border-1-ios-red-a25 bg-ios-red-a08">
                    {{ registerState.error }}
                  </div>
                  <div v-if="registerState.txhash" class="gwpage-inline-success mono mt-12px p-12px bg-ios-green-a08 border-1-ios-green-a25">
                    tx: {{ registerState.txhash }}
                  </div>
                </div>
            <template #footer>
              <UiButton variant="secondary" type="button" @click="closeCreateModal" :disabled="registerState.busy">
                Cancel
              </UiButton>
              <UiButton variant="primary" type="button"
                @click="registerGateway"
                :disabled="registerState.busy || !canRegister">
                <span v-if="!registerState.busy">Create</span>
                <span v-else>Submitting…</span>
              </UiButton>
            </template>
          </UiModal>

        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiCard from '../../ui/UiCard.vue';
import { ref, computed, onMounted, watch, inject, reactive } from 'vue';
import { Server, List } from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { useToast } from '../../composables/useToast';

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

const toastApi = useToast();

function notify(message: string, kind: 'success' | 'error' | 'info' = 'success') {
  toastApi[kind](message);
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


