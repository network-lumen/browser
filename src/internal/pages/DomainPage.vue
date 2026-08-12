<template>
  <!-- ####### lumen://domain DOMAIN ####### -->
  <div class="internal-page flex">
    <InternalSidebar :title="t('Domains')" :icon="Globe" activeKey="domain">
      <nav class="flex flex-column gap-12px mb-16px">
        <UiSidebarNavSection>
          <UiSidebarNavItem :active="activeNameTab === 'lumen'" @click="activeNameTab = 'lumen'">
            <Globe :size="16" />
            <span>{{ t('Lumen Domains') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="activeNameTab === 'stable'" @click="activeNameTab = 'stable'">
            <KeyRound :size="16" />
            <span>{{ t('Ugly domains') }}</span>
            <UiTag variant="success">{{ t('Free') }}</UiTag>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection :title="t('Help')">
          <UiSidebarNavItem reveal @click="openInNewTab?.('lumen://help/publish')">
            <Rocket class="reveal-target flex-shrink-0 opacity-85" :size="16" />
            <span>{{ t('Publish my site') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="flex-1 min-w-0 bg-secondary overflow-y-auto py-32px px-40px">
      <UiPageHeader :title="pageTitle" title-size="24px">
        <template #actions>
          <template v-if="activeNameTab === 'lumen'">
            <UiButton variant="primary" type="button" @click="openRegisterModal" class="outline-none">
              <Plus :size="16" />
              <span>{{ t('Buy domain') }}</span>
            </UiButton>
          </template>
          <template v-else>
            <UiButton variant="secondary" type="button" @click="importStableLink" class="outline-none">
              <Upload :size="16" />
              <span>{{ t('Import') }}</span>
            </UiButton>
            <UiButton variant="primary" type="button" @click="createStableLink" class="outline-none">
              <Plus :size="16" />
              <span>{{ t('Generate') }}</span>
            </UiButton>
          </template>
        </template>
      </UiPageHeader>

      <UiCard v-if="activeNameTab === 'lumen'" border-class="border-1" radius="16px" padding-class="pt-20px pr-24px pb-24px pl-24px" class="shadow-lg" :shadow="false">
        <UiErrorState v-if="error" :message="error" wrapper-class="text-center gap-8px py-32px px-24px" message-class="" />
        <UiLoadingBlock v-else-if="loading" :message="t('Loading your domains…')" wrapper-class="text-center gap-8px py-32px px-24px" spinner-class="" />
        <UiEmptyState v-else-if="!domains.length" :title="t('Get your name on Lumen')">
          <template #description>
            <p class="text-14px color-text-tertiary m-0px">
              {{ t('Register a new domain and open it as {example}', { example: 'lumen://your-name.lmn' }) }}
            </p>
          </template>
          <template #actions>
            <UiButton variant="primary" type="button" @click="openRegisterModal" class="outline-none">
              <Plus :size="16" />
              <span>{{ t('Buy domain') }}</span>
            </UiButton>
          </template>
        </UiEmptyState>
        <ul v-else class="flex flex-column gap-8px p-0px list-style-none m-0px mt-12px">
          <li v-for="d in domains" :key="d.name" class="flex-align-center flex-justify-space-between border-radius-10px border-1 bg-secondary py-10px px-12px">
            <div class="flex flex-column gap-2px min-w-0">
              <span class="txt-weight-light color-text-primary text-14px">{{ d.name }}</span>
            </div>
            <div class="flex-align-center gap-6px">
              <span
                v-if="d.expireAtSeconds"
                class="border-radius-full fw-500 text-12px line-height-12 cursor-pointer py-4px px-10px"
                :class="expiryClass(d)"
                :title="prettyDate(d.expireAtSeconds * 1000)"
              >
                {{ expiryText(d) }}
              </span>
              <UiButton variant="icon" type="button"
                :title="t('Open lumen URL')"
                @click="openDomain(d)">
                <ExternalLink :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Copy lumen URL')"
                @click="copyDomainUrl(d)">
                <Copy :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Settings (preview only)')"
                @click="openSettingsModal(d)">
                <Settings :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Transfer domain')"
                @click="openTransferModal(d)">
                <Send :size="16" />
              </UiButton>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard v-else border-class="border-1" radius="16px" padding-class="pt-20px pr-24px pb-24px pl-24px" class="shadow-lg" :shadow="false">
        <UiLoadingBlock v-if="rawDomainsLoading" :message="t('Loading ugly domains…')" wrapper-class="text-center gap-8px py-32px px-24px" spinner-class="" />
        <UiErrorState v-else-if="rawDomainsError" :message="rawDomainsError" wrapper-class="text-center gap-8px py-32px px-24px" message-class="" />
        <UiEmptyState v-else-if="!rawDomains.length" :title="t('Generate an ugly domain')" :description="t('Ugly domains are cryptographic names backed by IPNS.')">
          <template #actions>
            <UiButton variant="primary" type="button" @click="createStableLink" class="outline-none">
              <Plus :size="16" />
              <span>{{ t('Generate') }}</span>
            </UiButton>
          </template>
        </UiEmptyState>
        <ul v-else class="flex flex-column gap-8px p-0px list-style-none m-0px mt-12px">
          <li v-for="d in rawDomains" :key="d.name" class="flex-align-center flex-justify-space-between border-radius-10px border-1 bg-secondary py-10px px-12px">
            <div class="flex flex-column gap-2px min-w-0">
              <div class="flex-align-center gap-6px min-w-0">
                <input
                  class="hover-focus-bg-card-border-outline-none color-text-primary txt-weight-light border-1-transparent border-radius-8px bg-transparent text-14px min-w-120px py-4px px-6px w-min-260px-full"
                  type="text"
                  :value="stableLinkDisplayName(d.name)"
                  :disabled="renamingStableLinkName === d.name"
                  :title="t('Local ugly domain label')"
                  @keydown.enter.prevent="renameStableLinkFromEvent(d, $event)"
                  @blur="renameStableLinkFromEvent(d, $event)"
                />
                <Check
                  v-if="renamingStableLinkName === d.name"
                  class="flex-0-0-auto color-success"
                  :size="14"
                />
              </div>
              <span class="mono text-12px color-text-tertiary truncate max-w-520px">{{ d.id || t('IPNS ID not available') }}</span>
            </div>
            <div class="flex-align-center gap-6px">
              <UiButton variant="icon" type="button"
                :title="t('Open ugly domain')"
                :disabled="!d.id"
                @click="openRawDomain(d)">
                <ExternalLink :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Copy ugly domain URL')"
                :disabled="!d.id"
                @click="copyRawDomainUrl(d)">
                <Copy :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Edit record')"
                :disabled="!d.name"
                @click="openStableSettingsModal(d)">
                <Settings :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                :title="t('Export private key')"
                :disabled="!d.name"
                @click="exportStableLink(d)">
                <Download :size="16" />
              </UiButton>
              <UiButton variant="danger" type="button"
                :title="t('Delete ugly domain')"
                :disabled="!d.name"
                @click="deleteStableLink(d)">
                <Trash2 :size="16" />
              </UiButton>
            </div>
          </li>
        </ul>
      </UiCard>

      <UglyDomainNameDialog :model-value="!!stableLinkModalMode" :mode="stableLinkModalMode" :name="stableLinkNameDraft" :saving="stableLinkSaving" @update:model-value="closeStableLinkModal" @update:name="stableLinkNameDraft = $event" @submit="confirmStableLinkModal" />

      <UglyDomainRecordDialog :model-value="showStableSettingsModal" :cid="stableSettingsCidValue" :loading="stableSettingsLoading" :saving="stableSettingsSaving" @update:model-value="closeStableSettingsModal" @update:cid="stableSettingsCidValue = $event" @submit="saveStableSettings" />

      <RegisterDomainDialog :model-value="showRegisterModal" :form="registerForm" :can-submit="canRegister" :busy="registering" @refresh-availability="refreshAvailability" :domain-available="domainAvailable" :dns-total-fee-label="dnsTotalFeeLabel" @update:model-value="closeRegisterModal" @submit="confirmRegister" />

      <DomainSettingsDialog :model-value="showSettingsModal" :records="settingsRecords" :domain="selectedDomain" :expiry-label="selectedDomain ? expiryText(selectedDomain) : ''" :cost-label="settingsCostLabel" :wallet-balance-label="settingsWalletBalanceLabel" :can-submit="canSaveSettings" :busy="savingSettings" :insufficient-balance="settingsInsufficientBalance" @update:model-value="closeSettingsModal" @submit="saveSettings" @add-record="addSettingsRecord" @remove-record="removeSettingsRecord" />

      <TransferDomainDialog :model-value="showTransferModal" :new-owner="transferForm.newOwner" :domain="transferDomain" :expiry-label="transferDomain ? expiryText(transferDomain) : ''" :can-submit="canTransfer" :busy="transferring" @update:model-value="closeTransferModal" @update:new-owner="transferForm.newOwner = $event" @submit="confirmTransfer" />
    </main>

  </div>
</template>

<script setup lang="ts">
import { t } from '../../stores/i18nStore';
import UiButton from '../../ui/UiButton.vue';
import UiLoadingBlock from '../../ui/UiLoadingBlock.vue';
import UiErrorState from '../../ui/UiErrorState.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiCard from '../../ui/UiCard.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiTag from '../../ui/UiTag.vue';
import { computed, ref, watch } from 'vue';
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
  Send,
  Trash2,
  Rocket
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../../stores/profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { copyToClipboardWithToast } from '../../composables/useClipboard';
import { loadStableLinkRecords } from '../services/contentResolver';
import type { DomainRow, RawDomainRow, SettingsRecord , DomainRegisterForm } from '../../types/domainPage';

import { errorMessage } from '../services/coerce';
import { sanitizeStableLinkLabel, stableLinkDisplayName, stableLinkKeyNameFromLabel } from '../services/stableLinks';
import UglyDomainNameDialog from '../../dialogs/UglyDomainNameDialog.vue';
import UglyDomainRecordDialog from '../../dialogs/UglyDomainRecordDialog.vue';
import RegisterDomainDialog from '../../dialogs/RegisterDomainDialog.vue';
import DomainSettingsDialog from '../../dialogs/DomainSettingsDialog.vue';
import TransferDomainDialog from '../../dialogs/TransferDomainDialog.vue';
import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
const { currentTabRefresh } = useTabState();

const { openInNewTab } = useTabNavigation();
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
  activeNameTab.value === 'stable' ? t('Ugly domains') : t('Lumen Domains')
);

useTabLoadingSync(loading);

const toast = useToast();
const showToast = toast.show;

const showRegisterModal = ref(false);
const domainAvailable = ref(true);
const registering = ref(false);
const registerPriceUlmn = ref<number | null>(null);

const registerForm = ref<DomainRegisterForm>({
  domainName: '',
  years: '1',
  ext: 'lmn'
});

const showSettingsModal = ref(false);
const selectedDomain = ref<DomainRow | null>(null);
const settingsRecords = ref<SettingsRecord[]>([]);
const settingsPqcParams = ref<any | null>(null);
const settingsWalletBalanceLMN = ref<number | null>(null);
const savingSettings = ref(false);
const showStableSettingsModal = ref(false);
const selectedStableLink = ref<RawDomainRow | null>(null);
// Ugly domains (IPNS-backed stable links) resolve through the same
// preferred-key lookup as Lumen domains (pickRecordTarget in
// contentResolver.ts, checked in order cid/ipfs/ipns/root/site/website), but
// unlike a real Lumen domain an ugly domain has no other way to be reached
// (no subdomain/record-key routing) - so only the "cid" key is ever
// actually usable when typed into the address bar. Anything else the user
// added just sat there unused, so this is locked to a single cid field.
const stableSettingsCidValue = ref('');
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
      rawDomainsError.value = t('Ugly domain bridge not available.');
      rawDomains.value = [];
      return;
    }
    const res = await api.ipfsKeyList();
    if (!res?.ok) {
      rawDomainsError.value = String(res?.error || t('Failed to load ugly domains.'));
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
  } catch (e) {
    rawDomainsError.value = errorMessage(e, t('Failed to load ugly domains.'));
    rawDomains.value = [];
  } finally {
    rawDomainsLoading.value = false;
  }
}

function defaultStableLinkName(): string {
  const suffix = Date.now().toString(36);
  return suffix;
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
  // Checked before the two mode-specific guards below: those only cover one
  // mode each, so neither on its own establishes that the bridge is there.
  if (!api) {
    showToast(t('Ugly domain bridge not available.'), 'error');
    return;
  }
  if (mode === 'generate' && !api.ipfsKeyGen) {
    showToast(t('Ugly domain bridge not available.'), 'error');
    return;
  }
  if (mode === 'import' && !api.ipfsKeyImport) {
    showToast(t('Ugly domain import is not available.'), 'error');
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
        String(res?.error || (mode === 'import' ? t('Failed to import ugly domain.') : t('Failed to generate ugly domain.'))),
        'error'
      );
      return;
    }
    showToast(mode === 'import' ? t('Ugly domain imported.') : t('Ugly domain generated.'), 'success');
    if (mode === 'generate') {
      showToast(t('Export this ugly domain private key so you can import it again later.'), 'warning');
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
    showToast(t('Ugly domain rename is not available.'), 'error');
    return;
  }
  renamingStableLinkName.value = currentName;
  try {
    const res = await api.ipfsKeyRename(currentName, nextName);
    if (!res?.ok) {
      showToast(String(res?.error || t('Failed to rename ugly domain.')), 'error');
      return;
    }
    showToast(t('Ugly domain label updated.'), 'success');
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

async function copyRawDomainUrl(d: RawDomainRow) {
  const url = rawDomainUrl(d);
  if (!url) return;
  await copyToClipboardWithToast(url);
}

async function exportStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyExport) {
    showToast(t('Ugly domain export is not available.'), 'error');
    return;
  }
  const res = await api.ipfsKeyExport(d.name);
  if (res?.canceled) return;
  if (!res?.ok) {
    showToast(String(res?.error || t('Failed to export ugly domain.')), 'error');
    return;
  }
  showToast(t('Ugly domain private key exported.'), 'success');
}

