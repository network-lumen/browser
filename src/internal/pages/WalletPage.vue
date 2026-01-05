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

      <!-- Wallet Status -->
      <div
        class="wallet-status"
        :class="{ connected: isConnected }"
        @click="isConnected ? disconnectWallet() : connectWallet()"
      >
        <div class="status-dot"></div>
        <span>{{ isConnected ? 'Connected' : 'Not Connected' }}</span>
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
          <button
            class="nav-item"
            :class="{ active: currentView === 'recurring' }"
            @click="currentView = 'recurring'"
          >
            <Calendar :size="18" />
            <span>Recurring</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: currentView === 'addressbook' }"
            @click="currentView = 'addressbook'"
          >
            <Users :size="18" />
            <span>Address Book</span>
          </button>
        </div>
      </nav>
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

        <div class="section-header" v-if="activities.length > 0">
          <h3>Recent Transactions</h3>
          <div class="header-actions-group">
            <div class="filter-group">
              <select v-model="txFilterType" class="filter-select">
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="receive">Receive</option>
              </select>
              <select v-model="txFilterStatus" class="filter-select">
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
              <input
                v-model="txSearchQuery"
                type="text"
                placeholder="Search hash or address..."
                class="search-input"
              />
            </div>
            <button class="action-btn secondary" @click="exportTransactions">
              <Download :size="16" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

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
          <div class="table-header">
            <div class="col-type">Type</div>
            <div class="col-amount">Amount</div>
            <div class="col-from">From</div>
            <div class="col-to">To</div>
            <div class="col-hash">Hash</div>
            <div class="col-status">Status</div>
            <div class="col-time">Time</div>
          </div>

          <div
            v-for="tx in enhancedActivities"
            :key="tx.id"
            class="activity-row"
          >
            <div class="col-type">
              <div class="type-badge" :class="tx.type">
                <ArrowUpRight v-if="tx.type === 'send'" :size="14" />
                <ArrowDownLeft v-else-if="tx.type === 'receive'" :size="14" />
                <ArrowLeftRight v-else :size="14" />
                <span>{{ tx.type === 'send' ? 'Send' : 'Receive' }}</span>
              </div>
            </div>

            <div class="col-amount">
              <span class="amount-value" :class="tx.type">
                <template v-if="tx.amounts && tx.amounts.length">
                  {{ tx.type === 'send' ? '-' : '+' }}{{ (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} LMN
                </template>
                <template v-else>-</template>
              </span>
            </div>

            <div class="col-from">
              <span class="address-value" :title="tx.from || address">
                {{ (tx.from || address || '').slice(0, 8) }}…{{ (tx.from || address || '').slice(-6) }}
              </span>
            </div>

            <div class="col-to">
              <span class="address-value" :title="tx.to || '-'">
                {{ tx.to ? tx.to.slice(0, 8) + '…' + tx.to.slice(-6) : '-' }}
              </span>
            </div>

            <div class="col-hash">
              <span class="hash-value" :title="tx.txhash">
                {{ tx.txhash.slice(0, 8) }}…{{ tx.txhash.slice(-6) }}
              </span>
              <button class="action-icon copy-btn" @click.stop="copyToClipboard(tx.txhash, 'Hash copied!')" title="Copy hash">
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-status">
              <span class="status-badge" :class="(tx.code === undefined || tx.code === 0) ? 'success' : 'failed'">
                {{ (tx.code === undefined || tx.code === 0) ? 'Success' : 'Failed' }}
              </span>
            </div>

            <div class="col-time">
              <span class="time-value">
                {{ new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                <span class="time-hour">{{ new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Address Book View -->
      <div v-else-if="currentView === 'addressbook'" class="content-section">
        <div class="section-header">
          <h3>Saved Addresses</h3>
          <button class="action-btn primary" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add Contact</span>
          </button>
        </div>

        <div class="empty-state" v-if="!contacts.length && !contactsLoading">
          <div class="empty-icon">
            <Users :size="32" />
          </div>
          <h3>No Contacts Yet</h3>
          <p>Add addresses you frequently send to for quick access.</p>
          <button class="connect-btn" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add First Contact</span>
          </button>
        </div>

        <div v-else-if="contactsLoading" class="empty-state">
          <div class="empty-icon">
            <Users :size="32" />
          </div>
          <h3>Loading contacts…</h3>
        </div>

        <div v-else class="contacts-grid">
          <div v-for="contact in contacts" :key="contact.id" class="contact-card">
            <div class="contact-header">
              <div class="contact-avatar">
                {{ contact.name.charAt(0).toUpperCase() }}
              </div>
              <div class="contact-info">
                <h4>{{ contact.name }}</h4>
                <p class="contact-address" :title="contact.address">
                  {{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}
                </p>
              </div>
            </div>
            <p class="contact-note" v-if="contact.note">{{ contact.note }}</p>
            <div class="contact-actions">
              <button class="contact-btn send" @click="sendToContact(contact)">
                <Send :size="14" />
                <span>Send</span>
              </button>
              <button class="contact-btn copy" @click="copyToClipboard(contact.address, 'Address copied!')">
                <Copy :size="14" />
                <span>Copy</span>
              </button>
              <button class="contact-btn edit" @click="editContact(contact)">
                <Edit :size="14" />
                <span>Edit</span>
              </button>
              <button class="contact-btn delete" @click="deleteContact(contact)">
                <Trash2 :size="14" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recurring Payments View -->
      <div v-else-if="currentView === 'recurring'" class="content-section recurring-section">
        <SubscriptionsView 
          ref="subscriptionsRef"
          @execute-payment="executeRecurringPayment"
          @toast="showToast"
        />
      </div>

    </main>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div v-if="toastVisible" class="toast-notification" :class="toastType">
        <div class="toast-icon">
          <Check v-if="toastType === 'success'" :size="18" />
          <AlertCircle v-else :size="18" />
        </div>
        <span class="toast-message">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Send Modal -->
    <Transition name="fade">
      <div v-if="showSendModal" class="modal-overlay" @click="closeSendModal">
        <div class="modal-content send-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon">
                <Send :size="20" />
              </div>
              <h3>Send LMN</h3>
            </div>
            <button class="modal-close" @click="closeSendModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="info-banner">
              <span>
                💡 Your first transaction may take up to 60 seconds. <br>
                After that, transactions are confirmed within ~6 seconds.</span>
            </div>

            <div class="form-group">
              <label>From</label>
              <div class="input-wrapper readonly">
                <input class="form-input" type="text" :value="address" readonly />
              </div>
            </div>

            <div class="form-group">
              <label>To <span class="required">*</span></label>
              <div class="input-wrapper-relative">
                <div class="input-wrapper">
                  <input 
                    class="form-input" 
                    type="text" 
                    v-model="sendForm.recipient" 
                    placeholder="Enter recipient address (lmn1...)" 
                  />
                  <button 
                    class="input-action-btn" 
                    @click="openQrScanner"
                    type="button"
                    title="Scan QR Code"
                  >
                    <QrCode :size="16" />
                  </button>
                  <button 
                    v-if="contacts.length > 0" 
                    class="input-action-btn" 
                    @click="showContactPicker = !showContactPicker"
                    type="button"
                    title="Select from contacts"
                  >
                    <Users :size="16" />
                  </button>
                </div>
                <div v-if="showContactPicker" class="contact-picker">
                  <div class="picker-header">
                    <span>Select Contact</span>
                    <button class="picker-close" @click="showContactPicker = false">
                      <X :size="14" />
                    </button>
                  </div>
                  <div class="picker-list">
                    <button 
                      v-for="contact in contacts" 
                      :key="contact.id"
                      class="picker-item"
                      @click="selectContactForSend(contact)"
                    >
                      <div class="picker-avatar">{{ contact.name.charAt(0).toUpperCase() }}</div>
                      <div class="picker-info">
                        <span class="picker-name">{{ contact.name }}</span>
                        <span class="picker-address">{{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Amount (LMN) <span class="required">*</span></label>
              <div class="input-wrapper amount-input">
                <input 
                  class="form-input" 
                  type="text" 
                  inputmode="decimal"
                  v-model="sendForm.amount"
                  placeholder="0.000000"
                  @input="validateAmountInput"
                />
                <span class="input-suffix">LMN</span>
              </div>
              <div class="balance-hint" v-if="balanceLmn !== null">
                Available: {{ balanceLmnDisplay }} LMN
              </div>
            </div>

            <div class="tx-summary">
              <div class="summary-header">
                <span>Transaction Summary</span>
              </div>
              <div class="summary-row">
                <span>Amount debited</span>
                <span class="summary-value">{{ sendSummary.amount }} LMN</span>
              </div>
              <div class="summary-row">
                <span>Tax</span>
                <span class="summary-value tax">{{ sendSummary.taxLabel }}</span>
              </div>
              <div class="summary-row total">
                <span>Receiver net</span>
                <span class="summary-value">{{ sendSummary.receiver }} LMN</span>
              </div>
            </div>

            <button class="btn-modal-primary" @click="confirmSendPreview" :disabled="!canSend || sendingTransaction">
              <Send :size="18" v-if="!sendingTransaction" />
              <span class="spinner" v-else></span>
              <span>{{ sendingTransaction ? 'Sending...' : 'Preview Send' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Receive Modal -->
    <Transition name="fade">
      <div v-if="showReceiveModal" class="modal-overlay" @click="closeReceiveModal">
        <div class="modal-content receive-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon receive">
                <ArrowDownLeft :size="20" />
              </div>
              <h3>Receive LMN</h3>
            </div>
            <button class="modal-close" @click="closeReceiveModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="info-banner">
              <span>📱 Share your wallet address or QR code to receive LMN from another wallet.</span>
            </div>

            <div class="qr-section">
              <div class="qr-wrapper">
                <img 
                  v-if="qrCodeDataUrl" 
                  :src="qrCodeDataUrl"
                  alt="QR Code"
                  class="qr-image"
                />
                <div v-else class="qr-placeholder">
                  <div class="qr-loading">Generating QR Code...</div>
                </div>
              </div>
            </div>

            <div class="address-box">
              <div class="address-label">Your Wallet Address</div>
              <div class="address-value">{{ address || '-' }}</div>
              <button class="btn-copy-address" type="button" @click="copyAddressWithToast" :disabled="!address">
                <Copy :size="16" />
                <span>Copy Address</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add/Edit Contact Modal -->
    <Transition name="fade">
      <div v-if="showContactModal" class="modal-overlay" @click="closeContactModal">
        <div class="modal-content contact-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon">
                <Users :size="20" />
              </div>
              <h3>{{ editingContact ? 'Edit Contact' : 'Add Contact' }}</h3>
            </div>
            <button class="modal-close" @click="closeContactModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name <span class="required">*</span></label>
              <div class="input-wrapper">
                <input 
                  class="form-input" 
                  type="text" 
                  v-model="contactForm.name" 
                  placeholder="Enter contact name" 
                />
              </div>
            </div>

            <div class="form-group">
              <label>Address <span class="required">*</span></label>
              <div class="input-wrapper">
                <input 
                  class="form-input" 
                  type="text" 
                  v-model="contactForm.address" 
                  placeholder="lmn1..." 
                  :readonly="!!editingContact"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Note (optional)</label>
              <div class="input-wrapper">
                <textarea 
                  class="form-input form-textarea" 
                  v-model="contactForm.note" 
                  placeholder="Add a note about this contact"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <button 
              class="btn-modal-primary" 
              @click="saveContact" 
              :disabled="!contactForm.name || !contactForm.address || savingContact"
            >
              <Check :size="18" v-if="!savingContact" />
              <span class="spinner" v-else></span>
              <span>{{ savingContact ? 'Saving...' : (editingContact ? 'Update Contact' : 'Add Contact') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- QR Scanner Modal -->
    <QrScanner 
      v-if="showQrScanner" 
      @close="closeQrScanner"
      @scan="handleQrScan"
      :title="qrScannerTitle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect, onMounted } from 'vue';
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
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Users,
  Edit,
  Trash2,
  Download,
  QrCode,
  Calendar
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import { fetchActivities, type Activity, type ActivityType, clearActivitiesCache } from '../services/activities';
import QRCode from 'qrcode';
import QrScanner from '../../components/QrScanner.vue';
import SubscriptionsView from '../../components/SubscriptionsView.vue';
import { getWalletConnectService, parseWalletConnectUri } from '../services/walletconnect';
import { getRecurringPaymentsService, type RecurringPayment } from '../services/recurringPayments';

const currentView = ref<'overview' | 'tokens' | 'transactions' | 'addressbook' | 'recurring'>('overview');
const isConnected = ref(false);
const showBalance = ref(true);

const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);

const address = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});

const balanceLmn = ref<number | null>(null);
const balanceLoading = ref(false);
const balanceError = ref('');

const showSendModal = ref(false);
const showReceiveModal = ref(false);
const sendingTransaction = ref(false);
const qrCodeDataUrl = ref<string>('');

// Generate QR Code when address changes
watch([address, showReceiveModal], async ([newAddress, isModalOpen]) => {
  if (isModalOpen && newAddress) {
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(newAddress, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      qrCodeDataUrl.value = '';
    }
  }
});

// Address Book
const contacts = ref<any[]>([]);
const contactsLoading = ref(false);
const showContactModal = ref(false);
const showContactPicker = ref(false);
const editingContact = ref<any>(null);
const savingContact = ref(false);
const contactForm = ref({
  name: '',
  address: '',
  note: ''
});

const activities = ref<Activity[]>([]);
const activitiesLoading = ref(false);
const activitiesError = ref('');

// Transaction Filters
const txFilterType = ref<'all' | 'send' | 'receive'>('all');
const txFilterStatus = ref<'all' | 'success' | 'pending' | 'failed'>('all');
const txSearchQuery = ref('');

const sendForm = ref({
  recipient: '',
  amount: '',
  gasFee: 'medium'
});

// QR Scanner
const showQrScanner = ref(false);
const qrScannerTitle = ref('Scan QR Code');

// Recurring Payments
const subscriptionsRef = ref<any>(null);
const recurringPaymentsService = getRecurringPaymentsService();

const tokenomicsTaxRate = ref<number | null>(null); // 0.01 = 1%

const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
let toastTimeout: any = null;

onMounted(() => {
  loadContacts();
});

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

const enhancedActivities = computed(() => {
  const userAddr = address.value?.toLowerCase();
  if (!userAddr) return activities.value;
  
  let filtered = activities.value.map(tx => {
    const fromAddr = tx.from || tx.sender;
    const toAddr = tx.to || tx.recipient;
    
    const from = fromAddr?.toLowerCase();
    const to = toAddr?.toLowerCase();
    
    let actualType: ActivityType = tx.type || 'unknown';
    
    if (from && to) {
      if (to === userAddr) {
        actualType = 'receive';
      } else if (from === userAddr) {
        actualType = 'send';
      }
    }
    
    return { 
      ...tx, 
      type: actualType, 
      from: fromAddr, 
      to: toAddr 
    };
  });

  // Apply type filter
  if (txFilterType.value !== 'all') {
    filtered = filtered.filter(tx => tx.type === txFilterType.value);
  }

  // Apply status filter
  if (txFilterStatus.value !== 'all') {
    filtered = filtered.filter(tx => {
      const isSuccess = tx.code === undefined || tx.code === 0;
      if (txFilterStatus.value === 'success') return isSuccess;
      if (txFilterStatus.value === 'failed') return !isSuccess;
      return true;
    });
  }

  // Apply search query
  if (txSearchQuery.value.trim()) {
    const query = txSearchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(tx => {
      const hash = (tx.txhash || '').toLowerCase();
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      return hash.includes(query) || from.includes(query) || to.includes(query);
    });
  }

  return filtered;
});

function getViewTitle(): string {
  const titles: Record<string, string> = {
    overview: 'Wallet Overview',
    tokens: 'Token Balances',
    transactions: 'Transactions',
    addressbook: 'Address Book',
    recurring: 'Recurring Payments'
  };
  return titles[currentView.value] || 'Wallet';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    overview: 'Manage your Lumen address and on-chain balance (read-only).',
    tokens: 'View your LMN balance.',
    transactions: 'Recent on-chain transactions for this wallet.',
    addressbook: 'Save frequently used addresses for quick access.',
    recurring: 'Schedule and manage automatic payments and subscriptions.'
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
  showContactPicker.value = false;
  showSendModal.value = true;
}

function closeSendModal() {
  showSendModal.value = false;
  showContactPicker.value = false;
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
}

// QR Scanner functions
function openQrScanner() {
  qrScannerTitle.value = 'Scan Wallet Address or Payment';
  showQrScanner.value = true;
}

function closeQrScanner() {
  showQrScanner.value = false;
}

function handleQrScan(data: { type: string; content: string; raw: string }) {
  closeQrScanner();
  
  const { type, content, raw } = data;
  
  // Handle WalletConnect
  if (type === 'walletconnect' || raw.startsWith('wc:')) {
    handleWalletConnectUri(raw);
    return;
  }
  
  // Handle payment requests
  if (type === 'paymentrequest' || raw.includes('amount=')) {
    try {
      // Parse payment request format: lumen:address?amount=1.5&memo=test
      const url = new URL(raw.startsWith('lumen:') ? raw : `lumen:${raw}`);
      const address = url.pathname.replace('//', '');
      const amount = url.searchParams.get('amount');
      const memo = url.searchParams.get('memo');
      
      if (address) {
        sendForm.value.recipient = address;
      }
      if (amount) {
        sendForm.value.amount = amount;
      }
      
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      
      showToast('Payment request scanned successfully', 'success');
    } catch (e) {
      // If not a valid URL, treat as simple address
      sendForm.value.recipient = content;
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      showToast('Address scanned successfully', 'success');
    }
    return;
  }
  
  // Handle regular wallet address
  if (type === 'walletaddress' || type === 'unknown') {
    sendForm.value.recipient = content;
    if (!showSendModal.value) {
      showSendModal.value = true;
    }
    showToast('Wallet address scanned successfully', 'success');
    return;
  }
  
  // Handle URL (maybe for WalletConnect or other integrations)
  if (type === 'url') {
    showToast('URL scanned. Feature integration coming soon.', 'success');
    return;
  }
  
  showToast('QR code scanned', 'success');
}

async function handleWalletConnectUri(uri: string) {
  try {
    const parsedUri = parseWalletConnectUri(uri);
    if (!parsedUri) {
      showToast('Invalid WalletConnect URI', 'error');
      return;
    }

    showToast(`WalletConnect v${parsedUri.version} detected`, 'success');
    
    // TODO: Show WalletConnect connection dialog
    // const wcService = getWalletConnectService();
    // await wcService.connect(uri);
    
    showToast('WalletConnect integration coming soon!', 'success');
  } catch (error: any) {
    console.error('WalletConnect error:', error);
    showToast(error.message || 'Failed to connect via WalletConnect', 'error');
  }
}

// Recurring Payments
async function executeRecurringPayment(paymentId: string) {
  const payment = recurringPaymentsService.getRecurringPayment(paymentId);
  if (!payment) {
    showToast('Payment not found', 'error');
    return;
  }

  const executeFunction = async (p: RecurringPayment) => {
    try {
      const anyWindow = window as any;
      const walletApi = anyWindow?.lumen?.wallet;
      
      if (!walletApi || typeof walletApi.sendTokens !== 'function') {
        return { success: false, error: 'Wallet bridge not available' };
      }

      const activeId = activeProfileId.value;
      if (!activeId) {
        return { success: false, error: 'No active profile selected' };
      }

      if (!address.value) {
        return { success: false, error: 'No sender address available' };
      }

      const res = await walletApi.sendTokens({
        profileId: activeId,
        from: address.value,
        to: p.recipient,
        amount: p.amount,
        denom: 'ulmn',
        memo: `Recurring: ${p.name}`
      });

      if (!res || res.ok === false) {
        return { success: false, error: res?.error || 'Transaction failed' };
      }

      return { success: true, txHash: res.txhash };
    } catch (e: any) {
      return { success: false, error: e.message || 'Unexpected error' };
    }
  };

  const success = await recurringPaymentsService.executePayment(paymentId, executeFunction);
  
  if (success) {
    showToast('Recurring payment executed successfully', 'success');
    await refreshWallet();
    if (subscriptionsRef.value?.loadData) {
      subscriptionsRef.value.loadData();
    }
  } else {
    showToast('Failed to execute recurring payment', 'error');
    if (subscriptionsRef.value?.loadData) {
      subscriptionsRef.value.loadData();
    }
  }
}

function validateAmountInput(event: Event) {
  const input = event.target as HTMLInputElement;
  let value = input.value;
  
  // Allow only numbers and single decimal point
  value = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Limit to 6 decimal places
  if (parts.length === 2 && parts[1].length > 6) {
    value = parts[0] + '.' + parts[1].slice(0, 6);
  }
  
  sendForm.value.amount = value;
  input.value = value;
}

function copyToClipboard(text: string, message: string = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message, 'success');
  }).catch((err) => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', 'error');
  });
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  toastTimeout = setTimeout(() => {
    toastVisible.value = false;
  }, 2500);
}

function openExplorer(txHash: string) {
  const explorerUrl = `https://explorer.lumen.network/tx/${txHash}`;
  window.open(explorerUrl, '_blank');
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
  if (sendingTransaction.value) return;
  
  if (!address.value) {
    showToast('No sender address available', 'error');
    return;
  }
  const from = address.value;
  const to = String(sendForm.value.recipient || '').trim();
  const amountNum = Number(sendForm.value.amount || '0');
  
  if (!to) {
    showToast('Please enter recipient address', 'error');
    return;
  }
  
  if (!(amountNum > 0)) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  if (balanceLmn.value !== null && amountNum > balanceLmn.value) {
    showToast('Insufficient balance', 'error');
    return;
  }

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
  if (!walletApi || typeof walletApi.sendTokens !== 'function') {
    showToast('Wallet send bridge not available', 'error');
    return;
  }

  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast('No active profile selected', 'error');
    return;
  }

  sendingTransaction.value = true;

  try {
    const sendPromise = walletApi.sendTokens({
      profileId: activeId,
      from,
      to,
      amount: amountNum,
      denom: 'ulmn',
      memo: ''
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Transaction timeout after 2 minutes')), 120000)
    );

    const res = await Promise.race([sendPromise, timeoutPromise]);

    if (!res || res.ok === false) {
      showToast(`Send failed: ${res?.error || 'unknown error'}`, 'error');
      return;
    }
    
    showToast(`Send successful! TxHash: ${res.txhash || 'N/A'}`, 'success');
    closeSendModal();
    
    // Clear cache to force refresh
    clearActivitiesCache();
    
    await refreshWallet();
    await refreshActivities();
  } catch (e: any) {
    showToast(e?.message || 'Unexpected error while sending transaction', 'error');
  } finally {
    sendingTransaction.value = false;
  }
}

function openReceiveModal() {
  showReceiveModal.value = true;
}

function closeReceiveModal() {
  showReceiveModal.value = false;
}

async function copyAddressWithToast() {
  if (!address.value) return;
  try {
    await navigator.clipboard.writeText(address.value);
    showToast('Address copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', 'error');
  }
}

// Address Book Functions
async function loadContacts() {
  contactsLoading.value = true;
  try {
    const result = await (window as any).lumen.addressBook.list();
    if (result.ok) {
      contacts.value = result.contacts || [];
    }
  } catch (err) {
    console.error('Failed to load contacts:', err);
  } finally {
    contactsLoading.value = false;
  }
}

function openAddContactModal() {
  editingContact.value = null;
  contactForm.value = {
    name: '',
    address: '',
    note: ''
  };
  showContactModal.value = true;
}

function closeContactModal() {
  showContactModal.value = false;
  editingContact.value = null;
  contactForm.value = {
    name: '',
    address: '',
    note: ''
  };
}

function editContact(contact: any) {
  editingContact.value = contact;
  contactForm.value = {
    name: contact.name,
    address: contact.address,
    note: contact.note || ''
  };
  showContactModal.value = true;
}

async function saveContact() {
  savingContact.value = true;
  try {
    const plainContact = {
      name: contactForm.value.name,
      address: contactForm.value.address,
      note: contactForm.value.note
    };

    if (editingContact.value) {
      const result = await (window as any).lumen.addressBook.update(
        editingContact.value.id,
        plainContact
      );
      if (result.ok) {
        showToast('Contact updated!', 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || 'Failed to update contact', 'error');
      }
    } else {
      // Add new contact
      const result = await (window as any).lumen.addressBook.add(plainContact);
      if (result.ok) {
        showToast('Contact added!', 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || 'Failed to add contact', 'error');
      }
    }
  } catch (err: any) {
    showToast(err?.message || 'Failed to save contact', 'error');
  } finally {
    savingContact.value = false;
  }
}

async function deleteContact(contact: any) {
  if (!confirm(`Delete ${contact.name}?`)) return;
  
  try {
    const result = await (window as any).lumen.addressBook.delete(contact.id);
    if (result.ok) {
      showToast('Contact deleted', 'success');
      await loadContacts();
    } else {
      showToast(result.error || 'Failed to delete contact', 'error');
    }
  } catch (err: any) {
    showToast(err?.message || 'Failed to delete contact', 'error');
  }
}

function sendToContact(contact: any) {
  sendForm.value.recipient = contact.address;
  showSendModal.value = true;
}

function selectContactForSend(contact: any) {
  sendForm.value.recipient = contact.address;
  showContactPicker.value = false;
}

function exportTransactions() {
  if (!activities.value.length) return;

  // CSV header
  const headers = ['Date', 'Time', 'Type', 'From', 'To', 'Amount (LMN)', 'Status', 'Hash'];
  
  // CSV rows
  const rows = enhancedActivities.value.map(tx => {
    const date = new Date(tx.timestamp);
    const dateStr = date.toLocaleDateString('en-US');
    const timeStr = date.toLocaleTimeString('en-US');
    const type = tx.type === 'send' ? 'Send' : 'Receive';
    const from = tx.from || address.value || '-';
    const to = tx.to || '-';
    const amount = tx.amounts && tx.amounts.length 
      ? (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6)
      : '0';
    const status = (tx.code === undefined || tx.code === 0) ? 'Success' : 'Failed';
    const hash = tx.txhash;
    
    return [dateStr, timeStr, type, from, to, amount, status, hash];
  });

  // Combine
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lumen-transactions-${address.value.slice(0, 8)}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Transactions exported!', 'success');
}
</script>

<style scoped>
.wallet-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  height: 100vh;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: 2px solid var(--border-color);
  position: relative;
  overflow: hidden;
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
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
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
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.wallet-status {
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  margin-bottom: 1.5rem;
}

.wallet-status:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
}

.wallet-status.connected {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.wallet-status.connected:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dc2626;
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.4);
}

.wallet-status.connected .status-dot {
  background: #16a34a;
  box-shadow: 0 0 8px rgba(22, 163, 74, 0.4);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #fff);
  margin: 0;
  border-radius: 0;
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
  color: var(--text-primary, #0f172a);
}

.content-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #6b7280);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: 10px;
  padding: 0.625rem 1.125rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.secondary {
  background: var(--card-bg);
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.action-btn.secondary:hover {
  background: var(--bg-secondary);
  border-color: #3b82f6;
  color: #3b82f6;
}

.action-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.action-btn.primary:hover {
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.balance-card {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 20px;
  padding: 2rem;
  color: white;
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3), 0 5px 15px rgba(59, 130, 246, 0.2);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.balance-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.balance-card::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.balance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.balance-label {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.eye-btn {
  border: none;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.eye-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: scale(1.05);
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.currency {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.amount {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.balance-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  border-radius: 16px;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
}

.quick-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.quick-btn:not(:disabled):hover::before {
  opacity: 1;
}

.quick-btn:not(:disabled):hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.quick-icon.send {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.quick-icon.receive {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.quick-icon.swap {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.quick-icon.buy {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.quick-icon.disabled {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  color: white;
  opacity: 0.6;
}

.info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.info-card {
  flex: 1;
  min-width: 260px;
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
}

.info-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 0.9rem;
  color: var(--text-primary);
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

.recurring-section {
  padding: 0;
  gap: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.header-actions-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select:hover {
  border-color: var(--primary, #3498db);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary, #3498db);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
  font-size: 0.875rem;
  min-width: 200px;
  transition: all 0.2s;
}

.search-input:hover {
  border-color: var(--primary, #3498db);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary, #3498db);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.search-input::placeholder {
  color: var(--text-tertiary, #94a3b8);
}

.empty-state {
  margin-top: 2rem;
  padding: 2rem;
  border-radius: 1rem;
  background: var(--bg-secondary, #f9fafb);
  border: 1px dashed var(--border-color, #e5e7eb);
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
  background: var(--bg-secondary, #e0f2fe);
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
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
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
  color: var(--text-primary, #0f172a);
}

.asset-symbol {
  font-size: 0.8rem;
  color: var(--text-tertiary, #6b7280);
}

.asset-balance {
  text-align: right;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #0f172a);
}

/* Transaction List */
.activities-list {
  display: flex;
  flex-direction: column;
  background: var(--card-bg, white);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 100px 140px 200px 200px 200px 90px 140px;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background: var(--bg-secondary, linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%));
  border-bottom: 2px solid var(--border-color, #e2e8f0);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.activity-row {
  display: grid;
  grid-template-columns: 100px 140px 200px 200px 200px 90px 140px;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light, #f1f5f9);
  align-items: center;
  transition: all 0.2s ease;
}

.activity-row:hover {
  background: var(--hover-bg, #f8fafc);
  border-left: 3px solid #3498db;
  padding-left: calc(1.25rem - 3px);
}

.activity-row:last-child {
  border-bottom: none;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.type-badge.send {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.type-badge.receive {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.amount-value {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

.amount-value.send {
  color: #dc2626;
}

.amount-value.receive {
  color: #16a34a;
}

.address-value,
.hash-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
}

.hash-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--text-secondary, #475569);
}

.col-hash {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.time-value {
  font-size: 0.8125rem;
  color: var(--text-primary, #0f172a);
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.time-hour {
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
  font-weight: 400;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.success {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.failed {
  background: #fee2e2;
  color: #dc2626;
}

.action-icon {
  padding: 0.375rem;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--card-bg, #ffffff);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-icon:hover {
  background: var(--hover-bg, #f8fafc);
  transform: scale(1.05);
}

.action-icon.copy-btn:hover {
  border-color: #3498db;
  color: #3498db;
}

.action-icon.explorer-btn:hover {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(15, 23, 42, 0.05);
}

.modal-header {
  padding: 1.5rem 1.5rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
}

.modal-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--card-bg, #ffffff);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--hover-bg, #f8fafc);
  border-color: var(--border-color, #cbd5e1);
  color: var(--text-secondary, #334155);
}

.modal-body {
  padding: 1.5rem;
}

.info-banner {
  background: var(--bg-secondary, #eff6ff);
  border: 1px solid var(--border-color, #bfdbfe);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-primary, #1e40af);
  line-height: 1.5;
}

.modal-desc {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #334155);
  margin-bottom: 0.5rem;
}

.required {
  color: #ef4444;
}

.input-wrapper-relative {
  position: relative;
}

.input-wrapper {
  position: relative;
}

.input-wrapper.readonly {
  opacity: 0.7;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 2px solid var(--border-color, #e2e8f0);
  font-size: 0.9375rem;
  color: var(--text-primary, #0f172a);
  background: var(--card-bg, #ffffff);
  transition: all 0.2s ease;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-input::placeholder {
  color: var(--text-tertiary, #94a3b8);
}

.form-input:read-only {
  background: var(--bg-secondary, #f8fafc);
  cursor: not-allowed;
}

.amount-input .form-input {
  padding-right: 4rem;
}

.input-suffix {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  pointer-events: none;
}

.balance-hint {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
}

.tx-summary {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  padding: 0;
  background: var(--bg-secondary, #f8fafc);
  overflow: hidden;
}

.summary-header {
  padding: 0.875rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-secondary, #475569);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9375rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-color, #f1f5f9);
  color: var(--text-secondary, #334155);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row.total {
  background: var(--bg-secondary, #f8fafc);
  border-top: 2px solid var(--border-color, #e2e8f0);
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.summary-value {
  font-weight: 600;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  color: var(--text-primary, #0f172a);
}

.summary-value.tax {
  color: #f59e0b;
}

.btn-modal-primary {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.25);
}

.btn-modal-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.35);
  transform: translateY(-1px);
}

.btn-modal-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qr-section {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.qr-wrapper {
  padding: 1.25rem;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.qr-image {
  width: 240px;
  height: 240px;
  display: block;
  border-radius: 8px;
}

.qr-placeholder {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.qr-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.qr-loading::before {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-tertiary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.address-box {
  border-radius: 12px;
  border: 2px solid var(--border-color);
  padding: 1.25rem;
  background: var(--bg-secondary);
  margin-bottom: 0;
}

.address-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.address-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9375rem;
  word-break: break-all;
  margin-bottom: 1rem;
  padding: 0.875rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  line-height: 1.6;
}

.btn-copy-address {
  width: 100%;
  border-radius: 10px;
  border: 2px solid #3b82f6;
  background: var(--card-bg);
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy-address:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: #2563eb;
  color: #2980b9;
}

.btn-copy-address:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toast Notification */
.toast-notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  font-size: 0.9rem;
  font-weight: 500;
  min-width: 280px;
}

.toast-notification.success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-notification.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  transform: translateY(100px) scale(0.8);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(50px);
  opacity: 0;
}

/* Address Book Styles */
.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.contact-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
}

.contact-card:hover {
  border-color: #3498db;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.15);
}

.contact-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 0.75rem;
}

.contact-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.contact-address {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-note {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.875rem;
  line-height: 1.5;
}

.contact-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.contact-btn {
  flex: 1;
  min-width: 70px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.contact-btn:hover {
  background: var(--hover-bg);
  border-color: #3498db;
  color: #3498db;
}

.contact-btn.send {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border-color: transparent;
}

.contact-btn.send:hover {
  background: linear-gradient(135deg, #2980b9 0%, #21618c 100%);
  color: white;
}

.contact-btn.delete:hover {
  background: #fee;
  border-color: #ef4444;
  color: #ef4444;
}

.contact-modal {
  max-width: 480px;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

.input-action-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.5rem;
  border: none;
  background: var(--hover-bg);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.input-action-btn + .input-action-btn {
  right: 3.5rem;
}

.input-action-btn:hover {
  background: #3498db;
  color: white;
}

.contact-picker {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-close {
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.picker-close:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.picker-list {
  max-height: 300px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-color);
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover {
  background: var(--hover-bg);
}

.picker-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.picker-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.picker-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-address {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}
</style>
