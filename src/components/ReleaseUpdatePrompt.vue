<template>
  <transition name="fade-slide">
    <section v-if="visible && latest" class="release-update bg-card border-default color-text-primary border-radius-18px fixed">
      <header class="flex flex-column gap-10">
        <p class="color-primary txt-xs txt-weight-medium text-uppercase letter-spacing-01em margin-0">
          Update available
        </p>
        <h4 class="margin-0 txt-md txt-weight-light">
          {{ (latest.release && latest.release.version) || latest.version }}
        </h4>
        <p class="color-text-secondary txt-xs margin-0">Current version: {{ currentVersion || 'n/a' }}</p>
      </header>

      <button v-if="hasNotes" class="release-prompt-notes-link bg-transparent border-none cursor-pointer underline margin-top-25 padding-0 fs-085rem" type="button" @click="notesOpen = true">
        Change notes
      </button>

      <ul class="meta color-text-secondary txt-xs margin-top-25">
        <li><strong>Platform:</strong> {{ latest.platform }}</li>
        <li><strong>Channel:</strong> {{ latest.channel }}</li>
        <li><strong>Artifact:</strong> {{ latest.artifact.kind }}</li>
        <li v-if="sizeLabel"><strong>Size:</strong> ~{{ sizeLabel }}</li>
        <li v-if="shaFull">
          <strong>SHA256:</strong>
          <button type="button" class="release-prompt-sha-copy bg-transparent border-none cursor-pointer padding-0" @click.stop="copySha" aria-label="Copy SHA-256">
            <code class="release-prompt-sha-short color-text-primary bg-fill-tertiary border-light border-radius-8px mono">{{ shaShort }}</code>
          </button>
        </li>
      </ul>

      <div class="gap-25 flex flex-wrap-wrap margin-top-25">
        <UiButton
          class="flex-align-justify-center gap-50 padding-50 border-radius-10px txt-xs flex-1-1-auto"
          :variant="downloadDisabled ? 'ghost' : 'primary'"
          :disabled="downloadDisabled || busy"
          @click="onUpdate"
        >
          <template v-if="busy">
            <UiSpinner size="sm" />
            <span>{{ busyLabel }}</span>
          </template>
          <template v-else>
            <span>{{ primaryLabel }}</span>
          </template>
        </UiButton>
        <UiButton
          class="flex-align-justify-center gap-50 padding-50 border-radius-10px txt-xs flex-1-1-auto"
          variant="ghost"
          @click="remindLater"
        >
          Remind me later
        </UiButton>
      </div>
    </section>
  </transition>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="notesOpen" class="release-prompt-notes-overlay flex-align-justify-center fixed inset-0 bg-black-a50" @click.self="notesOpen = false">
        <div class="release-prompt-notes-modal bg-card border-default flex flex-column border-radius-16px shadow-panel-lg overflow-hidden">
          <div class="release-prompt-notes-head flex-align-center-justify-space-between gap-100 padding-75-87">
            <h3 class="release-prompt-notes-title color-text-primary margin-0 fs-16px">Change notes</h3>
            <button type="button" class="release-prompt-notes-close bg-transparent border-none color-text-secondary cursor-pointer fs-15rem line-height-1" @click="notesOpen = false">&times;</button>
          </div>
          <pre class="release-prompt-notes-body color-text-primary bg-primary margin-0 padding-87 overflow-auto fs-14px line-height-14 break-word pre-wrap mono">{{ fullNotes }}</pre>
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
const primaryLabel = computed(() => {
  const p = String(latest.value?.platform || '').toLowerCase();
  if (p.startsWith('darwin-')) return 'Open installer';
  if (p.startsWith('windows-') || p.startsWith('linux-')) return 'Update now';
  return 'Download';
});

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
