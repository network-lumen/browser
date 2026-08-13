<template>
  <aside class="flex flex-column p-24px m-0px bg-primary border-radius-0 flex-shrink-0 min-h-0 overflow-y-auto min-w-280px max-w-280px border-left-1-border-color">
    <div class="flex-align-center-justify-space-between mb-20px">
      <h3 class="text-12px line-height-12 txt-weight-strong">
        {{ isDirectory ? t('Folder details') : t('File details') }}
      </h3>
      <UiButton variant="icon" @click="$emit('close')">
        <X :size="18" />
      </UiButton>
    </div>

    <DriveEntryThumbnail
      :file="file"
      variant="preview"
      container-class="h-160px flex-align-justify-center border-radius-12px mb-20px color-text-tertiary bg-secondary overflow-hidden border-1-light"
      v-bind="thumbnail"
      @image-error="$emit('image-error')"
    />

    <div class="flex flex-column gap-16px mb-20px">
      <div class="flex flex-column gap-4px">
        <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">{{ t('Name') }}</span>
        <UiInput v-if="canRename"
          bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" padding-class="py-8px px-10px" :focus-ring="false"
          v-model.trim="renameDraft"
          :placeholder="t('Unknown')"
          @keyup.enter="$emit('save-name')"
          @blur="$emit('save-name')" class="fw-500 text-13px focus-outline-none focus-ring focus-bg-primary focus-shadow" />
        <span v-else class="color-text-primary fw-500 text-13px">{{ file.name }}</span>
      </div>
      <div class="flex flex-column gap-4px">
        <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">{{ t('Size') }}</span>
        <span class="color-text-primary fw-500 text-13px">{{ formatBytes(file.size) }}</span>
      </div>
      <div class="flex flex-column gap-4px" v-if="file.uploadedAt">
        <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">{{ t('Added') }}</span>
        <span class="color-text-primary fw-500 text-13px">{{ formatDateTime(file.uploadedAt) }}</span>
      </div>
    </div>

    <div class="flex flex-column gap-8px">
      <UiButton variant="primary" v-if="!isDirectory" @click="$emit('download')">
        <Download :size="16" />
        {{ t('Download') }}
      </UiButton>
      <UiButton variant="secondary" v-if="!isDirectory && isVideoFile(file.name)"
        :disabled="busy"
        @click="$emit('convert-to-hls')"
        :title="t('Convert to HLS (creates a new CID)')">
        <Clapperboard :size="16" />
        {{ t('Convert to HLS') }}
      </UiButton>
      <UiButton variant="secondary" @click="$emit('share')">
        <Share2 :size="16" />
        {{ t('Share') }}
      </UiButton>
      <UiButton variant="secondary" @click="$emit('open')">
        <ExternalLink :size="16" />
        {{ t('Open') }}
      </UiButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiButton from '../ui/UiButton.vue';
import UiInput from '../ui/UiInput.vue';
import DriveEntryThumbnail from '../entities/DriveEntryThumbnail.vue';
import { Clapperboard, Download, ExternalLink, Share2, X } from 'lucide-vue-next';
import { isVideoFile } from '../internal/services/driveEntries';
import { formatBytes, formatDateTime } from '../internal/services/format';
import type { DriveFile } from '../types/upload';
import type { DriveThumbnailSources } from '../types/drive';

/**
 * The panel that opens beside the Drive listing when an entry is selected.
 *
 * It knows how to draw an entry and nothing about where entries come from:
 * whether this one is a directory, whether its name may be edited and what its
 * thumbnail resolves to are the page's answers, passed in. Every button is an
 * emit for the same reason - downloading reaches the bridge, sharing writes to
 * the clipboard, and converting queues a job, none of which belong to a panel.
 */
defineProps<{
  file: DriveFile;
  /** The page's answer, because it depends on the listing this entry came from. */
  isDirectory: boolean;
  /** Only root saved entries can be renamed; a folder's contents cannot. */
  canRename: boolean;
  thumbnail: DriveThumbnailSources;
  /** An upload or a conversion is already running. */
  busy?: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'download'): void;
  (e: 'convert-to-hls'): void;
  (e: 'share'): void;
  (e: 'open'): void;
  (e: 'save-name'): void;
  (e: 'image-error'): void;
}>();

/** Shared with the page, which is what saves it. */
const renameDraft = defineModel<string>('renameDraft', { required: true });
</script>
