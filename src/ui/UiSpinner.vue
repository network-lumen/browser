<template>
  <span
    class="ui-spinner inline-flex align-center justify-center"
    :class="sizeClass"
    aria-busy="true"
  >
    <svg class="ui-spinner__svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="ui-spinner__track" cx="12" cy="12" r="8.5"></circle>
      <circle class="ui-spinner__tail" cx="12" cy="12" r="8.5"></circle>
      <circle class="ui-spinner__arc" cx="12" cy="12" r="8.5"></circle>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
}>(), { size: 'md' });

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'ui-spinner-sm';
  if (props.size === 'lg') return 'ui-spinner-lg';
  return 'ui-spinner-md';
});
</script>

<style scoped>
.ui-spinner {
  --spinner-size: 1rem;
  --spinner-stroke: 2px;
  color: var(--spinner-color, var(--text-secondary, #64748b));
  line-height: 0;
}

.ui-spinner__svg {
  width: var(--spinner-size);
  height: var(--spinner-size);
  overflow: visible;
  transform-origin: center;
  animation: spin 0.95s linear infinite;
}

.ui-spinner__track,
.ui-spinner__tail,
.ui-spinner__arc {
  fill: none;
  stroke-width: var(--spinner-stroke);
  vector-effect: non-scaling-stroke;
}

.ui-spinner__track {
  stroke: currentColor;
  opacity: 0.1;
}

.ui-spinner__tail {
  stroke: color-mix(in srgb, var(--accent-primary, #0a84ff) 35%, currentColor 65%);
  opacity: 0.22;
  stroke-linecap: round;
  stroke-dasharray: 12 44;
  stroke-dashoffset: 8;
}

.ui-spinner__arc {
  stroke: color-mix(in srgb, var(--accent-primary, #0a84ff) 78%, currentColor 22%);
  stroke-linecap: round;
  stroke-dasharray: 12 44;
  stroke-dashoffset: 0;
  animation: spin-sweep 1.45s ease-in-out infinite;
}

.ui-spinner-sm {
  --spinner-size: 0.875rem;
  --spinner-stroke: 1.8px;
}

.ui-spinner-md {
  --spinner-size: 1rem;
  --spinner-stroke: 2px;
}

.ui-spinner-lg {
  --spinner-size: 1.5rem;
  --spinner-stroke: 2.35px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes spin-sweep {
  0% {
    stroke-dasharray: 10 46;
    stroke-dashoffset: 0;
    opacity: 0.78;
  }

  50% {
    stroke-dasharray: 30 26;
    stroke-dashoffset: -9;
    opacity: 1;
  }

  100% {
    stroke-dasharray: 10 46;
    stroke-dashoffset: -34;
    opacity: 0.78;
  }
}
</style>

