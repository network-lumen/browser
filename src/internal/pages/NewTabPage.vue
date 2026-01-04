<template>
  <div class="newtab-page">
    <div class="cards">
      <button class="card explore" type="button" @click="goExplore">
        <div class="icon">
          <Telescope :size="26" />
        </div>
        <div class="copy">
          <h2>Explore the Lumen network</h2>
          <p>Discover content that can't be taken down.</p>
          <span class="cta">Start exploring</span>
        </div>
      </button>

      <button
        class="card share"
        type="button"
        @click="goHome"
        :disabled="!hasProfiles"
      >
        <div class="icon">
          <MonitorUp :size="26" />
        </div>
        <div class="copy">
          <h2>My space</h2>
          <p>Access Drive, domains, wallet, and your personal tools.</p>
          <span class="cta">{{ hasProfiles ? 'Open' : 'Create a profile to unlock' }}</span>
        </div>
      </button>

      <div v-if="!hasProfiles" class="hint">
        No profile yet. Create one using the top-right profile button.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { MonitorUp, Telescope } from 'lucide-vue-next';
import { profilesState } from '../profilesStore';

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const hasProfiles = computed(() => profilesState.value.length > 0);

function goto(url: string) {
  if (navigate) {
    navigate(url, { push: true });
    return;
  }
  openInNewTab?.(url);
}

function goExplore() {
  goto('lumen://search');
}

function goHome() {
  if (!hasProfiles.value) return;
  goto('lumen://home');
}
</script>

<style scoped>
.newtab-page {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, #f0f2f5);
}

.cards {
  width: min(720px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  display: flex;
  gap: 1rem;
  width: 100%;
  padding: 1.25rem 1.25rem;
  border-radius: 14px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #ffffff);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
}

.card:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(52, 152, 219, 0.5);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.10);
}

.card:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f8fafc);
  color: #1d4ed8;
  flex: 0 0 auto;
}

.copy h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  color: var(--text-primary, #1e293b);
}

.copy p {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
}

.cta {
  display: inline-block;
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #1d4ed8;
  text-decoration: underline;
}

.hint {
  padding: 0.85rem 1rem;
  border-radius: 12px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.85rem;
}
</style>
