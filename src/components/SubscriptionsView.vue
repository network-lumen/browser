<template>
  <div class="subview margin-0-auto padding-150">
    <div class="subview-header flex-justify-space-between flex-align-start flex-wrap-wrap margin-bottom-200">
      <div>
        <h2 class="color-text-primary txt-weight-medium fs-24px">Recurring Payments & Subscriptions</h2>
        <p class="color-text-secondary margin-0 fs-14px">Manage your scheduled automatic payments</p>
      </div>
      <button class="subview-btn primary txt-weight-light txt-sm cursor-pointer outline-none flex-inline-align-center gap-50 border-none color-white" @click="showCreateModal = true">
        <Plus :size="16" />
        <span>New Payment</span>
      </button>
    </div>

    <!-- Payment Reminders -->
    <div v-if="activeReminders.length > 0" class="subview-reminders-section border-radius-12px">
      <h3 class="flex-align-center gap-50 color-text-primary fs-16px">
        <Bell :size="18" />
        <span>Upcoming Payments</span>
      </h3>
      <div class="flex flex-column gap-75">
        <div
          v-for="reminder in activeReminders"
          :key="reminder.id"
          class="subview-reminder-card flex-align-center gap-75"
        >
          <div class="subview-reminder-icon flex-0-0-auto flex-align-justify-center border-radius-circle size-40px color-warning">
            <AlertCircle :size="20" />
          </div>
          <div class="flex-1">
            <h4 class="color-text-primary fs-14px">{{ reminder.paymentName }}</h4>
            <p class="color-text-secondary margin-0 fs-13px">{{ formatAmount(reminder.amount) }} LMN · {{ formatRelativeDate(reminder.scheduledDate) }}</p>
          </div>
          <button class="subview-reminder-dismiss flex-0-0-auto bg-transparent border-none cursor-pointer color-text-tertiary" @click="dismissReminder(reminder.id)">
            <X :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Stats -->
    <div class="subview-stats-section margin-bottom-200">
      <div class="subview-stat-card flex-align-center border-radius-12px">
        <div class="subview-stat-icon active badge-success color-success flex-align-justify-center size-48px border-radius-12px">
          <PlayCircle :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary fs-24px">{{ activeCount }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase fs-14px">Active</div>
        </div>
      </div>
      <div class="subview-stat-card flex-align-center border-radius-12px">
        <div class="subview-stat-icon paused badge-warning color-warning flex-align-justify-center size-48px border-radius-12px">
          <PauseCircle :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary fs-24px">{{ pausedCount }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase fs-14px">Paused</div>
        </div>
      </div>
      <div class="subview-stat-card flex-align-center border-radius-12px">
        <div class="subview-stat-icon total flex-align-justify-center size-48px border-radius-12px">
          <DollarSign :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary fs-24px">{{ monthlyTotal }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase fs-14px">Monthly Total</div>
        </div>
      </div>
    </div>

    <!-- Payments List -->
    <div class="subview-payments-section border-radius-12px">
      <div class="subview-section-header flex-align-center-justify-space-between">
        <h3 class="color-text-primary margin-0 fs-18px">Your Recurring Payments</h3>
        <div class="subview-filters flex">
          <select v-model="filterStatus" class="subview-filter-select bg-primary color-text-primary cursor-pointer fs-14px">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select v-model="filterCategory" class="subview-filter-select bg-primary color-text-primary cursor-pointer fs-14px">
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
      <div v-if="filteredPayments.length === 0" class="subview-empty-state text-center">
        <Calendar :size="48" class="subview-empty-icon color-text-tertiary" />
        <h3 class="color-text-primary fs-18px">No Recurring Payments</h3>
        <p class="color-text-secondary">Schedule automatic payments for subscriptions, bills, and more</p>
        <button class="subview-btn primary txt-weight-light txt-sm cursor-pointer outline-none flex-inline-align-center gap-50 border-none color-white" @click="showCreateModal = true">
          <Plus :size="16" />
          <span>Create Your First Payment</span>
        </button>
      </div>

      <!-- Payments Grid -->
      <div v-else class="subview-payments-grid">
        <div
          v-for="payment in filteredPayments"
          :key="payment.id"
          class="subview-payment-card border-radius-12px"
          :class="payment.status"
        >
          <div class="subview-payment-header flex-align-start flex-justify-space-between">
            <div>
              <h4 class="color-text-primary fs-16px">{{ payment.name }}</h4>
              <span class="subview-payment-category color-text-secondary fs-11px fw-500 text-capitalize" v-if="payment.category">
                {{ payment.category }}
              </span>
            </div>
            <div
              class="subview-payment-status border-radius-12px fs-12px txt-weight-light text-uppercase"
              :class="[payment.status, { 'badge-success': payment.status === 'active', 'badge-warning': payment.status === 'paused' }]"
            >
              {{ payment.status }}
            </div>
          </div>

          <div class="subview-payment-amount color-text-primary fs-24px">
            {{ formatAmount(payment.amount) }} LMN
            <span class="subview-frequency color-text-secondary fs-14px txt-weight-normal">{{ getFrequencyLabel(payment.frequency) }}</span>
          </div>

          <div class="subview-payment-details">
            <div class="subview-detail-row flex-align-center-justify-space-between fs-13px">
              <span class="color-text-secondary">Next Payment:</span>
              <span class="subview-detail-value color-text-primary fw-500">{{ formatDate(payment.nextPaymentDate) }}</span>
            </div>
            <div class="subview-detail-row flex-align-center-justify-space-between fs-13px">
              <span class="color-text-secondary">Recipient:</span>
              <span class="subview-detail-value color-text-primary mono fs-12px fw-500">{{ formatAddress(payment.recipient) }}</span>
            </div>
            <div class="subview-detail-row flex-align-center-justify-space-between fs-13px">
              <span class="color-text-secondary">Success Rate:</span>
              <span class="subview-detail-value color-text-primary fw-500">
                {{ payment.totalPayments > 0
                  ? Math.round((payment.successfulPayments / payment.totalPayments) * 100)
                  : 0 }}%
                ({{ payment.successfulPayments }}/{{ payment.totalPayments }})
              </span>
            </div>
          </div>

          <div class="subview-payment-actions flex">
            <button
              class="subview-action-btn flex-1 flex-align-justify-center cursor-pointer border-none color-text-secondary"
              @click="viewHistory(payment)"
              title="View History"
            >
              <History :size="16" />
            </button>
            <button
              class="subview-action-btn flex-1 flex-align-justify-center cursor-pointer border-none color-text-secondary"
              @click="editPayment(payment)"
              title="Edit"
            >
              <Edit :size="16" />
            </button>
            <button
              v-if="payment.status === 'active'"
              class="subview-action-btn pause flex-1 flex-align-justify-center cursor-pointer border-none color-text-secondary"
              @click="pausePayment(payment.id)"
              title="Pause"
            >
              <PauseCircle :size="16" />
            </button>
            <button
              v-else-if="payment.status === 'paused'"
              class="subview-action-btn resume flex-1 flex-align-justify-center cursor-pointer border-none color-text-secondary"
              @click="resumePayment(payment.id)"
              title="Resume"
            >
              <PlayCircle :size="16" />
            </button>
            <button
              class="subview-action-btn delete flex-1 flex-align-justify-center cursor-pointer border-none color-text-secondary"
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
      <div v-if="showHistoryModal" class="subview-modal-overlay overlay-scrim z-9999 backdrop-blur-4px" @click="showHistoryModal = false">
        <div class="subview-modal-content bg-card w-full flex flex-column overflow-hidden border-radius-12px" @click.stop>
          <div class="subview-modal-header flex-align-center-justify-space-between">
            <h3 class="flex-align-center gap-50 color-text-primary margin-0 fs-18px">
              <History :size="20" />
              <span>Payment History</span>
            </h3>
            <button class="subview-close-btn bg-transparent border-none cursor-pointer color-text-secondary" @click="showHistoryModal = false">
              <X :size="20" />
            </button>
          </div>
          <div class="subview-modal-body flex-1 overflow-y-auto">
            <div v-if="selectedPaymentHistory.length === 0" class="subview-empty-state small text-center">
              <p class="color-text-secondary">No payment history yet</p>
            </div>
            <div v-else class="flex flex-column gap-75">
              <div
                v-for="record in selectedPaymentHistory"
                :key="record.id"
                class="subview-history-item flex gap-75"
                :class="record.status"
              >
                <div
                  class="subview-history-icon flex-0-0-auto flex-align-justify-center border-radius-circle size-32px"
                  :class="[record.status, { 'badge-success': record.status === 'success', 'badge-error': record.status === 'failed', 'badge-warning': record.status === 'pending' }]"
                >
                  <Check v-if="record.status === 'success'" :size="16" />
                  <X v-else-if="record.status === 'failed'" :size="16" />
                  <Clock v-else :size="16" />
                </div>
                <div class="flex-1">
                  <div class="subview-history-header flex-align-center-justify-space-between">
                    <strong class="color-text-primary">{{ formatAmount(record.amount) }} LMN</strong>
                    <span class="subview-history-status color-text-secondary fs-12px txt-weight-light text-uppercase">{{ record.status }}</span>
                  </div>
                  <div class="subview-history-date color-text-secondary fs-13px">{{ formatDateTime(record.executedAt) }}</div>
                  <div v-if="record.txHash" class="subview-history-tx color-text-secondary mono fs-12px">
                    <span>TxHash: {{ record.txHash.slice(0, 16) }}...</span>
                  </div>
                  <div v-if="record.error" class="subview-history-error fs-12px color-error">{{ record.error }}</div>
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


