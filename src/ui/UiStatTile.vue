<template>
  <div class="flex flex-column gap-4px p-20px border-radius-12px bg-card border-1">
    <span class="color-text-tertiary text-uppercase color-text-secondary fw-500 text-13px">{{ label }}</span>
    <span class="bg-gradient-accent-text txt-weight-medium color-text-primary text-24px gradient-text-clip">{{ value }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
