<template>
  <transition name="fade">
    <section v-if="visible && latest" class="release-update">
      <header class="flex flex-column gap-10">
        <p class="txt-xxs txt-weight-bold color-blue-strong text-uppercase letter-spacing-01 margin-0">
          Update available
        </p>
        <h4 class="margin-0 txt-md txt-weight-semibold color-gray-blue-dark">
          {{ (latest.release && latest.release.version) || latest.version }}
        </h4>
        <p class="txt-xs color-gray-blue margin-0">Current version: {{ currentVersion || 'n/a' }}</p>
      </header>

      <p v-if="notes" class="notes txt-xs color-gray-blue margin-top-25 margin-bottom-0">{{ notes }}</p>

      <ul class="meta txt-xxs color-gray-blue margin-top-25">
        <li><strong>Platform:</strong> {{ latest.platform }}</li>
        <li><strong>Artifact:</strong> {{ latest.artifact.kind }}</li>
        <li v-if="sizeLabel"><strong>Size:</strong> ~{{ sizeLabel }}</li>
        <li v-if="latest.artifact.sha256Hex"><strong>SHA256:</strong> {{ latest.artifact.sha256Hex }}</li>
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
            <span>Opening…</span>
          </template>
          <template v-else>
            <span>Update now</span>
          </template>
        </UiButton>
        <UiButton
          class="button padding-50 border-radius-10px txt-xxs flex-1-1-auto"
          variant="cta"
          @click="remindLater"
        >
          Remind me later
        </UiButton>
      </div>
    </section>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import { formatReleaseSize, useReleaseUpdates } from '../internal/services/releaseUpdates';

const { latest, shouldPrompt, currentVersion, updateNow, remindLater, busy } = useReleaseUpdates();

const visible = computed(() => shouldPrompt.value && !!latest.value);
const downloadDisabled = computed(() => !latest.value?.downloadUrl);
const sizeLabel = computed(() => formatReleaseSize(latest.value?.artifact?.size ?? null));
const notes = computed(() => {
  const raw = String(latest.value?.release?.notes || '').trim();
  if (!raw) return '';
  return raw.length > 240 ? `${raw.slice(0, 240)}…` : raw;
});

function onUpdate() {
  if (downloadDisabled.value || busy.value) return;
  void updateNow();
}
</script>

<style scoped>
.release-update {
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  box-shadow: 0 10px 35px rgba(15, 23, 42, 0.15);
  padding: 20px;
  width: min(360px, 92vw);
  z-index: 50;
  position: fixed;
  bottom: 24px;
  right: 24px;
}
.release-update .meta {
  list-style: none;
  padding: 0;
  margin: 0;
}
.release-update .meta li + li {
  margin-top: 6px;
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
</style>

