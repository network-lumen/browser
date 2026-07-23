<template>
  <span
    class="ui-spinner flex-inline-align-justify-center line-height-0"
    :class="sizeClass"
    aria-busy="true"
  >
    <svg class="ui-spinner__svg overflow-visible transform-origin-center" viewBox="0 0 24 24" aria-hidden="true">
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
