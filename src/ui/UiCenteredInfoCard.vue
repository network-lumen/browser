<template>
  <div class="color-text-primary p-24px border-radius-12px text-center border-default transition-all-02 bg-secondary hover-border-accent hover-shadow-primary">
    <slot name="icon" />
    <h4 class="text-12px line-height-12 txt-weight-strong mt-8px m-0px">{{ title }}</h4>
    <p class="text-11px line-height-12 color-text-tertiary mt-4px m-0px">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>
