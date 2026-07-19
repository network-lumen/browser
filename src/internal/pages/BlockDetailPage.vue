<template>
  <div class="w-full h-full overflow-y-auto bg-primary">
    <div class="blockdetail-header bg-primary border-bottom-1">
      <button class="blockdetail-back-btn flex-align-center gap-50 padding-62-125 bg-gradient-primary color-white border-none cursor-pointer margin-bottom-100 txt-weight-light border-radius-8px fs-14px transition-all-02" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </button>
      <h1 class="color-text-primary txt-weight-medium margin-0 blockdetail-header-h1 fs-175rem letter-spacing-n002">Block Details</h1>
    </div>

    <div v-if="loading" class="blockdetail-loading flex flex-column flex-align-justify-center gap-100 padding-400-200">
      <div class="ring-spinner ring-spinner-lg"></div>
      <p>Loading block data...</p>
    </div>

    <div v-else-if="error" class="blockdetail-error flex flex-column flex-align-justify-center gap-100 padding-400-200">
      <p class="color-error">{{ error }}</p>
    </div>

    <div v-else-if="block" class="blockdetail-content flex flex-column gap-150 bg-secondary padding-200">
      <!-- Block Overview Card -->
      <div class="blockdetail-card bg-primary border-radius-12px border-1 overflow-hidden">
        <div class="blockdetail-card-header bg-primary padding-125-150 border-bottom-1">
          <h2 class="color-text-primary txt-weight-medium margin-0 blockdetail-card-header-h2 fs-18px letter-spacing-n001">Block Overview</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Height:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ block.height }}</span>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Hash:</span>
            <div class="blockdetail-hash-value flex-1 flex-align-center gap-75">
              <code class="flex-1 blockdetail-hash-value-code padding-50-75 border-1 border-radius-6px fs-13px mono break-all">{{ block.hash }}</code>
              <button class="blockdetail-copy-btn bg-primary color-text-secondary cursor-pointer flex-align-justify-center border-1 border-radius-6px transition-all-02 flex-shrink-0 padding-25" @click="copyToClipboard(block.hash)" title="Copy hash">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Proposer:</span>
            <div class="flex-align-center gap-75">
              <div class="blockdetail-proposer-avatar flex-align-justify-center color-white size-32px border-radius-circle txt-weight-medium fs-14px overflow-hidden min-w-32px" :style="{ background: block.proposerAvatar ? 'transparent' : getProposerColor(block.proposer) }">
                <img class="blockdetail-proposer-avatar-img w-full h-full object-fit-cover"
                  v-if="block.proposerAvatar"
                  :src="block.proposerAvatar"
                  :alt="block.proposer"
                />
                <span v-else>{{ block.proposer.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="color-text-primary fs-15px fw-600">{{ block.proposer }}</span>
            </div>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Time:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ block.time }}</span>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Transactions:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ block.txs }}</span>
          </div>
        </div>
      </div>

      <!-- Block Data Card -->
      <div class="blockdetail-card bg-primary border-radius-12px border-1 overflow-hidden">
        <div class="blockdetail-card-header bg-primary padding-125-150 border-bottom-1">
          <h2 class="color-text-primary txt-weight-medium margin-0 blockdetail-card-header-h2 fs-18px letter-spacing-n001">Block Data</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Chain ID:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ block.chainId || 'lumen-mainnet' }}</span>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Block Size:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ calculateBlockSize(block) }} KB</span>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Gas Used:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ formatNumber(block.gasUsed || 0) }}</span>
          </div>
          <div class="blockdetail-row flex-align-center border-bottom-1-light transition-bg-02">
            <span class="blockdetail-label color-text-secondary txt-weight-light fs-14px">Gas Limit:</span>
            <span class="blockdetail-value color-text-primary flex-1 fw-500 fs-15px">{{ formatNumber(block.gasLimit || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- Transactions Card -->
      <div class="blockdetail-card bg-primary border-radius-12px border-1 overflow-hidden" v-if="block.txs > 0">
        <div class="blockdetail-card-header bg-primary padding-125-150 border-bottom-1">
          <h2 class="color-text-primary txt-weight-medium margin-0 blockdetail-card-header-h2 fs-18px letter-spacing-n001">Transactions ({{ block.txs }})</h2>
        </div>
        <div class="chaindetail-card-body padding-150">
          <div class="flex flex-column gap-100">
            <div class="blockdetail-tx-item flex gap-100 cursor-pointer border-radius-md flex-align-start padding-100-125 bg-card border-default shadow-xs transition-smooth-all" v-for="(tx, index) in blockTransactions" :key="index" @click="navigateToTransaction(tx.hash)">
              <div class="blockdetail-tx-icon flex-align-justify-center size-32px border-radius-md color-ios-blue min-w-32px">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="blockdetail-tx-hash flex-align-center gap-50 margin-bottom-50">
                  <code class="flex-1 border-radius-sm blockdetail-tx-hash-code padding-50-62 bg-card border-default fs-075rem mono break-all">{{ tx.hash }}</code>
                  <button class="blockdetail-copy-btn bg-primary color-text-secondary cursor-pointer flex-align-justify-center border-1 border-radius-6px transition-all-02 flex-shrink-0 padding-25" @click.stop="copyToClipboard(tx.hash)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <div class="flex-align-center gap-100 fs-13px">
                  <span class="color-text-secondary fw-500">{{ tx.type }}</span>
                  <span class="blockdetail-tx-status-success flex-align-center gap-25 color-success txt-weight-light bg-fill-success border-radius-4px">✓ Success</span>
                </div>
              </div>
            </div>
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
const block = ref<any>(null);

useTabLoadingSync(loading);

const lumen = useInternalLumen();

const proposerMap = ref<Record<string, { moniker: string; avatar?: string; keybaseId?: string }>>({});
const avatarCache = ref<Record<string, string>>({});

const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const blockHeight = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  console.log('BlockDetailPage URL:', url);
  let match = url.match(/explorer\/block\/(\d+)/);
  if (!match) {
    match = url.match(/\/block\/(\d+)/);
  }
  if (!match) {
    match = url.match(/block(\d+)/);
  }
  const height = match ? match[1] : null;
  console.log('Extracted block height:', height);
  return height;
});

const blockTransactions = computed(() => {
  if (!block.value || !block.value.txHashes || block.value.txHashes.length === 0) return [];
  return block.value.txHashes.map((hash: string) => ({
    hash: hash,
    type: 'Transfer',
    status: 'success'
  }));
});

function generateMockHash(): string {
  return Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16).toUpperCase()
  ).join('');
}

