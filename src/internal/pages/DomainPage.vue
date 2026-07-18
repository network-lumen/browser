<template>
  <div class="domain-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Domains" :icon="Globe" activeKey="domain">
      <nav class="names-nav">
        <button
          type="button"
          class="names-nav-item"
          :class="{ active: activeNameTab === 'lumen' }"
          @click="activeNameTab = 'lumen'"
        >
          <Globe :size="16" />
          <span>Lumen Domains</span>
        </button>
        <button
          type="button"
          class="names-nav-item"
          :class="{ active: activeNameTab === 'stable' }"
          @click="activeNameTab = 'stable'"
        >
          <KeyRound :size="16" />
          <span>Stable links</span>
        </button>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="main-content">
      <header class="content-header">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </div>
        <div class="header-actions">
          <template v-if="activeNameTab === 'lumen'">
            <button class="btn primary" type="button" @click="openRegisterModal">
              <Plus :size="16" />
              <span>Buy domain</span>
            </button>
          </template>
          <template v-else>
            <button class="btn secondary" type="button" @click="importStableLink">
              <Upload :size="16" />
              <span>Import</span>
            </button>
            <button class="btn primary" type="button" @click="createStableLink">
              <Plus :size="16" />
              <span>Generate</span>
            </button>
          </template>
        </div>
      </header>

      <section v-if="activeNameTab === 'lumen'" class="card">


        <div v-if="error" class="empty error">
          <p>{{ error }}</p>
        </div>
        <div v-else-if="loading" class="empty">
          <div class="spinner"></div>
          <p>Loading your domains...</p>
        </div>
        <div v-else-if="!domains.length" class="empty hero">
          <p class="hero-title">Get your name on Lumen</p>
          <p class="hero-text">
            Register a new domain and open it as
            <span class="mono">lumen://your-name.lmn</span>
          </p>
          <button class="btn primary" type="button" @click="openRegisterModal">
            <Plus :size="16" />
            <span>Buy domain</span>
          </button>
        </div>
        <ul v-else class="domains-list">
          <li v-for="d in domains" :key="d.name" class="domain-row">
            <div class="domain-main">
              <span class="domain-name">{{ d.name }}</span>
            </div>
            <div class="domain-right">
              <span
                v-if="d.expireAtSeconds"
                class="pill"
                :class="expiryClass(d)"
                :title="prettyDate(d.expireAtSeconds * 1000)"
              >
                {{ expiryText(d) }}
              </span>
              <button
                class="icon-btn"
                type="button"
                title="Open lumen URL"
                @click="openDomain(d)"
              >
                <ExternalLink :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Copy lumen URL"
                @click="copyDomainUrl(d)"
              >
                <Copy :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Settings (preview only)"
                @click="openSettingsModal(d)"
              >
                <Settings :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Transfer domain"
                @click="openTransferModal(d)"
              >
                <Send :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section v-else class="card">
        <div v-if="rawDomainsLoading" class="empty">
          <div class="spinner"></div>
          <p>Loading stable links...</p>
        </div>
        <div v-else-if="rawDomainsError" class="empty error">
          <p>{{ rawDomainsError }}</p>
        </div>
        <div v-else-if="!rawDomains.length" class="empty hero">
          <p class="hero-title">Generate a stable link</p>
          <p class="hero-text">
            Stable links are cryptographic names backed by IPNS.
          </p>
          <button class="btn primary" type="button" @click="createStableLink">
            <Plus :size="16" />
            <span>Generate</span>
          </button>
        </div>
        <ul v-else class="domains-list">
          <li v-for="d in rawDomains" :key="d.name" class="domain-row">
            <div class="domain-main">
              <div class="stable-link-label-row">
                <input
                  class="stable-link-label-input"
                  type="text"
                  :value="stableLinkDisplayName(d.name)"
                  :disabled="renamingStableLinkName === d.name"
                  title="Local stable link label"
                  @keydown.enter.prevent="renameStableLinkFromEvent(d, $event)"
                  @blur="renameStableLinkFromEvent(d, $event)"
                />
                <Check
                  v-if="renamingStableLinkName === d.name"
                  class="stable-link-saving-icon"
                  :size="14"
                />
              </div>
              <span class="domain-subtitle mono">{{ d.id || 'IPNS id unavailable' }}</span>
            </div>
            <div class="domain-right">
              <button
                class="icon-btn"
                type="button"
                title="Open stable link"
                :disabled="!d.id"
                @click="openRawDomain(d)"
              >
                <ExternalLink :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Copy stable link URL"
                :disabled="!d.id"
                @click="copyRawDomainUrl(d)"
              >
                <Copy :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Edit records"
                :disabled="!d.name"
                @click="openStableSettingsModal(d)"
              >
                <Settings :size="16" />
              </button>
              <button
                class="icon-btn"
                type="button"
                title="Export private key"
                :disabled="!d.name"
                @click="exportStableLink(d)"
              >
                <Download :size="16" />
              </button>
              <button
                class="icon-btn danger"
                type="button"
                title="Delete stable link"
                :disabled="!d.name"
                @click="deleteStableLink(d)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <Transition name="fade">
        <div v-if="stableLinkModalMode" class="modal-overlay" @click="closeStableLinkModal">
          <div class="modal" @click.stop>
            <header class="modal-header">
              <h3>{{ stableLinkModalMode === 'import' ? 'Import stable link' : 'Generate stable link' }}</h3>
              <button class="modal-close" type="button" @click="closeStableLinkModal">
                <X :size="16" />
              </button>
            </header>
            <form class="modal-body" @submit.prevent="confirmStableLinkModal">
              <p class="modal-desc">
                {{ stableLinkModalMode === 'import'
                  ? 'Choose a local private key file and attach it to this stable link name.'
                  : 'Create a new IPNS-backed stable link with a local private key.' }}
              </p>
              <div class="form-group">
                <label>Stable link name</label>
                <input
                  v-model="stableLinkNameDraft"
                  class="form-input"
                  type="text"
                  autocomplete="off"
                  placeholder="my-link"
                  :disabled="stableLinkSaving"
                  autofocus
                />
              </div>
              <div class="modal-actions">
                <button class="btn secondary full" type="button" :disabled="stableLinkSaving" @click="closeStableLinkModal">
                  Cancel
                </button>
                <button
                  class="btn primary full"
                  type="submit"
                  :disabled="stableLinkSaving || !stableLinkNameDraft.trim()"
                >
                  <span v-if="!stableLinkSaving">
                    <component :is="stableLinkModalMode === 'import' ? Upload : Plus" :size="16" />
                    {{ stableLinkModalMode === 'import' ? 'Import' : 'Generate' }}
                  </span>
                  <span v-else class="spinner"></span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showStableSettingsModal" class="modal-overlay" @click="closeStableSettingsModal">
          <div class="modal" @click.stop>
            <header class="modal-header">
              <h3>Stable link records</h3>
              <button class="modal-close" type="button" @click="closeStableSettingsModal">
                <X :size="16" />
              </button>
            </header>
            <div class="modal-body">
              <p class="modal-desc">Publish resolver records for this stable link.</p>
              <div class="info-card">
                <div class="info-name">{{ selectedStableLink ? stableLinkDisplayName(selectedStableLink.name) : 'stable-link' }}</div>
                <div class="info-expiry mono">{{ selectedStableLink?.id || 'IPNS id unavailable' }}</div>
              </div>

              <div class="form-group">
                <label>Records (key / value)</label>
                <div v-if="stableSettingsLoading" class="records-empty">
                  Loading records...
                </div>
                <div v-else-if="!stableSettingsRecords.length" class="records-empty">
                  No records yet. Add a target like <span class="mono">cid</span>, <span class="mono">ipfs</span>, or <span class="mono">ipns</span>.
                </div>
                <div v-else class="records-list">
                  <div
                    class="record-row"
                    v-for="(r, idx) in stableSettingsRecords"
                    :key="idx"
                  >
                    <input
                      type="text"
                      class="form-input key-input"
                      v-model="r.key"
                      placeholder="cid | ipns | site | ..."
                      :disabled="stableSettingsSaving"
                    />
                    <input
                      type="text"
                      class="form-input value-input"
                      v-model="r.value"
                      placeholder="lumen://ipfs/CID or lumen://ipns/NAME"
                      :disabled="stableSettingsSaving"
                    />
                    <button
                      class="icon-btn danger"
                      type="button"
                      @click="removeStableSettingsRecord(idx)"
                      title="Remove row"
                      :disabled="stableSettingsSaving"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                </div>
                <button class="btn secondary full" type="button" @click="addStableSettingsRecord" :disabled="stableSettingsSaving">
                  Add record
                </button>
              </div>

              <div class="modal-actions">
                <button class="btn secondary full" type="button" @click="closeStableSettingsModal" :disabled="stableSettingsSaving">
                  Cancel
                </button>
                <button class="btn primary full" type="button" @click="saveStableSettings" :disabled="stableSettingsSaving || stableSettingsLoading">
                  <span v-if="!stableSettingsSaving">
                    <Check :size="16" />
                    Save records
                  </span>
                  <span v-else class="spinner"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Register Domain Modal -->
      <Transition name="fade">
        <div v-if="showRegisterModal" class="modal-overlay" @click="closeRegisterModal">
          <div class="modal" @click.stop>
            <header class="modal-header">
              <h3>Register domain</h3>
              <button class="modal-close" type="button" @click="closeRegisterModal">
                <X :size="16" />
              </button>
            </header>
            <div class="modal-body">
              <p class="modal-desc">
                Register a new <span class="mono">.lmn</span> handle for the owner address.
              </p>

              <div class="form-group">
                <label>Domain</label>
                <div class="domain-input-wrapper">
                  <input
                    type="text"
                    class="form-input domain-part"
                    v-model="registerForm.domainName"
                    placeholder="myname"
                    @input="sanitizeDomainInput"
                    @blur="refreshAvailability"
                  />
                  <span class="dot-sep">.</span>
                  <input
                    type="text"
                    class="form-input ext-part"
                    v-model="registerForm.ext"
                    placeholder="lmn"
                    @blur="refreshAvailability"
                  />
                </div>
                <div
                  v-if="registerForm.domainName"
                  class="availability"
                  :class="{ available: domainAvailable }"
                >
                  <span>{{ domainAvailable ? 'Available' : 'Already taken' }}</span>
                </div>
              </div>

              <div class="form-group">
                <label>Registration period</label>
                <div class="period-static">Fixed at 1 year</div>
              </div>

              <div class="price-box">
                <div class="price-row total">
                  <span>Total (1 year)</span>
                  <span class="price">{{ dnsTotalFeeLabel }}</span>
                </div>
              </div>

              <button
                class="btn primary full"
                type="button"
                @click="confirmRegister"
                :disabled="!canRegister || registering"
              >
                <span v-if="!registering" class="btn-label">
                  <Plus :size="16" />
                  Register domain
                </span>
                <span v-else class="spinner"></span>
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Settings Modal -->
      <Transition name="fade">
        <div v-if="showSettingsModal" class="modal-overlay" @click="closeSettingsModal">
          <div class="modal" @click.stop>
            <header class="modal-header">
              <h3>Domain settings</h3>
              <button class="modal-close" type="button" @click="closeSettingsModal">
                <X :size="16" />
              </button>
            </header>
            <div class="modal-body">
              <p class="modal-desc">Edit resolver records for this domain.</p>
              <div class="info-card">
                <div class="info-name">{{ selectedDomain?.name || 'mydomain.lmn' }}</div>
                <div class="info-expiry">
                  {{ selectedDomain ? expiryText(selectedDomain) : 'Expires: unknown' }}
                </div>
              </div>

              <div class="form-group">
                <label>Records (key / value)</label>
                <div v-if="!settingsRecords.length" class="records-empty">
                  No records yet. Add a new row below.
                </div>
                <div v-else class="records-list">
                  <div
                    class="record-row"
                    v-for="(r, idx) in settingsRecords"
                    :key="idx"
                  >
                    <input
                      type="text"
                      class="form-input key-input"
                      v-model="r.key"
                      placeholder="cid | ipns | txt | ..."
                    />
                    <input
                      type="text"
                      class="form-input value-input"
                      v-model="r.value"
                      placeholder="Value"
                    />
                    <button
                      class="icon-btn danger"
                      type="button"
                      @click="removeSettingsRecord(idx)"
                      title="Remove row"
                    >
                      <X :size="14" />
                    </button>
                  </div>
                </div>
                <button class="btn secondary full" type="button" @click="addSettingsRecord">
                  Add record
                </button>
              </div>

              <div class="price-box">
                <div class="price-row">
                  <span>Cost</span>
                  <span class="price">{{ settingsCostLabel }}</span>
                </div>
                <div class="price-row">
                  <span>Balance</span>
                  <span class="price">{{ settingsWalletBalanceLabel }}</span>
                </div>
                <p class="owner-hint" v-if="settingsInsufficientBalance">
                  You need at least {{ settingsCostLabel }} available to keep your PQC link active.
                </p>
              </div>

              <div class="modal-actions">
                <button class="btn secondary full" type="button" @click="closeSettingsModal">
                  Cancel
                </button>
                <button
                  class="btn primary full ghost"
                  type="button"
                  @click="saveSettings"
                  :disabled="!canSaveSettings || savingSettings"
                >
                  <span v-if="!savingSettings">
                    <Settings :size="16" />
                    Save changes
                  </span>
                  <span v-else class="spinner"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Transfer Modal -->
      <Transition name="fade">
        <div v-if="showTransferModal" class="modal-overlay" @click="closeTransferModal">
          <div class="modal" @click.stop>
            <header class="modal-header">
              <h3>Transfer domain</h3>
              <button class="modal-close" type="button" @click="closeTransferModal">
                <X :size="16" />
              </button>
            </header>
            <div class="modal-body">
              <p class="modal-desc">Transfer ownership of this domain to another address.</p>
              
              <div class="info-card">
                <div class="info-name">{{ transferDomain?.name || 'mydomain.lmn' }}</div>
                <div class="info-expiry">
                  {{ transferDomain ? expiryText(transferDomain) : 'Expires: unknown' }}
                </div>
              </div>

              <div class="form-group">
                <label>New Owner Address</label>
                <input
                  type="text"
                  class="form-input"
                  v-model="transferForm.newOwner"
                  placeholder="lumen1..."
                />
                <p class="form-hint">Enter the Lumen address of the new owner</p>
              </div>

              <div class="warning-box">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                  <strong>Warning:</strong> This action cannot be undone. Once transferred, you will lose control of this domain.
                </div>
              </div>

              <div class="modal-actions">
                <button class="btn secondary full" type="button" @click="closeTransferModal">
                  Cancel
                </button>
                <button
                  class="btn primary full danger"
                  type="button"
                  @click="confirmTransfer"
                  :disabled="!canTransfer || transferring"
                >
                  <span v-if="!transferring">
                    <Send :size="16" />
                    Transfer domain
                  </span>
                  <span v-else class="spinner"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </main>

  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, watchEffect } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
