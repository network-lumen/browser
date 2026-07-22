<template>
  <label class="ui-toggle" :class="[`ui-toggle-${size}`, disabled ? 'ui-toggle-disabled' : '']">
    <input
      type="checkbox"
      class="ui-toggle-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-toggle-slider"></span>
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
