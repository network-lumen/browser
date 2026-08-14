<template>
  <!-- ####### lumen://gateways GATEWAYS ####### -->
  <div class="internal-page flex">
    <InternalSidebar :title="t('Gateways')" :icon="Server" activeKey="gateways">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection :title="t('Manage')">
          <UiSidebarNavItem active>
            <List :size="18" />
            <span>{{ t('My Gateways') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="flex-1 flex flex-column overflow-hidden min-w-0 py-32px px-40px bg-secondary">
      <UiPageHeader :title="t('My Gateways')">
        <p class="mt-4px mb-0px color-text-secondary text-14px">{{ t('Register and update on-chain gateway settings.') }}</p>
        <p v-if="gatewayParams" class="color-text-tertiary text-12px m-0px mt-8px">
          {{ t('Register fee: {register} · Update fee: {update}', { register: registerFeeLabel, update: updateFeeLabel }) }}
        </p>
        <template #actions>
          <UiButton variant="secondary" type="button"
            @click="refreshManage"
            :disabled="gatewaysLoading">
            {{ t('Refresh') }}
          </UiButton>
          <UiButton variant="primary" type="button"
            @click="openCreateModal"
            :disabled="gatewaysLoading || !hasProfile">
            {{ t('Create gateway') }}
          </UiButton>
        </template>
      </UiPageHeader>

      <!-- Advanced gateway management -->
      <div class="overflow-y-auto flex flex-column gap-24px">
        <div v-if="privateGateways.length > 0" class="flex flex-column gap-12px">
          <div class="flex-align-center-justify-space-between gap-16px">
            <h2 class="color-text-primary txt-weight-light m-0px text-20px">{{ t('Private gateways') }}</h2>
            <a href="lumen://my-gateways" @click.prevent="navigate?.('lumen://my-gateways', { push: true })" class="hover-opacity-80 color-primary text-14px transition-opacity-02 hover-underline">
              {{ t('Manage private gateways →') }}
            </a>
          </div>
          <div class="grid gap-16px grid-cols-auto-fill-280">
            <UiCard v-for="gw in privateGateways" :key="gw.id" padding="lg" border-class="border-1" radius="16px" :shadow="false" hoverable hover-class="transition-all-02 hover-border-primary hover-lift-2 hover-shadow-md">
              <div class="flex-align-center gap-8px mb-12px">
                <div class="w-10px h-10px border-radius-circle bg-text-tertiary" :class="{ 'bg-success': gw.status === 'active' }"></div>
                <span class="text-11px letter-spacing-005em border-radius-full py-4px px-12px bg-indigo-a15 color-indigo">{{ t('Private') }}</span>
              </div>
              <h3 class="color-text-primary text-16px m-0px mb-8px">{{ gw.name }}</h3>
              <p class="mono color-text-secondary text-13px break-all m-0px mb-12px">{{ gw.url }}</p>
              <div class="flex-align-center gap-8px">
                <span class="border-radius-12px fw-500 text-capitalize py-4px px-12px text-12px" :class="gw.status === 'active' ? 'bg-fill-success color-success' : 'bg-fill-tertiary color-text-secondary'">{{ gw.status }}</span>
              </div>
            </UiCard>
          </div>
        </div>

        <UiEmptyState v-if="!hasProfile" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" :title="t('No active profile.')" :description="t('Select or create a profile first.')" />

        <div v-else class="flex flex-column gap-16px">
          <UiEmptyState v-if="gatewaysLoading" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" :description="t('Loading gateways…')">
            <UiSpinner size="lg" />
          </UiEmptyState>

          <UiEmptyState v-else-if="gatewaysError" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" :title="t('Failed to load gateways.')" :description="gatewaysError">
            <template #actions>
              <UiButton variant="secondary" @click="refreshManage">{{ t('Try again') }}</UiButton>
            </template>
          </UiEmptyState>

          <UiEmptyState v-else-if="!myGateways.length" class="border-radius-16px bg-primary border-1 max-w-520px mx-auto mt-32px mb-32px" :title="t('No gateways yet')" :description="t('Use “Create gateway” to register your first gateway.')" />

          <div v-else class="flex flex-column gap-16px">
            <UiCard v-for="gw in myGateways" :key="gw.id" padding="lg" bg-class="bg-primary" border-class="border-1" radius="16px" :shadow="false">
              <header class="flex-align-center-justify-space-between gap-16px mb-16px">
                <div class="flex-align-center gap-10px min-w-0">
                  <div class="w-10px h-10px border-radius-circle bg-text-tertiary" :class="{ 'bg-success': gw.active }"></div>
                  <span class="color-text-primary truncate max-w-520px" :title="gw.endpoint || t('Gateway #{id}', { id: gw.id })">
                    {{ gw.endpoint || t('Gateway #{id}', { id: gw.id }) }}
                  </span>
                  <span class="mono color-text-tertiary text-12px">#{{ gw.id }}</span>
                </div>
                <div class="flex-shrink-0">
                  <span class="text-11px border-radius-full py-4px px-10px" :class="gw.active ? 'bg-fill-success' : 'bg-yellow-a15'">
                    {{ gw.active ? t('Active') : t('Inactive') }}
                  </span>
                </div>
              </header>

              <GatewayFields v-if="editMap[gw.id]" :form="editMap[gw.id]" with-active memo-class="grid-col-full" />

              <div v-if="editMap[gw.id]?.error" class="mt-12px p-12px border-radius-10px border-1-error-a25 bg-error-a08">
                {{ editMap[gw.id].error }}
              </div>
              <div v-if="editMap[gw.id]?.txhash" class="mono mt-12px p-12px border-radius-10px bg-success-a08 border-1-success-a25">
                tx: {{ editMap[gw.id].txhash }}
              </div>

              <footer class="flex flex-justify-end gap-8px mt-16px">
                <UiButton variant="secondary" type="button"
                  @click="resetEdit(gw.id)"
                  :disabled="editMap[gw.id].busy">
                  {{ t('Reset') }}
                </UiButton>
                <UiButton variant="primary" type="button"
                  @click="updateGateway(gw.id)"
                  :disabled="editMap[gw.id].busy || !isDirty(gw.id)">
                  <span v-if="!editMap[gw.id].busy">{{ t('Save changes') }}</span>
                  <span v-else>{{ t('Submitting…') }}</span>
                </UiButton>
              </footer>
            </UiCard>
          </div>

          <GatewayRegisterDialog
            :model-value="showCreateModal"
            :active-address="activeAddress"
            :busy="registerState.busy"
            :error="registerState.error"
            :txhash="registerState.txhash"
            @update:model-value="closeCreateModal"
            @submit="registerGateway"
          />

        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { t } from '../../stores/i18nStore';
import UiButton from '../../ui/UiButton.vue';
import GatewayRegisterDialog from '../../dialogs/GatewayRegisterDialog.vue';
import GatewayFields from '../../forms/GatewayFields.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiCard from '../../ui/UiCard.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import { ref, computed, onMounted, watch, reactive } from 'vue';
import { Server, List } from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../../stores/profilesStore';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { useToast } from '../../composables/useToast';

const { currentTabRefresh } = useTabState();
import InternalSidebar from '../../components/InternalSidebar.vue';
import type { GatewayParamsView, GatewayRecord, GatewayEditState , GatewayRegisterForm } from '../../types/gatewaysPage';

import { errorMessage } from '../services/coerce';
import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
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

const gatewayParams = ref<GatewayParamsView | null>(null);
const gateways = ref<GatewayRecord[]>([]);
const gatewaysLoading = ref(false);
const gatewaysError = ref('');

// Private gateways state
const privateGateways = ref<any[]>([]);

const { navigate } = useTabNavigation();
const showCreateModal = ref(false);


const registerState = reactive({
  busy: false,
  error: '',
  txhash: ''
});

const toastApi = useToast();

const notify = toastApi.show;

const myGateways = computed(() => {
  const me = activeAddress.value.trim().toLowerCase();
  if (!me) return [];
  return gateways.value.filter((g) => String(g.operator || '').trim().toLowerCase() === me);
});

const editMap = reactive<Record<string, GatewayEditState>>({});

const registerFeeLabel = computed(() => formatUlmnToLmn(gatewayParams.value?.registerFeeUlmn));
const updateFeeLabel = computed(() => formatUlmnToLmn(gatewayParams.value?.actionFeeUlmn));

watch(activeAddress, () => {
  syncEditMap();
});

function openCreateModal() {
  if (!hasProfile.value) return;
  registerState.error = '';
  registerState.txhash = '';
  showCreateModal.value = true;
}

function closeCreateModal() {
  if (registerState.busy) return;
  showCreateModal.value = false;
}

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
      gatewaysError.value = t('Gateway registry API not available.');
      return;
    }
    const res: any = await gwApi
      .listGateways({ limit: 800, timeoutMs: 8000, ignoreWhitelist: true })
      .catch(() => null);
    if (!res || res.ok === false) {
      gateways.value = [];
      gatewaysError.value = normalizeError(res?.error || errorMessage(res, t('Failed to load gateways.')));
      return;
    }
    const list = Array.isArray(res?.gateways) ? res.gateways : [];
    gateways.value = list.map(normalizeGateway).filter((g: GatewayRecord) => !!g.id);
    syncEditMap();
  } catch (e) {
    gateways.value = [];
    gatewaysError.value = errorMessage(e, t('Failed to load gateways.'));
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
    const result = await useInternalLumen()?.settingsLoadGateways();
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
      return { ok: false, error: t('Metadata must be a JSON object.') };
    }
    return { ok: true, value: parsed as Record<string, any> };
  } catch (e) {
    const raw = errorMessage(e);
    const msg = raw.replace(/\s+/g, ' ').trim();
    return { ok: false, error: msg ? t('Metadata JSON is invalid: {reason}', { reason: msg }) : t('Metadata JSON is invalid.') };
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

async function registerGateway(form: GatewayRegisterForm) {
  if (!hasProfile.value || registerState.busy) return;
  const extras = parseExtras(form.metadata);
  if (!extras.ok) {
    registerState.error = extras.error || t('Invalid metadata.');
    notify(registerState.error, 'error');
    return;
  }

  registerState.busy = true;
  registerState.error = '';
  registerState.txhash = '';
  try {
    const gwApi = getGwApi();
    if (!gwApi || !gwApi.registerGateway) {
      throw new Error(t('Gateway register API not available.'));
    }
    const result: any = await gwApi.registerGateway({
      profileId: activeProfileId.value,
      payout: form.payout.trim(),
      endpoint: form.endpoint.trim(),
      regions: parseRegions(form.regions),
      metadata: extras.value ?? undefined,
      memo: form.memo || undefined
    });
    if (!result || result.ok === false) {
      const message = normalizeError(result?.error || errorMessage(result, t('Registration failed')));
      registerState.error = message;
      notify(message, 'error');
      return;
    }
    registerState.txhash = String(result.txhash || '');
    notify(t('Gateway registration submitted'), 'success');
    await loadGateways();
    showCreateModal.value = false;
  } catch (e) {
    const msg = normalizeError(errorMessage(e));
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
    state.error = t('Gateway ID missing.');
    notify(state.error, 'error');
    return;
  }
  const extras = parseExtras(state.metadata);
  if (!extras.ok) {
    state.error = extras.error || t('Invalid metadata.');
    notify(state.error, 'error');
    return;
  }
  state.busy = true;
  state.error = '';
  state.txhash = '';
  try {
    const gwApi = getGwApi();
    if (!gwApi || !gwApi.updateGateway) {
      throw new Error(t('Gateway update API not available.'));
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
      const message = normalizeError(result?.error || errorMessage(result, t('Update failed')));
      state.error = message;
      notify(message, 'error');
      return;
    }
    state.txhash = String(result.txhash || '');
    notify(t('Gateway update submitted'), 'success');
    await loadGateways();
  } catch (e) {
    const msg = normalizeError(errorMessage(e));
    state.error = msg;
    notify(msg, 'error');
  } finally {
    state.busy = false;
  }
}

function formatUlmnToLmn(value?: string | number | bigint | null): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return t('0 LMN');
  return `${(num / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} LMN`;
}