import {
  Globe,
  KeyRound,
  Plus,
  Upload,
  Download,
  ExternalLink,
  Copy,
  Check,
  Settings,
  X,
  Send,
  Trash2
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { loadStableLinkRecords } from '../services/contentResolver';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
const openInNewTab = inject<(url: string) => void>('openInNewTab');

type DomainRow = {
  name: string;
  expireAtSeconds: number | null;
};

type RawDomainRow = {
  name: string;
  id: string;
};

const profiles = profilesState;
const activeProfile = computed(
  () => profiles.value.find((p) => p.id === activeProfileId.value) || null
);
const profileAddress = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});
const domains = ref<DomainRow[]>([]);
const loading = ref(false);
const error = ref('');
const activeNameTab = ref<'lumen' | 'stable'>('lumen');
const rawDomains = ref<RawDomainRow[]>([]);
const rawDomainsLoading = ref(false);
const rawDomainsError = ref('');

const pageTitle = computed(() =>
  activeNameTab.value === 'stable' ? 'Stable links' : 'Lumen Domains'
);
const pageDescription = computed(() =>
  activeNameTab.value === 'stable'
    ? 'Cryptographic links powered by IPNS.'
    : 'Human-readable domains secured by the Lumen chain.'
);

useTabLoadingSync(loading);

