<template>
  <div class="flex flex-column gap-12px">
    <UiFormGroup required :label="t('Name')">
      <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
        v-model="form.name"
        :placeholder="t('Enter contact name')" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
    </UiFormGroup>

    <UiFormGroup required :label="t('Address')">
      <UiInput bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" type="text"
        v-model="form.address"
        placeholder="lmn1..."
        :readonly="!!editing" class="mono focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary" />
    </UiFormGroup>

    <UiFormGroup :label="t('Note (optional)')">
      <UiInput type="textarea" bg-class="bg-card" radius-class="border-radius-10px" border-class="border-2" font-size-class="text-15px" padding-class="py-12px px-16px" :focus-ring="false" v-model="form.note"
        :placeholder="t('Add a note about this contact')"
        rows="3" class="textarea-min-h-80-font-inherit resize-vertical focus-outline-none focus-ring focus-shadow bg-secondary-read-only placeholder-tertiary"></UiInput>
    </UiFormGroup>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import type { ContactForm } from '../types/walletPage';

/**
 * The fields of an address-book entry
 */
defineProps<{ form: ContactForm; editing?: boolean }>();
</script>
