// Enforces a handful of project conventions that aren't caught by the
// TypeScript/Vue compiler. Run via `npm run check:conventions` (wired into
// `npm test`). Each check below is self-contained and prints every
// violation it finds before the script exits non-zero, so a red run always
// tells you exactly what to fix.
//
// Project rule #1 (explicit, long-standing): never use a literal style=""
// attribute in a .vue template - every visual rule lives in src/css/ as a
// utility class. :style="..." bindings (JS-computed, per-instance values
// that can't be a static class - e.g. avatar hue colors) are the accepted
// escape hatch and are NOT flagged.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const SRC = join(ROOT, 'src');

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (exts.includes(extname(name))) {
      out.push(full);
    }
  }
  return out;
}

const vueFiles = walk(SRC, ['.vue']);
const tsFiles = walk(SRC, ['.ts']);
const cssFiles = walk(join(SRC, 'css'), ['.css']).filter((f) => !f.includes(`${join('css', 'lib')}`));
const electronFiles = walk(join(ROOT, 'electron'), ['.cjs', '.js']);

// Real cascade order: for equal-specificity single-class rules, the file
// loaded LATER wins - and load order is index.css's @import sequence, which
// does NOT match alphabetical directory order (e.g. borders.css imports
// before colors.css despite the alphabet). Rule 8 (below) depends on this
// being correct or it'll blame the wrong class.
const CSS_DIR = join(SRC, 'css');
const indexCssText = readFileSync(join(CSS_DIR, 'index.css'), 'utf8');
const cssCascadeOrderFiles = [
  ...[...indexCssText.matchAll(/@import\s+"\.\/([^"]+)"/g)]
    .map((m) => m[1])
    .filter((n) => !n.startsWith('lib/'))
    .map((n) => join(CSS_DIR, n)),
  join(CSS_DIR, 'index.css'), // index.css's own body rules load after everything it imports
];

let violations = [];

