<template>
  <div class="flex-align-center-justify-space-between mb-8px">
    <!-- m-0px: without it the browser's default h3 margin adds ~15px of its
         own on top of whatever gap the section already sets. -->
    <h3 class="text-15px txt-weight-light color-text-primary m-0px">{{ title }}</h3>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
