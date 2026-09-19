<template>
  <UiModal :model-value="modelValue" :title="t('Renew domain')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <div class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px">
      <p class="text-14px color-text-tertiary m-0px mb-12px">{{ t('Buy a new term on this domain before its grace period runs out and it goes to auction.') }}</p>

      <div class="border-radius-10px color-white mb-16px bg-gradient-primary py-12px px-16px">
        <div class="txt-weight-light text-15px">{{ domain?.name || 'mydomain.lmn' }}</div>
        <div class="text-13px mt-4px">{{ expiryLabel }}</div>
      </div>

      <!--
        What the chain is about to do with this name if nothing is paid.
        Renewal is accepted in the grace window and nowhere else, and that
        window is seven days wide by default - short enough that a domain page
        which only said "expired" was the last thing an owner read before
        losing the name.
      -->
      <UiWarningBox v-if="status === 'grace'" box-class="mb-16px">
        {{ t('This domain has expired and is in its grace period, which is the only window where it can be renewed. Renewing now keeps it. When the grace period ends it opens to public auction.') }}
      </UiWarningBox>
      <UiWarningBox v-else-if="status === 'auction'" box-class="mb-16px">
        {{ t('This domain is being auctioned and can no longer be renewed. Settling the auction ends it, and anyone can settle.') }}
      </UiWarningBox>
      <UiWarningBox v-else box-class="mb-16px">
        {{ t('This domain is still active, so the network refuses to renew it. Renewal opens when it expires and enters its grace period.') }}
      </UiWarningBox>

      <div class="mb-16px">
        <label class="color-text-secondary block mb-4px text-13px">{{ t('Renew for') }}</label>
        <div class="flex gap-8px flex-wrap-wrap">
          <UiSegmentedButton
            v-for="option in durationOptions"
            :key="option.days"
            :active="durationDays === option.days"
            @click="$emit('update:durationDays', option.days)"
          >
            {{ option.label }}
          </UiSegmentedButton>
        </div>
        <p class="text-12px color-text-tertiary mt-8px">{{ newExpiryLabel }}</p>
      </div>

      <div class="flex-align-center flex-justify-space-between color-text-primary text-13px border-radius-10px bg-secondary border-1 py-8px px-12px">
        <span>{{ t('Renewal price') }}</span>
        <span class="txt-weight-light">{{ priceLabel }}</span>
      </div>

      <div class="flex flex-justify-end gap-8px mt-16px">
        <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" class="outline-none">
          {{ t('Cancel') }}
        </UiButton>
        <UiButton variant="primary" type="button" @click="$emit('submit')" :disabled="!canSubmit || busy" class="outline-none">
          <span v-if="!busy" class="flex-inline-align-center gap-8px">
            <RefreshCw :size="16" />
            {{ t('Renew domain') }}
          </span>
          <UiSpinner v-else size="sm" />
        </UiButton>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiSegmentedButton from '../ui/UiSegmentedButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiWarningBox from '../ui/UiWarningBox.vue';
import { RefreshCw } from 'lucide-vue-next';
import type { DomainLifecycleStatus } from '../types/domainAuctions';

/**
 * Renewing a domain the profile owns, which the chain accepts only while the
 * name sits in its grace period.
 *
 * The duration is offered as a set of choices rather than a free number on
 * purpose: the chain reads `duration_days: 0` as the *maximum* registration
 * length and prices it accordingly, so an empty field is the most expensive
 * renewal there is rather than a harmless one.
 */
defineProps<{
  modelValue: boolean;
  domain: { name?: string } | null;
  /** Where the chain says this name is in its life, for the warning above. */
  status: DomainLifecycleStatus;
  expiryLabel: string;
  durationDays: number;
  /** What the renewal costs, quoted live - the price is governable. */
  priceLabel: string;
  /** The expiry this renewal would buy, already formatted. */
  newExpiryLabel: string;
  canSubmit: boolean;
  busy?: boolean;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:durationDays', value: number): void;
  (e: 'submit'): void;
}>();

/**
 * One year is the longest term the chain sells, in one call or any number of
 * them: `MaxRegistrationDurationDays` is 365 and both `Register` and `Renew`
 * refuse anything above it. The two- and three-year buttons that used to sit
 * here were quoted a price and then refused on broadcast.
 */
const durationOptions = computed(() => [
  { days: 90, label: t('3 months') },
  { days: 180, label: t('6 months') },
  { days: 365, label: t('1 year') }
]);

</script>
