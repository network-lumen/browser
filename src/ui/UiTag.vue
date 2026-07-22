<template>
  <span class="ui-tag" :class="`ui-tag-${variant}`"><slot /></span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'neutral' | 'accent';
}>(), {
  variant: 'neutral',
});
</script>
