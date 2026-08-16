<template>
  <div
    class="last-border-bottom-none flex-align-center-justify-space-between text-15px border-bottom-1 py-12px px-16px"
    :class="highlight ? 'txt-weight-medium color-text-primary border-top-2-border-color bg-secondary' : 'color-text-secondary'"
  >
    <span>{{ label }}</span>
    <span class="txt-weight-light mono" :class="valueClass">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value: string;
  /** Marks the emphasized "total"-style row (e.g. the final destination/net line). */
  highlight?: boolean;
  /** Override for the value's color class (e.g. color-warning for a tax line). */
  valueClass?: string;
}>(), {
  highlight: false,
  valueClass: 'color-text-primary',
});
</script>
