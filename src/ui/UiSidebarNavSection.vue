<template>
  <div class="flex flex-column gap-2px">
    <span v-if="title" class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">{{ title }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>
