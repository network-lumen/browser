<template>
  <div class="my-0px mx-auto p-24px max-w-1200px">
    <!-- Payment Reminders -->
    <div v-if="activeReminders.length > 0" class="border-radius-12px p-20px mb-24px bg-warning-a15">
      <h3 class="flex-align-center gap-8px color-text-primary text-16px m-0px mb-16px">
        <Bell :size="18" />
        <span>Due soon</span>
      </h3>
      <div class="flex flex-column gap-12px">
        <div
          v-for="reminder in activeReminders"
          :key="reminder.id"
          class="flex-align-center gap-12px bg-card p-12px border-radius-8px shadow-sm"
        >
          <UiIconBadge badge-class="color-warning bg-warning-a15">
            <AlertCircle :size="20" />
          </UiIconBadge>
          <div class="flex-1">
            <h4 class="color-text-primary text-14px m-0px mb-4px">{{ reminder.paymentName }}</h4>
            <p class="color-text-secondary m-0px text-13px">{{ formatAmount(reminder.amount) }} LMN · {{ formatRelativeDate(reminder.scheduledDate) }}</p>
          </div>
          <UiButton variant="primary" @click="dismissReminder(reminder.id)">
            <X :size="16" />
          </UiButton>
        </div>
      </div>
    </div>

    <!-- Filter and Stats -->
    <div class="mb-32px grid gap-16px grid-cols-auto-fit-200">
      <UiStatIconTile label="Active" :value="activeCount" icon-class="bg-fill-success color-success">
        <template #icon><PlayCircle :size="20" /></template>
      </UiStatIconTile>
      <UiStatIconTile label="Paused" :value="pausedCount" icon-class="bg-warning-a15 color-warning">
        <template #icon><PauseCircle :size="20" /></template>
      </UiStatIconTile>
      <UiStatIconTile label="Monthly Total" :value="monthlyTotal" icon-class="color-accent-secondary bg-fill-blue">
        <template #icon><DollarSign :size="20" /></template>
      </UiStatIconTile>
    </div>

    <!-- Payments List -->
    <UiCard radius="12px" border-class="border-1" padding="lg" :shadow="false">
      <div class="flex-align-center-justify-space-between mb-24px">
        <h3 class="color-text-primary m-0px text-18px">Your reminders</h3>
        <div class="flex gap-12px">
          <select v-model="filterStatus" class="bg-primary color-text-primary cursor-pointer text-14px border-1 border-radius-6px py-8px px-12px">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <select v-model="filterCategory" class="bg-primary color-text-primary cursor-pointer text-14px border-1 border-radius-6px py-8px px-12px">
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
      <UiEmptyState v-if="filteredPayments.length === 0" title="No payment reminders" description="Keep track of subscriptions, bills and regular transfers. Lumen reminds you when one is due - it does not send it for you.">
        <Calendar :size="48" />
        <template #actions>
          <UiButton variant="primary" @click="showCreateModal = true" class="outline-none">
            <Plus :size="16" />
            <span>Create your first reminder</span>
          </UiButton>
        </template>
      </UiEmptyState>

      <!-- Payments Grid -->
      <div v-else class="grid gap-16px grid-cols-auto-fill-320">
        <UiCard
          v-for="payment in filteredPayments"
          :key="payment.id"
          class="transition-all-02 hover-border-accent hover-shadow-primary"
          :style="paymentCardStyle(payment.status)"
          radius="12px"
          border-class="border-2"
          padding-class="p-20px"
          :shadow="false"
        >
          <div class="flex-align-start flex-justify-space-between mb-12px">
            <div>
              <h4 class="color-text-primary text-16px m-0px mb-4px">{{ payment.name }}</h4>
              <span class="color-text-secondary text-11px fw-500 text-capitalize inline-block bg-primary border-radius-4px py-0px px-8px" v-if="payment.category">
                {{ payment.category }}
              </span>
            </div>
            <div
              class="border-radius-12px text-12px txt-weight-light text-uppercase py-4px px-12px"
              :class="{ 'bg-fill-success': payment.status === 'active', 'bg-warning-a15': payment.status === 'paused' }"
              :style="paymentStatusStyle(payment.status)"
            >
              {{ payment.status }}
            </div>
          </div>

          <div class="color-text-primary text-24px mb-16px">
            {{ formatAmount(payment.amount) }} LMN
            <span class="color-text-secondary text-14px txt-weight-normal ml-8px">{{ getFrequencyLabel(payment.frequency) }}</span>
          </div>

          <div class="mb-16px">
            <UiDetailRow variant="compact" label="Next due:" :value="formatDate(payment.nextPaymentDate)" />
            <UiDetailRow variant="compact" label="Recipient:" :value="formatAddress(payment.recipient)" value-class="color-text-primary mono text-12px fw-500" />
            <UiDetailRow variant="compact" label="Sent so far:" :value="String(payment.successfulPayments)" />
          </div>

          <div class="flex gap-8px pt-16px border-top-1">
            <UiButton variant="primary" v-if="payment.status === 'active' && isDue(payment)"
              @click="payNow(payment)"
              title="Send this payment now">
              <span>Pay now</span>
            </UiButton>
            <UiButton variant="secondary" @click="viewHistory(payment)"
              title="View History">
              <History :size="16" />
            </UiButton>
            <UiButton variant="secondary" @click="editPayment(payment)"
              title="Edit">
              <Edit :size="16" />
            </UiButton>
            <UiButton variant="secondary" v-if="payment.status === 'active'"
              @click="pausePayment(payment.id)"
              title="Pause" class="hover-bg-warning-a15">
              <PauseCircle :size="16" />
            </UiButton>
            <UiButton variant="secondary" v-else-if="payment.status === 'paused'"
              @click="resumePayment(payment.id)"
              title="Resume" class="hover-bg-fill-success">
              <PlayCircle :size="16" />
            </UiButton>
            <UiButton variant="secondary" @click="confirmDelete(payment)"
              title="Delete" class="hover-bg-fill-error">
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
                class="flex gap-12px p-12px bg-secondary border-radius-8px"
                :class="record.status"
              >
                <UiIconBadge
                  size-class="size-32px"
                  :badge-class="[record.status, { 'bg-fill-success': record.status === 'success', 'bg-fill-error': record.status === 'failed', 'bg-warning-a15': record.status === 'pending' }]"
                >
                  <Check v-if="record.status === 'success'" :size="16" />
                  <X v-else-if="record.status === 'failed'" :size="16" />
                  <Clock v-else :size="16" />
                </UiIconBadge>
                <div class="flex-1">
                  <div class="flex-align-center-justify-space-between mb-4px">
                    <strong class="color-text-primary">{{ formatAmount(record.amount) }} LMN</strong>
                    <span class="color-text-secondary text-12px txt-weight-light text-uppercase border-radius-4px bg-fill-tertiary py-0px px-8px">{{ record.status }}</span>
                  </div>
                  <div class="color-text-secondary text-13px mb-4px">{{ formatDateTime(record.executedAt) }}</div>
                  <div v-if="record.txHash" class="color-text-secondary mono text-12px">
                    <span>TxHash: {{ record.txHash.slice(0, 16) }}...</span>
                  </div>
                  <div v-if="record.error" class="text-12px color-error mt-4px">{{ record.error }}</div>
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
import UiStatIconTile from '../ui/UiStatIconTile.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiIconBadge from '../ui/UiIconBadge.vue';
import { ref, computed, onMounted } from 'vue';
import { 
  Calendar, Plus, Bell, AlertCircle, X, PlayCircle, PauseCircle, 
  DollarSign, Edit, Trash2, History, Check, Clock
} from 'lucide-vue-next';
import RecurringPaymentModal from './RecurringPaymentModal.vue';
import QrScanner from './QrScanner.vue';
import { getRecurringPaymentsService, type RecurringPayment, type PaymentHistory } from '../internal/services/recurringPayments';
import { formatDate, formatDateTime, formatDecimal, truncateMiddle } from '../internal/services/format';

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
      emit('toast', 'Reminder updated', 'success');
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
      emit('toast', 'Reminder saved', 'success');
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
  emit('toast', 'Reminder paused', 'success');
}

