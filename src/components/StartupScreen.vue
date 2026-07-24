<template>
  <UiCard padding="none" :shadow="false" radius="0" role="status" aria-live="polite" class="startup-card flex flex-column w-full h-full shadow-none overflow-hidden">
    <header class="startup-head flex-align-center gap-12px p-10px border-bottom-default">
      <img :src="logoUrl" alt="" class="startup-mark flex-0-0-auto border-radius-14px size-48px" aria-hidden="true" />
      <div class="min-w-0">
        <div class="startup-title text-16px txt-weight-strong line-height-12 letter-spacing-n002">Lumen</div>
      </div>
    </header>

    <main class="startup-body h-auto flex flex-1-1-auto min-h-0">
      <div v-if="phase === 'starting' || phase === 'retrying'" class="startup-center flex-align-center flex-column text-center gap-12px py-28px px-24px mt-auto mx-auto mb-32px">
        <UiLoadingSpinner aria-label="Loading" />
      </div>

      <div v-else-if="phase === 'error'" class="startup-center flex-align-center flex-column text-center gap-12px py-28px px-24px mt-auto mx-auto mb-32px">
        <div>
          <div class="startup-msg-subtitle color-text-secondary text-13px">
            Unable to start - {{ errorText || 'IPFS daemon did not respond.' }}
          </div>
          <UiButton variant="primary" type="button" :disabled="busy" @click="restartAll" class="active-not-disabled-lift-1px disabled-opacity-60-cursor-default startup-btn-primary transition-lift-015">
            Retry
          </UiButton>
        </div>
      </div>
    </main>

    <footer class="startup-foot flex-justify-center border-top-default py-12px px-16px">
      <span v-if="phase !== 'error'" class="startup-hint color-text-tertiary text-12px">This usually takes a few seconds.</span>
      <span v-else class="startup-hint color-text-tertiary text-12px">If it keeps failing, restart Lumen.</span>
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

type Phase = 'starting' | 'retrying' | 'error' | 'ready';

const emit = defineEmits<{ (e: 'ready'): void }>();

const phase = ref<Phase>('starting');
const errorText = ref('');
const busy = ref(false);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOnce(): Promise<boolean> {
  try {
    if (!useInternalLumen() || typeof useInternalLumen().ipfsStatus !== 'function') {
      console.warn('[startup] window.lumen.ipfsStatus not available yet');
      return false;
    }
    const res = await useInternalLumen().ipfsStatus();
    console.log('[startup] ipfsStatus result', res);
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
