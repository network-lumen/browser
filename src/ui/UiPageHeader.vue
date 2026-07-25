<template>
  <header class="flex-align-start flex-wrap-wrap gap-16px mb-24px" :class="hasText ? 'flex-justify-space-between' : 'flex-justify-end'">
    <div v-if="hasText">
      <h1 v-if="title" class="m-0px color-text-primary" :class="[`text-${titleSize}`, `txt-weight-${titleWeight}`]">{{ title }}</h1>
      <slot>
        <p v-if="subtitle" class="mt-4px mb-0px color-text-secondary text-14px">{{ subtitle }}</p>
      </slot>
    </div>
    <div v-if="$slots.actions" class="flex-align-center flex-wrap-wrap gap-12px">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  /** One of scale.css's text-Npx steps, e.g. '20px'/'24px'/'28px'/'32px'. */
  titleSize?: string;
  titleWeight?: 'light' | 'medium' | 'strong';
}>(), {
  title: '',
  subtitle: '',
  titleSize: '28px',
  titleWeight: 'medium',
});

const slots = useSlots();
const hasText = computed(() => !!(props.title || props.subtitle || slots.default));
</script>
