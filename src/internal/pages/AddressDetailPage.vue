<template>
  <!-- ####### lumen://network/address/<addr> ADDRESS DETAIL (embedded sub-view of NetworkPage) ####### -->
  <div class="w-full h-full min-h-0 overflow-y-auto bg-primary color-text-primary p-32px">
    <UiLoadingState v-if="loading" message="Loading address data..." />

    <UiErrorState v-else-if="error" :message="error" />

    <UiEmptyState v-else-if="notFound" title="No activity found" description="This address is correctly formatted, but has never sent or received anything on this blockchain." />

    <div v-else-if="address" class="flex flex-column gap-24px">
      <!-- Address Overview Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader title="Address Overview" />
        <div class="p-24px">
          <UiDetailRow label="Address:">
            <UiCopyField :value="address.address" title="Copy address" />
          </UiDetailRow>
          <UiDetailRow label="Account Number:" :value="address.accountNumber" />
          <UiDetailRow label="Sequence:" :value="address.sequence" />
        </div>
      </UiCard>

      <!-- Balances Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader title="Balances" />
        <div class="p-24px">
          <div v-if="address.balances && address.balances.length > 0" class="flex flex-column gap-16px">
            <UiCard class="flex-align-center gap-16px" bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(balance, index) in address.balances" :key="index">
              <UiIconBadge size-class="size-40px" badge-class="color-white bg-gradient-primary">
                <Clock :size="20" />
              </UiIconBadge>
              <div class="flex-1">
                <div class="color-text-primary txt-weight-light text-18px">{{ formatAmount(balance.amount) }}</div>
                <div class="text-12px color-text-tertiary">{{ balance.denom.toUpperCase() }}</div>
              </div>
            </UiCard>
          </div>
          <div v-else class="color-text-tertiary p-32px text-center">
            <p>No balances found</p>
          </div>
        </div>
      </UiCard>

      <!-- Delegations Card -->
      <UiCard v-if="address.delegations && address.delegations.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="`Delegations (${address.delegations.length})`" />
        <div class="p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard class="flex-align-center flex-justify-space-between" bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(delegation, index) in address.delegations" :key="index">
              <div class="flex-align-center gap-12px flex-1">
                <div class="flex-align-justify-center color-white size-32px border-radius-circle txt-weight-light text-14px" :style="{ background: getValidatorColor(delegation.validator) }">
                  <span>{{ delegation.validatorMoniker?.charAt(0).toUpperCase() || 'V' }}</span>
                </div>
                <div class="flex flex-column gap-4px">
                  <div class="color-text-primary txt-weight-light text-14px">{{ delegation.validatorMoniker || delegation.validator }}</div>
                  <div class="color-text-tertiary text-12px mono">{{ shortenAddress(delegation.validator) }}</div>
                </div>
              </div>
              <div class="color-text-primary txt-weight-light text-14px">
                {{ formatAmount(delegation.amount) }} LUMEN
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Recent Transactions Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader title="Recent Transactions" />
        <div class="p-24px">
          <div v-if="address.transactions && address.transactions.length > 0" class="flex flex-column gap-16px">
            <UiCard class="flex-align-center gap-16px" bg-class="bg-primary" border-class="border-1" radius="8px" :shadow="false" hoverable hover-class="transition-all-02 hover-lift-2 hover-shadow-md" v-for="(tx, index) in address.transactions" :key="index">
              <UiIconBadge size-class="size-32px" badge-class="color-text-secondary bg-secondary">
                <Activity :size="16" />
              </UiIconBadge>
              <div class="flex-1">
                <div class="underline-on-hover cursor-pointer mb-4px" @click="navigateToTx(tx.hash)">
                  <code class="underline-target color-primary mono text-12px">{{ shortenHash(tx.hash) }}</code>
                </div>
                <div class="flex gap-16px color-text-tertiary text-12px">
                  <span class="hover-underline cursor-pointer color-primary" @click="navigateToBlock(tx.height)">Block {{ tx.height }}</span>
                  <span>{{ tx.time }}</span>
                </div>
              </div>
              <div class="flex-align-center">
                <span :class="['text-12px flex-inline-align-justify-center', tx.success ? 'bg-fill-success' : 'bg-fill-error']">
                  {{ tx.success ? '✓' : '✗' }}
                </span>
              </div>
            </UiCard>
          </div>
          <div v-else class="color-text-tertiary p-32px text-center">
            <p>No recent transactions found</p>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiDetailRow from '../../ui/UiDetailRow.vue';
