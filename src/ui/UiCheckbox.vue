<template>
  <label class="flex-inline-align-center gap-50 cursor-pointer">
    <input
      type="checkbox"
      class="w-16px h-16px cursor-pointer"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span v-if="$slots.default" class="color-text-primary fs-14px"><slot /></span>
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
}>(), {
  modelValue: false,
  disabled: false,
});

defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>
