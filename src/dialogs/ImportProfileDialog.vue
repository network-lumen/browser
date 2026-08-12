<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    :title="t('Import profile')"
    panel-class="min-w-360px max-w-90vw w-min-560px-92vw"
    :confirm-disabled="busy"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >

          <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
            {{ t('Choose how you want to import your profile.') }}
          </p>

          <div class="gap-8px mb-16px grid grid-cols-2-minmax0">
            <button
              type="button"
              class="hover-fill-primary border-radius-12px color-text-secondary text-13px txt-weight-light cursor-pointer border-default bg-secondary transition-all-fast py-10px px-12px"
              :class="{ 'bg-primary-a10 border-color-primary color-text-primary shadow-inset-primary-a20': mode === 'file' }"
              @click="$emit('update:mode', 'file')"
            >
              {{ t('Via file') }}
            </button>
            <button
              type="button"
              class="hover-fill-primary border-radius-12px color-text-secondary text-13px txt-weight-light cursor-pointer border-default bg-secondary transition-all-fast py-10px px-12px"
              :class="{ 'bg-primary-a10 border-color-primary color-text-primary shadow-inset-primary-a20': mode === 'manual' }"
              @click="$emit('update:mode', 'manual')"
            >
              {{ t('Manual') }}
            </button>
          </div>

          <div v-if="mode === 'file'" class="flex flex-column gap-12px">
            <p class="m-0px border-radius-12px color-text-secondary text-13px p-14px bg-secondary line-height-15 border-05-light">
              {{ t('Keep the current workflow and select a full profile backup file or folder.') }}
            </p>
          </div>

          <div v-else class="flex flex-column gap-12px">
            <div class="flex flex-wrap-wrap gap-8px">
              <UiButton
                variant="secondary"
                class="flex-1 min-w-180px"
                :disabled="busy"
                @click="$emit('pick-profile-source')"
              >
                {{ t('Load profile backup…') }}
              </UiButton>
              <UiButton
                variant="secondary"
                class="flex-1 min-w-180px"
                :disabled="busy"
                @click="$emit('pick-pqc-source')"
              >
                {{ t('Load Dilithium backup…') }}
              </UiButton>
            </div>

            <div
              v-if="form.profileSourceName || form.pqcSourceName"
              class="flex flex-column border-radius-12px color-text-secondary text-12px gap-4px bg-secondary py-12px px-16px border-05-light"
            >
              <div v-if="form.profileSourceName" class="line-height-14 break-word">
                Profile source: {{ form.profileSourceName }}
              </div>
              <div v-if="form.pqcSourceName" class="line-height-14 break-word">
                Dilithium source: {{ form.pqcSourceName }}
              </div>
            </div>

            <div class="flex flex-column gap-10px border-radius-12px mt-12px p-14px bg-secondary border-05-light">
              <UiFormGroup :label="t('Profile name')" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  :model-value="form.name" @update:model-value="$emit('update:field', 'name', $event)"
                  type="text"
                  radius-class="border-radius-10px"
                  font-size-class="text-13px"
                  padding-class="py-8px px-10px"
                  border-class="border-default"
                  :focus-ring="false"
                  class="focus-shadow"
                  :placeholder="t('Enter a profile name')"
                />
              </UiFormGroup>

              <UiFormGroup :label="t('Mnemonic')" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  :model-value="form.mnemonic" @update:model-value="$emit('update:field', 'mnemonic', $event)"
                  type="textarea"
                  radius-class="border-radius-10px"
                  font-size-class="text-13px"
                  padding-class="py-8px px-10px"
                  border-class="border-default"
                  :focus-ring="false"
                  class="focus-shadow resize-vertical min-h-84px"
                  :placeholder="t('Enter wallet mnemonic')"
                />
              </UiFormGroup>

              <UiFormGroup :label="t('PQC Public Key')" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  :model-value="form.pqcPublicKey" @update:model-value="$emit('update:field', 'pqcPublicKey', $event)"
                  type="textarea"
                  radius-class="border-radius-10px"
                  font-size-class="text-13px"
                  padding-class="py-8px px-10px"
                  border-class="border-default"
                  :focus-ring="false"
                  class="focus-shadow mono resize-vertical min-h-84px"
                  :placeholder="t('Optional')"
                />
              </UiFormGroup>

              <UiFormGroup :label="t('PQC Private Key')" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  :model-value="form.pqcPrivateKey" @update:model-value="$emit('update:field', 'pqcPrivateKey', $event)"
                  type="textarea"
                  radius-class="border-radius-10px"
                  font-size-class="text-13px"
                  padding-class="py-8px px-10px"
                  border-class="border-default"
                  :focus-ring="false"
                  class="focus-shadow mono resize-vertical min-h-84px"
                  :placeholder="t('Optional')"
                />
              </UiFormGroup>
            </div>

            <p class="m-0px text-12px color-text-tertiary line-height-15">
              {{ t('You can paste values manually or load `profile.json` and `lumen_pqc_*.json` to prefill the form.') }}
            </p>

            <p class="m-0px text-12px color-text-tertiary line-height-15">
              {{ t('If you do not have PQC keys yet, leave both fields empty: they will be generated automatically.') }}
            </p>
          </div>


    <template #confirm><span v-if="!busy">{{ mode === 'file' ? t('Choose file…') : t('Import') }}</span>
        <span v-else class="flex-inline-align-justify-center gap-8px"><UiSpinner size="sm" /> {{ t('Importing…') }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import type { ManualImportForm, NavBarImportMode } from '../types/navBar';

/**
 * Importing a profile - either from a backup file, or by pasting the mnemonic
 * and post-quantum keys by hand.
 *
 * The fields report changes through one `update:field` event rather than a
 * model each, because the page keeps them as separate refs and there are six
 * of them; naming the field is less noise than six pairs of props and events.
 */
defineProps<{
  modelValue: boolean;
  mode: NavBarImportMode;
  form: ManualImportForm;
  error?: string;
  busy?: boolean;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:mode', mode: NavBarImportMode): void;
  (e: 'update:field', field: keyof ManualImportForm, value: string): void;
  (e: 'pick-profile-source'): void;
  (e: 'pick-pqc-source'): void;
  (e: 'submit'): void;
}>();
</script>
