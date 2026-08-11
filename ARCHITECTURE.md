# Lumen Browser — architecture of `src/`

This is the *why*. For the rules you have to follow to get a PR merged, see
[CONTRIBUTING.md](./CONTRIBUTING.md) - it is short on purpose and points back here.

Most of what follows is scar tissue. Where a section explains an odd-looking decision, the
explanation is the bug that caused it. That is deliberate: a rule whose reason has been lost gets
"cleaned up" by the next person, and the bug comes back.

---

## The layout

```
src/
├── ui/           (56)  Primitives. Know nothing about Lumen.        → types only
├── entities/      (7)  One domain value, drawn canonically.         → ui, services, types
├── forms/         (5)  Reusable groups of form fields.              → ui, types
├── dialogs/      (45)  Modals. One file per modal.                  → ui, forms, services, types
├── views/         (2)  A sub-view of a page, extracted.             → ui, entities, services
├── layouts/       (3)  Tab bar, tab pane, nav bar.                  → ui, services, components
├── components/   (12)  App shell pieces that are none of the above. → anything below pages
├── composables/   (5)  Injection, and shared reactive state.        → types, stores
├── stores/        (1)  Global reactive state (toasts).              → types
├── types/        (50)  Every type and interface.                    → nothing
├── css/          (14)  Every stylesheet.
└── internal/     (71)
    ├── pages/    (24)  One per lumen:// route. 27 700 lines - the bulk.
    ├── services/ (34)  Domain logic with no view state.            → types, composables
    ├── common/    (4)  Startup checks, the bridge surface.
    └── *.ts       (8)  Stores + routing (see "wrinkles").
```

## The dependency rule

**Imports point downward.** A layer may import from layers below it, never above.

```
        internal/pages
              ↓
  dialogs · views · layouts · components
              ↓
       entities · forms
              ↓
              ui
              ↓
            types
```

Sideways is allowed within a layer. `internal/services` sits beside this stack and may be imported
by anything, but may itself import only `types` and `composables`.

**A page may not be imported by anything except the route table.** If a dialog needs something from
a page, that something is in the wrong file - move it to `internal/services/`.

### The four exceptions that exist today

Do not add a fifth without saying why in the PR.

| File | Imports | Why |
|---|---|---|
| `ui/UiToast.vue` | `stores/toastStore` | It *is* the toast renderer. Something has to read the queue. |
| `ui/UiCopyField.vue` | `composables/useClipboard` | A copy button that cannot copy is not a copy button. |
| `types/lumenBridge.ts` | `internal/common/lumenBridgeSurface` | Derives the bridge type from the one inventory the startup check also uses. That module is a **leaf** on purpose - making it import anything creates a cycle. |
| `internal/services/releaseUpdates.ts` | `stores/toastStore` | Notifies about a background download. Borderline: a service that needs to *tell the user something* is usually a service returning a result instead. |

---

## Where a new file goes

**Is it a primitive?** Would it make sense in another app entirely, with no Lumen concepts in it?
→ `src/ui/`. It gets a `Ui` prefix and imports only types.

**Is it one value from the domain, drawn?** → `src/entities/`. **Check first whether it exists**:
`TxHashLink`, `TxStatusPill`, `TxTypeBadge`, `BlockHeightLink`, `AddressLabel`,
`DriveEntryThumbnail`, `DriveFileRow`.

> These exist because the same value used to be drawn three to six different ways depending on the
> page. A block height was `Block 12345` on one page, `12,345` on another and `12345` on a third -
> not three stylings, three different *values* for the same number. If you are about to write a
> `<code>` for a hash or slice an address by hand, stop and use the entity.

**Is it a modal?** → `src/dialogs/`, one file per modal, built on `UiDialog` (which already gives
you the footer, the busy state, the error banner and dismiss-blocking while busy).

**Is it logic with no view state?** → `src/internal/services/`. This is the default answer for
anything that is not markup.

**Is it view state?** Refs the template binds to, loading flags, which row is expanded → it stays in
the component.

