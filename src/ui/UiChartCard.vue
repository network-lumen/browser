<template>
  <UiCard padding="none" :shadow="false" class="p-20px shadow-sm min-h-220px backdrop-blur">
    <UiChartHeader :title="title">
      <slot name="header" />
    </UiChartHeader>
    <div class="explorer-chart-container">
      <slot />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';
import UiChartHeader from './UiChartHeader.vue';

defineProps<{
  title: string;
}>();
</script>