const toast = useToast();
function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'success'
) {
  if (type === 'error') {
    toast.error(message);
  } else if (type === 'warning') {
    toast.warning(message);
  } else if (type === 'info') {
    toast.info(message);
  } else {
    toast.success(message);
  }
}

const showRegisterModal = ref(false);
const domainAvailable = ref(true);
const registering = ref(false);
const registerPriceUlmn = ref<number | null>(null);

const registerForm = ref({
  domainName: '',
  years: '1',
  ext: 'lmn'
});

const showSettingsModal = ref(false);
const selectedDomain = ref<DomainRow | null>(null);
type SettingsRecord = { key: string; value: string };
const settingsRecords = ref<SettingsRecord[]>([]);
const settingsPqcParams = ref<any | null>(null);
const settingsWalletBalanceLMN = ref<number | null>(null);
const savingSettings = ref(false);
const showStableSettingsModal = ref(false);
const selectedStableLink = ref<RawDomainRow | null>(null);
const stableSettingsRecords = ref<SettingsRecord[]>([]);
const stableSettingsLoading = ref(false);
const stableSettingsSaving = ref(false);

const showTransferModal = ref(false);
const transferDomain = ref<DomainRow | null>(null);
const transferForm = ref({
  newOwner: ''
});
const transferring = ref(false);
const stableLinkModalMode = ref<'generate' | 'import' | null>(null);
const stableLinkNameDraft = ref('');
const stableLinkSaving = ref(false);
const renamingStableLinkName = ref('');

function coinToLmn(coin: any): number | null {
  if (!coin) return null;
  const denom =
    typeof coin.denom === 'string' ? coin.denom.toLowerCase() : '';
  const raw = coin.amount ?? coin.value ?? coin.quantity ?? coin;
  if (raw == null) return null;
  const parsed = Number.parseFloat(String(raw));
  if (!Number.isFinite(parsed)) return null;
  if (!denom || denom === 'ulmn' || denom === 'ulum') return parsed / 1_000_000;
  if (denom === 'lmn') return parsed;
  return parsed;
}

