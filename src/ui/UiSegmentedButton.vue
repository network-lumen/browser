<template>
  <button
    type="button"
    class="flex-align-center gap-8px fw-500 color-text-secondary cursor-pointer py-8px px-16px bg-transparent border-none border-radius-8px text-14px transition-all-02 hover-color-text-primary hover-bg-hover"
    :class="[{ 'shadow-sm bg-card color-primary': active }, extraClass]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  active?: boolean;
  disabled?: boolean;
  /** Extra layout classes for wider/wrapping variants (e.g. flex-justify-center min-w-140px). */
  extraClass?: string;
}>(), {
  active: false,
  disabled: false,
  extraClass: '',
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
