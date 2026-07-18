import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

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
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx,js,jsx}'],
    setupFiles: ['tests/unit/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text']
    }
  }
});
