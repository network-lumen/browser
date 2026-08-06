<template>
  <UiModal :model-value="modelValue" panel-class="asset-transfer-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader title="IBC Transfer">
        <template #icon><ArrowLeftRight :size="20" /></template>
      </UiModalHeader>
    </template>
        <template v-if="context">
          <UiBanner class="mb-24px">
            <span>
              Move this asset across linked IBC chains. Use Send to move it on its current chain, or keep the prefilled destination wallet to bridge it back.
            </span>
          </UiBanner>

          <UiFormGroup label="Asset" dimmed>
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              :value="`${context.displayName} (${context.displaySymbol})`"
              readonly class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <div class="gap-16px grid grid-cols-2-minmax0">
            <UiFormGroup label="From chain" dimmed>
              <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text" :value="context.chainLabel" readonly class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
            </UiFormGroup>
            <UiFormGroup label="To chain">
              <select class="w-full border-radius-10px color-text-primary cursor-pointer py-12px px-16px border-2 text-15px bg-card transition-all-02 mono focus-outline-none focus-border-primary focus-ring focus-shadow bg-secondary-read-only appearance-none" v-model="form.destinationKey">
                <option
                  v-for="target in context.transferTargets"
                  :key="target.key"
                  :value="target.key"
                >
                  {{ target.chainLabel }}
                </option>
              </select>
            </UiFormGroup>
          </div>

          <UiFormGroup label="From address" dimmed>
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text" :value="context.ownerAddress" readonly class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup required label="Recipient" :hint="selectedTarget ? `Default wallet on destination: ${selectedTarget.defaultRecipient}` : ''">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              v-model="form.recipient"
              :placeholder="selectedTarget?.defaultRecipient || 'Destination address'" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup required label="Amount" :hint="`Available: ${context.displayAmount} ${context.displaySymbol}`">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              inputmode="decimal"
              v-model="form.amount"
              placeholder="0.000000"
              @input="onAmountInput" class="mono focus-outline-none focus-ring focus-shadow pr-64px bg-secondary-read-only placeholder-tertiary" />
            <span class="txt-weight-light color-text-secondary absolute text-14px cursor-events-none top-half translate-y-center right-16px">{{ context.displaySymbol }}</span>
          </UiFormGroup>

          <UiSummaryCard title="Transfer Summary">
            <UiSummaryRow label="Route" :value="selectedTarget?.routeLabel || 'Select destination'" />
            <UiSummaryRow label="Source chain" :value="context.chainLabel" />
            <UiSummaryRow highlight label="Destination chain" :value="selectedTarget?.chainLabel || 'Unknown'" />
          </UiSummaryCard>

          <UiButton variant="primary" @click="$emit('submit')"
            :disabled="!canSubmit || sending" class="disabled-fade-50">
            <ArrowLeftRight :size="18" v-if="!sending" />
            <UiSpinner v-else size="sm" class="spinner-color-white" />
            <span>{{ sending ? 'Transferring...' : 'IBC Transfer' }}</span>
          </UiButton>
        </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import UiSummaryCard from '../ui/UiSummaryCard.vue';
import UiSummaryRow from '../ui/UiSummaryRow.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { ArrowLeftRight } from 'lucide-vue-next';
import { maskDecimalInput } from '../internal/services/inputMasks';
import type { AssetRow, AssetTransferForm, AssetTransferTarget } from '../types/walletPage';

/** Moving an IBC asset to another chain. */
const props = defineProps<{
  modelValue: boolean;
  context: AssetRow | null;
  form: AssetTransferForm;
  selectedTarget: AssetTransferTarget | null;
  canSubmit: boolean;
  sending?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();

/** The form object is shared with the page, which is what submits it. */
function onAmountInput(event: Event) {
  props.form.amount = maskDecimalInput(event);
}
</script>
