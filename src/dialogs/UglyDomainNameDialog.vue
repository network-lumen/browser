<template>
  <UiModal :model-value="modelValue" :title="mode === 'import' ? t('Import ugly domain') : t('Generate ugly domain')" panel-class="max-w-500px" @update:model-value="$emit('update:modelValue', false)">
        <form class="overflow-y-auto flex-1 min-h-0 pt-16px pr-20px pb-20px pl-20px" @submit.prevent="$emit('submit')">
          <p class="text-14px color-text-tertiary m-0px mb-12px">
            {{ mode === 'import'
              ? t('Choose a local private key file and attach it to this ugly domain name.')
              : t('Create a new IPNS-backed ugly domain with a local private key.') }}
          </p>
          <div class="mb-16px">
            <label class="color-text-secondary block mb-4px text-13px">{{ t('Ugly domain name') }}</label>
            <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" :focus-ring="false" :model-value="name" @update:model-value="$emit('update:name', $event)"
              autocomplete="off"
              :placeholder="'my-link'"
              :disabled="saving"
              autofocus class="focus-outline-none focus-ring focus-shadow placeholder-tertiary" />
          </div>
          <div class="flex flex-justify-end gap-8px">
            <UiButton variant="secondary" type="button" :disabled="saving" @click="$emit('update:modelValue', false)" class="outline-none">
              {{ t('Cancel') }}
            </UiButton>
            <UiButton variant="primary" type="submit"
              :disabled="saving || !name.trim()" class="outline-none">
              <span v-if="!saving" class="flex-inline-align-center gap-8px">
                <component :is="mode === 'import' ? Upload : Plus" :size="16" />
                {{ mode === 'import' ? t('Import') : t('Generate') }}
              </span>
              <UiSpinner v-else size="sm" />
            </UiButton>
          </div>
        </form>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { Plus, Upload } from 'lucide-vue-next';

/**
 * Naming an ugly domain - the label shown for an IPNS key the user generates
 * or imports. `mode` is what the page is doing, and also what tells this
 * modal to be open at all.
 */
defineProps<{
  modelValue: boolean;
  mode: 'generate' | 'import' | null;
  name: string;
  saving?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:name', value: string): void;
  (e: 'submit'): void;
}>();
</script>
