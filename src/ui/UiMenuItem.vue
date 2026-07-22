<template>
  <button type="button" class="ui-menu-item" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
