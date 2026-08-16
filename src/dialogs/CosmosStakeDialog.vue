<template>
  <UiModal :model-value="modelValue" :title="title" panel-class="w-full max-w-520px" @update:model-value="$emit('update:modelValue', false)">
    <div class="flex flex-column gap-16px">
      <UiBanner v-if="action === 'undelegate'" variant="warning">
        {{ unbondingNotice }}
      </UiBanner>

      <!-- Which validator the stake comes from, or goes to. For anything but a
           fresh delegation the source is one the account already uses, so the
           list is its own delegations rather than the whole active set. -->
      <UiFormGroup required :label="sourceLabel">
        <select
          class="w-full border-radius-10px color-text-primary cursor-pointer py-12px px-16px border-2 text-15px bg-card transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow appearance-none"
          :value="fromValidator"
          :disabled="loading || !sourceOptions.length"
          @change="$emit('update:from-validator', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>
            {{ loading ? t('Loading validators…') : t('Select a validator') }}
          </option>
          <option v-for="option in sourceOptions" :key="option.address" :value="option.address">
            {{ option.label }}
          </option>
        </select>
      </UiFormGroup>

      <UiFormGroup v-if="action === 'redelegate'" required :label="t('To validator')">
        <select
          class="w-full border-radius-10px color-text-primary cursor-pointer py-12px px-16px border-2 text-15px bg-card transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow appearance-none"
          :value="toValidator"
          :disabled="loading || !destinationOptions.length"
          @change="$emit('update:to-validator', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>{{ t('Select a validator') }}</option>
          <option v-for="option in destinationOptions" :key="option.address" :value="option.address">
            {{ option.label }}
          </option>
        </select>
      </UiFormGroup>

      <UiFormGroup
        required
        :label="t('Amount ({symbol})', { symbol })"
        :hint="availableLabel"
      >
        <UiInput
          :model-value="amount"
          type="text"
          inputmode="decimal"
          placeholder="0.000000"
          class="mono"
          @update:model-value="$emit('update:amount', $event)"
        />
      </UiFormGroup>

      <UiErrorState v-if="error" :message="error" wrapper-class="gap-8px min-h-40px" message-class="text-13px" />

      <div class="flex-align-center gap-12px flex-justify-end">
        <UiButton variant="ghost" :disabled="busy" @click="$emit('update:modelValue', false)">
          <span>{{ t('Cancel') }}</span>
        </UiButton>
        <UiButton variant="primary" :disabled="!canSubmit || busy" @click="$emit('submit')">
          <UiSpinner v-if="busy" size="sm" class="spinner-color-white" />
          <span>{{ primaryLabel }}</span>
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiErrorState from '../ui/UiErrorState.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import type { CosmosStakeAction, CosmosStakeOption } from '../types/walletPage';

/**
 * Delegate, undelegate or redelegate, with the validator chosen here.
 *
 * One dialog for the three because they ask the same three questions - which
 * validator, how much, and for a move, where to. Splitting them would be three
 * copies of a form that moves money.
 */
const props = defineProps<{
  modelValue: boolean;
  action: CosmosStakeAction;
  symbol: string;
  /** Active validators, for a fresh delegation. */
  sourceOptions: CosmosStakeOption[];
  /** Where a redelegation can land: everything except where it starts. */
  destinationOptions: CosmosStakeOption[];
  fromValidator: string;
  toValidator: string;
  amount: string;
  availableLabel: string;
  /** Days the chain locks an undelegation for, when it declares one. */
  unbondingDays: number | null;
  loading: boolean;
  busy: boolean;
  error: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:from-validator', value: string): void;
  (e: 'update:to-validator', value: string): void;
  (e: 'update:amount', value: string): void;
  (e: 'submit'): void;
}>();

const title = computed(() => {
  if (props.action === 'delegate') return t('Stake {symbol}', { symbol: props.symbol });
  if (props.action === 'undelegate') return t('Unstake {symbol}', { symbol: props.symbol });
  return t('Move stake');
});

const primaryLabel = computed(() => {
  if (props.busy) return t('Signing…');
  if (props.action === 'delegate') return t('Stake');
  if (props.action === 'undelegate') return t('Unstake');
  return t('Move');
});

/** "From" only reads as a direction when something is moving. */
const sourceLabel = computed(() =>
  props.action === 'redelegate' ? t('From validator') : t('Validator')
);

/**
 * Unbonding is the one thing here a user cannot undo by acting again, so the
 * wait is stated before the amount rather than after the fact.
 */
const unbondingNotice = computed(() =>
  props.unbondingDays
    ? t('Unstaked tokens are locked for {count} days and earn nothing during that time.', {
        count: props.unbondingDays
      })
    : t('Unstaked tokens are locked for the chain’s unbonding period and earn nothing during it.')
);

const canSubmit = computed(() => {
  if (!props.fromValidator || !Number(props.amount)) return false;
  if (props.action !== 'redelegate') return true;
  return Boolean(props.toValidator) && props.toValidator !== props.fromValidator;
});
</script>
