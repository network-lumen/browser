<template>
  <UiModal :model-value="modelValue" title="Export drive snapshot" panel-class="w-full max-w-520px" @update:model-value="$emit('close')">
          <p class="color-text-secondary mb-24px text-14px">
            Set a password to encrypt your drive metadata backup for
            <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
          </p>

          <div class="flex flex-column gap-12px">
            <UiFormGroup label="Password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
              <input
                class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                :type="showPassword ? 'text' : 'password'"
                :model-value="password" @update:model-value="$emit('update:password', $event)"
                placeholder="Min 8 characters (recommended: long passphrase)"
                :disabled="busy"
              />
            </UiFormGroup>

            <UiFormGroup label="Confirm password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
              <input
                class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                :type="showPassword ? 'text' : 'password'"
                :model-value="passwordConfirm" @update:model-value="$emit('update:passwordConfirm', $event)"
                placeholder="Repeat password"
                :disabled="busy"
                @keyup.enter="$emit('submit')"
              />
            </UiFormGroup>

            <UiCheckbox v-model="showPassword" :disabled="busy">Show password</UiCheckbox>

            <p class="text-11px line-height-12 color-text-tertiary m-0px mt-12px">
              If you lose the password, this backup cannot be recovered.
            </p>

            <div v-if="error" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
              <div class="text-14px txt-weight-light color-text-primary">Backup failed</div>
              <div class="color-text-secondary text-13px">{{ error }}</div>
            </div>
          </div>
          <template #footer>
            <UiButton variant="secondary" type="button"
              :disabled="busy"
              @click="$emit('close')" class="disabled-fade-50">
              Cancel
            </UiButton>
            <UiButton variant="primary" type="button"
              :disabled="
                busy ||
                !password ||
                password.length < 8 ||
                password !== passwordConfirm
              "
              @click="$emit('submit')">
              <UiSpinner v-if="busy" size="sm" />
              <span>{{ busy ? "Exporting..." : "Export" }}</span>
            </UiButton>
          </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import UiModal from '../ui/UiModal.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';

/** Encrypting a Drive snapshot before it leaves the machine. */
defineProps<{
  modelValue: boolean;
  password: string;
  activeProfileDisplay: string;
  passwordConfirm: string;
  busy?: boolean;
  error?: string;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
  (e: 'update:password', value: string): void;
  (e: 'update:passwordConfirm', value: string): void;
}>();

/** Whether the two password fields are shown in clear - a local toggle. */
const showPassword = ref(false);
</script>
