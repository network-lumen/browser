<template>
  <UiModal :model-value="modelValue" :title="t('Local drive')" panel-class="w-full max-w-520px" @update:model-value="$emit('close')">

          <div class="flex flex-column">
            <UiDetailRow variant="modal" :label="t('Status')">
              <span class="color-text-primary text-15px fw-500" :class="ipfsConnected ? 'color-success' : 'color-error'">
                {{ ipfsConnected ? "Online" : "Offline" }}
              </span>
            </UiDetailRow>
            <UiDetailRow v-if="stats" variant="modal" :label="t('Used')" :value="formatSize(stats.repoSize)" />
            <UiDetailRow variant="modal" :label="t('Saved items')" :value="localSavedCount" />
            <UiDetailRow variant="modal" :label="t('Pinned locally')" :value="pinnedFiles.length" />
          </div>

          <div class="mt-24px">
            <div class="flex-align-center-justify-space-between gap-8px mb-8px">
              <h4 class="m-0px text-15px fw-500 color-text-primary">{{ t('Backup') }}</h4>
              <UiSpinner v-if="busy" size="sm" />
            </div>

            <p class="text-11px line-height-12 color-text-tertiary m-0px mb-12px">
              {{ t("Export/import your drive metadata (CIDs, names, favourites). The snapshot is encrypted with a password you choose. It doesn't include the data behind CIDs (only references). Keep the file + password safe.") }}
            </p>

            <div v-if="error" class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
              <div class="text-14px txt-weight-light color-text-primary">{{ t('Backup failed') }}</div>
              <div class="color-text-secondary text-13px">{{ error }}</div>
            </div>

            <div class="flex flex-column">
              <UiDetailRow variant="modal" :label="t('Last export')" :value="driveBackupLastExportAt ? formatDate(driveBackupLastExportAt) : '—'" />
              <UiDetailRow variant="modal" :label="t('Last import')" :value="driveBackupLastImportAt ? formatDate(driveBackupLastImportAt) : '—'" />
            </div>

            <div class="mt-12px flex-wrap-wrap flex-inline-align-center gap-6px">
              <UiButton variant="secondary" type="button"
                :disabled="busy"
                @click="$emit('export')">
                {{ t('Export snapshot') }}
              </UiButton>
              <UiButton variant="secondary" type="button"
                :disabled="busy"
                @click="$emit('import')">
                {{ t('Import snapshot') }}
              </UiButton>
              <input
                ref="driveBackupImportInput"
                type="file"
                accept="application/json,.json"
                class="hidden"
                @change="$emit('file-selected', $event)"
              />
            </div>
          </div>
  </UiModal>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiModal from '../ui/UiModal.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiButton from '../ui/UiButton.vue';
import {
  formatBytes as formatSize,
  formatDateTime as formatDate,
} from '../internal/services/format';

/** What the local IPFS repo holds, and the way in to backing it up. */
defineProps<{
  modelValue: boolean;
  stats: { repoSize: number } | null;
  ipfsConnected: boolean;
  driveBackupLastExportAt: number | null;
  driveBackupLastImportAt: number | null;
  localSavedCount: number;
  pinnedFiles: unknown[];
  busy?: boolean;
  error?: string;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'export'): void;
  (e: 'import'): void;
  (e: 'file-selected', event: Event): void;
}>();
</script>
