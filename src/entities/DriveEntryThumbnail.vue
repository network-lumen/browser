<template>
  <div :class="containerClass">
    <img
      v-if="isImageFile(file.name)"
      :src="imageSrc"
      :alt="file.name"
      :class="mediaClass"
      :loading="row ? 'lazy' : undefined"
      :fetchpriority="row ? 'low' : undefined"
      decoding="async"
      @error="$emit('image-error')"
    />
    <video
      v-else-if="isVideoFile(file.name)"
      :src="videoSrc"
      :class="[mediaClass, row ? 'bg-secondary block' : '']"
      :poster="row ? poster : undefined"
      :preload="row ? 'metadata' : undefined"
      :controls="!row"
      muted
      playsinline
      @loadeddata="$emit('video-ready')"
    ></video>
    <img
      v-else-if="isHlsEntry(file)"
      :src="poster || ''"
      :alt="file.name"
      :class="mediaClass"
      decoding="async"
    />
    <component v-else :is="icon" :size="row ? 20 : 48" stroke-width="1.5" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isHlsEntry, isImageFile, isVideoFile } from '../internal/services/driveEntries';
import type { DriveThumbnailVariant } from '../types/drive';
import type { DriveFile } from '../types/upload';

/**
 * The picture standing in for a Drive entry: a real thumbnail for images and
 * video, a poster frame for HLS, an icon for everything else.
 */
const props = withDefaults(
  defineProps<{
    file: DriveFile;
    /** Resolved by the page: a cached blob preview, or a gateway URL. */
    imageSrc?: string;
    videoSrc?: string;
    /** Placeholder poster, dropped once the real frame has loaded. */
    poster?: string;
    /** Fallback icon, chosen by the page since folder and EPUB need its caches. */
    icon?: unknown;
    variant?: DriveThumbnailVariant;
    containerClass?: string;
  }>(),
  { variant: 'row' }
);

defineEmits<{ (e: 'image-error'): void; (e: 'video-ready'): void }>();

const row = computed(() => props.variant === 'row');

const mediaClass = computed(() =>
  row.value
    ? 'w-full h-full object-fit-cover border-radius-4px'
    : 'object-fit-contain w-full h-full border-radius-12px'
);
</script>
