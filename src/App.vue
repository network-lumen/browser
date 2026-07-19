<template>
  <main class="app-shell" :class="{ startup: stage === 'startup' }">
    <StartupScreen
      v-if="stage === 'startup'"
      @ready="handleStartupReady"
    />
    <SecurityGate v-else>
      <div v-if="fatalError">
        <p>Fatal error:</p>
        <pre>{{ fatalError.message }}</pre>
      </div>
      <MainScreen v-else />
    </SecurityGate>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, onErrorCaptured } from 'vue';
import StartupScreen from './components/StartupScreen.vue';
import MainScreen from './components/MainScreen.vue';
import SecurityGate from './components/SecurityGate.vue';
import { useTheme } from './composables/useTheme';
import { FATAL_ERROR_MAP, checkLumenAPIReferences } from './internal/common/fatal_errors';
import { useInternalLumen } from './composables/useInternalLumen';

type Stage = 'startup' | 'main';

// Initialize theme
const { initTheme } = useTheme();
initTheme();


const fatalError = ref<Error | null>(null);






// Initialize font size
const savedFontSize = localStorage.getItem('lumen-font-size') || 'medium';
document.documentElement.setAttribute('data-font-size', savedFontSize);

const params = new URLSearchParams(window.location.search);
const isSplashWindow = params.get('splash') === '1';

const stage = ref<Stage>(isSplashWindow ? 'startup' : 'main');

function syncWindowMode(s: Stage) {
  const lumen = useInternalLumen();
  if (lumen && typeof lumen.setWindowMode === 'function') {
    lumen.setWindowMode(s);
  }
}

function handleStartupReady() {
  const lumen = useInternalLumen();
  if (isSplashWindow && lumen && typeof lumen.openMainWindow === 'function') {
    lumen.openMainWindow();
  } else {
    stage.value = 'main';
  }
}

function isDevtoolsShortcut(event: KeyboardEvent) {
  const key = String(event.key || '').toUpperCase();
  if (key === 'F12') return true;
  if (event.ctrlKey && event.altKey && key === 'I') return true;
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'I') return true;
  return false;
}

function onGlobalKeydown(event: KeyboardEvent) {
  if (!isDevtoolsShortcut(event)) return;
  const api = useInternalLumen()?.devtools;
  if (!api || typeof api.openActive !== 'function') return;
  event.preventDefault();
  void api.openActive();
}

onMounted(async () => {
  try { await checkLumenAPIReferences() }
  catch (err: any) {
      const code = err.message;
    if(code) {
      fatalError.value = new Error(
        FATAL_ERROR_MAP[code] ?
        FATAL_ERROR_MAP[code] + `\n\nGet help on the Lumen community website (https://lumen-browser.com/community/) or contact us at contact@lumen-browser.com`
        : code+ `\n\nGet help on the Lumen community website (https://lumen-browser.com/community/) or contact us at contact@lumen-browser.com`
      );
    }
  }
  syncWindowMode(stage.value);
  window.addEventListener('keydown', onGlobalKeydown, true);
});

watch(stage, (s) => {
  syncWindowMode(s);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown, true);
});
</script>
