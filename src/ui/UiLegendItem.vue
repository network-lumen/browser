<template>
  <div class="explorer-legend-item flex-align-center gap-6px text-13px">
    <span
      v-if="dotClass || dotColor"
      class="explorer-legend-dot border-radius-circle flex-shrink-0 w-10px h-10px"
      :class="dotClass"
      :style="dotColor ? { background: dotColor } : undefined"
    ></span>
    <span class="explorer-legend-label flex-1 color-text-secondary">{{ label }}</span>
    <span class="explorer-legend-value txt-weight-light color-text-primary">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  value: string;
  /** Static dot color class (e.g. a bg-gradient or bg-legend-* token). */
  dotClass?: string;
  /** Dynamic dot color (CSS color value), for per-item computed colors. */
  dotColor?: string;
}>(), {
  dotClass: '',
  dotColor: '',
});
</script>
