<template>
  <span
    class="flex-inline-align-justify-center flex-0-0-auto"
    :class="$attrs.class"
    :style="showsImage ? undefined : avatarToneStyle(kind)"
  >
    <img
      v-if="showsImage"
      :src="imageSrc"
      class="object-fit-cover"
      :class="imageClass"
      alt=""
      draggable="false"
      @error="onImageError"
    />
    <template v-else>{{ monogram }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FavouriteKind } from '../types/favourites';
import { avatarToneStyle } from '../internal/favouriteMeta';
import { LUMEN_MARK, dropSiteIcon, ensureSiteIcon, siteIconKind, siteIconUrl } from '../internal/services/siteIcons';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  /** The page the icon stands for. Decides between the Lumen mark and a favicon. */
  url: string;
  /** Drawn when no icon is available - the initials the lists used to show. */
  monogram: string;
  kind: FavouriteKind;
  /** Size/shape of the icon itself, inside the tile the parent styles. */
  imageClass?: string;
}>(), {
  imageClass: 'size-16px border-radius-4px',
});

/** A favicon that failed to load falls back to the monogram for this session. */
const brokenSrc = ref('');

const imageSrc = computed(() => {
  if (siteIconKind(props.url) === 'lumen') return LUMEN_MARK;
  return siteIconUrl(props.url) || '';
});

const showsImage = computed(() => !!imageSrc.value && imageSrc.value !== brokenSrc.value);

watch(
  () => props.url,
  (url) => {
    brokenSrc.value = '';
    ensureSiteIcon(url);
  },
  { immediate: true },
);

function onImageError() {
  brokenSrc.value = imageSrc.value;
  // A pinned icon that no longer renders is worse than none: drop it so the
  // next visit re-probes instead of showing a broken tile forever.
  dropSiteIcon(props.url);
}
</script>
