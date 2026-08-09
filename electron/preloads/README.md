# electron/preloads

The four scripts Electron injects into a renderer before the page runs.

| file | context | what it exposes |
|---|---|---|
| `preload.cjs` | the app window (the Vue SPA) | the full `window.lumen` bridge |
| `webview-preload.cjs` | every `<webview>`, partition `persist:lumen` | the site-facing `window.lumen`, the `keplr`/`leap` wallet shims, the `chrome`/`browser` extension shim |
| `extension-preload.cjs` | `chrome-extension://` pages outside a webview | the same extension shim, for popups and options pages |
| `store-preload.cjs` | the Chrome Web Store in a webview | the "Import into Lumen" button |

**The rule of this folder: a preload cannot `require()` a local file.** They run
sandboxed, where `require` only serves a small built-in allowlist. Point one at
a module of ours and it does not throw — it stops loading, in silence, and every
page it served loses everything it exposed. That is why `safeString` exists four
times over instead of being imported, and why `webview-preload.cjs` is
deliberately one large self-sufficient file: an earlier pass extracted ~46
helpers into `utils/webview.cjs` for readability and broke every site until it
was put back.

`tests/unit/runtime-paths.test.ts` holds both halves of that: no preload may
require a relative path, and every `path.join(__dirname, …)` in `electron/` must
point at a file that exists. The second one matters here more than anywhere —
Electron resolves those paths when it attaches a preload, and a wrong one is
silent too.

Filenames are kept as they were on purpose. `scripts/check-ipc.mjs` reads them
by name to compare the two extension shims, the doc generator reads
`webview-preload.cjs` to build `docs/window-lumen.json`, and a dozen comments
across `src/` name them. The stutter in `preloads/preload.cjs` is worth less
than those staying true.
