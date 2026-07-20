<template>
  <div
    v-if="profile"
    class="flex-align-center w-full bg-fill-tertiary border-light border-radius-md"
    :class="dense ? 'gap-50 padding-62 margin-0' : 'gap-62 padding-75 margin-bottom-87'"
  >
    <ProfileAvatar :profile="profile" :size="dense ? 32 : 36" />
    <div class="flex flex-column gap-2px min-w-0">
      <span v-if="showLabel" class="fs-10px color-text-tertiary text-uppercase letter-spacing-005em fw-500">{{ label }}</span>
      <span class="fs-13px txt-weight-light color-text-primary nowrap overflow-hidden txt-overflow-ellipsis">{{ displayName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProfileAvatar from './ProfileAvatar.vue';

type ProfileLike = {
  id?: string;
  name?: string;
  colorIndex?: number;
  role?: 'guest' | 'user';
};

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