async function deleteStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyRm) {
    showToast(t('Ugly domain delete is not available.'), 'error');
    return;
  }
  const confirmed = window.confirm(
    t('Delete ugly domain “{name}”?\n\nExport it first if you need to restore this IPNS name later.', { name: d.name })
  );
  if (!confirmed) return;
  rawDomainsLoading.value = true;
  try {
    const res = await api.ipfsKeyRm(d.name);
    if (!res?.ok) {
      showToast(String(res?.error || t('Failed to delete ugly domain.')), 'error');
      return;
    }
    showToast(t('Ugly domain deleted.'), 'success');
    await loadRawDomains();
  } finally {
    rawDomainsLoading.value = false;
  }
}

async function openStableSettingsModal(d: RawDomainRow) {
  selectedStableLink.value = d;
  stableSettingsCidValue.value = '';
  showStableSettingsModal.value = true;
  stableSettingsLoading.value = true;
  try {
    const records = d.id ? await loadStableLinkRecords(d.id) : [];
    const cidRecord = records.find((record) => String(record.key || '').trim().toLowerCase() === 'cid');
    stableSettingsCidValue.value = String(cidRecord?.value || '').trim();
  } catch (e) {
    console.error('[domains] load stable link record error', e);
    showToast(t('Failed to load ugly domain record.'), 'error');
  } finally {
    stableSettingsLoading.value = false;
  }
}