const settingsPqcCoinRequirement = computed(
  () =>
    settingsPqcParams.value?.minBalanceForLink ??
    settingsPqcParams.value?.min_balance_for_link ??
    null
);

const settingsCostLMN = computed(() =>
  coinToLmn(settingsPqcCoinRequirement.value)
);

const settingsCostLabel = computed(() => {
  if (settingsCostLMN.value != null) {
    return `${settingsCostLMN.value.toFixed(6)} LMN`;
  }
  const coin = settingsPqcCoinRequirement.value;
  if (coin && coin.amount != null) {
    return `${coin.amount}${coin.denom || ''}`;
  }
  return '-';
});

const settingsWalletBalanceLabel = computed(() =>
  settingsWalletBalanceLMN.value == null
    ? '-'
    : `${settingsWalletBalanceLMN.value.toFixed(6)} LMN`
);

const settingsInsufficientBalance = computed(() => {
  if (settingsCostLMN.value == null || settingsCostLMN.value <= 0) {
    return false;
  }
  if (settingsWalletBalanceLMN.value == null) {
    return false;
  }
  return settingsWalletBalanceLMN.value + 1e-9 < settingsCostLMN.value;
});

const hasFundsForSettings = computed(
  () => !settingsInsufficientBalance.value
);

const canSaveSettings = computed(() => {
  if (!selectedDomain.value) return false;
  if (!profileAddress.value) return false;
  const hasValidRecord = settingsRecords.value.some((r) => {
    const key = (r.key || '').trim();
    const value = (r.value || '').trim();
    return !!key && !!value;
  });
  if (!hasValidRecord) return false;
  if (!hasFundsForSettings.value) return false;
  return true;
});

const canTransfer = computed(() => {
  if (!transferDomain.value) return false;
  if (!profileAddress.value) return false;
  const newOwner = (transferForm.value.newOwner || '').trim();
  if (!newOwner) return false;
  // Basic validation: should start with lumen or lmn
  if (!newOwner.startsWith('lumen') && !newOwner.startsWith('lmn')) return false;
  // Should not transfer to self
  if (newOwner === profileAddress.value) return false;
  return true;
});

async function loadRawDomains() {
  rawDomainsLoading.value = true;
  rawDomainsError.value = '';
  try {
    const api = useInternalLumen();
    if (!api?.ipfsKeyList) {
      rawDomainsError.value = 'Stable link bridge not available.';
      rawDomains.value = [];
      return;
    }
    const res = await api.ipfsKeyList();
    if (!res?.ok) {
      rawDomainsError.value = String(res?.error || 'Failed to load stable links.');
      rawDomains.value = [];
      return;
    }
    const keys = Array.isArray(res.keys) ? res.keys : [];
    rawDomains.value = keys
      .map((key: any) => {
        const name = String(key?.Name || key?.name || '').trim();
        const id = String(key?.Id || key?.id || '').trim();
        return {
          name,
          id,
        };
      })
      .filter((key: RawDomainRow) => key.name && key.name !== 'self');
  } catch (e: any) {
    rawDomainsError.value = String(e?.message || e || 'Failed to load stable links.');
    rawDomains.value = [];
  } finally {
    rawDomainsLoading.value = false;
  }
}

function defaultStableLinkName(): string {
  const suffix = Date.now().toString(36);
  return suffix;
}

function sanitizeStableLinkLabel(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function stableLinkKeyNameFromLabel(input: string): string {
  const label = sanitizeStableLinkLabel(input);
  return label ? `stable:${label}` : '';
}

function stableLinkDisplayName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts[0] === 'stable' && parts.length > 1) return parts[parts.length - 1];
  return raw;
}

function openStableLinkModal(mode: 'generate' | 'import') {
  stableLinkModalMode.value = mode;
  stableLinkNameDraft.value = defaultStableLinkName();
}

function closeStableLinkModal() {
  if (stableLinkSaving.value) return;
  stableLinkModalMode.value = null;
  stableLinkNameDraft.value = '';
}

function createStableLink() {
  openStableLinkModal('generate');
}

function importStableLink() {
  openStableLinkModal('import');
}

async function confirmStableLinkModal() {
  const mode = stableLinkModalMode.value;
  if (!mode || stableLinkSaving.value) return;
  const label = sanitizeStableLinkLabel(stableLinkNameDraft.value);
  const keyName = stableLinkKeyNameFromLabel(label);
  if (!keyName) return;
  const api = useInternalLumen();
  if (mode === 'generate' && !api?.ipfsKeyGen) {
    showToast('Stable link bridge not available.', 'error');
    return;
  }
  if (mode === 'import' && !api?.ipfsKeyImport) {
    showToast('Stable link import is not available.', 'error');
    return;
  }

  stableLinkSaving.value = true;
  try {
    const res = mode === 'import'
      ? await api.ipfsKeyImport(keyName)
      : await api.ipfsKeyGen(keyName);
    if (res?.canceled) return;
    if (!res?.ok) {
      showToast(
        String(res?.error || (mode === 'import' ? 'Failed to import stable link.' : 'Failed to generate stable link.')),
        'error'
      );
      return;
    }
    showToast(mode === 'import' ? 'Stable link imported.' : 'Stable link generated.', 'success');
    if (mode === 'generate') {
      showToast('Export this stable link private key so you can import it again later.', 'warning');
    }
    stableLinkModalMode.value = null;
    stableLinkNameDraft.value = '';
    await loadRawDomains();
  } finally {
    stableLinkSaving.value = false;
  }
}

async function renameStableLink(d: RawDomainRow, nextLabelRaw: string) {
  const currentName = String(d?.name || '').trim();
  const nextName = stableLinkKeyNameFromLabel(nextLabelRaw);
  if (!currentName || !nextName || currentName === nextName) return;
  const api = useInternalLumen();
  if (!api?.ipfsKeyRename) {
    showToast('Stable link rename is not available.', 'error');
    return;
  }
  renamingStableLinkName.value = currentName;
  try {
    const res = await api.ipfsKeyRename(currentName, nextName);
    if (!res?.ok) {
      showToast(String(res?.error || 'Failed to rename stable link.'), 'error');
      return;
    }
    showToast('Stable link label updated.', 'success');
    await loadRawDomains();
  } finally {
    renamingStableLinkName.value = '';
  }
}

