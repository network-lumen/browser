# Platform targets

The renderer in `src/` is platform-agnostic: it reaches everything native
through the single `window.lumen` bridge, accessed from exactly one place
(`src/composables/useInternalLumen.ts`) and described as data in
`src/internal/common/lumenBridgeSurface.ts`.

That is what makes a second target possible without forking the front-end.
This directory holds the per-target code that *installs* that bridge.

| target | how `window.lumen` appears | build |
|---|---|---|
| `desktop` (default) | Electron injects it from `electron/preloads/preload.cjs`, before any renderer code runs | `npm run build` → `dist/` |
| `mobile` | No preload exists, so the renderer installs it itself at startup | `npm run build:mobile` → `dist-mobile/` |

`vite.config.ts` aliases `@platform` to one of the two `install.ts` files based
on `LUMEN_TARGET`. `src/main.ts` calls `installPlatformBridge()` first thing.
On desktop that call is a no-op, so **the desktop build and runtime are
unchanged** — `electron/` is not touched by any of this.

## Why the mobile bridge is generated, not written

`platform/mobile/bridge/stub.ts` builds the bridge by walking
`REQUIRED_FUNCTIONS` / `REQUIRED_VALUES` / `REQUIRED_NAMESPACES` — the same
lists `fatal_errors.ts` validates against and `src/types/lumenBridge.ts` derives
its type from.

Two things follow, and both are the point:

- the stub bridge passes the startup check **by construction**, so the app boots
  on Android the day the shell exists;
- it cannot drift. A member added to the contract for the desktop gets a mobile
  stub automatically, and shows up in the console inventory as unimplemented
  rather than as `undefined is not a function` in front of a user.

## Filling it in

Nothing here talks to Capacitor yet — that is deliberate, this is the seam and
the scaffolding only. To implement a member, add it to
`platform/mobile/impl/index.ts`; the registry overrides the stub, and
`support.ts` records what is expected to exist on mobile at all.

Run the app (any target) and call `__lumenBridgeReport()` in the console for the
current state: implemented / stubbed / intentionally unsupported.
