import { createApp } from 'vue';
import App from './App.vue';
import './css/index.css';
import { ALL_COMPONENTS } from './internal/routes.ts';

// Prevent tree-shaking of route components
if (import.meta.env.DEV) {
  console.log('[main.ts] Loaded components:', ALL_COMPONENTS.length);
}

createApp(App).mount('#app');
