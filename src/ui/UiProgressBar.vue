<template>
  <div class="border-radius-full relative overflow-hidden" :class="trackClass">
    <div
      class="h-full bg-gradient-primary border-radius-inherit transition-width-02"
      :class="{ 'progress-fill-indeterminate': indeterminate }"
      :style="{ width: percent == null ? '100%' : `${clampPercent(percent)}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { clampPercent } from '../internal/services/coerce';

withDefaults(defineProps<{
  /** null renders a full (or indeterminate, see below) bar - "we don't know the % yet". */
  percent?: number | null;
  /** Caller decides what counts as indeterminate (e.g. percent == null && stillRunning). */
  indeterminate?: boolean;
  trackClass?: string;
}>(), {
  percent: null,
  indeterminate: false,
  trackClass: 'w-full h-8px bg-fill-secondary',
});
</script>
