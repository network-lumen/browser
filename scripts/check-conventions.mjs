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
// Report
// ---------------------------------------------------------------------------
if (violations.length === 0) {
  console.log('check:conventions - all clear (no inline style="", no SFC <style> blocks, no duplicate/dead CSS classes).');
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
