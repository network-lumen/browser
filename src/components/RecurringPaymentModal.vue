<template>
  <div class="recurpay-overlay overlay-scrim z-9999 backdrop-blur-4px padding-125" @click="$emit('close')">
    <div class="recurpay-modal bg-primary w-full flex flex-column overflow-hidden border-radius-16px shadow-modal max-w-600px max-h-90vh" @click.stop>
      <div class="recurpay-header flex-align-center-justify-space-between padding-150 border-bottom-1">
        <h2 class="flex-align-center margin-0 color-text-primary fs-20px txt-weight-light">
          <Calendar :size="24" />
          <span>{{ isEditing ? 'Edit Recurring Payment' : 'Schedule Recurring Payment' }}</span>
        </h2>
        <button class="recurpay-close-btn bg-transparent border-none cursor-pointer color-text-secondary flex-align-justify-center padding-25 border-radius-6px transition-all-02" @click="$emit('close')">
          <X :size="24" />
        </button>
      </div>

      <div class="recurpay-body flex-1 overflow-y-auto padding-150">
        <!-- Basic Information -->
        <div class="recurpay-section margin-bottom-200">
          <h3 class="flex-align-center color-text-primary fs-16px txt-weight-light">Payment Details</h3>

          <div class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Payment Name <span class="required color-error">*</span></label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g., Netflix Subscription"
              class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
            />
          </div>

          <div class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Description</label>
            <textarea
              v-model="form.description"
              placeholder="Optional notes about this payment"
              class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
              rows="2"
            ></textarea>
          </div>

          <div class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Category</label>
            <select v-model="form.category" class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75">
              <option value="">Select category</option>
              <option value="subscription">Subscription</option>
              <option value="bill">Bill</option>
              <option value="donation">Donation</option>
              <option value="rent">Rent</option>
              <option value="salary">Salary</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <!-- Payment Configuration -->
        <div class="recurpay-section margin-bottom-200">
          <h3 class="flex-align-center color-text-primary fs-16px txt-weight-light">Payment Configuration</h3>

          <div class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Recipient Address <span class="required color-error">*</span></label>
            <div class="recurpay-input-with-button flex gap-50">
              <input
                v-model="form.recipient"
                type="text"
                placeholder="lumen1..."
                class="recurpay-input flex-1 bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
              />
              <button
                class="recurpay-input-btn cursor-pointer flex-align-justify-center color-text-primary bg-tertiary border-1 border-radius-8px transition-all-02 padding-62-100"
                @click="$emit('scan-address')"
                title="Scan QR Code"
              >
                <QrCode :size="16" />
              </button>
            </div>
          </div>

          <div class="recurpay-row grid gap-100">
            <div class="recurpay-group margin-bottom-100">
              <label class="block color-text-primary">Amount <span class="required color-error">*</span></label>
              <div class="recurpay-amount-input relative">
                <input
                  v-model="form.amount"
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="0.000000"
                  class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
                />
                <span class="currency">LMN</span>
              </div>
            </div>

            <div class="recurpay-group margin-bottom-100">
              <label class="block color-text-primary">Frequency <span class="required color-error">*</span></label>
              <select v-model="form.frequency" class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div class="recurpay-row grid gap-100">
            <div class="recurpay-group margin-bottom-100">
              <label class="block color-text-primary">Start Date <span class="required color-error">*</span></label>
              <input
                v-model="form.startDate"
                type="date"
                :min="minDate"
                class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
              />
            </div>

            <div class="recurpay-group margin-bottom-100">
              <label class="block color-text-primary">End Date (Optional)</label>
              <input
                v-model="form.endDate"
                type="date"
                :min="form.startDate || minDate"
                class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
              />
            </div>
          </div>

          <div class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Maximum Payments (Optional)</label>
            <input
              v-model="form.maxPayments"
              type="number"
              min="1"
              placeholder="Leave empty for unlimited"
              class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75"
            />
            <p class="recurpay-hint color-text-secondary fs-12px margin-0 margin-top-37">Payment will stop after this many successful transactions</p>
          </div>
        </div>

        <!-- Reminder Settings -->
        <div class="recurpay-section margin-bottom-200">
          <h3 class="flex-align-center color-text-primary fs-16px txt-weight-light">
            <Bell :size="18" />
            <span>Payment Reminders</span>
          </h3>

          <div class="recurpay-group margin-bottom-100">
            <label class="recurpay-checkbox-label flex-align-center cursor-pointer gap-50 cursor-select-none">
              <input
                v-model="form.reminderEnabled"
                type="checkbox"
              />
              <span class="color-text-primary">Enable payment reminders</span>
            </label>
          </div>

          <div v-if="form.reminderEnabled" class="recurpay-group margin-bottom-100">
            <label class="block color-text-primary">Remind me (days before payment)</label>
            <select v-model="form.reminderDaysBefore" class="recurpay-input w-full bg-primary color-text-primary outline-none fs-14px border-1 border-radius-8px transition-all-02 padding-62-75">
              <option :value="0">On the same day</option>
              <option :value="1">1 day before</option>
              <option :value="2">2 days before</option>
              <option :value="3">3 days before</option>
              <option :value="7">1 week before</option>
            </select>
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="recurpay-summary border-radius-12px padding-125 color-white">
          <h4 class="margin-0 fs-16px txt-weight-light">Payment Summary</h4>
          <div class="recurpay-summary-row flex-align-center-justify-space-between">
            <span>Amount per payment:</span>
            <strong class="txt-weight-light">{{ formatAmount(form.amount) }} LMN</strong>
          </div>
          <div class="recurpay-summary-row flex-align-center-justify-space-between">
            <span>Frequency:</span>
            <strong class="txt-weight-light">{{ frequencyLabel }}</strong>
          </div>
          <div class="recurpay-summary-row flex-align-center-justify-space-between" v-if="form.startDate">
            <span>First payment:</span>
            <strong class="txt-weight-light">{{ formatDate(form.startDate) }}</strong>
          </div>
          <div class="recurpay-summary-row flex-align-center-justify-space-between" v-if="estimatedTotal">
            <span>{{ estimatedTotalLabel }}:</span>
            <strong class="txt-weight-light">{{ estimatedTotal }} LMN</strong>
          </div>
        </div>
      </div>

      <div class="recurpay-footer flex flex-justify-end gap-75 padding-125-150 border-top-1">
        <button class="recurpay-btn secondary disabled-fade-50 flex-inline-align-center cursor-pointer bg-tertiary color-text-primary border-none fw-500 fs-14px gap-50 border-radius-8px transition-all-02 padding-62-125" @click="$emit('close')">Cancel</button>
        <button
          class="recurpay-btn primary disabled-fade-50 flex-inline-align-center cursor-pointer color-white border-none fw-500 fs-14px gap-50 border-radius-8px transition-all-02 padding-62-125"
          @click="handleSubmit"
          :disabled="!isFormValid"
        >
          <Check :size="16" />
          <span>{{ isEditing ? 'Update Payment' : 'Schedule Payment' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Calendar, X, QrCode, Bell, Check } from 'lucide-vue-next';
import type { RecurringPayment, PaymentFrequency } from '../internal/services/recurringPayments';

interface Props {
  payment?: RecurringPayment;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: any): void;
  (e: 'scan-address'): void;
}>();

