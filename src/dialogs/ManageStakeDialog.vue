<template>
  <UiModal :model-value="modelValue" panel-class="shadow-lg animate-modal-slide-in w-90pct max-w-520px" @update:model-value="$emit('update:modelValue', false)">
        <!--
          Two lines rather than one sentence: a moniker is whatever its validator
          typed - "POSTHUMAN 🧬 StakeDrop" - and inlining it made a title that
          could not wrap and pushed the whole dialog into a horizontal scroll.
          The name gets its own line, truncated, with the full text on hover.
        -->
        <template #header>
          <div class="flex flex-column gap-4px min-w-0">
            <span class="text-12px color-text-secondary txt-weight-light">{{ t('Manage stake') }}</span>
            <h3 class="m-0px color-text-primary text-16px truncate" :title="selectedValidator?.moniker || ''">
              {{ selectedValidator?.moniker || t('Unknown') }}
            </h3>
          </div>
        </template>

        <div class="flex gap-16px mb-24px p-16px bg-secondary border-radius-8px">
          <div class="flex flex-column flex-1 gap-4px">
            <span class="text-12px color-text-secondary fw-500">{{ t('Staked') }}</span>
            <span class="color-text-primary txt-weight-medium text-14px">{{ stakedBalance }} LMN</span>
          </div>
          <div class="flex flex-column flex-1 gap-4px">
            <span class="text-12px color-text-secondary fw-500">{{ t('Balance') }}</span>
            <span class="color-text-primary txt-weight-medium text-14px">{{ availableBalance }} LMN</span>
          </div>
        </div>

        <!--
          Two rows of two, not four abreast. "Undelegate" is "Retirer la
          délégation" in French and longer still elsewhere, and four of those in
          a row overflowed the panel however wide it was made.

          The background is set by the same binding that clears it, because
          `bg-transparent` sits below `bg-accent` in the stylesheet: left on the
          element as a static class it won on source order, and the selected
          action came out white-on-grey - unreadable, and invisible to anyone
          reading only the template.
        -->
        <div class="grid grid-cols-2-minmax0 gap-8px mb-24px p-4px bg-secondary border-radius-8px">
          <button
            v-for="act in stakeActions"
            :key="act"
            class="color-text-primary-hover-not-disabled-not-active truncate txt-weight-light cursor-pointer py-8px px-12px border-none border-radius-6px text-13px transition-all-02"
            :class="action === act ? 'active bg-accent color-white' : 'bg-transparent color-text-secondary'"
            :title="actionLabel(act)"
            @click="action = act"
          >
            {{ actionLabel(act) }}
          </button>
        </div>

        <div class="flex flex-column gap-20px">
          <!-- Withdraw Rewards - No amount needed -->
          <div v-if="action === 'Withdraw'" class="p-0px pt-8px pb-8px">
            <div class="flex-align-start gap-12px p-16px border-radius-10px bg-primary-a10 border-1-primary-a15">
              <Info class="flex-shrink-0 color-primary mt-4px" :size="20" />
              <div class="flex flex-column gap-4px">
                <strong class="text-15px txt-weight-light color-text-primary">{{ t('Withdraw staking rewards') }}</strong>
                <!--
                  The amount, because the button claimed an unknown sum: this
                  panel asked the user to sign a transaction without telling them
                  what it was worth, which is also the only way to notice there
                  is nothing to claim before paying for the attempt.
                -->
                <p class="m-0px text-13px color-text-secondary line-height-14">{{ t('This will claim all pending rewards from this validator to your wallet.') }}</p>
                <span class="mt-4px txt-weight-medium text-15px" :class="hasRewards ? 'color-success' : 'color-text-tertiary'">
                  {{ t('Pending rewards: {amount} LMN', { amount: pendingRewards }) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Amount Input - Not for Withdraw -->
          <div v-else class="flex flex-column gap-8px">
            <label class="text-14px txt-weight-light color-text-primary">{{ amountLabel }}</label>
            <div class="flex-align-center relative">
              <UiInput bg-class="bg-secondary" font-size-class="txt-weight-light" padding-class="pt-12px pr-64px pb-12px pl-16px" :focus-ring="false" type="number"
                v-model="amount"
                :placeholder="`0.0`"
                step="0.000001"
                min="0" class="text-15px focus-outline-none focus-ring focus-shadow" />
              <span class="txt-weight-light color-text-secondary absolute text-14px right-16px">{{ t('LMN') }}</span>
            </div>
            <div class="flex flex-column gap-8px p-0px pt-8px pb-8px">
              <input 
                type="range" 
                v-model="percentage" 
                min="0" 
                max="100" 
                class="slider-thumb-accent w-full outline-none border-radius-4px bg-border h-6px appearance-none"
              />
              <div class="flex-justify-space-between color-text-tertiary text-11px">
                <span>0%</span>
                <span>50%</span>
                <span>{{ t('Max') }}</span>
              </div>
            </div>
            <div class="grid-cols-4-1fr gap-8px grid">
              <UiButton variant="secondary" @click="$emit('set-percentage', 25)" class="hover-bg-primary-a10">25%</UiButton>
              <UiButton variant="secondary" @click="$emit('set-percentage', 50)" class="hover-bg-primary-a10">50%</UiButton>
              <UiButton variant="secondary" @click="$emit('set-percentage', 75)" class="hover-bg-primary-a10">75%</UiButton>
              <UiButton variant="secondary" @click="$emit('set-percentage', 100)" class="hover-bg-primary-a10">{{ t('Max') }}</UiButton>
            </div>
          </div>

          <!--
            The chain refuses a redelegation away from a validator that is still
            receiving one of yours (ErrTransitiveRedelegation), for the whole
            unbonding period. Nothing said so, so moving stake and changing your
            mind produced a signed transaction and a raw chain error - the
            "redelegate doesn't work at all" report.
          -->
          <div v-if="action === 'Redelegate' && redelegationLockedUntil" class="flex-align-start gap-12px p-16px border-radius-10px bg-warning-a08 border-1-warning-a30">
            <TriangleAlert class="flex-shrink-0 color-warning mt-2px" :size="20" />
            <div class="flex flex-column gap-4px">
              <strong class="text-14px txt-weight-medium color-text-primary">{{ t('Stake here cannot be moved yet') }}</strong>
              <p class="m-0px text-13px color-text-secondary line-height-14">
                {{ t('A redelegation is still arriving at this validator, and the chain refuses to move stake out of it until that completes on {date}.', { date: formatDateTime(redelegationLockedUntil) }) }}
              </p>
            </div>
          </div>

          <div v-if="action === 'Redelegate' && !redelegationLockedUntil" class="flex flex-column gap-8px">
            <label class="text-14px txt-weight-light color-text-primary">{{ t('Select new validator') }}</label>
            <select v-model="target" class="w-full color-text-primary cursor-pointer py-12px px-16px bg-secondary border-1 border-radius-8px text-14px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow">
              <option value="">{{ t('Choose validator…') }}</option>
              <option v-for="val in validators.filter(v => v.address !== selectedValidator?.address)" :key="val.address" :value="val.address">
                {{ val.moniker }}
              </option>
            </select>
          </div>

          <UiButton
            variant="primary"
            block
            @click="$emit('confirm')"
            :disabled="!canConfirm || isProcessingTx"
          >
            <span v-if="!isProcessingTx">{{ confirmLabel }}</span>
            <span v-else>{{ t('Processing…') }}</span>
          </UiButton>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import { Info, TriangleAlert } from 'lucide-vue-next';
import { STAKE_AMOUNT_LABELS, STAKE_CONFIRM_LABELS, stakeActionLabel } from '../internal/services/stakeActions';
import { formatDateTime } from '../internal/services/format';
import type { StakeAction } from '../types/networkPage';
import type { Validator } from '../types/explorerPage';

/**
 * Delegating, undelegating, redelegating or withdrawing against one
 * validator.
 *
 * The chosen action, the amount and the redelegation target write back to the
 * page, which is what actually signs and broadcasts. How that broadcast went is
 * deliberately not drawn here: this dialog used to raise its own full-screen
 * panel with a coloured border for each outcome, which no other transaction in
 * the app did, and which reported an unconfirmable-but-sent transaction as
 * "Transaction failed" under a Try again button. Outcomes are toasts now, like
 * the wallet's.
 */
const props = defineProps<{
  modelValue: boolean;
  selectedValidator: { moniker?: string; address?: string } | null;
  stakedBalance: string;
  availableBalance: string;
  /** Validators the stake can be moved to - redelegation only. */
  validators: Validator[];
  stakeActions: StakeAction[];
  canConfirm: boolean;
  isProcessingTx?: boolean;
  /** Claimable from this validator, already in LMN. */
  pendingRewards: string;
  /**
   * ISO time at which this validator stops being refused as a redelegation
   * source, or '' when it is not. The page reads it from the chain's own
   * redelegation entries.
   */
  redelegationLockedUntil: string;
}>();

const hasRewards = computed(() => Number(props.pendingRewards) > 0);

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'set-percentage', percent: number): void;
}>();

const action = defineModel<StakeAction>('action', { required: true });

const amountLabel = computed(() => STAKE_AMOUNT_LABELS[action.value]?.() ?? t('Amount'));
const confirmLabel = computed(() => STAKE_CONFIRM_LABELS[action.value]?.() ?? t('Confirm'));

/** The page names the same four actions in its toasts, so the table is shared. */
const actionLabel = stakeActionLabel;

const amount = defineModel<string>('amount', { required: true });
const percentage = defineModel<number>('percentage', { required: true });
const target = defineModel<string>('target', { required: true });
</script>