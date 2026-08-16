<template>
  <!-- ####### lumen://network/tx/<hash> TRANSACTION DETAIL (embedded sub-view of NetworkPage) ####### -->
  <div class="w-full h-full min-h-0 overflow-y-auto bg-primary color-text-primary p-32px">
    <UiLoadingState v-if="loading" :message="t('Loading transaction data…')" />

    <div v-else-if="pending" class="flex flex-column flex-align-justify-center gap-16px min-h-300px text-center">
      <Clock :size="32" class="color-warning" />
      <p class="color-text-primary text-16px txt-weight-medium m-0px">{{ t('Confirming transaction…') }}</p>
      <p class="color-text-secondary text-14px max-w-420px m-0px">{{ t('Your transaction was broadcast successfully and is waiting to be indexed. This usually takes just a few moments — check back shortly to see the details.') }}</p>
    </div>

    <UiErrorState v-else-if="error" :message="error" />

    <div v-else-if="transaction" class="flex flex-column gap-24px">
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Transaction overview')" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <UiDetailRow :label="t('Transaction hash')">
            <UiCopyField :value="transaction.hash" :title="t('Copy hash')" code-class="bg-secondary color-text-primary flex-1 py-8px px-12px border-1 border-radius-6px mono text-12px break-all" />
          </UiDetailRow>
          <UiDetailRow :label="t('Status')">
            <span class="color-text-primary text-14px break-all">
              <TxStatusPill :success="transaction.success" />

            </span>
          </UiDetailRow>
          <UiDetailRow :label="t('Block height')">
            <BlockHeightLink :height="transaction.height" size-class="text-14px" @open="navigateToBlock(transaction.height)" />
          </UiDetailRow>
          <UiDetailRow :label="t('Time')" :value="transaction.time" />
          <UiDetailRow :label="t('Gas used')" :value="formatNumber(transaction.gasUsed)" />
          <UiDetailRow :label="t('Gas wanted')" :value="formatNumber(transaction.gasWanted)" />
          <UiDetailRow :label="t('Fee')" :value="transaction.fee" />
        </div>
      </UiCard>

      <UiCard v-if="transaction.messages && transaction.messages.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Messages ({count})', { count: transaction.messages.length })" title-class="text-16px letter-spacing-0025em txt-weight-light" />
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

      <UiCard v-if="transaction.events && transaction.events.length > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Events ({count})', { count: transaction.events.length })" title-class="text-16px letter-spacing-0025em txt-weight-light" />
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

      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Raw transaction data')" title-class="text-16px letter-spacing-0025em txt-weight-light" />
        <div class="p-24px">
          <pre class="bg-primary color-text-primary p-16px m-0px word-wrap-break border-1 border-radius-6px mono text-12px pre-wrap overflow-x-auto">{{ JSON.stringify(transaction.raw, null, 2) }}</pre>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../../stores/i18nStore';
import UiCard from '../../ui/UiCard.vue';
import UiDetailRow from '../../ui/UiDetailRow.vue';
import UiLoadingState from '../../ui/UiLoadingState.vue';
import UiCopyField from '../../ui/UiCopyField.vue';
import UiErrorState from '../../ui/UiErrorState.vue';
import UiCardHeader from '../../ui/UiCardHeader.vue';
import { Clock } from 'lucide-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import { useTabLoadingSync } from '../../composables/useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { formatDateTime, formatDenom, formatNumber as formatNumberValue } from '../services/format';
import { explorerBlockUrl } from '../services/explorerLinks';
import { loadCosmosChains } from '../services/cosmosDirectory';
import { fetchAbsoluteJson } from '../services/httpJson';

import { errorMessage } from '../services/coerce';
import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
import TxStatusPill from '../../entities/TxStatusPill.vue';
import BlockHeightLink from '../../entities/BlockHeightLink.vue';

const loading = ref(true);
const error = ref('');
const pending = ref(false);
const transaction = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const { currentTabUrl, currentTabRefresh } = useTabState();


const { openInNewTab } = useTabNavigation();
/**
 * Two shapes reach this page, and they resolve against different chains.
 *
 * `lumen://network/tx/<hash>` is the network explorer's own view and always
 * means the home chain, read through the peer pool. `lumen://tx/<chain>/<hash>`
 * names a chain from the registry, and is what the wallet's history links to -
 * a Cosmos hash cannot be looked up on the home chain's nodes, so the chain
 * segment is what decides which endpoints are asked.
 */
const txRoute = computed<{ chain: string; hash: string }>(() => {
  const url = currentTabUrl?.value || '';
  const scoped = url.match(/\/tx\/([a-z0-9._-]+)\/([A-F0-9]+)/i);
  if (scoped) return { chain: scoped[1], hash: scoped[2] };

  const home = url.match(/\/network\/tx\/([A-F0-9]+)/i);
  return { chain: '', hash: home ? home[1] : '' };
});

const txHash = computed(() => txRoute.value.hash || null);

/** Empty, or 'lumen', means the home chain and its own richer read path. */
const remoteChainName = computed(() => {
  const name = txRoute.value.chain;
  return name && name !== 'lumen' ? name : '';
});

