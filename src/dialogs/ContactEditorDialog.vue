<template>
  <UiModal :model-value="modelValue" panel-class="walletpage-contact-modal w-full max-w-500px" @update:model-value="$emit('update:modelValue', false)">
    <template #header>
      <UiModalHeader :title="editing ? t('Edit contact') : t('Add contact')">
        <template #icon><Users :size="20" /></template>
      </UiModalHeader>
    </template>

    <ContactFields :form="form" :editing="editing" />

    <UiButton variant="primary" class="disabled-fade-50 mt-12px" :disabled="!form.name || !form.address || saving" @click="$emit('submit')">
      <Check v-if="!saving" :size="18" />
      <UiSpinner v-else size="sm" class="spinner-color-white" />
      <span>{{ saving ? 'Saving...' : (editing ? t('Update contact') : t('Add contact')) }}</span>
    </UiButton>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import ContactFields from '../forms/ContactFields.vue';
import { Check, Users } from 'lucide-vue-next';
import type { ContactForm } from '../types/walletPage';

/**
 * Adding or renaming an address-book entry.
 *
 * Its action sits in the body rather than a footer, which is how this one was
 * written, so it keeps UiModal directly rather than going through UiDialog.
 */
defineProps<{
  modelValue: boolean;
  editing: boolean;
  form: ContactForm;
  saving?: boolean;
}>();

defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>
