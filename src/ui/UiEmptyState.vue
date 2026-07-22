<template>
  <div class="ui-empty-state">
    <div v-if="$slots.default" class="ui-empty-state-icon" :class="`ui-empty-state-icon-${iconSize}`">
      <slot />
    </div>
    <h3 v-if="title" class="ui-empty-state-title">{{ title }}</h3>
    <slot name="description">
      <p v-if="description" class="ui-empty-state-description">{{ description }}</p>
    </slot>
    <div v-if="$slots.actions" class="ui-empty-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string;
  description?: string;
  /** One of scale.css's size steps, e.g. '32px'/'48px'/'64px'/'80px'. */
  iconSize?: string;
}>(), {
  title: '',
  description: '',
  iconSize: '48px',
});
</script>
