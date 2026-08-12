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

/**
 * Strings that are deliberately not translated, because something other than a
 * person reads them.
 *
 * The first group is the dangerous one. `message.includes('failed to fetch')`
 * matches text produced by the browser or by a node; wrap it in `t()` and the
 * comparison stops matching the moment the app is not in English, and the path
 * it guards silently never runs again. Nothing fails, in English, ever - which
 * is why they are named here rather than left to judgement.
 */
const ALLOWED = new Set([
  // Compared against text from the network, from Kubo or from Electron.
  'closed network connection',
  'failed to fetch',
  'fetch failed',
  'not found',
  'transaction indexing is disabled',
  'invalid endpoint: format',
  'invalid endpoint: domain format',
  'invalid endpoint: extension format',
  'invalid endpoint: characters',
  'invalid endpoint: empty label',
  'Error: kyber_pubkey_http_unavailable',

  // A CSS selector list, a CSS transition, an HTTP header, a link relationship.
  'a, button, article, section, div',
  'filter 180ms ease, transform 180ms ease',
  'noopener noreferrer',

  // Passed to <webview webpreferences>, parsed by Electron.
  'contextIsolation=yes, nodeIntegration=no, sandbox=yes, javascript=yes, nativeWindowOpen=no',

  // A zero balance, already in the app's number format.
  '0.000 LMN',
  '0.000000 LMN',

  // The record-type placeholder in the domain settings form: literal key names.
  'cid | ipns | txt | ...',

  // The product name. It is the same word in every language.
  'Lumen',

  // A language picker names each language in that language, so its own label is
  // the one string in the app that must not follow the active locale.
  'English',
  'Français',
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
  return (
    /=|var\(|rgba?\(|--|\d+px |prefers-color-scheme|@media/.test(text) ||
    // A CSS animation shorthand: "spin 0.95s linear infinite".
    /\d+(?:\.\d+)?m?s\s/.test(text)
  );
}

// A `${a}, url: ${b}` template literal reads to a scanner as the fragment
// ", url:" - punctuation at the *start*, which no sentence has. A trailing
// colon is not the same thing: "Pending TTL:" is a label with a value after it,
// and treating it as a fragment hid one for a whole pass.
function isFragment(text) {
  return /^\s*[,:;.]/.test(text);
}

function isCode(text) {
  return /!==|===|=>|\|\||&&|\breturn\b|\bconst\b|\bfunction\b|[(){}[\]]/.test(text);
}

// A ticker or an acronym beside a separator - "LMN ·", "CID:" - is a value,
// not a sentence. Nothing all-caps needs translating.
function isAcronymOnly(text) {
  const words = text.match(/[A-Za-z]+/g) || [];
  return words.length > 0 && words.every((w) => w === w.toUpperCase());
}

/**
 * A single word can still be on screen - `>Confirm {{ action }}<` is a button
 * caption, and `{ drive: 'Drive' }` is a page name in a lookup table. What it
 * must not catch is the enum values sitting beside them: `'deny'`, `'ulmn'`,
 * `'idle'`, `'environment'`. The two are told apart by the capital, which holds
 * across this codebase - a word meant for a user is written for a user.
 */
function isProse(text, { singleWordCounts = false } = {}) {
  if (singleWordCounts && /^[A-Z][a-z]{2,}$/.test(text.trim())) return true;
  return (
    /[A-Za-z]{3}/.test(text) &&
    / /.test(text) &&
    !isAcronymOnly(text) &&
    // Mostly digits is a formatted value, not a sentence.
    text.replace(/[^A-Za-z]/g, '').length > text.length / 2 &&
    !/^(?:https?|lumen|file|ipfs|chrome-extension|data):/i.test(text) &&
    !isClassList(text) &&
    !isMachineReadable(text) &&
    !isFragment(text) &&
    !isCode(text)
  );
}

// Any attribute whose name says it carries words. Listing them by name was a
// mistake the first time round: `consequence="They will no longer be able to
// access your gateway."` is a sentence on screen, and it went unnoticed purely
// because nobody had thought to add "consequence" to a list.
const TEXT_ATTRS =
  /\s(?:title|placeholder|aria-label|alt|message|consequence|hint|note|summary|caption|tooltip|[\w-]*(?:label|description|subtitle|text|title))="([^"{}]+)"/g;

// Both wrappers count as translated: t() at the point of display, and
// markForTranslation() for a string in a table that is translated where drawn.
const TRANSLATED = /\b(?:t|markForTranslation)\((['"`])(?:\\.|(?!\1)[^\\])*\1[^)]*\)/g;

const violations = [];
const seen = new Set();

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  const record = (value, line, opts) => {
    const s = value.replace(/\s+/g, ' ').trim();
    if (!s || ALLOWED.has(s) || !isProse(s, opts)) return;
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
      // A text node ends at the next tag *or* the next interpolation. Only
      // looking for '<' missed every sentence wrapped around a {{ … }} - which
      // is precisely the shape that cannot be translated and most needs
      // catching.
      const inTemplate = { singleWordCounts: true };
      for (const m of tpl.matchAll(/>([^<>{}]+)(?=<|\{\{)/g)) record(m[1], lineAt(offset + m.index), inTemplate);
      for (const m of tpl.matchAll(/\}\}([^<>{}]+)(?=<|\{\{)/g)) record(m[1], lineAt(offset + m.index), inTemplate);
      for (const m of tpl.matchAll(TEXT_ATTRS)) record(m[1], lineAt(offset + m.index));
      // A bound attribute holding a template literal: `Manage stake with ${x}`.
      // The expression is code, but the words inside the backticks are not.
      for (const m of tpl.matchAll(/`([^`$]*[A-Za-z]{3}[^`]*)`/g)) {
        record(m[1].replace(/\$\{[^}]*\}/g, ' '), lineAt(offset + m.index));
      }
      // A quoted string inside an interpolation or a bound attribute:
      // `{{ expanded ? "Hide details" : "Show details" }}`. The expression is
      // code; the two literals in it are on screen.
      // Inside {{ }} a double quote is an ordinary string delimiter; inside an
      // attribute it is the delimiter of the attribute itself, so only the
      // interpolation scan looks for it.
      for (const expr of tpl.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
        for (const lit of expr[1].matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
          record(lit[2], lineAt(offset + expr.index));
        }
      }
      for (const expr of tpl.matchAll(/(?::|v-bind:|@|v-if=|v-else-if=|v-for=)[\w.-]*="([^"]*)"/g)) {
        for (const lit of expr[1].matchAll(/(['`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
          record(lit[2], lineAt(offset + expr.index));
        }
      }
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

  // A lookup table of display strings - `{ network: 'Network', drive: 'Drive' }`
  // - is a whole screen's worth of words that the scan above skips, because
  // each value is a single word. `getCardTitle` in HomePage.vue was twelve page
  // names rendered raw for exactly that reason.
  for (const m of script.matchAll(/(?:^|[{,])\s*(\w+)\s*:\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2(\s*\|)?/gm)) {
    // `action: 'Delegate' | 'Undelegate'` is a type annotation, not a table.
    if (m[4]) continue;
    record(m[3], lineAt(offset + m.index), { singleWordCounts: true });
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
