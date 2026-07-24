<template>
  <div class="border-radius-10px bg-primary-a10" :class="cardClass">
    <div class="flex-align-center flex-justify-space-between gap-12px mb-8px">
      <span class="text-12px text-uppercase txt-weight-medium color-primary letter-spacing-004em">{{ status }}</span>
      <span v-if="counter" class="text-12px color-text-secondary">{{ counter }}</span>
    </div>
    <UiProgressBar :percent="percent" :indeterminate="indeterminate" />
    <div class="color-text-secondary mt-8px break-word" :class="textClass">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
import UiProgressBar from './UiProgressBar.vue';

withDefaults(defineProps<{
  status: string;
  counter?: string;
  percent?: number | null;
  indeterminate?: boolean;
  text: string;
  cardClass?: string;
  textClass?: string;
}>(), {
  counter: '',
  percent: null,
  indeterminate: false,
  cardClass: 'mt-12px py-10px px-12px border-05-primary-a18',
  textClass: 'text-12px',
});
</script>
