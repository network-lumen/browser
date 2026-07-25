<template>
  <div class="flex-align-center-justify-space-between mb-8px">
    <h3 class="text-15px txt-weight-light color-text-primary">{{ title }}</h3>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
