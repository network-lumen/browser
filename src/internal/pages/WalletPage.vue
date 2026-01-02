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
          <button 
            class="nav-item"
            :class="{ active: currentView === 'nfts' }"
            @click="currentView = 'nfts'"
          >
            <Image :size="18" />
            <span>NFTs</span>
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
          <button 
            class="nav-item"
            :class="{ active: currentView === 'history' }"
            @click="currentView = 'history'"
          >
            <History :size="18" />
            <span>History</span>
          </button>
        </div>
      </nav>

      <!-- Wallet Status -->
      <div class="wallet-status" :class="{ connected: isConnected }" @click="isConnected ? disconnectWallet() : connectWallet()">
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
            <span class="currency">$</span>
            <span class="amount">{{ showBalance ? '0.00' : '••••••' }}</span>
          </div>
          <div class="balance-change positive">
            <TrendingUp :size="14" />
            <span>+0.00% (24h)</span>
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
          <button class="quick-btn">
            <div class="quick-icon swap">
              <ArrowLeftRight :size="20" />
            </div>
            <span>Swap</span>
          </button>
          <button class="quick-btn">
            <div class="quick-icon buy">
              <CreditCard :size="20" />
            </div>
            <span>Buy</span>
          </button>
        </div>

        <!-- Assets List -->
        <div class="assets-section">
          <div class="section-header">
            <h3>Your Assets</h3>
            <button class="add-token-btn">
              <Plus :size="14" />
              <span>Add Token</span>
            </button>
          </div>
          
          <div class="empty-state" v-if="!isConnected">
            <div class="empty-icon">
              <Wallet :size="32" />
            </div>
            <h3>Connect Your Wallet</h3>
            <p>Connect a wallet to view your assets and transactions</p>
            <button class="connect-btn" @click="connectWallet">
              <Link :size="16" />
              <span>Connect Wallet</span>
            </button>
          </div>

          <div class="assets-list" v-else>
            <div class="asset-item">
              <div class="asset-icon eth">
                <span>ETH</span>
              </div>
              <div class="asset-info">
                <span class="asset-name">Ethereum</span>
                <span class="asset-symbol">ETH</span>
              </div>
              <div class="asset-balance">
                <span class="asset-amount">0.00</span>
                <span class="asset-value">$0.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tokens View -->
      <div v-else-if="currentView === 'tokens'" class="tokens-section">
        <div class="empty-state">
          <div class="empty-icon">
            <Coins :size="32" />
          </div>
          <h3>No Tokens Found</h3>
          <p>Your token balances will appear here</p>
        </div>
      </div>

      <!-- NFTs View -->
      <div v-else-if="currentView === 'nfts'" class="nfts-section">
        <div class="empty-state">
          <div class="empty-icon">
            <Image :size="32" />
          </div>
          <h3>No NFTs Found</h3>
          <p>Your NFT collection will appear here</p>
        </div>
      </div>

      <!-- Transactions View -->
      <div v-else-if="currentView === 'transactions'" class="transactions-section">
        <div class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No Transactions</h3>
          <p>Your recent transactions will appear here</p>
        </div>
      </div>

      <!-- History View -->
      <div v-else-if="currentView === 'history'" class="history-section">
        <div class="empty-state">
          <div class="empty-icon">
            <History :size="32" />
          </div>
          <h3>No History</h3>
          <p>Your transaction history will appear here</p>
        </div>
      </div>
    </main>

    <!-- Send Transaction Modal -->
    <Transition name="fade">
      <div v-if="showSendModal" class="modal-overlay" @click="closeSendModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Send Transaction</h3>
            <button class="modal-close" @click="closeSendModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Send cryptocurrency to another address</p>
            
            <div class="form-group">
              <label>Recipient Address</label>
              <input type="text" class="form-input" v-model="sendForm.recipient" placeholder="0x..." />
            </div>
            
            <div class="form-group">
              <label>Amount</label>
              <div class="input-with-suffix">
                <input type="number" class="form-input" v-model="sendForm.amount" placeholder="0.00" />
                <span class="input-suffix">ETH</span>
              </div>
            </div>
            
            <div class="form-group">
              <label>Gas Fee (Optional)</label>
              <select class="form-select" v-model="sendForm.gasFee">
                <option value="low">Low (Slow)</option>
                <option value="medium" selected>Medium (Normal)</option>
                <option value="high">High (Fast)</option>
              </select>
            </div>
            
            <div class="tx-summary">
              <div class="summary-row">
                <span>Total Amount:</span>
                <span class="summary-value">{{ sendForm.amount || '0.00' }} ETH</span>
              </div>
              <div class="summary-row">
                <span>Estimated Gas:</span>
                <span class="summary-value">~0.003 ETH</span>
              </div>
              <div class="summary-row total">
                <span>Total:</span>
                <span class="summary-value">{{ calculateTotal() }} ETH</span>
              </div>
            </div>
            
            <button class="btn-modal-primary" @click="confirmSend" :disabled="!canSend()">
              <Send :size="18" />
              Send Transaction
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
            <h3>Receive Assets</h3>
            <button class="modal-close" @click="closeReceiveModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Share your wallet address to receive assets</p>
            
            <div class="receive-qr">
              <div class="qr-placeholder">
                <CreditCard :size="48" />
              </div>
            </div>
            
            <div class="address-box">
              <div class="address-label">Your Wallet Address</div>
              <div class="address-value">0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9</div>
              <button class="btn-copy-address" @click="copyWalletAddress">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                  <path d="M3 10.5V3.5C3 2.94772 3.44772 2.5 4 2.5H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                Copy Address
              </button>
            </div>
            
            <div class="receive-warning">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM8 11C7.44772 11 7 10.5523 7 10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10C9 10.5523 8.55228 11 8 11ZM9 7.5C9 7.77614 8.77614 8 8.5 8H7.5C7.22386 8 7 7.77614 7 7.5V4.5C7 4.22386 7.22386 4 7.5 4H8.5C8.77614 4 9 4.22386 9 4.5V7.5Z"/>
              </svg>
              Only send Ethereum (ETH) and ERC-20 tokens to this address
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Transaction Details Modal -->
    <Transition name="fade">
      <div v-if="showTxDetailsModal" class="modal-overlay" @click="closeTxDetailsModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Transaction Details</h3>
            <button class="modal-close" @click="closeTxDetailsModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="tx-status-badge success">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z"/>
              </svg>
              Confirmed
            </div>
            
            <div class="tx-detail-section">
              <div class="detail-row">
                <span class="detail-label">Transaction Hash</span>
                <div class="detail-value-box">
                  <span class="detail-value mono">0xa1b2c3...def456</span>
                  <button class="btn-detail-copy" @click="copyTxHash">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                      <path d="M3 10.5V3.5C3 2.94772 3.44772 2.5 4 2.5H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">From</span>
                <div class="detail-value-box">
                  <span class="detail-value mono">0x742d35...0bEb9</span>
                  <button class="btn-detail-copy">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                      <path d="M3 10.5V3.5C3 2.94772 3.44772 2.5 4 2.5H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">To</span>
                <div class="detail-value-box">
                  <span class="detail-value mono">0x8ba1f1...4e550</span>
                  <button class="btn-detail-copy">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="5" y="5" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
                      <path d="M3 10.5V3.5C3 2.94772 3.44772 2.5 4 2.5H10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value">0.5 ETH</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Gas Fee</span>
                <span class="detail-value">0.003 ETH</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Timestamp</span>
                <span class="detail-value">2026-01-02 14:32:15 UTC</span>
              </div>
            </div>
            
            <button class="btn-modal-secondary" @click="viewOnExplorer">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 8.66667V12.6667C12 13.0203 11.8595 13.3594 11.6095 13.6095C11.3594 13.8595 11.0203 14 10.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V5.33333C2 4.97971 2.14048 4.64057 2.39052 4.39052C2.64057 4.14048 2.97971 4 3.33333 4H7.33333M10 2H14M14 2V6M14 2L6.66667 9.33333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              View on Explorer
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { 
  Wallet, 
  LayoutDashboard, 
  Coins, 
  Image, 
  ArrowLeftRight, 
  History,
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
  X
} from 'lucide-vue-next';