function getProposerColor(proposer: string): string {
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)'
  ];
  let hash = 0;
  for (let i = 0; i < proposer.length; i++) {
    hash = proposer.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.style.display = 'none';
}

function calculateBlockSize(block: any): string {
  const size = (block.hash.length + (block.txs * 500)) / 1024;
  return size.toFixed(2);
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function goBack() {
  if (openInNewTab) {
    openInNewTab('lumen://explorer');
  } else {
    window.location.href = 'lumen://explorer';
  }
}

function navigateToTransaction(hash: string) {
  if (openInNewTab) {
    openInNewTab(`lumen://explorer/tx/${hash}`);
  } else {
    window.location.href = `lumen://explorer/tx/${hash}`;
  }
}

async function loadBlockData() {
  loading.value = true;
  error.value = '';
  
  const height = blockHeight.value;
  console.log('Loading block data for height:', height);
  
  if (!height) {
    error.value = 'No block height specified';
    loading.value = false;
    return;
  }
  
  if (!lumen?.net?.rpcGet) {
    error.value = 'HTTP service not available';
    loading.value = false;
    return;
  }
  
  try {
    await buildProposerMap();
    
    const response = await lumen.net.rpcGet(`/block?height=${height}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch block: ${response.error || 'Unknown error'}`);
    }
    
    const data = response.json;
    console.log('Block data:', data);
    
    if (!data?.result?.block) {
      throw new Error('Invalid block data received');
    }
    
    const blockData = data.result.block;
    const blockId = data.result.block_id;
    const header = blockData.header;
    const proposerAddr = header.proposer_address;
    
    const proposerInfo = proposerMap.value[proposerAddr];
    
    block.value = {
      height: height,
      hash: blockId?.hash || header.app_hash || 'N/A',
      proposer: proposerInfo?.moniker || proposerAddr.substring(0, 8),
      proposerAvatar: proposerInfo?.avatar || null,
      time: new Date(header.time).toLocaleString(),
      txs: blockData.data?.txs?.length || 0,
      txHashes: blockData.data?.txs || [],
      gasUsed: 0,
      gasLimit: parseInt(header.max_gas) || 0,
      chainId: header.chain_id || 'lumen-mainnet'
    };
    
    console.log('Formatted block:', block.value);
  } catch (err) {
    console.error('Error loading block:', err);
    error.value = `Failed to load block data: ${err instanceof Error ? err.message : 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
}

async function buildProposerMap() {
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
    
    console.log('Proposer map built:', proposerMap.value);
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
    
    try {
      const response = await fetch(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.keybaseId}`
      );
      const data = await response.json();
      
      if (data?.them?.[0]?.pictures?.primary?.url) {
        const avatarUrl = data.them[0].pictures.primary.url;
        avatarCache.value[validator.keybaseId] = avatarUrl;
        
        for (const key in proposerMap.value) {
          if (proposerMap.value[key].keybaseId === validator.keybaseId) {
            proposerMap.value[key].avatar = avatarUrl;
          }
        }
      }
    } catch (e) {
      console.log(`Failed to fetch avatar for ${validator.moniker}`);
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

