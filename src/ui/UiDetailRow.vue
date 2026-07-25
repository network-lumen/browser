<template>
  <div
    class="last-border-bottom-none"
    :class="rowClass"
  >
    <span
      :class="[labelClass, labelExtraClass]"
    >{{ label }}</span>
    <slot>
      <span :class="valueClass || defaultValueClass">{{ value }}</span>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'grid' | 'flex' | 'compact' | 'baseline' | 'modal';

const props = withDefaults(defineProps<{
  label: string;
  value?: string | number;
  /**
   * grid: Address/TransactionDetailPage's grid-cols-180-1fr style (default).
   * flex: BlockDetailPage's flex/fixed-180px style.
   * compact: SubscriptionsView's tight, borderless, no-hover style.
   * baseline: LumenSiteModalHost's small permission-summary rows (11px/12px
   * label, baseline-aligned, no border/hover - a modal detail, not a list row).
   * modal: DrivePage's info-modal rows (Local/Gateway details, backup
   * summaries) - bordered divider between rows, 14px/15px text.
   */
  variant?: Variant;
  /** Override for the value's color/weight/font class. */
  valueClass?: string;
  /** Extra classes appended to the label (e.g. flex-shrink-0 when the value wraps). */
  labelExtraClass?: string;
}>(), {
  variant: 'grid',
  valueClass: '',
  labelExtraClass: '',
});

const rowClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'border-bottom-1-light flex-align-center hover-bg-secondary hover-mx-n15rem hover-padding-100-150 transition-bg-02 p-0px pt-16px pb-16px';
    case 'compact':
      return 'flex-align-center-justify-space-between text-13px py-6px px-0px';
    case 'baseline':
      return 'flex-align-baseline flex-justify-space-between gap-12px py-6px px-0px';
    case 'modal':
      return 'flex-align-center-justify-space-between gap-12px py-10px border-bottom-1 last-border-bottom-none';
    default:
      return 'border-bottom-1-light grid grid-cols-180-1fr gap-16px hover-bg-hover hover-border-radius-6px hover-mx-n05rem-px-05rem px-0px py-14px';
  }
});

const labelClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'color-text-secondary txt-weight-light flex-0-0-180px text-14px';
    case 'compact':
      return 'color-text-secondary text-14px';
    case 'baseline':
      return 'color-text-secondary text-12px';
    case 'modal':
      return 'color-text-secondary text-14px';
    default:
      return 'color-text-secondary fw-500 text-14px';
  }
});

const defaultValueClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'color-text-primary flex-1 fw-500 text-15px';
    case 'compact':
      return 'color-text-primary fw-500';
    case 'baseline':
      return 'color-text-primary text-right text-13px overflow-hidden txt-overflow-ellipsis max-w-360px';
    case 'modal':
      return 'color-text-primary text-15px fw-500';
    default:
      return 'break-all color-text-primary text-14px';
  }
});
</script>
