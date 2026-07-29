<template>
  <div
    v-if="profile"
    class="flex-align-center w-full bg-fill-tertiary border-light border-radius-12px"
    :class="dense ? 'gap-8px p-10px m-0px' : 'gap-10px p-12px mb-16px'"
  >
    <ProfileAvatar :profile="profile" :size="dense ? 32 : 36" />
    <div class="flex flex-column gap-2px min-w-0">
      <span v-if="showLabel" class="text-10px color-text-tertiary text-uppercase letter-spacing-005em fw-500">{{ label }}</span>
      <span class="text-13px txt-weight-light color-text-primary truncate">{{ displayName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProfileAvatar from './ProfileAvatar.vue';
import type { ProfileLike } from '../types/profile';

const props = withDefaults(defineProps<{
  profile: ProfileLike | null;
  label?: string;
  dense?: boolean;
  showLabel?: boolean;
}>(), {
  label: 'Active Profile',
  dense: false,
  showLabel: true
});

const displayName = computed(() => {
  const p = props.profile;
  if (!p) return '';
  return String(p.name || p.id || '').trim();
});
</script>
