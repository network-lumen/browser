/**
 * Desktop target: there is nothing to install.
 *
 * Electron's preload (`electron/preloads/preload.cjs`) has already put
 * `window.lumen` in place before any renderer module is evaluated, which is
 * earlier than this code could possibly run.
 *
 * This file exists so `src/main.ts` can call the same function on both
 * targets and stay free of `if (mobile)`. It is the default alias for
 * `@platform` in `vite.config.ts`, so the desktop build keeps behaving exactly
 * as it did before the split - one no-op call, tree-shaken to nothing.
 */
export function installPlatformBridge(): void {
  /* preload owns the bridge here */
}
