<template>
  <label v-if="boxed" class="checkbox-box-wrap cursor-pointer" :title="title">
    <input
      type="checkbox"
      class="checkbox-box-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="checkbox-box-span"></span>
  </label>
  <label v-else class="flex-inline-align-center gap-8px cursor-pointer">
    <input
      type="checkbox"
      class="w-16px h-16px cursor-pointer accent-color-primary"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span v-if="$slots.default" class="color-text-primary text-14px"><slot /></span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  /** Renders a custom rounded-square box + checkmark instead of the native OS checkbox. */
  boxed?: boolean;
  title?: string;
}>(), {
  modelValue: false,
  disabled: false,
  boxed: false,
  title: undefined,
});

defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>
