<template>
  <!-- ####### lumen://network/tx/<hash> TRANSACTION DETAIL (embedded sub-view of NetworkPage) ####### -->
  <div class="w-full h-full min-h-0 overflow-y-auto bg-primary color-text-primary p-32px">
    <UiLoadingState v-if="loading" message="Loading transaction data..." />

    <div v-else-if="pending" class="flex flex-column flex-align-justify-center gap-16px min-h-300px text-center">
      <Clock :size="32" class="color-warning" />
      <p class="color-text-primary text-16px txt-weight-medium m-0px">Confirming transaction…</p>
      <p class="color-text-secondary text-14px max-w-420px m-0px">Your transaction was broadcast successfully and is waiting to be indexed. This usually takes just a few moments — check back shortly to see the details.</p>
    </div>

    <UiErrorState v-else-if="error" :message="error" />

    <div v-else-if="transaction" class="flex flex-column gap-24px">
      <!-- Transaction Overview Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader title="Transaction Overview" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <UiDetailRow label="Transaction Hash:">
            <UiCopyField :value="transaction.hash" title="Copy hash" code-class="bg-secondary color-text-primary flex-1 py-8px px-12px border-1 border-radius-6px mono text-12px break-all" />
          </UiDetailRow>
          <UiDetailRow label="Status:">
            <span class="color-text-primary text-14px break-all">
              <span class="py-4px px-12px border-radius-full text-12px" :class="transaction.success ? 'bg-fill-success' : 'bg-fill-error'">
                {{ transaction.success ? '✓ Success' : '✗ Failed' }}
              </span>
            </span>
          </UiDetailRow>
          <UiDetailRow label="Block Height:">
            <span class="underline cursor-pointer color-primary text-14px break-all hover-color-accent-secondary" @click="navigateToBlock(transaction.height)">
              {{ transaction.height }}
            </span>
          </UiDetailRow>
          <UiDetailRow label="Time:" :value="transaction.time" />
          <UiDetailRow label="Gas Used:" :value="formatNumber(transaction.gasUsed)" />
          <UiDetailRow label="Gas Wanted:" :value="formatNumber(transaction.gasWanted)" />
          <UiDetailRow label="Fee:" :value="transaction.fee" />
        </div>
      </UiCard>

      <!-- Messages Card -->
      <UiCard v-if="transaction.messages && transaction.messages.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="`Messages (${transaction.messages.length})`" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(msg, index) in transaction.messages" :key="index">
              <div class="flex-align-center flex-justify-space-between mb-12px">
                <span class="color-text-primary txt-weight-light text-14px">{{ msg.type }}</span>
                <span class="color-text-tertiary text-12px">#{{ Number(index) + 1 }}</span>
              </div>
              <pre class="bg-primary color-text-primary p-16px m-0px word-wrap-break border-1 border-radius-6px mono text-12px pre-wrap overflow-x-auto">{{ JSON.stringify(msg.value, null, 2) }}</pre>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Events Card -->
      <UiCard v-if="transaction.events && transaction.events.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="`Events (${transaction.events.length})`" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard bg-class="bg-secondary" border-class="border-1" radius="8px" :shadow="false" v-for="(event, index) in transaction.events" :key="index">
              <div class="color-text-primary txt-weight-light text-14px">{{ event.type }}</div>
              <div class="flex flex-column gap-8px mt-12px">
                <div class="flex gap-8px text-12px" v-for="(attr, attrIndex) in event.attributes" :key="attrIndex">
                  <span class="color-text-secondary txt-weight-light min-w-120px">{{ attr.key }}:</span>
                  <span class="color-text-primary break-all">{{ attr.value }}</span>
                </div>
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <!-- Raw Data Card -->
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader title="Raw Transaction Data" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <pre class="bg-primary color-text-primary p-16px m-0px word-wrap-break border-1 border-radius-6px mono text-12px pre-wrap overflow-x-auto">{{ JSON.stringify(transaction.raw, null, 2) }}</pre>
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
import UiCardHeader from '../../ui/UiCardHeader.vue';
import { Clock } from 'lucide-vue-next';
import { ref, onMounted, computed, inject, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { formatDateTime, formatDenom, formatNumber as formatNumberValue } from '../services/format';

const loading = ref(true);
const error = ref('');
const pending = ref(false);
const transaction = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const txHash = computed(() => {
  if (!currentTabUrl || !currentTabUrl.value) return null;
  const match = currentTabUrl.value.match(/\/network\/tx\/([A-F0-9]+)/i);
  return match ? match[1] : null;
});

function navigateToBlock(height: number) {
  if (openInNewTab) {
    openInNewTab(`lumen://network/block/${height}`);
  }
}

function formatNumber(num: number | string): string {
  return formatNumberValue(num, { empty: '0' });
}

function formatTime(timestamp: string): string {
  return formatDateTime(timestamp, { intl: { second: '2-digit' } });
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
    pending.value = false;

    const upperHash = txHash.value.toUpperCase();

    const response = await lumen.net.rpcGet(`/tx?hash=0x${upperHash}`);

    if (!response.ok) {
      if (response.json && response.json.error) {
        const rpcError = response.json.error;
        if (rpcError.data && rpcError.data.includes('transaction indexing is disabled')) {
          pending.value = true;
          loading.value = false;
          return;
        }
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
      if (data.error.data && data.error.data.includes('transaction indexing is disabled')) {
        pending.value = true;
        loading.value = false;
        return;
      }
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

    const { fee, messages } = await fetchTxRestData(upperHash);

    transaction.value = {
      hash: txHash.value,
      height: txResult.height,
      time: formatTime(txResult.time || new Date().toISOString()),
      success: txData.code === 0,
      gasUsed: txData.gas_used || 0,
      gasWanted: txData.gas_wanted || 0,
      fee,
      messages,
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


function formatFeeAmount(coins: any): string {
  if (!Array.isArray(coins) || !coins.length) return '0 LMN';
  return coins.map((c) => `${Number(c.amount) / 1e6} ${formatDenom(c.denom)}`).join(', ');
}

async function fetchTxRestData(hash: string): Promise<{ fee: string; messages: any[] }> {
  try {
    const res = await lumen.net.restGet(`/cosmos/tx/v1beta1/txs/${hash}`);
    if (!res.ok) return { fee: 'N/A', messages: [] };
    const txResp = res.json?.tx_response;
    const fee = formatFeeAmount(txResp?.tx?.auth_info?.fee?.amount);
    const rawMessages = txResp?.tx?.body?.messages;
    const messages = Array.isArray(rawMessages)
      ? rawMessages.map((m: any) => ({ type: m?.['@type'] || 'Unknown', value: m }))
      : [];
    return { fee, messages };
  } catch {
    return { fee: 'N/A', messages: [] };
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

