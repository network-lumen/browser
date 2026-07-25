<template>
  <section class="border-1-light bg-secondary border-radius-16px shadow-sm p-0px pt-16px pr-16px pb-16px pl-16px">
    <h3 class="txt-weight-strong m-0px color-text-primary text-15px letter-spacing-n001">{{ title }}</h3>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