### Where the line falls between a service and a component

The service owns the **algorithm and the decision** - constants, thresholds, priority order. The
component owns **what it shows and when**.

- `readDriveBackupSnapshot()` validates and normalises a backup, and **returns**. It does not write
  to storage or touch the view: the caller decides what to do with the result.
- `fetchIbcTransferChannels()` asks the chain and returns the channels, or throws. `loading`,
  `loaded` and the error string stay in the page, because they are the page's.

**A service that needs refs passed into it is a sign the boundary is in the wrong place.** The one
legitimate exception is a *composable*, which owns its own refs - `usePinJob()` holds the state of
a pin job because two hosts each held an identical copy of it.

---

## The wrinkles

Not traps, but they will surprise you.

**`internal/*.ts` is a mixed bag.** `favouritesStore`, `historyStore` and `profilesStore` live there
while `toastStore` lives in `src/stores/`. `routes.ts` and `navigationUrl.ts` are routing.
`useTabLoading.ts` is a composable. Historical, not designed. Put *new* files in the folder that
matches what they are.

**Two "favourites" systems** share the word. `favouritesStore.ts` is browser shortcuts in
localStorage; `profilesStore.getFavourites` is a domain→CID map in the main process. Unrelated.

**`tabPosition.ts` and `tabHistory.ts` are split for a reason.** Reading where a tab is needs
nothing. *Moving* a tab reads page titles from the route table, which imports every page, one of
which calls the Electron bridge as its module loads. Import `tabHistory` from a test and it throws
before the test runs. Keep the read side dependency-free.

**`window.lumen` means two different objects.** The renderer's (via `useInternalLumen()`) is the
full trusted bridge. The one inside a `<webview>` is a restricted, site-facing API in a different
JS realm. They share a name by accident.

**A sandboxed preload cannot `require()` a local file.** Every `<webview>` runs with `sandbox=yes`.
An earlier pass extracted ~46 helpers from `electron/preloads/webview-preload.cjs` into a module for
readability, and the preload silently stopped loading entirely. That file is deliberately one large
self-contained file. Do not "tidy" it.

---

## Why the rules exist

Each rule in CONTRIBUTING.md is here because something went wrong.

**Types in `src/types/` only.** A `DriveFile` interface existed identically in three separate files
before anyone noticed. Colocating types is how one shape quietly becomes several slightly different
copies.

**CSS in `src/css/` only, reuse before adding.** Two classes on one element silently fighting over
the same property; a `var(--primary-a06)` referenced but never defined, so the rule using it did
nothing at all; a `type-image` class applied for months with no CSS rule anywhere in the repo.

**Consistency beats design.** When two near-identical values diverge for no reason, snap them.
Nobody chose the difference; it accumulated. The design adapts afterwards.

**No function-typed props.** Sixteen of these accumulated across the Drive dialogs alone - format a
size, a date, a price, name a plan, colour its badge. A component that receives its own
presentation cannot be read on its own, and two callers agree only because the same parent happens
to feed both.

**Say one thing one way.** A transaction hash was drawn three ways, a status six. Nine call sites
each wrote their own "copied to clipboard" wording. The Drive backup format was normalised
separately on export and import, with the same caps written twice - raising one and forgetting the
other would have silently dropped files at restore.

**Navigation goes through `useTabNavigation().open()`.** Five components had written their own
`goto`/`openInNewTabSafe` and they disagreed: one had no fallback at all, one turned a blank URL
into the new tab page, one forwarded the caller's push option and the rest hard-coded it.

**Comments are English, and are not code.** 0 explications needed

---

## Testing, and what it cannot reach

**Unit tests** (`tests/unit/`, vitest) have **no Vue plugin**: a module that transitively imports a
`.vue` file cannot be tested. One page calls the Electron bridge as it loads, so importing it
throws before the test runs. In practice a service is testable exactly when it is properly
separated - which is the point.

