<template>
  <header class="ui-page-header" :class="{ 'ui-page-header-actions-only': !hasText && !!$slots.actions }">
    <div v-if="hasText" class="ui-page-header-text">
      <h1 v-if="title" class="ui-page-header-title" :class="[`text-${titleSize}`, `txt-weight-${titleWeight}`]">{{ title }}</h1>
      <slot>
        <p v-if="subtitle" class="ui-page-header-subtitle">{{ subtitle }}</p>
      </slot>
    </div>
    <div v-if="$slots.actions" class="ui-page-header-actions">
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
