import type { LumenBridge } from '../types/lumenBridge';

/**
 * Single access point for `window.lumen` as exposed by `electron/preload.cjs`
 * — the trusted API available only in the main app window (wallet, profiles,
 * dns admin, gateways, extensions, security, ...). Centralizing every call
 * site through this composable means a future rename/refactor of that global
 * touches one file instead of every page that reads `window.lumen`.
 *
 * Not to be confused with the far more restricted `window.lumen` that
 * `electron/webview-preload.cjs` injects into `<webview>` content — same
 * global property name, but a completely different object living in a
 * completely different JS realm (the guest page's isolated world, not the
 * app's own renderer). That one is intentionally left as-is: it's a public,
 * documented, single-file API (see docs/window-lumen.json) for third-party
 * sites, not something scattered across this codebase.
 *
 * May be `undefined` if the preload bridge failed to inject (see
 * src/internal/common/fatal_errors.ts, which fails fast on startup for a
 * missing/renamed API) — callers should keep using `?.` after calling this.
 */
export function useInternalLumen(): LumenBridge | undefined {
  return (window as any).lumen;
}