// ---------------------------------------------------------------------------
// Rule 1: no literal style="..." attributes in .vue templates.
// ---------------------------------------------------------------------------
{
  const styleAttrRe = /(?<!:)\bstyle="[^"]*"/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      // Skip lines inside <script>/<template> comments is overkill here -
      // literal style="" in a comment is not worth special-casing.
      const matches = line.match(styleAttrRe);
      if (matches) {
        for (const m of matches) {
          violations.push({
            rule: 'no-inline-style-attr',
            file: relative(ROOT, file),
            line: i + 1,
            detail: m,
          });
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 2: no <style> blocks in .vue SFCs - all CSS lives in src/css/.
// ---------------------------------------------------------------------------
{
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (/<style[\s>]/.test(line)) {
        violations.push({
          rule: 'no-sfc-style-block',
          file: relative(ROOT, file),
          line: i + 1,
          detail: line.trim(),
        });
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Shared: brace-depth-aware CSS rule parser (handles multi-line and
// multi-selector rules correctly, e.g. `.a,\n.b { ... }`).
// ---------------------------------------------------------------------------
function parseCssRules(cssText) {
  // Comments and statement at-rules (@import "./scale.css";) carry no braces,
  // so whatever they contain would otherwise accumulate into the selector text
  // of the rule that follows - a comment mentioning "scale.css" or an @import
  // both end up declaring a phantom ".css" class.
  cssText = cssText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@(?:import|charset|namespace)[^;]*;/g, '');
  const rules = [];
  let depth = 0;
  let selectorStart = 0;
  let i = 0;
  while (i < cssText.length) {
    const ch = cssText[i];
    if (ch === '/' && cssText[i + 1] === '*') {
      const end = cssText.indexOf('*/', i + 2);
      i = end === -1 ? cssText.length : end + 2;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) {
        const selectorText = cssText.slice(selectorStart, i).trim();
        rules.push({ selectorText, bodyStart: i });
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        selectorStart = i + 1;
      }
    }
    i++;
  }
  return rules.filter((r) => r.selectorText.length > 0);
}

// ---------------------------------------------------------------------------
// Rule 3: no duplicate CSS rules across src/css/*.css (same selector list
// defined more than once - real bug found repeatedly this session, e.g.
// two `.border-color-primary { ... }` rules after a rename collided).
// ---------------------------------------------------------------------------
const allClassNames = new Map(); // className -> [{file, selectorText}]
{
  const seenSelectors = new Map(); // exact selectorText -> [{file}]
  for (const file of cssFiles) {
    const text = readFileSync(file, 'utf8');
    const rules = parseCssRules(text);
    for (const rule of rules) {
      const key = rule.selectorText.replace(/\s+/g, ' ');
      // Only class rules: :root and * are legitimately declared in more than
      // one file (custom properties split across theme files, a reset repeated
      // per layer), and this rule exists for collided class names.
      if (key.includes('.')) {
        if (!seenSelectors.has(key)) seenSelectors.set(key, []);
        seenSelectors.get(key).push(relative(ROOT, file));
      }

      for (const m of rule.selectorText.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
        const cls = m[1];
        if (!allClassNames.has(cls)) allClassNames.set(cls, []);
        allClassNames.get(cls).push(relative(ROOT, file));
      }
    }
  }
  for (const [selectorText, files] of seenSelectors) {
    if (files.length > 1) {
      violations.push({
        rule: 'no-duplicate-css-rule',
        file: files.join(', '),
        line: '',
        detail: selectorText,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 4: no dead CSS classes - defined in src/css/ but never referenced
// anywhere in src/**/*.vue or src/**/*.ts.
//
// Known false positives (dynamic class construction via template literals -
// the literal class name never appears as a complete substring anywhere):
// classes matching these prefixes are skipped entirely.
// ---------------------------------------------------------------------------
const DEAD_CLASS_PREFIX_ALLOWLIST = [
  'avatar-hue-',       // ProfileAvatar.vue: `avatar-hue-${n}`
  'fade-slide-',       // Vue <Transition name="fade-slide"> auto-generates these
  'toast-enter-active', 'toast-leave-active', // <TransitionGroup name="toast">
  'ui-toggle-md', 'ui-toggle-sm', // UiToggle.vue: `ui-toggle-${size}`
];

// A class can only take effect somewhere a class can be applied: an attribute
// whose name ends in "class" (class, :class, v-bind:class, and this codebase's
// dozens of kebab-case overrides like badge-class/tone-class), or a string
// literal in script that gets handed to classList/a template.
//
// Searching the whole file text instead - which this rule used to do - means
// any class whose name is also an ordinary identifier can never be reported.
// `.reveal-on-hover.checked` went unnoticed for exactly that reason: nothing
// applies a "checked" class, but the word appears 25 times across src/ as a
// prop, an emit and a comment, so the rule saw it everywhere and flagged
// nothing.
// A bound attribute (:class, :badge-class) holds a JS expression, so only the
// string literals inside it are class names - taking the whole expression
// would count every identifier in it, which is the same mistake in miniature:
// `:class="{ 'a': checked }"` would otherwise make "checked" look applied.
function collectAppliedClassTokens() {
  const tokens = new Set();
  const parts = [];
  const anyClassAttrRe = /(:|v-bind:)?([\w.-]*)class="([^"]*)"/g;
  const stringInExprRe = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(anyClassAttrRe)) {
      const bound = !!m[1];
      const value = m[3];
      if (!bound) {
        parts.push(value);
        continue;
      }
      for (const s of value.matchAll(stringInExprRe)) {
        parts.push(s[1] ?? s[2] ?? s[3] ?? '');
      }
      // An object key can also be a bare identifier: :class="{ spinning: busy }".
      for (const k of value.matchAll(/(?:\{|,)\s*([a-zA-Z][\w-]*)\s*:/g)) {
        parts.push(k[1]);
      }
    }
  }
  const stringLiteralRe = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g;
  for (const file of [...vueFiles, ...tsFiles]) {
    const text = readFileSync(file, 'utf8');
    const script = (
      file.endsWith('.vue')
        ? (text.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1] ?? '')
        : text
    )
      // Comments first: an apostrophe in prose ("the template's fields") opens a
      // phantom string literal that runs to the next apostrophe, handing back
      // whatever words lie between. That is not hypothetical - one comment
      // reading "fields were checked against docs/governance.md" was on its own
      // enough to make the ".checked" rule below look applied.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const m of script.matchAll(stringLiteralRe)) {
      parts.push(m[1] ?? m[2] ?? m[3] ?? '');
    }
  }
  // Compare whole whitespace-separated tokens rather than searching concatenated
  // text: a word-boundary search treats ':' as a boundary, so the literal
  // 'update:checked' in an $emit would make a ".checked" rule look applied.
  for (const part of parts) {
    for (const token of part.split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return tokens;
}

{
  const vueText = vueFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const appliedClasses = collectAppliedClassTokens();

  // UiPageHeader.vue builds `text-${titleSize}` dynamically from a
  // title-size="Npx" prop - the literal class name never appears as a
  // complete substring, so cross-reference the real prop values used.
  const dynamicTextSizeClasses = new Set();
  for (const m of vueText.matchAll(/title-size="([^"]+)"/g)) {
    dynamicTextSizeClasses.add(`text-${m[1]}`);
  }

  for (const [cls, files] of allClassNames) {
    if (DEAD_CLASS_PREFIX_ALLOWLIST.some((p) => cls.startsWith(p))) continue;
    if (dynamicTextSizeClasses.has(cls)) continue;
    if (!appliedClasses.has(cls)) {
      violations.push({
        rule: 'no-dead-css-class',
        file: files.join(', '),
        line: '',
        detail: `.${cls}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 5: no HTML class in a .vue template that resolves to neither a real
// CSS rule NOR a JS selector (.closest()/.querySelector()/etc string
// literal) - the reverse of rule 4. Catches typos, renamed/removed utility
// classes, and stale semantic-hook classes that never had CSS to begin with
// (this codebase used to carry hundreds of those - e.g. `sitemodal-error`,
// `netparams-header-h1` - as pure naming/devtools hooks; they're gone now,
// this rule keeps them from creeping back in). A class referenced via
// `el.closest('.foo')` etc counts as "used" even with zero CSS, since it's a
// functional hook, not a styling one - found and fixed a real bug this way
// (NavBar's click-outside handler was closest()-ing '.profile-menu', a class
// that had drifted to 'navbar-profile-menu' and never matched).
//
// Only checks STATIC class="..." attributes. Dynamic :class="[...]"/"{...}"
// bindings are deliberately NOT scanned here: a naive scan can't tell a real
// class token from a plain string used in a value comparison (e.g.
// `x === 'for'` inside a :class expression looks identical to a class name),
// and a genuinely wrong class in a dynamic binding is usually a cascade/logic
// bug worth a human looking at, not something to silently auto-strip.
// ---------------------------------------------------------------------------
{
  const jsReferencedClasses = new Set();
  const selectorCallRe = /\.(?:closest|querySelector|querySelectorAll|matches)(?:<[^>()]*>)?\(\s*(['"`])([^'"`]*)\1/g;
  for (const file of [...vueFiles, ...tsFiles, ...electronFiles]) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(selectorCallRe)) {
      for (const c of m[2].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
        jsReferencedClasses.add(c[1]);
      }
    }
  }

  // Rule 4 deliberately excludes src/css/lib/ (vendored CSS) from the
  // dead-class check, but rule 5 needs the opposite direction: a class IS
  // legitimately defined if it's anywhere in lib/ too (e.g. markdown-body-theme
  // from the vendored github-markdown.css).
  const libCssClassNames = new Set();
  for (const file of walk(join(SRC, 'css'), ['.css']).filter((f) => f.includes(join('css', 'lib')))) {
    for (const rule of parseCssRules(readFileSync(file, 'utf8'))) {
      for (const m of rule.selectorText.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) libCssClassNames.add(m[1]);
    }
  }

  const safeClasses = new Set([...allClassNames.keys(), ...jsReferencedClasses, ...libCssClassNames]);
  // (?<![\w:-]) excludes :class="..."/v-bind:class="..." (dynamic bindings,
  // out of scope here - see comment above) AND kebab-case override props
  // like badge-class="..."/label-class="..." (this codebase has dozens) -
  // only a standalone `class="..."` attribute name should match.
  const classAttrRe = /(?<![\w:-])class="([^"]*)"/g;

  for (const file of vueFiles) {
    // Strip HTML comments first - genuinely disabled/commented-out markup
    // (e.g. a feature toggled off with <!-- ... -->) is inert either way,
    // not worth flagging.
    // Replace comment bodies with spaces (not deleted) so line numbers in
    // any violation reported below stay accurate.
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);
    let m;
    while ((m = classAttrRe.exec(tpl))) {
      for (const t of m[1].split(/\s+/).filter(Boolean)) {
        if (!safeClasses.has(t)) {
          const line = text.slice(0, tplOffset + m.index).split('\n').length;
          violations.push({
            rule: 'no-undefined-html-class',
            file: relative(ROOT, file),
            line,
            detail: `.${t}`,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 6: no raw <svg> tags in .vue <template> blocks. Hand-drawn icon SVGs
// duplicate icons already shipped by lucide-vue-next (found and fixed
// repeatedly this session - old Feather-style hand-coded paths that are the
// same icon lucide already provides). Files that legitimately need custom
// SVG (data-bound charts/donut rings, the spinner, filled/solid badge icons
// with no lucide outline equivalent) are listed in SVG_ALLOWLIST below - add
// a file to it only when the SVG is a genuine custom graphic, never to
// silence a duplicate icon.
// ---------------------------------------------------------------------------
const SVG_ALLOWLIST = [
  join('src', 'internal', 'pages', 'NetworkPage.vue'),  // block/tx/tps line charts, points bound to live chain data
  join('src', 'ui', 'UiSpinner.vue'),                   // the spinner primitive itself
];
{
  for (const file of vueFiles) {
    const rel = relative(ROOT, file);
    if (SVG_ALLOWLIST.includes(rel)) continue;
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);
    for (const m of tpl.matchAll(/<svg[\s>]/g)) {
      const line = text.slice(0, tplOffset + m.index).split('\n').length;
      violations.push({
        rule: 'no-raw-svg',
        file: rel,
        line,
        detail: 'hand-drawn <svg> - check node_modules/lucide-vue-next/dist/esm/icons/ for an existing match first',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 7: no empty class="" attributes in .vue templates. Leftover from a
// removed/migrated class list - found and cleaned repeatedly this session.
// Only the literal `class=""` attribute is flagged: kebab-case override
// props like `icon-padding-class=""` are a deliberate "clear the default"
// pattern used throughout src/ui/ and are excluded (same lookbehind as
// rule 5's class-attr regex).
// ---------------------------------------------------------------------------
{
  const emptyClassRe = /(?<![\w:-])class=""/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (emptyClassRe.test(line)) {
        violations.push({
          rule: 'no-empty-class-attr',
          file: relative(ROOT, file),
          line: i + 1,
          detail: line.trim(),
        });
      }
      emptyClassRe.lastIndex = 0;
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 8: no two classes in the SAME class="..." attribute that both set the
// identical CSS property via a plain, unconditional `.classname { ... }`
// rule (no pseudo-class/combinator - those are a different, guarded state
// and don't collide). Equal specificity means the one declared LATER in the
// stylesheet silently wins the cascade and the other is dead weight - real
// bug pattern found this session (WalletPage.vue's DEX cards had both
// `gap-6px` and `gap-4px`, `py-12px px-16px` and `py-10px px-12px` on one
// element - leftover from an incomplete edit).
// ---------------------------------------------------------------------------
{
  const classInfo = new Map(); // className -> { order: <cascade position, higher = wins>, properties: Set }
  let cascadeOrder = 0;
  for (const file of cssCascadeOrderFiles) {
    const text = readFileSync(file, 'utf8');
    let depth = 0;
    let selectorStart = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        i = end === -1 ? text.length : end + 1;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) {
          const selectorText = text.slice(selectorStart, i).trim();
          const bodyEnd = text.indexOf('}', i + 1);
          const body = text.slice(i + 1, bodyEnd === -1 ? text.length : bodyEnd);
          const m = /^\.([a-zA-Z][a-zA-Z0-9_-]*)$/.exec(selectorText);
          if (m) {
            const cls = m[1];
            const order = cascadeOrder++;
            if (!classInfo.has(cls)) classInfo.set(cls, { order, properties: new Set() });
            const info = classInfo.get(cls);
            info.order = order; // last definition of a (rare) redefined class wins
            for (const decl of body.split(';')) {
              const pm = /^\s*([a-zA-Z-]+)\s*:/.exec(decl);
              if (pm) info.properties.add(pm[1].trim());
            }
          }
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) selectorStart = i + 1;
      }
    }
  }

  const classAttrRe2 = /(?<![\w:-])class="([^"]*)"/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);
    let m;
    while ((m = classAttrRe2.exec(tpl))) {
      const tokens = m[1].split(/\s+/).filter(Boolean);
      const byProp = new Map(); // property -> [classes]
      for (const t of tokens) {
        const info = classInfo.get(t);
        if (!info) continue;
        for (const p of info.properties) {
          if (!byProp.has(p)) byProp.set(p, []);
          byProp.get(p).push(t);
        }
      }
      const reportedGroups = new Set();
      for (const [prop, classes] of byProp) {
        const uniq = [...new Set(classes)];
        if (uniq.length < 2) continue;
        const key = uniq.slice().sort().join(',');
        if (reportedGroups.has(key)) continue;
        reportedGroups.add(key);
        const winner = uniq.reduce((a, b) => (classInfo.get(b).order > classInfo.get(a).order ? b : a));
        const line = text.slice(0, tplOffset + m.index).split('\n').length;
        violations.push({
          rule: 'no-conflicting-classes',
          file: relative(ROOT, file),
          line,
          detail: `${uniq.join(' + ')} all set "${prop}" on the same element - "${winner}" wins the cascade, the rest do nothing`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 9 (warning, non-blocking): repeated tag+class markup that isn't going
// through a shared src/ui/ component. This is a smell, not a hard rule - a
// real call requires judging whether the repeated block is genuinely the
// same component (extract it) or a coincidental resemblance (leave it), and
// this session's manual scans found plenty of both. Combos of fewer than 4
// classes are skipped as noise (plain utility-class reuse is the whole point
// of utility classes, not a problem) and only exact repeats WITHIN one file
// are counted (cross-file duplication needs the heavier structural scan
// described in CLAUDE.md, not a cheap per-file regex pass).
// ---------------------------------------------------------------------------
const warnings = [];
{
  const tagClassRe = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(?<![\w:-])class="([^"]*)"/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const counts = new Map(); // "tag|sortedClasses" -> [{index}]
    let m;
    while ((m = tagClassRe.exec(tpl))) {
      const tag = m[1];
      const tokens = [...new Set(m[2].split(/\s+/).filter(Boolean))];
      if (tokens.length < 4) continue;
      if (/^Ui[A-Z]/.test(tag)) continue; // already a shared component - not the problem this rule looks for
      const key = `${tag}|${tokens.slice().sort().join(' ')}`;
      if (!counts.has(key)) counts.set(key, []);
      counts.get(key).push(m.index);
    }
    for (const [key, indices] of counts) {
      if (indices.length < 4) continue;
      const [tag] = key.split('|');
      const firstLine = tplMatch.index + tplMatch[0].indexOf(tpl) + indices[0];
      const line = text.slice(0, firstLine).split('\n').length;
      warnings.push({
        rule: 'possible-repeated-markup',
        file: relative(ROOT, file),
        line,
        detail: `<${tag}> with the same ${key.split('|')[1].split(' ').length}-class combo repeated ${indices.length}x in this file - consider a src/ui/ component`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rules 10 & 11 used to live here: unused imports and unused top-level
// declarations in .vue <script setup>, found by regex.
//
// They are gone because ESLint does the same job properly. Their comment
// claimed "this project has no vue-tsc/eslint step", which stopped being true
// a long time before anyone reread it; @typescript-eslint/no-unused-vars now
// covers both cases from a real syntax tree, and understands that a
// script-setup binding used only in the template is used. The regex version
// counted a name as used if it appeared anywhere in the file - including
// inside a comment - so it was also the weaker of the two.
//
// Verified before deleting: an unused import and an unused const, planted in
// a .vue file, are both reported by `npm run lint`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rule 12: no blank/whitespace-only line inside a multi-line HTML tag's
// attribute list. Almost always a leftover from a removed/reordered
// attribute - found and hand-fixed dozens of times across nearly every file
// reviewed this session, never turned into a permanent check until now.
// State-machine scan (mirrors the CSS brace-depth scanners above): tracks
// whether we're currently inside an open tag (`<foo ... >`) and outside any
// quoted attribute value, so a blank line deep inside a multi-line JS
// expression attribute (legitimate formatting) is never flagged.
// ---------------------------------------------------------------------------
{
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);

    let inTag = false;
    let quote = null;
    let lineStart = 0;
    for (let i = 0; i <= tpl.length; i++) {
      const ch = i < tpl.length ? tpl[i] : '\n';
      if (ch === '\n') {
        const line = tpl.slice(lineStart, i);
        if (inTag && !quote && /^[ \t\r]*$/.test(line)) {
          const absIndex = tplOffset + lineStart;
          const lineNo = text.slice(0, absIndex).split('\n').length;
          violations.push({
            rule: 'no-blank-line-in-tag',
            file: relative(ROOT, file),
            line: lineNo,
            detail: '(blank line between attributes)',
          });
        }
        lineStart = i + 1;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        if (inTag) quote = ch;
        continue;
      }
      if (ch === '<' && /[a-zA-Z]/.test(tpl[i + 1] || '')) {
        inTag = true;
        continue;
      }
      if (ch === '>' && inTag) {
        inTag = false;
        continue;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 13: no literal `v-if="true"` / `v-if="false"` (or v-else-if
// variants). Always either forgotten debug code or a dead branch - found 2x
// in DrivePage.vue this session (a whole duplicated "plans" block and a
// permanently-hidden detail row). No legitimate reason to hardcode a
// boolean literal here instead of just adding/removing the markup.
// ---------------------------------------------------------------------------
{
  const literalIfRe = /v-(?:if|else-if)="\s*(true|false)\s*"/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8');
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);
    let m;
    while ((m = literalIfRe.exec(tpl))) {
      const lineNo = text.slice(0, tplOffset + m.index).split('\n').length;
      violations.push({
        rule: 'no-literal-vif',
        file: relative(ROOT, file),
        line: lineNo,
        detail: m[0],
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 14: no class token repeated twice in the same class="..." attribute
// (e.g. class="foo bar foo") - always a copy-paste accident, never
// meaningful (repeating a class doesn't change the cascade). Cheap
// complement to rule 8 (which catches *different* classes fighting over the
// same property) using the same class="..." attribute scan.
// ---------------------------------------------------------------------------
{
  const classAttrRe3 = /(?<![\w:-])class="([^"]*)"/g;
  for (const file of vueFiles) {
    const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
    const tplMatch = text.match(/<template>([\s\S]*)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1];
    const tplOffset = tplMatch.index + tplMatch[0].indexOf(tpl);
    let m;
    while ((m = classAttrRe3.exec(tpl))) {
      const tokens = m[1].split(/\s+/).filter(Boolean);
      const seen = new Set();
      const dupes = new Set();
      for (const t of tokens) {
        if (seen.has(t)) dupes.add(t);
        seen.add(t);
      }
      if (dupes.size) {
        const lineNo = text.slice(0, tplOffset + m.index).split('\n').length;
        violations.push({
          rule: 'no-duplicate-class-token',
          file: relative(ROOT, file),
          line: lineNo,
          detail: [...dupes].map((d) => `"${d}"`).join(', '),
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 15: no CSS custom property (--foo) defined in src/css/theme.css but
// never referenced anywhere via var(--foo). The variable-level equivalent of
// rule 4 (dead utility class) - found a real instance this session
// (--store-button became orphaned the moment .color-store-button, its only
// consumer, was deleted as dead code; rule 4 has no visibility into custom
// properties at all).
// ---------------------------------------------------------------------------
{
  const themeFile = cssFiles.find((f) => f.endsWith(join('css', 'theme.css')));
  if (themeFile) {
    const themeText = readFileSync(themeFile, 'utf8');
    const declared = new Set();
    for (const m of themeText.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) declared.add(m[1]);

    const haystack = [...cssFiles, ...vueFiles, ...tsFiles]
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');

    for (const name of declared) {
      const re = new RegExp(`var\\(\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,)]`);
      if (!re.test(haystack)) {
        violations.push({
          rule: 'no-dead-css-variable',
          file: relative(ROOT, themeFile),
          line: '',
          detail: name,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 16: no function-typed prop in a .vue component.
//
// A component that receives a function is usually receiving its own
// presentation - how to format its own values, what to call its own things -
// which means it cannot be read on its own, and two callers can only agree by
// accident because the same parent happens to feed both. Sixteen of these
// accumulated across the Drive dialogs alone: format a size, a date, a price,
// name a plan, colour its badge. Every one of them belonged either in a
// service both sides import, or inside the component itself.
//
// The two honest alternatives, in order of preference:
//   - a shared module in src/internal/services/, when the logic is real
//   - an emit, when the parent is being asked to *do* something
//
// It stays a rule rather than a warning because the fix is nearly always one
// of those two. The exceptions are genuinely rare and listed below, each with
// the reason it cannot be either.
// ---------------------------------------------------------------------------
const FUNCTION_PROP_ALLOWLIST = new Map([
  // Whether a plan is subscribed is read from the subscriptions the page
  // holds; the dialog turns that answer into words and colours itself.
  [`${join('src', 'dialogs', 'CloudPlansDialog.vue')}:statusOf`, true],
]);
{
  for (const file of vueFiles) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    const script = text.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
    if (!script) continue;

    // Only the props block: a function inside an emits declaration or a plain
    // type alias is not what this rule is about.
    const propsMatch = script.match(/defineProps<\{([\s\S]*?)\}>\(\)/);
    if (!propsMatch) continue;

    for (const m of propsMatch[1].matchAll(/^\s*(\w+)\??:\s*\((?:[^)]*)\)\s*=>/gm)) {
      const name = m[1];
      if (FUNCTION_PROP_ALLOWLIST.has(`${rel}:${name}`)) continue;
      const index = text.indexOf(propsMatch[0]) + propsMatch[0].indexOf(m[0]);
      violations.push({
        rule: 'no-function-prop',
        file: rel,
        line: text.slice(0, index).split('\n').length,
        detail: `${name} - move the logic to src/internal/services/ (or into this component), or make it an emit`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The allowlists above have to stay honest.
//
// Every list here is a claim that some rule must not apply somewhere. A claim
// stops being true when the file is deleted or the thing it excused is gone,
// and nothing noticed: SVG_ALLOWLIST carried DaoPage.vue and ExplorerPage.vue
// for as long as it took someone to read it, months after both were merged into
// NetworkPage. check-tests already fails on an exemption it no longer needs;
// this is the same idea, applied to the lists in this file.
// ---------------------------------------------------------------------------
{
  for (const rel of SVG_ALLOWLIST) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) {
      violations.push({
        rule: 'stale-allowlist-entry',
        file: 'scripts/check-conventions.mjs',
        line: '',
        detail: `SVG_ALLOWLIST names ${rel}, which does not exist - remove the entry`,
      });
      continue;
    }
    const tpl = readFileSync(full, 'utf8').match(/<template>([\s\S]*)<\/template>/)?.[1] ?? '';
    if (!/<svg[\s>]/.test(tpl)) {
      violations.push({
        rule: 'stale-allowlist-entry',
        file: 'scripts/check-conventions.mjs',
        line: '',
        detail: `SVG_ALLOWLIST excuses ${rel}, which no longer draws an <svg> - remove the entry`,
      });
    }
  }

  for (const key of FUNCTION_PROP_ALLOWLIST.keys()) {
    const [rel, prop] = key.split(':');
    const full = join(ROOT, rel);
    if (!existsSync(full)) {
      violations.push({
        rule: 'stale-allowlist-entry',
        file: 'scripts/check-conventions.mjs',
        line: '',
        detail: `FUNCTION_PROP_ALLOWLIST names ${rel}, which does not exist - remove the entry`,
      });
      continue;
    }
    const props = readFileSync(full, 'utf8').match(/defineProps<\{([\s\S]*?)\}>\(\)/)?.[1] ?? '';
    if (!new RegExp(`^\\s*${prop}\\??:\\s*\\(`, 'm').test(props)) {
      violations.push({
        rule: 'stale-allowlist-entry',
        file: 'scripts/check-conventions.mjs',
        line: '',
        detail: `FUNCTION_PROP_ALLOWLIST excuses ${rel}:${prop}, which is no longer a function prop - remove the entry`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const titles = {
  'no-inline-style-attr': 'Literal style="" attributes (use a CSS class in src/css/ instead)',
  'no-sfc-style-block': '<style> blocks inside .vue files (all CSS must live in src/css/)',
  'no-duplicate-css-rule': 'Duplicate CSS selector defined more than once',
  'no-dead-css-class': 'CSS class defined but never referenced in src/**/*.vue or *.ts',
  'no-undefined-html-class': 'HTML class="" token with no matching CSS rule or JS selector',
  'no-raw-svg': 'Hand-drawn <svg> in a .vue template (check lucide-vue-next first)',
  'no-empty-class-attr': 'Empty class="" attribute',
  'no-conflicting-classes': 'Two classes on one element silently fight over the same CSS property',
  'no-unused-import': 'Imported but never used anywhere in the file',
  'no-unused-top-level-declaration': 'Top-level const/let/function declared but never used anywhere in the file',
  'no-blank-line-in-tag': 'Blank line inside a multi-line HTML tag (leftover from a removed attribute)',
  'no-literal-vif': 'Literal v-if="true"/"false" (dead code or forgotten debug toggle)',
  'no-duplicate-class-token': 'Same class listed twice in one class="..." attribute',
  'no-dead-css-variable': 'CSS custom property (--foo) defined in theme.css but never referenced via var()',
  'no-function-prop': 'Function passed as a prop (a component should not receive its own presentation)',
  'stale-allowlist-entry': 'An allowlist in this script excuses something that is no longer there',
};

if (warnings.length) {
  const byWarnRule = new Map();
  for (const w of warnings) {
    if (!byWarnRule.has(w.rule)) byWarnRule.set(w.rule, []);
    byWarnRule.get(w.rule).push(w);
  }
  const warnTitles = { 'possible-repeated-markup': 'Repeated markup that might belong in a src/ui/ component (non-blocking - use judgement)' };
  for (const [rule, items] of byWarnRule) {
    console.log(`\n--- ${warnTitles[rule] || rule} (${items.length}) ---`);
    for (const w of items) {
      console.log(`  ${w.file}:${w.line}  ${w.detail}`);
    }
  }
  console.log('');
}

if (violations.length === 0) {
  console.log('check:conventions - all clear (no inline style="", no SFC <style> blocks, no duplicate/dead/undefined CSS classes, no raw <svg>, no empty class="", no conflicting classes, no unused imports/declarations).');
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}

for (const [rule, items] of byRule) {
  console.log(`\n=== ${titles[rule] || rule} (${items.length}) ===`);
  for (const v of items) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.log(`  ${loc}  ${v.detail}`);
  }
}

console.log(`\ncheck:conventions failed - ${violations.length} violation(s).`);
process.exit(1);