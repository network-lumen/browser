<template>
  <div class="flex gap-12px p-16px border-radius-8px bg-warning-a15 border-1-warning-a30" :class="boxClass">
    <slot name="icon">
      <AlertCircle :size="20" class="color-warning" />
    </slot>
    <div class="flex-1 color-text-primary">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';

withDefaults(defineProps<{
  boxClass?: string;
}>(), {
  boxClass: 'mb-24px',
});
</script>