import UiLoadingState from '../../ui/UiLoadingState.vue';
import UiCopyField from '../../ui/UiCopyField.vue';
import UiErrorState from '../../ui/UiErrorState.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiCardHeader from '../../ui/UiCardHeader.vue';
import UiIconBadge from '../../ui/UiIconBadge.vue';
import { Clock, Activity } from 'lucide-vue-next';
import { ref, onMounted, computed, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { formatMicroAmount, truncateMiddle } from '../services/format';
import { explorerBlockUrl, explorerTransactionUrl } from '../services/explorerLinks';

import { errorMessage } from '../services/coerce';
import { useTabNavigation } from '../../composables/useTabNavigation';
const loading = ref(true);
const error = ref('');
const notFound = ref(false);
const address = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);


const { openInNewTab } = useTabNavigation();
const accountAddress = computed(() => {
  if (!currentTabUrl || !currentTabUrl.value) return null;
  const match = currentTabUrl.value.match(/\/network\/address\/([a-z0-9]+)/i);
  return match ? match[1] : null;
});

function navigateToTx(hash: string) {
  if (openInNewTab) {
    openInNewTab(explorerTransactionUrl(hash));
  }
}

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(explorerBlockUrl(height));
  }
}

function formatAmount(amount: string | number): string {
  return formatMicroAmount(amount, { decimals: 6, trimTrailingZeros: false, empty: '0' });
}

function shortenAddress(addr: string): string {
  return truncateMiddle(addr, { start: 10, end: 8 });
}

function shortenHash(hash: string): string {
  return truncateMiddle(hash, { start: 8, end: 8 });
}

function getValidatorColor(validator: string): string {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ];
  const hash = validator.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

async function loadAddressData() {
  if (!accountAddress.value) {
    error.value = 'No address provided';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = '';
    notFound.value = false;

    // Thrown rather than optional-chained: without the bridge there is nothing
    // to show, and the catch below turns this into a visible message instead of
    // a page that silently stays empty.
    if (!lumen) throw new Error('Lumen API unavailable');

    const accountResponse = await lumen.net.restGet(
      `/cosmos/auth/v1beta1/accounts/${accountAddress.value}`
    );

    if (!accountResponse.ok) {
      // Cosmos SDK's account query 404s for a well-formed address that has
      // never sent or received anything on-chain - not a real error.
      if (accountResponse.status === 404) {
        notFound.value = true;
        loading.value = false;
        return;
      }
      throw new Error(`Failed to fetch account (status ${accountResponse.status ?? 'unknown'})`);
    }

    const accountData = accountResponse.json;
    const account = accountData.account;

    const balancesResponse = await lumen.net.restGet(
      `/cosmos/bank/v1beta1/balances/${accountAddress.value}`
    );
    
    const balances = balancesResponse.ok ? balancesResponse.json.balances || [] : [];

    const delegationsResponse = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/delegations/${accountAddress.value}`
    );
    
    const delegations = delegationsResponse.ok ? delegationsResponse.json.delegation_responses || [] : [];

    const parsedDelegations = delegations.map((del: any) => ({
      validator: del.delegation?.validator_address || '',
      validatorMoniker: del.validator_moniker || '',
      amount: del.balance?.amount || '0'
    }));

    address.value = {
      address: accountAddress.value,
      accountNumber: account?.account_number || 'N/A',
      sequence: account?.sequence || '0',
      balances: balances,
      delegations: parsedDelegations,
      transactions: []
    };

    loading.value = false;
  } catch (err) {
    error.value = errorMessage(err, 'Failed to load address data');
    loading.value = false;
    console.error('Error loading address:', err);
  }
}

onMounted(() => {
  loadAddressData();
});

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadAddressData();
  }
);

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadAddressData();
  }
);
</script>

