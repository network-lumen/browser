<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 flex-align-justify-center bg-black-a50 backdrop-blur-4 z-9999"
      @click.self="close"
    >
      <div class="bg-card border-radius-16px shadow-0-20-60-rgba-0-0-0-0-3 overflow-hidden flex flex-column max-h-90vh" :class="panelClass" @click.stop>
        <div v-if="$slots.header || title" class="flex-align-center-justify-space-between p-20px border-bottom-default">
          <slot name="header">
            <h3 class="m-0px color-text-primary">{{ title }}</h3>
          </slot>
          <button v-if="closable" type="button" class="bg-transparent border-none cursor-pointer color-text-secondary" @click="close">
            <X :size="18" />
          </button>
        </div>
        <div class="p-20px overflow-y-auto">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex-justify-end gap-12px p-20px border-top-default">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  closable?: boolean;
  panelClass?: string;
}>(), {
  closable: true,
  panelClass: 'w-min-520px-92vw',
});

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}
</script>
