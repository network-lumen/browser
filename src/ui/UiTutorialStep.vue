<template>
  <UiCard padding="none" :shadow="false" class="p-20px">
    <div class="helppage-step-header flex-align-center gap-12px mb-8px">
      <div class="flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">{{ number }}</div>
      <h4 class="color-text-primary m-0px txt-weight-medium text-16px">{{ title }}</h4>
    </div>
    <p class="color-text-secondary text-14px line-height-15 m-0px mb-12px"><slot /></p>
    <slot name="action" />
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

defineProps<{
  number: number | string;
  title: string;
}>();
</script>
