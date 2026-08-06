<template>
    <UiDialog
    :model-value="modelValue"
    title="Send to DAO"
    panel-class="w-min-900px-96vw"
    :busy="busy"
    :confirm-disabled="busy"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >
    <DaoProposalFields :form="form" />
    <template #confirm><span v-if="busy" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> Sending…</span>
          <span v-else>Broadcast proposal</span></template>
</UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/UiDialog.vue';
import DaoProposalFields from '../forms/DaoProposalFields.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import type { DaoProposalForm } from '../types/releasePage';

/**
 * Proposing a release to the DAO - validate it, or reject it with a reason.
 * The reason field only appears for a rejection, which is the one thing the
 * two actions do not share.
 */
defineProps<{ modelValue: boolean; form: DaoProposalForm; busy?: boolean }>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>