<template>
  <div class="block-detail-page">
    <div class="block-detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </button>
      <h1>Block Details</h1>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading block data...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="block" class="block-content">
      <!-- Block Overview Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Block Overview</h2>
        </div>
        <div class="card-body">
          <div class="detail-row">
            <span class="label">Height:</span>
            <span class="value">{{ block.height }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Hash:</span>
            <div class="hash-value">
              <code>{{ block.hash }}</code>
              <button class="copy-btn" @click="copyToClipboard(block.hash)" title="Copy hash">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="detail-row">
            <span class="label">Proposer:</span>
            <div class="proposer-info">
              <div class="proposer-avatar" :style="{ background: block.proposerAvatar ? 'transparent' : getProposerColor(block.proposer) }">
                <img 
                  v-if="block.proposerAvatar" 
                  :src="block.proposerAvatar" 
                  :alt="block.proposer"
                />
                <span v-else>{{ block.proposer.charAt(0).toUpperCase() }}</span>
              </div>
              <span class="proposer-name">{{ block.proposer }}</span>
            </div>
          </div>
          <div class="detail-row">
            <span class="label">Time:</span>
            <span class="value">{{ block.time }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Transactions:</span>
            <span class="value">{{ block.txs }}</span>
          </div>
        </div>
      </div>

      <!-- Block Data Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Block Data</h2>
        </div>
        <div class="card-body">
          <div class="detail-row">
            <span class="label">Chain ID:</span>
            <span class="value">{{ block.chainId || 'lumen-mainnet' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Block Size:</span>
            <span class="value">{{ calculateBlockSize(block) }} KB</span>
          </div>
          <div class="detail-row">
            <span class="label">Gas Used:</span>
            <span class="value">{{ formatNumber(block.gasUsed || 0) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Gas Limit:</span>
            <span class="value">{{ formatNumber(block.gasLimit || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- Transactions Card -->
      <div class="detail-card" v-if="block.txs > 0">
        <div class="card-header">
          <h2>Transactions ({{ block.txs }})</h2>
        </div>
        <div class="card-body">
          <div class="transactions-list">
            <div class="tx-item" v-for="(tx, index) in blockTransactions" :key="index" @click="navigateToTransaction(tx.hash)" style="cursor: pointer;">
              <div class="tx-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div class="tx-info">
                <div class="tx-hash">
                  <code>{{ tx.hash }}</code>
                  <button class="copy-btn-small" @click.stop="copyToClipboard(tx.hash)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <div class="tx-meta">
                  <span class="tx-type">{{ tx.type }}</span>
                  <span class="tx-status success">✓ Success</span>
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
import { ref, onMounted, computed, inject } from 'vue';

const loading = ref(true);
const error = ref('');
const block = ref<any>(null);
const rpcBase = ref('http://142.132.201.187:26657');
const restBase = ref('http://142.132.201.187:1317');

const lumen = (window as any).lumen;

const proposerMap = ref<Record<string, { moniker: string; avatar?: string; keybaseId?: string }>>({});
const avatarCache = ref<Record<string, string>>({});

const currentTabUrl = inject<any>('currentTabUrl', null);

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
  
  if (!lumen?.http?.get) {
    error.value = 'HTTP service not available';
    loading.value = false;
    return;
  }
  
  try {
    await buildProposerMap();
    
    const response = await lumen.http.get(`${rpcBase.value}/block?height=${height}`);
    
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
    const valSetRes = await lumen.http.get(`${rpcBase.value}/validators`);
    if (!valSetRes.ok || !valSetRes.json?.result?.validators) return;
    
    const valSet = valSetRes.json.result.validators;
    
    for (const val of valSet) {
      proposerMap.value[val.address] = {
        moniker: val.address.substring(0, 8),
        avatar: undefined,
        keybaseId: undefined
      };
    }
    
    const res = await lumen.http.get(
      `${restBase.value}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
    );
    
    if (!res.ok || !res.json?.validators) return;
    
    const validatorsList = res.json.validators;
    
    const valSet2Res = await lumen.http.get(`${rpcBase.value}/validators`);
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
</script>

<style scoped>
.block-detail-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary, #ffffff);
}

.block-detail-header {
  padding: 2rem 2rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px var(--primary-a20);
}

.back-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px var(--primary-a30);
}

.back-btn:active {
  transform: translateY(0);
}

.block-detail-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
  letter-spacing: -0.02em;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color, #e2e8f0);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container p {
  color: #ef4444;
  font-size: 1rem;
}

.block-content {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: var(--bg-secondary, #f8fafc);
  min-height: calc(100vh - 200px);
}

.detail-card {
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;
}

.detail-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

.card-header {
  padding: 1.25rem 1.5rem;
  background: var(--bg-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.card-header h2 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
  letter-spacing: -0.01em;
}

.card-body {
  padding: 1.5rem;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  transition: background 0.2s;
}

.detail-row:hover {
  background: var(--bg-secondary, #f8fafc);
  margin: 0 -1.5rem;
  padding: 1rem 1.5rem;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row .label {
  flex: 0 0 180px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.detail-row .value {
  flex: 1;
  font-size: 0.9375rem;
  color: var(--text-primary, #1e293b);
  font-weight: 500;
}

.hash-value {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hash-value code {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-family: 'Monaco', 'Menlo', monospace;
  color: var(--text-primary, #1e293b);
  word-break: break-all;
}

.copy-btn,
.copy-btn-small {
  padding: 0.375rem;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.copy-btn:hover,
.copy-btn-small:hover {
  background: var(--bg-secondary, #f8fafc);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.proposer-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.proposer-avatar {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
  overflow: hidden;
}

.proposer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.proposer-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tx-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.tx-item:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 2px 8px var(--primary-a15);
  transform: translateY(-1px);
}

.tx-icon {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  background: var(--primary-a10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.tx-info {
  flex: 1;
  min-width: 0;
}

.tx-hash {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tx-hash code {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: 'Monaco', 'Menlo', monospace;
  color: var(--text-primary, #1e293b);
  word-break: break-all;
}

.tx-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8125rem;
}

.tx-type {
  color: var(--text-secondary, #64748b);
  font-weight: 500;
}

.tx-status.success {
  color: #10b981;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
</style>
