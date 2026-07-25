/// <reference types="vite/client" />
import { createApp } from 'vue';
import App from './App.vue';
import './css/index.css';
import { ALL_COMPONENTS } from './internal/routes';
import { initAppSettings } from './internal/services/appSettings';

// Prevent tree-shaking of route components
if (import.meta.env.DEV) {
  console.warn('[main.ts] Loaded components:', ALL_COMPONENTS.length);
}

void initAppSettings();

createApp(App).mount('#app');
