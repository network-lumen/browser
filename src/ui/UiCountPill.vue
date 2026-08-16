<template>
  <span class="flex-inline-align-justify-center border-radius-full" :class="pillClass">{{ count }}</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  count: number | string;
  pillClass?: string;
}>(), {
  pillClass: 'color-text-secondary text-11px txt-weight-medium h-24px py-0px px-8px min-w-24px bg-fill-tertiary',
});
</script>
