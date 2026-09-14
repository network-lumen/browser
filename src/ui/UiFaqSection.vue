<template>
  <UiCard padding="none" radius="16px" :shadow="false" class="p-20px">
    <div class="flex-align-center gap-12px mb-16px">
      <div class="flex-align-justify-center size-40px border-radius-12px flex-shrink-0" :class="iconClass">
        <slot name="icon" />
      </div>
      <h3 class="color-text-primary txt-weight-strong m-0px text-18px">{{ title }}</h3>
    </div>
    <div class="flex flex-column gap-12px">
      <slot />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from './UiCard.vue';

/**
 * A titled group of questions, with the same coloured icon well as the help
 * page's action cards so a section reads as part of that page.
 */
defineProps<{
  title: string;
  /** Icon-well background/colour classes - the accent varies per section. */
  iconClass: string;
}>();
</script>
