<template>
  <span
    class="inline-flex align-center justify-center"
    :class="sizeClass"
    aria-busy="true"
  >
    <span class="spinner"></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md';
}>(), { size: 'md' });

const sizeClass = computed(() => props.size === 'sm' ? 'spinner-sm' : 'spinner-md');
</script>

<style scoped>
.spinner {
  border-radius: 999px;
  border: 2px solid rgba(148, 163, 184, 0.3);
  border-top-color: rgba(30, 64, 175, 1);
  width: 1rem;
  height: 1rem;
  animation: spin 0.6s linear infinite;
}
.spinner-sm .spinner {
  width: .75rem;
  height: .75rem;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

