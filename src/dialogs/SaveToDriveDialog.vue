<template>
  <UiModal
    :model-value="modelValue"
    :title="title"
    panel-class="w-min-520px-92vw max-h-100vh-32px"
    :closable="!isRunning"
    @update:model-value="$emit('update:modelValue', false)"
  >
    <template v-if="$slots.header" #header><slot name="header" /></template>

    <slot name="before-form" />

    <div class="flex flex-column gap-8px">
      <label class="text-14px txt-weight-light color-text-primary" for="save-to-drive-name">Name</label>
      <UiInput
        id="save-to-drive-name"
        radius-class="border-radius-12px"
        :focus-ring="false"
        :model-value="name"
        :placeholder="placeholder"
        :disabled="preparing || saving"
        class="focus-shadow"
        @update:model-value="$emit('update:name', $event)"
        @keydown.enter.prevent="$emit('confirm')"
      />

      <!-- Sits under the field rather than above the body like UiDialog's own
           banner: this dialog keeps its five-button footer and so does not go
           through UiDialog, but it should still look the same. -->
      <UiBanner v-if="error" variant="error" class="mt-4px">{{ error }}</UiBanner>

      <slot name="after-form" />

      <UiPinProgressCard
        v-if="jobId"
        :status="statusLabel"
        :counter="counter"
        :percent="percent"
        :indeterminate="percent == null && isRunning"
        :text="progressText || (isRunning ? 'Saving content from the network…' : 'Waiting for action.')"
        card-class="border-radius-12px mt-16px py-12px px-16px border-1-primary-a15"
        text-class="text-13px"
      />
    </div>

    <template #footer>
      <UiButton variant="secondary" type="button" :disabled="isRunning" class="disabled-fade-50" @click="$emit('update:modelValue', false)">
        Cancel
      </UiButton>
      <UiButton v-if="canPause" variant="secondary" type="button" class="disabled-fade-50" @click="$emit('pause')">
        Pause
      </UiButton>
      <UiButton v-if="canResume" variant="secondary" type="button" class="disabled-fade-50" @click="$emit('resume')">
        Resume
      </UiButton>
      <UiButton v-if="canStop" variant="danger" type="button" class="disabled-fade-50" @click="$emit('stop')">
        Stop
      </UiButton>
      <UiButton variant="primary" type="button" :disabled="preparing || isRunning || confirmDisabled" class="disabled-fade-50" @click="$emit('confirm')">
        {{ confirmLabel }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiPinProgressCard from '../ui/UiPinProgressCard.vue';

/**
 * Pinning something into the Drive, with the managed pin job's progress and
 * its pause/resume/stop controls.
 *
 * Two places offer this: the IPFS viewer's own Save button, and the modal a
 * site raises through `window.lumen.Pin`. They were the same dialog written
 * twice - which is also why `applyPinJobSnapshot` had two copies before
 * `readPinJobSnapshot`. What actually differed was the framing around the
 * form, so that is what the slots are for: the site version adds a "requested
 * by" banner and the target it is about to save.
 *
 * The confirm label is computed rather than passed, because both callers
 * derived it the same way from the same three flags.
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Used when no `header` slot is given. */
    title?: string;
    name: string;
    placeholder?: string;
    error?: string;
    preparing?: boolean;
    saving?: boolean;
    confirmDisabled?: boolean;
    /** Empty until a managed pin job exists; its presence shows the progress card. */
    jobId?: string;
    statusLabel?: string;
    counter?: string;
    percent?: number | null;
    progressText?: string;
    isRunning?: boolean;
    canPause?: boolean;
    canResume?: boolean;
    canStop?: boolean;
  }>(),
  {
    title: 'Save to Drive',
    placeholder: '',
    error: '',
    preparing: false,
    saving: false,
    confirmDisabled: false,
    jobId: '',
    statusLabel: '',
    counter: '',
    percent: null,
    progressText: '',
    isRunning: false,
    canPause: false,
    canResume: false,
    canStop: false
  }
);

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:name', value: string): void;
  (e: 'confirm'): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'stop'): void;
}>();

const confirmLabel = computed(() => {
  if (props.jobId) {
    if (props.canResume) return 'Resume save';
    return props.isRunning ? 'Saving...' : 'Save';
  }
  return props.saving ? 'Saving...' : 'Save';
});
</script>
