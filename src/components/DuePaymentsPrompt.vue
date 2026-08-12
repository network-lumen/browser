<template>
  <!-- ####### DUE PAYMENT REMINDERS (global, asks before every send) ####### -->
  <transition name="fade-slide">
    <section
      v-if="due.length"
      class="bg-card border-default color-text-primary border-radius-16px fixed p-16px w-min-380px-92vw shadow-lg z-9998 bottom-24px right-24px"
    >
      <header class="flex-align-center gap-8px mb-12px">
        <UiIconBadge badge-class="color-warning bg-warning-a15">
          <Bell :size="16" />
        </UiIconBadge>
        <div class="flex flex-column gap-2px min-w-0">
          <p class="color-text-primary text-13px line-height-12 txt-weight-medium m-0px">
            {{ due.length === 1 ? t('A payment is due') : t('{count} payments are due', { count: due.length }) }}
          </p>
          <p class="color-text-secondary text-11px line-height-12 m-0px">
            {{ t('Nothing is sent until you confirm it.') }}
          </p>
        </div>
      </header>

      <div class="flex flex-column gap-8px overflow-y-auto max-h-300px pr-4px">
        <div
          v-for="payment in due"
          :key="payment.id"
          class="flex flex-column gap-6px border-radius-10px p-10px bg-secondary"
        >
          <div class="flex-align-center gap-8px min-w-0">
            <span class="text-12px color-text-primary truncate flex-1 min-w-0">{{ payment.name }}</span>
            <span class="text-12px color-text-primary txt-weight-medium flex-0-0-auto">
              {{ formatDecimal(payment.amount, { decimals: 6 }) }} LMN
            </span>
          </div>
          <span class="text-11px color-text-tertiary truncate mono">
            {{ truncateMiddle(payment.recipient, { start: 12, end: 8 }) }}
          </span>
          <span v-if="lateBy(payment)" class="text-11px color-warning">{{ lateBy(payment) }}</span>

          <div class="flex-align-center gap-6px">
            <UiButton
              variant="primary"
              class="text-11px py-2px px-8px"
              :disabled="!!payingId"
              @click="confirmPay(payment)"
            >
              <UiSpinner v-if="payingId === payment.id" size="sm" />
              <span>{{ payingId === payment.id ? 'Sending…' : t('Pay now') }}</span>
            </UiButton>
            <UiButton
              variant="secondary"
              class="text-11px py-2px px-8px"
              :disabled="!!payingId"
              @click="snoozeUntilRestart(payment.id)"
            >
              {{ t('Later') }}
            </UiButton>
          </div>
        </div>
      </div>

      <div v-if="due.length > 1" class="mt-8px">
        <UiButton
          variant="none"
          class="text-11px color-text-tertiary cursor-pointer bg-transparent border-none"
          :disabled="!!payingId"
          @click="snoozeAllUntilRestart"
        >
          {{ t('Remind me next time') }}
        </UiButton>
      </div>
    </section>
  </transition>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { onBeforeUnmount, onMounted } from 'vue';
import { Bell } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiIconBadge from '../ui/UiIconBadge.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { useToast } from '../composables/useToast';
import { formatDecimal, truncateMiddle } from '../internal/services/format';
import {
  duePayments,
  isPaying,
  payReminder,
  snoozeAllUntilRestart,
  snoozeUntilRestart,
  startDueWatcher,
  stopDueWatcher
} from '../internal/services/paymentReminders';
import type { RecurringPayment } from '../types/recurringPayments';

const toast = useToast();
const due = duePayments;
const payingId = isPaying;

/** Reads as "3 days late" so an overdue reminder is visibly overdue. */
function lateBy(payment: RecurringPayment): string {
  const days = Math.floor((Date.now() - new Date(payment.nextPaymentDate).getTime()) / 86_400_000);
  if (days < 1) return '';
  return days === 1 ? t('1 day late') : `${days} days late`;
}

async function confirmPay(payment: RecurringPayment) {
  const amount = formatDecimal(payment.amount, { decimals: 6 });
  const recipient = truncateMiddle(payment.recipient, { start: 12, end: 8 });
  if (!window.confirm(t('Send {amount} LMN to {recipient} for “{name}”?', { amount, recipient, name: payment.name }))) return;

  const result = await payReminder(payment.id);
  if (result.ok) {
    toast.success(t('Sent {amount} LMN for “{name}”', { amount, name: payment.name }));
    return;
  }
  if (result.locked) {
    toast.warning(result.error);
    return;
  }
  toast.error(result.error);
}

onMounted(startDueWatcher);
onBeforeUnmount(stopDueWatcher);
</script>
