<template>
  <transition name="fade-slide">
    <section v-if="visible && latest" class="release-update bg-card border-default color-text-primary border-radius-18px fixed p-16px w-min-380px-92vw shadow-0-20-55-rgba-0-0-0-0-18 z-9998 bottom-24px right-24px">
      <header class="flex flex-column gap-2px">
        <p class="color-primary txt-xs txt-weight-medium text-uppercase letter-spacing-01em m-0px">
          Update available
        </p>
        <h4 class="m-0px txt-md txt-weight-light">
          {{ (latest.release && latest.release.version) || latest.version }}
        </h4>
        <p class="color-text-secondary txt-xs m-0px">Current version: {{ currentVersion || 'n/a' }}</p>
      </header>

      <button v-if="hasNotes" class="hover-opacity-85 bg-transparent border-none cursor-pointer underline mt-4px p-0px text-14px color-text-link text-underline-offset-2px" type="button" @click="notesOpen = true">
        Change notes
      </button>

      <ul class="meta list-style-none m-0px color-text-secondary txt-xs p-0px">
        <li><strong>Platform:</strong> {{ latest.platform }}</li>
        <li><strong>Channel:</strong> {{ latest.channel }}</li>
        <li><strong>Artifact:</strong> {{ latest.artifact.kind }}</li>
        <li v-if="sizeLabel"><strong>Size:</strong> ~{{ sizeLabel }}</li>
        <li v-if="shaFull">
          <strong>SHA256:</strong>
          <button type="button" class="hover-opacity-85 bg-transparent border-none cursor-pointer p-0px ml-4px" @click.stop="copySha" aria-label="Copy SHA-256">
            <code class="release-prompt-sha-short color-text-primary bg-fill-tertiary border-light border-radius-8px mono py-0px px-8px">{{ shaShort }}</code>
          </button>
        </li>
      </ul>

      <div class="gap-4px flex flex-wrap-wrap mt-4px">
        <UiButton
          class="flex-align-justify-center gap-8px p-8px border-radius-10px txt-xs flex-1-1-auto"
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
          class="flex-align-justify-center gap-8px p-8px border-radius-10px txt-xs flex-1-1-auto"
          variant="ghost"
          @click="remindLater"
        >
          Remind me later
        </UiButton>
      </div>
    </section>
  </transition>

  <UiModal :model-value="notesOpen" title="Change notes" panel-class="w-min-720px-92vw" @update:model-value="notesOpen = false">
    <pre class="release-prompt-notes-body color-text-primary bg-primary m-0px overflow-auto text-14px line-height-14 break-word pre-wrap mono">{{ fullNotes }}</pre>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { formatReleaseSize, useReleaseUpdates } from '../internal/services/releaseUpdates';
import { addToast } from '../stores/toastStore';
import { copyToClipboard } from '../composables/useClipboard';

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
  const ok = await copyToClipboard(value);
  addToast(ok ? 'success' : 'error', ok ? 'SHA-256 copied' : 'Copy failed');
}

function onUpdate() {
  if (downloadDisabled.value || busy.value) return;
  void updateNow();
}
</script>
