<template>
  <UiModal :model-value="modelValue" :title="t('Create Proposal')" panel-class="w-full max-w-640px" @update:model-value="$emit('update:modelValue', false)">
    <p class="color-text-secondary mb-24px text-14px">{{ t('Submit a text proposal for on-chain governance.') }}</p>

    <div class="mb-20px">
      <label class="txt-weight-light color-text-primary block text-13px mb-8px">{{ t('Title') }}</label>
      <UiInput radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" type="text" v-model="form.title" :placeholder="t('Enter proposal title...')" class="focus-outline-none focus-ring focus-shadow bg-primary" />
    </div>

    <div class="mb-20px">
      <label class="txt-weight-light color-text-primary block text-13px mb-8px">{{ t('Summary') }}</label>
      <UiInput type="textarea" radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" v-model="form.summary" rows="6" :placeholder="t('Describe your proposal in detail...')" class="resize-vertical focus-outline-none focus-ring focus-shadow bg-primary"></UiInput>
    </div>

    <div class="mb-20px">
      <label class="txt-weight-light color-text-primary block text-13px mb-8px">{{ t('Deposit (LMN)') }}</label>
      <UiInput radius-class="border-radius-10px" padding-class="p-14px" :focus-ring="false" type="text" v-model="form.depositLmn" placeholder="10" class="focus-outline-none focus-ring focus-shadow bg-primary" />
    </div>

    <UiCard class="mb-24px" padding="md" radius="10px" border-class="border-1-primary-a30" :shadow="false">
      <div class="flex-align-center gap-12px color-text-secondary text-13px">
        <Info :size="16" class="flex-shrink-0 color-primary" />
        <span>Minimum deposit to enter voting: {{ governanceMinDepositLmn }} LMN</span>
      </div>
    </UiCard>

    <div class="mb-20px">
      <div class="flex-align-center flex-justify-space-between mb-8px">
        <label class="txt-weight-light color-text-primary text-13px">{{ t('Actions (optional)') }}</label>
        <UiButton variant="secondary" type="button" @click="$emit('add-action')" class="hover-border-primary-a15">
          <Plus :size="14" />
          {{ t('Add action') }}
        </UiButton>
      </div>
      <p class="color-text-secondary text-13px mb-12px">
        {{ t('A plain text proposal has no actions. Add one or more to make this proposal execute an on-chain change if it passes.') }}
      </p>

      <div v-for="draft in actionDrafts" :key="draft.id" class="bg-secondary border-1-light border-radius-10px p-16px mb-12px">
        <div class="flex-align-center gap-10px mb-12px">
          <select v-model="draft.templateId" @change="resetActionDraftValues(draft)" class="flex-1 hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow">
            <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ tpl.module }} — {{ t(tpl.label) }}</option>
          </select>
          <UiButton variant="icon" icon-radius-class="border-radius-8px" class="hover-bg-error-a08 hover-color-error size-32px flex-shrink-0" :title="t('Remove action')" @click="$emit('remove-action', draft.id)">
            <X :size="16" />
          </UiButton>
        </div>

        <p v-if="templateForDraft(draft)" class="color-text-secondary text-12px mb-12px">{{ t(templateForDraft(draft)?.summary || '') }}</p>

        <div v-for="field in templateForDraft(draft)?.fields || []" :key="field.key" class="mb-8px">
          <label class="txt-weight-light color-text-secondary block text-12px mb-4px">{{ t(field.label) }}</label>
          <select v-if="field.type === 'select'" v-model="draft.values[field.key]" class="w-full hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ t(opt.label) }}</option>
          </select>
          <UiInput
            v-else
            :type="field.type === 'textarea' ? 'textarea' : field.type === 'number' ? 'number' : 'text'"
            radius-class="border-radius-8px"
            padding-class="p-10px"
            :focus-ring="false"
            v-model="draft.values[field.key]"
            :placeholder="t(field.placeholder || '')"
            :rows="field.type === 'textarea' ? 3 : undefined"
            class="focus-outline-none focus-ring focus-shadow bg-card text-13px"
          />
          <p v-if="field.hint" class="color-text-tertiary text-11px mt-4px">{{ t(field.hint) }}</p>
        </div>
      </div>
    </div>

    <UiButton variant="primary" @click="$emit('submit')" :disabled="!submissionEnabled || !canSubmit || isSubmitting">
      <Plus :size="18" />
      {{ isSubmitting ? t('Submitting…') : t('Submit Proposal') }}
    </UiButton>
    <p v-if="!submissionEnabled" class="color-text-tertiary text-12px mt-8px">
      {{ t('Proposal submission is temporarily disabled while the action builders above are being verified on testnet.') }}
    </p>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiCard from '../ui/UiCard.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import { Info, Plus } from 'lucide-vue-next';
import { findGovernanceActionTemplate } from '../internal/pages/governanceActionTemplates';
import type { GovernanceActionDraft, GovernanceActionTemplate } from '../types/networkGovernance';
import type { ProposalForm } from '../types/networkPage';

/**
 * Drafting a governance proposal: title, summary, deposit, and a list of
 * actions built from templates.
 *
 * The action list stays with the page - adding and removing one are events,
 * because the page owns the drafts and the templates that describe them.
 */
defineProps<{
  modelValue: boolean;
  form: ProposalForm;
  actionDrafts: GovernanceActionDraft[];
  templates: GovernanceActionTemplate[];
  canSubmit: boolean;
  governanceMinDepositLmn: string;
  isSubmitting?: boolean;
  submissionEnabled?: boolean;
}>();
/**
 * The template a draft is built from. Looked up here rather than passed in:
 * the registry is a module, not something the page knows better than we do.
 */
function templateForDraft(draft: GovernanceActionDraft): GovernanceActionTemplate | undefined {
  return findGovernanceActionTemplate(draft.templateId);
}

/** Switching template invalidates whatever was filled in for the old one. */
function resetActionDraftValues(draft: GovernanceActionDraft) {
  draft.values = {};
}

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit'): void;
  (e: 'add-action'): void;
  (e: 'remove-action', id: string): void;
}>();
</script>