function resumePayment(id: string) {
  service.resumeRecurringPayment(id);
  loadData();
  emit('toast', 'Reminder resumed', 'success');
}

function confirmDelete(payment: RecurringPayment) {
  if (confirm(`Are you sure you want to delete "${payment.name}"?`)) {
    service.deleteRecurringPayment(payment.id);
    loadData();
    emit('toast', 'Reminder deleted', 'success');
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

/** A reminder whose date has passed can be sent from here. */
function isDue(payment: RecurringPayment): boolean {
  return new Date(payment.nextPaymentDate).getTime() <= Date.now();
}

function payNow(payment: RecurringPayment) {
  const amount = formatAmount(payment.amount);
  const recipient = formatAddress(payment.recipient);
  if (!window.confirm(`Send ${amount} LMN to ${recipient} for "${payment.name}"?`)) return;
  emit('execute-payment', payment.id);
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

function paymentCardStyle(status: string): Record<string, string> {
  if (status === "paused") return { opacity: "0.7", background: "var(--bg-secondary)" };
  return {};
}

function paymentStatusStyle(status: string): Record<string, string> {
  if (status === "completed") return { background: "rgba(var(--color-indigo-rgb), 0.15)", color: "var(--color-indigo)" };
  return {};
}

function formatAmount(amount: number): string {
  return formatDecimal(amount, { decimals: 6 });
}

function formatAddress(address: string): string {
  return truncateMiddle(address, { start: 8, end: 6 });
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


