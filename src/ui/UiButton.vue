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
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  cursor: pointer;
  padding: .5rem;
}
.button-ghost:where(:hover, :focus-visible) {
  background: var(--hover-bg);
}

.button-primary {
  background-color: var(--accent-primary);
  border: 1px solid transparent;
  border-radius: 10px;
  color: #fff;
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
  color: var(--text-secondary);
}
.button-icon:where(:hover, :focus-visible) {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.button-cta {
  background-color: var(--fill-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  cursor: pointer;
  padding: .5rem;
  font-weight: 700;
}
.button-cta:where(:hover, :focus-visible) {
  background: var(--fill-secondary);
}
</style>
