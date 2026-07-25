<template>
  <div class="flex-align-center color-text-primary gap-12px p-16px bg-fill-success border-radius-8px border-1-success-a30">
    <CheckCircle :size="20" class="color-success" />
    <p class="text-14px line-height-12 m-0px"><slot>{{ message }}</slot></p>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next';

withDefaults(defineProps<{
  message?: string;
}>(), {
  message: '',
});
</script>
