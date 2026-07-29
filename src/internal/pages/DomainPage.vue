<template>
  <!-- ####### lumen://domain DOMAIN ####### -->
  <div class="internal-page flex">
    <!-- Sidebar -->
    <InternalSidebar title="Domains" :icon="Globe" activeKey="domain">
      <nav class="flex flex-column gap-12px mb-16px">
        <UiSidebarNavSection>
          <UiSidebarNavItem :active="activeNameTab === 'lumen'" @click="activeNameTab = 'lumen'">
            <Globe :size="16" />
            <span>Lumen Domains</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="activeNameTab === 'stable'" @click="activeNameTab = 'stable'">
            <KeyRound :size="16" />
            <span>Ugly domains</span>
            <UiTag variant="success">free</UiTag>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection title="Help">
          <UiSidebarNavItem reveal @click="openInNewTab?.('lumen://help/publish')">
            <Rocket class="reveal-target flex-shrink-0 opacity-85" :size="16" />
            <span>Publish my site</span>
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
              <span>Buy domain</span>
            </UiButton>
          </template>
          <template v-else>
            <UiButton variant="secondary" type="button" @click="importStableLink" class="outline-none">
              <Upload :size="16" />
              <span>Import</span>
            </UiButton>
            <UiButton variant="primary" type="button" @click="createStableLink" class="outline-none">
              <Plus :size="16" />
              <span>Generate</span>
            </UiButton>
          </template>
        </template>
      </UiPageHeader>

      <UiCard v-if="activeNameTab === 'lumen'" border-class="border-1" radius="16px" padding-class="pt-20px pr-24px pb-24px pl-24px" class="shadow-lg" :shadow="false">
        <UiErrorState v-if="error" :message="error" wrapper-class="text-center gap-8px py-32px px-24px" message-class="" />
        <UiLoadingBlock v-else-if="loading" message="Loading your domains..." wrapper-class="text-center gap-8px py-32px px-24px" spinner-class="" />
        <UiEmptyState v-else-if="!domains.length" title="Get your name on Lumen">
          <template #description>
            <p class="text-14px color-text-tertiary m-0px">
              Register a new domain and open it as
              <span class="mono">lumen://your-name.lmn</span>
            </p>
          </template>
          <template #actions>
            <UiButton variant="primary" type="button" @click="openRegisterModal" class="outline-none">
              <Plus :size="16" />
              <span>Buy domain</span>
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
                title="Open lumen URL"
                @click="openDomain(d)">
                <ExternalLink :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Copy lumen URL"
                @click="copyDomainUrl(d)">
                <Copy :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Settings (preview only)"
                @click="openSettingsModal(d)">
                <Settings :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Transfer domain"
                @click="openTransferModal(d)">
                <Send :size="16" />
              </UiButton>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard v-else border-class="border-1" radius="16px" padding-class="pt-20px pr-24px pb-24px pl-24px" class="shadow-lg" :shadow="false">
        <UiLoadingBlock v-if="rawDomainsLoading" message="Loading ugly domains..." wrapper-class="text-center gap-8px py-32px px-24px" spinner-class="" />
        <UiErrorState v-else-if="rawDomainsError" :message="rawDomainsError" wrapper-class="text-center gap-8px py-32px px-24px" message-class="" />
        <UiEmptyState v-else-if="!rawDomains.length" title="Generate an ugly domain" description="Ugly domains are cryptographic names backed by IPNS.">
          <template #actions>
            <UiButton variant="primary" type="button" @click="createStableLink" class="outline-none">
              <Plus :size="16" />
              <span>Generate</span>
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
                  title="Local ugly domain label"
                  @keydown.enter.prevent="renameStableLinkFromEvent(d, $event)"
                  @blur="renameStableLinkFromEvent(d, $event)"
                />
                <Check
                  v-if="renamingStableLinkName === d.name"
                  class="flex-0-0-auto color-success"
                  :size="14"
                />
              </div>
              <span class="mono text-12px color-text-tertiary truncate max-w-520px">{{ d.id || 'IPNS id unavailable' }}</span>
            </div>
            <div class="flex-align-center gap-6px">
              <UiButton variant="icon" type="button"
                title="Open ugly domain"
                :disabled="!d.id"
                @click="openRawDomain(d)">
                <ExternalLink :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Copy ugly domain URL"
                :disabled="!d.id"
                @click="copyRawDomainUrl(d)">
                <Copy :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Edit record"
                :disabled="!d.name"
                @click="openStableSettingsModal(d)">
                <Settings :size="16" />
              </UiButton>
              <UiButton variant="icon" type="button"
                title="Export private key"
                :disabled="!d.name"
                @click="exportStableLink(d)">
                <Download :size="16" />
              </UiButton>
              <UiButton variant="danger" type="button"
                title="Delete ugly domain"
                :disabled="!d.name"
                @click="deleteStableLink(d)">
                <Trash2 :size="16" />
              </UiButton>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiModal :model-value="!!stableLinkModalMode" :title="stableLinkModalMode === 'import' ? 'Import ugly domain' : 'Generate ugly domain'" panel-class="max-w-500px" @update:model-value="closeStableLinkModal">
            <form class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px" @submit.prevent="confirmStableLinkModal">
              <p class="text-14px color-text-tertiary m-0px mb-12px">
                {{ stableLinkModalMode === 'import'
                  ? 'Choose a local private key file and attach it to this ugly domain name.'
                  : 'Create a new IPNS-backed ugly domain with a local private key.' }}
              </p>
              <div class="mb-16px">
                <label class="color-text-secondary block mb-4px text-13px">Ugly domain name</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" v-model="stableLinkNameDraft"
                  autocomplete="off"
                  placeholder="my-link"
                  :disabled="stableLinkSaving"
                  autofocus class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
              </div>
              <div class="flex flex-justify-end gap-8px">
                <UiButton variant="secondary" type="button" :disabled="stableLinkSaving" @click="closeStableLinkModal" class="outline-none">
                  Cancel
                </UiButton>
                <UiButton variant="primary" type="submit"
                  :disabled="stableLinkSaving || !stableLinkNameDraft.trim()" class="outline-none">
                  <span v-if="!stableLinkSaving" class="flex-inline-align-center gap-8px">
                    <component :is="stableLinkModalMode === 'import' ? Upload : Plus" :size="16" />
                    {{ stableLinkModalMode === 'import' ? 'Import' : 'Generate' }}
                  </span>
                  <UiSpinner v-else size="sm" />
                </UiButton>
              </div>
            </form>
      </UiModal>

      <UiModal :model-value="showStableSettingsModal" title="Ugly domain record" panel-class="max-w-500px" @update:model-value="closeStableSettingsModal">
            <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
              <div class="mb-16px">
                <label class="color-text-secondary block mb-4px text-13px">Record (cid)</label>
                <div v-if="stableSettingsLoading" class="color-text-tertiary text-13px mb-8px">
                  Loading record...
                </div>
                <UiInput v-else bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                  v-model="stableSettingsCidValue"
                  placeholder="lumen://ipfs/CID or lumen://ipns/NAME"
                  :disabled="stableSettingsSaving" class="w-full focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                <UiButton variant="secondary" type="button" disabled class="outline-none mt-8px disabled-fade-50" title="Multiple records are only available for Lumen domains, not ugly domains.">
                  Add record
                  <HelpCircle :size="14" />
                </UiButton>
              </div>

              <div class="flex flex-justify-end gap-8px">
                <UiButton variant="secondary" type="button" @click="closeStableSettingsModal" :disabled="stableSettingsSaving" class="outline-none">
                  Cancel
                </UiButton>
                <UiButton variant="primary" type="button" @click="saveStableSettings" :disabled="stableSettingsSaving || stableSettingsLoading" class="outline-none">
                  <span v-if="!stableSettingsSaving" class="flex-inline-align-center gap-8px">
                    <Check :size="16" />
                    Save record
                  </span>
                  <UiSpinner v-else size="sm" />
                </UiButton>
              </div>
            </div>
      </UiModal>

      <!-- Register Domain Modal -->
      <UiModal :model-value="showRegisterModal" title="Register domain" panel-class="max-w-500px" @update:model-value="closeRegisterModal">
            <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
              <div class="mb-16px">
                <label class="color-text-secondary block mb-4px text-13px">Domain</label>
                <div class="flex-align-center gap-6px">
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                    v-model="registerForm.domainName"
                    placeholder="myname"
                    @input="sanitizeDomainInput"
                    @blur="refreshAvailability" class="flex-12 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                  <span class="txt-weight-light color-text-tertiary text-14px">.</span>
                  <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                    v-model="registerForm.ext"
                    placeholder="lmn"
                    @blur="refreshAvailability" class="flex-08 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                </div>
                <div
                  v-if="registerForm.domainName"
                  class="mt-8px border-radius-8px text-13px py-8px px-10px"
                  :class="domainAvailable ? 'color-success bg-fill-success' : 'color-error bg-fill-error'"
                >
                  <span>{{ domainAvailable ? 'Available' : 'Already taken' }}</span>
                </div>
              </div>

              <div class="mb-16px flex-align-center-justify-space-between">
                <label class="color-text-secondary text-13px">Registration period</label>
                <span class="color-text-primary text-13px txt-weight-medium">1 year</span>
              </div>

              <UiCard bg-class="bg-secondary" border-class="border-1" radius="10px" padding-class="py-8px px-12px" class="m-0px mt-8px mb-16px" :shadow="false">
                <div class="mt-4px flex-align-center flex-justify-space-between color-text-primary text-13px px-0px pt-6px border-top-1 txt-weight-light">
                  <span>Total (1 year)</span>
                  <span class="txt-weight-light">{{ dnsTotalFeeLabel }}</span>
                </div>
              </UiCard>

              <UiButton variant="primary" type="button"
                @click="confirmRegister"
                :disabled="!canRegister || registering" class="outline-none">
                <span v-if="!registering" class="flex-inline-align-center gap-8px">
                  <Plus :size="16" />
                  Register domain
                </span>
                <UiSpinner v-else size="sm" />
              </UiButton>
            </div>
      </UiModal>

      <!-- Settings Modal -->
      <UiModal :model-value="showSettingsModal" title="Domain settings" panel-class="max-w-500px" @update:model-value="closeSettingsModal">
            <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
              <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
                <div class="txt-weight-light text-15px">{{ selectedDomain?.name || 'mydomain.lmn' }}</div>
                <div class="text-13px mt-4px">
                  {{ selectedDomain ? expiryText(selectedDomain) : 'Expires: unknown' }}
                </div>
              </div>

              <div class="mb-16px">
                <label class="color-text-secondary block mb-4px text-13px">Records (key / value)</label>
                <div v-if="!settingsRecords.length" class="color-text-tertiary text-13px mb-8px">
                  No records yet. Add a new row below.
                </div>
                <div v-else class="flex flex-column gap-6px mb-8px">
                  <div
                    class="flex-align-center gap-6px"
                    v-for="(r, idx) in settingsRecords"
                    :key="idx"
                  >
                    <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                      v-model="r.key"
                      placeholder="cid | ipns | txt | ..." class="flex-09 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                    <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                      v-model="r.value"
                      placeholder="Value" class="flex-16 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                    <UiButton variant="danger" type="button"
                      @click="removeSettingsRecord(idx)"
                      title="Remove row">
                      <X :size="14" />
                    </UiButton>
                  </div>
                </div>
                <UiButton variant="secondary" type="button" @click="addSettingsRecord" class="outline-none">
                  Add record
                </UiButton>
              </div>

              <UiCard bg-class="bg-secondary" border-class="border-1" radius="10px" padding-class="py-8px px-12px" class="m-0px mt-8px mb-16px" :shadow="false">
                <div class="flex-align-center flex-justify-space-between color-text-primary text-13px py-4px px-0px">
                  <span>Cost</span>
                  <span class="txt-weight-light">{{ settingsCostLabel }}</span>
                </div>
                <div class="flex-align-center flex-justify-space-between color-text-primary text-13px py-4px px-0px">
                  <span>Balance</span>
                  <span class="txt-weight-light">{{ settingsWalletBalanceLabel }}</span>
                </div>
                <p class="text-12px color-text-tertiary mt-8px" v-if="settingsInsufficientBalance">
                  You need at least {{ settingsCostLabel }} available to keep your PQC link active.
                </p>
              </UiCard>

              <div class="flex flex-justify-end gap-8px">
                <UiButton variant="secondary" type="button" @click="closeSettingsModal" class="outline-none">
                  Cancel
                </UiButton>
                <UiButton variant="primary" type="button"
                  @click="saveSettings"
                  :disabled="!canSaveSettings || savingSettings" class="outline-none">
                  <span v-if="!savingSettings" class="flex-inline-align-center gap-8px">
                    <Settings :size="16" />
                    Save changes
                  </span>
                  <UiSpinner v-else size="sm" />
                </UiButton>
              </div>
            </div>
      </UiModal>

      <!-- Transfer Modal -->
      <UiModal :model-value="showTransferModal" title="Transfer domain" panel-class="max-w-500px" @update:model-value="closeTransferModal">
            <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
              <p class="text-14px color-text-tertiary m-0px mb-12px">Transfer ownership of this domain to another address.</p>
              
              <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
                <div class="txt-weight-light text-15px">{{ transferDomain?.name || 'mydomain.lmn' }}</div>
                <div class="text-13px mt-4px">
                  {{ transferDomain ? expiryText(transferDomain) : 'Expires: unknown' }}
                </div>
              </div>

              <div class="mb-16px">
                <label class="color-text-secondary block mb-4px text-13px">New Owner Address</label>
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                  v-model="transferForm.newOwner"
                  placeholder="lumen1..." class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                <p class="text-12px color-text-tertiary mt-8px">Enter the Lumen address of the new owner</p>
              </div>

              <div class="flex border-radius-10px gap-12px p-14px bg-fill-error border-1-error-a30 m-0px mt-16px mb-16px">
                <div class="text-20px flex-shrink-0">⚠️</div>
                <div class="color-text-primary text-13px">
                  <strong class="color-error txt-weight-light">Warning:</strong> This action cannot be undone. Once transferred, you will lose control of this domain.
                </div>
              </div>

              <div class="flex flex-justify-end gap-8px">
                <UiButton variant="secondary" type="button" @click="closeTransferModal" class="outline-none">
                  Cancel
                </UiButton>
                <UiButton variant="danger" type="button"
                  @click="confirmTransfer"
                  :disabled="!canTransfer || transferring" class="outline-none">
                  <span v-if="!transferring" class="flex-inline-align-center gap-8px">
                    <Send :size="16" />
                    Transfer domain
                  </span>
                  <UiSpinner v-else size="sm" />
                </UiButton>
              </div>
            </div>
      </UiModal>
    </main>

  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';
