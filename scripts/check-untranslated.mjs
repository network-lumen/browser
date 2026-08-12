// Fails on user-visible English that does not go through t().
//
// Run via `npm run check:i18n-strings` (wired into `npm test`). The migration
// that routed ~1 850 strings through t() is worth exactly as much as the rule
// that keeps the next one from drifting back: nothing about a raw string fails
// at runtime, it simply stays English forever in every other language.
//
// What counts as user-visible:
//   - a text node or a text-bearing attribute in a .vue template
//   - a prose string literal in a script, outside a comment and outside a
//     console.* call
//
// What does not, and why the scan skips it: CSS class lists and CSS values read
// as several English words; so do webPreferences strings and media queries; and
// a formatted placeholder like "0.000 LMN" is a number, not a sentence. The
// residue that survives all of that is listed in ALLOWED below, each entry a
// claim that has to stay true - an entry that no longer matches anything fails
// this check too, the same way check-tests treats a stale exemption.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const SRC = join(ROOT, 'src');

/** Strings that are deliberately not translated. */
const ALLOWED = new Set([
  // Passed to <webview webpreferences>, parsed by Electron.
  'contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no',
  // A zero balance, already in the app's number format.
  '0.000 LMN',
  '0.000000 LMN',
  // The record-type placeholder in the domain settings form: literal key names.
  'cid | ipns | txt | ...',
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'lib', 'img', 'locales', 'css'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (['.ts', '.vue'].includes(extname(full))) out.push(full);
  }
  return out;
}

// A run of utility classes reads like a sentence: several lowercase words with
// spaces between them. The give-away is that every token is kebab-case and
// there is no sentence punctuation anywhere.
function isClassList(text) {
  const tokens = text.trim().split(/\s+/);
  return tokens.every((t) => /^[a-z0-9][a-z0-9-]*$/.test(t)) && tokens.some((t) => t.includes('-'));
}

// A CSS value, a media query and a webPreferences string are all English words
// separated by spaces. None of them is a sentence.
function isMachineReadable(text) {
  return /=|var\(|rgba?\(|--|\d+px |prefers-color-scheme|@media/.test(text);
}

function isFragment(text) {
  return /^\s*[,:;.]/.test(text) || /[,:;]\s*$/.test(text);
}

function isCode(text) {
  return /!==|===|=>|\|\||&&|\breturn\b|\bconst\b|\bfunction\b|[(){}[\]]/.test(text);
}

function isProse(text) {
  return (
    /[A-Za-z]{3}/.test(text) &&
    / /.test(text) &&
    // Mostly digits is a formatted value, not a sentence.
    text.replace(/[^A-Za-z]/g, '').length > text.length / 2 &&
    !/^(?:https?|lumen|file|ipfs|chrome-extension|data):/i.test(text) &&
    !isClassList(text) &&
    !isMachineReadable(text) &&
    !isFragment(text) &&
    !isCode(text)
  );
}

const TEXT_ATTRS =
  /\s(?:title|placeholder|aria-label|label|description|subtitle|alt|message|confirm-label|cancel-label|busy-label|empty-label|empty-title|empty-description)="([^"{}]+)"/g;

// Both wrappers count as translated: t() at the point of display, and
// markForTranslation() for a string in a table that is translated where drawn.
const TRANSLATED = /\b(?:t|markForTranslation)\((['"`])(?:\\.|(?!\1)[^\\])*\1[^)]*\)/g;

const violations = [];
const seen = new Set();

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  const record = (value, line) => {
    const s = value.replace(/\s+/g, ' ').trim();
    if (!s || ALLOWED.has(s) || !isProse(s)) return;
    seen.add(s);
    violations.push({ file: rel, line, detail: JSON.stringify(s.slice(0, 90)) });
  };

  const lineAt = (index) => text.slice(0, index).split('\n').length;

  if (file.endsWith('.vue')) {
    const match = text.match(/<template>([\s\S]*)<\/template>/);
    if (match) {
      const offset = match.index + match[0].indexOf(match[1]);
      const tpl = match[1]
        .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(TRANSLATED, (m) => m.replace(/[^\n]/g, ' '));
      for (const m of tpl.matchAll(/>([^<>{}]+)</g)) record(m[1], lineAt(offset + m.index));
      for (const m of tpl.matchAll(TEXT_ATTRS)) record(m[1], lineAt(offset + m.index));
    }
  }

  const scriptMatch = file.endsWith('.vue')
    ? text.match(/<script[^>]*>([\s\S]*)<\/script>/)
    : null;
  const body = scriptMatch ? scriptMatch[1] : file.endsWith('.ts') ? text : null;
  if (body === null) continue;
  const offset = scriptMatch ? scriptMatch.index + scriptMatch[0].indexOf(scriptMatch[1]) : 0;

  const blank = (m) => m.replace(/[^\n]/g, ' ');
  const script = body
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/gm, (m, lead) => lead + blank(m.slice(lead.length)))
    .replace(/\bconsole\s*\.\s*\w+\s*\([\s\S]*?\)\s*;?/g, blank)
    .replace(/\bimport\s[^;\n]*from\s*['"][^'"]*['"]/g, blank)
    .replace(TRANSLATED, blank);

  for (const m of script.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    record(m[2], lineAt(offset + m.index));
  }
}

const staleAllowlist = [...ALLOWED].filter((entry) => {
  for (const file of walk(SRC)) {
    if (readFileSync(file, 'utf8').includes(entry)) return false;
  }
  return true;
});

if (!violations.length && !staleAllowlist.length) {
  console.log('check:i18n-strings - all clear (every user-visible string goes through t()).');
  process.exit(0);
}

if (violations.length) {
  console.log(`\n=== User-visible English not going through t() (${violations.length}) ===`);
  for (const v of violations) console.log(`  ${v.file}:${v.line}  ${v.detail}`);
  console.log('\nWrap it: {{ t(\'…\') }} in a template, t(\'…\') in a script.');
  console.log('For a string in a module-level table, markForTranslation() there and t() where it is drawn.');
}

for (const entry of staleAllowlist) {
  console.log(`\n=== Stale ALLOWED entry in scripts/check-untranslated.mjs ===`);
  console.log(`  ${JSON.stringify(entry)} no longer appears in src/ - remove it.`);
}

console.log(
  `\ncheck:i18n-strings failed - ${violations.length} untranslated, ${staleAllowlist.length} stale exemption(s).`
);
process.exit(1);
