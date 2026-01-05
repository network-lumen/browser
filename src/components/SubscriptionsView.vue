<template>
  <div class="subscriptions-view">
    <div class="view-header">
      <div>
        <h2>Recurring Payments & Subscriptions</h2>
        <p>Manage your scheduled automatic payments</p>
      </div>
      <button class="btn primary" @click="showCreateModal = true">
        <Plus :size="16" />
        <span>New Payment</span>
      </button>
    </div>

    <!-- Payment Reminders -->
    <div v-if="activeReminders.length > 0" class="reminders-section">
      <h3>
        <Bell :size="18" />
        <span>Upcoming Payments</span>
      </h3>
      <div class="reminders-list">
        <div 
          v-for="reminder in activeReminders" 
          :key="reminder.id"
          class="reminder-card"
        >
          <div class="reminder-icon">
            <AlertCircle :size="20" />
          </div>
          <div class="reminder-content">
            <h4>{{ reminder.paymentName }}</h4>
            <p>{{ formatAmount(reminder.amount) }} LMN · {{ formatRelativeDate(reminder.scheduledDate) }}</p>
          </div>
          <button class="reminder-dismiss" @click="dismissReminder(reminder.id)">
            <X :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Stats -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-icon active">
          <PlayCircle :size="20" />
        </div>
        <div>
          <div class="stat-value">{{ activeCount }}</div>
          <div class="stat-label">Active</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon paused">
          <PauseCircle :size="20" />
        </div>
        <div>
          <div class="stat-value">{{ pausedCount }}</div>
          <div class="stat-label">Paused</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon total">
          <DollarSign :size="20" />
        </div>
        <div>
          <div class="stat-value">{{ monthlyTotal }}</div>
          <div class="stat-label">Monthly Total</div>
        </div>
      </div>
    </div>

    <!-- Payments List -->
    <div class="payments-section">
      <div class="section-header">
        <h3>Your Recurring Payments</h3>
        <div class="filters">
          <select v-model="filterStatus" class="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select v-model="filterCategory" class="filter-select">
            <option value="all">All Categories</option>
            <option value="subscription">Subscriptions</option>
            <option value="bill">Bills</option>
            <option value="donation">Donations</option>
            <option value="rent">Rent</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredPayments.length === 0" class="empty-state">
        <Calendar :size="48" class="empty-icon" />
        <h3>No Recurring Payments</h3>
        <p>Schedule automatic payments for subscriptions, bills, and more</p>
        <button class="btn primary" @click="showCreateModal = true">
          <Plus :size="16" />
          <span>Create Your First Payment</span>
        </button>
      </div>

      <!-- Payments Grid -->
      <div v-else class="payments-grid">
        <div 
          v-for="payment in filteredPayments" 
          :key="payment.id"
          class="payment-card"
          :class="payment.status"
        >
          <div class="payment-header">
            <div>
              <h4>{{ payment.name }}</h4>
              <span class="payment-category" v-if="payment.category">
                {{ payment.category }}
              </span>
            </div>
            <div class="payment-status" :class="payment.status">
              {{ payment.status }}
            </div>
          </div>

          <div class="payment-amount">
            {{ formatAmount(payment.amount) }} LMN
            <span class="frequency">{{ getFrequencyLabel(payment.frequency) }}</span>
          </div>

          <div class="payment-details">
            <div class="detail-row">
              <span class="detail-label">Next Payment:</span>
              <span class="detail-value">{{ formatDate(payment.nextPaymentDate) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Recipient:</span>
              <span class="detail-value mono">{{ formatAddress(payment.recipient) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Success Rate:</span>
              <span class="detail-value">
                {{ payment.totalPayments > 0 
                  ? Math.round((payment.successfulPayments / payment.totalPayments) * 100) 
                  : 0 }}%
                ({{ payment.successfulPayments }}/{{ payment.totalPayments }})
              </span>
            </div>
          </div>

          <div class="payment-actions">
            <button 
              class="action-btn" 
              @click="viewHistory(payment)"
              title="View History"
            >
              <History :size="16" />
            </button>
            <button 
              class="action-btn" 
              @click="editPayment(payment)"
              title="Edit"
            >
              <Edit :size="16" />
            </button>
            <button 
              v-if="payment.status === 'active'"
              class="action-btn pause" 
              @click="pausePayment(payment.id)"
              title="Pause"
            >
              <PauseCircle :size="16" />
            </button>
            <button 
              v-else-if="payment.status === 'paused'"
              class="action-btn resume" 
              @click="resumePayment(payment.id)"
              title="Resume"
            >
              <PlayCircle :size="16" />
            </button>
            <button 
              class="action-btn delete" 
              @click="confirmDelete(payment)"
              title="Delete"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <RecurringPaymentModal
      v-if="showCreateModal || editingPayment"
      :payment="editingPayment ?? undefined"
      @close="closeModal"
      @save="savePayment"
      @scan-address="handleScanAddress"
    />

    <!-- Payment History Modal -->
    <Transition name="fade">
      <div v-if="showHistoryModal" class="modal-overlay" @click="showHistoryModal = false">
        <div class="modal-content history-modal" @click.stop>
          <div class="modal-header">
            <h3>
              <History :size="20" />
              <span>Payment History</span>
            </h3>
            <button class="close-btn" @click="showHistoryModal = false">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <div v-if="selectedPaymentHistory.length === 0" class="empty-state small">
              <p>No payment history yet</p>
            </div>
            <div v-else class="history-list">
              <div 
                v-for="record in selectedPaymentHistory" 
                :key="record.id"
                class="history-item"
                :class="record.status"
              >
                <div class="history-icon" :class="record.status">
                  <Check v-if="record.status === 'success'" :size="16" />
                  <X v-else-if="record.status === 'failed'" :size="16" />
                  <Clock v-else :size="16" />
                </div>
                <div class="history-content">
                  <div class="history-header">
                    <strong>{{ formatAmount(record.amount) }} LMN</strong>
                    <span class="history-status">{{ record.status }}</span>
                  </div>
                  <div class="history-date">{{ formatDateTime(record.executedAt) }}</div>
                  <div v-if="record.txHash" class="history-tx">
                    <span>TxHash: {{ record.txHash.slice(0, 16) }}...</span>
                  </div>
                  <div v-if="record.error" class="history-error">{{ record.error }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- QR Scanner -->
    <QrScanner 
      v-if="showScanner"
      @close="showScanner = false"
      @scan="handleQrScan"
      title="Scan Recipient Address"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  Calendar, Plus, Bell, AlertCircle, X, PlayCircle, PauseCircle, 
  DollarSign, Edit, Trash2, History, Check, Clock
} from 'lucide-vue-next';
import RecurringPaymentModal from './RecurringPaymentModal.vue';
import QrScanner from './QrScanner.vue';
import { getRecurringPaymentsService, type RecurringPayment, type PaymentHistory, type PaymentReminder } from '../internal/services/recurringPayments';

const emit = defineEmits<{
  (e: 'execute-payment', paymentId: string): void;
  (e: 'toast', message: string, type: 'success' | 'error'): void;
}>();

const service = getRecurringPaymentsService();

const payments = ref<RecurringPayment[]>([]);
const activeReminders = ref<any[]>([]);
const showCreateModal = ref(false);
const editingPayment = ref<RecurringPayment | null>(null);
const showHistoryModal = ref(false);
const selectedPaymentHistory = ref<PaymentHistory[]>([]);
const showScanner = ref(false);
const modalRef = ref<any>(null);

const filterStatus = ref<string>('all');
const filterCategory = ref<string>('all');

onMounted(() => {
  loadData();
});

function loadData() {
  payments.value = service.getRecurringPayments();
  activeReminders.value = service.getReminders();
}

const filteredPayments = computed(() => {
  let filtered = payments.value;

  if (filterStatus.value !== 'all') {
    filtered = filtered.filter(p => p.status === filterStatus.value);
  }

  if (filterCategory.value !== 'all') {
    filtered = filtered.filter(p => p.category === filterCategory.value);
  }

  return filtered.sort((a, b) => 
    a.nextPaymentDate.getTime() - b.nextPaymentDate.getTime()
  );
});

const activeCount = computed(() => 
  payments.value.filter(p => p.status === 'active').length
);

const pausedCount = computed(() => 
  payments.value.filter(p => p.status === 'paused').length
);

const monthlyTotal = computed(() => {
  const total = payments.value
    .filter(p => p.status === 'active')
    .reduce((sum, p) => {
      const multiplier = p.frequency === 'monthly' ? 1 :
        p.frequency === 'weekly' ? 4 :
        p.frequency === 'biweekly' ? 2 :
        p.frequency === 'quarterly' ? 0.33 :
        p.frequency === 'yearly' ? 0.08 :
        p.frequency === 'daily' ? 30 : 1;
      return sum + (p.amount * multiplier);
    }, 0);
  return total.toFixed(2) + ' LMN';
});

function savePayment(data: any) {
  try {
    if (editingPayment.value) {
      const nextPaymentDate = service.calculateNextPaymentDate(
        data.startDate,
        data.frequency
      );
      service.updateRecurringPayment(editingPayment.value.id, {
        ...data,
        nextPaymentDate,
      });
      emit('toast', 'Payment updated successfully', 'success');
    } else {
      const nextPaymentDate = service.calculateNextPaymentDate(
        data.startDate,
        data.frequency
      );
      service.createRecurringPayment({
        ...data,
        nextPaymentDate,
        lastPaymentDate: undefined,
        status: 'active',
      });
      emit('toast', 'Payment scheduled successfully', 'success');
    }
    loadData();
    closeModal();
  } catch (e: any) {
    emit('toast', e.message || 'Failed to save payment', 'error');
  }
}

function editPayment(payment: RecurringPayment) {
  editingPayment.value = payment;
}

function pausePayment(id: string) {
  service.pauseRecurringPayment(id);
  loadData();
  emit('toast', 'Payment paused', 'success');
}

function resumePayment(id: string) {
  service.resumeRecurringPayment(id);
  loadData();
  emit('toast', 'Payment resumed', 'success');
}

function confirmDelete(payment: RecurringPayment) {
  if (confirm(`Are you sure you want to delete "${payment.name}"?`)) {
    service.deleteRecurringPayment(payment.id);
    loadData();
    emit('toast', 'Payment deleted', 'success');
  }
}

function viewHistory(payment: RecurringPayment) {
  selectedPaymentHistory.value = service.getPaymentHistory(payment.id);
  showHistoryModal.value = true;
}

function dismissReminder(id: string) {
  service.dismissReminder(id);
  loadData();
}

function closeModal() {
  showCreateModal.value = false;
  editingPayment.value = null;
}

function handleScanAddress() {
  showScanner.value = true;
}

function handleQrScan(data: { type: string; content: string; raw: string }) {
  showScanner.value = false;
  if (modalRef.value?.setRecipient) {
    modalRef.value.setRecipient(data.content);
  }
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    daily: '/ day',
    weekly: '/ week',
    biweekly: '/ 2 weeks',
    monthly: '/ month',
    quarterly: '/ quarter',
    yearly: '/ year',
  };
  return labels[frequency] || '';
}

function formatAmount(amount: number): string {
  return amount.toFixed(6).replace(/\.?0+$/, '');
}

function formatAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `in ${days} days`;
  return formatDate(date);
}

defineExpose({
  loadData
});
</script>

<style scoped>
.subscriptions-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 32px;
}

.view-header h2 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.view-header p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.reminders-section {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.reminders-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #92400e;
}

.reminders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  padding: 12px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.reminder-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d97706;
}

