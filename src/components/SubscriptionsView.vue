<template>
  <div class="subview my-0px mx-auto p-24px max-w-1200px">
    <!-- Payment Reminders -->
    <div v-if="activeReminders.length > 0" class="subview-reminders-section border-radius-12px p-20px mb-24px bg-ios-orange-a15">
      <h3 class="flex-align-center gap-8px color-text-primary text-16px subview-reminders-section-h3 m-0px mb-16px">
        <Bell :size="18" />
        <span>Upcoming Payments</span>
      </h3>
      <div class="flex flex-column gap-12px">
        <div
          v-for="reminder in activeReminders"
          :key="reminder.id"
          class="subview-reminder-card flex-align-center gap-12px bg-card p-12px border-radius-8px shadow-sm"
        >
          <div class="subview-reminder-icon flex-0-0-auto flex-align-justify-center border-radius-circle size-40px color-warning bg-ios-orange-a15">
            <AlertCircle :size="20" />
          </div>
          <div class="flex-1">
            <h4 class="color-text-primary text-14px">{{ reminder.paymentName }}</h4>
            <p class="color-text-secondary m-0px text-13px">{{ formatAmount(reminder.amount) }} LMN · {{ formatRelativeDate(reminder.scheduledDate) }}</p>
          </div>
          <UiButton variant="primary" @click="dismissReminder(reminder.id)" class="subview-reminder-dismiss">
            <X :size="16" />
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Filter and Stats -->
    <div class="subview-stats-section mb-32px grid gap-16px">
      <UiCard class="flex-align-center gap-16px" radius="12px" padding-class="p-20px" border-class="border-1" :shadow="false">
        <div class="subview-stat-icon active badge-success color-success flex-align-justify-center size-48px border-radius-12px">
          <PlayCircle :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary text-24px">{{ activeCount }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase text-14px">Active</div>
        </div>
      </UiCard>
      <UiCard class="flex-align-center gap-16px" radius="12px" padding-class="p-20px" border-class="border-1" :shadow="false">
        <div class="subview-stat-icon paused badge-warning color-warning flex-align-justify-center size-48px border-radius-12px bg-ios-orange-a15">
          <PauseCircle :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary text-24px">{{ pausedCount }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase text-14px">Paused</div>
        </div>
      </UiCard>
      <UiCard class="flex-align-center gap-16px" radius="12px" padding-class="p-20px" border-class="border-1" :shadow="false">
        <div class="subview-stat-icon total flex-align-justify-center size-48px border-radius-12px color-accent-secondary bg-fill-blue">
          <DollarSign :size="20" />
        </div>
        <div>
          <div class="subview-stat-value txt-weight-medium color-text-primary text-24px">{{ monthlyTotal }}</div>
          <div class="subview-stat-label color-text-tertiary text-uppercase text-14px">Monthly Total</div>
        </div>
      </UiCard>
    </div>

    <!-- Payments List -->
    <UiCard radius="12px" border-class="border-1" padding="lg" :shadow="false">
      <div class="subview-section-header flex-align-center-justify-space-between mb-24px">
        <h3 class="color-text-primary m-0px text-18px">Your Recurring Payments</h3>
        <div class="subview-filters flex gap-12px">
          <select v-model="filterStatus" class="subview-filter-select bg-primary color-text-primary cursor-pointer text-14px border-1 border-radius-6px py-8px px-12px">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select v-model="filterCategory" class="subview-filter-select bg-primary color-text-primary cursor-pointer text-14px border-1 border-radius-6px py-8px px-12px">
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
      <UiEmptyState v-if="filteredPayments.length === 0" title="No Recurring Payments" description="Schedule automatic payments for subscriptions, bills, and more">
        <Calendar :size="48" />
        <template #actions>
          <UiButton variant="primary" @click="showCreateModal = true" class="outline-none">
            <Plus :size="16" />
            <span>Create Your First Payment</span>
          </UiButton>
        </template>
      </UiEmptyState>

      <!-- Payments Grid -->
      <div v-else class="subview-payments-grid grid gap-16px">
        <UiCard
          v-for="payment in filteredPayments"
          :key="payment.id"
          class="subview-payment-card transition-all-02 hover-border-accent hover-shadow-primary-a15"
          :class="payment.status"
          radius="12px"
          border-class="border-2"
          padding-class="p-20px"
          :shadow="false"
        >
          <div class="subview-payment-header flex-align-start flex-justify-space-between mb-12px">
            <div>
              <h4 class="color-text-primary text-16px">{{ payment.name }}</h4>
              <span class="subview-payment-category color-text-secondary text-11px fw-500 text-capitalize inline-block bg-tertiary border-radius-4px py-0px px-8px" v-if="payment.category">
                {{ payment.category }}
              </span>
            </div>
            <div
              class="subview-payment-status border-radius-12px text-12px txt-weight-light text-uppercase py-4px px-12px"
              :class="[payment.status, { 'badge-success': payment.status === 'active', 'badge-warning': payment.status === 'paused' }]"
            >
              {{ payment.status }}
            </div>
          </div>

          <div class="subview-payment-amount color-text-primary text-24px mb-16px">
            {{ formatAmount(payment.amount) }} LMN
            <span class="subview-frequency color-text-secondary text-14px txt-weight-normal ml-8px">{{ getFrequencyLabel(payment.frequency) }}</span>
          </div>

          <div class="subview-payment-details mb-16px">
            <div class="subview-detail-row flex-align-center-justify-space-between text-13px py-6px px-0px">
              <span class="color-text-secondary">Next Payment:</span>
              <span class="subview-detail-value color-text-primary fw-500">{{ formatDate(payment.nextPaymentDate) }}</span>
            </div>
            <div class="subview-detail-row flex-align-center-justify-space-between text-13px py-6px px-0px">
              <span class="color-text-secondary">Recipient:</span>
              <span class="subview-detail-value color-text-primary mono text-12px fw-500">{{ formatAddress(payment.recipient) }}</span>
            </div>
            <div class="subview-detail-row flex-align-center-justify-space-between text-13px py-6px px-0px">
              <span class="color-text-secondary">Success Rate:</span>
              <span class="subview-detail-value color-text-primary fw-500">
                {{ payment.totalPayments > 0
                  ? Math.round((payment.successfulPayments / payment.totalPayments) * 100)
                  : 0 }}%
                ({{ payment.successfulPayments }}/{{ payment.totalPayments }})
              </span>
            </div>
          </div>

          <div class="subview-payment-actions flex gap-8px pt-16px border-top-1">
            <UiButton variant="secondary" @click="viewHistory(payment)"
              title="View History" class="subview-action-btn">
              <History :size="16" />
            </UiButton>
            <UiButton variant="secondary" @click="editPayment(payment)"
              title="Edit" class="subview-action-btn">
              <Edit :size="16" />
            </UiButton>
            <UiButton variant="secondary" v-if="payment.status === 'active'"
             
              @click="pausePayment(payment.id)"
              title="Pause" class="subview-action-btn pause background-ios-orange-a15-hover">
              <PauseCircle :size="16" />
            </UiButton>
            <UiButton variant="secondary" v-else-if="payment.status === 'paused'"
             
              @click="resumePayment(payment.id)"
              title="Resume" class="subview-action-btn resume background-fill-success-hover">
              <PlayCircle :size="16" />
            </UiButton>
            <UiButton variant="secondary" @click="confirmDelete(payment)"
              title="Delete" class="subview-action-btn delete background-fill-error-hover">
              <Trash2 :size="16" />
            </UiButton>
          </div>
        </UiCard>
      </div>
    </UiCard>

    <!-- Create/Edit Modal -->
    <RecurringPaymentModal
      v-if="showCreateModal || editingPayment"
      :payment="editingPayment ?? undefined"
      @close="closeModal"
      @save="savePayment"
      @scan-address="handleScanAddress"
    />

    <!-- Payment History Modal -->
    <UiModal :model-value="showHistoryModal" panel-class="w-full max-w-500px" @update:model-value="showHistoryModal = false">
      <template #header>
        <h3 class="flex-align-center gap-8px color-text-primary m-0px text-18px">
          <History :size="20" />
          <span>Payment History</span>
        </h3>
      </template>
            <UiEmptyState v-if="selectedPaymentHistory.length === 0" description="No payment history yet" />
            <div v-else class="flex flex-column gap-12px">
              <div
                v-for="record in selectedPaymentHistory"
                :key="record.id"
                class="subview-history-item flex gap-12px p-12px bg-secondary border-radius-8px"
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
                  <div class="subview-history-header flex-align-center-justify-space-between mb-4px">
                    <strong class="color-text-primary">{{ formatAmount(record.amount) }} LMN</strong>
                    <span class="subview-history-status color-text-secondary text-12px txt-weight-light text-uppercase border-radius-4px bg-fill-tertiary py-0px px-8px">{{ record.status }}</span>
                  </div>
                  <div class="subview-history-date color-text-secondary text-13px mb-4px">{{ formatDateTime(record.executedAt) }}</div>
                  <div v-if="record.txHash" class="subview-history-tx color-text-secondary mono text-12px">
                    <span>TxHash: {{ record.txHash.slice(0, 16) }}...</span>
                  </div>
                  <div v-if="record.error" class="subview-history-error text-12px color-error mt-4px">{{ record.error }}</div>
                </div>
              </div>
            </div>
    </UiModal>

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
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiCard from '../ui/UiCard.vue';
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
  loadData,
  openCreateModal: () => { showCreateModal.value = true; }
});
</script>