const isEditing = computed(() => !!props.payment);

const form = ref({
  name: '',
  description: '',
  recipient: '',
  amount: '',
  frequency: 'monthly' as PaymentFrequency,
  startDate: '',
  endDate: '',
  maxPayments: '',
  reminderEnabled: true,
  reminderDaysBefore: 1,
  category: '',
});

// Set today as minimum date
const minDate = computed(() => {
  const today = new Date();
  return today.toISOString().split('T')[0];
});

// Initialize form if editing
watch(() => props.payment, (payment) => {
  if (payment) {
    form.value = {
      name: payment.name,
      description: payment.description || '',
      recipient: payment.recipient,
      amount: payment.amount.toString(),
      frequency: payment.frequency,
      startDate: payment.startDate.toISOString().split('T')[0],
      endDate: payment.endDate ? payment.endDate.toISOString().split('T')[0] : '',
      maxPayments: payment.maxPayments?.toString() || '',
      reminderEnabled: payment.reminderEnabled,
      reminderDaysBefore: payment.reminderDaysBefore,
      category: payment.category || '',
    };
  }
}, { immediate: true });

const frequencyLabel = computed(() => {
  const labels: Record<PaymentFrequency, string> = {
    daily: 'Every day',
    weekly: 'Every week',
    biweekly: 'Every 2 weeks',
    monthly: 'Every month',
    quarterly: 'Every 3 months',
    yearly: 'Every year',
  };
  return labels[form.value.frequency];
});

/**
 * Calculate the number of payments based on date range, frequency, and max payments
 * @param startDate - Payment start date
 * @param endDate - Optional payment end date
 * @param frequency - Payment frequency
 * @param maxPayments - Optional maximum number of payments
 * @returns Number of payments that will occur
 */
