<template>
  <UiModal :model-value="modelValue" :title="`Manage Stake with ${selectedValidator?.moniker}`" panel-class="shadow-lg animate-modal-slide-in w-90pct max-w-420px" @update:model-value="$emit('update:modelValue', false)">
        <div class="flex gap-16px mb-24px p-16px bg-secondary border-radius-8px">
          <div class="flex flex-column flex-1 gap-4px">
            <span class="text-12px color-text-secondary fw-500">{{ t('Staked:') }}</span>
            <span class="color-text-primary txt-weight-medium text-14px">{{ stakedBalance }} LMN</span>
          </div>
          <div class="flex flex-column flex-1 gap-4px">
            <span class="text-12px color-text-secondary fw-500">{{ t('Balance:') }}</span>
            <span class="color-text-primary txt-weight-medium text-14px">{{ availableBalance }} LMN</span>
          </div>
        </div>

        <div class="flex gap-8px mb-24px p-4px bg-secondary border-radius-8px">
          <button 
            v-for="act in stakeActions" 
            :key="act"
            class="color-text-primary-hover-not-disabled-not-active flex-1 txt-weight-light color-text-secondary cursor-pointer py-8px px-12px bg-transparent border-none border-radius-6px text-13px transition-all-02"
            :class="{ 'active bg-accent color-white': action === act }"
            @click="action = act"
          >
            {{ act }}
          </button>
        </div>

        <div class="flex flex-column gap-20px">
          <!-- Withdraw Rewards - No amount needed -->
          <div v-if="action === 'Withdraw'" class="p-0px pt-8px pb-8px">
            <div class="flex-align-start gap-12px p-16px border-radius-10px bg-primary-a10 border-1-primary-a15">
              <Info class="flex-shrink-0 color-primary mt-4px" :size="20" />
              <div class="flex flex-column gap-4px">
                <strong class="text-15px txt-weight-light color-text-primary">{{ t('Withdraw Staking Rewards') }}</strong>
                <p class="m-0px text-13px color-text-secondary line-height-14">{{ t('This will claim all pending rewards from this validator to your wallet.') }}</p>
              </div>
            </div>
          </div>

          <!-- Amount Input - Not for Withdraw -->
          <div v-else class="flex flex-column gap-8px">
            <label class="text-14px txt-weight-light color-text-primary">Amount to {{ action.toLowerCase() }}</label>
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

          <div v-if="action === 'Redelegate'" class="flex flex-column gap-8px">
            <label class="text-14px txt-weight-light color-text-primary">{{ t('Select New Validator') }}</label>
            <select v-model="target" class="w-full color-text-primary cursor-pointer py-12px px-16px bg-secondary border-1 border-radius-8px text-14px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow">
              <option value="">{{ t('Choose validator...') }}</option>
              <option v-for="val in validators.filter(v => v.address !== selectedValidator?.address)" :key="val.address" :value="val.address">
                {{ val.moniker }}
              </option>
            </select>
          </div>

          <div v-if="txStatus !== 'idle'" class="z-10001 animate-popup-fade-in p-32px fixed bg-primary border-radius-16px top-half left-half translate-center shadow-lg min-w-400px max-w-90vw" :style="popupStyleFor(txStatus)">
            <div class="flex-align-center flex-column gap-24px text-center">
              <UiResultState v-if="txStatus === 'processing'" :title="t('Processing Transaction')" :description="txMessage">
                <template #icon><UiSpinner size="lg" /></template>
              </UiResultState>

              <UiResultState v-else-if="txStatus === 'success'" :title="t('Transaction Successful!')" :description="txMessage">
                <template #icon><CircleCheckBig class="animate-icon-bounce" :size="48" color="rgba(var(--color-success-rgb), 0.7)" /></template>
                <template #action>
                  <div v-if="txHash" class="w-full mt-12px p-12px bg-secondary border-radius-8px border-1">
                    <small class="block text-11px color-text-tertiary mb-4px text-uppercase letter-spacing-005em">{{ t('Transaction Hash:') }}</small>
                    <UiButton variant="none" @click="$emit('view-transaction')" class="reveal-on-hover hover-translate-x-2px flex-align-center gap-8px cursor-pointer w-full">
                      <code class="flex-1 mono text-12px color-primary break-all txt-weight-light">{{ txHash }}</code>
                      <ExternalLink class="reveal-target flex-shrink-0 color-primary opacity-70 transition-opacity-02" :size="16" />
                    </UiButton>
                  </div>
                  <button class="mt-16px txt-weight-light cursor-pointer bg-accent color-white border-none border-radius-6px text-14px transition-all-02 hover-lift-1 py-10px px-32px hover-shadow-primary" @click="$emit('update:modelValue', false)">{{ t('Close') }}</button>
                </template>
              </UiResultState>

              <UiResultState v-else-if="txStatus === 'error'" :title="t('Transaction Failed')" :description="txMessage">
                <template #icon><CircleAlert class="animate-icon-bounce" :size="48" color="var(--color-error)" /></template>
                <template #action>
                  <UiButton variant="primary" class="mt-8px" @click="$emit('reset')">{{ t('Try Again') }}</UiButton>
                </template>
              </UiResultState>
            </div>
          </div>

          <UiButton
            variant="primary"
            block
            @click="$emit('confirm')"
            :disabled="!canConfirm || isProcessingTx"
          >
            <span v-if="!isProcessingTx">Confirm {{ action }}</span>
            <span v-else>{{ t('Processing...') }}</span>
          </UiButton>
        </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiResultState from '../ui/UiResultState.vue';
import { CircleAlert, CircleCheckBig, ExternalLink, Info } from 'lucide-vue-next';
import type { StakeAction } from '../types/networkPage';
import type { Validator } from '../types/explorerPage';

/**
 * Delegating, undelegating, redelegating or withdrawing against one
 * validator, and the transaction that results.
 *
 * The chosen action, the amount and the redelegation target write back to the
 * page, which is what actually signs and broadcasts; the transaction status it
 * reports comes back as props so this component can show the three outcomes
 * without knowing how any of them happened.
 */
defineProps<{
  modelValue: boolean;
  selectedValidator: { moniker?: string; address?: string } | null;
  stakedBalance: string;
  availableBalance: string;
  /** Validators the stake can be moved to - redelegation only. */
  validators: Validator[];
  stakeActions: StakeAction[];
  canConfirm: boolean;
  isProcessingTx?: boolean;
  txStatus: 'idle' | 'processing' | 'success' | 'error';
  txMessage?: string;
  txHash?: string;
}>();
/** The outcome tints the popup's border - the only thing the status draws here. */
function popupStyleFor(status: string): Record<string, string> {
  if (status === 'success') return { border: '2px solid rgba(var(--color-success-rgb), 0.5)' };
  if (status === 'error') return { border: '2px solid var(--color-error)' };
  return { border: '2px solid var(--color-primary)' };
}

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'reset'): void;
  (e: 'set-percentage', percent: number): void;
  (e: 'view-transaction'): void;
}>();

const action = defineModel<StakeAction>('action', { required: true });
const amount = defineModel<string>('amount', { required: true });
const percentage = defineModel<number>('percentage', { required: true });
const target = defineModel<string>('target', { required: true });
</script>