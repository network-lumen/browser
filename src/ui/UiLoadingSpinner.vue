<template>
  <div class="border-radius-full w-40px h-40px border-3-fill-secondary spinner-accent" :aria-label="ariaLabel || undefined"></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  ariaLabel?: string;
}>(), {
  ariaLabel: '',
});
</script>
