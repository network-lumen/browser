<template>
  <label class="flex flex-column gap-6px">
    <span :class="labelClass"><slot name="label">{{ label }}</slot></span>
    <slot />
    <span v-if="hint" class="text-12px color-text-tertiary fw-500">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  hint?: string;
  /** Override for the label span's color/size/weight classes. */
  labelClass?: string;
}>(), {
  label: '',
  hint: '',
  labelClass: 'text-12px color-text-tertiary',
});
</script>
