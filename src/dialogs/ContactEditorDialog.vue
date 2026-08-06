<template>
  <UiModal :model-value="modelValue" panel-class="walletpage-contact-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader :title="editing ? 'Edit Contact' : 'Add Contact'">
        <template #icon><Users :size="20" /></template>
      </UiModalHeader>
    </template>
          <UiFormGroup required label="Name">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              v-model="form.name"
              placeholder="Enter contact name" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup required label="Address">
            <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
              v-model="form.address"
              placeholder="lmn1..."
              :readonly="!!editing" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
          </UiFormGroup>

          <UiFormGroup label="Note (optional)">
            <UiInput type="textarea" bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" v-model="form.note"
              placeholder="Add a note about this contact"
              rows="3" class="textarea-min-h-80-font-inherit resize-vertical focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary"></UiInput>
          </UiFormGroup>

          <UiButton variant="primary" @click="$emit('submit')" 
            :disabled="!form.name || !form.address || saving" class="disabled-fade-50">
            <Check :size="18" v-if="!saving" />
            <UiSpinner v-else size="sm" class="spinner-color-white" />
            <span>{{ saving ? 'Saving...' : (editing ? 'Update Contact' : 'Add Contact') }}</span>
          </UiButton>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { Check, Users } from 'lucide-vue-next';
import type { ContactForm } from '../types/walletPage';

/** Adding or renaming an address-book entry. */
defineProps<{
  modelValue: boolean;
  editing: boolean;
  form: ContactForm;
  saving?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>
