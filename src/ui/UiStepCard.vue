<template>
  <UiCard padding="none" :shadow="false" class="flex gap-16px p-20px">
    <div class="flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-16px">{{ number }}</div>
    <div>
      <h4 class="color-text-primary txt-weight-medium text-14px m-0px mb-4px">{{ title }}</h4>
      <p class="color-text-secondary text-13px line-height-14 m-0px"><slot /></p>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

defineProps<{
  number: number | string;
  title: string;
}>();
</script>