**Every shared module must be reached by a test**, enforced by `npm run check:tests` over
`internal/services/`, `stores/` and `composables/`. Reachability, not a coverage percentage: a
percentage needs a threshold and a threshold is a number people negotiate down, whereas a module no
test imports is simply one nobody has ever run outside the app. The pass that added this wrote tests
for eighteen such modules and found a real defect in six - so the rule is not bookkeeping.

> The worst of the six: `checkIpfsStatus`, the gate in front of every Drive upload, was wrong in
> both directions at once. It returned the raw `{ok: false}` reply as a boolean, and an object is
> truthy, so `if (!await checkIpfsStatus())` never fired once - uploads against a dead daemon went
> ahead to fail later on whatever the add itself threw. And it read the bridge into a module-level
> `const` at import, so loading it before the preload attached refused *every* upload for the rest
> of the session. Neither showed up in a green run, because nothing ran it.

A module that genuinely cannot be reached goes in `UNREACHABLE` in `scripts/check-tests.mjs` **with
the structural reason** - "hard to mock" is not one. The check also fails on an exemption that is no
longer needed, so the list cannot quietly become a backlog.

**A main-process module can be tested too.** `tests/unit/support/electronStub.ts` plants a fake
`electron` in the CommonJS module cache before the module under test loads, with a fresh temporary
`userData` per call. That way the module runs exactly as it ships, instead of production code
growing an injectable filesystem root for the tests' benefit.

**End-to-end tests** (`tests/e2e/`, Playwright) run the renderer in a browser with a **mock bridge**
generated from `src/internal/common/lumenBridgeSurface.ts` - the same inventory the startup check
uses, so it cannot drift.

> The first thing these found: `internal/common/upload.ts` subscribed to a bridge event as its
> module loaded, unguarded. With no bridge that threw before Vue mounted anything, so the renderer
> died with a blank page - taking `App.vue`'s own "Lumen API not found" screen with it, the screen
> whose entire job is to say the bridge is missing.

**They deliberately stop** at anything past a confirmation that talks to the chain. The mock would
have to invent response shapes and the test would then pass because the fake agrees with itself.
That is worse than no test: it reads like coverage and proves nothing. Those flows are in the
release checklist instead.

### The main process

`npm run check:ipc` holds all 211 IPC channels to one contract, instead of a unit test per handler -
a third of them are four-line pass-throughs where a test would exercise the mock, and a per-handler
test would have caught none of the four missing sender guards found by hand.

Six rules, each written after something real:

1. **Never take a site's identity from its arguments.** Permissions are stored per site key, so a
   handler reading `input.siteKey` without checking its sender lets any caller act as any site.
   Deliberately *not* "every site-reachable channel must guard its sender": most of the 36 are the
   site-facing API on purpose, and a check that cries wolf gets switched off.
2. **An async `ipcMain.on` must catch.** `handle` rejects the caller's promise; `on` has no caller,
   so a throw there is an unhandled rejection in main that the renderer never hears about.
3. **One handler per channel.** Electron reports nothing when two register.
4. **No channel called by a preload without a handler**, which catches a rename that touched one side.
5. **The two chrome shims must offer the same namespaces.** `webview-preload` serves content scripts,
   `extension-preload` serves extension pages, and both expose the same fourteen. A namespace added
   to one and forgotten in the other is invisible until an extension calls it in the context nobody
   tested.
6. **No raw error message back to a site.** Six wallet channels - the Keplr/Leap shim - returned
   `String(e.message)` to whatever page was open. The realistic failure there names a file, and an
   `ENOENT` on `keystore.json` spells out the OS username and the profile layout. Return a code, log
   the detail. The script holds an allowlist of the channels where the message was reviewed and kept.

> The pass that added rule 6 also found a bug in the checker itself: an apostrophe in a prose comment
> (`this site's own cached JSON`) read as the start of a string literal, so the scan measuring one
> handler swallowed the four that followed and reported a violation in the wrong one. Comments are
> skipped now. This is the third time a hand-written scanner in this repo has been fooled by an
> apostrophe - if you write a fourth, strip comments first.

