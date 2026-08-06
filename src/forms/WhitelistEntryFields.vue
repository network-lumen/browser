<template>
  <div class="flex flex-column gap-12px">
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
  </div>
</template>

<script setup lang="ts">
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import type { WhitelistEntryForm } from '../types/myGatewaysPage';

/**
 * The fields of whitelist entry fields.
 *
 * Split from its dialog so the fields can be shown without the modal around
 * them - in a page section or a wizard step - which is what made the gateway
 * fields worth sharing in the first place.
 */
defineProps<{
  form: WhitelistEntryForm;
  /** The address identifies an existing entry, so it is fixed while editing. */
  editing?: boolean;
}>();
</script>
