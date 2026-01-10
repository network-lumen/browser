<template>
  <aside class="lumen-sidebar">
    <div class="lumen-sidebar-header">
      <div class="lumen-sidebar-icon">
        <component :is="icon" :size="24" />
      </div>
      <span class="lumen-sidebar-title">{{ title }}</span>
    </div>

    <ActiveProfileCard v-if="activeProfile" :profile="activeProfile" />
    <div v-else class="lumen-sidebar-no-profile">
      <span class="no-profile-title">No active profile</span>
      <span class="no-profile-sub">Create or import one from the navbar.</span>
    </div>

    <div class="lumen-sidebar-scroll">
      <slot />
      <AllPagesDropdown v-if="showAllPages" :activeKey="activeKey" :exclude="allPagesExclude" />
    </div>

    <div v-if="showVersion || $slots.footer" class="lumen-sidebar-footer">
      <slot name="footer" />
      <div v-if="showVersion" class="lumen-sidebar-version">Lumen v{{ appVersion }}</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { profilesState, activeProfileId } from '../internal/profilesStore';
import ActiveProfileCard from './ActiveProfileCard.vue';
import AllPagesDropdown from './AllPagesDropdown.vue';
import pkg from '../../package.json';

const props = withDefaults(defineProps<{
  title: string;
  icon: any;
  activeKey?: string;
  showAllPages?: boolean;
  allPagesExclude?: string[];
  showVersion?: boolean;
}>(), {
  activeKey: undefined,
  showAllPages: true,
  allPagesExclude: () => [],
  showVersion: true
});

const appVersion = String((pkg as any)?.version || '0.0.0');

const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
</script>

<style scoped>
.lumen-sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
  min-height: 0;
}

.lumen-sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 1.25rem;
}

.lumen-sidebar-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.lumen-sidebar-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
}

.lumen-sidebar-no-profile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  border-radius: var(--border-radius-lg);
  background: var(--fill-tertiary);
  border: var(--border-width) solid var(--border-light);
  margin-bottom: 1rem;
}

.no-profile-title {
  font-size: 0.8rem;
  font-weight: 700;
}

.no-profile-sub {
  font-size: 0.78rem;
  color: var(--text-tertiary);
}

.lumen-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}

.lumen-sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}

.lumen-sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.lumen-sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.lumen-sidebar-footer {
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lumen-sidebar-version {
  padding: 0.75rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Sidebar nav styles for slot content */
.lumen-sidebar-scroll :deep(.lsb-nav) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lumen-sidebar-scroll :deep(.lsb-section) {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lumen-sidebar-scroll :deep(.lsb-label) {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.4rem 0.75rem;
}

.lumen-sidebar-scroll :deep(.lsb-item) {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  user-select: none;
}

.lumen-sidebar-scroll :deep(.lsb-item:hover) {
  background: var(--primary-a08);
  color: var(--accent-primary);
  transform: translateX(4px);
}

.lumen-sidebar-scroll :deep(.lsb-item.active) {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
  transform: none;
}

.lumen-sidebar-scroll :deep(.lsb-item svg) {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.lumen-sidebar-scroll :deep(.lsb-item span) {
  min-width: 0;
}

.lumen-sidebar-scroll :deep(.lsb-item--dropdown) {
  justify-content: space-between;
  border: 1px solid var(--border-color);
  background: var(--bg-primary, white);
}

.lumen-sidebar-scroll :deep(.lsb-item--dropdown:hover) {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  transform: none;
}

.lumen-sidebar-scroll :deep(.lsb-item--compact) {
  padding: 0.55rem 0.75rem;
}
</style>
