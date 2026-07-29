# Contributing to Lumen Browser

Thanks for contributing. This project is kept intentionally consistent by a small set of
mechanically-enforced rules rather than style guidelines that rely on memory or review vigilance.
Read this before opening a PR - both rules below are checked automatically and **a PR that
violates them will be rejected**.

## Before you open a PR

```bash
npm test
```

This runs, in order: `check:conventions` (see below), `eslint`, then the unit test suite. It's
also wired as `prebuild`, so `npm run build` (and therefore `pack` / `dist` / `dist:win`) refuses
to produce a build at all if any of these fail. There is no way to "skip" this locally and still
ship a working build - fix what's reported.

## Rule 1: every TypeScript `type` / `interface` lives in `src/types/`

No inline `type Foo = ...` or `interface Foo { ... }` declaration is allowed anywhere in
`src/**/*.ts` or `src/**/*.vue` outside of `src/types/`. This is enforced by ESLint
(`no-restricted-syntax` on `TSInterfaceDeclaration`/`TSTypeAliasDeclaration` in
`eslint.config.mjs`) - `npm run lint` / `npm test` will fail with a link back to this file if you
add one.

- **One file per concept** under `src/types/`. If a type is specific to one page or component,
  name the file after it (e.g. types only used by `DrivePage.vue` go in `src/types/drivePage.ts`).
  If the same shape is genuinely shared across multiple files, give it its own descriptively-named
  file (e.g. `src/types/tab.ts` for the tab-bar `Tab`/`TabHistoryEntry` shape used by four
  different components).
- Import with `import type { Foo } from '../types/foo'` (adjust the relative path to your file's
  location). Never re-declare a shape that already exists in `src/types/` - import it.
- Before creating a new file, check whether an existing `src/types/*.ts` file already covers the
  same concept (e.g. a new field on settings belongs in the existing `src/types/settings.ts`, not
  a new file) - extend it there instead of splintering a concept across two files.
- Two types with the *same name* but genuinely different shapes in different files are not the
  same concept - keep them separate, don't force a merge just because the names collide.

**Why this exists**: colocating types with implementation is how the same shape quietly drifts
into several slightly-different copies over time - this happened for real in this codebase (a
`DriveFile` interface existed identically in three separate files before anyone noticed). A single
rule with no case-by-case judgment call ("is this type shared enough to deserve centralizing?")
is easier for a project with many different contributors to follow consistently than a rule that
depends on everyone calibrating that judgment the same way.

## Rule 2: all CSS lives in `src/css/`

- **No `<style>` blocks in `.vue` single-file components**, and **no literal `style="..."`
  attribute** in any template. The only accepted exception is a JS-computed `:style="..."`
  binding for a genuinely per-instance value that cannot be expressed as a static class (e.g. a
  computed avatar hue color) - a literal `style=""` is never acceptable. Any other exception
  (e.g. a third-party embed that hard-requires inline styling) must be justified explicitly in the
  PR description; these should be very rare.
- **Reuse an existing generic/utility class before adding a new one.** Check `src/css/scale.css`
  for the padding/margin/gap/border-radius/text-size scale (axis-composable: `p-`, `px-`, `py-`,
  `pt-`/`pr-`/`pb-`/`pl-`, same for `m-`/`gap-`), and `src/css/ui/*.css` for shared
  component-level classes (badge, toast, modal, card, toggle, input, etc). If nothing existing
  covers what you need, add a new class following the same convention (one file per concept in
  `src/css/ui/`, values snapped to the existing `scale.css` scale rather than a new one-off pixel
  value).
- **Opacity/tint colors use the two-digit `-aNN` suffix** (hundredths - e.g. `bg-primary-a10` is
  10% alpha). Do not introduce the older single-digit `-aN` form.
- **Animations**: `@keyframes` declarations belong in `src/css/animation.css` only, not inlined
  next to a component's other styling.
- **Responsive / media queries**: there is no `@media` usage in the app's own CSS today (this is
  a fixed-size desktop app), so there's no existing file for it yet. If a breakpoint genuinely
  becomes necessary, put it in a new `src/css/responsive.css` (imported after `layout.css` in
  `src/css/index.css`) rather than inlining it wherever it's first needed.
- **Repeated markup**: if the same tag with the same ~4-or-more utility classes shows up 4+ times
  in one file, that's usually a signal to extract a `src/ui/UiXxx.vue` generic component instead
  of copy-pasting the markup. `npm run check:conventions` flags this as a non-blocking warning -
  use judgment (a few are coincidental resemblance, not real duplication), but don't ignore an
  obvious one.
- **Vendored/third-party CSS** (currently only `public/lib/bibi/`) is exempt from all of the
  above - it's foreign code, don't rewrite it to match project conventions.

All of this (plus a few more mechanical checks: no duplicate/dead/undefined CSS classes, no raw
hand-drawn `<svg>` - check `lucide-vue-next` for an existing icon first, no empty `class=""`, no
two classes on one element silently fighting over the same CSS property, no unused imports or
top-level declarations) is enforced by `scripts/check-conventions.mjs`
(`npm run check:conventions`, part of `npm test`). Read the comments at the top of each check in
that script for the exact reasoning and known-safe exceptions.
