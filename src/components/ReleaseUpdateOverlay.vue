<template>
  <UiModal :model-value="active" panel-class="w-min-520px-92vw color-text-primary" :closable="false" @update:model-value="() => {}">
    <div class="flex-align-start flex-justify-space-between gap-16px mb-16px">
      <div>
        <div class="text-12px letter-spacing-008em text-uppercase color-primary">Updating Lumen</div>
        <div class="text-20px txt-weight-medium">{{ latest?.version || 'Preparing update' }}</div>
      </div>
    </div>

    <div class="h-12px border-radius-full bg-fill-tertiary overflow-hidden">
      <div class="h-full border-radius-full bg-gradient-primary transition-width-02" :style="{ width: `${percent}%` }"></div>
    </div>
    <div class="mt-8px flex-justify-space-between text-14px color-text-secondary">
      <span v-if="bytesLabel">{{ bytesLabel }}</span>
      <span v-if="percentKnown">{{ percent }}%</span>
    </div>

    <div v-if="errorLabel" class="mt-16px p-12px border-radius-12px bg-fill-error color-text-primary flex-align-center flex-justify-space-between gap-12px">
      {{ errorLabel }}
      <UiButton variant="secondary" type="button" @click="clearError">Close</UiButton>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
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
