<template>
  <button type="button" class="ui-menu-item flex-align-center flex-justify-start gap-8px w-full py-8px px-10px border-none bg-transparent color-text-primary text-13px fw-500 text-left cursor-pointer transition-bg-fast" :disabled="disabled" @click="$emit('click', $event)">
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
