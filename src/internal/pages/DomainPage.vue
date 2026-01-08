<template>
  <div class="domain-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Globe :size="24" />
        </div>
        <span class="logo-text">Domains</span>
      </div>

      <div class="sidebar-body">

        <div class="profile-card" v-if="activeProfile">
          <div class="avatar">
            <User :size="18" />
          </div>
          <div class="profile-info">
            <span class="profile-label">Active Profile</span>
            <span class="profile-name">{{ activeProfileDisplay }}</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section">
            <span class="nav-label">Manage</span>
            <button class="nav-item active" type="button">
              <List :size="18" />
              <span>My domains</span>
            </button>
          </div>
        </nav>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <header class="content-header">
        <div>
          <h1>My domains</h1>
          <p>Human links to your content on the Lumen network.</p>
        </div>
        <div class="header-actions">
          <button class="btn secondary" type="button" @click="reloadDomains">
            <RefreshCw :size="16" />
            <span>Reload</span>
          </button>
          <button class="btn primary" type="button" @click="openRegisterModal">
            <Plus :size="16" />
            <span>Buy domain</span>
          </button>
        </div>
      </header>

      <section class="card">


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
            </div>
          </li>
        </ul>
      </section>

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
                      ×
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, watchEffect } from 'vue';
import {
  Globe,
  List,
  Plus,
  ExternalLink,
  Copy,
  Settings,
  RefreshCw,
  X,
  User
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';

const openInNewTab = inject<(url: string) => void>('openInNewTab');

type DomainRow = {
  name: string;
  expireAtSeconds: number | null;
};

const profiles = profilesState;
const activeProfile = computed(
  () => profiles.value.find((p) => p.id === activeProfileId.value) || null
);
const profileAddress = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});
const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || ''
);
const domains = ref<DomainRow[]>([]);
const loading = ref(false);
const error = ref('');

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

async function loadSettingsPqcParams() {
  const anyWindow = window as any;
  const pqcApi = anyWindow?.lumen?.pqc;
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
  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
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
    const anyWindow = window as any;
    const dnsApi = anyWindow?.lumen?.dns;
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
  try {
    await navigator.clipboard.writeText(url);
    window.alert('Domain URL copied to clipboard.');
  } catch (e) {
    console.error('[domains] copyDomainUrl error', e);
    window.alert('Failed to copy domain URL.');
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
    const anyWindow = window as any;
    const dnsApi = anyWindow?.lumen?.dns;
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
  const anyWindow = window as any;
  const dnsApi = anyWindow?.lumen?.dns;
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

  const anyWindow = window as any;
  const dnsApi = anyWindow?.lumen?.dns;
  if (!dnsApi || typeof dnsApi.createDomain !== 'function') {
    window.alert('Domain registration bridge not available.');
    return;
  }

  const profileId = activeProfileId.value;
  const owner = (profileAddress.value || '').trim();
  if (!profileId || !owner) {
    window.alert('Select or create a profile with a wallet address first.');
    return;
  }

  registering.value = true;
  try {
    const res = await dnsApi.createDomain({
      profileId,
      owner,
      name: fqdn,
      duration_days: days
    });
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : 'Registration failed';
      window.alert(msg);
      return;
    }
    window.alert('Domain registration submitted.');
    closeRegisterModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmRegister error', e);
    window.alert('Unexpected error while submitting registration.');
  } finally {
    registering.value = false;
  }
}

async function openSettingsModal(d?: DomainRow) {
  selectedDomain.value = d || null;
  settingsRecords.value = [];
  showSettingsModal.value = true;

  const name = selectedDomain.value?.name;
  const anyWindow = window as any;
  const dnsApi = anyWindow?.lumen?.dns;
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

function closeSettingsModal() {
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
    window.alert('Select an active profile with a wallet first.');
    return;
  }
  const cleaned = settingsRecords.value
    .map((r) => ({
      key: String(r.key || '').trim(),
      value: String(r.value || '').trim()
    }))
    .filter((r) => r.key || r.value);

  if (!cleaned.length) {
    window.alert('Add at least one record (key + value) before saving.');
    return;
  }

  const hasEmptyKeyWithValue = cleaned.some(
    (r) => !r.key && !!r.value
  );
  if (hasEmptyKeyWithValue) {
    window.alert('Each record needs a non-empty key when a value is set.');
    return;
  }

  const records = cleaned.map((r) => ({
    key: r.key,
    value: r.value
  }));

  if (!hasFundsForSettings.value) {
    window.alert('Not enough balance to update this domain.');
    return;
  }

  const anyWindow = window as any;
  const dnsApi = anyWindow?.lumen?.dns;
  if (!dnsApi || typeof dnsApi.updateDomain !== 'function') {
    window.alert('Domain update bridge not available.');
    return;
  }

  savingSettings.value = true;
  try {
    const res = await dnsApi.updateDomain({
      profileId,
      owner,
      name,
      records
    });
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : 'Domain update failed';
      window.alert(msg);
      return;
    }
    window.alert('Domain settings updated.');
    closeSettingsModal();
  } catch (e) {
    console.error('[domains] saveSettings error', e);
    window.alert('Unexpected error while updating domain.');
  } finally {
    savingSettings.value = false;
  }
}

void loadDomains();
</script>

<style scoped>
.domain-page {
  display: flex;
  height: 100vh;
  background: var(--bg-tertiary);
  overflow: hidden;
}

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
  margin-bottom: 1.25rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.logo-text {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.sidebar-note {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: var(--fill-error);
  color: var(--ios-red);
  font-size: 0.8rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #b91c1c;
}

.status-dot.ok {
  background: var(--ios-green);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-top: 0.75rem;
  border: 1px solid var(--border-color);
}

.avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.profile-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  margin-top: 0.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  border: none;
  background: var(--gradient-primary);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.owner-block {
  margin-top: 1rem;
}

.owner-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 0.25rem;
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
  color: var(--text-primary);
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

.domain-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
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

  .sidebar {
    width: 100%;
    max-width: none;
    border-right: none;
    border-bottom: 2px solid var(--border-color);
  }

  .main-content {
    padding: 1.5rem;
  }
}
</style>
