<template>
  <div class="flex flex-column flex-align-justify-center" :class="wrapperClass">
    <UiSpinner size="lg" :class="spinnerClass" />
    <p v-if="message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import UiSpinner from './UiSpinner.vue';

withDefaults(defineProps<{
  message?: string;
  wrapperClass?: string;
  spinnerClass?: string;
}>(), {
  message: '',
  wrapperClass: 'color-text-secondary py-64px px-32px',
  spinnerClass: 'mb-16px',
});
</script>
