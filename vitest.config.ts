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
    /**
     * Vitest defaults to 5s, which suits a test that renders something and
     * suits nothing here that touches a key. Profile creation, password change
     * and profile export each derive a key and generate a Dilithium pair, and
     * that work is slow *by design* - a key derivation fast enough to finish in
     * milliseconds would be a weak one.
     *
     * On an idle machine they land around two seconds and the default holds.
     * Under a loaded one they cross five, and which files went red changed from
     * run to run - password-change one time, profile-backup-roundtrip and
     * e2e-chain-guard the next - all of them passing when run alone. A gate
     * that fails on a different file each time is a gate people learn to
     * re-run rather than read, so the limit now sits where only a genuinely
     * stuck test can reach it.
     */
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text']
    }
  }
});
