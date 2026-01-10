<template>
  <div class="newtab-page">
    <div
      v-if="showOnboarding"
      class="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lumen-onboarding-title"
      aria-describedby="lumen-onboarding-desc"
    >
      <div class="onboarding-modal" @click.stop>
        <div class="onboarding-brand">
          <div class="onboarding-logo" aria-hidden="true">
            <Hexagon :size="22" />
          </div>
          <div class="onboarding-text">
            <div class="onboarding-kicker">Welcome</div>
            <h2 id="lumen-onboarding-title">Learn what is Lumen?</h2>
            <p id="lumen-onboarding-desc">
              A quick 1‑minute overview of the Decentralized Internet Stack: domains, IPFS, and gateways.
            </p>
          </div>
        </div>

        <div class="onboarding-actions">
          <button class="ob-btn ob-primary" type="button" @click="learnLumen">
            Learn what is Lumen
          </button>
          <button class="ob-btn ob-secondary" type="button" @click="dismissOnboarding">
            I already know Lumen
          </button>
        </div>
      </div>
    </div>

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
import { computed, inject, onMounted, ref } from 'vue';
import { Hexagon, Telescope, User } from 'lucide-vue-next';
import { profilesState } from '../profilesStore';

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const hasProfiles = computed(() => profilesState.value.length > 0);

const ONBOARDING_KEY = 'lumen:onboarding:discover:v1';
const showOnboarding = ref(false);

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {}
}

function dismissOnboarding() {
  markOnboardingDone();
  showOnboarding.value = false;
}

function learnLumen() {
  dismissOnboarding();
  goto('lumen://help/discover');
}

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

onMounted(() => {
  try {
    const seen = localStorage.getItem(ONBOARDING_KEY) === '1';
    showOnboarding.value = !seen;
  } catch {
    showOnboarding.value = true;
  }
});
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

.onboarding-overlay {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 10;
}

.onboarding-modal {
  width: min(560px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  box-shadow: 0 40px 80px rgba(15, 23, 42, 0.35);
  padding: 1.25rem 1.25rem 1rem;
}

.onboarding-brand {
  display: flex;
  gap: 0.9rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.onboarding-logo {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
  flex: 0 0 auto;
}

.onboarding-kicker {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-primary);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.onboarding-text h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.onboarding-text p {
  margin: 0.45rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.onboarding-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.ob-btn {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0.7rem 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
}

.ob-btn:active {
  transform: scale(0.99);
}

.ob-primary {
  background: var(--gradient-primary);
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-primary);
}

.ob-primary:hover {
  box-shadow: 0 16px 30px rgba(59, 130, 246, 0.25);
}

.ob-secondary {
  background: rgba(15, 23, 42, 0.04);
  color: var(--text-primary);
}

.ob-secondary:hover {
  background: rgba(15, 23, 42, 0.07);
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