.reminder-content {
  flex: 1;
}

.reminder-content h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.reminder-content p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.reminder-dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #9ca3af;
  border-radius: 4px;
  transition: all 0.2s;
}

.reminder-dismiss:hover {
  background: #f3f4f6;
  color: #111827;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.active {
  background: #dcfce7;
  color: #16a34a;
}

.stat-icon.paused {
  background: #fef3c7;
  color: #d97706;
}

.stat-icon.total {
  background: #dbeafe;
  color: #2563eb;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.payments-section {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.filters {
  display: flex;
  gap: 12px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-state.small {
  padding: 40px 20px;
}

.empty-icon {
  color: #9ca3af;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.empty-state p {
  margin: 0 0 24px 0;
  color: #6b7280;
}

.payments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.payment-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.payment-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.payment-card.paused {
  opacity: 0.7;
  background: #f9fafb;
}

.payment-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.payment-header h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.payment-category {
  display: inline-block;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  text-transform: capitalize;
}

.payment-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.payment-status.active {
  background: #dcfce7;
  color: #16a34a;
}

.payment-status.paused {
  background: #fef3c7;
  color: #d97706;
}

.payment-status.completed {
  background: #e0e7ff;
  color: #6366f1;
}

.payment-amount {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16px;
}

.frequency {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
  margin-left: 8px;
}

.payment-details {
  margin-bottom: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.detail-label {
  color: #6b7280;
}

.detail-value {
  color: #111827;
  font-weight: 500;
}

.mono {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}

.payment-actions {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  flex: 1;
  padding: 8px;
  background: #f3f4f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.action-btn.pause:hover {
  background: #fef3c7;
  color: #d97706;
}

.action-btn.resume:hover {
  background: #dcfce7;
  color: #16a34a;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn.primary {
  background: #3b82f6;
  color: white;
}

.btn.primary:hover {
  background: #2563eb;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.history-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-icon.success {
  background: #dcfce7;
  color: #16a34a;
}

.history-icon.failed {
  background: #fee2e2;
  color: #dc2626;
}

.history-icon.pending {
  background: #fef3c7;
  color: #d97706;
}

.history-content {
  flex: 1;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.history-status {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
}

.history-date {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.history-tx {
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #6b7280;
}

.history-error {
  font-size: 12px;
  color: #dc2626;
  margin-top: 4px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    gap: 16px;
  }

  .payments-grid {
    grid-template-columns: 1fr;
  }

  .filters {
    flex-direction: column;
    width: 100%;
  }

  .filter-select {
    width: 100%;
  }
}
</style>
