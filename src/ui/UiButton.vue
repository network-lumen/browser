<template>
  <button
    class="flex-align-justify-center"
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

type Variant = 'ghost' | 'primary' | 'icon' | 'cta' | 'none';
type Size = 'sm' | 'md';

const props = withDefaults(defineProps<{
  variant?: Variant;
  size?: Size;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}>(), {
  variant: 'none',
  size: 'md',
  block: false,
  disabled: false,
  type: 'button'
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();

const variantClass: Record<Variant, string> = {
  ghost: 'button-ghost bg-transparent color-text-primary cursor-pointer border-radius-10px padding-50',
  primary: 'button-primary color-white cursor-pointer border-radius-10px padding-50',
  icon: 'button-icon bg-transparent border-none cursor-pointer color-text-secondary border-radius-circle padding-25',
  cta: 'button-cta bg-fill-tertiary color-text-primary cursor-pointer border-radius-10px padding-50',
  none: ''
};

const sizeClass: Record<Size, string> = {
  sm: 'txt-xs',
  md: 'txt-sm'
};

const computedClass = computed(() => [
  variantClass[props.variant],
  sizeClass[props.size],
  props.block ? 'w-full' : '',
  props.disabled ? 'opacity-70 cursor-not-allowed' : ''
].filter(Boolean).join(' '));
</script>
