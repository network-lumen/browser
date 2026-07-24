<template>
  <button
    class="flex-align-center cursor-pointer gap-16px border-radius-16px text-left py-16px px-20px border-default bg-card transition-all-fast hover-bg-hover hover-lift-1"
    type="button"
    @click="$emit('click', $event)"
  >
    <div class="flex-align-justify-center size-48px border-radius-14px flex-shrink-0" :class="iconClass">
      <slot name="icon" />
    </div>
    <div class="flex-1 flex flex-column gap-2px min-w-0">
      <span class="color-text-primary txt-weight-medium text-15px">{{ title }}</span>
      <span class="color-text-secondary text-13px">{{ description }}</span>
    </div>
    <ArrowRight :size="16" class="color-text-tertiary flex-shrink-0" />
  </button>
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';

withDefaults(defineProps<{
  title: string;
  description: string;
  /** Icon-well background/color classes - the accent color varies per card. */
  iconClass?: string;
}>(), {
  iconClass: '',
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
