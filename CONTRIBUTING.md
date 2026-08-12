# Contributing to Lumen Browser

This project is kept consistent by rules a machine checks, not by review vigilance. Everything
below is enforced automatically and **a PR that violates it will be rejected**.

Every rule here exists because something went wrong once. If you want the story behind one, it is
in [ARCHITECTURE.md](./ARCHITECTURE.md) - read that before your first PR, and whenever a rule looks
arbitrary.

## Before you open a PR

```bash
npm test          # conventions, IPC contract, test reachability, locale catalogues, eslint (src + electron), vue-tsc, unit tests
npm run test:e2e  # Playwright, needs `npx playwright install chromium` once
```

`npm test` is also wired as `prebuild`, so `npm run build` (and `pack` / `dist` / `dist:win`)
refuses to produce a build if anything fails. There is no way to skip it locally and still ship a
working build.

## Where does my file go?

The folder a file lives in decides what it may import. The full map, the dependency direction and
the questions to ask are in [ARCHITECTURE.md](./ARCHITECTURE.md#the-layout). The short version:

| I am writing… | It goes in |
|---|---|
| A primitive that knows nothing about Lumen | `src/ui/` |
| One domain value, drawn (hash, address, status) | `src/entities/` — **check it does not already exist** |
| A modal | `src/dialogs/`, built on `UiDialog` |
| Logic with no view state | `src/internal/services/` |
| Reactive state shared by two components | `src/composables/` |
| A type or interface | `src/types/` — always |
| A stylesheet | `src/css/` — always |

## Rule 0: user-visible text goes through `t()`

`{{ t('Save') }}`, `:title="t('Back')"`. The key **is** the English text — do not invent an id, and
do not build a key by interpolation (`t(\`Delete ${n}\`)` cannot be looked up; write
`t('Delete {n}', { n })`). Placeholder examples that are not English (`lmn1…`, a URL) stay plain.

```bash
npm run i18n:extract   # refresh src/locales/*.json from the source
npm run check:i18n     # same, read-only - wired into `npm test`
```

Roughly 2 000 strings are still untranslated, mostly in `src/internal/pages/`. Migrating a screen is
mechanical and can be done a screen at a time.

---

## Rule 1: every `type` / `interface` lives in `src/types/`

Enforced by ESLint. No inline declaration anywhere in `src/**/*.ts` or `src/**/*.vue` outside
`src/types/`.

- **One file per concept.** A type specific to one page is named after it (`src/types/drivePage.ts`).
  A genuinely shared shape gets its own descriptive file (`src/types/tab.ts`).
- Import with `import type { Foo } from '../types/foo'`. Never re-declare a shape that exists.
- Check whether a file already covers the concept before creating one. A new settings field belongs
  in the existing `src/types/settings.ts`.
- **Same name ≠ same concept.** `GatewayView` exists in both `drivePage.ts` and `searchPage.ts`, and
  `Block` in both `explorerPage.ts` and `networkPage.ts`. Merging either pair would force a rename
  and imply a kinship that isn't there. The union of two unions is the danger: it is the superset of
  both, so a value that should not compile for one of them silently does.

**Not covered: anonymous unions in props.** An inline union in `defineProps<{ … }>()` stays where it
is - it declares no named type, so there is nothing to drift. Give it a name in `src/types/` as
soon as it is referenced anywhere else: when it backs a `Record` map, when another file imports it,
or when it drives state rather than styling.

## Rule 2: all CSS lives in `src/css/`

- **No `<style>` blocks in `.vue` files**, and **no literal `style="…"`**. A computed `:style="…"`
  for a genuinely per-instance value (an avatar hue) is the only exception.
- **Reuse before adding.** `src/css/scale.css` holds the spacing/radius/text scale (axis-composable:
  `p-`, `px-`, `py-`, `pt-`/`pr-`/`pb-`/`pl-`, same for `m-`/`gap-`). `src/css/ui/*.css` holds
  shared component classes. If nothing covers it, follow the same convention and snap values to the
  existing scale rather than inventing a one-off pixel value.
- **Opacity uses the two-digit `-aNN` suffix** (`bg-primary-a10` is 10%). Never the single-digit form.
- **`@keyframes` live in `src/css/animation.css`.**
- **No `@media` today** - fixed-size desktop app. A real breakpoint goes in a new
  `src/css/responsive.css`, imported after `layout.css`.
- **Vendored CSS** (`public/lib/bibi/`) is exempt from all of it. Foreign code.

## Rule 3: a component is never handed a function

Enforced as `no-function-prop`. A component that receives a function receives its own presentation,
so it cannot be read on its own. Two alternatives:

- **A module both sides import** — usually `src/internal/services/`.
- **An `emit`** — when the parent is being asked to *do* something.

Genuine exceptions are listed by name in an allowlist inside the rule, each with its reason.

## Rule 4: say one thing one way

Not mechanically checkable, and the one most of the others protect.

- A **domain value** has one rendering → `src/entities/`.
- A **message the user reads** has one wording. `copyToClipboardWithToast(text)` takes no label on
  purpose.
- A **format written and read** has one definition, shared by both directions.
- **Navigation** goes through `useTabNavigation().open(url, { blank, push })`.

## Rule 5: consistency beats design

When two near-identical values diverge for no reason - a `gap-6px` beside a `gap-8px`, two alphas
one hundredth apart - **snap them to one canonical value**. Do not preserve a difference nobody
chose. The design adapts afterwards.

---

## The convention checker

`npm run check:conventions` — sixteen rules, all blocking except #9. Each explains its reasoning at
the top of its own check in `scripts/check-conventions.mjs`. Read it there rather than guessing.

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
| 16 | No function-typed prop |

**Known blind spots.** Rules 4 and 5 compare tokens where a class can actually be applied (`*class`
attributes, string literals). They do not see a class passed inside an object (`:handlers="{ … }"`)
or through a slot.

## Writing tests

**Worth a test**: a rule with an order or a threshold, a format that is both written and read,
anything that could be wrong without failing loudly.

**Not worth one**: a pass-through, a wrapper carrying a constant, markup.

**End-to-end**: `tests/e2e/` runs the renderer with a mock bridge. Stub a call by passing its path
to `openApp` — overrides are **source strings**, because they are serialised into the page:

```ts
await openApp({
  'wallet.getBalance': `() => Promise.resolve({ ok: true, balance: { amount: '5000000' } })`,
});
```

What the tests can and cannot reach, and what has no coverage at all, is in
[ARCHITECTURE.md](./ARCHITECTURE.md#testing-and-what-it-cannot-reach). Read it before assuming a
green run means much.

---

## Release checklist

Run these against a real build (`npm run pack`) before shipping. Each is a flow the automated tests
deliberately stop short of, and none of them is optional.

- [ ] **Send tokens** end to end on a testnet, and confirm the amount that arrives.
- [ ] **Approve a signature from a site** — the Keplr/Leap shim must show the approval modal, and
      **rejecting must actually stop the signature**.
- [ ] **Save to Drive** from a site and from the IPFS viewer: pause, resume, cancel a pin job.
- [ ] **Restore a Drive backup** exported by a previous version.
- [ ] **Lock and unlock** the session; confirm the shortest timeout offered is 15 minutes.
- [ ] **Install an extension**, and confirm an injected wallet still works on an IPFS site.
- [ ] **First run with no profile**: onboarding must appear and must not be skippable.
