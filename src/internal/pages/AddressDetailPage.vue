<template>
  <div class="w-full h-full min-h-0 overflow-y-auto bg-primary color-text-primary p-32px">
    <div class="mb-32px">
      <UiButton variant="ghost" @click="goBack" class="hover-shadow-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </UiButton>
      <h1 class="text-28px txt-weight-light color-text-primary m-0px">Address Details</h1>
    </div>

    <div v-if="loading" class="chaindetail-loading flex flex-column flex-align-justify-center gap-16px min-h-300px">
      <div class="border-radius-full w-40px h-40px border-3-fill-secondary spinner-accent"></div>
      <p>Loading address data...</p>
    </div>

    <div v-else-if="error" class="chaindetail-error flex flex-column flex-align-justify-center gap-16px min-h-300px">
      <p class="color-error chaindetail-error-p text-16px">{{ error }}</p>
    </div>

    <div v-else-if="address" class="flex flex-column gap-24px">
      <!-- Address Overview Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary chaindetail-card-header-h2 text-16px letter-spacing-0025em">Address Overview</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Address:</span>
            <div class="chaindetail-hash-value flex-align-center gap-8px">
              <code class="bg-secondary color-text-primary chaindetail-hash-value-code py-8px px-12px border-1 border-radius-6px mono text-12px break-all">{{ address.address }}</code>
              <UiButton variant="icon" @click="copyToClipboard(address.address)" title="Copy address">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </UiButton>
            </div>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Account Number:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ address.accountNumber }}</span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Sequence:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ address.sequence }}</span>
          </div>
        </div>
      </UiCard>

      <!-- Balances Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary chaindetail-card-header-h2 text-16px letter-spacing-0025em">Balances</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div v-if="address.balances && address.balances.length > 0" class="flex flex-column gap-16px">
            <UiCard class="flex-align-center gap-16px" bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(balance, index) in address.balances" :key="index">
              <div class="addrdetail-balance-icon flex-align-justify-center color-white size-40px border-radius-circle bg-gradient-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
              </div>
              <div class="flex-1">
                <div class="addrdetail-balance-amount color-text-primary txt-weight-light text-18px">{{ formatAmount(balance.amount) }}</div>
                <div class="text-12px color-text-tertiary">{{ balance.denom.toUpperCase() }}</div>
              </div>
            </UiCard>
          </div>
          <div v-else class="addrdetail-empty-state color-text-tertiary p-32px text-center">
            <p>No balances found</p>
          </div>
        </div>
      </UiCard>

      <!-- Delegations Card -->
      <UiCard v-if="address.delegations && address.delegations.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary chaindetail-card-header-h2 text-16px letter-spacing-0025em">Delegations ({{ address.delegations.length }})</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard class="flex-align-center flex-justify-space-between" bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(delegation, index) in address.delegations" :key="index">
              <div class="flex-align-center gap-12px flex-1">
                <div class="addrdetail-validator-avatar flex-align-justify-center color-white size-32px border-radius-circle txt-weight-light text-14px" :style="{ background: getValidatorColor(delegation.validator) }">
                  <span>{{ delegation.validatorMoniker?.charAt(0).toUpperCase() || 'V' }}</span>
                </div>
                <div class="flex flex-column gap-4px">
                  <div class="addrdetail-validator-name color-text-primary txt-weight-light text-14px">{{ delegation.validatorMoniker || delegation.validator }}</div>
                  <div class="addrdetail-validator-address color-text-tertiary text-12px mono">{{ shortenAddress(delegation.validator) }}</div>
                </div>
              </div>
              <div class="addrdetail-delegation-amount color-text-primary txt-weight-light text-14px">
                {{ formatAmount(delegation.amount) }} LUMEN
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Recent Transactions Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary chaindetail-card-header-h2 text-16px letter-spacing-0025em">Recent Transactions</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div v-if="address.transactions && address.transactions.length > 0" class="flex flex-column gap-16px">
            <UiCard class="flex-align-center gap-16px" bg-class="bg-primary" border-class="border-1" radius="8px" :shadow="false" hoverable hover-class="transition-all-02 hover-lift-2 hover-shadow-md" v-for="(tx, index) in address.transactions" :key="index">
              <div class="addrdetail-tx-icon flex-align-justify-center size-32px border-radius-circle color-text-secondary bg-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div class="flex-1">
                <div class="underline-on-hover cursor-pointer mb-4px" @click="navigateToTx(tx.hash)">
                  <code class="underline-target color-primary mono text-12px">{{ shortenHash(tx.hash) }}</code>
                </div>
                <div class="addrdetail-tx-meta flex gap-16px color-text-tertiary text-12px">
                  <span class="addrdetail-tx-height hover-underline cursor-pointer color-primary" @click="navigateToBlock(tx.height)">Block {{ tx.height }}</span>
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
          <div v-else class="addrdetail-empty-state color-text-tertiary p-32px text-center">
            <p>No recent transactions found</p>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../../ui/UiButton.vue';
import UiCard from '../../ui/UiCard.vue';
import { ref, onMounted, computed, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboard as copyToClipboardShared } from '../../composables/useClipboard';

const loading = ref(true);
const error = ref('');
const address = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const accountAddress = computed(() => {
  if (!currentTabUrl || !currentTabUrl.value) return null;
  const match = currentTabUrl.value.match(/\/explorer\/address\/([a-z0-9]+)/i);
  return match ? match[1] : null;
});

function goBack() {
  if (openInNewTab) {
    openInNewTab('lumen://explorer');
  } else {
    window.location.href = 'lumen://explorer';
  }
}

function navigateToTx(hash: string) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/tx/${hash}`);
  }
}

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/block/${height}`);
  }
}

async function copyToClipboard(text: string) {
  await copyToClipboardShared(text);
}

function formatAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return (num / 1000000).toFixed(6);
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 16) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

function shortenHash(hash: string): string {
  if (!hash || hash.length < 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
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

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
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

    const accountResponse = await lumen.net.restGet(
      `/cosmos/auth/v1beta1/accounts/${accountAddress.value}`
    );
    
    if (!accountResponse.ok) {
      throw new Error(`Failed to fetch account: ${accountResponse.statusText || 'Unknown error'}`);
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
  } catch (err: any) {
    error.value = err.message || 'Failed to load address data';
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

