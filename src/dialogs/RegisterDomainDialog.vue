<template>
  <UiModal :model-value="modelValue" :title="t('Register domain')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
        <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
          <div class="mb-16px">
            <label class="color-text-secondary block mb-4px text-13px">{{ t('Domain') }}</label>
            <div class="flex-align-center gap-6px">
              <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                v-model="form.domainName"
                placeholder="myname"
                @input="onDomainInput"
                @blur="$emit('refresh-availability')" class="flex-12 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
              <span class="txt-weight-light color-text-tertiary text-14px">.</span>
              <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
                v-model="form.ext"
                placeholder="lmn"
                @blur="$emit('refresh-availability')" class="flex-08 focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
            </div>
            <div
              v-if="form.domainName"
              class="mt-8px border-radius-8px text-13px py-8px px-10px"
              :class="domainAvailable ? 'color-success bg-fill-success' : 'color-error bg-fill-error'"
            >
              <span>{{ domainAvailable ? t('Available') : t('Already taken') }}</span>
            </div>
          </div>

          <div class="mb-16px flex-align-center-justify-space-between">
            <label class="color-text-secondary text-13px">{{ t('Registration period') }}</label>
            <span class="color-text-primary text-13px txt-weight-medium">{{ t('1 year') }}</span>
          </div>

          <UiCard bg-class="bg-secondary" border-class="border-1" radius="10px" padding-class="py-8px px-12px" class="m-0px mt-8px mb-16px" :shadow="false">
            <div class="mt-4px flex-align-center flex-justify-space-between color-text-primary text-13px px-0px pt-6px border-top-1 txt-weight-light">
              <span>{{ t('Total (1 year)') }}</span>
              <span class="txt-weight-light">{{ dnsTotalFeeLabel }}</span>
            </div>
          </UiCard>

          <UiButton variant="primary" type="button"
            @click="$emit('submit')"
            :disabled="!canSubmit || busy" class="outline-none">
            <span v-if="!busy" class="flex-inline-align-center gap-8px">
              <Plus :size="16" />
              {{ t('Register domain') }}
            </span>
            <UiSpinner v-else size="sm" />
          </UiButton>
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
import { Plus } from 'lucide-vue-next';
import { maskDomainInput } from '../internal/services/inputMasks';
import type { DomainRegisterForm } from '../types/domainPage';

/**
 * Buying a domain. The price quote and whether the wallet can cover it are
 * worked out by the page, which is the only side that talks to the chain.
 */
const props = defineProps<{
  modelValue: boolean;
  form: DomainRegisterForm;
  canSubmit: boolean;
  domainAvailable: boolean | null;
  dnsTotalFeeLabel?: string;
  busy?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit'): void;
  (e: 'refresh-availability'): void;
}>();

function onDomainInput(event: Event) {
  props.form.domainName = maskDomainInput(event);
}
</script>
