<template>
  <UiCard padding="none" :shadow="false" radius="0" role="status" aria-live="polite" class="flex flex-column w-full h-full shadow-none overflow-hidden">
    <header class="flex-align-center gap-12px p-10px border-bottom-default">
      <img :src="logoUrl" alt="" class="flex-0-0-auto border-radius-14px size-48px" aria-hidden="true" />
      <div class="min-w-0">
        <div class="text-16px txt-weight-strong line-height-12 letter-spacing-n002">Lumen</div>
      </div>
    </header>

    <main class="h-auto flex flex-1-1-auto min-h-0">
      <div v-if="phase === 'starting' || phase === 'retrying' || phase === 'error'" class="flex-align-center flex-column text-center gap-12px py-28px px-24px mt-auto mx-auto mb-32px">
        <UiLoadingSpinner v-if="phase !== 'error'" aria-label="Loading" />
        <div v-else>
          <div class="color-text-secondary text-13px">
            Unable to start - {{ errorText || 'IPFS daemon did not respond.' }}
          </div>
          <UiButton variant="primary" type="button" :disabled="busy" @click="restartAll" class="active-not-disabled-lift-1px disabled-opacity-60-cursor-default transition-lift-015">
            Retry
          </UiButton>
        </div>
      </div>
    </main>

    <footer class="flex-justify-center border-top-default py-12px px-16px">
      <span class="color-text-tertiary text-12px">{{ phase !== 'error' ? 'This usually takes a few seconds.' : 'If it keeps failing, restart Lumen.' }}</span>
    </footer>
  </UiCard>
</template>

<script setup lang="ts">
import UiCard from '../ui/UiCard.vue';
import UiButton from '../ui/UiButton.vue';
import UiLoadingSpinner from '../ui/UiLoadingSpinner.vue';
import { ref, onMounted } from 'vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import logoUrl from '../img/logo.png';
import type { Phase } from '../types/startupScreen';

const emit = defineEmits<{ (e: 'ready'): void }>();

const phase = ref<Phase>('starting');
const errorText = ref('');
const busy = ref(false);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOnce(): Promise<boolean> {
  try {
    if (!useInternalLumen() || typeof useInternalLumen()?.ipfsStatus !== 'function') {
      console.warn('[startup] window.lumen.ipfsStatus not available yet');
      return false;
    }
    const res = await useInternalLumen()?.ipfsStatus();
    return !!res?.ok;
  } catch (e) {
    console.error('[startup] ipfsStatus error', e);
    return false;
  }
}

async function bootSequence() {
  phase.value = 'starting';
  errorText.value = '';

  let tries = 15;
  while (tries-- > 0) {
    const ok = await pollOnce();
    if (ok) {
      emit('ready');
      return;
    }
    await sleep(1000);
  }

  phase.value = 'error';
  if (!errorText.value) {
    errorText.value = 'IPFS daemon not reachable.';
  }
}

async function restartAll() {
  busy.value = true;
  try {
    phase.value = 'retrying';
    await sleep(200);
    await bootSequence();
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await bootSequence();
});
</script>
