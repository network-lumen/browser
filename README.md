# Lumen Browser

A desktop browser that reaches decentralized content without going through a
centralized door. It ships its own IPFS node, its own gateway client, a
Cosmos-SDK chain client and a post-quantum wallet, and it renders ordinary web
pages alongside them.

Not an Electron shell around a website: the browser *is* the client. There is no
Lumen server it has to reach to work.

```
lumen://wallet     accounts across 221 Cosmos chains, staking, IBC
lumen://ipfs       add, pin, browse; the node is local
lumen://drive      your files, addressed by content
lumen://network    chain explorer, validators, governance
lumen://gateways   the gateway network, and running one
```

---

## What is actually in here

| Area | Where | What it does |
|---|---|---|
| **IPFS** | `electron/ipfs.cjs` | Kubo daemon, local repo and gateway, pin jobs that survive a restart, public-gateway discovery and propagation, an LRU pin cache with a quota |
| **Chain** | `electron/chain/`, `electron/ipc/chain.cjs` | REST/RPC through a peer pool rather than a hardcoded endpoint; height, validators, governance, transactions |
| **Wallet** | `electron/ipc/wallet.cjs` | send, IBC transfer, delegate, undelegate, redelegate, claim, governance votes - on the home chain and on any Cosmos chain in the registry |
| **PQC** | `electron/utils/pqc*.cjs` | Dilithium3 keys as a browser primitive: linked on chain, dual-signed with secp256k1, encrypted at rest |
| **Gateways** | `electron/gateways/` | discovery, health, an externalised whitelist, a Kyber key cache, endpoint resolution |
| **Extensions** | `electron/extensions/` | Chrome extension runtime, including installing from the Web Store |
| **Sites** | `electron/sites/` | a local host server so an IPFS-served site gets a real origin |
| **Background** | `electron/daemons/` | chain poller, pin cache, IPFS seed, release watcher, peer pool |
| **UI** | `src/` | Vue 3, 57 reusable `Ui*` components, 13 languages |

Roughly 41 000 lines in the main process and 57 000 in the renderer.

Each of these has its own README where the reasoning is denser than a table can
carry: [`electron/daemons`](electron/daemons/README.md),
[`electron/preloads`](electron/preloads/README.md),
[`electron/workers`](electron/workers/README.md).

---

## Architecture

```
main process (electron/)
├── ipc/            one thin handler per channel - it translates, it does not own state
├── daemons/        every background loop, under one runtime that can stop them all
├── chain/          peer pool, REST/RPC client
├── gateways/       gateway discovery, health, whitelist
├── extensions/     Chrome extension runtime
├── sites/          local origin server for IPFS-served sites
├── services/       cross-cutting pieces the IPC layer leans on
├── utils/          tx, PQC, paths
├── workers/        anything too slow for the main thread
└── preloads/       four contexts, four scripts - see below

renderer (src/)
├── internal/       the lumen:// pages, and the services behind them
├── components/     the browser shell: tabs, navbar, sidebar
├── panels/         large sub-views a page hosts
├── dialogs/        modals, including everything that moves money
├── ui/             the design system
└── stores/         profile, locale, history, favourites
```

Two rules shape most of it.

**IPC handlers stay thin.** A handler turns a channel into a call; the module it
calls owns the state. `ipc/chain.cjs` and `ipc/gateway.cjs` lost 90 and 565
lines to that rule, and gained testability for it.

**A daemon never overlaps itself, never lets a throw escape, is always
`unref`'d, and can always be stopped.** Adding a background loop is one line in
`daemons/index.cjs`.

### Trust boundaries

This is the part worth understanding before changing anything.

The app window is **not** a web page. It holds the privileged `window.lumen`
bridge, and a navigation guard keeps it that way: a site cannot be loaded into
the shell, only into a `<webview>`. Sites get a different, much smaller bridge
from a different preload, in their own partition.

Four contexts, four preloads:

| context | preload | gets |
|---|---|---|
| the app window | `preload.cjs` | the full bridge |
| every `<webview>` | `webview-preload.cjs` | the site API, plus `keplr`/`leap` shims so Cosmos dApps work without an extension |
| `chrome-extension://` pages | `extension-preload.cjs` | the extension shim |
| the Chrome Web Store | `store-preload.cjs` | one button |

`contextIsolation` is on, `webSecurity` is on, `allowRunningInsecureContent` is
off, `window.open` is intercepted, and a site's permissions are derived from the
real sender rather than from anything the caller passes in.

