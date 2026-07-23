<template>
  <div class="flex-align-justify-center flex-column gap-12px py-48px px-24px text-center color-text-secondary">
    <div v-if="$slots.default" class="flex-align-justify-center border-radius-full bg-fill-tertiary color-text-tertiary" :class="iconSizeClass[props.iconSize]">
      <slot />
    </div>
    <h3 v-if="title" class="m-0px color-text-primary text-16px txt-weight-medium">{{ title }}</h3>
    <slot name="description">
      <p v-if="description" class="m-0px max-w-520px text-14px line-height-15">{{ description }}</p>
    </slot>
    <div v-if="$slots.actions" class="flex-align-center flex-wrap-wrap flex-justify-center gap-12px mt-4px">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
  iconSize?: '48px' | '80px';
}>(), {
  title: '',
  description: '',
  iconSize: '48px',
});

const iconSizeClass: Record<'48px' | '80px', string> = {
  '48px': 'size-48px',
  '80px': 'size-80px',
};
</script>
