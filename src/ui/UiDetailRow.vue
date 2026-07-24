<template>
  <div
    class="last-border-bottom-none"
    :class="rowClass"
  >
    <span
      class="text-14px"
      :class="labelClass"
    >{{ label }}</span>
    <slot>
      <span :class="valueClass || defaultValueClass">{{ value }}</span>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'grid' | 'flex' | 'compact';

const props = withDefaults(defineProps<{
  label: string;
  value?: string | number;
  /**
   * grid: Address/TransactionDetailPage's grid-cols-180-1fr style (default).
   * flex: BlockDetailPage's flex/fixed-180px style.
   * compact: SubscriptionsView's tight, borderless, no-hover style.
   */
  variant?: Variant;
  /** Override for the value's color/weight/font class. */
  valueClass?: string;
}>(), {
  variant: 'grid',
  valueClass: '',
});

const rowClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'border-bottom-1-light flex-align-center hover-bg-secondary hover-mx-n15rem hover-padding-100-150 transition-bg-02 p-0px pt-16px pb-16px';
    case 'compact':
      return 'flex-align-center-justify-space-between text-13px py-6px px-0px';
    default:
      return 'border-bottom-1-light grid grid-cols-180-1fr gap-16px hover-bg-hover hover-border-radius-6px hover-mx-n05rem-px-05rem px-0px py-14px';
  }
});

const labelClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'color-text-secondary txt-weight-light flex-0-0-180px';
    case 'compact':
      return 'color-text-secondary';
    default:
      return 'color-text-secondary fw-500';
  }
});

const defaultValueClass = computed(() => {
  switch (props.variant) {
    case 'flex':
      return 'color-text-primary flex-1 fw-500 text-15px';
    case 'compact':
      return 'color-text-primary fw-500';
    default:
      return 'break-all color-text-primary text-14px';
  }
});
</script>
