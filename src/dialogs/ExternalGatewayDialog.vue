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

          <p class="color-text-secondary mb-24px border-radius-8px py-12px px-16px text-14px line-height-15 bg-primary-a10 border-1-primary-a20">
            Add an external private gateway (e.g., your VPS or company server). 
            For local embedded server, use the "Start Embedded Server" button instead.
          </p>

          <UiFormField class="mb-20px" label="Gateway Name" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.name"
              placeholder="My Private Gateway" class="focus-outline-none focus-ring-blue" />
          </UiFormField>

          <UiFormField class="mb-20px" label="Gateway URL" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.url"
              placeholder="https://gateway.example.com" class="focus-outline-none focus-ring-blue" />
          </UiFormField>

          <UiFormField class="mb-20px" label="API Key" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.apiKey"
              placeholder="Your gateway API key" class="focus-outline-none focus-ring-blue" />
          </UiFormField>


    <template #confirm>{{ saving ? 'Saving...' : (editing ? 'Update' : 'Create') }}</template>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
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