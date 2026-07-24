<template>
  <div class="text-center" :class="wrapperClass">
    <slot name="icon" />
    <h3 class="text-20px line-height-12 txt-weight-strong mt-16px m-0px color-text-primary">{{ title }}</h3>
    <p class="text-12px line-height-12 color-text-tertiary mt-8px m-0px">
      <slot>{{ description }}</slot>
    </p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  description?: string;
  wrapperClass?: string;
}>(), {
  description: '',
  wrapperClass: '',
});
</script>
