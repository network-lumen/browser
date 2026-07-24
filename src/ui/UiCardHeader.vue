<template>
  <div class="border-bottom-1" :class="[bgClass, paddingClass]">
    <h2 class="color-text-primary m-0px" :class="titleClass">{{ title }}</h2>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  bgClass?: string;
  paddingClass?: string;
  titleClass?: string;
}>(), {
  bgClass: 'bg-secondary',
  paddingClass: 'p-0px pt-16px pr-24px pb-16px pl-24px',
  titleClass: 'text-16px letter-spacing-0025em',
});
</script>
