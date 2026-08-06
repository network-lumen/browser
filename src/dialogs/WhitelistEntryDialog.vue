<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    :title="editing ? 'Edit User' : 'Add User to Whitelist'"
    panel-class="max-w-500px w-90pct"
    :busy="saving"
    :confirm-disabled="saving || !form.address.trim()"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >

          <UiFormField class="mb-20px" label="Wallet Address" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.address"
              placeholder="lmn1..."
              :disabled="editing" class="focus-outline-none focus-ring-blue" />
          </UiFormField>

          <UiFormField class="mb-20px" label="Display Name (Optional)" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.displayName"
              placeholder="John Doe" class="focus-outline-none focus-ring-blue" />
          </UiFormField>

          <UiFormField class="mb-20px" label="Notes (Optional)" label-class="block fw-500 color-text-secondary text-14px">
            <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-10px" padding-class="py-12px px-16px" focus-border-class="focus-border-primary" :focus-ring="false" v-model="form.notes"
              rows="3"
              placeholder="Additional notes about this user..." class="textarea-min-h-80-font-inherit resize-vertical focus-outline-none focus-ring-blue"></UiInput>
          </UiFormField>


    <template #confirm>{{ saving ? 'Saving...' : (editing ? 'Update' : 'Add') }}</template>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import type { WhitelistEntryForm } from '../types/myGatewaysPage';

/**
 * Granting a wallet access to the embedded gateway, or renaming one that
 * already has it. The address is fixed while editing - it is the identity of
 * the entry, not a field.
 */
defineProps<{
  modelValue: boolean;
  editing: boolean;
  form: WhitelistEntryForm;
  error?: string;
  saving?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>