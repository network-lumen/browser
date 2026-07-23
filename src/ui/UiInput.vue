<template>
  <input
    v-if="type !== 'textarea'"
    ref="el"
    :class="computedClass"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="onInput"
  />
  <textarea
    v-else
    ref="el"
    :class="computedClass"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const el = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);

const props = withDefaults(defineProps<{
  modelValue?: string;
  modelModifiers?: { trim?: boolean };
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  focusRing?: boolean;
  bgClass?: string;
  radiusClass?: string;
  borderClass?: string;
  fontSizeClass?: string;
  paddingClass?: string;
  focusBorderClass?: string;
}>(), {
  modelValue: '',
  modelModifiers: () => ({}),
  type: 'text',
  disabled: false,
  focusRing: true,
  bgClass: 'bg-primary',
  radiusClass: 'border-radius-8px',
  borderClass: 'border-1',
  fontSizeClass: 'text-14px',
  paddingClass: 'py-10px px-12px',
  focusBorderClass: 'focus-border-accent',
});

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function onInput(event: Event) {
  let value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  if (props.modelModifiers?.trim) value = value.trim();
  emit('update:modelValue', value);
}

const computedClass = computed(() => [
  'w-full',
  props.bgClass,
  'color-text-primary',
  'outline-none',
  props.fontSizeClass,
  props.borderClass,
  props.radiusClass,
  'transition-all-02',
  props.paddingClass,
  'font-inherit',
  props.focusBorderClass,
  props.focusRing ? 'focus-ring-blue' : '',
].filter(Boolean).join(' '));

defineExpose({
  focus: () => el.value?.focus(),
  el,
});
</script>
