<template>
  <button
    type="button"
    class="txt-weight-light cursor-pointer border-1 border-radius-6px text-13px transition-all-02 py-8px px-12px hover-border-accent"
    :class="active ? 'bg-accent border-color-primary color-white' : 'bg-transparent color-text-secondary hover-bg-hover hover-color-text-primary'"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  active?: boolean;
}>(), {
  active: false,
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
