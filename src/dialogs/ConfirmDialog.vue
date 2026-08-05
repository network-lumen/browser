<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    :panel-class="panelClass"
    :closable="!busy"
    @update:model-value="onClose"
  >
    <p v-if="message">{{ message }}</p>
    <slot />
    <p v-if="consequence" class="color-warning mt-8px text-14px">{{ consequence }}</p>

    <template #footer>
      <UiButton variant="secondary" :class="buttonClass" :disabled="busy" @click="onClose">
        {{ cancelLabel }}
      </UiButton>
      <UiButton :variant="variant" :class="buttonClass" :disabled="busy" @click="$emit('confirm')">
        <slot name="confirm">{{ busy ? busyLabel : confirmLabel }}</slot>
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';

/**
 * "Are you sure?" - a question, what it costs, and a button that cannot be
 * taken back.
 *
 * Pages kept rebuilding this: the same panel width, the same Cancel beside a
 * danger button, the same swap to a present-participle label while the action
 * runs. Only the words differed, so the words are the props.
 *
 * The message is a slot as well as a prop because most of these want a bolded
 * subject in the middle of the sentence, which a string cannot carry.
 * `consequence` is separate rather than part of the message: it is the line
 * that says the deletion is permanent, and it should keep looking like a
 * warning wherever it appears.
 */
withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message?: string;
    /** The part the user should read twice - rendered as a warning. */
    consequence?: string;
    confirmLabel?: string;
    /** Shown in place of `confirmLabel` while `busy`. */
    busyLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    variant?: 'danger' | 'primary';
    /** Applied to both footer buttons - `flex-1` splits the width evenly. */
    buttonClass?: string;
    panelClass?: string;
  }>(),
  {
    message: '',
    consequence: '',
    confirmLabel: 'Confirm',
    busyLabel: 'Working...',
    cancelLabel: 'Cancel',
    busy: false,
    variant: 'danger',
    buttonClass: '',
    panelClass: 'max-w-400px w-90pct'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();

function onClose() {
  emit('update:modelValue', false);
}
</script>
