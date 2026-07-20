<template>
  <div class="bg-card border-default" :class="computedClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const props = withDefaults(defineProps<{
  padding?: Padding;
  shadow?: boolean;
  hoverable?: boolean;
  radius?: string;
}>(), {
  padding: 'md',
  shadow: true,
  hoverable: false,
  radius: 'lg',
});

const paddingClass: Record<Padding, string> = {
  none: '',
  sm: 'padding-75',
  md: 'padding-100',
  lg: 'padding-150',
};

const computedClass = computed(() => [
  `border-radius-${props.radius}`,
  paddingClass[props.padding],
  props.shadow ? 'shadow-subtle' : '',
  props.hoverable ? 'hover-bg-hover hover-border-ios-blue hover-lift-1 transition-all-02' : '',
].filter(Boolean).join(' '));
</script>