function calculatePaymentCount(
  startDate: Date,
  endDate: Date | undefined,
  frequency: PaymentFrequency,
  maxPayments: number | undefined
): number {
  let countByDate: number | null = null;
  
  // Calculate count based on date range if end date exists
  if (endDate) {
    // Validate date range
    if (endDate < startDate) {
      return 0;
    }
    
    const daysDiff = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    switch (frequency) {
      case 'daily':
        countByDate = daysDiff + 1; // Include start day
        break;
      case 'weekly':
        countByDate = Math.floor(daysDiff / 7) + 1;
        break;
      case 'biweekly':
        countByDate = Math.floor(daysDiff / 14) + 1;
        break;
      case 'monthly':
        // Calculate months between dates
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 
          + (endDate.getMonth() - startDate.getMonth());
        countByDate = Math.max(1, months + 1);
        break;
      case 'quarterly':
        const quarters = Math.floor(
          ((endDate.getFullYear() - startDate.getFullYear()) * 12 
          + (endDate.getMonth() - startDate.getMonth())) / 3
        );
        countByDate = Math.max(1, quarters + 1);
        break;
      case 'yearly':
        const years = endDate.getFullYear() - startDate.getFullYear();
        countByDate = Math.max(1, years + 1);
        break;
    }
  }
  
  // Determine final count - use minimum of constraints
  if (countByDate !== null && maxPayments !== undefined && maxPayments > 0) {
    return Math.min(countByDate, maxPayments);
  } else if (countByDate !== null) {
    return countByDate;
  } else if (maxPayments !== undefined && maxPayments > 0) {
    return maxPayments;
  } else {
    // Default to 1 year estimate
    const paymentsPerYear: Record<PaymentFrequency, number> = {
      daily: 365,
      weekly: 52,
      biweekly: 26,
      monthly: 12,
      quarterly: 4,
      yearly: 1,
    };
    return paymentsPerYear[frequency];
  }
}

const estimatedTotal = computed(() => {
  const amount = parseFloat(form.value.amount);
  if (!amount || isNaN(amount) || !form.value.startDate) return null;

  const startDate = new Date(form.value.startDate);
  const endDate = form.value.endDate ? new Date(form.value.endDate) : undefined;
  const maxPayments = form.value.maxPayments ? parseInt(form.value.maxPayments) : undefined;

  const paymentCount = calculatePaymentCount(
    startDate,
    endDate,
    form.value.frequency,
    maxPayments
  );

  const total = amount * paymentCount;
  return total.toFixed(6).replace(/\.?0+$/, '');
});

const estimatedTotalLabel = computed(() => {
  if (!form.value.startDate) return 'Estimated total';

  const endDate = form.value.endDate ? new Date(form.value.endDate) : undefined;
  const maxPayments = form.value.maxPayments ? parseInt(form.value.maxPayments) : undefined;

  if (endDate && maxPayments && maxPayments > 0) {
    // Both constraints - determine which is limiting
    const startDate = new Date(form.value.startDate);
    const countByDate = calculatePaymentCount(startDate, endDate, form.value.frequency, undefined);
    
    if (maxPayments <= countByDate) {
      return `Estimated total (${maxPayments} payment${maxPayments !== 1 ? 's' : ''})`;
    } else {
      return `Estimated total (until ${formatDate(form.value.endDate)})`;
    }
  } else if (endDate) {
    return `Estimated total (until ${formatDate(form.value.endDate)})`;
  } else if (maxPayments && maxPayments > 0) {
    return `Estimated total (${maxPayments} payment${maxPayments !== 1 ? 's' : ''})`;
  } else {
    return 'Estimated total (1 year)';
  }
});

const isFormValid = computed(() => {
  return !!(
    form.value.name.trim() &&
    form.value.recipient.trim() &&
    form.value.amount &&
    parseFloat(form.value.amount) > 0 &&
    form.value.startDate
  );
});

function formatAmount(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.000000';
  return num.toFixed(6).replace(/\.?0+$/, '');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function handleSubmit() {
  if (!isFormValid.value) return;

  const data = {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    recipient: form.value.recipient.trim(),
    amount: parseFloat(form.value.amount),
    denom: 'ulmn',
    frequency: form.value.frequency,
    startDate: new Date(form.value.startDate),
    endDate: form.value.endDate ? new Date(form.value.endDate) : undefined,
    maxPayments: form.value.maxPayments ? parseInt(form.value.maxPayments) : undefined,
    reminderEnabled: form.value.reminderEnabled,
    reminderDaysBefore: form.value.reminderDaysBefore,
    category: form.value.category,
  };

  emit('save', data);
}

defineExpose({
  setRecipient(address: string) {
    form.value.recipient = address;
  }
});
</script>


