<template>
  <main class="app-shell flex" :class="{ startup: stage === 'startup' }">
    <StartupScreen
      v-if="stage === 'startup'"
      @ready="handleStartupReady"
    />
    <SecurityGate v-else>
      <div v-if="fatalError">
        <p>{{ t('Fatal error:') }}</p>
        <pre>{{ fatalError.message }}</pre>
      </div>
      <MainScreen v-else />
    </SecurityGate>
  </main>
</template>

<script setup lang="ts">
import { t } from './stores/i18nStore';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import StartupScreen from './components/StartupScreen.vue';
import MainScreen from './components/MainScreen.vue';
import SecurityGate from './components/SecurityGate.vue';
import { useTheme } from './composables/useTheme';
import { FATAL_ERROR_MAP, checkLumenAPIReferences } from './internal/common/fatal_errors';
import { useInternalLumen } from './composables/useInternalLumen';
import type { Stage } from './types/app';
import { STORAGE_KEYS, readString } from './internal/services/storage';
import { errorMessage } from './internal/services/coerce';

// Initialize theme
const { initTheme } = useTheme();
initTheme();

const fatalError = ref<Error | null>(null);

// Initialize font size
const savedFontSize = readString(STORAGE_KEYS.fontSize) || 'medium';
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
  catch (err) {
      const code = errorMessage(err);
    if(code) {
      const help = '\n\n' + t('Get help on the Lumen community website ({url}) or contact us at {email}', {
        url: 'https://lumen-browser.com/community/',
        email: 'contact@lumen-browser.com'
      });
      const mapped = FATAL_ERROR_MAP[code];
      fatalError.value = new Error((typeof mapped === 'string' ? t(mapped) : code) + help);
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