function closeStableSettingsModal() {
  if (stableSettingsSaving.value) return;
  showStableSettingsModal.value = false;
  selectedStableLink.value = null;
  stableSettingsCidValue.value = '';
  stableSettingsLoading.value = false;
}

async function saveStableSettings() {
  if (stableSettingsSaving.value) return;
  const stable = selectedStableLink.value;
  if (!stable?.name) {
    showToast(t('Select an ugly domain first.'), 'error');
    return;
  }
  const cidValue = stableSettingsCidValue.value.trim();
  if (!cidValue) {
    showToast(t('Add a CID or lumen:// link before saving.'), 'error');
    return;
  }
  const records = [{ key: 'cid', value: cidValue }];

  const api = useInternalLumen();
  if (!api?.ipfsAdd || !api?.ipfsPublishToIPNS) {
    showToast(t('Ugly domain publish bridge not available.'), 'error');
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
      showToast(String(add?.error || t('Failed to publish ugly domain record.')), 'error');
      return;
    }
    const published = await api.ipfsPublishToIPNS(add.cid, stable.name);
    if (!published?.ok) {
      showToast(String(published?.error || t('Failed to update ugly domain.')), 'error');
      return;
    }
    showToast(t('Ugly domain record saved.'), 'success');
    showStableSettingsModal.value = false;
    selectedStableLink.value = null;
    stableSettingsCidValue.value = '';
    await loadRawDomains();
  } finally {
    stableSettingsSaving.value = false;
  }
}

