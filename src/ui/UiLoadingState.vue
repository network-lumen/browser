<template>
  <div class="flex flex-column flex-align-justify-center gap-16px" :class="wrapperClass">
    <UiLoadingSpinner />
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import UiLoadingSpinner from './UiLoadingSpinner.vue';

withDefaults(defineProps<{
  message?: string;
  wrapperClass?: string;
}>(), {
  message: '',
  wrapperClass: 'min-h-300px',
});
</script>
