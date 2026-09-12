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
          <UiSidebarNavItem :active="activeNameTab === 'auctions'" @click="activeNameTab = 'auctions'">
            <Gavel :size="16" />
            <span>{{ t('Auctions') }}</span>
            <UiTag v-if="auctionRows.length" variant="warning">{{ auctionRows.length }}</UiTag>
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
          <template v-else-if="activeNameTab === 'auctions'">
            <UiButton variant="secondary" type="button" :disabled="auctionsLoading" @click="loadAuctionList" class="outline-none">
              <RefreshCw :size="16" />
              <span>{{ t('Refresh') }}</span>
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
          <li v-for="d in domainRows" :key="d.name" class="flex-align-center flex-justify-space-between border-radius-10px border-1 bg-secondary py-10px px-12px">
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
              <!--
                Loud only when it needs to be: a labelled button once the name
                is expiring or expired, a plain icon the rest of the year.
              -->
              <UiButton
                v-if="d.renewable"
                :variant="d.urgency === 'urgent' ? 'primary' : d.urgency === 'soon' ? 'secondary' : 'icon'"
                type="button"
                :title="t('Renew domain')"
                @click="openRenewModal(d)">
                <RefreshCw :size="16" />
                <span v-if="d.urgency !== 'none'">{{ t('Renew') }}</span>
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

      <!--
        Auctions.
        Two things live here, because they are the same list from either side:
        a name someone else let lapse, which anyone can bid on, and a name of
        one's own that lapsed far enough to be auctioned - which is the last
        warning an owner gets before it is gone.
      -->
      <UiCard v-else-if="activeNameTab === 'auctions'" border-class="border-1" radius="16px" padding-class="pt-20px pr-24px pb-24px pl-24px" class="shadow-lg" :shadow="false">
        <UiWarningBox v-if="myAuctionedNames.length" box-class="mb-16px">
          {{ t('One of your domains is being auctioned: {names}. Renewing keeps it only until the auction settles with a winning bid.', { names: myAuctionedNames.join(', ') }) }}
        </UiWarningBox>

        <UiErrorState v-if="auctionsError" :message="auctionsError" wrapper-class="text-center gap-8px py-32px px-24px" message-class="" />
        <UiLoadingBlock v-else-if="auctionsLoading" :message="t('Loading auctions…')" wrapper-class="text-center gap-8px py-32px px-24px" spinner-class="" />
        <UiEmptyState
          v-else-if="!auctionRows.length"
          :title="t('No domains are up for auction')"
          :description="t('A domain is auctioned only after it expires and its grace period runs out. Nothing on the chain is in that window right now.')"
        />
        <template v-else>
          <ul class="flex flex-column gap-8px p-0px list-style-none m-0px mt-12px">
            <li v-for="row in auctionRows" :key="row.name" class="flex-align-center flex-justify-space-between border-radius-10px border-1 bg-secondary py-10px px-12px gap-12px">
              <div class="flex flex-column gap-2px min-w-0">
                <span class="txt-weight-light color-text-primary text-14px">{{ row.name }}</span>
                <span class="text-12px color-text-tertiary">
                  {{ auctionClosesLabel(row) }} · {{ highestBidLabel(row) }}
                </span>
              </div>
              <div class="flex-align-center gap-6px flex-shrink-0">
                <UiButton variant="icon" type="button"
                  :title="t('Open lumen URL')"
                  @click="openInNewTab?.(`lumen://${row.name}`)">
                  <ExternalLink :size="16" />
                </UiButton>
                <UiButton v-if="row.open" variant="primary" type="button" @click="openBidModal(row)" class="outline-none">
                  <Gavel :size="16" />
                  <span>{{ t('Bid') }}</span>
                </UiButton>
                <UiButton v-else-if="row.settleable" variant="secondary" type="button"
                  :disabled="settlingName === row.name"
                  :title="t('Hand the name to the winning bidder and take their bid')"
                  @click="confirmSettle(row)" class="outline-none">
                  <UiSpinner v-if="settlingName === row.name" size="sm" />
                  <span v-else>{{ t('Settle') }}</span>
                </UiButton>
              </div>
            </li>
          </ul>
          <p v-if="auctions?.truncated" class="text-12px color-text-tertiary mt-12px m-0px">
            {{ t('Only the first {count} domains were checked, so an auction may be missing from this list.', { count: auctions?.scannedDomains || 0 }) }}
          </p>
        </template>
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

      <DomainSettingsDialog :model-value="showSettingsModal" :records="settingsRecords" :domain="selectedDomain" :expiry-label="selectedDomain ? expiryText(selectedDomain) : ''" :cost-label="settingsCostLabel" :pqc-min-balance-label="settingsPqcMinBalanceLabel" :cooldown-seconds="settingsCooldownSeconds" :wallet-balance-label="settingsWalletBalanceLabel" :can-submit="canSaveSettings" :busy="savingSettings" :insufficient-balance="settingsInsufficientBalance" @update:model-value="closeSettingsModal" @submit="saveSettings" @add-record="addSettingsRecord" @remove-record="removeSettingsRecord" />

      <TransferDomainDialog :model-value="showTransferModal" :new-owner="transferForm.newOwner" :domain="transferDomain" :expiry-label="transferDomain ? expiryText(transferDomain) : ''" :fee-label="transferFeeLabel" :can-submit="canTransfer" :busy="transferring" @update:model-value="closeTransferModal" @update:new-owner="transferForm.newOwner = $event" @submit="confirmTransfer" />

      <RenewDomainDialog :model-value="showRenewModal" :domain="renewDomain" :status="renewDomain?.status || 'active'" :expiry-label="renewDomain ? expiryText(renewDomain) : ''" :duration-days="renewDurationDays" :price-label="renewPriceLabel" :new-expiry-label="renewNewExpiryLabel" :can-submit="canSubmitRenew" :busy="renewing" @update:model-value="closeRenewModal" @update:duration-days="renewDurationDays = $event" @submit="confirmRenew" />

      <BidDomainDialog :model-value="showBidModal" :auction="bidAuction" :closes-label="bidAuction ? auctionClosesLabel(bidAuction) : ''" :highest-bid-label="bidAuction ? highestBidLabel(bidAuction) : ''" :minimum-bid-label="bidMinimumLabel" :amount="bidAmount" :amount-error="bidAmountError" :bid-fee-label="bidFeeLabel" :can-submit="canSubmitBid" :busy="bidding" @update:model-value="closeBidModal" @update:amount="bidAmount = $event" @submit="confirmBid" />
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
import UiWarningBox from '../../ui/UiWarningBox.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiTag from '../../ui/UiTag.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { updateCooldownSeconds } from '../services/countdown';
import { describeChainError } from '../services/chainErrors';
import { paramNumber, unwrapModuleParams } from '../services/moduleParams';
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
  Rocket,
  Gavel,
  RefreshCw
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../../stores/profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { useToast } from '../../composables/useToast';
import { useTabLoadingSync } from '../../composables/useTabLoading';
import { copyToClipboardWithToast } from '../../composables/useClipboard';
import { loadStableLinkRecords } from '../services/contentResolver';
import type { DomainRow, RawDomainRow, SettingsRecord , DomainRegisterForm } from '../../types/domainPage';

