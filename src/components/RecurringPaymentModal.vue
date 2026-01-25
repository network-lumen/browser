<template>
  <div class="recurring-payments-modal-overlay" @click="$emit('close')">
    <div class="recurring-payments-modal" @click.stop>
      <div class="modal-header">
        <h2>
          <Calendar :size="24" />
          <span>{{ isEditing ? 'Edit Recurring Payment' : 'Schedule Recurring Payment' }}</span>
        </h2>
        <button class="close-btn" @click="$emit('close')">
          <X :size="24" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Basic Information -->
        <div class="form-section">
          <h3>Payment Details</h3>
          
          <div class="form-group">
            <label>Payment Name <span class="required">*</span></label>
            <input 
              v-model="form.name" 
              type="text" 
              placeholder="e.g., Netflix Subscription"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea 
              v-model="form.description" 
              placeholder="Optional notes about this payment"
              class="form-input"
              rows="2"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Category</label>
            <select v-model="form.category" class="form-input">
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
        <div class="form-section">
          <h3>Payment Configuration</h3>
          
          <div class="form-group">
            <label>Recipient Address <span class="required">*</span></label>
            <div class="input-with-button">
              <input 
                v-model="form.recipient" 
                type="text" 
                placeholder="lumen1..."
                class="form-input"
              />
              <button 
                class="input-btn" 
                @click="$emit('scan-address')"
                title="Scan QR Code"
              >
                <QrCode :size="16" />
              </button>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount <span class="required">*</span></label>
              <div class="amount-input">
                <input 
                  v-model="form.amount" 
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="0.000000"
                  class="form-input"
                />
                <span class="currency">LMN</span>
              </div>
            </div>

            <div class="form-group">
              <label>Frequency <span class="required">*</span></label>
              <select v-model="form.frequency" class="form-input">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Start Date <span class="required">*</span></label>
              <input 
                v-model="form.startDate" 
                type="date"
                :min="minDate"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>End Date (Optional)</label>
              <input 
                v-model="form.endDate" 
                type="date"
                :min="form.startDate || minDate"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Maximum Payments (Optional)</label>
            <input 
              v-model="form.maxPayments" 
              type="number"
              min="1"
              placeholder="Leave empty for unlimited"
              class="form-input"
            />
            <p class="form-hint">Payment will stop after this many successful transactions</p>
          </div>
        </div>

        <!-- Reminder Settings -->
        <div class="form-section">
          <h3>
            <Bell :size="18" />
            <span>Payment Reminders</span>
          </h3>
          
          <div class="form-group">
            <label class="checkbox-label">
              <input 
                v-model="form.reminderEnabled" 
                type="checkbox"
              />
              <span>Enable payment reminders</span>
            </label>
          </div>

          <div v-if="form.reminderEnabled" class="form-group">
            <label>Remind me (days before payment)</label>
            <select v-model="form.reminderDaysBefore" class="form-input">
              <option :value="0">On the same day</option>
              <option :value="1">1 day before</option>
              <option :value="2">2 days before</option>
              <option :value="3">3 days before</option>
              <option :value="7">1 week before</option>
            </select>
          </div>
        </div>

        <!-- Payment Summary -->
        <div class="payment-summary">
          <h4>Payment Summary</h4>
          <div class="summary-row">
            <span>Amount per payment:</span>
            <strong>{{ formatAmount(form.amount) }} LMN</strong>
          </div>
          <div class="summary-row">
            <span>Frequency:</span>
            <strong>{{ frequencyLabel }}</strong>
          </div>
          <div class="summary-row" v-if="form.startDate">
            <span>First payment:</span>
            <strong>{{ formatDate(form.startDate) }}</strong>
          </div>
          <div class="summary-row" v-if="estimatedTotal">
            <span>{{ estimatedTotalLabel }}:</span>
            <strong>{{ estimatedTotal }} LMN</strong>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn secondary" @click="$emit('close')">Cancel</button>
        <button 
          class="btn primary" 
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

<style scoped>
.recurring-payments-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.recurring-payments-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-section {
  margin-bottom: 32px;
}

.form-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.required {
  color: #ef4444;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

textarea.form-input {
  resize: vertical;
  min-height: 60px;
}

/* Dark mode support for date and select inputs */
.form-input[type="date"],
.form-input[type="number"],
select.form-input {
  color-scheme: light dark;
}

.form-input[type="date"]::-webkit-calendar-picker-indicator {
  filter: var(--icon-filter, none);
  cursor: pointer;
}

/* Ensure select dropdown arrow is visible in dark mode */
select.form-input {
  background-image: none;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button .form-input {
  flex: 1;
}

.input-btn {
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: var(--text-primary);
}

.input-btn:hover {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.amount-input {
  position: relative;
}

.amount-input .currency {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  pointer-events: none;
}

.amount-input .form-input {
  padding-right: 50px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.payment-summary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-radius: 12px;
  color: white;
}

.payment-summary h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row strong {
  font-weight: 600;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
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

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--accent-primary);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: var(--accent-secondary);
}

.btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn.secondary:hover {
  background: var(--card-bg);
}

@media (max-width: 640px) {
  .recurring-payments-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
