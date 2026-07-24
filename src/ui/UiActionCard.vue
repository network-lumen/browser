<template>
  <button
    class="flex-align-center cursor-pointer border-radius-16px text-left border-default bg-card transition-all-fast hover-bg-hover hover-lift-1"
    :class="cardClass"
    type="button"
    @click="$emit('click', $event)"
  >
    <div class="flex-align-justify-center border-radius-14px flex-shrink-0" :class="[iconSizeClass, iconClass]">
      <slot name="icon" />
    </div>
    <div class="flex-1 flex flex-column gap-2px min-w-0">
      <component :is="titleTag" class="m-0px" :class="titleClass">{{ title }}</component>
      <component :is="descriptionTag" class="m-0px" :class="descriptionClass">{{ description }}</component>
    </div>
    <ArrowRight :size="arrowSize" class="color-text-tertiary flex-shrink-0" />
  </button>
</template>

<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next';

withDefaults(defineProps<{
  title: string;
  description: string;
  /** Icon-well background/color classes - the accent color varies per card. */
  iconClass?: string;
  iconSizeClass?: string;
  cardClass?: string;
  titleTag?: string;
  titleClass?: string;
  descriptionTag?: string;
  descriptionClass?: string;
  arrowSize?: number;
}>(), {
  iconClass: '',
  iconSizeClass: 'size-48px',
  cardClass: 'gap-16px py-16px px-20px',
  titleTag: 'span',
  titleClass: 'color-text-primary txt-weight-medium text-15px',
  descriptionTag: 'span',
  descriptionClass: 'color-text-secondary text-13px',
  arrowSize: 16,
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
