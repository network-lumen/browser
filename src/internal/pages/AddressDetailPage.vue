<template>
  <div class="address-detail-page">
    <div class="address-detail-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Explorer
      </button>
      <h1>Address Details</h1>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading address data...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="address" class="address-content">
      <!-- Address Overview Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Address Overview</h2>
        </div>
        <div class="card-body">
          <div class="detail-row">
            <span class="label">Address:</span>
            <div class="hash-value">
              <code>{{ address.address }}</code>
              <button class="copy-btn" @click="copyToClipboard(address.address)" title="Copy address">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="detail-row">
            <span class="label">Account Number:</span>
            <span class="value">{{ address.accountNumber }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Sequence:</span>
            <span class="value">{{ address.sequence }}</span>
          </div>
        </div>
      </div>

      <!-- Balances Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Balances</h2>
        </div>
        <div class="card-body">
          <div v-if="address.balances && address.balances.length > 0" class="balances-list">
            <div class="balance-item" v-for="(balance, index) in address.balances" :key="index">
              <div class="balance-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
              </div>
              <div class="balance-info">
                <div class="balance-amount">{{ formatAmount(balance.amount) }}</div>
                <div class="balance-denom">{{ balance.denom.toUpperCase() }}</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <p>No balances found</p>
          </div>
        </div>
      </div>

      <!-- Delegations Card -->
      <div class="detail-card" v-if="address.delegations && address.delegations.length > 0">
        <div class="card-header">
          <h2>Delegations ({{ address.delegations.length }})</h2>
        </div>
        <div class="card-body">
          <div class="delegations-list">
            <div class="delegation-item" v-for="(delegation, index) in address.delegations" :key="index">
              <div class="delegation-validator">
                <div class="validator-avatar" :style="{ background: getValidatorColor(delegation.validator) }">
                  <span>{{ delegation.validatorMoniker?.charAt(0).toUpperCase() || 'V' }}</span>
                </div>
                <div class="validator-info">
                  <div class="validator-name">{{ delegation.validatorMoniker || delegation.validator }}</div>
                  <div class="validator-address">{{ shortenAddress(delegation.validator) }}</div>
                </div>
              </div>
              <div class="delegation-amount">
                {{ formatAmount(delegation.amount) }} LUMEN
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Transactions Card -->
      <div class="detail-card">
        <div class="card-header">
          <h2>Recent Transactions</h2>
        </div>
        <div class="card-body">
          <div v-if="address.transactions && address.transactions.length > 0" class="transactions-list">
            <div class="tx-item" v-for="(tx, index) in address.transactions" :key="index">
              <div class="tx-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div class="tx-info">
                <div class="tx-hash" @click="navigateToTx(tx.hash)">
                  <code>{{ shortenHash(tx.hash) }}</code>
                </div>
                <div class="tx-meta">
                  <span class="tx-height" @click="navigateToBlock(tx.height)">Block {{ tx.height }}</span>
                  <span class="tx-time">{{ tx.time }}</span>
                </div>
              </div>
              <div class="tx-status">
                <span :class="['status-badge', tx.success ? 'success' : 'failed']">
                  {{ tx.success ? '✓' : '✗' }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <p>No recent transactions found</p>
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
const address = ref<any>(null);
const restBase = ref('http://142.132.201.187:1317');

const lumen = (window as any).lumen;

const currentTabUrl = inject<any>('currentTabUrl', null);

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard:', text);
  });
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

    const accountResponse = await lumen.http.get(
      `${restBase.value}/cosmos/auth/v1beta1/accounts/${accountAddress.value}`
    );
    
    if (!accountResponse.ok) {
      throw new Error(`Failed to fetch account: ${accountResponse.statusText || 'Unknown error'}`);
    }

    const accountData = accountResponse.json;
    const account = accountData.account;

    const balancesResponse = await lumen.http.get(
      `${restBase.value}/cosmos/bank/v1beta1/balances/${accountAddress.value}`
    );
    
    const balances = balancesResponse.ok ? balancesResponse.json.balances || [] : [];

    const delegationsResponse = await lumen.http.get(
      `${restBase.value}/cosmos/staking/v1beta1/delegations/${accountAddress.value}`
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
</script>

<style scoped>
.address-detail-page {
  width: 100%;
  min-height: 100vh;
  background: var(--bg-primary, #f8fafc);
  color: var(--text-primary, #1e293b);
  padding: 2rem;
}

.address-detail-header {
  margin-bottom: 2rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 1rem;
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.address-detail-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
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
  border: 4px solid var(--border-color, #e2e8f0);
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container p {
  color: #ef4444;
  font-size: 1rem;
}

.address-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-card {
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.card-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
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
  border-bottom: 1px solid var(--border-light, #f1f5f9);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row:hover {
  background: var(--bg-hover, #f8fafc);
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  border-radius: 0.375rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #64748b);
}

.value {
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  word-break: break-all;
}

.hash-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hash-value code {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.375rem;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  word-break: break-all;
  color: var(--text-primary, #1e293b);
}

.copy-btn {
  padding: 0.375rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  background: #3498db;
  border-color: #3498db;
}

.copy-btn:hover svg {
  stroke: white;
}

.balances-list,
.delegations-list,
.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.balance-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
}

.balance-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 50%;
  color: white;
}

.balance-info {
  flex: 1;
}

.balance-amount {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.balance-denom {
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}

.delegation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
}

.delegation-validator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.validator-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

.validator-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.validator-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.validator-address {
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
  font-family: 'Courier New', monospace;
}

.delegation-amount {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.tx-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.tx-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 50%;
  color: var(--text-secondary, #64748b);
}

.tx-info {
  flex: 1;
}

.tx-hash {
  cursor: pointer;
  margin-bottom: 0.25rem;
}

.tx-hash code {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: #3498db;
}

.tx-hash:hover code {
  text-decoration: underline;
}

.tx-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}

.tx-height {
  cursor: pointer;
  color: #3498db;
}

.tx-height:hover {
  text-decoration: underline;
}

.tx-status {
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.success {
  background: #dcfce7;
  color: #166534;
}

.status-badge.failed {
  background: #fee2e2;
  color: #991b1b;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #94a3b8);
}
</style>
