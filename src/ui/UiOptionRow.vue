<template>
  <UiCard padding="none" :shadow="false" class="flex-align-center-justify-space-between py-16px px-20px transition-all-fast hover-bg-hover hover-border-primary hover-lift-1 hover-shadow-sm">
    <div class="flex flex-column gap-4px">
      <span class="txt-weight-light color-text-primary text-14px"><slot name="label">{{ label }}</slot></span>
      <span v-if="description || $slots.description" class="color-text-secondary text-13px"><slot name="description">{{ description }}</slot></span>
    </div>
    <div v-if="$slots.default" class="flex-align-center" :class="controlClass">
      <slot />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label?: string;
  description?: string;
  /** Extra utility classes for the control-side wrapper (e.g. gap/wrap/justify variants). */
  controlClass?: string;
}>(), {
  label: '',
  description: '',
  controlClass: '',
});
</script>
