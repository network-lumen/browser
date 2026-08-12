// Merges a batch of translations into a locale catalogue.
//
//   node scripts/merge-locale.mjs fr batch.json
//
// A catalogue is 1 800 entries; nobody writes one in a single pass, and a
// half-written file that overwrites the whole catalogue loses the other half.
// This only ever adds and overwrites the keys the batch names, keeps the file
// sorted the way the extractor writes it, and refuses a key the source does not
// ask for - a typo in an English key would otherwise sit in the file for ever,
// translated and never shown.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const [code, batchPath] = process.argv.slice(2);

if (!code || !batchPath) {
  console.error('usage: merge-locale.mjs <locale> <batch.json>');
  process.exit(1);
}

const localePath = join(ROOT, 'src/locales', `${code}.json`);
if (!existsSync(localePath)) {
  console.error(`no catalogue at src/locales/${code}.json`);
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(localePath, 'utf8'));
const batch = JSON.parse(readFileSync(batchPath, 'utf8'));

const unknown = [];
const placeholderDrift = [];
let added = 0;
let changed = 0;

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

for (const [key, value] of Object.entries(batch)) {
  if (!(key in catalogue)) {
    unknown.push(key);
    continue;
  }
  const text = String(value ?? '').trim();
  if (!text) continue;
  if (placeholders(text) !== placeholders(key)) {
    placeholderDrift.push(`${JSON.stringify(key)} -> ${JSON.stringify(text)}`);
    continue;
  }
  if (!catalogue[key]) added++;
  else if (catalogue[key] !== text) changed++;
  catalogue[key] = text;
}

// The extractor writes keys sorted by locale-aware comparison; keep it that way
// so a merge never shows up as a reordering diff.
const sorted = {};
for (const key of Object.keys(catalogue).sort((a, b) => a.localeCompare(b))) {
  sorted[key] = catalogue[key];
}
writeFileSync(localePath, `${JSON.stringify(sorted, null, 2)}\n`);

const total = Object.keys(sorted).length;
const done = Object.values(sorted).filter((v) => String(v).trim()).length;
console.log(`${code}: +${added} new, ${changed} changed - ${done}/${total} translated`);

for (const key of unknown) console.log(`  IGNORED (no such source string): ${JSON.stringify(key)}`);
for (const drift of placeholderDrift) console.log(`  REFUSED (placeholder drift): ${drift}`);

if (unknown.length || placeholderDrift.length) process.exit(1);
