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

import { readFileSync, readdirSync, statSync } from 'node:fs';
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
      if (!seenSelectors.has(key)) seenSelectors.set(key, []);
      seenSelectors.get(key).push(relative(ROOT, file));

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

{
  const vueText = vueFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const tsText = tsFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const haystack = vueText + '\n' + tsText;

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
    // Word-boundary-safe substring search (avoid `primary` matching inside `primary-a10`).
    const re = new RegExp(`(?<![a-zA-Z0-9_-])${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_-])`);
    if (!re.test(haystack)) {
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
// Report
// ---------------------------------------------------------------------------
if (violations.length === 0) {
  console.log('check:conventions - all clear (no inline style="", no SFC <style> blocks, no duplicate/dead/undefined CSS classes).');
  process.exit(0);
}

const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}

const titles = {
  'no-inline-style-attr': 'Literal style="" attributes (use a CSS class in src/css/ instead)',
  'no-sfc-style-block': '<style> blocks inside .vue files (all CSS must live in src/css/)',
  'no-duplicate-css-rule': 'Duplicate CSS selector defined more than once',
  'no-dead-css-class': 'CSS class defined but never referenced in src/**/*.vue or *.ts',
  'no-undefined-html-class': 'HTML class="" token with no matching CSS rule or JS selector',
};

for (const [rule, items] of byRule) {
  console.log(`\n=== ${titles[rule] || rule} (${items.length}) ===`);
  for (const v of items) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.log(`  ${loc}  ${v.detail}`);
  }
}

console.log(`\ncheck:conventions failed - ${violations.length} violation(s).`);
process.exit(1);
