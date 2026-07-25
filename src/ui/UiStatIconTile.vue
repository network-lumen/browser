<template>
  <UiCard class="flex-align-center gap-16px" radius="12px" padding-class="p-20px" border-class="border-1" :bg-class="cardBgClass" :shadow="false">
    <div class="flex-align-justify-center size-48px border-radius-12px" :class="iconClass">
      <slot name="icon" />
    </div>
    <div>
      <div class="txt-weight-medium color-text-primary text-24px">{{ value }}</div>
      <div class="color-text-tertiary text-uppercase text-14px">{{ label }}</div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

withDefaults(defineProps<{
  label: string;
  value: string | number;
  /** Icon-well background/color classes - varies per tile. */
  iconClass?: string;
  /** Overrides the card's background - for a bolder "hero" tile look. */
  cardBgClass?: string;
}>(), {
  iconClass: '',
  cardBgClass: 'bg-card',
});
</script>
