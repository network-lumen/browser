<template>
  <UiCard border-class="border-1" radius="14px" padding-class="py-20px px-24px" :shadow="false" hoverable hover-class="transition-all-02 hover-bg-primary hover-lift-2 hover-shadow-md">
    <div class="netpage-card-label color-text-secondary mb-16px text-uppercase txt-weight-light text-12px letter-spacing-008em">{{ label }}</div>
    <div class="netpage-card-value color-text-primary txt-weight-medium mb-12px line-height-1 text-36px"><slot /></div>
    <div class="netpage-card-detail color-text-secondary txt-weight-normal text-13px">{{ detail }}</div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

defineProps<{
  label: string;
  detail: string;
}>();
</script>
