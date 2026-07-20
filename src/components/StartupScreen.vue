<template>
  <div class="startup-card bg-card border-default flex flex-column w-full h-full border-radius-0 shadow-none overflow-hidden" role="status" aria-live="polite">
    <header class="startup-head flex-align-center gap-75 padding-62 border-bottom-default">
      <div class="startup-mark bg-gradient-primary color-white flex-align-justify-center flex-0-0-auto fs-18px border-radius-14px w-42px h-42px fw-900" aria-hidden="true">L</div>
      <div class="min-w-0">
        <div class="startup-title fs-16px txt-weight-strong line-height-12 letter-spacing-n002">Lumen</div>
      </div>
    </header>

    <main class="startup-body h-auto flex flex-1-1-auto min-h-0">
      <div v-if="phase === 'starting' || phase === 'retrying'" class="startup-center flex-align-center flex-column text-center gap-87 padding-28px-22px">
        <div class="ring-spinner ring-spinner-lg" aria-label="Loading"></div>
      </div>

      <div v-else-if="phase === 'error'" class="startup-center flex-align-center flex-column text-center gap-87 padding-28px-22px">
        <div>
          <div class="startup-msg-subtitle color-text-secondary fs-13px">
            Unable to start - {{ errorText || 'IPFS daemon did not respond.' }}
          </div>
          <button class="startup-btn startup-btn-primary bg-gradient-primary color-white border-default cursor-pointer margin-bottom-100 border-radius-md fs-13px shadow-primary padding-62-100 fw-650 border-color-transparent" type="button" :disabled="busy" @click="restartAll">
            Retry
          </button>
        </div>
      </div>
    </main>

    <footer class="startup-foot flex-justify-center border-top-default padding-75-100">
      <span v-if="phase !== 'error'" class="startup-hint color-text-tertiary fs-12px">This usually takes a few seconds.</span>
      <span v-else class="startup-hint color-text-tertiary fs-12px">If it keeps failing, restart Lumen.</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useInternalLumen } from '../composables/useInternalLumen';

type Phase = 'starting' | 'retrying' | 'error' | 'ready';

const emit = defineEmits<{ (e: 'ready'): void }>();

const phase = ref<Phase>('starting');
const errorText = ref('');
const busy = ref(false);

// TEMP (debug): keep the splash visible long enough to inspect styling.
const MIN_VISIBLE_MS = 5000;
let bootStartedAt = 0;

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
  bootStartedAt = Date.now();

  let tries = 15;
  while (tries-- > 0) {
    const ok = await pollOnce();
    if (ok) {
      const elapsed = Date.now() - bootStartedAt;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      if (remaining) await sleep(remaining);
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
