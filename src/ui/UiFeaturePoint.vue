<template>
  <div class="flex gap-12px text-left flex-align-start">
    <div class="text-24px line-height-1">{{ icon }}</div>
    <div class="flex flex-column gap-2px">
      <strong class="color-text-primary text-14px">{{ title }}</strong>
      <span class="color-text-secondary text-13px">{{ description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
}>();
</script>
