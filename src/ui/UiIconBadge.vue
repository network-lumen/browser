<template>
  <div class="flex-0-0-auto flex-align-justify-center border-radius-circle" :class="[sizeClass, badgeClass]">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  sizeClass?: string;
  /** Icon/background color classes - can also be an array/object for dynamic status coloring. */
  badgeClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>;
}>(), {
  sizeClass: 'size-40px',
  badgeClass: '',
});
</script>
