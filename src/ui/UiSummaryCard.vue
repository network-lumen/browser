<template>
  <div class="mt-24px mb-24px border-radius-12px p-0px border-1 bg-secondary overflow-hidden">
    <div class="txt-weight-medium color-text-secondary text-uppercase bg-hover border-bottom-1 text-13px letter-spacing-005em py-12px px-16px">
      <span>{{ title }}</span>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
}>();
</script>
