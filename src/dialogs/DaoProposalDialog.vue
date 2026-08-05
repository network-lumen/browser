<template>
  <UiModal :model-value="modelValue" title="Send to DAO" panel-class="w-min-900px-96vw" @update:model-value="$emit('update:modelValue', false)">
      <div class="flex flex-column gap-12px">
        <div class="gap-12px grid grid-cols-2-minmax0">
          <UiFormField label="Action">
            <select v-model="form.kind" class="w-full border-radius-12px color-text-primary text-15px line-height-12 border-1 bg-secondary py-8px px-10px focus-outline-none focus-border-primary focus-ring focus-shadow">
              <option value="validate">Validate release</option>
              <option value="reject">Reject release</option>
            </select>
          </UiFormField>
          <UiFormField label="Deposit (LMN)">
            <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="form.depositLmn" placeholder="0" class="focus-outline-none focus-ring focus-shadow" />
          </UiFormField>
        </div>

        <UiFormField label="Title">
          <UiInput bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model.trim="form.title" class="focus-outline-none focus-ring focus-shadow" />
        </UiFormField>

        <UiFormField label="Summary">
          <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model="form.summary" rows="3" class="focus-outline-none focus-ring focus-shadow" />
        </UiFormField>

        <UiFormField v-if="form.kind === 'reject'" label="Reason (optional)">
          <UiInput type="textarea" bg-class="bg-secondary" radius-class="border-radius-12px" font-size-class="text-15px line-height-12" padding-class="py-8px px-10px" :focus-ring="false" v-model="form.reason" rows="3" placeholder="Why should this release be rejected?" class="focus-outline-none focus-ring focus-shadow" />
        </UiFormField>
      </div>

      <template #footer>
        <UiButton variant="secondary" type="button" @click="$emit('update:modelValue', false)" :disabled="busy">Cancel</UiButton>
        <UiButton variant="primary" type="button" @click="$emit('submit')" :disabled="busy">
          <span v-if="busy" class="flex-inline-align-center gap-8px"><UiSpinner size="sm" /> Sending…</span>
          <span v-else>Broadcast proposal</span>
        </UiButton>
      </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import type { DaoProposalForm } from '../types/releasePage';

/**
 * Proposing a release to the DAO - validate it, or reject it with a reason.
 * The reason field only appears for a rejection, which is the one thing the
 * two actions do not share.
 */
defineProps<{ modelValue: boolean; form: DaoProposalForm; busy?: boolean }>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
</script>