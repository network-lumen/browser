<template>
  <UiModal :model-value="modelValue" :title="t('Domain settings')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
        <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
          <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
            <div class="txt-weight-light text-15px">{{ domain?.name || 'mydomain.lmn' }}</div>
            <div class="text-13px mt-4px">
              {{ domain ? expiryLabel : t('Expires: unknown') }}
            </div>
          </div>

          <div class="mb-16px">
            <label class="color-text-secondary block mb-4px text-13px">{{ t('Records (key / value)') }}</label>
            <div v-if="!records.length" class="color-text-tertiary text-13px mb-8px">
              {{ t('No records yet. Add a new row below.') }}
            </div>
            <div v-else class="flex flex-column gap-6px mb-8px">
              <div
                class="flex-align-center gap-6px"
                v-for="(r, idx) in records"
                :key="idx"
              >
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                  v-model="r.key"
                  placeholder="cid | ipns | txt | ..." class="flex-09 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                  v-model="r.value"
                  :placeholder="t('Value')" class="flex-16 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
                <UiButton variant="danger" type="button"
                  @click="$emit('remove-record', idx)"
                  :title="t('Remove row')">
                  <X :size="14" />
                </UiButton>
              </div>
            </div>
            <UiButton variant="secondary" type="button" @click="$emit('add-record')" class="outline-none">
              {{ t('Add record') }}
            </UiButton>
          </div>

          <UiCard bg-class="bg-secondary" border-class="border-1" radius="10px" padding-class="py-8px px-12px" class="m-0px mt-8px mb-16px" :shadow="false">
            <div class="flex-align-center flex-justify-space-between color-text-primary text-13px py-4px px-0px">
              <span>{{ t('Cost') }}</span>
              <span class="txt-weight-light">{{ costLabel }}</span>
            </div>
            <div class="flex-align-center flex-justify-space-between color-text-primary text-13px py-4px px-0px">
              <span>{{ t('Balance') }}</span>
              <span class="txt-weight-light">{{ walletBalanceLabel }}</span>
            </div>
            <p class="text-12px color-text-tertiary mt-8px" v-if="insufficientBalance">
              {{ t('You need at least {amount} available to keep your PQC link active.', { amount: costLabel || '' }) }}
            </p>
          </UiCard>

          <div class="flex flex-justify-end gap-8px">
            <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" class="outline-none">
              {{ t('Cancel') }}
            </UiButton>
            <UiButton variant="primary" type="button"
              @click="$emit('submit')"
              :disabled="!canSubmit || busy" class="outline-none">
              <span v-if="!busy" class="flex-inline-align-center gap-8px">
                <Settings :size="16" />
                {{ t('Save changes') }}
              </span>
              <UiSpinner v-else size="sm" />
            </UiButton>
          </div>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { Settings } from 'lucide-vue-next';
import type { SettingsRecord } from '../types/domainPage';

/**
 * The key/value records a domain resolves to.
 *
 * The list stays with the page - adding and removing a row are events -
 * because the page loads it from chain and writes it back.
 */
defineProps<{
  modelValue: boolean;
  records: SettingsRecord[];
  domain: { name?: string } | null;
  expiryLabel?: string;
  costLabel?: string;
  walletBalanceLabel?: string;
  canSubmit: boolean;
  busy?: boolean;
  insufficientBalance?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit'): void;
  (e: 'add-record'): void;
  (e: 'remove-record', index: number): void;
}>();
</script>