import { errorMessage } from '../services/coerce';
import { isUserFacingKeyName, sanitizeStableLinkLabel, stableLinkDisplayName, stableLinkKeyNameFromLabel } from '../services/stableLinks';
import UglyDomainNameDialog from '../../dialogs/UglyDomainNameDialog.vue';
import UglyDomainRecordDialog from '../../dialogs/UglyDomainRecordDialog.vue';
import RegisterDomainDialog from '../../dialogs/RegisterDomainDialog.vue';
import DomainSettingsDialog from '../../dialogs/DomainSettingsDialog.vue';
import TransferDomainDialog from '../../dialogs/TransferDomainDialog.vue';
import RenewDomainDialog from '../../dialogs/RenewDomainDialog.vue';
import BidDomainDialog from '../../dialogs/BidDomainDialog.vue';
import {
  formatUlmn,
  lmnLabel,
  loadAuctions,
  minimumNextBidUlmn,
  toLifecycleStatus,
  toUlmn
} from '../services/domainAuctions';
import type { AuctionList, AuctionRow } from '../../types/domainAuctions';
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
const activeNameTab = ref<'lumen' | 'stable' | 'auctions'>('lumen');
const rawDomains = ref<RawDomainRow[]>([]);
const rawDomainsLoading = ref(false);
const rawDomainsError = ref('');

