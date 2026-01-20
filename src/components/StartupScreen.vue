<template>
  <div class="card" role="status" aria-live="polite">
    <header class="head">
      <div class="mark" aria-hidden="true">L</div>
      <div class="brand">
        <div class="title">Lumen</div>
        <div class="subtitle">Starting secure services</div>
      </div>
    </header>

    <main class="body">
      <div v-if="phase === 'starting' || phase === 'retrying'" class="center">
        <div class="spinner" aria-label="Loading"></div>
      </div>

      <div v-else-if="phase === 'error'" class="center">
        <div class="warn" aria-hidden="true">!</div>
        <div class="msg">
          <div class="msg-title">Unable to start</div>
          <div class="msg-subtitle">
            {{ errorText || 'IPFS daemon did not respond.' }}
          </div>
        </div>
        <div class="row">
          <button class="btn primary" type="button" :disabled="busy" @click="restartAll">
            Retry
          </button>
        </div>
      </div>
    </main>

    <footer class="foot">
      <span v-if="phase !== 'error'" class="hint">This usually takes a few seconds.</span>
      <span v-else class="hint">If it keeps failing, restart Lumen.</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

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
    const anyWindow: any = window;
    if (!anyWindow.lumen || typeof anyWindow.lumen.ipfsStatus !== 'function') {
      console.warn('[startup] window.lumen.ipfsStatus not available yet');
      return false;
    }
    const res = await anyWindow.lumen.ipfsStatus();
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

<style scoped>
.card {
  width: 100%;
  height: 100%;
  border-radius: 0;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: var(--border-width) solid var(--border-color);
}

.mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 900;
  letter-spacing: -0.03em;
  font-size: 18px;
  flex: 0 0 auto;
}

.brand {
  min-width: 0;
}

.title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.2;
}

.body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}

.center {
  margin: auto;
  padding: 28px 22px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.spinner {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid var(--fill-secondary);
  border-top-color: var(--accent-primary);
  animation: spin 0.9s linear infinite;
}

.warn {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 3px solid rgba(var(--ios-red-rgb), 0.28);
  background: var(--fill-error);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--error-red);
  font-weight: 850;
  font-size: 20px;
}

.msg-title {
  font-size: 18px;
  font-weight: 780;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.msg-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 4px;
}

.btn {
  padding: 10px 16px;
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--border-color);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  background: var(--card-bg);
  color: var(--text-primary);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.btn.primary {
  border-color: transparent;
  background: var(--gradient-primary);
  color: #ffffff;
  box-shadow: var(--shadow-primary);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.foot {
  padding: 12px 18px;
  border-top: var(--border-width) solid var(--border-color);
  display: flex;
  justify-content: center;
}

.hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

