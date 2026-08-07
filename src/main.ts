/// <reference types="vite/client" />
import { createApp } from 'vue';
import App from './App.vue';
import './css/index.css';
import { ALL_COMPONENTS } from './internal/routes';
import { initAppSettings } from './internal/services/appSettings';
import { installRendererErrorReporting } from './internal/services/errorReporting';

// First, and before anything that can throw: an error during startup is the
// one most worth having on disk, and the least likely to be seen otherwise.
installRendererErrorReporting();

// Prevent tree-shaking of route components
if (import.meta.env.DEV) {
  console.warn('[main.ts] Loaded components:', ALL_COMPONENTS.length);
}

void initAppSettings();

createApp(App).mount('#app');
