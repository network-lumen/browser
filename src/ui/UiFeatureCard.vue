<template>
  <UiCard padding="none" :shadow="false" class="flex gap-16px p-20px">
    <div class="flex-align-justify-center border-radius-12px bg-fill-tertiary color-primary flex-shrink-0 size-48px">
      <slot name="icon" />
    </div>
    <div>
      <h4 class="color-text-primary txt-weight-medium text-14px m-0px mb-4px">{{ title }}</h4>
      <p class="color-text-secondary m-0px text-13px line-height-14"><slot /></p>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

defineProps<{
  title: string;
}>();
</script>
