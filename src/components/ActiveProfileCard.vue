<template>
  <div
    v-if="profile"
    class="flex-align-center w-full bg-fill-tertiary border-light border-radius-12px"
    :class="dense ? 'gap-8px p-10px m-0px' : 'gap-10px p-12px mb-16px'"
  >
    <ProfileAvatar :profile="profile" :size="dense ? 32 : 36" />
    <div class="flex flex-column gap-2px min-w-0">
      <span class="text-10px color-text-tertiary text-uppercase letter-spacing-005em fw-500">{{ resolvedLabel }}</span>
      <span class="text-13px txt-weight-light color-text-primary truncate">{{ displayName }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed } from 'vue';
import ProfileAvatar from './ProfileAvatar.vue';
import type { ProfileLike } from '../types/profile';

const props = withDefaults(defineProps<{
  profile: ProfileLike | null;
  label?: string;
  dense?: boolean;
}>(), {
  label: '',
  dense: false
});

/**
 * The fallback label is resolved here, not in the prop default.
 *
 * A `withDefaults` object is evaluated once, when the module is first imported
 * - before the user's locale has been read from settings, and never again. So
 * `label: t('Active profile')` froze the English string at import time and no
 * language change could move it, while every other string on the card followed
 * the locale. A computed reads `t()` per render, which is what makes it change.
 */
const resolvedLabel = computed(() => props.label || t('Active profile'));

const displayName = computed(() => {
  const p = props.profile;
  if (!p) return '';
  return String(p.name || p.id || '').trim();
});
</script>