import UiModal from '../../ui/UiModal.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiLoadingBlock from '../../ui/UiLoadingBlock.vue';
import UiErrorState from '../../ui/UiErrorState.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiCard from '../../ui/UiCard.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiTag from '../../ui/UiTag.vue';
import { computed, inject, ref, watch } from 'vue';
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
  Trash2,
  HelpCircle,
  Rocket
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../useTabLoading';
import { loadStableLinkRecords } from '../services/contentResolver';
import type { DomainRow, RawDomainRow, SettingsRecord } from '../../types/domainPage';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
const openInNewTab = inject<(url: string) => void>('openInNewTab');

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
  activeNameTab.value === 'stable' ? 'Ugly domains' : 'Lumen Domains'
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
      rawDomainsError.value = 'Ugly domain bridge not available.';
      rawDomains.value = [];
      return;
    }
    const res = await api.ipfsKeyList();
    if (!res?.ok) {
      rawDomainsError.value = String(res?.error || 'Failed to load ugly domains.');
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
    rawDomainsError.value = String(e?.message || e || 'Failed to load ugly domains.');
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
    showToast('Ugly domain bridge not available.', 'error');
    return;
  }
  if (mode === 'import' && !api?.ipfsKeyImport) {
    showToast('Ugly domain import is not available.', 'error');
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
        String(res?.error || (mode === 'import' ? 'Failed to import ugly domain.' : 'Failed to generate ugly domain.')),
        'error'
      );
      return;
    }
    showToast(mode === 'import' ? 'Ugly domain imported.' : 'Ugly domain generated.', 'success');
    if (mode === 'generate') {
      showToast('Export this ugly domain private key so you can import it again later.', 'warning');
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
    showToast('Ugly domain rename is not available.', 'error');
    return;
  }
  renamingStableLinkName.value = currentName;
  try {
    const res = await api.ipfsKeyRename(currentName, nextName);
    if (!res?.ok) {
      showToast(String(res?.error || 'Failed to rename ugly domain.'), 'error');
      return;
    }
    showToast('Ugly domain label updated.', 'success');
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
    showToast('Ugly domain URL copied.', 'success');
  } else {
    showToast('Failed to copy ugly domain URL.', 'error');
  }
}