const pageTitle = computed(() => {
  if (activeNameTab.value === 'stable') return t('Ugly domains');
  if (activeNameTab.value === 'auctions') return t('Auctions');
  return t('Lumen Domains');
});

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

// ---------------------------------------------------------------------------
// Renew, and auctions.
//
// A registration lapses in three steps: it expires, it sits in a grace period
// where only the owner can rescue it, then it opens to public auction and the
// name can be bought out from under them. Both halves of that are here - the
// renew action on the owner's own rows, and the auction list anyone can bid in.
// Neither computes the windows: the main process does, the way the chain does.
// ---------------------------------------------------------------------------
const showRenewModal = ref(false);
const renewDomain = ref<DomainRow | null>(null);
const renewDurationDays = ref(365);
const renewPriceUlmn = ref<number | null>(null);
const renewing = ref(false);

const auctions = ref<AuctionList | null>(null);
const auctionsLoading = ref(false);
const auctionsError = ref('');
const showBidModal = ref(false);
const bidAuction = ref<AuctionRow | null>(null);
const bidAmount = ref('');
const bidding = ref(false);
const settlingName = ref('');

/**
 * Ticks while the page is open so that every countdown below counts down.
 *
 * An auction is seven days wide and the numbers that matter are at its end, so
 * a static "closes in 2 hours" rendered once on load is wrong by the time
 * anyone reads it.
 */
const auctionNow = ref(Date.now());
const auctionClock = window.setInterval(() => {
  auctionNow.value = Date.now();
}, 30_000);

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

/**
 * What saving a record actually costs, read from the chain.
 *
 * This line used to show `pqc.minBalanceForLink` - the balance a wallet must
 * keep for its PQC link to stay active - labelled "Cost". Two different numbers
 * for two different things, and the one on screen was not the one being
 * charged. The fee is `update_fee_ulmn` in the dns module's params, and it is
 * governable: proposal #1 in this app's own governance screen exists to change
 * it, so a constant would be wrong by design.
 */
const dnsUpdateFeeUlmn = ref<number | null>(null);
const dnsUpdateRateLimitSeconds = ref<number | null>(null);

async function loadDnsUpdateFee() {
  const dnsApi = useInternalLumen()?.dns;
  if (!dnsApi || typeof dnsApi.getParams !== 'function') {
    dnsUpdateFeeUlmn.value = null;
    dnsUpdateRateLimitSeconds.value = null;
    return;
  }
  try {
    const params = unwrapModuleParams(await dnsApi.getParams());
    dnsUpdateFeeUlmn.value = paramNumber(params, 'updateFeeUlmn', 'update_fee_ulmn');
    dnsUpdateRateLimitSeconds.value = paramNumber(
      params,
      'updateRateLimitSeconds',
      'update_rate_limit_seconds'
    );
    dnsTransferFeeUlmn.value = paramNumber(params, 'transferFeeUlmn', 'transfer_fee_ulmn');
  } catch (e) {
    console.error('[domains] loadDnsUpdateFee error', e);
    dnsUpdateFeeUlmn.value = null;
    dnsUpdateRateLimitSeconds.value = null;
    dnsTransferFeeUlmn.value = null;
  }
}

/**
 * What a transfer costs, from the same params query. Governable like the update
 * fee, and the transfer dialog asked for an irreversible signature without ever
 * naming a price.
 */
const dnsTransferFeeUlmn = ref<number | null>(null);

const transferFeeLabel = computed(() =>
  dnsTransferFeeUlmn.value == null
    ? '…'
    : `${(dnsTransferFeeUlmn.value / 1_000_000).toFixed(6)} LMN`
);

/**
 * The dns module refuses a second update inside its rate limit, and says only
 * "domain updated too recently". Both numbers needed to answer "how long" are
 * already here, so the dialog states the wait rather than letting the user
 * discover it by paying for a refused transaction.
 *
 * `settingsNow` ticks so the number counts down while the dialog is open.
 */
const settingsNow = ref(Date.now());
const settingsClock = window.setInterval(() => {
  settingsNow.value = Date.now();
}, 1000);
onBeforeUnmount(() => window.clearInterval(settingsClock));
onBeforeUnmount(() => window.clearInterval(auctionClock));

