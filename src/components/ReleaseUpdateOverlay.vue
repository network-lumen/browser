<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="active" class="overlay" @click.stop>
        <div class="panel">
          <div class="head">
            <div class="title">
              <div class="eyebrow">Updating Lumen</div>
              <div class="version">{{ latest?.version || 'Preparing update' }}</div>
            </div>
          </div>

          <div class="bar">
            <div class="bar-fill" :style="{ width: `${percent}%` }"></div>
          </div>
          <div class="meta">
            <span v-if="bytesLabel">{{ bytesLabel }}</span>
            <span v-if="percentKnown">{{ percent }}%</span>
          </div>

          <div v-if="errorLabel" class="error">
            {{ errorLabel }}
            <button type="button" class="btn" @click="clearError">Close</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useReleaseUpdates } from '../internal/services/releaseUpdates';

const { latest, busy, updateProgress, clearUpdateProgress } = useReleaseUpdates();

const stage = computed(() => String((updateProgress.value as any)?.stage || ''));
const active = computed(() => {
  const s = stage.value.toLowerCase();
  if (s === 'error') return true;
  if (!busy.value) return false;
  return ['starting', 'downloading', 'verifying', 'installing', 'launching_installer'].includes(s);
});

const errorLabel = computed(() => {
  const p: any = updateProgress.value;
  if (!p) return '';
  if (String(p.stage || '').toLowerCase() !== 'error') return '';
  return String(p.error || 'Update failed');
});

const receivedBytes = computed(() => Number((updateProgress.value as any)?.receivedBytes || 0));
const totalBytes = computed(() => {
  const v = Number((updateProgress.value as any)?.totalBytes || 0);
  return Number.isFinite(v) && v > 0 ? v : 0;
});
const percentKnown = computed(() => totalBytes.value > 0);
const percent = computed(() => {
  const s = stage.value.toLowerCase();
  if (s === 'installing' || s === 'launching_installer') return 100;
  if (!percentKnown.value) return 35;
  return Math.max(0, Math.min(100, Math.round((receivedBytes.value / totalBytes.value) * 100)));
});

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const bytesLabel = computed(() => {
  const s = stage.value.toLowerCase();
  if (s !== 'downloading') return '';
  if (!receivedBytes.value) return '';
  const r = formatBytes(receivedBytes.value);
  const t = totalBytes.value ? formatBytes(totalBytes.value) : '';
  return t ? `${r} / ${t}` : r;
});

function clearError() {
  clearUpdateProgress();
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.panel {
  width: min(520px, 92vw);
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: 18px;
  padding: 1.25rem 1.25rem 1rem 1.25rem;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  color: var(--text-primary);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-primary);
}

.version {
  font-size: 1.2rem;
  font-weight: 700;
}

.bar {
  height: 12px;
  border-radius: 999px;
  background: var(--fill-tertiary);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  width: 0%;
  border-radius: 999px;
  background: var(--gradient-primary);
  transition: width 0.18s ease;
}

.meta {
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.error {
  margin-top: 0.85rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--fill-error);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.btn {
  background: var(--fill-secondary);
  border: var(--border-width) solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.btn:hover {
  background: var(--fill-primary);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