function renameStableLinkFromEvent(d: RawDomainRow, event: Event) {
  const input = event.target as HTMLInputElement | null;
  void renameStableLink(d, input?.value || '');
}

function rawDomainUrl(d: RawDomainRow): string {
  const id = String(d?.id || '').trim();
  return id ? `lumen://ipns/${id}/` : '';
}

function openRawDomain(d: RawDomainRow) {
  const url = rawDomainUrl(d);
  if (!url) return;
  openInNewTab?.(url);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = String(text || '');
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Electron pages can deny navigator.clipboard depending on origin and focus.
  }

  try {
    const api = useInternalLumen();
    if (typeof api?.clipboardWriteText === 'function') {
      const result = await api.clipboardWriteText(value);
      return result === true || result?.ok === true;
    }
  } catch (e) {
    console.error('[domains] electron clipboard failed', e);
  }
  return false;
}

async function copyRawDomainUrl(d: RawDomainRow) {
  const url = rawDomainUrl(d);
  if (!url) return;
  const ok = await copyTextToClipboard(url);
  if (ok) {
    showToast('Stable link URL copied.', 'success');
  } else {
    showToast('Failed to copy stable link URL.', 'error');
  }
}

async function exportStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyExport) {
    showToast('Stable link export is not available.', 'error');
    return;
  }
  const res = await api.ipfsKeyExport(d.name);
  if (res?.canceled) return;
  if (!res?.ok) {
    showToast(String(res?.error || 'Failed to export stable link.'), 'error');
    return;
  }
  showToast('Stable link private key exported.', 'success');
}

async function deleteStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyRm) {
    showToast('Stable link delete is not available.', 'error');
    return;
  }
  const confirmed = window.confirm(
    `Delete stable link "${d.name}"?\n\nExport it first if you need to restore this IPNS name later.`
  );
  if (!confirmed) return;
  rawDomainsLoading.value = true;
  try {
    const res = await api.ipfsKeyRm(d.name);
    if (!res?.ok) {
      showToast(String(res?.error || 'Failed to delete stable link.'), 'error');
      return;
    }
    showToast('Stable link deleted.', 'success');
    await loadRawDomains();
  } finally {
    rawDomainsLoading.value = false;
  }
}

async function openStableSettingsModal(d: RawDomainRow) {
  selectedStableLink.value = d;
  stableSettingsRecords.value = [];
  showStableSettingsModal.value = true;
  stableSettingsLoading.value = true;
  try {
    const records = d.id ? await loadStableLinkRecords(d.id) : [];
    stableSettingsRecords.value = records.map((record) => ({
      key: String(record.key || '').trim(),
      value: String(record.value || '').trim(),
    }));
  } catch (e) {
    console.error('[domains] load stable link records error', e);
    showToast('Failed to load stable link records.', 'error');
  } finally {
    stableSettingsLoading.value = false;
  }
}

function closeStableSettingsModal() {
  if (stableSettingsSaving.value) return;
  showStableSettingsModal.value = false;
  selectedStableLink.value = null;
  stableSettingsRecords.value = [];
  stableSettingsLoading.value = false;
}

function addStableSettingsRecord() {
  stableSettingsRecords.value = [...stableSettingsRecords.value, { key: '', value: '' }];
}

function removeStableSettingsRecord(index: number) {
  if (index < 0 || index >= stableSettingsRecords.value.length) return;
  const next = stableSettingsRecords.value.slice();
  next.splice(index, 1);
  stableSettingsRecords.value = next;
}

async function saveStableSettings() {
  if (stableSettingsSaving.value) return;
  const stable = selectedStableLink.value;
  if (!stable?.name) {
    showToast('Select a stable link first.', 'error');
    return;
  }
  const records = stableSettingsRecords.value
    .map((r) => ({
      key: String(r.key || '').trim(),
      value: String(r.value || '').trim(),
    }))
    .filter((r) => r.key || r.value);

  if (!records.length) {
    showToast('Add at least one record before saving.', 'error');
    return;
  }
  if (records.some((r) => !r.key || !r.value)) {
    showToast('Each stable link record needs both a key and a value.', 'error');
    return;
  }

  const api = useInternalLumen();
  if (!api?.ipfsAdd || !api?.ipfsPublishToIPNS) {
    showToast('Stable link publish bridge not available.', 'error');
    return;
  }

  stableSettingsSaving.value = true;
  try {
    const body = JSON.stringify({
      lumenRecordsVersion: 1,
      type: 'lumen.stable-link.records',
      updatedAt: new Date().toISOString(),
      records,
    }, null, 2);
    const bodyBytes = Array.from(new TextEncoder().encode(body));
    const add = await api.ipfsAdd(bodyBytes, `${stableLinkDisplayName(stable.name) || 'stable-link'}.lumen-records.json`);
    if (!add?.ok || !add.cid) {
      showToast(String(add?.error || 'Failed to publish stable link records.'), 'error');
      return;
    }
    const published = await api.ipfsPublishToIPNS(add.cid, stable.name);
    if (!published?.ok) {
      showToast(String(published?.error || 'Failed to update stable link.'), 'error');
      return;
    }
    showToast('Stable link records saved.', 'success');
    showStableSettingsModal.value = false;
    selectedStableLink.value = null;
    stableSettingsRecords.value = [];
    await loadRawDomains();
  } finally {
    stableSettingsSaving.value = false;
  }
}

function sanitizeDomainInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const cursorPos = input.selectionStart;
  const oldValue = registerForm.value.domainName;
  // Only allow alphanumeric characters (a-z, A-Z, 0-9) and hyphens (-)
  const sanitized = oldValue.replace(/[^a-zA-Z0-9-]/g, '');
  
  if (sanitized !== oldValue) {
    registerForm.value.domainName = sanitized;
    // Restore cursor position after sanitization
    const removedChars = oldValue.length - sanitized.length;
    const newPos = Math.max(0, (cursorPos || 0) - removedChars);
    // Use nextTick to ensure DOM is updated before setting cursor
    setTimeout(() => {
      input.setSelectionRange(newPos, newPos);
    }, 0);
  }
}

