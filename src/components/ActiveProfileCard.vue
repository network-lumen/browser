<template>
  <div v-if="profile" class="active-profile-card" :class="{ dense }">
    <ProfileAvatar :profile="profile" :size="dense ? 32 : 36" />
    <div class="active-profile-meta">
      <span v-if="showLabel" class="active-profile-label">{{ label }}</span>
      <span class="active-profile-name">{{ displayName }}</span>
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

<style scoped>
.active-profile-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  width: 100%;
  background: var(--fill-tertiary);
  border: 0.5px solid var(--border-light);
  border-radius: var(--border-radius-md);
  margin-bottom: 0.875rem;
}

.active-profile-card.dense {
  padding: 0.625rem;
  gap: 0.5rem;
  margin-bottom: 0;
}

.active-profile-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.active-profile-label {
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.active-profile-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

