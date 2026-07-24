<template>
  <div :class="computedClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const props = withDefaults(defineProps<{
  padding?: Padding;
  /** Overrides `padding` with a raw class (or classes) — for one-off values the size tokens don't cover. */
  paddingClass?: string;
  shadow?: boolean;
  hoverable?: boolean;
  /** Overrides the default hover treatment with a raw class (or classes), for pages with a bespoke hover look. */
  hoverClass?: string;
  radius?: string;
  /** Raw background class. Defaults to the standard card surface. */
  bgClass?: string;
  /** Raw border class. Defaults to the standard card border. */
  borderClass?: string;
}>(), {
  padding: 'md',
  paddingClass: '',
  shadow: true,
  hoverable: false,
  hoverClass: '',
  radius: 'lg',
  bgClass: 'bg-card',
  borderClass: 'border-default',
});

const paddingSizeClass: Record<Padding, string> = {
  none: '',
  sm: 'p-12px',
  md: 'p-16px',
  lg: 'p-24px',
};

const computedClass = computed(() => [
  props.bgClass,
  props.borderClass,
  `border-radius-${props.radius}`,
  props.paddingClass || paddingSizeClass[props.padding],
  props.shadow ? 'shadow-subtle' : '',
  props.hoverable ? (props.hoverClass || 'hover-bg-hover hover-border-primary hover-lift-1 transition-all-02') : '',
].filter(Boolean).join(' '));
</script>