watch(
  () => [registerForm.value.domainName, registerForm.value.ext, showRegisterModal.value],
  async ([name, ext, open]) => {
    if (!open) return;
    if (!name || !(ext || '').trim()) {
      registerPriceUlmn.value = null;
      return;
    }
    await refreshPrice();
  }
);

watch(
  () => activeNameTab.value,
  (tab) => {
    if (tab === 'stable') void loadRawDomains();
  },
  { immediate: true }
);

async function loadSettingsPqcParams() {
  const pqcApi = useInternalLumen()?.pqc;
  settingsPqcParams.value = null;
  if (!pqcApi || typeof pqcApi.getParams !== 'function') return;
  try {
    const res = await pqcApi.getParams();
    if (res && res.ok === false) {
      settingsPqcParams.value = null;
      return;
    }
    const data = (res && (res.data ?? res)) || null;
    const params =
      (data && (data.params || (data as any).data?.params)) || data || null;
    settingsPqcParams.value = params;
  } catch {
    settingsPqcParams.value = null;
  }
}

async function loadSettingsWalletBalance() {
  const owner = (profileAddress.value || '').trim();
  settingsWalletBalanceLMN.value = null;
  if (!owner) return;
  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.getBalance !== 'function') {
    return;
  }
  try {
    const res = await walletApi.getBalance(owner, { denom: 'ulmn' });
    if (!res || res.ok === false) {
      settingsWalletBalanceLMN.value = null;
      return;
    }
    const coin = res.balance || res.data?.balance || res.data || null;
    settingsWalletBalanceLMN.value = coinToLmn(coin);
  } catch {
    settingsWalletBalanceLMN.value = null;
  }
}

async function refreshSettingsFunding() {
  await Promise.all([loadSettingsPqcParams(), loadSettingsWalletBalance()]);
}

function prettyDate(tsMs?: number | null): string {
  if (!tsMs || !Number.isFinite(tsMs)) return '-';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(new Date(tsMs));
  } catch {
    return new Date(tsMs).toISOString();
  }
}

function expiryClass(d: DomainRow): string {
  if (!d.expireAtSeconds) return 'pill-unknown';
  const ms = d.expireAtSeconds * 1000;
  const days = Math.floor((ms - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return 'pill-unknown';
  if (days < 0) return 'pill-expired';
  if (days <= 7) return 'pill-soon';
  if (days <= 30) return 'pill-warn';
  return 'pill-ok';
}

function expiryText(d: DomainRow): string {
  if (!d.expireAtSeconds) return 'Expires: unknown';
  const ms = d.expireAtSeconds * 1000;
  const days = Math.floor((ms - Date.now()) / 86_400_000);
  if (days < 0) return `Expired ${prettyDate(ms)}`;
  return `Expires ${prettyDate(ms)}`;
}

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadDomains();
  }
);

async function loadDomains() {
  loading.value = true;
  error.value = '';
  domains.value = [];
  try {
    const owner = (profileAddress.value || '').trim();
    if (!owner) {
      error.value =
        'No owner address available. Create or select a profile with a wallet first.';
      return;
    }
    const dnsApi = useInternalLumen()?.dns;
    if (!dnsApi || typeof dnsApi.listByOwnerDetailed !== 'function') {
      error.value = 'DNS bridge not available.';
      return;
    }
    const res = await dnsApi.listByOwnerDetailed(owner);
    if (!res || res.ok === false) {
      error.value = res?.error || 'Unable to load domains.';
      return;
    }
    const list = Array.isArray(res.data) ? res.data : [];
    domains.value = list
      .map((dom: any) => {
        const name = String(dom?.name || dom?.index || '').trim();
        if (!name) return null;
        const raw = dom?.expire_at ?? dom?.expireAt ?? null;
        const n =
          typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
        const sec = Number.isFinite(n) && n > 0 ? n : null;
        return { name, expireAtSeconds: sec } as DomainRow;
      })
      .filter((d: DomainRow | null): d is DomainRow => !!d);
  } catch (e) {
    console.error('[domains] loadDomains error', e);
    error.value = 'Unexpected error while loading domains.';
  } finally {
    loading.value = false;
  }
}

function reloadDomains() {
  void loadDomains();
}

function openDomain(d: DomainRow) {
  const url = `lumen://${d.name}`;
  openInNewTab?.(url);
}

async function copyDomainUrl(d: DomainRow) {
  const url = `lumen://${d.name}`;
  const ok = await copyTextToClipboard(url);
  if (ok) {
    showToast('Domain URL copied to clipboard', 'success');
  } else {
    showToast('Failed to copy domain URL', 'error');
  }
}

function openRegisterModal() {
  showRegisterModal.value = true;
  if (!registerForm.value.domainName && profileAddress.value.includes('.')) {
    registerForm.value.domainName = profileAddress.value.split('.')[0];
  }
  void refreshAvailability();
  void refreshPrice();
}

function closeRegisterModal() {
  showRegisterModal.value = false;
  registerForm.value = { domainName: '', years: '1', ext: 'lmn' };
  registerPriceUlmn.value = null;
}

async function refreshAvailability() {
  const name = registerForm.value.domainName.trim();
  const ext = registerForm.value.ext.trim() || 'lmn';
  if (!name || !ext) {
    domainAvailable.value = true;
    return;
  }
  const fqdn = `${name}.${ext}`;
  try {
    const dnsApi = useInternalLumen()?.dns;
    if (!dnsApi || typeof dnsApi.getDomainInfo !== 'function') {
      domainAvailable.value = true;
      return;
    }
    const res = await dnsApi.getDomainInfo(fqdn);
    if (!res || res.ok === false) {
      const status = res?.status ?? 0;
      domainAvailable.value = status === 404;
      return;
    }
    const dom = res.data?.domain || res.data || {};
    const owner = String(dom?.owner || '').trim();
    const st = String(dom?.status || '').toLowerCase();
    const taken = !!owner && st !== 'free';
    domainAvailable.value = !taken;
  } catch (e) {
    console.error('[domains] refreshAvailability error', e);
    domainAvailable.value = true;
  }
}