function normalizeError(value: any): string {
  const raw = typeof value === 'string' ? value : errorMessage(value, '');
  const message = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!message) return t('Operation failed. Please try again.');
  const low = message.toLowerCase();
  if (low.includes('password_required')) return t('Unlock your wallet and try again.');
  if (low.includes('invalid_password')) return t('Unlock your wallet and try again.');
  if (low.includes('wallet_unavailable')) return t('Select or create a profile with a wallet first.');
  if (low.includes('guest_profile')) return t('Guest profiles cannot submit on-chain transactions.');
  if (low.includes('missing_profileid')) return t('Select or create a profile first.');
  if (low.includes('missing_gatewayid')) return t('Gateway ID missing.');
  if (low.includes('missing_endpoint')) return t('Endpoint is required.');
  if (low.includes('invalid endpoint: format'))
    return t('Invalid endpoint. Use a valid domain or subdomain (e.g. gateway.city or gtw.gateway.city).');
  if (low.includes('invalid endpoint: domain format')) return t('Domain can include letters, numbers, or hyphens only.');
  if (low.includes('invalid endpoint: extension format')) return t('Extension must be 2-14 lowercase letters.');
  if (low.includes('invalid endpoint: characters')) return t('Endpoint may only contain letters, numbers, dots, and hyphens.');
  if (low.includes('invalid endpoint: empty label')) return t('Endpoint labels cannot be empty.');
  if (low.includes('keystore')) return t('Unlock your wallet and try again.');
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
    registerState.error = '';
    registerState.txhash = '';
    refreshManage();
  }
);
</script>
