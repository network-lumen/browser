<template>
  <div class="w-full h-full min-h-0 overflow-y-auto bg-tertiary color-text-primary padding-200">
    <div class="margin-bottom-200">
      <button class="chaindetail-back-btn flex-inline-align-center gap-50 padding-62-125 bg-gradient-primary color-white border-none cursor-pointer margin-bottom-100 border-radius-sm fw-500 fs-14px shadow-primary transition-smooth-all hover-lift-2" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </button>
      <h1 class="fs-28px txt-weight-light color-text-primary margin-0">Transaction Details</h1>
    </div>

    <div v-if="loading" class="chaindetail-loading flex flex-column flex-align-justify-center gap-100 min-h-300px">
      <div class="ring-spinner ring-spinner-lg"></div>
      <p>Loading transaction data...</p>
    </div>

    <div v-else-if="error" class="chaindetail-error flex flex-column flex-align-justify-center gap-100 min-h-300px">
      <p class="color-error chaindetail-error-p fs-16px">{{ error }}</p>
    </div>

    <div v-else-if="transaction" class="flex flex-column gap-150">
      <!-- Transaction Overview Card -->
      <div class="chaindetail-card bg-primary border-1 border-radius-12px overflow-hidden">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 padding-0 padding-top-100 padding-right-150 padding-bottom-100 padding-left-150">
          <h2 class="color-text-primary txt-weight-light margin-0 chaindetail-card-header-h2 fs-16px">Transaction Overview</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Transaction Hash:</span>
            <div class="chaindetail-hash-value flex-align-center gap-50">
              <code class="bg-secondary color-text-primary flex-1 chaindetail-hash-value-code padding-50-75 border-1 border-radius-6px mono fs-075rem break-all">{{ transaction.hash }}</code>
              <button class="chaindetail-copy-btn bg-secondary cursor-pointer flex-inline-align-justify-center border-1 border-radius-6px transition-all-02 padding-25 hover-bg-accent hover-border-accent" @click="copyToClipboard(transaction.hash)" title="Copy hash">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Status:</span>
            <span class="chaindetail-value color-text-primary fs-14px break-all">
              <span :class="['chaindetail-status-badge', transaction.success ? 'badge-success' : 'badge-error']">
                {{ transaction.success ? '✓ Success' : '✗ Failed' }}
              </span>
            </span>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Block Height:</span>
            <span class="chaindetail-value chaindetail-value-clickable cursor-pointer color-primary fs-14px break-all hover-color-accent-secondary" @click="navigateToBlock(transaction.height)">
              {{ transaction.height }}
            </span>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Time:</span>
            <span class="chaindetail-value color-text-primary fs-14px break-all">{{ transaction.time }}</span>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Gas Used:</span>
            <span class="chaindetail-value color-text-primary fs-14px break-all">{{ formatNumber(transaction.gasUsed) }}</span>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Gas Wanted:</span>
            <span class="chaindetail-value color-text-primary fs-14px break-all">{{ formatNumber(transaction.gasWanted) }}</span>
          </div>
          <div class="chaindetail-row gap-100 grid border-bottom-1-light padding-87-0 border-radius-37-hover background-bg-hover-hover">
            <span class="chaindetail-label color-text-secondary fw-500 fs-14px">Fee:</span>
            <span class="chaindetail-value color-text-primary fs-14px break-all">{{ transaction.fee }}</span>
          </div>
        </div>
      </div>

      <!-- Messages Card -->
      <div class="chaindetail-card bg-primary border-1 border-radius-12px overflow-hidden" v-if="transaction.messages && transaction.messages.length > 0">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 padding-0 padding-top-100 padding-right-150 padding-bottom-100 padding-left-150">
          <h2 class="color-text-primary txt-weight-light margin-0 chaindetail-card-header-h2 fs-16px">Messages ({{ transaction.messages.length }})</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="flex flex-column gap-100">
            <div class="txdetail-item bg-secondary padding-100 border-1 border-radius-8px" v-for="(msg, index) in transaction.messages" :key="index">
              <div class="txdetail-item-header flex-align-center flex-justify-space-between margin-bottom-75">
                <span class="txdetail-item-type color-text-primary txt-weight-light fs-14px">{{ msg.type }}</span>
                <span class="txdetail-item-index color-text-tertiary fs-075rem">#{{ Number(index) + 1 }}</span>
              </div>
              <div class="txdetail-item-data">
                <pre class="bg-primary color-text-primary padding-100 margin-0 txdetail-item-data-pre border-1 border-radius-6px mono fs-075rem pre-wrap overflow-x-auto">{{ JSON.stringify(msg.value, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Card -->
      <div class="chaindetail-card bg-primary border-1 border-radius-12px overflow-hidden" v-if="transaction.events && transaction.events.length > 0">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 padding-0 padding-top-100 padding-right-150 padding-bottom-100 padding-left-150">
          <h2 class="color-text-primary txt-weight-light margin-0 chaindetail-card-header-h2 fs-16px">Events ({{ transaction.events.length }})</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="flex flex-column gap-100">
            <div class="txdetail-item bg-secondary padding-100 border-1 border-radius-8px" v-for="(event, index) in transaction.events" :key="index">
              <div class="txdetail-item-type color-text-primary txt-weight-light fs-14px">{{ event.type }}</div>
              <div class="txdetail-event-attributes flex flex-column gap-50 margin-top-75">
                <div class="flex gap-50 fs-12px" v-for="(attr, attrIndex) in event.attributes" :key="attrIndex">
                  <span class="txdetail-attr-key color-text-secondary txt-weight-light min-w-120px">{{ attr.key }}:</span>
                  <span class="color-text-primary break-all">{{ attr.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Raw Data Card -->
      <div class="chaindetail-card bg-primary border-1 border-radius-12px overflow-hidden">
        <div class="chaindetail-card-header bg-secondary border-bottom-1 padding-0 padding-top-100 padding-right-150 padding-bottom-100 padding-left-150">
          <h2 class="color-text-primary txt-weight-light margin-0 chaindetail-card-header-h2 fs-16px">Raw Transaction Data</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div>
            <pre class="bg-primary color-text-primary">{{ JSON.stringify(transaction.raw, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';

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

function goBack() {
  if (openInNewTab) {
    openInNewTab('lumen://explorer');
  } else {
    window.location.href = 'lumen://explorer';
  }
}

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/block/${height}`);
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard:', text);
  });
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