async function refreshPrice() {
  const name = registerForm.value.domainName.trim();
  const ext = registerForm.value.ext.trim() || 'lmn';
  if (!name || !ext) {
    registerPriceUlmn.value = null;
    return;
  }
  const fqdn = `${name}.${ext}`;
  const days = 365;
  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.estimateRegisterPrice !== 'function') {
    registerPriceUlmn.value = null;
    return;
  }
  try {
    const est = await dnsApi.estimateRegisterPrice({
      name: fqdn,
      duration_days: days
    });
    const amt =
      typeof est?.amountNumber === 'number'
        ? est.amountNumber
        : parseInt(String(est?.amount || '0'), 10) || 0;
    registerPriceUlmn.value = Math.max(0, amt);
  } catch (e) {
    console.error('[domains] refreshPrice error', e);
    registerPriceUlmn.value = null;
  }
}

const registrationFeeLabel = computed(() => {
  if (!registerForm.value.domainName) return 'ƒ?"';
  if (registerPriceUlmn.value == null) return '...';
  const lmn = registerPriceUlmn.value / 1_000_000;
  return `${lmn.toFixed(3)} LMN`;
});

const totalFeeLabel = computed(() => {
  if (!registerForm.value.domainName) return 'ƒ?"';
  const base =
    registerPriceUlmn.value == null ? 0 : registerPriceUlmn.value / 1_000_000;
  const gas = 0.0005;
  return `${(base + gas).toFixed(3)} LMN`;
});

const dnsRegistrationFeeLabel = computed(() => {
  if (!registerForm.value.domainName) return '…';
  if (registerPriceUlmn.value == null) return '...';
  const lmn = registerPriceUlmn.value / 1_000_000;
  return `${lmn.toFixed(6)} LMN`;
});

const dnsTotalFeeLabel = computed(() => {
  if (!registerForm.value.domainName) return '…';
  if (registerPriceUlmn.value == null) return '...';
  const lmn = registerPriceUlmn.value / 1_000_000;
  return `${lmn.toFixed(6)} LMN`;
});

const canRegister = computed(
  () =>
    !!registerForm.value.domainName.trim() &&
    !!(registerForm.value.ext || '').trim() &&
    domainAvailable.value
);

async function confirmRegister() {
  if (!canRegister.value || registering.value) return;
  const namePart = registerForm.value.domainName.trim();
  const extPart = (registerForm.value.ext || '').trim() || 'lmn';
  const fqdn = `${namePart}.${extPart}`;
  const days = 365;

  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.createDomain !== 'function') {
    showToast('Domain registration bridge not available', 'error');
    return;
  }

  const profileId = activeProfileId.value;
  const owner = (profileAddress.value || '').trim();
  if (!profileId || !owner) {
    showToast('Select or create a profile with a wallet address first', 'warning');
    return;
  }

  registering.value = true;
  try {
    const res = await dnsApi.createDomain({
      profileId,
      owner,
      name: fqdn,
      duration_days: days,
    });
    
    if (res?.ok === false && (res?.error === 'password_required' || res?.error === 'invalid_password')) {
      try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
      return;
    }
    
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : 'Registration failed';
      showToast(msg, 'error');
      return;
    }
    showToast('Domain registration submitted successfully', 'success');
    closeRegisterModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmRegister error', e);
    showToast('Unexpected error while submitting registration', 'error');
  } finally {
    registering.value = false;
  }
}

async function openSettingsModal(d?: DomainRow) {
  selectedDomain.value = d || null;
  settingsRecords.value = [];
  showSettingsModal.value = true;

  const name = selectedDomain.value?.name;
  const dnsApi = useInternalLumen()?.dns;
  if (name && dnsApi && typeof dnsApi.getDomainInfo === 'function') {
    try {
      const res = await dnsApi.getDomainInfo(name);
      if (res && res.ok !== false) {
        const dom = res.data?.domain || res.data || {};
        const recs = Array.isArray(dom.records) ? dom.records : [];
        settingsRecords.value = recs.map((r: any) => ({
          key: String(r && r.key ? r.key : '').trim(),
          value: String(r && r.value ? r.value : '').trim()
        }));
      }
    } catch (e) {
      console.error('[domains] openSettingsModal load records error', e);
    }
  }

  void refreshSettingsFunding();
}

function closeSettingsModal(force?: boolean) {
  const isForce = force === true;
  if (savingSettings.value && !isForce) {
    showToast('Update in progress. Please wait...', 'info');
    return;
  }
  showSettingsModal.value = false;
  selectedDomain.value = null;
  savingSettings.value = false;
}

function addSettingsRecord() {
  settingsRecords.value = [...settingsRecords.value, { key: '', value: '' }];
}

function removeSettingsRecord(index: number) {
  if (index < 0 || index >= settingsRecords.value.length) return;
  const next = settingsRecords.value.slice();
  next.splice(index, 1);
  settingsRecords.value = next;
}

async function saveSettings() {
  if (savingSettings.value) return;
  const name = selectedDomain.value?.name;
  const owner = (profileAddress.value || '').trim();
  const profileId = activeProfileId.value;
  if (!name || !owner || !profileId) {
    showToast('Select an active profile with a wallet first.', 'error');
    return;
  }
  const cleaned = settingsRecords.value
    .map((r) => ({
      key: String(r.key || '').trim(),
      value: String(r.value || '').trim()
    }))
    .filter((r) => r.key || r.value);

  if (!cleaned.length) {
    showToast('Add at least one record (key + value) before saving.', 'error');
    return;
  }

  const hasEmptyKeyWithValue = cleaned.some(
    (r) => !r.key && !!r.value
  );
  if (hasEmptyKeyWithValue) {
    showToast('Each record needs a non-empty key when a value is set.', 'error');
    return;
  }

  const records = cleaned.map((r) => ({
    key: r.key,
    value: r.value
  }));

  if (!hasFundsForSettings.value) {
    showToast('Not enough balance to update this domain.', 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.updateDomain !== 'function') {
    showToast('Domain update bridge not available.', 'error');
    return;
  }

  savingSettings.value = true;
  try {
    const res = await dnsApi.updateDomain({
      profileId,
      owner,
      name,
      records,
    });
    
    if (res?.ok === false && (res?.error === 'password_required' || res?.error === 'invalid_password')) {
      try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
      showToast('Wallet locked. Unlock to continue.', 'warning');
      return;
    }
    
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : 'Domain update failed';
      showToast(msg, 'error');
      return;
    }
    showToast('Domain settings updated.', 'success');
    closeSettingsModal(true);
  } catch (e) {
    console.error('[domains] saveSettings error', e);
    showToast('Unexpected error while updating domain.', 'error');
  } finally {
    savingSettings.value = false;
  }
}

