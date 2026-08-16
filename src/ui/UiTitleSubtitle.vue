<template>
  <span class="flex flex-column min-w-0" :class="[gapClass, wrapperClass]">
    <span class="truncate" :class="titleClass">{{ title }}</span>
    <span class="truncate" :class="subtitleClass">{{ subtitle }}</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  subtitle: string;
  gapClass?: string;
  /** Extra classes on the outer wrapper (e.g. flex-1). */
  wrapperClass?: string;
  titleClass?: string;
  subtitleClass?: string;
}>(), {
  gapClass: 'gap-2px',
  wrapperClass: '',
  titleClass: 'color-text-primary text-13px txt-weight-light block',
  subtitleClass: 'color-text-tertiary text-11px block',
});
</script>
