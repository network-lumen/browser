<template>
  <div :class="wrapperClass">
    <label :class="labelClass">
      <slot name="label">{{ label }}</slot><span v-if="required" class="color-error"> *</span>
    </label>
    <div class="relative" :class="{ 'opacity-70': dimmed }">
      <slot />
    </div>
    <div v-if="hint || $slots.hint" class="mt-8px text-13px" :class="hintClass">
      <slot name="hint">{{ hint }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  /** Appends a red "*" after the label. */
  required?: boolean;
  /** Fades the control - used for read-only "display only" fields. */
  dimmed?: boolean;
  hint?: string;
  /** Override for the hint's color (e.g. color-error for a validation message). */
  hintClass?: string;
  wrapperClass?: string;
  labelClass?: string;
}>(), {
  label: '',
  required: false,
  dimmed: false,
  hint: '',
  hintClass: 'color-text-secondary',
  wrapperClass: 'mb-20px',
  labelClass: 'block text-14px txt-weight-light color-text-primary mb-8px',
});
</script>
