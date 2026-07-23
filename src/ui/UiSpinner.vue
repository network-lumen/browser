<template>
  <span
    class="flex-inline-align-justify-center line-height-0"
    :style="{ color: 'var(--spinner-color, var(--text-secondary))' }"
    aria-busy="true"
  >
    <svg
      class="overflow-visible transform-origin-center"
      viewBox="0 0 24 24"
      aria-hidden="true"
      :style="{ width: sizeConfig.size, height: sizeConfig.size, animation: 'spin 0.95s linear infinite' }"
    >
      <circle
        cx="12" cy="12" r="8.5"
        fill="none"
        vector-effect="non-scaling-stroke"
        :stroke-width="sizeConfig.stroke"
        stroke="currentColor"
        opacity="0.1"
      ></circle>
      <circle
        cx="12" cy="12" r="8.5"
        fill="none"
        vector-effect="non-scaling-stroke"
        :stroke-width="sizeConfig.stroke"
        :style="{ stroke: tailStrokeColor }"
        opacity="0.22"
        stroke-linecap="round"
        stroke-dasharray="12 44"
        stroke-dashoffset="8"
      ></circle>
      <circle
        cx="12" cy="12" r="8.5"
        fill="none"
        vector-effect="non-scaling-stroke"
        :stroke-width="sizeConfig.stroke"
        :style="{ stroke: arcStrokeColor, animation: 'spin-sweep 1.45s ease-in-out infinite' }"
        stroke-linecap="round"
        stroke-dasharray="12 44"
        stroke-dashoffset="0"
      ></circle>
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
}>(), { size: 'md' });

const sizeConfigMap: Record<'sm' | 'md' | 'lg', { size: string; stroke: string }> = {
  sm: { size: '0.875rem', stroke: '1.8px' },
  md: { size: '1rem', stroke: '2px' },
  lg: { size: '1.5rem', stroke: '2.35px' },
};

const sizeConfig = computed(() => sizeConfigMap[props.size]);

const tailStrokeColor = 'color-mix(in srgb, var(--accent-primary) 35%, currentColor 65%)';
const arcStrokeColor = 'color-mix(in srgb, var(--accent-primary) 78%, currentColor 22%)';
</script>