**The security boundary is the IPC layer, not the preload.** A clean bridge is
necessary and not sufficient. `npm run check:ipc` enforces the contract across
every channel: no handler takes a caller's identity from its own arguments, no
site-reachable handler returns a raw error message, one handler per channel, no
channel a preload calls without a handler behind it.

---

## Running it

Node 18+, npm. Electron 41, Vue 3.

```bash
npm install
npm run dev          # Vite + Electron
npm run build        # static bundle into dist/
npm run dist         # packaged installers
```

The IPFS repo lives under the Electron user data directory
(`%APPDATA%/lumen/ipfs` on Windows), never in a global `~/.ipfs`. The folder is
named after `APP_NAME` in `electron/bootstrap_paths.cjs`, and
`LUMEN_USER_DATA_DIR` overrides it for a single run - which is how the
end-to-end tests launch the app without touching your own wallet.

### Linux

If the window does not open (VMware + Wayland in particular), force X11:

```bash
./Lumen-Browser-x.x.x-linux-x64.AppImage --ozone-platform=x11
```

Add `--no-sandbox` if that is not enough.

### macOS

```bash
sudo xattr -rd com.apple.quarantine /Applications/Lumen\ Browser.app
```

---

## Tests and checks

```bash
npm test             # the checks below, then the unit suite
npm run test:e2e     # Playwright, both projects
npm run test:all     # everything
```

1 565 unit tests across 112 files, 65 end-to-end specs across 13. `npm test`
also runs six checks that exist because a reviewer cannot hold these in their
head across 100 000 lines:

| check | refuses |
|---|---|
| `check:conventions` | inline `style=""`, `<style>` blocks, dead or undefined CSS classes, raw `<svg>`, unused imports |
| `check:ipc` | a handler trusting its caller's identity, a leaked raw error, a channel with no handler |
| `check:imports` | a main-process specifier the package does not actually publish |
| `check:tests` | a shared module no test reaches |
| `check:i18n-strings` | user-visible English that skips `t()` |
| `check:wording` | two strings saying the same thing two ways |

Each was written after the bug it now blocks. `check:imports` exists because a
dependency refresh silently disarmed every signed transaction in the app for a
week: the specifier is a string, resolved when the handler runs, so nothing
failed at install, lint, typecheck or test.

---

## Translations

The interface is written in English and translated through `t()`, keyed on the
English text itself. Catalogues live in `src/locales/<code>.json`.

Thirteen languages ship: English, French, Spanish, Portuguese, German, Italian,
Russian, Arabic, Hindi, Indonesian, Chinese, Japanese, Korean. An untranslated
entry renders the English, so a language can be filled a screen at a time
without ever showing a hole. Arabic sets `dir="rtl"`.

```bash
npm run i18n:extract   # add every new t('…') to each catalogue, report orphans
```

The language is asked once at first run, pre-selected from what the OS reports,
and then belongs to the **profile**: switching profile switches language.

Adding one is four lines and a file - see
[CONTRIBUTING.md](./CONTRIBUTING.md#rule-0-user-visible-text-goes-through-t).

---

## Releases

The publisher is in the app, at `lumen://release`: it builds the record, signs
it, and submits it for DAO validation. Artifacts come from
`.github/workflows/build.yml`, which builds all three platforms despite the
name, and attaches them to a draft GitHub release.

A release record must carry a SHA-256 for its artifact. The updater refuses one
without, and takes both the URL and the digest from the record it read on chain
rather than from anything the interface hands it - see
`electron/ipc/release.cjs`.

---

## Known debt

Stated here rather than discovered later.

- **`electron/ipfs.cjs` is 3 457 lines** and holds several domains: daemon,
  client, pinning, pin jobs, IPNS, gateway discovery, drive. It wants splitting
  along those lines, mostly because it would make the parts testable.
- **`electron/preloads/webview-preload.cjs` is 3 720 lines** and cannot import
  its own helpers - a sandboxed preload that `require`s a local file stops
  loading in silence. The duplication there is deliberate; see that folder's
  README before "fixing" it.
- **`window.lumen` is large.** Namespacing has started - `pqc`, `profiles`,
  `rpc`, `site`, `find`, `wallet`, `gateway` - and the flat top level should
  keep shrinking into it.
- **Silent `catch {}` is common.** Much of it is deliberate, since Electron
  objects disappear mid-lifecycle, but the intentional ones and the ones hiding
  a real failure currently look identical.
- **Test coverage is uneven.** It is dense around what moves money and thin
  around navigation, extension permissions and webview isolation.

---

## Contributing

[CONTRIBUTING.md](./CONTRIBUTING.md) has the rules that are not obvious from the
code. The short version: run `npm test` before you push, put user-visible text
through `t()`, and keep IPC handlers thin.

MIT.
