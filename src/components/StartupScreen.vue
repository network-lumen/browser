<template>
  <div class="splash-shell">
    <div class="glass">
      <section class="body">
        <div v-if="phase === 'starting' || phase === 'retrying'" class="center">
          <div class="spinner"></div>
          <div class="msg">
            <div class="msg-title">
              {{ phase === 'retrying' ? 'Reconnecting...' : 'Starting services...' }}
            </div>
          </div>
        </div>

        <div v-else-if="phase === 'error'" class="center">
          <div class="warn">!</div>
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
      </section>
    </div>

    <div class="bg">
      <div class="blob b1"></div>
      <div class="blob b2"></div>
      <div class="blob b3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

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

  let tries = 15;
  while (tries-- > 0) {
    const ok = await pollOnce();
    if (ok) {
      await sleep(200);
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
.splash-shell {
  position: relative;
  width: min(720px, 92vw);
  height: min(420px, 70vh);
}

.glass {
  z-index: 1;
  position: absolute;
  inset: 10px;
  border-radius: 15px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.body {
  flex: 1 1 auto;
  display: flex;
  position: relative;
}

.center {
  margin: auto;
  padding: 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid rgba(15, 23, 42, 0.1);
  border-top-color: var(--accent-secondary);
  animation: spin 0.9s linear infinite;
}

.warn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid rgba(220, 38, 38, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b91c1c;
  font-weight: 700;
  font-size: 20px;
}

.msg-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.msg-subtitle {
  font-size: 13px;
  color: #4b5563;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-size: 13px;
  cursor: pointer;
  background: #ffffff;
}

.btn.primary {
  border-color: var(--accent-secondary);
  background: var(--accent-secondary);
  color: #ffffff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(22px);
}

.blob.b1 {
  width: 200px;
  height: 200px;
  left: -30px;
  top: -30px;
  background: #93c5fd;
}

.blob.b2 {
  width: 220px;
  height: 220px;
  right: -40px;
  bottom: -30px;
  background: #a5b4fc;
}

.blob.b3 {
  width: 160px;
  height: 160px;
  left: 20%;
  top: 60%;
  background: #6ee7b7;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

