<template>
  <div>
    <div class="text-12px color-text-tertiary">{{ label }}</div>
    <div class="color-text-primary text-14px mt-4px" :class="valueClass">
      <slot>{{ value }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value?: string;
  /** Extra value classes (e.g. mono for hashes/addresses). */
  valueClass?: string;
}>(), {
  value: '',
  valueClass: '',
});
</script>