const currentView = ref<'overview' | 'tokens' | 'nfts' | 'transactions' | 'history'>('overview');
const isConnected = ref(false);
const showBalance = ref(true);

// Modal states
const showSendModal = ref(false);
const showReceiveModal = ref(false);
const showTxDetailsModal = ref(false);

// Send form
const sendForm = ref({
  recipient: '',
  amount: '',
  gasFee: 'medium'
});

function getViewTitle(): string {
  const titles: Record<string, string> = {
    overview: 'Wallet Overview',
    tokens: 'Token Balances',
    nfts: 'NFT Collection',
    transactions: 'Transactions',
    history: 'Transaction History'
  };
  return titles[currentView.value] || 'Wallet';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    overview: 'Manage your crypto assets and transactions',
    tokens: 'View and manage your token holdings',
    nfts: 'Browse your NFT collection',
    transactions: 'View pending and recent transactions',
    history: 'Complete transaction history'
  };
  return descs[currentView.value] || '';
}

function connectWallet() {
  isConnected.value = true;
}

function disconnectWallet() {
  isConnected.value = false;
}

function refreshWallet() {
  // TODO: Refresh wallet data
}

function sendTransaction() {
  showSendModal.value = true;
}

// Send Modal
function closeSendModal() {
  showSendModal.value = false;
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
}

function calculateTotal(): string {
  const amount = parseFloat(sendForm.value.amount) || 0;
  const gas = 0.003;
  return (amount + gas).toFixed(4);
}

function canSend(): boolean {
  return sendForm.value.recipient.length > 0 && parseFloat(sendForm.value.amount) > 0;
}

function confirmSend() {
  // TODO: Execute transaction
  console.log('Sending transaction:', sendForm.value);
  closeSendModal();
}

