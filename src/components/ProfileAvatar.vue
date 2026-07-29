<template>
  <span
    class="flex-inline-align-justify-center border-radius-full border-light txt-weight-strong line-height-1 cursor-select-none overflow-hidden"
    :class="isGuest ? 'bg-fill-secondary color-text-secondary shadow-none' : [hueClass, 'shadow-xs']"
    :style="avatarStyle"
    :title="titleText"
  >
    <img v-if="imageSrc" class="w-full h-full block object-fit-cover" :src="imageSrc" :alt="titleText" />
    <User v-else-if="showGuestIcon" :size="iconSize" stroke-width="2.5" />
    <span v-else class="translate-y-05px">{{ letter }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { User } from 'lucide-vue-next';
import type { ProfileLike } from '../types/profile';

const props = withDefaults(defineProps<{
  profile?: ProfileLike | null;
  size?: number;
  title?: string;
  guestIcon?: boolean;
}>(), {
  size: 36,
  guestIcon: true
});

const isGuest = computed(() => props.profile?.role === 'guest');

const baseText = computed(() => String(props.profile?.name || props.profile?.id || '').trim());

const letter = computed(() => {
  const base = baseText.value || 'P';
  return base.charAt(0).toUpperCase();
});

function hashToBucket(input: string) {
  const name = String(input || '');
  if (!name) return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 12;
}

const bucket = computed(() => {
  const idx = Number(props.profile?.colorIndex);
  if (Number.isInteger(idx) && idx >= 0 && idx < 12) return idx;
  return hashToBucket(baseText.value);
});

const hueClass = computed(() => `avatar-hue-${bucket.value}`);

const imageSrc = computed(() => {
  const dataUrl = String(props.profile?.avatarDataUrl || '').trim();
  return dataUrl.startsWith('data:image/') ? dataUrl : '';
});

const avatarStyle = computed(() => {
  const size = Number(props.size) || 36;
  const fontSize = Math.max(12, Math.round(size * 0.45));
  return {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${fontSize}px`
  } as Record<string, string>;
});

const iconSize = computed(() => Math.max(14, Math.round((Number(props.size) || 36) * 0.55)));

const showGuestIcon = computed(() => props.guestIcon && isGuest.value && !imageSrc.value);

const titleText = computed(() => props.title || baseText.value || 'Profile');
</script>