/** Read for the open dialog, from the chain, each time it opens. */
const settingsUpdatedAtSeconds = ref<number | null>(null);

const settingsCooldownSeconds = computed(() =>
  updateCooldownSeconds(
    settingsUpdatedAtSeconds.value,
    dnsUpdateRateLimitSeconds.value,
    settingsNow.value
  )
);

const settingsCostLMN = computed(() =>
  dnsUpdateFeeUlmn.value == null ? null : dnsUpdateFeeUlmn.value / 1_000_000
);

const settingsCostLabel = computed(() =>
  settingsCostLMN.value == null ? '…' : `${settingsCostLMN.value.toFixed(6)} LMN`
);

/** Separate from the fee, and said separately: it is a floor, not a charge. */
const settingsPqcMinBalanceLMN = computed(() =>
  coinToLmn(settingsPqcCoinRequirement.value)
);

const settingsPqcMinBalanceLabel = computed(() =>
  settingsPqcMinBalanceLMN.value == null
    ? ''
    : `${settingsPqcMinBalanceLMN.value.toFixed(6)} LMN`
);

const settingsWalletBalanceLabel = computed(() =>
  settingsWalletBalanceLMN.value == null
    ? '-'
    : `${settingsWalletBalanceLMN.value.toFixed(6)} LMN`
);

/**
 * The wallet has to cover the fee *and* stay above the PQC floor, so the bar is
 * whichever is higher - covering only the fee would sign a transaction that
 * breaks the link that signs it.
 */
const settingsRequiredLMN = computed(() => {
  const fee = settingsCostLMN.value ?? 0;
  const floor = settingsPqcMinBalanceLMN.value ?? 0;
  const required = Math.max(fee, floor);
  return required > 0 ? required : null;
});

const settingsInsufficientBalance = computed(() => {
  if (settingsRequiredLMN.value == null) return false;
  if (settingsWalletBalanceLMN.value == null) return false;
  return settingsWalletBalanceLMN.value + 1e-9 < settingsRequiredLMN.value;
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
  // The chain would refuse it, and charge for the attempt.
  if (settingsCooldownSeconds.value > 0) return false;
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
      .filter((key: RawDomainRow) => isUserFacingKeyName(key.name));
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
  await Promise.all([
    loadSettingsPqcParams(),
    loadSettingsWalletBalance(),
    // Refetched every time rather than cached: governance can change it, and
    // this dialog is where the number is acted on.
    loadDnsUpdateFee(),
  ]);
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
  // Was a bare template literal, so the one label an owner sees at the moment
  // it matters most was the only one still in English in every language.
  if (days < 0) return t('Expired {date}', { date: prettyDate(ms) });
  return t('Expires {date}', { date: prettyDate(ms) });
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
        const rawUpdated = dom?.updated_at ?? dom?.updatedAt ?? null;
        const updated =
          typeof rawUpdated === 'string' ? parseInt(rawUpdated, 10) : Number(rawUpdated);
        // The lifecycle comes from the main process, which computes it the way
        // the chain does. Recomputing it here from `expire_at` is how the badge
        // on this row and the auction list end up disagreeing.
        const lifecycle = dom?.lifecycle || null;
        const auctionStart = Number(lifecycle?.auctionStart ?? 0);
        return {
          name,
          expireAtSeconds: sec,
          updatedAtSeconds: Number.isFinite(updated) && updated > 0 ? updated : null,
          status: lifecycle ? toLifecycleStatus(lifecycle.status) : null,
          auctionStartSeconds: Number.isFinite(auctionStart) && auctionStart > 0 ? auctionStart : null,
        } as DomainRow;
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
  settingsUpdatedAtSeconds.value = d?.updatedAtSeconds ?? null;
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
        // From this fetch, not from the list row. The row is whatever the list
        // held when it was last loaded, and after saving once it still carries
        // the timestamp from before - so the cooldown computed from it had
        // already elapsed, and the button re-enabled itself for a change the
        // chain was certain to refuse.
        const rawUpdated = dom.updated_at ?? dom.updatedAt ?? null;
        const updated =
          typeof rawUpdated === 'string' ? parseInt(rawUpdated, 10) : Number(rawUpdated);
        settingsUpdatedAtSeconds.value =
          Number.isFinite(updated) && updated > 0 ? updated : null;
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
      // Through the chain-error table, not raw: this path handed the module's
      // own English straight to the toast, which is how "domain updated too
      // recently: invalid request" reached the screen.
      const raw = res && res.error ? String(res.error) : '';
      showToast(describeChainError(raw) || raw || t('Failed to update the domain.'), 'error');
      return;
    }
    showToast(t('Domain settings updated.'), 'success');
    closeSettingsModal(true);
    // The list still holds the timestamp from before this save, and the
    // cooldown is computed from it - without this the dialog reopens saying
    // there is no wait, for a change the chain will refuse.
    void loadDomains();
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
  // The fee is governable, so it is read when the dialog opens rather than kept.
  void loadDnsUpdateFee();
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
    
    showToast(t('Domain {name} transferred successfully', { name }), 'success');
    closeTransferModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmTransfer error', e);
    showToast(t('Unexpected error while transferring domain'), 'error');
  } finally {
    transferring.value = false;
  }
}

