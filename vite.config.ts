import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Test config lives in vitest.config.ts, not here - see the comment in that
// file for why the two cannot share one config under vitest 1.x + Vite 6.
export default defineConfig({
  base: './',
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'webview'
        }
      }
    })
  ],
  root: '.',
  server: {
    port: 5173,
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
