<template>
  <button
    type="button"
    class="color-text-secondary txt-weight-light cursor-pointer bg-transparent border-1 border-radius-6px text-13px transition-all-02 py-8px px-12px hover-bg-hover hover-border-accent hover-color-text-primary"
    :class="{ 'bg-accent border-color-primary color-white': active }"
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
