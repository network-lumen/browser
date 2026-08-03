import { defineConfig } from 'vitest/config';

/**
 * Test config kept separate from vite.config.ts on purpose.
 *
 * vitest 1.x ships its own nested Vite 5 while the app builds on Vite 6, so a
 * `test` block inside vite.config.ts cannot type-check: vitest augments the
 * `UserConfig` of *its* Vite, not the top-level one. Splitting the two lets
 * each file import `defineConfig` from the package that actually types it.
 *
 * Vitest picks this file over vite.config.ts automatically. The unit tests
 * import no `.vue` files, so no Vue plugin is needed here.
 */
export default defineConfig({
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
