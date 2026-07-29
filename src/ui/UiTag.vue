<template>
  <span class="flex-inline-align-center gap-6px py-4px px-10px border-radius-full text-12px border-1" :class="variantClass[props.variant]"><slot /></span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'neutral' | 'accent' | 'success';
}>(), {
  variant: 'neutral',
});

const variantClass: Record<'neutral' | 'accent' | 'success', string> = {
  neutral: 'color-text-secondary bg-secondary',
  accent: 'color-accent-secondary bg-primary-a10 border-color-primary-a15 txt-weight-medium',
  success: 'color-white bg-success border-color-success txt-weight-medium',
};
</script>
