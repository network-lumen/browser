<template>
    <UiDialog
    :error="error"
    :model-value="modelValue"
    :title="t('Encrypted Backup')"
    panel-class="min-w-360px max-w-90vw"
    :confirm-label="t('Import')"
    @update:model-value="$emit('update:modelValue', false)"
    @confirm="$emit('submit')"
  >

          <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
            {{ t('This backup is encrypted. Please enter the password to decrypt and import it.') }}
          </p>

          <div class="flex flex-column gap-10px border-radius-12px mt-12px p-14px bg-secondary border-05-light">
            <UiFormGroup :label="t('Backup Password')" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
              <UiInput
                type="password"
                :model-value="password" @update:model-value="$emit('update:password', $event)"
                :placeholder="t('Enter backup password')"
                radius-class="border-radius-10px"
                font-size-class="text-13px"
                padding-class="py-8px px-10px"
                border-class="border-default"
                :focus-ring="false"
                class="focus-shadow"
                @keyup.enter="$emit('submit')"
              />
            </UiFormGroup>
          </div>

  </UiDialog>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiDialog from '../ui/UiDialog.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';

/** The password prompt for an encrypted profile backup being imported. */
defineProps<{ modelValue: boolean; password: string; error?: string }>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:password', value: string): void;
  (e: 'submit'): void;
}>();
</script>
