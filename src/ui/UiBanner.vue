<template>
  <div :class="variantClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const variantClasses: Record<'neutral' | 'warning' | 'info' | 'error' | 'success', string> = {
  neutral: 'border-radius-10px color-text-primary bg-secondary border-1 text-14px line-height-15 py-12px px-16px',
  /**
   * The tint and the border are set by single classes rather than by pairing a
   * neutral one with a colour override. `bg-secondary` is declared after
   * `bg-warning-a08` in colors.css, and `border-1` lives in borders.css which
   * loads after colors.css entirely - so both overrides lost, and every warning
   * banner in the app rendered as a neutral one.
   */
  warning: 'border-radius-10px color-text-primary bg-warning-a08 border-1-warning-a30 text-14px line-height-15 py-12px px-16px',
  info: 'border-radius-10px text-13px color-text-primary bg-fill-blue py-10px px-12px border-05-primary-a20',
  error: 'border-radius-10px text-13px color-error bg-fill-error py-10px px-12px border-05-error-a25',
  success: 'border-radius-10px text-13px color-success bg-fill-success py-10px px-12px border-05-success-a25',
};

const props = withDefaults(defineProps<{
  variant?: 'neutral' | 'warning' | 'info' | 'error' | 'success';
}>(), {
  variant: 'neutral',
});

const variantClass = computed(() => variantClasses[props.variant]);
</script>