async function exportStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyExport) {
    showToast('Ugly domain export is not available.', 'error');
    return;
  }
  const res = await api.ipfsKeyExport(d.name);
  if (res?.canceled) return;
  if (!res?.ok) {
    showToast(String(res?.error || 'Failed to export ugly domain.'), 'error');
    return;
  }
  showToast('Ugly domain private key exported.', 'success');
}

async function deleteStableLink(d: RawDomainRow) {
  const api = useInternalLumen();
  if (!api?.ipfsKeyRm) {
    showToast('Ugly domain delete is not available.', 'error');
    return;
  }
  const confirmed = window.confirm(
    `Delete ugly domain "${d.name}"?\n\nExport it first if you need to restore this IPNS name later.`
  );
  if (!confirmed) return;
  rawDomainsLoading.value = true;
  try {
    const res = await api.ipfsKeyRm(d.name);
    if (!res?.ok) {
      showToast(String(res?.error || 'Failed to delete ugly domain.'), 'error');
      return;
    }
    showToast('Ugly domain deleted.', 'success');
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
    showToast('Failed to load ugly domain record.', 'error');
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
    showToast('Select an ugly domain first.', 'error');
    return;
  }
  const cidValue = stableSettingsCidValue.value.trim();
  if (!cidValue) {
    showToast('Add a CID or lumen:// link before saving.', 'error');
    return;
  }
  const records = [{ key: 'cid', value: cidValue }];

  const api = useInternalLumen();
  if (!api?.ipfsAdd || !api?.ipfsPublishToIPNS) {
    showToast('Ugly domain publish bridge not available.', 'error');
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
      showToast(String(add?.error || 'Failed to publish ugly domain record.'), 'error');
      return;
    }
    const published = await api.ipfsPublishToIPNS(add.cid, stable.name);
    if (!published?.ok) {
      showToast(String(published?.error || 'Failed to update ugly domain.'), 'error');
      return;
    }
    showToast('Ugly domain record saved.', 'success');
    showStableSettingsModal.value = false;
    selectedStableLink.value = null;
    stableSettingsCidValue.value = '';
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
