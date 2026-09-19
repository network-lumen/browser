<template>
  <UiModal :model-value="modelValue" :title="t('Place a bid')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
      <p class="text-14px color-text-tertiary m-0px mb-12px">{{ t('Bid on a domain whose registration lapsed and is now open to anyone.') }}</p>

      <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
        <div class="txt-weight-light text-15px">{{ auction?.name || 'mydomain.lmn' }}</div>
        <div class="text-13px mt-4px">{{ closesLabel }}</div>
      </div>

      <div class="flex flex-column gap-8px mb-16px">
        <div class="flex-align-center flex-justify-space-between color-text-primary text-13px border-radius-10px bg-secondary border-1 py-8px px-12px">
          <span>{{ t('Highest bid') }}</span>
          <span class="txt-weight-light">{{ highestBidLabel }}</span>
        </div>
        <div class="flex-align-center flex-justify-space-between color-text-primary text-13px border-radius-10px bg-secondary border-1 py-8px px-12px">
          <span>{{ t('Minimum bid') }}</span>
          <span class="txt-weight-light">{{ minimumBidLabel }}</span>
        </div>
      </div>

      <div class="mb-16px">
        <label class="color-text-secondary block mb-4px text-13px">{{ t('Your bid') }}</label>
        <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" type="text"
          :model-value="amount" @update:model-value="$emit('update:amount', $event)"
          placeholder="0.00" class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
        <p v-if="amountError" class="text-12px color-error mt-8px">{{ amountError }}</p>
        <p v-else class="text-12px color-text-tertiary mt-8px">{{ t('In LMN. The network also refuses anything below one year of registration for this name, and anything your wallet cannot cover.') }}</p>
      </div>

      <div class="flex-align-center flex-justify-space-between color-text-primary text-13px border-radius-10px bg-secondary border-1 py-8px px-12px">
        <span>{{ t('Bid fee') }}</span>
        <span class="txt-weight-light">{{ bidFeeLabel }}</span>
      </div>

      <!--
        What a bid actually commits to, which chain v2.0.0 reversed. A bid used
        to be a promise: nothing was checked and nothing moved until settlement,
        so anyone could name any figure from an empty wallet. The amount is held
        by the network from the moment the bid is placed now, and returned in
        full the moment someone outbids it. The fee is separate and is gone
        either way.
      -->
      <UiWarningBox box-class="mt-16px">
        {{ t('Your bid leaves your wallet now and is held by the network. It comes back in full if someone outbids you, and buys the domain if you win. The bid fee is charged on top and is not refunded.') }}
      </UiWarningBox>

      <div class="flex flex-justify-end gap-8px mt-16px">
        <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" class="outline-none">
          {{ t('Cancel') }}
        </UiButton>
        <UiButton variant="primary" type="button" @click="$emit('submit')" :disabled="!canSubmit || busy" class="outline-none">
          <span v-if="!busy" class="flex-inline-align-center gap-8px">
            <Gavel :size="16" />
            {{ t('Place a bid') }}
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
import UiWarningBox from '../ui/UiWarningBox.vue';
import { Gavel } from 'lucide-vue-next';

/**
 * Bidding on a lapsed domain.
 *
 * Every number shown here is formatted by the caller from an integer string:
 * bids are uint64 compared as integers on the chain, and one that has been
 * through a float has already lost its last digits - which, for a bid, means
 * losing to the offer it was meant to beat.
 */
defineProps<{
  modelValue: boolean;
  auction: { name?: string } | null;
  /** When the window closes, already formatted. */
  closesLabel: string;
  highestBidLabel: string;
  /** One ulmn above the standing bid, or the floor when nobody has bid. */
  minimumBidLabel: string;
  amount: string;
  /** Set when what was typed cannot be bid; the hint below is replaced by it. */
  amountError: string;
  bidFeeLabel: string;
  canSubmit: boolean;
  busy?: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:amount', value: string): void;
  (e: 'submit'): void;
}>();
</script>
