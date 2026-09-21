/// <reference types="vite/client" />
import { installPlatformBridge } from '@platform';
import { createApp } from 'vue';
import App from './App.vue';
import './css/index.css';
import { ALL_COMPONENTS } from './internal/routes';
import { initAppSettings } from './internal/services/appSettings';
import { installRendererErrorReporting } from './internal/services/errorReporting';
import { initLocale } from './stores/i18nStore';

// Before everything, error reporting included: on desktop this is a no-op,
// because Electron's preload installed window.lumen long before any of this
// ran. On the mobile target it IS the bridge - and error reporting itself
// reports through the bridge. See platform/README.md.
installPlatformBridge();

// Then, and before anything that can throw: an error during startup is the
// one most worth having on disk, and the least likely to be seen otherwise.
installRendererErrorReporting();

// Prevent tree-shaking of route components
if (import.meta.env.DEV) {
  console.warn('[main.ts] Loaded components:', ALL_COMPONENTS.length);
}

// Before the first render, so nothing is painted in English and swapped.
initLocale();

void initAppSettings();

createApp(App).mount('#app');