**ESLint covers `electron/` too**, with `no-undef` as the reason it exists. Until it did, the half of
the app that holds the keys was checked by nothing at all - and the pass that added it had, two
commits earlier, deleted a function and left three calls to it. That is a `ReferenceError` on
`extensions:disable` in a file no test opens. Its first clean run also found `path.resolve` used
without requiring `path` (every directory upload with progress threw), and a `catch` that logged an
identifier that never existed - the `catch` reporting that the webview preload failed to register,
so the one failure that leaves every site without `window.lumen` printed nothing at all.

Three modules have real unit tests, chosen because they can be wrong without failing loudly:
`gateway-auth` (who the local gateway lets in), `utils/crypto` (what stands between a stolen profile
folder and a stolen wallet), `network/peer_pool` (which node a signed transaction goes to). The
first found an auth bypass on its first run.

### Where an error ends up

Two log files, both under Electron's `logs` directory beside `userData`:

- **`electron-main.log`** — everything, including a proxy over `console.*` in the main process. Trimmed
  at 8 MB down to 2 MB.
- **`errors.log`** — only `[ERROR]`, from both processes. Trimmed at 1 MB, small enough to paste into a
  bug report. It exists because the one crash worth reading used to be somewhere inside 8 MB of IPFS
  status polls and gateway probes.

The main process has had a net for a long time — `main_logger.cjs` listens for `unhandledRejection` and
`uncaughtExceptionMonitor` (the *monitor* variant, so it records without swallowing a crash it has no
business surviving). **The renderer had nothing**, and half the app runs there: an error thrown outside
a `try` went to a devtools console nobody opens and left no trace on disk.
`internal/services/errorReporting.ts` now installs `error` and `unhandledrejection` listeners as the
first statement in `main.ts`, before anything that can throw.

> This does not replace a single `catch`. The 399 silent `catch {}` blocks in `electron/` — mostly in
> the two preloads — are decisions about a *value*: the page is navigating, the element is gone, the
> bridge is torn down, so absence is normal. By the time a global handler runs the call has already
> unwound and there is nothing left to return. The net is only for what would otherwise be lost.

The reporter throttles: one identical error per 10-second window, 20 reports in total. A render loop
throwing on every frame would otherwise turn one bug into an unbounded write to the user's disk. For
the same reason `app:reportRendererError` is guarded with `ensureUiSender` **and** left out of
`webview-preload` entirely — a channel that appends to a file must not be reachable from a page.

### What has no tests at all

Worth knowing before you assume a green run means much:

- **Most of the main process.** `ipc/wallet.cjs`, `ipc/gateway.cjs`, `extensions/manager.cjs` -
  roughly 10 600 lines that hold the keys and talk to the chain. The contract check covers their IPC
  surface; the logic behind it is covered nowhere.
- **Error paths.** Every mock answers yes. Node down, chain unreachable, wrong password, disk full:
  no coverage.
- **Anything that writes.** The tests read. Saving a file, restoring a backup, changing a setting,
  installing an extension - a broken write path would go unnoticed.

## Third-party code copied into the repo

Two places hold code this project did not write. They are different kinds of thing, and only one
of them is a liability.

- **`public/lib/bibi/`** - the Bibi EPUB reader, 23 files and ~2,3 MB, loaded by `IpfsPage.vue`.
  Copied rather than installed, so it appears in no `package.json` and **no dependency tool sees
  it**: `npm audit` will never mention it, and a published vulnerability arrives through nobody.
  Its provenance, licence and the reason its version is unknown are in
  [`public/lib/bibi/VENDOR.md`](public/lib/bibi/VENDOR.md). Read that before updating it.
- **`src/css/lib/github-markdown.css`** - not a copy. 2,4 KB of theming laid over the real
  `github-markdown-css` package, which is a normal dependency and is imported by `IpfsPage.vue`.
  Nothing to track here.
