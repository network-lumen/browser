<template>
  <div
    class="border-bottom-1-light last-border-bottom-none"
    :class="flex
      ? 'flex-align-center hover-bg-secondary hover-mx-n15rem hover-padding-100-150 transition-bg-02 p-0px pt-16px pb-16px'
      : 'grid grid-cols-180-1fr gap-16px hover-bg-hover hover-border-radius-6px hover-mx-n05rem-px-05rem px-0px py-14px'"
  >
    <span
      class="text-14px"
      :class="flex ? 'blockdetail-label color-text-secondary txt-weight-light flex-0-0-180px' : 'chaindetail-label color-text-secondary fw-500'"
    >{{ label }}</span>
    <slot>
      <span :class="flex ? 'blockdetail-value color-text-primary flex-1 fw-500 text-15px' : 'break-all chaindetail-value color-text-primary text-14px'">{{ value }}</span>
    </slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value?: string | number;
  /** BlockDetailPage's flex/fixed-180px row style, vs the default grid-cols-180-1fr style used by Address/TransactionDetailPage. */
  flex?: boolean;
}>(), {
  flex: false,
});
</script>