// ---------------------------------------------------------------------------
// Renew
// ---------------------------------------------------------------------------

/**
 * How long is left before the name stops being the owner's to renew quietly.
 *
 * Measured to the auction opening, not to the expiry: the grace period after
 * expiry is still uncontested, and counting down to the expiry alone tells an
 * owner they have zero days left while they in fact have a week.
 */
function daysUntil(seconds: number | null): number | null {
  if (!seconds) return null;
  return Math.ceil((seconds * 1000 - auctionNow.value) / 86_400_000);
}

/** Rows the page nags about: expired, or close enough that it matters. */
const RENEW_SOON_DAYS = 30;

function renewUrgency(d: DomainRow): 'none' | 'soon' | 'urgent' {
  if (d.status === 'grace' || d.status === 'auction') return 'urgent';
  const days = daysUntil(d.expireAtSeconds);
  if (days == null) return 'none';
  return days <= RENEW_SOON_DAYS ? 'soon' : 'none';
}

/**
 * The rows as drawn, each carrying how loudly it is asking to be renewed.
 *
 * Decorated here rather than called from the template: the urgency depends on
 * the ticking clock, and a template calling it once per button per row would
 * recompute the same answer three times a row on every tick.
 */
const domainRows = computed(() =>
  domains.value.map((d) => ({
    ...d,
    urgency: renewUrgency(d),
    renewable: canRenewDomain(d)
  }))
);

/**
 * A domain that has gone `free` is past renewing: the row still names the old
 * owner, so the chain would take the money and extend a registration anyone
 * else can now claim underneath.
 */
function canRenewDomain(d: DomainRow): boolean {
  return d.status !== 'free';
}

function openRenewModal(d: DomainRow) {
  renewDomain.value = d;
  renewDurationDays.value = 365;
  renewPriceUlmn.value = null;
  showRenewModal.value = true;
  void refreshRenewPrice();
}

function closeRenewModal() {
  showRenewModal.value = false;
  renewDomain.value = null;
  renewPriceUlmn.value = null;
}

/**
 * What the chain would charge. Renew is priced by the same quote as
 * registration - `params.PriceQuote(len(domain), len(ext), days)` - so the
 * existing estimate is asked rather than the arithmetic being repeated here.
 */
async function refreshRenewPrice() {
  const name = renewDomain.value?.name;
  if (!name) {
    renewPriceUlmn.value = null;
    return;
  }
  const dnsApi = useInternalLumen()?.dns;
  if (typeof dnsApi?.estimateRegisterPrice !== 'function') {
    renewPriceUlmn.value = null;
    return;
  }
  try {
    const est = await dnsApi.estimateRegisterPrice({
      name,
      duration_days: renewDurationDays.value
    });
    const amount =
      typeof est?.amountNumber === 'number'
        ? est.amountNumber
        : parseInt(String(est?.amount || '0'), 10) || 0;
    renewPriceUlmn.value = Math.max(0, amount);
  } catch (e) {
    console.error('[domains] refreshRenewPrice error', e);
    renewPriceUlmn.value = null;
  }
}

watch(renewDurationDays, () => {
  void refreshRenewPrice();
});