function openTransferModal(d: DomainRow) {
  transferDomain.value = d;
  transferForm.value.newOwner = '';
  showTransferModal.value = true;
}

function closeTransferModal() {
  if (transferring.value) {
    showToast('Transfer in progress. Please wait...', 'info');
    return;
  }
  showTransferModal.value = false;
  transferDomain.value = null;
  transferForm.value.newOwner = '';
}

async function confirmTransfer() {
  if (!canTransfer.value || transferring.value) return;
  
  const name = transferDomain.value?.name;
  const newOwner = (transferForm.value.newOwner || '').trim();
  const currentOwner = (profileAddress.value || '').trim();
  const profileId = activeProfileId.value;
  
  if (!name || !newOwner || !currentOwner || !profileId) {
    showToast('Missing required information for transfer', 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.transferDomain !== 'function') {
    showToast('Domain transfer bridge not available', 'error');
    return;
  }

  transferring.value = true;
  try {
    const res = await dnsApi.transferDomain({
      profileId,
      owner: currentOwner,
      name,
      newOwner,
    });
    
    if (res?.ok === false && (res?.error === 'password_required' || res?.error === 'invalid_password')) {
      try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
      showToast('Wallet locked. Unlock to continue.', 'warning');
      return;
    }
    
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : 'Domain transfer failed';
      showToast(msg, 'error');
      return;
    }
    
    showToast(`Domain ${name} transferred successfully`, 'success');
    closeTransferModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmTransfer error', e);
    showToast('Unexpected error while transferring domain', 'error');
  } finally {
    transferring.value = false;
  }
}

void loadDomains();
void loadRawDomains();
</script>

<style scoped>
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #b91c1c;
}

.status-dot.ok {
  background: var(--ios-green);
}

.names-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
}

.names-nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
}

.names-nav-item:hover,
.names-nav-item.active {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.owner-hint {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
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

.main-content {
  flex: 1;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
  overflow-y: auto;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 650;
  color: var(--text-primary);
}

.content-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.05rem;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.btn.primary {
  background: var(--gradient-primary);
  color: #fff;
}

.btn.primary.ghost {
  background: var(--card-bg);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.btn.secondary {
  background: var(--card-bg);
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.btn.full {
  width: 100%;
  justify-content: center;
}

.btn.compact {
  padding: 0.38rem 0.65rem;
  font-size: 0.78rem;
}

.card {
  background: var(--card-bg);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  padding: 1.25rem 1.5rem 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.card-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.card-head p {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.count-pill {
  align-self: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1.5rem;
  text-align: center;
}

.empty.error p {
  color: var(--ios-red);
}

.hero-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.hero-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-tertiary);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}

.domains-list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.domain-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.domain-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.domain-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.stable-link-label-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.stable-link-label-input {
  width: min(260px, 100%);
  min-width: 120px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.25rem 0.35rem;
}

.stable-link-label-input:hover,
.stable-link-label-input:focus {
  background: var(--card-bg);
  border-color: var(--border-color);
  outline: none;
}

.stable-link-saving-icon {
  flex-shrink: 0;
  color: var(--ios-green);
}

.domain-subtitle {
  max-width: 520px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.domain-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
}

.pill {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  border: 1px solid transparent;
}

.pill-unknown {
  background: var(--bg-secondary);
  border-color: #e5e7eb;
  color: var(--text-tertiary);
}

.pill-expired {
  background: var(--fill-error);
  border-color: #fecaca;
  color: var(--ios-red);
}

.pill-soon,
.pill-warn {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.pill-ok {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: var(--ios-green);
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid rgba(148, 163, 184, 0.3);
  border-top-color: var(--accent-color);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
}

.modal {
  background: var(--card-bg);
  border-radius: 14px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.modal-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal-body {
  padding: 1.1rem 1.25rem 1.25rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.modal-desc {
  margin: 0 0 0.8rem;
  font-size: 0.85rem;
  color: var(--text-tertiary);
}

.domain-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.domain-part {
  flex: 1.2;
}

.ext-part {
  flex: 0.8;
}

.dot-sep {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-tertiary);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
}

.availability {
  margin-top: 0.45rem;
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  font-size: 0.8rem;
  background: var(--fill-error);
  color: var(--ios-red);
}

.availability.available {
  background: var(--fill-success);
  color: var(--ios-green);
}

.price-box {
  margin: 0.5rem 0 1.1rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  padding: 0.55rem 0.75rem;
  background: var(--bg-secondary);
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  padding: 0.25rem 0;
  color: var(--text-primary);
}

.price-row.total {
  border-top: 1px solid var(--border-color);
  margin-top: 0.3rem;
  padding-top: 0.4rem;
  font-weight: 600;
}

.price {
  font-weight: 600;
}

.info-card {
  border-radius: 10px;
  padding: 0.8rem 0.9rem;
  background: var(--gradient-primary);
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.info-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.info-expiry {
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

.records-empty {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-bottom: 0.5rem;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.key-input {
  flex: 0.9;
}

.value-input {
  flex: 1.6;
}

.icon-btn.danger {
  border-color: #fecaca;
  background: var(--fill-error);
  color: var(--ios-red);
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 960px) {
  .domain-page {
    flex-direction: column;
  }

  .main-content {
    padding: 1.5rem;
  }
}

.warning-box {
  display: flex;
  gap: 0.75rem;
  padding: 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 10px;
  margin: 1rem 0;
}

.warning-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.warning-content {
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.warning-content strong {
  color: #ef4444;
  font-weight: 600;
}

.btn.danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.btn.danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.375rem;
}
</style>
