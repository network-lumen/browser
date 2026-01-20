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
  ghost: 'button-ghost',
  primary: 'button-primary',
  icon: 'button-icon',
  cta: 'button-cta',
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

<style scoped>
.button-ghost {
  background-color: transparent;
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  border-radius: 10px;
  color: var(--text-primary, #000);
  cursor: pointer;
  padding: .5rem;
}
.button-ghost:where(:hover, :focus-visible) {
  background: var(--hover-bg, rgba(0, 0, 0, 0.04));
}

.button-primary {
  background-color: var(--accent-primary, #007aff);
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--white, #fff);
  cursor: pointer;
  padding: .5rem;
}
.button-primary:where(:hover, :focus-visible) {
  filter: brightness(0.95);
}

.button-icon {
  background-color: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: .25rem;
  color: var(--text-secondary, #3c3c43);
}
.button-icon:where(:hover, :focus-visible) {
  background: var(--hover-bg, rgba(0, 0, 0, 0.04));
  color: var(--text-primary, #000);
}

.button-cta {
  background-color: var(--fill-tertiary, rgba(118, 118, 128, 0.12));
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  border-radius: 10px;
  color: var(--text-primary, #000);
  cursor: pointer;
  padding: .5rem;
  font-weight: 700;
}
.button-cta:where(:hover, :focus-visible) {
  background: var(--fill-secondary, rgba(118, 118, 128, 0.16));
}
</style>
