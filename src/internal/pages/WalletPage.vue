<template>
  <div class="wallet-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Wallet :size="24" />
        </div>
        <span class="logo-text">Wallet</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Assets</span>
          <button
            class="nav-item"
            :class="{ active: currentView === 'overview' }"
            @click="currentView = 'overview'"
          >
            <LayoutDashboard :size="18" />
            <span>Overview</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: currentView === 'tokens' }"
            @click="currentView = 'tokens'"
          >
            <Coins :size="18" />
            <span>Tokens</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Activity</span>
          <button
            class="nav-item"
            :class="{ active: currentView === 'transactions' }"
            @click="currentView = 'transactions'"
          >
            <ArrowLeftRight :size="18" />
            <span>Transactions</span>
          </button>
        </div>
      </nav>

      <!-- Wallet Status -->
      <div
        class="wallet-status"
        :class="{ connected: isConnected }"
        @click="isConnected ? disconnectWallet() : connectWallet()"
      >
        <div class="status-dot"></div>
        <span>{{ isConnected ? 'Connected' : 'Not Connected' }}</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>

        <div class="header-actions">
          <button class="action-btn secondary" @click="refreshWallet">
            <RefreshCw :size="16" />
            <span>Refresh</span>
          </button>
          <button class="action-btn primary" @click="connectWallet" v-if="!isConnected">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
          <button class="action-btn primary" @click="sendTransaction" v-else>
            <Send :size="16" />
            <span>Send</span>
          </button>
        </div>
      </header>

      <!-- Overview View -->
      <div v-if="currentView === 'overview'" class="overview-section">
        <!-- Balance Card -->
        <div class="balance-card">
          <div class="balance-header">
            <span class="balance-label">Total Balance</span>
            <button class="eye-btn" @click="showBalance = !showBalance">
              <Eye v-if="showBalance" :size="18" />
              <EyeOff v-else :size="18" />
            </button>
          </div>
          <div class="balance-amount">
            <span class="currency">LMN</span>
            <span class="amount">
              {{ showBalance ? balanceLabel : '••••••' }}
            </span>
          </div>
          <div class="balance-change">
            <TrendingUp :size="14" />
            <span v-if="isConnected && !balanceError">On-chain balance</span>
            <span v-else-if="balanceError">Error loading balance</span>
            <span v-else>Connect a wallet to view balance</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button class="quick-btn" @click="sendTransaction">
            <div class="quick-icon send">
              <ArrowUpRight :size="20" />
            </div>
            <span>Send</span>
          </button>
          <button class="quick-btn" @click="openReceiveModal">
            <div class="quick-icon receive">
              <ArrowDownLeft :size="20" />
            </div>
            <span>Receive</span>
          </button>
          <button class="quick-btn" disabled>
            <div class="quick-icon swap disabled">
              <ArrowLeftRight :size="20" />
            </div>
            <span>Swap (soon)</span>
          </button>
          <button class="quick-btn" disabled>
            <div class="quick-icon buy disabled">
              <CreditCard :size="20" />
            </div>
            <span>Buy (soon)</span>
          </button>
        </div>

        <!-- Address + summary -->
        <div class="info-section">
          <div class="info-card">
            <div class="info-label">Address</div>
            <div class="info-value mono" :title="address || '-'">
              {{ address || '-' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Tokens View -->
      <div v-else-if="currentView === 'tokens'" class="content-section">
        <div class="section-header">
          <h3>Your Tokens</h3>
        </div>
        <div class="empty-state" v-if="!isConnected">
          <div class="empty-icon">
            <Wallet :size="32" />
          </div>
          <h3>Connect Your Wallet</h3>
          <p>Connect a wallet to view your LMN balance.</p>
          <button class="connect-btn" @click="connectWallet">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
        </div>
        <div class="assets-list" v-else>
          <div class="asset-item">
            <div class="asset-icon lmn">
              <span>LMN</span>
            </div>
            <div class="asset-info">
              <span class="asset-name">Lumen</span>
              <span class="asset-symbol">LMN</span>
            </div>
            <div class="asset-balance">
              <span class="asset-amount">{{ balanceLmnDisplay }}</span>
            </div>
          </div>
        </div>
      </div>

        <!-- Transactions View -->
        <div v-else-if="currentView === 'transactions'" class="content-section">

        <div class="empty-state" v-if="!isConnected || !address">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No wallet connected</h3>
          <p>Connect a wallet to see your recent transactions.</p>
        </div>

        <div v-else-if="activitiesLoading" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Loading transactions…</h3>
          <p>Please wait while we fetch your recent activity from the indexer.</p>
        </div>

        <div v-else-if="activitiesError" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Unable to load transactions</h3>
          <p>{{ activitiesError }}</p>
        </div>

        <div v-else-if="!activities.length" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No recent transactions</h3>
          <p>Any sends, receives, or domain operations will show up here.</p>
        </div>

        <div v-else class="activities-list">
          <div
            v-for="tx in activities"
            :key="tx.id"
            class="activity-item"
          >
            <div class="activity-main">
              <div class="activity-type">
                <ArrowUpRight v-if="tx.type === 'send'" :size="16" />
                <ArrowDownLeft v-else-if="tx.type === 'receive'" :size="16" />
                <ArrowLeftRight v-else :size="16" />
                <span class="activity-type-label">
                  <template v-if="tx.amounts && tx.amounts.length">
                    <template v-if="tx.type === 'send'">
                      Send -{{ (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} LMN
                    </template>
                    <template v-else-if="tx.type === 'receive'">
                      Receive +{{ (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} LMN
                    </template>
                    <template v-else>
                      Activity {{ (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} LMN
                    </template>
                  </template>
                  <template v-else>
                    {{ tx.type === 'send' ? 'Send' : tx.type === 'receive' ? 'Receive' : 'Activity' }}
                  </template>
                </span>
              </div>
              <div class="activity-meta">
                <span class="activity-hash" :title="tx.txhash">
                  {{ tx.txhash.slice(0, 8) }}…{{ tx.txhash.slice(-6) }}
                </span>
                <span class="activity-time">
                  {{ new Date(tx.timestamp).toLocaleString() }}
                </span>
              </div>
              </div>
          </div>
        </div>
      </div>

    </main>

    <!-- Send Modal (preview only) -->
    <Transition name="fade">
      <div v-if="showSendModal" class="modal-overlay" @click="closeSendModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Send LMN (preview)</h3>
            <button class="modal-close" @click="closeSendModal">
              <X :size="16" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">
              This is a preview-only send flow. Use the full Lumen browser to actually submit transfers.
            </p>

            <div class="form-group">
              <label>From</label>
              <input class="form-input" type="text" :value="address" readonly />
            </div>

            <div class="form-group">
              <label>To</label>
              <input class="form-input" type="text" v-model="sendForm.recipient" placeholder="lmn1..." />
            </div>

            <div class="form-group">
              <label>Amount (LMN)</label>
              <input class="form-input" type="number" min="0" step="0.000001" v-model="sendForm.amount" />
            </div>

            <div class="tx-summary">
              <div class="summary-row">
                <span>Amount debited</span>
                <span class="summary-value">{{ sendSummary.amount }} LMN</span>
              </div>
              <div class="summary-row">
                <span>Tax</span>
                <span class="summary-value">{{ sendSummary.taxLabel }}</span>
              </div>
              <div class="summary-row total">
                <span>Receiver net</span>
                <span class="summary-value">{{ sendSummary.receiver }} LMN</span>
              </div>
            </div>

            <button class="btn-modal-primary" @click="confirmSendPreview" :disabled="!canSend">
              <Send :size="16" />
              <span>Preview send</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Receive Modal -->
    <Transition name="fade">
      <div v-if="showReceiveModal" class="modal-overlay" @click="closeReceiveModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Receive LMN</h3>
            <button class="modal-close" @click="closeReceiveModal">
              <X :size="16" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">
              Share your wallet address to receive LMN from another wallet or from an exchange that supports Lumen.
            </p>

            <div class="address-box">
              <div class="address-label">Your address</div>
              <div class="address-value">{{ address || '-' }}</div>
              <button class="btn-copy-address" type="button" @click="copyAddress" :disabled="!address">
                <Copy :size="14" />
                <span>Copy address</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect, onMounted } from 'vue';
import {
  Wallet,
  LayoutDashboard,
  Coins,
  ArrowLeftRight,
  RefreshCw,
  Link,
  Send,
  Eye,
  EyeOff,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Plus,
  X,
  Copy
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import { fetchActivities, type Activity } from '../services/activities';

const currentView = ref<'overview' | 'tokens' | 'transactions'>('overview');
const isConnected = ref(false);
const showBalance = ref(true);

// Profiles / wallet
const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);

// Prefer explicit address (browser/browser semantics), fall back to walletAddress for older entries.
const address = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});

const balanceLmn = ref<number | null>(null);
const balanceLoading = ref(false);
const balanceError = ref('');

// Modal states
const showSendModal = ref(false);
const showReceiveModal = ref(false);

// Activities
const activities = ref<Activity[]>([]);
const activitiesLoading = ref(false);
const activitiesError = ref('');

// Send form (preview)
const sendForm = ref({
  recipient: '',
  amount: '',
  gasFee: 'medium'
});

const tokenomicsTaxRate = ref<number | null>(null); // 0.01 = 1%

const balanceLabel = computed(() => {
  if (!isConnected.value) return 'Not connected';
  if (balanceLoading.value) return 'Loading...';
  if (balanceError.value) return 'Error';
  if (balanceLmn.value == null) return '0.000000 LMN';
  return `${balanceLmn.value.toFixed(6)} LMN`;
});

const balanceLmnDisplay = computed(() => {
  if (balanceLmn.value == null) return '0.000000';
  return balanceLmn.value.toFixed(6);
});

function getViewTitle(): string {
  const titles: Record<string, string> = {
    overview: 'Wallet Overview',
    tokens: 'Token Balances',
    transactions: 'Transactions'
  };
  return titles[currentView.value] || 'Wallet';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    overview: 'Manage your Lumen address and on-chain balance (read-only).',
    tokens: 'View your LMN balance.',
    transactions: 'Recent on-chain transactions for this wallet.'
  };
  return descs[currentView.value] || '';
}

async function refreshActivities() {
  activitiesLoading.value = true;
  activitiesError.value = '';
  try {
    if (!address.value) {
      activities.value = [];
      return;
    }
    const list = await fetchActivities({ walletId: address.value, limit: 20, offset: 0 });
    activities.value = list;
  } catch (e: any) {
    activitiesError.value = String(e?.message || e || 'Failed to load activities');
    activities.value = [];
  } finally {
    activitiesLoading.value = false;
  }
}

function connectWallet() {
  // In this shell, the wallet address is attached to the active profile.
  // If a profile exists and has a walletAddress, we treat the wallet as connected.
  if (!address.value) {
    window.alert('Create or select a profile first in the top navigation.');
    return;
  }
  isConnected.value = true;
  void refreshWallet();
}

function disconnectWallet() {
  isConnected.value = false;
}

async function refreshWallet() {
  if (!isConnected.value || !address.value) {
    balanceLmn.value = null;
    balanceError.value = '';
    return;
  }
  balanceLoading.value = true;
  balanceError.value = '';
  try {
    const anyWindow = window as any;
    const walletApi = anyWindow?.lumen?.wallet;
    if (!walletApi || typeof walletApi.getBalance !== 'function') {
      balanceError.value = 'Wallet bridge not available';
      balanceLmn.value = null;
      return;
    }
    const res = await walletApi.getBalance(address.value, { denom: 'ulmn' });
    if (!res || res.ok === false) {
      balanceError.value = res?.error || 'Unable to load balance';
      balanceLmn.value = null;
      return;
    }
    const amt = Number(res.balance?.amount ?? '0') || 0;
    balanceLmn.value = amt / 1_000_000;

    // Refresh tokenomics params (including tx_tax_rate) at the same time.
    try {
      if (typeof walletApi.getTokenomicsParams === 'function') {
        const tRes = await walletApi.getTokenomicsParams();
        if (tRes && tRes.ok !== false) {
          const raw = tRes.data?.params?.tx_tax_rate ?? tRes.data?.params?.txTaxRate;
          const n = Number(raw);
          tokenomicsTaxRate.value = Number.isFinite(n) ? n : null;
        }
      }
    } catch {
      // Ignore tokenomics errors; fee preview will fall back to 0.
    }
  } catch (e) {
    console.error('[wallet] refreshWallet error', e);
    balanceError.value = 'Unexpected error';
    balanceLmn.value = null;
  } finally {
    balanceLoading.value = false;
  }
}

function sendTransaction() {
  if (!isConnected.value || !address.value) {
    window.alert('Connect a wallet first.');
    return;
  }
  void refreshActivities();
  showSendModal.value = true;
}

function closeSendModal() {
  showSendModal.value = false;
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
}

const canSend = computed(() => {
  if (!address.value) return false;
  const amount = Number(sendForm.value.amount || '0');
  return Number.isFinite(amount) && amount > 0;
});

function formatLmnAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

const sendSummary = computed(() => {
  const amount = Number(sendForm.value.amount || '0') || 0;
  const rate = tokenomicsTaxRate.value ?? 0;
  const fee = amount * rate;
  const received = Math.max(amount - fee, 0);
  const pct = rate * 100;
  const taxLabel = Number.isFinite(pct) ? `${pct.toFixed(2).replace(/\.?0+$/, '')}%` : 'unknown';
  return {
    amount: formatLmnAmount(amount),
    receiver: formatLmnAmount(received),
    taxLabel
  };
});

async function confirmSendPreview() {
  if (!address.value) {
    window.alert('No sender address available.');
    return;
  }
  const from = address.value;
  const to = String(sendForm.value.recipient || '').trim();
  const amountNum = Number(sendForm.value.amount || '0');
  if (!to || !(amountNum > 0)) {
    window.alert('Please enter a valid recipient and amount.');
    return;
  }

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
  if (!walletApi || typeof walletApi.sendTokens !== 'function') {
    window.alert('Wallet send bridge not available.');
    return;
  }

  const activeId = activeProfileId.value;
  if (!activeId) {
    window.alert('No active profile selected.');
    return;
  }

  try {
    const res = await walletApi.sendTokens({
      profileId: activeId,
      from,
      to,
      amount: amountNum,
      denom: 'ulmn',
      memo: ''
    });
    if (!res || res.ok === false) {
      window.alert(`Send failed: ${res?.error || 'unknown error'}`);
      return;
    }
    window.alert(`Send successful! Tx hash: ${res.txhash || ''}`);
    closeSendModal();
    await refreshWallet();
    await refreshActivities();
  } catch (e) {
    console.error('[wallet] sendTokens error', e);
    window.alert('Unexpected error while sending transaction.');
  }
}

function openReceiveModal() {
  showReceiveModal.value = true;
}

function closeReceiveModal() {
  showReceiveModal.value = false;
}

async function copyAddress() {
  if (!address.value || !navigator.clipboard || !navigator.clipboard.writeText) return;
  try {
    await navigator.clipboard.writeText(address.value);
  } catch {
    // ignore copy errors
  }
}

// Auto-mark wallet as connected if profile already has an attached address
watchEffect(() => {
  if (address.value && !isConnected.value) {
    isConnected.value = true;
    void refreshWallet();
    void refreshActivities();
  }
});
</script>

<style scoped>
.wallet-page {
  display: flex;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 1px solid #e5e7eb;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.75rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item svg {
  color: #94a3b8;
}

.nav-item.active {
  background: #e0f2fe;
  color: #0f172a;
}

.nav-item.active svg {
  color: #2563eb;
}

.wallet-status {
  margin-top: auto;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.wallet-status.connected {
  background: #dcfce7;
  color: #166534;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #e5e7eb;
}

.wallet-status.connected .status-dot {
  background: #22c55e;
}

.main-content {
  flex: 1;
  padding: 1.75rem 2.25rem;
  overflow-y: auto;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  color: #0f172a;
}

.content-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
  font-size: 0.85rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.action-btn.secondary {
  background: #f9fafb;
  color: #374151;
  border-color: #e5e7eb;
}

.action-btn.primary {
  background: #2563eb;
  color: #ffffff;
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.balance-card {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%);
  border-radius: 1.25rem;
  padding: 1.75rem;
  color: white;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.4);
}

.balance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.balance-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(148, 163, 184, 0.9);
}

.eye-btn {
  border: none;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 999px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5e7eb;
  cursor: pointer;
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.currency {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(148, 163, 184, 0.9);
}

.amount {
  font-size: 2.2rem;
  font-weight: 700;
}

.balance-change {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgba(209, 250, 229, 0.9);
}

.quick-actions {
  display: flex;
  gap: 1rem;
}

.quick-btn {
  flex: 1;
  border-radius: 1rem;
  border: none;
  background: #ffffff;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #0f172a;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
}

.quick-btn[disabled] {
  opacity: 0.6;
  cursor: default;
}

.quick-icon {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.quick-icon.send {
  background: #4ade80;
}

.quick-icon.receive {
  background: #38bdf8;
}

.quick-icon.swap {
  background: #facc15;
}

.quick-icon.buy {
  background: #f97316;
}

.quick-icon.disabled {
  filter: grayscale(0.6);
}

.info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.info-card {
  flex: 1;
  min-width: 260px;
  background: #ffffff;
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid #e5e7eb;
}

.info-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 0.9rem;
  color: #0f172a;
}

.info-value.mono {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  word-break: break-all;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
}

.empty-state {
  margin-top: 2rem;
  padding: 2rem;
  border-radius: 1rem;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: #e0f2fe;
  color: #2563eb;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

.empty-state p {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: #6b7280;
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  border: none;
  background: #2563eb;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.assets-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
}

.asset-icon {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
}

.asset-icon.lmn {
  background: #2563eb;
}

.asset-info {
  flex: 1;
  margin-left: 0.75rem;
  display: flex;
  flex-direction: column;
}

.asset-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.asset-symbol {
  font-size: 0.8rem;
  color: #6b7280;
}

.asset-balance {
  text-align: right;
  font-size: 0.9rem;
  font-weight: 500;
  color: #0f172a;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: #ffffff;
  border-radius: 1rem;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.35);
}

.modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.modal-close {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: none;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal-body {
  padding: 1rem 1.25rem 1.25rem;
}

.modal-desc {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
  margin-bottom: 0.35rem;
}

.form-input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid #e5e7eb;
  font-size: 0.9rem;
}

.tx-summary {
  margin-top: 0.75rem;
  margin-bottom: 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  padding: 0.75rem 0.9rem;
  background: #f9fafb;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 0.3rem 0;
}

.summary-row.total {
  border-top: 1px solid #e5e7eb;
  margin-top: 0.25rem;
  padding-top: 0.4rem;
  font-weight: 600;
}

.summary-value {
  font-weight: 500;
}

.btn-modal-primary {
  width: 100%;
  border: none;
  border-radius: 0.8rem;
  padding: 0.7rem 0.9rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
}

.address-box {
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  padding: 0.9rem 1rem;
  background: #f9fafb;
  margin-bottom: 1rem;
}

.address-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.4rem;
}

.address-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  word-break: break-all;
  margin-bottom: 0.7rem;
}

.btn-copy-address {
  width: 100%;
  border-radius: 0.6rem;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 0.55rem;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  cursor: pointer;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
