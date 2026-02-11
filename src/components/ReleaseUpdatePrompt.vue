<template>
  <transition name="fade">
    <section v-if="visible && latest" class="release-update">
      <header class="flex flex-column gap-10">
        <p class="eyebrow txt-xxs txt-weight-bold text-uppercase letter-spacing-01 margin-0">
          Update available
        </p>
        <h4 class="margin-0 txt-md txt-weight-semibold">
          {{ (latest.release && latest.release.version) || latest.version }}
        </h4>
        <p class="muted txt-xs margin-0">Current version: {{ currentVersion || 'n/a' }}</p>
      </header>

      <button v-if="hasNotes" class="notes-link margin-top-25" type="button" @click="notesOpen = true">
        Change notes
      </button>

      <ul class="meta txt-xxs margin-top-25">
        <li><strong>Platform:</strong> {{ latest.platform }}</li>
        <li><strong>Channel:</strong> {{ latest.channel }}</li>
        <li><strong>Artifact:</strong> {{ latest.artifact.kind }}</li>
        <li v-if="sizeLabel"><strong>Size:</strong> ~{{ sizeLabel }}</li>
        <li v-if="shaFull">
          <strong>SHA256:</strong>
          <button type="button" class="sha-copy" @click.stop="copySha" aria-label="Copy SHA-256">
            <code class="sha-short">{{ shaShort }}</code>
          </button>
        </li>
      </ul>

      <div class="actions gap-25 flex flex-wrap margin-top-25">
        <UiButton
          class="button padding-50 border-radius-10px txt-xxs flex-1-1-auto"
          :variant="downloadDisabled ? 'ghost' : 'primary'"
          :disabled="downloadDisabled || busy"
          @click="onUpdate"
        >
          <template v-if="busy">
            <UiSpinner size="sm" />
            <span>{{ busyLabel }}</span>
          </template>
          <template v-else>
            <span>Update now</span>
          </template>
        </UiButton>
        <UiButton
          class="button padding-50 border-radius-10px txt-xxs flex-1-1-auto"
          variant="ghost"
          @click="remindLater"
        >
          Remind me later
        </UiButton>
      </div>
    </section>
  </transition>

  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="notesOpen" class="notes-overlay" @click.self="notesOpen = false">
        <div class="notes-modal">
          <div class="notes-head">
            <h3 class="notes-title">Change notes</h3>
            <button type="button" class="notes-close" @click="notesOpen = false">&times;</button>
          </div>
          <pre class="notes-body">{{ fullNotes }}</pre>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { formatReleaseSize, useReleaseUpdates } from '../internal/services/releaseUpdates';
import { addToast } from '../stores/toastStore';

const { latest, shouldPrompt, currentVersion, updateNow, remindLater, busy, updateProgress } = useReleaseUpdates();

const visible = computed(() => shouldPrompt.value && !!latest.value && !busy.value);
const downloadDisabled = computed(() => !latest.value?.downloadUrl);
const sizeLabel = computed(() => formatReleaseSize(latest.value?.artifact?.size ?? null));
const notesOpen = ref(false);
const fullNotes = computed(() => String(latest.value?.release?.notes || '').trim());
const hasNotes = computed(() => !!fullNotes.value);

const shaFull = computed(() => String(latest.value?.artifact?.sha256Hex || '').trim());
const shaShort = computed(() => {
  const s = shaFull.value;
  if (!s) return '';
  if (s.length <= 18) return s;
  return `${s.slice(0, 12)}...`;
});

const busyLabel = computed(() => {
  const p: any = updateProgress.value;
  const stage = String(p?.stage || '').toLowerCase();
  if (stage === 'downloading') {
    const r = Number(p?.receivedBytes || 0);
    const t = Number(p?.totalBytes || 0);
    if (t > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((r / t) * 100)));
      return `Downloading… ${pct}%`;
    }
    return 'Downloading…';
  }
  if (stage === 'verifying') return 'Verifying…';
  if (stage === 'installing') return 'Installing…';
  if (stage === 'error') return 'Failed';
  return 'Working…';
});

async function copySha() {
  const value = shaFull.value;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    addToast('success', 'SHA-256 copied');
  } catch {
    addToast('error', 'Copy failed');
  }
}

function onUpdate() {
  if (downloadDisabled.value || busy.value) return;
  void updateNow();
}
</script>

<style scoped>
.release-update {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  border-radius: 18px;
  box-shadow: 0 20px 55px rgba(0, 0, 0, 0.18);
  padding: 18px;
  width: min(380px, 92vw);
  z-index: 9998;
  position: fixed;
  bottom: 24px;
  right: 24px;
  color: var(--text-primary, #000);
}
.eyebrow {
  color: var(--accent-primary, #007aff);
}
.muted {
  color: var(--text-secondary, #3c3c43);
}
.notes-link {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--text-link, var(--accent-primary, #007aff));
  font-size: 0.85rem;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.notes-link:hover {
  opacity: 0.85;
}
.release-update .meta {
  list-style: none;
  padding: 0;
  margin: 0;
  color: var(--text-secondary, #3c3c43);
}
.release-update .meta li + li {
  margin-top: 6px;
}
.sha-copy {
  margin-left: 6px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}
.sha-copy:hover {
  opacity: 0.85;
}
.sha-short {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  background: var(--fill-tertiary, rgba(118, 118, 128, 0.12));
  border: 1px solid var(--border-light, rgba(60, 60, 67, 0.08));
  padding: 2px 6px;
  border-radius: 8px;
  color: var(--text-primary);
}
.actions .button {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
@media (max-width: 600px) {
  .release-update {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
  }
}

.notes-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.notes-modal {
  width: min(720px, 92vw);
  max-height: min(70vh, 600px);
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notes-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light, rgba(60, 60, 67, 0.08));
}

.notes-title {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.notes-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
}

.notes-body {
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: var(--text-primary);
  background: var(--bg-primary);
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
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
