<template>
  <label class="relative inline-block flex-0-0-auto cursor-pointer" :class="[`ui-toggle-${size}`, disabled ? 'cursor-not-allowed' : '']">
    <input
      type="checkbox"
      class="ui-toggle-input absolute opacity-0 w-0 h-0"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-toggle-slider absolute inset-0 bg-border border-radius-full transition-bg-02"></span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
}>(), {
  modelValue: false,
  size: 'md',
  disabled: false,
});

defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>
