<template>
  <div class="tx-detail-page">
    <div class="tx-detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </button>
      <h1>Transaction Details</h1>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading transaction data...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="transaction" class="tx-content">
      <!-- Transaction Overview Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Transaction Overview</h2>
        </div>
        <div class="card-body">
          <div class="detail-row">
            <span class="label">Transaction Hash:</span>
            <div class="hash-value">
              <code>{{ transaction.hash }}</code>
              <button class="copy-btn" @click="copyToClipboard(transaction.hash)" title="Copy hash">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="detail-row">
            <span class="label">Status:</span>
            <span class="value">
              <span :class="['status-badge', transaction.success ? 'success' : 'failed']">
                {{ transaction.success ? '✓ Success' : '✗ Failed' }}
              </span>
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Block Height:</span>
            <span class="value clickable" @click="navigateToBlock(transaction.height)">
              {{ transaction.height }}
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Time:</span>
            <span class="value">{{ transaction.time }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Gas Used:</span>
            <span class="value">{{ formatNumber(transaction.gasUsed) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Gas Wanted:</span>
            <span class="value">{{ formatNumber(transaction.gasWanted) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Fee:</span>
            <span class="value">{{ transaction.fee }}</span>
          </div>
        </div>
      </div>

      <!-- Messages Card -->
      <div class="detail-card" v-if="transaction.messages && transaction.messages.length > 0">
        <div class="card-header">
          <h2>Messages ({{ transaction.messages.length }})</h2>
        </div>
        <div class="card-body">
          <div class="messages-list">
            <div class="message-item" v-for="(msg, index) in transaction.messages" :key="index">
              <div class="message-header">
                <span class="message-type">{{ msg.type }}</span>
                <span class="message-index">#{{ Number(index) + 1 }}</span>
              </div>
              <div class="message-data">
                <pre>{{ JSON.stringify(msg.value, null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Card -->
      <div class="detail-card" v-if="transaction.events && transaction.events.length > 0">
        <div class="card-header">
          <h2>Events ({{ transaction.events.length }})</h2>
        </div>
        <div class="card-body">
          <div class="events-list">
            <div class="event-item" v-for="(event, index) in transaction.events" :key="index">
              <div class="event-type">{{ event.type }}</div>
              <div class="event-attributes">
                <div class="attribute-row" v-for="(attr, attrIndex) in event.attributes" :key="attrIndex">
                  <span class="attr-key">{{ attr.key }}:</span>
                  <span class="attr-value">{{ attr.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Raw Data Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Raw Transaction Data</h2>
        </div>
        <div class="card-body">
          <div class="raw-data">
            <pre>{{ JSON.stringify(transaction.raw, null, 2) }}</pre>
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
const transaction = ref<any>(null);
const rpcBase = ref('http://142.132.201.187:26657');

const lumen = (window as any).lumen;

const currentTabUrl = inject<any>('currentTabUrl', null);

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
    
    const response = await lumen.http.get(`${rpcBase.value}/tx?hash=0x${upperHash}`);
    
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
</script>

<style scoped>
.tx-detail-page {
  width: 100%;
  min-height: 100vh;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 2rem;
}

.tx-detail-header {
  margin-bottom: 2rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-smooth);
  margin-bottom: 1rem;
  box-shadow: var(--shadow-primary);
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.tx-detail-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container p {
  color: var(--ios-red);
  font-size: 1rem;
}

.tx-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.card-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.025em;
}

.card-body {
  padding: 1.5rem;
}

.detail-row {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 1rem;
  padding: 0.875rem 0;
  border-bottom: 1px solid var(--border-light);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row:hover {
  background: var(--bg-hover);
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  border-radius: 0.375rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.value {
  font-size: 0.875rem;
  color: var(--text-primary);
  word-break: break-all;
}

.value.clickable {
  color: var(--accent-primary);
  cursor: pointer;
  text-decoration: underline;
}

.value.clickable:hover {
  color: var(--accent-secondary);
}

.hash-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hash-value code {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--text-primary);
}

.copy-btn,
.copy-btn-small {
  padding: 0.375rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover,
.copy-btn-small:hover {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.copy-btn:hover svg,
.copy-btn-small:hover svg {
  stroke: white;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: var(--fill-success);
  color: var(--ios-green);
}

.status-badge.failed {
  background: var(--fill-error);
  color: var(--ios-red);
}

.messages-list,
.events-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-item,
.event-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.message-type,
.event-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.message-index {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.message-data pre,
.raw-data pre {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.event-attributes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.attribute-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.attr-key {
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 120px;
}

.attr-value {
  color: var(--text-primary);
  word-break: break-all;
}
</style>
