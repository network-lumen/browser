<template>
  <button
    type="button"
    class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
    :class="[
      spaceBetween ? 'flex-align-center-justify-space-between' : 'flex-align-center',
      { 'reveal-on-active': reveal, 'active bg-gradient-primary color-white shadow-primary': active }
    ]"
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
  /** Only needed alongside an inline <svg class="reveal-target"> icon that should fade in on hover/active. */
  reveal?: boolean;
  spaceBetween?: boolean;
}>(), {
  active: false,
  disabled: false,
  reveal: false,
  spaceBetween: false,
});

defineEmits<{ (e: 'click', ev: MouseEvent): void }>();
</script>
