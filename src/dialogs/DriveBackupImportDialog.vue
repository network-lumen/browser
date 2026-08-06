<template>
    <UiDialog
    :model-value="modelValue"
    title="Import drive snapshot"
    panel-class="w-full max-w-520px"
    :busy="busy"
    :confirm-disabled="busy || !hasPendingImport || (!details && (!password || password.length < 8))"
    @update:model-value="$emit('close')"
    @confirm="details ? $emit('restore') : $emit('decrypt')"
  >

          <p class="color-text-secondary mb-24px text-14px">
            This will replace your local drive metadata (CIDs, names, favourites) for
            <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
          </p>

          <div v-if="filename" class="flex flex-column">
            <UiDetailRow variant="modal" label="File" :value="filename" />
          </div>

          <div
            v-if="!details"
            class="flex flex-column gap-12px mt-16px"
          >
            <UiFormGroup label="Password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
              <input
                class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                :type="showPassword ? 'text' : 'password'"
                :model-value="password" @update:model-value="$emit('update:password', $event)"
                placeholder="Enter backup password"
                :disabled="busy"
                @keyup.enter="$emit('decrypt')"
              />
            </UiFormGroup>

            <UiCheckbox v-model="showPassword" :disabled="busy">Show password</UiCheckbox>

            <div v-if="error" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
              <div class="text-14px txt-weight-light color-text-primary">Import failed</div>
              <div class="color-text-secondary text-13px">{{ error }}</div>
            </div>
          </div>

          <template v-else>
            <div class="flex flex-column mt-16px">
              <UiDetailRow variant="modal" label="Wallet" value-class="color-text-primary text-15px fw-500 mono" :value="details.walletAddress || '—'" />
              <UiDetailRow variant="modal" label="Created" :value="details.createdAt ? formatDate(details.createdAt) : '—'" />
              <UiDetailRow variant="modal" label="Saved items" :value="details.filesCount" />
              <UiDetailRow variant="modal" label="Favourites" :value="details.favCount" />
            </div>

            <div
              v-if="details.walletMismatch"
              class="mt-16px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08"
            >
              <div class="text-14px txt-weight-light color-text-primary">Different wallet</div>
              <div class="color-text-secondary text-13px">
                This snapshot was created for a different wallet. Importing it will still work,
                but make sure you're restoring into the right profile.
              </div>
            </div>

            <div v-if="details.rollback" class="mt-16px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
              <div class="text-14px txt-weight-light color-text-primary">Older snapshot</div>
              <div class="color-text-secondary text-13px">
                This snapshot looks older than your current local version (seq
                {{ details.localSeq }}).
              </div>
            </div>

            <div v-if="error" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
              <div class="text-14px txt-weight-light color-text-primary">Import failed</div>
              <div class="color-text-secondary text-13px">{{ error }}</div>
            </div>
          </template>

    <template #confirm><UiSpinner v-if="busy" size="sm" />
              <span>{{
                busy
                  ? details
                    ? "Restoring..."
                    : "Decrypting..."
                  : details
                    ? "Restore"
                    : "Decrypt"
              }}</span></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import UiDialog from '../ui/UiDialog.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import type { DriveBackupRestoreDetails } from '../types/drivePage';

/**
 * Restoring a Drive snapshot. `details` is what the file turned out to
 * contain once decrypted, including whether it belongs to another wallet -
 * which the page works out, because only it knows the active one.
 */
defineProps<{
  modelValue: boolean;
  filename: string;
  password: string;
  activeProfileDisplay: string;
  hasPendingImport: boolean;
  formatDate: (ts: number) => string;
  details: DriveBackupRestoreDetails | null;
  busy?: boolean;
  error?: string;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'update:password', value: string): void;
  (e: 'decrypt'): void;
  (e: 'restore'): void;
}>();

/** Whether the password is shown in clear - a local toggle. */
const showPassword = ref(false);
</script>
