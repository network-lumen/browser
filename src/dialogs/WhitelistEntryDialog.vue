<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    :title="editing ? t('Edit User') : t('Add User to Whitelist')"
    panel-class="max-w-500px w-90pct"
    :busy="saving"
    :confirm-disabled="saving || !form.address.trim()"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >
    <WhitelistEntryFields :form="form" :editing="editing" />
    <template #confirm>{{ saving ? 'Saving...' : (editing ? t('Update') : t('Add')) }}</template>
</UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import WhitelistEntryFields from '../forms/WhitelistEntryFields.vue';
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