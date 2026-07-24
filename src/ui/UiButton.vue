<template>
  <button
    class="flex-inline-align-center gap-10px"
    :type="type"
    :disabled="disabled"
    :class="computedClass"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'ghost' | 'primary' | 'secondary' | 'danger' | 'icon' | 'cta' | 'tag' | 'none';
type Size = 'sm' | 'md';

const props = withDefaults(defineProps<{
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  /** Only used when variant="icon" — lets callers restore their own shape instead of the default circle. */
  iconRadiusClass?: string;
  /** Only used when variant="icon" — lets callers drop/replace the default padding (e.g. when a fixed size-NNpx class already controls the box). */
  iconPaddingClass?: string;
}>(), {
  variant: 'none',
  size: 'md',
  block: false,
  disabled: false,
  type: 'button',
  iconRadiusClass: 'border-radius-circle',
  iconPaddingClass: 'p-4px'
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();

const variantClass: Record<Exclude<Variant, 'icon'>, string> = {
  ghost: 'button-ghost bg-transparent color-text-primary cursor-pointer border-radius-10px border-1',
  primary: 'button-primary-rich color-white cursor-pointer border-radius-10px border-none bg-gradient-primary shadow-0-4-15-primary-a4 shadow-0-8-25-primary-a5-hover',
  secondary: 'button-secondary cursor-pointer border-radius-10px border-1 bg-secondary color-text-primary hover-bg-hover',
  danger: 'button-danger cursor-pointer border-radius-10px border-none color-white bg-gradient-danger shadow-danger-a30 hover-bg-gradient-danger-deep hover-shadow-danger-a40',
  cta: 'button-cta bg-fill-tertiary color-text-primary cursor-pointer border-radius-10px border-1',
  tag: 'button-tag color-text-secondary cursor-pointer flex-inline-align-center gap-8px py-10px px-20px border-radius-full txt-weight-light bg-card text-14px border-15 transition-all-02 shadow-0-1-4-rgba-0-0-0-0-05',
  none: ''
};

const sizeClass: Record<Size, string> = {
  sm: 'text-11px line-height-12 py-8px px-16px',
  md: 'text-12px line-height-12 py-12px px-20px'
};

const computedClass = computed(() => {
  if (props.variant === 'icon') {
    return [
      'button-icon bg-transparent border-none cursor-pointer color-text-secondary',
      props.iconRadiusClass,
      props.iconPaddingClass,
      props.block ? 'w-full' : '',
      props.disabled ? 'opacity-70 cursor-not-allowed' : ''
    ].filter(Boolean).join(' ');
  }
  const usesSize = props.variant !== 'tag' && props.variant !== 'none';
  return [
    variantClass[props.variant],
    usesSize ? sizeClass[props.size] : '',
    props.block ? 'w-full' : '',
    props.disabled ? 'opacity-70 cursor-not-allowed' : ''
  ].filter(Boolean).join(' ');
});
</script>
