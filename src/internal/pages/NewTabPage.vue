<template>
  <div class="newtab-page">
    <div class="shell">
      <div class="mark" aria-hidden="true">
        <div class="logo">
          <Hexagon :size="30" />
        </div>
      </div>

      <section class="actions">
        <button class="action primary" type="button" @click="goExplore">
          <div class="action-ico">
            <Telescope :size="18" />
          </div>
          <div class="action-copy">
            <div class="action-title">Explore</div>
            <div class="action-desc">Search content and open websites.</div>
          </div>
          <div class="action-cta">Open</div>
        </button>

        <button class="action" type="button" @click="goHome" :disabled="!hasProfiles">
          <div class="action-ico">
            <User :size="18" />
          </div>
          <div class="action-copy">
            <div class="action-title">My space</div>
            <div class="action-desc">Drive, domains, wallet and tools.</div>
          </div>
          <div class="action-cta">{{ hasProfiles ? 'Open' : 'Locked' }}</div>
        </button>
      </section>

      <div v-if="!hasProfiles" class="hint">
        No profile yet. Create one using the top-right profile button to unlock your space.
      </div>

      <div class="tip">
        Paste any link in the address bar — `lumen://…`, `http://…`, or `https://…`.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { Hexagon, Telescope, User } from 'lucide-vue-next';
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
  height: 100%;
  min-height: 0;
  padding: 2.25rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  position: relative;
  overflow: hidden;
}

.newtab-page::before {
  content: '';
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(900px 380px at 15% 0%, var(--primary-a15), transparent 60%),
    radial-gradient(900px 380px at 85% 100%, var(--lime-a15), transparent 60%);
  pointer-events: none;
}

.shell {
  width: min(760px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  position: relative;
  z-index: 1;
}

.mark {
  display: flex;
  justify-content: center;
  padding: 0.25rem 0 0.5rem;
}

.logo {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
  flex: 0 0 auto;
}

.tip {
  font-size: 0.85rem;
  color: var(--text-tertiary);
  line-height: 1.35;
  text-align: center;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.action {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 1.05rem 1.1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.action:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: var(--primary-a50);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.10);
}

.action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.action-ico {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.18);
  color: var(--ios-blue);
  flex: 0 0 auto;
}

.action.primary {
  background: linear-gradient(135deg, var(--primary-a12) 0%, var(--card-bg) 60%);
}

.action-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  flex: 1 1 auto;
}

.action-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.action-desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.25;
}

.action-cta {
  font-size: 0.85rem;
  font-weight: 650;
  color: var(--accent-primary);
}

.hint {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  border: 1px solid #fde68a;
  background: rgba(255, 204, 0, 0.1);
  color: var(--ios-orange);
  font-size: 0.85rem;
}

@media (max-width: 720px) {
  .actions {
    grid-template-columns: 1fr;
  }
  .newtab-page {
    padding: 1.75rem 1rem;
  }
}
</style>
