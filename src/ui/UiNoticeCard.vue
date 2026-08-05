<template>
  <div class="flex flex-column gap-4px border-radius-12px bg-fill-tertiary p-14px border-05-light">
    <span class="color-text-primary text-13px txt-weight-light">{{ title }}</span>
    <span class="color-text-tertiary text-12px line-height-14">{{ description }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>
