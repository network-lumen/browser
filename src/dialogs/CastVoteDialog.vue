<template>
  <UiModal :model-value="modelValue" :title="t('Cast your vote')" panel-class="w-full max-w-520px" @update:model-value="$emit('update:modelValue', false)">
    <div class="flex-align-center flex-justify-space-between mb-24px border-radius-12px p-24px bg-gradient-primary">
      <h4 class="m-0px txt-weight-light text-18px color-white">{{ selectedProposal?.title || t('Proposal') }}</h4>
      <span class="border-radius-20px fw-500 text-12px py-4px px-12px color-text-primary bg-primary border-1">#{{ selectedProposal?.id }}</span>
    </div>

    <div class="flex flex-column gap-12px mb-24px">
      <label class="reveal-on-hover block cursor-pointer" :class="{ selected: option === 'VOTE_OPTION_YES' }">
        <input type="radio" name="vote" value="VOTE_OPTION_YES" v-model="option" class="hidden" />
        <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': option === 'VOTE_OPTION_YES' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
          <div class="flex-align-justify-center flex-0-0-auto bg-fill-success color-success size-40px border-radius-10px">
            <ThumbsUp :size="20" />
          </div>
          <div>
            <div class="color-text-primary txt-weight-light text-15px mb-4px">{{ t('Yes') }}</div>
            <div class="color-text-secondary text-13px">{{ t('Support this proposal') }}</div>
          </div>
        </UiCard>
      </label>

      <label class="reveal-on-hover block cursor-pointer" :class="{ selected: option === 'VOTE_OPTION_NO' }">
        <input type="radio" name="vote" value="VOTE_OPTION_NO" v-model="option" class="hidden" />
        <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': option === 'VOTE_OPTION_NO' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
          <div class="flex-align-justify-center flex-0-0-auto size-40px border-radius-10px color-error bg-fill-error">
            <ThumbsDown :size="20" />
          </div>
          <div>
            <div class="color-text-primary txt-weight-light text-15px mb-4px">{{ t('No') }}</div>
            <div class="color-text-secondary text-13px">{{ t('Oppose this proposal') }}</div>
          </div>
        </UiCard>
      </label>

      <label class="reveal-on-hover block cursor-pointer" :class="{ selected: option === 'VOTE_OPTION_NO_WITH_VETO' }">
        <input type="radio" name="vote" value="VOTE_OPTION_NO_WITH_VETO" v-model="option" class="hidden" />
        <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': option === 'VOTE_OPTION_NO_WITH_VETO' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
          <div class="flex-align-justify-center flex-0-0-auto size-40px border-radius-10px color-warning bg-warning-a15">
            <CircleAlert :size="20" />
          </div>
          <div>
            <div class="color-text-primary txt-weight-light text-15px mb-4px">{{ t('No with veto') }}</div>
            <div class="color-text-secondary text-13px">{{ t('Oppose strongly, flag as spam/harmful') }}</div>
          </div>
        </UiCard>
      </label>

      <label class="reveal-on-hover block cursor-pointer" :class="{ selected: option === 'VOTE_OPTION_ABSTAIN' }">
        <input type="radio" name="vote" value="VOTE_OPTION_ABSTAIN" v-model="option" class="hidden" />
        <UiCard class="reveal-border-bg-target flex-align-center gap-16px transition-all-02" :class="{ 'border-color-primary bg-card': option === 'VOTE_OPTION_ABSTAIN' }" padding="md" radius="10px" border-class="border-2" :shadow="false">
          <div class="flex-align-justify-center flex-0-0-auto size-40px border-radius-10px color-text-tertiary bg-secondary">
            <Circle :size="20" />
          </div>
          <div>
            <div class="color-text-primary txt-weight-light text-15px mb-4px">{{ t('Abstain') }}</div>
            <div class="color-text-secondary text-13px">{{ t('No preference') }}</div>
          </div>
        </UiCard>
      </label>
    </div>

    <div class="flex-justify-end">
      <UiButton variant="primary" @click="$emit('submit')" :disabled="!option || isVoting">
        <Vote :size="18" />
        {{ isVoting ? t('Casting…') : t('Cast vote') }}
      </UiButton>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiCard from '../ui/UiCard.vue';
import UiButton from '../ui/UiButton.vue';
import { Circle, CircleAlert, ThumbsDown, ThumbsUp, Vote } from 'lucide-vue-next';

/**
 * Casting a governance vote. The chosen option writes straight back to the
 * page, which is what submits it - this component only presents the four
 * choices and which one is selected.
 */
defineProps<{ modelValue: boolean; isVoting?: boolean; selectedProposal: any }>();
defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'submit'): void }>();
const option = defineModel<string>('option', { required: true });
</script>