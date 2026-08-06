<template>
  <UiModal :model-value="modelValue" title="Export Profile" panel-class="min-w-360px max-w-90vw" @update:model-value="$emit('update:modelValue', false)">
          <p class="text-13px color-text-secondary line-height-15 m-0px mb-16px">
            Export your profile backup.
            <template v-if="requiresPassword">
              <br/><strong>Note:</strong> Your wallet is password-protected. Enter your password to include wallet data in the backup.
            </template>
            <template v-else>
              You can optionally encrypt it with a password.
            </template>
          </p>

          <!-- Password required for decryption notice -->
          <div v-if="requiresPassword" class="flex flex-column gap-10px border-radius-12px mt-12px p-14px bg-secondary border-05-light">
            <UiFormGroup label="Wallet Password" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
              <UiInput
                type="password"
                :model-value="password" @update:model-value="$emit('update:password', $event)"
                placeholder="Enter your wallet password"
                radius-class="border-radius-10px"
                font-size-class="text-13px"
                padding-class="py-8px px-10px"
                border-class="border-default"
                :focus-ring="false"
                class="focus-shadow"
                @keyup.enter="$emit('submit')"
              />
            </UiFormGroup>

            <div class="hover-bg-hover mt-12px border-radius-10px py-8px px-10px transition-bg-fast">
              <UiCheckbox :model-value="encrypted" @update:model-value="$emit('update:encrypted', $event)">Also encrypt the backup file with this password</UiCheckbox>
            </div>
          </div>

          <!-- Optional encryption for non-protected wallets -->
          <template v-if="!requiresPassword">
            <div class="hover-bg-hover border-radius-10px py-8px px-10px transition-bg-fast">
              <UiCheckbox :model-value="encrypted" @update:model-value="$emit('update:encrypted', $event)">Encrypt backup with password</UiCheckbox>
            </div>

            <div v-if="encrypted" class="flex flex-column gap-10px border-radius-12px mt-12px p-14px bg-secondary border-05-light">
              <UiFormGroup label="Password" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  type="password"
                  :model-value="password" @update:model-value="$emit('update:password', $event)"
                  placeholder="Enter password (min 6 characters)"
                  radius-class="border-radius-10px"
                  font-size-class="text-13px"
                  padding-class="py-8px px-10px"
                  border-class="border-default"
                  :focus-ring="false"
                  class="focus-shadow"
                />
              </UiFormGroup>
              <UiFormGroup label="Confirm Password" wrapper-class="gap-4px" label-class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-003em">
                <UiInput
                  type="password"
                  :model-value="passwordConfirm" @update:model-value="$emit('update:passwordConfirm', $event)"
                  placeholder="Confirm password"
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
          </template>

          <div v-if="error" class="border-radius-10px text-12px py-8px px-10px mt-8px bg-error-a08 color-error border-05-error-a25">
            {{ error }}
          </div>

    <template #footer>
      <UiButton variant="secondary" class="flex-1" @click="$emit('update:modelValue', false)">
        Cancel
      </UiButton>
      <UiButton variant="primary" class="flex-1" @click="$emit('submit')">
        Export {{ encrypted ? '(Encrypted)' : '' }}
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiInput from '../ui/UiInput.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';

/**
 * Exporting a profile, optionally encrypted.
 *
 * `requiresPassword` is the page's answer, not this dialog's guess: whether a
 * password is needed depends on how the profile was created, which only the
 * main process knows.
 */
defineProps<{
  modelValue: boolean;
  password: string;
  passwordConfirm: string;
  encrypted: boolean;
  requiresPassword?: boolean;
  error?: string;
}>();
defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:password', value: string): void;
  (e: 'update:passwordConfirm', value: string): void;
  (e: 'update:encrypted', value: boolean): void;
  (e: 'submit'): void;
}>();
</script>
