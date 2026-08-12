<template>
  <UiDialog
    :model-value="modelValue"
    panel-class="w-full max-w-500px"
    hide-footer
    @update:model-value="emit('update:modelValue', false)"
  >
    <template #header>
      <h3 class="flex-align-center gap-8px color-text-primary m-0px text-18px">
        <History :size="20" />
        <span>{{ t('Payment history') }}</span>
      </h3>
    </template>

    <UiEmptyState v-if="records.length === 0" :description="t('No payment history yet')" />
    <div v-else class="flex flex-column gap-12px">
      <div
        v-for="record in records"
        :key="record.id"
        class="flex gap-12px p-12px bg-secondary border-radius-8px"
      >
        <UiIconBadge
          size-class="size-32px"
          :badge-class="{ 'bg-fill-success': record.status === 'success', 'bg-fill-error': record.status === 'failed', 'bg-warning-a15': record.status === 'pending' }"
        >
          <Check v-if="record.status === 'success'" :size="16" />
          <X v-else-if="record.status === 'failed'" :size="16" />
          <Clock v-else :size="16" />
        </UiIconBadge>
        <div class="flex-1">
          <div class="flex-align-center-justify-space-between mb-4px">
            <strong class="color-text-primary">{{ formatDecimal(record.amount, { decimals: 6 }) }} LMN</strong>
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
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { History, Check, X, Clock } from 'lucide-vue-next';
import UiDialog from '../ui/UiDialog.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiIconBadge from '../ui/UiIconBadge.vue';
import { formatDateTime, formatDecimal } from '../internal/services/format';
import type { PaymentHistory } from '../types/recurringPayments';

defineProps<{
  modelValue: boolean;
  records: PaymentHistory[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>
