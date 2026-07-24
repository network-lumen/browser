<template>
  <div class="w-full h-full min-h-0 overflow-y-auto bg-primary color-text-primary p-32px">
    <div v-if="loading" class="chaindetail-loading flex flex-column flex-align-justify-center gap-16px min-h-300px">
      <div class="border-radius-full w-40px h-40px border-3-fill-secondary spinner-accent"></div>
      <p>Loading transaction data...</p>
    </div>

    <div v-else-if="error" class="chaindetail-error flex flex-column flex-align-justify-center gap-16px min-h-300px">
      <p class="color-error chaindetail-error-p text-16px">{{ error }}</p>
    </div>

    <div v-else-if="transaction" class="flex flex-column gap-24px">
      <!-- Transaction Overview Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary txt-weight-light m-0px chaindetail-card-header-h2 text-16px letter-spacing-0025em">Transaction Overview</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Transaction Hash:</span>
            <div class="chaindetail-hash-value flex-align-center gap-8px">
              <code class="bg-secondary color-text-primary flex-1 chaindetail-hash-value-code py-8px px-12px border-1 border-radius-6px mono text-12px break-all">{{ transaction.hash }}</code>
              <UiButton variant="icon" @click="copyToClipboard(transaction.hash)" title="Copy hash">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </UiButton>
            </div>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Status:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">
              <span class="py-4px px-12px border-radius-full text-12px" :class="transaction.success ? 'bg-fill-success' : 'bg-fill-error'">
                {{ transaction.success ? '✓ Success' : '✗ Failed' }}
              </span>
            </span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Block Height:</span>
            <span class="chaindetail-value underline cursor-pointer color-primary text-14px break-all hover-color-accent-secondary" @click="navigateToBlock(transaction.height)">
              {{ transaction.height }}
            </span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Time:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ transaction.time }}</span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Gas Used:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ formatNumber(transaction.gasUsed) }}</span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Gas Wanted:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ formatNumber(transaction.gasWanted) }}</span>
          </div>
          <div class="hover-mx-n05rem-px-05rem last-border-bottom-none gap-16px grid border-bottom-1-light py-14px px-0px hover-border-radius-6px hover-bg-hover grid-cols-180-1fr">
            <span class="chaindetail-label color-text-secondary fw-500 text-14px">Fee:</span>
            <span class="chaindetail-value color-text-primary text-14px break-all">{{ transaction.fee }}</span>
          </div>
        </div>
      </UiCard>

      <!-- Messages Card -->
      <UiCard v-if="transaction.messages && transaction.messages.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary txt-weight-light m-0px chaindetail-card-header-h2 text-16px letter-spacing-0025em">Messages ({{ transaction.messages.length }})</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(msg, index) in transaction.messages" :key="index">
              <div class="txdetail-item-header flex-align-center flex-justify-space-between mb-12px">
                <span class="txdetail-item-type color-text-primary txt-weight-light text-14px">{{ msg.type }}</span>
                <span class="txdetail-item-index color-text-tertiary text-12px">#{{ Number(index) + 1 }}</span>
              </div>
              <div class="txdetail-item-data">
                <pre class="bg-primary color-text-primary p-16px m-0px word-wrap-break border-1 border-radius-6px mono text-12px pre-wrap overflow-x-auto">{{ JSON.stringify(msg.value, null, 2) }}</pre>
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Events Card -->
      <UiCard v-if="transaction.events && transaction.events.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary txt-weight-light m-0px chaindetail-card-header-h2 text-16px letter-spacing-0025em">Events ({{ transaction.events.length }})</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(event, index) in transaction.events" :key="index">
              <div class="txdetail-item-type color-text-primary txt-weight-light text-14px">{{ event.type }}</div>
              <div class="txdetail-event-attributes flex flex-column gap-8px mt-12px">
                <div class="flex gap-8px text-12px" v-for="(attr, attrIndex) in event.attributes" :key="attrIndex">
                  <span class="txdetail-attr-key color-text-secondary txt-weight-light min-w-120px">{{ attr.key }}:</span>
                  <span class="color-text-primary break-all">{{ attr.value }}</span>
                </div>
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Raw Data Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 p-0px pt-16px pr-24px pb-16px pl-24px">
          <h2 class="color-text-primary txt-weight-light m-0px chaindetail-card-header-h2 text-16px letter-spacing-0025em">Raw Transaction Data</h2>
        </div>
        <div class="chaindetail-card-body p-24px">
          <div>
            <pre class="bg-primary color-text-primary">{{ JSON.stringify(transaction.raw, null, 2) }}</pre>
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
const transaction = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const txHash = computed(() => {
  if (!currentTabUrl || !currentTabUrl.value) return null;
  const match = currentTabUrl.value.match(/\/explorer\/tx\/([A-F0-9]+)/i);
  return match ? match[1] : null;
});

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/block/${height}`);
  }
}

async function copyToClipboard(text: string) {
  await copyToClipboardShared(text);
}

function formatNumber(num: number | string): string {
  if (!num) return '0';
  return Number(num).toLocaleString();
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function loadTransactionData() {
  if (!txHash.value) {
    error.value = 'No transaction hash provided';
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = '';

    const upperHash = txHash.value.toUpperCase();
    
    const response = await lumen.net.rpcGet(`/tx?hash=0x${upperHash}`);
    
    if (!response.ok) {
      if (response.json && response.json.error) {
        const rpcError = response.json.error;
        if (rpcError.data && rpcError.data.includes('not found')) {
          throw new Error(`Transaction not found: ${txHash.value}\n\nThis transaction may not exist on the blockchain or hasn't been indexed yet.`);
        }
        throw new Error(`RPC Error: ${rpcError.message || 'Unknown error'}`);
      }
      const errorDetails = response.json ? JSON.stringify(response.json, null, 2) : response.statusText || 'Unknown error';
      throw new Error(`Failed to fetch transaction (Status ${response.status}): ${errorDetails}`);
    }

    const data = response.json;
    
    if (data.error) {
      if (data.error.data && data.error.data.includes('not found')) {
        throw new Error(`Transaction not found: ${txHash.value}\n\nThis transaction may not exist on the blockchain or hasn't been indexed yet.`);
      }
      throw new Error(`RPC Error: ${data.error.message || 'Unknown error'}`);
    }
    
    if (!data.result) {
      throw new Error('Transaction not found');
    }

    const txResult = data.result;
    const txData = txResult.tx_result;
    const tx = txResult.tx;

    transaction.value = {
      hash: txHash.value,
      height: txResult.height,
      time: formatTime(txResult.time || new Date().toISOString()),
      success: txData.code === 0,
      gasUsed: txData.gas_used || 0,
      gasWanted: txData.gas_wanted || 0,
      fee: parseFee(tx),
      messages: parseMessages(tx),
      events: txData.events || [],
      raw: txResult
    };

    loading.value = false;
  } catch (err: any) {
    error.value = err.message || 'Failed to load transaction data';
    loading.value = false;
    console.error('Error loading transaction:', err);
  }
}

function parseFee(tx: string): string {
  try {
    const decoded = atob(tx);
    return '0 LUMEN';
  } catch (err) {
    return 'N/A';
  }
}

function parseMessages(tx: string): any[] {
  try {
    return [];
  } catch (err) {
    return [];
  }
}

onMounted(() => {
  loadTransactionData();
});

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadTransactionData();
  }
);
</script>

