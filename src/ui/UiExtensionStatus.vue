<template>
  <div class="w-full text-14px text-center flex-align-justify-center p-24px color-white-a82" :class="[{ 'color-extension-error': error }, extraClass]">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  error?: boolean;
  extraClass?: string;
}>(), {
  error: false,
  extraClass: '',
});
</script>
