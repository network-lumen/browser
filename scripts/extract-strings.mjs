// Refreshes src/locales/*.json from the t('…') calls in src/.
//
// Run via `npm run i18n:extract`. Existing translations are kept; new keys are
// added empty, and keys whose English source has changed or gone are reported
// rather than deleted - a translation is expensive to produce and cheap to
// re-attach to a reworded string by hand, so this never throws one away.
//
// `--check` makes it read-only and exit non-zero when a catalogue is out of
// date, which is what CI wants.
//
// Keys are the English source string itself (see src/internal/services/i18n.ts
// for why), so extraction is a scan for the literal argument of t().

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const SRC = join(ROOT, 'src');
const LOCALES_DIR = join(SRC, 'locales');
const CHECK_ONLY = process.argv.includes('--check');

// Kept in step with LOCALES in src/internal/services/i18n.ts; 'en' is the
// source language and has no catalogue of its own.
const TARGET_LOCALES = ['fr'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'locales') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (['.ts', '.vue'].includes(extname(name))) out.push(full);
  }
  return out;
}

// t('…') / t("…") / t(`…`), with or without a params argument, plus
// markForTranslation('…') for strings that sit in a data table and are
// translated where they are drawn. A template literal holding ${} is skipped:
// its key is not a constant, so it cannot be looked up, and reporting it is
// more useful than extracting half of it.
const CALL_RE = /\b(?:t|markForTranslation)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*[,)]/g;
const DYNAMIC_RE = /\b(?:t|markForTranslation)\(\s*`[^`]*\$\{/g;

const keys = new Map(); // key -> [file:line]
const dynamic = [];

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).split('\\').join('/');
  const clean = text
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/gm, (s) => s.replace(/[^\n]/g, ' '));

  for (const m of clean.matchAll(CALL_RE)) {
    const key = m[2].replace(/\\(['"`\\])/g, '$1');
    if (!key.trim()) continue;
    const line = clean.slice(0, m.index).split('\n').length;
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(`${rel}:${line}`);
  }
  for (const m of clean.matchAll(DYNAMIC_RE)) {
    dynamic.push(`${rel}:${clean.slice(0, m.index).split('\n').length}`);
  }
}

const sourceKeys = [...keys.keys()].sort((a, b) => a.localeCompare(b));

let stale = false;
for (const code of TARGET_LOCALES) {
  const path = join(LOCALES_DIR, `${code}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};

  const next = {};
  const missing = [];
  for (const key of sourceKeys) {
    const value = String(existing[key] ?? '');
    next[key] = value;
    if (!value.trim()) missing.push(key);
  }
  const orphaned = Object.keys(existing).filter((key) => !keys.has(key) && String(existing[key] || '').trim());

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const unchanged = existsSync(path) && readFileSync(path, 'utf8') === serialized;

  const translated = sourceKeys.length - missing.length;
  console.log(
    `${code}: ${translated}/${sourceKeys.length} translated, ${missing.length} missing, ${orphaned.length} orphaned`
  );
  for (const key of orphaned) {
    console.log(`  orphaned (source string changed or gone): ${JSON.stringify(key)} = ${JSON.stringify(existing[key])}`);
  }

  if (unchanged) continue;
  if (CHECK_ONLY) {
    stale = true;
    console.log(`  ${code}.json is out of date - run \`npm run i18n:extract\``);
    continue;
  }
  writeFileSync(path, serialized);
  console.log(`  wrote ${relative(ROOT, path)}`);
}

if (dynamic.length) {
  console.log(`\n${dynamic.length} t() call(s) with an interpolated key - use {placeholders} and pass params instead:`);
  for (const at of dynamic) console.log(`  ${at}`);
}

console.log(`\n${sourceKeys.length} translatable string(s) across ${keys.size ? new Set([...keys.values()].flat().map((v) => v.split(':')[0])).size : 0} file(s).`);

if (stale || dynamic.length) process.exit(1);
