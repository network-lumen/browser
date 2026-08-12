<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    panel-class="sitemodal-send w-min-520px-92vw max-h-100vh-32px"
    :closable="!sending"
    :busy="sending"
    :confirm-disabled="!canSend"
    @update:model-value="$emit('close')"
    @confirm="$emit('submit')"
  >

    <template #header>
      <UiModalHeader :title="t('Send LMN')" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Send :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">{{ t('Requested by') }} <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>


          <UiFormGroup :label="t('From')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default py-10px px-12px bg-secondary" type="text" :value="activeAddress || '-'" readonly />
          </UiFormGroup>

          <UiFormGroup required :label="t('To')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" :model-value="to" @update:model-value="$emit('update:to', $event)" placeholder="lmn1..." :disabled="sending" />
          </UiFormGroup>

          <UiFormGroup required :label="t('Amount (LMN)')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" :model-value="amount" @update:model-value="$emit('update:amount', $event)" placeholder="0.000000" :disabled="sending" />
            <span class="text-12px color-text-secondary absolute top-half translate-y-center right-12px">{{ t('LMN') }}</span>
            <template #hint>
              <div v-if="balanceUlmn !== null">Available: {{ balanceLmnDisplay }} LMN</div>
              <div v-else class="color-error">{{ t('Balance not available') }}</div>
              <div v-if="insufficientFunds" class="color-error mt-8px">{{ t('Not enough funds') }}</div>
            </template>
          </UiFormGroup>

          <UiFormGroup :label="t('Memo (optional)')" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" :model-value="memo" @update:model-value="$emit('update:memo', $event)" :disabled="sending" />
          </UiFormGroup>

    <template #confirm><UiSpinnerRing v-if="sending" />
        <span>{{ sending ? t('Sending…') : t('Send') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiSpinnerRing from '../ui/UiSpinnerRing.vue';
import { Send } from 'lucide-vue-next';

/** Sending LMN at a site's request. The balance and the verdict on it come
 * from the host, which is the side that can read the wallet. */
defineProps<{
  modelValue: boolean;
  siteLabel: string;
  to: string;
  amount: string;
  memo: string;
  activeAddress: string;
  balanceUlmn: bigint | null;
  balanceLmnDisplay: string;
  insufficientFunds: boolean;
  canSend: boolean;
  sending?: boolean;
  error?: string;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:to', value: string): void;
  (e: 'update:amount', value: string): void;
  (e: 'update:memo', value: string): void;
}>();
</script>
