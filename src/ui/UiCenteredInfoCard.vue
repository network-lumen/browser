<template>
  <div class="color-text-primary p-24px border-radius-12px text-center border-default transition-all-02 bg-secondary hover-border-accent hover-shadow-primary">
    <div class="flex-align-justify-center border-radius-12px bg-fill-tertiary color-primary size-48px mx-auto">
      <slot name="icon" />
    </div>
    <h4 class="text-14px txt-weight-medium mt-12px m-0px">{{ title }}</h4>
    <p class="text-13px line-height-14 color-text-tertiary mt-4px m-0px">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>
