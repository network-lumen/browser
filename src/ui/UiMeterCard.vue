<template>
  <div class="p-16px bg-secondary border-radius-10px">
    <div class="color-text-secondary mb-16px fw-500 text-uppercase text-11px letter-spacing-005em">{{ label }}</div>
    <div class="flex-align-center gap-16px">
      <div class="h-6px flex-1 bg-primary border-radius-4px overflow-hidden">
        <slot name="fill" />
      </div>
      <span class="color-text-primary txt-weight-light text-right text-15px min-w-70px">{{ value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
}>();
</script>