watch(
  // `as const` keeps this a [string, string, boolean] tuple. Without it the
  // array widens to (string | boolean)[] and `ext` arrives as string | true.
  () => [registerForm.value.domainName, registerForm.value.ext, showRegisterModal.value] as const,
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
  if (!d.expireAtSeconds) return 'bg-fill-tertiary color-text-tertiary';
  const ms = d.expireAtSeconds * 1000;
  const days = Math.floor((ms - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return 'bg-fill-tertiary color-text-tertiary';
  if (days < 0) return 'bg-fill-error color-error';
  if (days <= 7) return 'bg-warning-a15 color-warning';
  if (days <= 30) return 'bg-warning-a15 color-warning';
  return 'bg-fill-success color-success';
}

function expiryText(d: DomainRow): string {
  if (!d.expireAtSeconds) return t('Expires: unknown');
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
        t('Select or create a profile with a wallet first.');
      return;
    }
    const dnsApi = useInternalLumen()?.dns;
    if (!dnsApi || typeof dnsApi.listByOwnerDetailed !== 'function') {
      error.value = t('DNS bridge not available.');
      return;
    }
    const res = await dnsApi.listByOwnerDetailed(owner);
    if (!res || res.ok === false) {
      error.value = res?.error || t('Failed to load domains.');
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
    error.value = t('Unexpected error while loading domains.');
  } finally {
    loading.value = false;
  }
}

function openDomain(d: DomainRow) {
  const url = `lumen://${d.name}`;
  openInNewTab?.(url);
}

async function copyDomainUrl(d: DomainRow) {
  await copyToClipboardWithToast(`lumen://${d.name}`);
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
    showToast(t('Domain registration bridge not available.'), 'error');
    return;
  }

  const profileId = activeProfileId.value;
  const owner = (profileAddress.value || '').trim();
  if (!profileId || !owner) {
    showToast(t('Select or create a profile with a wallet first.'), 'warning');
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
      const msg = res && res.error ? String(res.error) : t('Registration failed');
      showToast(msg, 'error');
      return;
    }
    showToast(t('Domain registration submitted successfully'), 'success');
    closeRegisterModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmRegister error', e);
    showToast(t('Unexpected error while submitting registration'), 'error');
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
    showToast(t('Update in progress. Please wait…'), 'info');
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
    showToast(t('Select or create a profile with a wallet first.'), 'error');
    return;
  }
  const cleaned = settingsRecords.value
    .map((r) => ({
      key: String(r.key || '').trim(),
      value: String(r.value || '').trim()
    }))
    .filter((r) => r.key || r.value);

  if (!cleaned.length) {
    showToast(t('Add at least one record (key + value) before saving.'), 'error');
    return;
  }

  const hasEmptyKeyWithValue = cleaned.some(
    (r) => !r.key && !!r.value
  );
  if (hasEmptyKeyWithValue) {
    showToast(t('Each record needs a non-empty key when a value is set.'), 'error');
    return;
  }

  const records = cleaned.map((r) => ({
    key: r.key,
    value: r.value
  }));

  if (!hasFundsForSettings.value) {
    showToast(t('Not enough balance to update this domain.'), 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.updateDomain !== 'function') {
    showToast(t('Domain update bridge not available.'), 'error');
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
      showToast(t('Wallet locked. Unlock to continue.'), 'warning');
      return;
    }
    
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : t('Failed to update the domain.');
      showToast(msg, 'error');
      return;
    }
    showToast(t('Domain settings updated.'), 'success');
    closeSettingsModal(true);
  } catch (e) {
    console.error('[domains] saveSettings error', e);
    showToast(t('Unexpected error while updating domain.'), 'error');
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
    showToast(t('Transfer in progress. Please wait…'), 'info');
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
    showToast(t('Missing required information for transfer'), 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.transferDomain !== 'function') {
    showToast(t('Domain transfer bridge not available.'), 'error');
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
      showToast(t('Wallet locked. Unlock to continue.'), 'warning');
      return;
    }
    
    if (!res || res.ok === false) {
      const msg = res && res.error ? String(res.error) : t('Failed to transfer the domain.');
      showToast(msg, 'error');
      return;
    }
    
    showToast(`Domain ${name} transferred successfully`, 'success');
    closeTransferModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmTransfer error', e);
    showToast(t('Unexpected error while transferring domain'), 'error');
  } finally {
    transferring.value = false;
  }
}

void loadDomains();
void loadRawDomains();
</script>