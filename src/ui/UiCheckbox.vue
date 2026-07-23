<template>
  <label v-if="boxed" class="relative flex-inline-align-justify-center w-18px h-18px flex-shrink-0 cursor-pointer" :title="title">
    <input
      type="checkbox"
      class="checkbox-box-input absolute inset-0 opacity-0 m-0px cursor-pointer"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="checkbox-box-span relative w-18px h-18px border-radius-6px border-1-border-color bg-primary shadow-inset-top-white-a35 transition-all-02"></span>
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
