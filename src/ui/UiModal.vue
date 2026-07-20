<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="overlay-scrim backdrop-blur-4px z-9999"
      @click.self="close"
    >
      <div class="bg-card border-radius-16px shadow-modal overflow-hidden flex flex-column max-h-90vh" :class="panelClass" @click.stop>
        <div v-if="$slots.header || title" class="flex-align-center-justify-space-between padding-125 border-bottom-default">
          <slot name="header">
            <h3 class="margin-0 color-text-primary">{{ title }}</h3>
          </slot>
          <button v-if="closable" type="button" class="bg-transparent border-none cursor-pointer color-text-secondary" @click="close">
            <X :size="18" />
          </button>
        </div>
        <div class="padding-125 overflow-y-auto">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex-justify-end gap-75 padding-125 border-top-default">
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
