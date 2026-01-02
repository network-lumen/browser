<template>
  <main class="app-root">
    <StartupScreen
      v-if="stage === 'startup'"
      @ready="handleStartupReady"
    />
    <MainScreen v-else />
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import StartupScreen from './components/StartupScreen.vue';
import MainScreen from './components/MainScreen.vue';
import { useTheme } from './composables/useTheme';

type Stage = 'startup' | 'main';

// Initialize theme
const { initTheme } = useTheme();
initTheme();

const params = new URLSearchParams(window.location.search);
const isSplashWindow = params.get('splash') === '1';

const stage = ref<Stage>(isSplashWindow ? 'startup' : 'main');

function syncWindowMode(s: Stage) {
  const anyWindow: any = window;
  if (anyWindow.lumen && typeof anyWindow.lumen.setWindowMode === 'function') {
    anyWindow.lumen.setWindowMode(s);
  }
}

function handleStartupReady() {
  const anyWindow: any = window;
  if (isSplashWindow && anyWindow.lumen && typeof anyWindow.lumen.openMainWindow === 'function') {
    anyWindow.lumen.openMainWindow();
  } else {
    stage.value = 'main';
  }
}

onMounted(() => {
  syncWindowMode(stage.value);
});

watch(stage, (s) => {
  syncWindowMode(s);
});
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(1200px 400px at -10% 150%, var(--primary-a25), transparent 60%),
              radial-gradient(1200px 400px at 110% -50%, var(--white-blue-light), transparent 60%),
              linear-gradient(135deg, var(--white-blue-light), var(--white-blue-light));
}
</style>
