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
 *
 * That four-way choice was written out twice in DrivePage - once at 32px in
 * each list row, once at 160px in the detail panel beside it - so the same
 * file could be classified two ways on one screen if either copy drifted.
 *
 * The two are not pure skins of each other and the variant says so: a row
 * thumbnail is a silent poster frame that loads lazily and at low priority
 * because there are dozens on screen, while the preview is a real player with
 * controls. What had no business differing is which of the four branches a
 * given file takes.
 *
 * Sources arrive as props rather than being resolved here. Each one depends on
 * page state this component has no business reaching into - a gateway that may
 * or may not be connected, a cache of blob previews built up as images fail,
 * a set of videos whose real first frame has arrived and no longer needs the
 * placeholder poster.
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