// Receive Modal
function openReceiveModal() {
  showReceiveModal.value = true;
}

function closeReceiveModal() {
  showReceiveModal.value = false;
}

function copyWalletAddress() {
  navigator.clipboard.writeText('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9');
  // Show toast notification
}

// Transaction Details Modal
function openTxDetailsModal() {
  showTxDetailsModal.value = true;
}

function closeTxDetailsModal() {
  showTxDetailsModal.value = false;
}

function copyTxHash() {
  navigator.clipboard.writeText('0xa1b2c3def456');
  // Show toast notification
}

function viewOnExplorer() {
  // Open block explorer
  window.open('https://etherscan.io/tx/0xa1b2c3def456', '_blank');
}
</script>

<style scoped>
.wallet-page {
  display: flex;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

/* Sidebar */
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
  flex-shrink: 0;
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
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #64748b;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.wallet-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.wallet-status:hover {
  opacity: 0.9;
}

.wallet-status.connected {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #bbf7d0;
  color: #16a34a;
}

.wallet-status.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: #fff;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 16px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.action-btn.primary:hover {
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
  transform: translateY(-1px);
}

.action-btn.secondary {
  background: #f1f5f9;
  color: #64748b;
}

.action-btn.secondary:hover {
  background: #e2e8f0;
  color: #1e293b;
}

/* Overview Section */
.overview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.balance-card {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 20px;
  padding: 2rem;
  color: white;
}

.balance-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.balance-label {
  font-size: 0.875rem;
  opacity: 0.9;
}

.eye-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  border-radius: 8px;
  padding: 0.5rem;
  cursor: pointer;
  color: white;
  transition: all 0.2s;
}

.eye-btn:hover {
  background: rgba(255,255,255,0.3);
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.currency {
  font-size: 1.5rem;
  font-weight: 600;
}

.amount {
  font-size: 2.5rem;
  font-weight: 700;
}

.balance-change {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  opacity: 0.9;
}

.balance-change.positive {
  color: #86efac;
}

.balance-change.negative {
  color: #fca5a5;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 1rem;
}

.quick-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.quick-btn span {
  font-size: 0.85rem;
  font-weight: 500;
  color: #1e293b;
}

.quick-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.quick-icon.send { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
.quick-icon.receive { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); }
.quick-icon.swap { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
.quick-icon.buy { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); }

/* Assets Section */
.assets-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.add-token-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.add-token-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.assets-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.asset-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.asset-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
}

.asset-icon.eth { background: linear-gradient(135deg, #627eea 0%, #4c6ce1 100%); }

.asset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.asset-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.asset-symbol {
  font-size: 0.75rem;
  color: #64748b;
}

.asset-balance {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.asset-amount {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e293b;
}

.asset-value {
  font-size: 0.75rem;
  color: #64748b;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.empty-state h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.connect-btn:hover {
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
  transform: translateY(-1px);
}

/* Other sections */
.tokens-section,
.nfts-section,
.transactions-section,
.history-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
  
  .quick-actions {
    flex-wrap: wrap;
  }
  
  .quick-btn {
    flex: 1 1 calc(50% - 0.5rem);
    min-width: 120px;
  }
}

@media (max-width: 700px) {
  .wallet-page {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
  }
  
  .sidebar-header {
    margin-bottom: 0;
    margin-right: 1rem;
  }
  
  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
  }
  
  .nav-section {
    flex-direction: row;
  }
  
  .nav-label {
    display: none;
  }
  
  .nav-item span {
    display: none;
  }
  
  .wallet-status {
    margin-left: auto;
  }
  
  .wallet-status span {
    display: none;
  }
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix .form-input {
  padding-right: 4rem;
}

.input-suffix {
  position: absolute;
  right: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
}

.form-select {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: #cbd5e1;
}

.form-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.tx-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #64748b;
}

.summary-row.total {
  border-top: 1px solid #e2e8f0;
  margin-top: 0.5rem;
  padding-top: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.summary-value {
  font-weight: 600;
  color: #1e293b;
}

.btn-modal-primary {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.btn-modal-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-modal-secondary {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #64748b;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-secondary:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.receive-qr {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.address-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.address-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.address-value {
  font-family: 'Courier New', monospace;
  font-size: 0.9375rem;
  color: #1e293b;
  margin-bottom: 1rem;
  word-break: break-all;
}

.btn-copy-address {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  color: #3498db;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-copy-address:hover {
  background: #f1f5f9;
  border-color: #3498db;
}

.receive-warning {
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.875rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #92400e;
  line-height: 1.5;
}

.receive-warning svg {
  flex-shrink: 0;
  margin-top: 0.125rem;
  color: #f59e0b;
}

.tx-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.tx-status-badge.success {
  background: #d1fae5;
  color: #065f46;
}

.tx-detail-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
}

.detail-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
}

.detail-value.mono {
  font-family: 'Courier New', monospace;
}

.detail-value-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-detail-copy {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: #e2e8f0;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-detail-copy:hover {
  background: #cbd5e1;
  color: #1e293b;
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
