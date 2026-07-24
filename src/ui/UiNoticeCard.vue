<template>
  <div class="flex flex-column gap-4px border-radius-12px" :class="cardClass">
    <span class="color-text-primary text-13px txt-weight-light">{{ title }}</span>
    <span class="color-text-tertiary text-12px line-height-14">{{ description }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  description: string;
  cardClass?: string;
}>(), {
  cardClass: 'bg-fill-tertiary p-14px border-05-light',
});
</script>
