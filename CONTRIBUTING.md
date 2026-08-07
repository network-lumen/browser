# Contributing to Lumen Browser

Thanks for contributing. This project is kept intentionally consistent by a small set of
mechanically-enforced rules rather than style guidelines that rely on memory or review vigilance.
Read this before opening a PR - everything below is checked automatically and **a PR that violates
it will be rejected**.

## Before you open a PR

```bash
npm test
```

This runs, in order: `check:conventions`, `eslint`, `vue-tsc --noEmit`, then the unit tests. It is
also wired as `prebuild`, so `npm run build` (and therefore `pack` / `dist` / `dist:win`) refuses
to produce a build at all if any of these fail. There is no way to "skip" this locally and still
ship a working build - fix what's reported.

---

# Part 1 — How `src/` is laid out

Roughly 43 000 lines across 260 files. The folders are not decoration: **which folder a file lives
in decides what it is allowed to import.** Before adding a file, find its layer here.

```
src/
├── ui/           (56)  Primitives. Know nothing about Lumen.        → types only
├── entities/      (7)  One domain value, drawn canonically.         → ui, services, types
├── forms/         (5)  Reusable groups of form fields.              → ui, types
├── dialogs/      (45)  Modals. One file per modal.                  → ui, forms, services, types
├── views/         (2)  A sub-view of a page, extracted.             → ui, entities, services
├── layouts/       (3)  Tab bar, tab pane, nav bar.                  → ui, services, components
├── components/   (12)  App shell pieces that are none of the above. → anything below pages
├── composables/   (5)  Injection + shared reactive access.          → types, stores
├── stores/        (1)  Global reactive state (toasts).              → types
├── types/        (50)  Every type and interface. See Rule 1.        → nothing
├── css/          (14)  Every stylesheet. See Rule 2.
└── internal/     (71)
    ├── pages/    (24)  One per lumen:// route. 27 700 lines - the bulk.
    ├── services/ (34)  Domain logic with no view state.            → types, composables
    ├── common/    (4)  Startup checks, the bridge surface.
    └── *.ts       (8)  Stores + routing (see "known wrinkles").
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

### The exceptions that exist today, and why

Four files import upward. Each is deliberate; do not add a fifth without saying why in the PR.

| File | Imports | Why |
|---|---|---|
| `ui/UiToast.vue` | `stores/toastStore` | It *is* the toast renderer. Something has to read the queue. |
| `ui/UiCopyField.vue` | `composables/useClipboard` | A copy button that cannot copy is not a copy button. |
| `types/lumenBridge.ts` | `internal/common/lumenBridgeSurface` | Derives the bridge type from the one inventory the startup check also uses. That module is a **leaf** on purpose - making it import anything would create a cycle. |
| `internal/services/releaseUpdates.ts` | `stores/toastStore` | Notifies about a background download. Borderline; a service that needs to *tell the user something* is usually a service returning a result instead. |

## What goes where — the questions to ask

**Is it a primitive?** Would it make sense in another app entirely, with no Lumen concepts in it?
→ `src/ui/`. It gets a `Ui` prefix and imports only types.

**Is it one value from the domain, drawn?** A transaction hash, a block height, an address, a
status. → `src/entities/`. **Check first whether it already exists**: `TxHashLink`, `TxStatusPill`,
`TxTypeBadge`, `BlockHeightLink`, `AddressLabel`, `DriveEntryThumbnail`, `DriveFileRow`. These
exist because the same value used to be drawn three to six different ways depending on the page. If
you are about to write a `<code>` for a hash or slice an address by hand, stop and use the entity.

**Is it a modal?** → `src/dialogs/`, one file per modal. Build it on `UiDialog`, which already gives
you the footer, the busy state, the error banner and dismiss-blocking while busy.

**Is it logic with no view state?** Formatting, parsing, a decision, a cache, a fetch.
→ `src/internal/services/`. This is the default answer for anything that is not markup.

**Is it view state?** Refs the template binds to, loading flags, which row is expanded. → it stays
in the component. A "service" that only receives the page's refs is not a service.

### Where the line falls

The service owns the **algorithm and the decision** - constants, thresholds, priority order. The
component owns **what it shows and when**. Two worked examples:

- `readDriveBackupSnapshot()` validates and normalises a backup, and **returns**. It does not write
  to storage or touch the view: the caller decides what to do with the result. That split is what
  makes the format testable.
- `fetchIbcTransferChannels()` asks the chain and returns the channels, or throws. `loading`,
  `loaded` and the error string stay in the page, because they are the page's.

A service that needs refs passed into it is a sign the boundary is in the wrong place.

## Known wrinkles

Not traps, but they will surprise you:

- **`internal/*.ts` is a mixed bag.** `favouritesStore`, `historyStore` and `profilesStore` live
  there while `toastStore` lives in `src/stores/`. `routes.ts` and `navigationUrl.ts` are routing.
  `useTabLoading.ts` is a composable. Historical, not designed. Put *new* files in the folder that
  matches what they are.
- **Two "favourites" systems** share the word. `favouritesStore.ts` is browser shortcuts in
  localStorage; `profilesStore.getFavourites` is a domain→CID map in the main process. They are
  unrelated.
- **`tabPosition.ts` and `tabHistory.ts` are split for a reason.** Reading where a tab is needs
  nothing; *moving* a tab reads page titles from the route table, which imports every page, one of
  which calls the Electron bridge as its module loads. Import `tabHistory` from a test and it
  throws before the test runs. Keep the read side dependency-free.
- **`window.lumen` means two different objects.** The renderer's (via `useInternalLumen()`) is the
  full trusted bridge. The one inside a `<webview>` is a restricted, site-facing API in a different
  JS realm. They share a name by accident.

---

# Part 2 — The rules

## Rule 1: every TypeScript `type` / `interface` lives in `src/types/`

No inline `type Foo = ...` or `interface Foo { ... }` declaration is allowed anywhere in
`src/**/*.ts` or `src/**/*.vue` outside of `src/types/`. Enforced by ESLint
(`no-restricted-syntax` on `TSInterfaceDeclaration`/`TSTypeAliasDeclaration`).

- **One file per concept.** A type specific to one page is named after it
  (`src/types/drivePage.ts`). A shape genuinely shared gets its own descriptive file
  (`src/types/tab.ts`).
- Import with `import type { Foo } from '../types/foo'`. Never re-declare a shape that exists -
  import it.
- Before creating a file, check whether one already covers the concept. A new settings field
  belongs in the existing `src/types/settings.ts`.
- Two types with the *same name* but different shapes are not the same concept. `Variant` in
  `uiButton.ts` (`'ghost' | 'primary' | …`) and `Variant` in `uiDetailRow.ts`
  (`'grid' | 'flex' | …`) share no value. Merging them would force a rename and imply a kinship
  that isn't there. Same for `Size`: a shared union would have to be the superset of both, and
  `<UiToggle size="lg">` would silently stop being a compile error.

### What this rule does *not* cover: anonymous unions inside props

An inline literal union written directly in `defineProps<{ ... }>()` is **fine and stays**:

```ts
defineProps<{
  variant?: 'neutral' | 'warning' | 'info' | 'error' | 'success';
}>();
```

It declares no named type, so there is nothing to drift - one copy, next to the prop it describes.

Give it a name in `src/types/` as soon as it is referenced **anywhere other than that one prop**:
when it backs a lookup map (`Record<Size, string>`), when another file imports it, or when it
drives state rather than styling (`OnboardingStep` is the onboarding modal's state machine).

**Why**: colocating types is how one shape quietly becomes several slightly different copies. It
happened here - a `DriveFile` interface existed identically in three files before anyone noticed.

## Rule 2: all CSS lives in `src/css/`

- **No `<style>` blocks in `.vue` files**, and **no literal `style="..."` attribute**. The only
  accepted exception is a computed `:style="..."` binding for a genuinely per-instance value (an
  avatar hue). A literal `style=""` is never acceptable.
- **Reuse before adding.** `src/css/scale.css` has the padding/margin/gap/radius/text scale
  (axis-composable: `p-`, `px-`, `py-`, `pt-`/`pr-`/`pb-`/`pl-`, same for `m-`/`gap-`).
  `src/css/ui/*.css` has shared component classes. If nothing covers it, follow the same
  convention - one file per concept, values snapped to the existing scale rather than a new
  one-off pixel value.
- **Opacity uses the two-digit `-aNN` suffix** (hundredths: `bg-primary-a10` is 10%). Never the
  older single-digit form.
- **`@keyframes` live in `src/css/animation.css`** only.
- **No `@media` today** - this is a fixed-size desktop app. If a breakpoint becomes necessary, it
  goes in a new `src/css/responsive.css`, imported after `layout.css`.
- **Vendored CSS** (`public/lib/bibi/`) is exempt from everything above. It is foreign code.

### Consistency beats design

When two near-identical values diverge for no reason - a `gap-6px` next to a `gap-8px`, two alphas
one hundredth apart - **snap them to one canonical value**. Do not preserve a difference nobody
chose. The design adapts afterwards; the inconsistency does not get to stay because it is already
there.

## Rule 3: a component is never handed a function

Enforced as `no-function-prop` in `check:conventions`. A component that receives a function
receives its own presentation - how to format its values, what to call its things - so it cannot be
read on its own, and two callers agree only because the same parent happens to feed both.

Sixteen of these had accumulated across the Drive dialogs alone: format a size, a date, a price,
name a plan, colour its badge.

The two honest alternatives:

- **A module both sides import**, when the logic is real. Usually `src/internal/services/`.
- **An `emit`**, when the parent is being asked to *do* something.

Genuine exceptions are listed by name in an allowlist inside the rule, each with its reason. Today
there is one: `CloudPlansDialog.statusOf`, because whether a plan is subscribed comes from
subscriptions only the page holds.

## Rule 4: say one thing one way

Not mechanically checkable, but it is what most of the other rules are protecting.

- **A value from the domain has one rendering.** Use `src/entities/`. A transaction hash was drawn
  three ways, a block height three (with three *different values* - `Block 12345`, `12,345`,
  `12345`), a transaction status six.
- **A message the user reads has one wording.** `copyToClipboardWithToast(text)` takes no label on
  purpose: nine call sites had written their own pair, which is nine ways of saying one of two
  things to someone who just clicked a copy button.
- **A format written and read has one definition.** The Drive backup format was normalised
  separately on export and import, with the same caps written twice. Raising one and forgetting the
  other would have silently dropped files at restore.
- **Navigation goes through `useTabNavigation().open(url, { blank, push })`**, not `navigate` or
  `openInNewTab` directly. Five components had written their own fallback and they disagreed.

## The rest of `check:conventions`

Sixteen rules, all blocking except #9. Each was written after a real bug; the script explains
which, at the top of each check. Read it there rather than guessing.

| # | Rule |
|---|---|
| 1 | No literal `style=""` |
| 2 | No `<style>` in a `.vue` |
| 3 | No duplicate CSS selector |
| 4 | No dead CSS class |
| 5 | No HTML class with neither a CSS rule nor a JS selector |
| 6 | No hand-drawn `<svg>` — check `lucide-vue-next` first |
| 7 | No empty `class=""` |
| 8 | No two classes on one element fighting over the same property |
| 9 | *(warning)* Repeated markup that might want a `src/ui/` component |
| 10 | No unused import |
| 11 | No unused top-level declaration |
| 12 | No blank line inside a tag's attribute list |
| 13 | No literal `v-if="true"` / `v-if="false"` |
| 14 | No class repeated twice in one attribute |
| 15 | No dead CSS custom property |
| 16 | No function-typed prop (Rule 3 above) |

**Known blind spots** — rules 4 and 5 compare tokens in the places a class can actually be applied
(`*class` attributes, string literals). They do not see a class passed inside an object
(`:handlers="{ … }"`) or through a slot. If you apply a class that way, the checker cannot help
you.

## Testing what you add

Unit tests live in `tests/unit/`, run by vitest. **There is no Vue plugin in the test config**: a
module that transitively imports a `.vue` file cannot be tested, and one page calls the Electron
bridge as it loads, so importing it throws before your test runs. In practice this means a service
is testable exactly when it is properly separated - which is the point.

Worth a test: a rule with an order or a threshold (which IBC channel a transfer leaves through, two
decimals below ten LMN and none at ten), a format that is both written and read, anything that
could be wrong without failing loudly.

Not worth one: a pass-through, a wrapper carrying a constant, markup.