function navigateToBlock(height: number) {
  openInNewTab?.(explorerBlockUrl(height));
}

function formatNumber(num: number | string): string {
  return formatNumberValue(num, { empty: '0' });
}

function formatTime(timestamp: string): string {
  return formatDateTime(timestamp, { intl: { second: '2-digit' } });
}

async function loadTransactionData() {
  if (!txHash.value) {
    error.value = t('No transaction hash provided');
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = '';
    pending.value = false;

    const upperHash = txHash.value.toUpperCase();

    if (remoteChainName.value) {
      await loadFromRegistryChain(remoteChainName.value, upperHash);
      return;
    }

    // Surfaced through the catch below rather than optional-chained: there is
    // no transaction to render without the bridge.
    if (!lumen) throw new Error(t('Lumen API not available.'));

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
          throw new Error(t('Transaction not found: {hash}\n\nThis transaction may not exist on the blockchain or has not been indexed yet.', { hash: txHash.value }));
        }
        throw new Error(t('RPC error: {reason}', { reason: errorMessage(rpcError, t('Unknown error')) }));
      }
      const errorDetails = response.json ? JSON.stringify(response.json, null, 2) : response.statusText || t('Unknown error');
      throw new Error(t('Failed to fetch transaction (status {status}): {reason}', { status: response.status, reason: errorDetails }));
    }

    const data = response.json;

    if (data.error) {
      if (data.error.data && data.error.data.includes('transaction indexing is disabled')) {
        pending.value = true;
        loading.value = false;
        return;
      }
      if (data.error.data && data.error.data.includes('not found')) {
        throw new Error(t('Transaction not found: {hash}\n\nThis transaction may not exist on the blockchain or has not been indexed yet.', { hash: txHash.value }));
      }
      throw new Error(t('RPC error: {reason}', { reason: data.errorMessage(error, t('Unknown error')) }));
    }

    if (!data.result) {
      throw new Error(t('Transaction not found'));
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
  } catch (err) {
    error.value = errorMessage(err, t('Failed to load transaction data'));
    loading.value = false;
    console.error('Error loading transaction:', err);
  }
}


function formatFeeAmount(coins: any): string {
  if (!Array.isArray(coins) || !coins.length) return t('0 LMN');
  return coins.map((c) => `${Number(c.amount) / 1e6} ${formatDenom(c.denom)}`).join(', ');
}

/**
 * A transaction on a chain from the registry, read from that chain's REST.
 *
 * One request rather than the home chain's two: the REST tx endpoint already
 * carries the result, the gas and the events, where the home path asks RPC
 * first because it can also answer for a transaction that is not yet indexed.
 * The fee is divided by the chain's own exponent - dividing by 1e6 the way the
 * home path does would misstate it on every chain that is not six-decimal.
 */
async function loadFromRegistryChain(chainName: string, hash: string) {
  const chains = await loadCosmosChains();
  const chain = chains.find((entry) => entry.name === chainName);

  if (!chain) throw new Error(t('No chain named {chain} is in the registry.', { chain: chainName }));
  if (!chain.rest.length) {
    throw new Error(t('{chain} does not publish a REST endpoint.', { chain: chain.prettyName }));
  }

  let response: any = null;
  for (const endpoint of chain.rest) {
    try {
      response = await fetchAbsoluteJson(`${endpoint}/cosmos/tx/v1beta1/txs/${hash}`, 12000);
      if (response?.tx_response) break;
    } catch {
      // Next endpoint; only the last failure is worth reporting.
    }
  }

  const txResponse = response?.tx_response;
  if (!txResponse) {
    throw new Error(
      t('Transaction not found: {hash}\n\nThis transaction may not exist on the blockchain or has not been indexed yet.', {
        hash
      })
    );
  }

  const feeCoins = txResponse.tx?.auth_info?.fee?.amount;
  const fee = Array.isArray(feeCoins) && feeCoins.length
    ? feeCoins
        .map((coin: any) => {
          const scale = coin?.denom === chain.denom ? chain.decimals : 0;
          const value = Number(coin?.amount || 0) / 10 ** scale;
          return `${value} ${coin?.denom === chain.denom ? chain.symbol : formatDenom(coin?.denom)}`;
        })
        .join(', ')
    : t('None');

  transaction.value = {
    hash,
    height: txResponse.height,
    time: formatTime(txResponse.timestamp || new Date().toISOString()),
    success: Number(txResponse.code || 0) === 0,
    gasUsed: txResponse.gas_used || 0,
    gasWanted: txResponse.gas_wanted || 0,
    fee,
    messages: Array.isArray(txResponse.tx?.body?.messages)
      ? txResponse.tx.body.messages.map((m: any) => ({ type: m?.['@type'] || 'Unknown', value: m }))
      : [],
    events: txResponse.events || [],
    raw: txResponse
  };

  loading.value = false;
}

async function fetchTxRestData(hash: string): Promise<{ fee: string; messages: any[] }> {
  if (!lumen) return { fee: 'N/A', messages: [] };
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

