<template>
  <div
    class="reveal-on-hover hover-bg-primary-a10 content-visibility-auto-920-56 last-border-bottom-none transition-all-fast flex-align-center gap-12px cursor-pointer py-10px px-16px border-bottom-1-hover-bg"
    :class="{ 'selected bg-fill-blue': selected, 'bg-primary-a05-selected': checked }"
    @click="$emit('open')"
  >
    <div
      v-if="selectable"
      class="flex flex-inline-align-center flex-justify-center flex-shrink-0 w-24px min-w-24px"
      @click.stop
    >
      <UiCheckbox
        boxed
        :model-value="checked"
        @update:model-value="(value: boolean) => $emit('update:checked', value)"
      />
    </div>

    <DriveEntryThumbnail
      :file="file"
      container-class="flex-align-justify-center size-32px color-text-secondary border-radius-6px bg-transparent flex-shrink-0"
      :image-src="thumbnail.imageSrc"
      :video-src="thumbnail.videoSrc"
      :poster="thumbnail.poster"
      :icon="thumbnail.icon"
      @image-error="$emit('image-error')"
      @video-ready="$emit('video-ready')"
    />

    <span class="flex-1 text-14px fw-500 color-text-primary min-w-0 truncate">{{ file.name }}</span>
    <span class="color-text-secondary w-80px text-right text-13px flex-shrink-0 min-w-80px">{{ formatBytes(file.size) }}</span>
    <span class="color-text-secondary text-right text-13px flex-shrink-0 truncate min-w-180px w-180px">{{
      file.uploadedAt ? formatDateTime(file.uploadedAt) : "—"
    }}</span>

    <div class="reveal-actions-target divide-x-border flex-justify-end gap-4px flex-shrink-0 cursor-events-none transition-opacity-02 opacity-0 flex-wrap-nowrap min-w-160px w-160px">
      <UiButton
        v-for="action in availableActions"
        :key="action.kind"
        variant="icon"
        icon-radius-class="border-radius-10px"
        icon-padding-class="p-4px"
        :title="action.title"
        :disabled="action.disabled"
        :class="action.class"
        @click.stop="$emit('action', action.kind)"
      >
        <component :is="action.icon" :size="14" />
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Clapperboard, Download, Share2, TableProperties, Trash2 } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import DriveEntryThumbnail from './DriveEntryThumbnail.vue';
import { isVideoFile } from '../internal/services/driveEntries';
import { formatBytes, formatDateTime } from '../internal/services/format';
import type { DriveEntryAction, DriveThumbnailSources } from '../types/drive';
import type { DriveFile } from '../types/upload';

/**
 * One entry in the Drive listing.
 * This has a single caller and is not trying to pretend otherwise 
 */
const props = defineProps<{
  file: DriveFile;
  thumbnail: DriveThumbnailSources;
  /** The entry whose details are open. */
  selected: boolean;
  /** Ticked for a bulk action. */
  checked: boolean;
  selectable: boolean;
  isDirectory: boolean;
  /** Browsing someone else's CID rather than looking at your own Drive. */
  browsing: boolean;
  /** An upload or conversion is running, so conversion is unavailable. */
  busy: boolean;
}>();

defineEmits<{
  (e: 'open'): void;
  (e: 'update:checked', value: boolean): void;
  (e: 'action', kind: DriveEntryAction): void;
  (e: 'image-error'): void;
  (e: 'video-ready'): void;
}>();

const availableActions = computed(() => {
  const actions: Array<{
    kind: DriveEntryAction;
    title: string;
    icon: unknown;
    disabled?: boolean;
    class?: string;
  }> = [];

  if (!props.browsing && props.isDirectory) {
    actions.push({ kind: 'details', title: 'Details', icon: TableProperties, class: 'active-scale-98' });
  }
  actions.push({ kind: 'download', title: 'Download', icon: Download, class: 'active-scale-98' });
  if (!props.isDirectory && isVideoFile(props.file.name)) {
    actions.push({
      kind: 'convert',
      title: 'Convert to HLS',
      icon: Clapperboard,
      disabled: props.busy,
      class: 'active-scale-98',
    });
  }
  actions.push({ kind: 'share', title: 'Share', icon: Share2, class: 'active-scale-98' });
  actions.push({
    kind: 'remove',
    title: 'Remove',
    icon: Trash2,
    class: 'active-scale-98 hover-bg-error bg-error-a08 color-error',
  });

  return actions;
});
</script>
