<template>
  <span
    class="lumen-avatar"
    :class="[hueClass, isGuest ? 'is-guest' : '']"
    :style="avatarStyle"
    :title="titleText"
  >
    <User v-if="showGuestIcon" :size="iconSize" stroke-width="2.5" />
    <span v-else class="lumen-avatar-letter">{{ letter }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { User } from 'lucide-vue-next';

type ProfileLike = {
  id?: string;
  name?: string;
  colorIndex?: number;
  role?: 'guest' | 'user';
};

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

const showGuestIcon = computed(() => props.guestIcon && isGuest.value);

const titleText = computed(() => props.title || baseText.value || 'Profile');
</script>

<style scoped>
.lumen-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-full);
  border: var(--border-width) solid var(--border-light);
  box-shadow: var(--shadow-xs);
  font-weight: 800;
  line-height: 1;
  user-select: none;
}

.lumen-avatar.is-guest {
  background: var(--fill-secondary);
  color: var(--text-secondary);
  border: var(--border-width) solid var(--border-light);
  box-shadow: none;
}

.lumen-avatar-letter {
  transform: translateY(0.5px);
}
</style>

