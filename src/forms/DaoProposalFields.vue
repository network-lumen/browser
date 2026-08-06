<template>
  <div class="flex flex-column gap-12px">
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
  </div>
</template>

<script setup lang="ts">
import UiFormField from '../ui/UiFormField.vue';
import UiInput from '../ui/UiInput.vue';
import type { DaoProposalForm } from '../types/releasePage';

/**
 * The fields of dao proposal fields.
 *
 * Split from its dialog so the fields can be shown without the modal around
 * them - in a page section or a wizard step - which is what made the gateway
 * fields worth sharing in the first place.
 */
defineProps<{ form: DaoProposalForm }>();
</script>
