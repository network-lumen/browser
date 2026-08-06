<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    :panel-class="panelClass"
    :closable="closable && !busy"
    @update:model-value="close"
  >
    <template v-if="$slots.header" #header><slot name="header" /></template>

    <UiBanner v-if="error" variant="error" class="mb-12px">{{ error }}</UiBanner>
    <slot />

    <template v-if="!hideFooter" #footer>
      <slot name="footer">
        <UiButton variant="secondary" type="button" :class="buttonClass" :disabled="busy" @click="close">
          {{ cancelLabel }}
        </UiButton>
        <slot name="footer-extra" />
        <UiButton
          :variant="confirmVariant"
          type="button"
          :class="buttonClass"
          :disabled="busy || confirmDisabled"
          @click="$emit('confirm')"
        >
          <slot name="confirm">
            <UiSpinnerRing v-if="busy && spinner" />
            <span>{{ busy && busyLabel ? busyLabel : confirmLabel }}</span>
          </slot>
        </UiButton>
      </slot>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from './UiModal.vue';
import UiButton from './UiButton.vue';
import UiSpinnerRing from './UiSpinnerRing.vue';
import UiBanner from './UiBanner.vue';

/**
 * The shape almost every dialog in `src/dialogs` turned out to have: a modal
 * with a title, some body, and a footer of Cancel beside one action.
 *
 * Of the 25 dialogs with a footer, 21 were exactly that - the same two
 * buttons, the same order, the same swap to a present-participle label while
 * the action runs - written out by hand each time along with the two imports
 * it takes. That is what this absorbs.
 *
 * The four that are not that shape (the pin flow with its pause/resume/stop,
 * the plans browser) pass their own `#footer`, which replaces the default
 * outright. `#footer-extra` is the lighter escape hatch: extra buttons
 * between Cancel and the action, keeping the two ends consistent.
 *
 * Closing is blocked while `busy`, so a dialog cannot be dismissed out from
 * under a request that is still running - which several of them were doing
 * by hand with `:closable="!saving"`.
 */
withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    /**
     * Shown as an error banner above the body. Thirteen dialogs rendered this
     * themselves in five different looks - a bare red line, a red line with a
     * background, a bordered box, and two banner variants - for what is always
     * the same thing: what just went wrong. Empty renders nothing.
     */
    error?: string;
    panelClass?: string;
    /** Shows the close cross and lets a click outside dismiss. */
    closable?: boolean;
    /** Disables both buttons and blocks closing while an action runs. */
    busy?: boolean;
    confirmLabel?: string;
    /** Replaces `confirmLabel` while busy. Empty keeps the label unchanged. */
    busyLabel?: string;
    /** Set false for a confirm button that should not spin. */
    spinner?: boolean;
    confirmDisabled?: boolean;
    confirmVariant?: 'primary' | 'danger' | 'secondary';
    cancelLabel?: string;
    /** Applied to both footer buttons - `flex-1` splits the width evenly. */
    buttonClass?: string;
    /** For dialogs that are read-only and need no actions at all. */
    hideFooter?: boolean;
  }>(),
  {
    title: '',
    error: '',
    panelClass: 'w-min-520px-92vw',
    closable: true,
    busy: false,
    confirmLabel: 'Confirm',
    busyLabel: '',
    spinner: true,
    confirmDisabled: false,
    confirmVariant: 'primary',
    cancelLabel: 'Cancel',
    buttonClass: '',
    hideFooter: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();

function close() {
  emit('update:modelValue', false);
}
</script>
