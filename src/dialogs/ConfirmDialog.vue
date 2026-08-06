<template>
  <UiDialog
    :model-value="modelValue"
    :title="title"
    :panel-class="panelClass"
    :busy="busy"
    :confirm-label="confirmLabel"
    :busy-label="busyLabel"
    :cancel-label="cancelLabel"
    :confirm-variant="variant"
    :button-class="buttonClass"
    :spinner="false"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('confirm')"
  >
    <p v-if="message">{{ message }}</p>
    <slot />
    <p v-if="consequence" class="color-warning mt-8px text-14px">{{ consequence }}</p>

    <template v-if="$slots.confirm" #confirm><slot name="confirm" /></template>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';

/**
 * "Are you sure?" - a question, what it costs, and a button that cannot be
 * taken back.
 *
 * Only two things separate this from `UiDialog` itself: the danger variant by
 * default, and `consequence` - the line saying the deletion is permanent,
 * which keeps looking like a warning wherever it is used. The message stays a
 * slot as well as a prop because every caller bolds its subject mid-sentence,
 * which a string cannot carry.
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

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();
</script>