const renewPriceLabel = computed(() =>
  renewPriceUlmn.value == null ? '…' : lmnLabel(String(renewPriceUlmn.value))
);

/**
 * The expiry this renewal buys. The chain adds the duration to the existing
 * expiry, not to today - so renewing early loses nothing, and the dialog says
 * so with a date rather than leaving it to be assumed either way.
 */
const renewNewExpiryLabel = computed(() => {
  const from = renewDomain.value?.expireAtSeconds;
  if (!from) return '';
  const next = (from + renewDurationDays.value * 86_400) * 1000;
  return t('New expiry: {date}', { date: prettyDate(next) });
});

const canSubmitRenew = computed(
  () => !!renewDomain.value && renewDurationDays.value > 0 && !renewing.value
);

async function confirmRenew() {
  if (!canSubmitRenew.value || renewing.value) return;
  const name = renewDomain.value?.name;
  const owner = (profileAddress.value || '').trim();
  const profileId = activeProfileId.value;
  if (!name || !owner || !profileId) {
    showToast(t('Missing required information for renewal'), 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (typeof dnsApi?.renewDomain !== 'function') {
    showToast(t('Domain renewal bridge not available.'), 'error');
    return;
  }

  renewing.value = true;
  try {
    const res = await dnsApi.renewDomain({
      profileId,
      owner,
      name,
      durationDays: renewDurationDays.value
    });
    if (await handledSigningFailure(res, t('Failed to renew the domain.'))) return;

    showToast(t('Domain {name} renewed', { name }), 'success');
    closeRenewModal();
    await loadDomains();
  } catch (e) {
    console.error('[domains] confirmRenew error', e);
    showToast(t('Unexpected error while renewing domain'), 'error');
  } finally {
    renewing.value = false;
  }
}

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

/**
 * The three ways a signature fails that every caller here handles the same way,
 * in one place: a locked wallet has to lock the session before anything else,
 * and the rest is the chain's own message.
 *
 * @returns true when the result was a failure and has been reported.
 */
async function handledSigningFailure(res: any, fallback: string): Promise<boolean> {
  if (res?.ok === false && (res?.error === 'password_required' || res?.error === 'invalid_password')) {
    try { await useInternalLumen()?.security?.lockSession?.(); } catch { /* already locked */ }
    showToast(t('Wallet locked. Unlock to continue.'), 'warning');
    return true;
  }
  if (!res || res.ok === false) {
    showToast(res?.error ? describeChainError(String(res.error)) : fallback, 'error');
    return true;
  }
  return false;
}

async function loadAuctionList() {
  auctionsLoading.value = true;
  auctionsError.value = '';
  try {
    auctions.value = await loadAuctions();
  } catch (e) {
    console.error('[domains] loadAuctionList error', e);
    auctionsError.value = t('Failed to load auctions.');
  } finally {
    auctionsLoading.value = false;
  }
}

const auctionRows = computed(() => auctions.value?.rows || []);

const bidFeeLabel = computed(() => lmnLabel(String(auctions.value?.bidFeeUlmn ?? 0)));

/** Whether one of my own domains is among the names being auctioned. */
const myAuctionedNames = computed(() => {
  const mine = new Set(domains.value.map((d) => d.name));
  return auctionRows.value.filter((row) => mine.has(row.name)).map((row) => row.name);
});

function auctionClosesLabel(row: AuctionRow): string {
  if (!row.auctionEndSeconds) return t('Closing time unknown');
  const remainingMs = row.auctionEndSeconds * 1000 - auctionNow.value;
  if (remainingMs <= 0) return t('Closed, waiting to be settled');

  const hours = Math.floor(remainingMs / 3_600_000);
  if (hours >= 48) return t('Closes in {count} days', { count: Math.floor(hours / 24) });
  if (hours >= 1) return t('Closes in {count} hours', { count: hours });
  return t('Closes in {count} minutes', { count: Math.max(1, Math.floor(remainingMs / 60_000)) });
}

function highestBidLabel(row: AuctionRow): string {
  return row.highestBidUlmn ? lmnLabel(row.highestBidUlmn) : t('No bids yet');
}

/**
 * The floor the dialog shows. One ulmn over the standing bid where there is
 * one; where there is none the chain's floor is a year of registration for that
 * specific name, which is not known here - so the dialog says that in words
 * rather than printing a number it would be guessing.
 */
const bidMinimumLabel = computed(() => {
  const current = bidAuction.value?.highestBidUlmn || '';
  const next = minimumNextBidUlmn(current);
  return next ? lmnLabel(next) : t('One year of registration for this name');
});

/** Empty while what is typed is still bid-able; the dialog shows it in place of its hint. */
const bidAmountError = computed(() => {
  const typed = bidAmount.value.trim();
  if (!typed) return '';
  const ulmn = toUlmn(typed);
  if (!ulmn || ulmn === '0') return t('Enter an amount in LMN, to at most six decimals.');
  const current = bidAuction.value?.highestBidUlmn || '';
  if (current && BigInt(ulmn) <= BigInt(current)) {
    return t('Must be more than the highest bid of {amount}', { amount: lmnLabel(current) });
  }
  return '';
});

const canSubmitBid = computed(
  () => !!bidAuction.value && !!toUlmn(bidAmount.value.trim()) && !bidAmountError.value && !bidding.value
);

function openBidModal(row: AuctionRow) {
  bidAuction.value = row;
  // Pre-filled with the smallest winning bid: the amount that is always valid,
  // and the one someone has to type by hand from a number shown elsewhere.
  const next = minimumNextBidUlmn(row.highestBidUlmn);
  bidAmount.value = next ? formatUlmn(next) : '';
  showBidModal.value = true;
}

function closeBidModal() {
  showBidModal.value = false;
  bidAuction.value = null;
  bidAmount.value = '';
}

async function confirmBid() {
  if (!canSubmitBid.value || bidding.value) return;
  const name = bidAuction.value?.name;
  const owner = (profileAddress.value || '').trim();
  const profileId = activeProfileId.value;
  const amountUlmn = toUlmn(bidAmount.value.trim());
  if (!name || !owner || !profileId || !amountUlmn) {
    showToast(t('Missing required information for the bid'), 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (typeof dnsApi?.bidDomain !== 'function') {
    showToast(t('Auction bridge not available.'), 'error');
    return;
  }

  bidding.value = true;
  try {
    const res = await dnsApi.bidDomain({ profileId, owner, name, amountUlmn });
    if (await handledSigningFailure(res, t('Failed to place the bid.'))) return;

    showToast(t('Bid placed on {name}', { name }), 'success');
    closeBidModal();
    await loadAuctionList();
  } catch (e) {
    console.error('[domains] confirmBid error', e);
    showToast(t('Unexpected error while placing the bid'), 'error');
  } finally {
    bidding.value = false;
  }
}

/**
 * Closes a finished auction. Anyone may send this - the chain reads the winner
 * off the auction row - and until somebody does, the winning bidder has not
 * been given the name they won.
 */
async function confirmSettle(row: AuctionRow) {
  if (settlingName.value) return;
  const owner = (profileAddress.value || '').trim();
  const profileId = activeProfileId.value;
  if (!row.name || !owner || !profileId) {
    showToast(t('Select or create a profile with a wallet first.'), 'error');
    return;
  }

  const dnsApi = useInternalLumen()?.dns;
  if (typeof dnsApi?.settleDomain !== 'function') {
    showToast(t('Auction bridge not available.'), 'error');
    return;
  }

  settlingName.value = row.name;
  try {
    const res = await dnsApi.settleDomain({ profileId, owner, name: row.name });
    if (await handledSigningFailure(res, t('Failed to settle the auction.'))) return;

    showToast(t('Auction for {name} settled', { name: row.name }), 'success');
    await Promise.all([loadAuctionList(), loadDomains()]);
  } catch (e) {
    console.error('[domains] confirmSettle error', e);
    showToast(t('Unexpected error while settling the auction'), 'error');
  } finally {
    settlingName.value = '';
  }
}

/**
 * Refetched on every return to the tab, because what it shows is a set of
 * deadlines and the page is often left open.
 */
watch(activeNameTab, (tab) => {
  if (tab === 'auctions') void loadAuctionList();
});

void loadDomains();
void loadRawDomains();
// Also loaded up front, unasked: it is three requests, and it is what puts the
// count on the sidebar tab and finds an owner's own name in the list. A warning
// nobody sees until they open the tab is not a warning.
void loadAuctionList();
</script>