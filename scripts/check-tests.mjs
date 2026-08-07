// Every shared module must be reachable from a test.
//
// Written after a pass that added tests to eighteen modules which had none,
// and found a real defect in six of them - a gate that never fired, a timer
// that woke every minute to do nothing, a cache with no way to clear it. None
// of those were visible in a green run, because nothing exercised the code.
//
// The rule is deliberately about *reachability*, not about coverage
// percentages. A service that no test imports is one nobody has ever run
// outside the app; a service that is imported has at least been thought about.
// Percentages would need a threshold, and a threshold is a number people
// negotiate down.
//
// Run via `npm run check:tests` (part of `npm test`).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'));

const walk = (dir, match) => (existsSync(dir)
  ? readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, match) : match.test(name) ? [full] : [];
  })
  : []);

const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// The directories a contributor adds shared logic to. Pages and components are
// not here: they are covered end-to-end, and unit-testing a page would mean
// mounting it.
// ---------------------------------------------------------------------------
const WATCHED = [
  'src/internal/services',
  'src/stores',
  'src/composables',
];

// ---------------------------------------------------------------------------
// Modules that cannot be reached from a unit test, each with the reason.
//
// This is not a to-do list. Adding a name here is a claim that the module is
// structurally untestable, and the reason has to say why - "no time" is not a
// reason, and neither is "it is hard to mock".
// ---------------------------------------------------------------------------
const UNREACHABLE = new Map([
  [
    'src/internal/services/tabHistory.ts',
    'Reads page titles from the route table, which imports every page. Importing it from a test pulls in a page that calls the Electron bridge as its module loads, and the import throws before the test runs. The read side of the same concern lives in tabPosition.ts, which is dependency-free and is tested.',
  ],
  [
    'src/internal/services/paymentReminders.ts',
    'Reaches profilesStore, which is renderer-wide reactive state seeded by the app at startup. What is worth testing here - the schedule arithmetic and the counters - lives in recurringPayments.ts and is tested there; this file is the confirmation flow around it.',
  ],
  [
    'src/composables/usePinJob.ts',
    'Owns refs bound to a template and is only meaningful inside a component. The parsing it depends on is pinJobs.ts, which is tested.',
  ],
  [
    'src/composables/useInternalLumen.ts',
    'One line returning window.lumen. Every bridge-facing test exercises it by construction.',
  ],
]);

// ---------------------------------------------------------------------------
// What the tests import.
// ---------------------------------------------------------------------------
const testFiles = walk(join(ROOT, 'tests'), /\.(ts|tsx)$/);
const imported = new Set();
for (const file of testFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const base = resolve(join(file, '..'), spec);
    for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        imported.add(rel(candidate));
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const missing = [];
const staleExemptions = [];

let watched = 0;
for (const dir of WATCHED) {
  for (const file of walk(join(ROOT, dir), /\.ts$/)) {
    const name = rel(file);
    // A module with nothing exported is a private helper, not a surface.
    if (!/^export\s/m.test(readFileSync(file, 'utf8'))) continue;
    watched += 1;
    if (imported.has(name)) {
      if (UNREACHABLE.has(name)) staleExemptions.push(name);
      continue;
    }
    if (UNREACHABLE.has(name)) continue;
    missing.push(name);
  }
}

for (const name of UNREACHABLE.keys()) {
  if (!existsSync(join(ROOT, name))) staleExemptions.push(`${name} (file is gone)`);
}

const covered = watched - missing.length - UNREACHABLE.size;
console.log(
  `check:tests - ${covered}/${watched} shared modules reached by a test, ${UNREACHABLE.size} exempt.`
);

if (!missing.length && !staleExemptions.length) {
  console.log('check:tests - all clear.');
  process.exit(0);
}

if (missing.length) {
  console.log(`\n=== Shared module with no test (${missing.length}) ===`);
  for (const name of missing) {
    console.log(`  ${name}`);
  }
  console.log(
    '\n  Add a test under tests/unit/ that imports it. If it genuinely cannot be\n' +
    '  reached from a unit test, add it to UNREACHABLE in scripts/check-tests.mjs\n' +
    '  with the structural reason why.'
  );
}

if (staleExemptions.length) {
  console.log(`\n=== Exemption no longer needed (${staleExemptions.length}) ===`);
  for (const name of staleExemptions) {
    console.log(`  ${name}`);
  }
  console.log('\n  Remove it from UNREACHABLE in scripts/check-tests.mjs.');
}

console.log(`\ncheck:tests failed - ${missing.length + staleExemptions.length} problem(s).`);
process.exit(1);
