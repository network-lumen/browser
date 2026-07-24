<template>
  <div class="flex-align-center" :class="wrapperClass">
    <code :class="codeClass">{{ value }}</code>
    <UiButton variant="icon" @click.stop="copyToClipboard(value)" :title="title">
      <Copy :size="iconSize" />
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue';
import { Copy } from 'lucide-vue-next';
import { copyToClipboard } from '../composables/useClipboard';

withDefaults(defineProps<{
  value: string;
  title?: string;
  wrapperClass?: string;
  codeClass?: string;
  iconSize?: number;
}>(), {
  title: 'Copy',
  wrapperClass: 'gap-8px',
  codeClass: 'bg-secondary color-text-primary py-8px px-12px border-1 border-radius-6px mono text-12px break-all',
  iconSize: 16,
});
</script>
