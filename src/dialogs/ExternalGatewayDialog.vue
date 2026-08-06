<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    :title="editing ? 'Edit External Gateway' : 'Add External Gateway'"
    panel-class="max-w-500px w-90pct"
    :busy="saving"
    :confirm-disabled="saving || !valid"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >
    <ExternalGatewayFields :form="form" />
    <template #confirm>{{ saving ? 'Saving...' : (editing ? 'Update' : 'Create') }}</template>
</UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';
import ExternalGatewayFields from '../forms/ExternalGatewayFields.vue';
import type { ExternalGatewayForm } from '../types/myGatewaysPage';

/**
 * Adding or editing an external private gateway - a VPS or company server,
 * as opposed to the embedded one the page can start itself.
 *
 * The form is passed in rather than owned here because the page fills it from
 * the gateway being edited and reads it back on submit; diting only picks
 * the title and the confirm label.
 */
defineProps<{
  modelValue: boolean;
  editing: boolean;
  form: ExternalGatewayForm;
  error?: string;
  saving?: boolean;
  valid?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>