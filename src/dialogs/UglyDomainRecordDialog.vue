<template>
  <UiModal :model-value="modelValue" :title="t('Ugly domain record')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
        <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
          <div class="mb-16px">
            <label class="color-text-secondary block mb-4px text-13px">{{ t('Record (cid)') }}</label>
            <div v-if="loading" class="color-text-tertiary text-13px mb-8px">
              {{ t('Loading record...') }}
            </div>
            <UiInput v-else bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
              :model-value="cid" @update:model-value="$emit('update:cid', $event)"
              placeholder="lumen://ipfs/CID or lumen://ipns/NAME"
              :disabled="saving" class="w-full focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
            <UiButton variant="secondary" type="button" disabled class="outline-none mt-8px disabled-fade-50" :title="t('Multiple records are only available for Lumen domains, not ugly domains.')">
              {{ t('Add record') }}
              <HelpCircle :size="14" />
            </UiButton>
          </div>

          <div class="flex flex-justify-end gap-8px">
            <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" :disabled="saving" class="outline-none">
              {{ t('Cancel') }}
            </UiButton>
            <UiButton variant="primary" type="button" @click="$emit('submit')" :disabled="saving || loading" class="outline-none">
              <span v-if="!saving" class="flex-inline-align-center gap-8px">
                <Check :size="16" />
                {{ t('Save record') }}
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
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { Check } from 'lucide-vue-next';

/** The CID an ugly domain points at. */
defineProps<{
  modelValue: boolean;
  cid: string;
  loading?: boolean;
  saving?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:cid', value: string): void;
  (e: 'submit'): void;
}>();
</script>
