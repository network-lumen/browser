<template>
  <!-- ####### lumen://network/block/<height> BLOCK DETAIL (embedded sub-view of NetworkPage) ####### -->
  <div class="w-full h-full overflow-y-auto bg-primary">
    <UiLoadingState v-if="loading" :message="t('Loading block data...')" wrapper-class="py-64px px-32px" />

    <UiErrorState v-else-if="error" :message="error" wrapper-class="py-64px px-32px" message-class="" />

    <div v-else-if="block" class="flex flex-column gap-24px bg-secondary p-32px min-h-100vh-200px">
      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Block Overview')" bg-class="bg-primary" padding-class="py-20px px-24px" title-class="text-18px letter-spacing-n001 txt-weight-medium" />
        <div class="p-24px">
          <UiDetailRow variant="flex" :label="t('Height:')" :value="block.height" />
          <UiDetailRow variant="flex" :label="t('Hash:')">
            <UiCopyField :value="block.hash" :title="t('Copy hash')" wrapper-class="flex-1 gap-12px" code-class="flex-1 py-8px px-12px border-1 border-radius-6px text-13px mono break-all" />
          </UiDetailRow>
          <UiDetailRow variant="flex" :label="t('Proposer:')">
            <div class="flex-align-center gap-12px">
              <div class="flex-align-justify-center color-white size-32px border-radius-circle txt-weight-medium text-14px overflow-hidden min-w-32px" :style="{ background: block.proposerAvatar ? 'transparent' : getProposerColor(block.proposer) }">
                <img class="w-full h-full object-fit-cover"
                  v-if="block.proposerAvatar"
                  :src="block.proposerAvatar"
                  :alt="block.proposer"
                  @error="handleImageError"
                />
                <span v-else>{{ block.proposer.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="color-text-primary text-15px txt-weight-light">{{ block.proposer }}</span>
            </div>
          </UiDetailRow>
          <UiDetailRow variant="flex" :label="t('Time:')" :value="block.time" />
          <UiDetailRow variant="flex" :label="t('Transactions:')" :value="block.txs" />
        </div>
      </UiCard>

      <UiCard padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="t('Block Data')" bg-class="bg-primary" padding-class="py-20px px-24px" title-class="text-18px letter-spacing-n001 txt-weight-medium" />
        <div class="p-24px">
          <UiDetailRow variant="flex" :label="t('Chain ID:')" :value="block.chainId || 'lumen'" />
          <UiDetailRow variant="flex" :label="t('Block Size:')">
            <span class="color-text-primary flex-1 fw-500 text-15px">{{ calculateBlockSize(block) }} KB</span>
          </UiDetailRow>
          <UiDetailRow variant="flex" :label="t('Gas Used:')" :value="formatNumber(block.gasUsed || 0)" />
          <UiDetailRow variant="flex" :label="t('Gas Limit:')" :value="formatNumber(block.gasLimit || 0)" />
        </div>
      </UiCard>

      <UiCard v-if="block.txs > 0" padding="none" class="overflow-hidden shadow-sm hover-shadow-md" bg-class="bg-primary" border-class="border-1" radius="12px" :shadow="false">
        <UiCardHeader :title="`Transactions (${block.txs})`" bg-class="bg-primary" padding-class="py-20px px-24px" title-class="text-18px letter-spacing-n001 txt-weight-medium" />
        <div class="p-24px">
          <div class="flex flex-column gap-16px">
            <UiCard padding="none" :shadow="false" radius="md" v-for="(tx, index) in blockTransactions" :key="index" @click="navigateToTransaction(tx.hash)" class="flex gap-16px cursor-pointer flex-align-start py-16px px-20px shadow-xs transition-smooth-all hover-border-accent hover-lift-1 hover-shadow-primary">
              <div class="flex-align-justify-center size-32px border-radius-12px color-primary min-w-32px bg-gradient-secondary">
                <Activity :size="16" />
              </div>
              <div class="flex-1 min-w-0">
                <UiCopyField :value="tx.hash" :title="t('Copy hash')" wrapper-class="gap-8px mb-8px" code-class="flex-1 border-radius-10px py-8px px-10px bg-card border-default text-12px mono break-all" :icon-size="12" />
                <div class="flex-align-center gap-16px text-13px">
                  <TxTypeBadge :type="tx.type" />
                  <span class="flex-align-center gap-4px color-success txt-weight-light bg-fill-success border-radius-4px py-4px px-6px">{{ t('✓ Success') }}</span>
                </div>
              </div>
            </UiCard>
          </div>
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
import { Activity } from 'lucide-vue-next';
import { ref, onMounted, computed, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { computeTxHash } from '../chainRpc';
import { formatNumber } from '../services/format';
import { fetchKeybaseAvatarUrl } from '../services/keybase';
import type { ProposerInfo } from '../../types/networkPage';
import { explorerTransactionUrl, openExplorerUrl } from '../services/explorerLinks';

import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
import TxTypeBadge from '../../entities/TxTypeBadge.vue';
const loading = ref(true);
const error = ref('');
const block = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const proposerMap = ref<Record<string, ProposerInfo>>({});
const avatarCache = ref<Record<string, string>>({});

const { currentTabUrl, currentTabRefresh } = useTabState();


const { openInNewTab } = useTabNavigation();
const blockHeight = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  let match = url.match(/network\/block\/(\d+)/);
  if (!match) {
    match = url.match(/\/block\/(\d+)/);
  }
  if (!match) {
    match = url.match(/block(\d+)/);
  }
  return match ? match[1] : null;
});

const blockTransactions = computed(() => {
  if (!block.value || !block.value.txHashes || block.value.txHashes.length === 0) return [];
  return block.value.txHashes.map((hash: string) => ({
    hash: hash,
    type: 'Transfer',
    status: 'success'
  }));
});

function getProposerColor(proposer: string): string {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    t('linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'),
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    t('linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'),
    t('linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'),
    t('linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'),
    t('linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)')
  ];
  let hash = 0;
  for (let i = 0; i < proposer.length; i++) {
    hash = proposer.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function handleImageError() {
  // Broken avatar URL - fall back to the colored-initial avatar (the `v-else` sibling).
  if (block.value) block.value.proposerAvatar = null;
}

function calculateBlockSize(block: any): string {
  return ((block.txBytesTotal || 0) / 1024).toFixed(2);
}

function navigateToTransaction(hash: string) {
  openExplorerUrl(explorerTransactionUrl(hash), openInNewTab);
}

async function loadBlockData() {
  loading.value = true;
  error.value = '';

  const height = blockHeight.value;

  if (!height) {
    error.value = t('No block height specified');
    loading.value = false;
    return;
  }
  
  if (!lumen?.net?.rpcGet) {
    error.value = t('HTTP service not available');
    loading.value = false;
    return;
  }
  
  try {
    await buildProposerMap();
    
    const response = await lumen.net.rpcGet(`/block?height=${height}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch block: ${response.error || t('Unknown error')}`);
    }
    
    const data = response.json;

    if (!data?.result?.block) {
      throw new Error(t('Invalid block data received'));
    }

    const blockData = data.result.block;
    const blockId = data.result.block_id;
    const header = blockData.header;
    const proposerAddr = header.proposer_address;

    const proposerInfo = proposerMap.value[proposerAddr];

    const rawTxs: string[] = blockData.data?.txs || [];
    const txHashes = await Promise.all(rawTxs.map((raw) => computeTxHash(raw)));
    const txBytesTotal = rawTxs.reduce((sum, raw) => {
      try {
        return sum + atob(raw).length;
      } catch {
        return sum;
      }
    }, 0);

    block.value = {
      height: height,
      hash: blockId?.hash || header.app_hash || 'N/A',
      proposer: proposerInfo?.moniker || proposerAddr.substring(0, 8),
      proposerAvatar: proposerInfo?.avatar || null,
      time: new Date(header.time).toLocaleString(),
      txs: rawTxs.length,
      txHashes,
      txBytesTotal,
      gasUsed: 0,
      gasLimit: parseInt(header.max_gas) || 0,
      chainId: header.chain_id || 'lumen'
    };
  } catch (err) {
    console.error('Error loading block:', err);
    error.value = `Failed to load block data: ${err instanceof Error ? err.message : t('Unknown error')}`;
  } finally {
    loading.value = false;
  }
}

async function buildProposerMap() {
  if (!lumen) return;
  try {
    const valSetRes = await lumen.net.rpcGet('/validators');
    if (!valSetRes.ok || !valSetRes.json?.result?.validators) return;
    
    const valSet = valSetRes.json.result.validators;
    
    for (const val of valSet) {
      proposerMap.value[val.address] = {
        moniker: val.address.substring(0, 8),
        avatar: undefined,
        keybaseId: undefined
      };
    }
    
    const res = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
    );
    
    if (!res.ok || !res.json?.validators) return;
    
    const validatorsList = res.json.validators;
    
    const valSet2Res = await lumen.net.rpcGet('/validators');
    const validatorSet = valSet2Res.ok && valSet2Res.json?.result?.validators 
      ? valSet2Res.json.result.validators 
      : [];
    
    for (const v of validatorsList) {
      const keybaseId = v.description?.identity || null;
      
      const matchingVal = validatorSet.find((vs: any) => {
        return vs.pub_key?.value && v.consensus_pubkey?.key === vs.pub_key.value;
      });
      
      if (matchingVal) {
        proposerMap.value[matchingVal.address] = {
          moniker: v.description?.moniker || 'Unknown',
          avatar: avatarCache.value[keybaseId] || undefined,
          keybaseId: keybaseId
        };
      }
    }
    
    await fetchKeybaseAvatars();
  } catch (err) {
    console.error('Error building proposer map:', err);
  }
}

async function fetchKeybaseAvatars() {
  const validatorsWithKeybase = Object.values(proposerMap.value).filter(
    v => v.keybaseId && !avatarCache.value[v.keybaseId]
  );
  
  if (validatorsWithKeybase.length === 0) return;
  
  for (const validator of validatorsWithKeybase) {
    if (!validator.keybaseId) continue;

    const avatarUrl = await fetchKeybaseAvatarUrl(validator.keybaseId);
    if (!avatarUrl) continue;

    avatarCache.value[validator.keybaseId] = avatarUrl;
    for (const key in proposerMap.value) {
      if (proposerMap.value[key].keybaseId === validator.keybaseId) {
        proposerMap.value[key].avatar = avatarUrl;
      }
    }
  }
}

onMounted(() => {
  loadBlockData();
});

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    loadBlockData();
  }
);
</script>

