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
  // The main process has shared logic too, and for a long time none of it was
  // watched: the rule guaranteed a renderer service was reachable from a test
  // while 10 000 lines holding the keys answered to nobody.
  //
  // These four are the equivalent tier - helpers and domain logic the IPC layer
  // calls into. `ipc/`, `extensions/`, `gateways/`, `services/` and `workers/`
  // are deliberately still out: covering them is real work (release_installer
  // alone is 700 lines), and listing them here today would mean a dozen
  // exemptions, which is the backlog this rule exists to prevent. That work is
  // named in ARCHITECTURE.md under "What has no tests at all".
  'electron/utils',
  'electron/sites',
  'electron/chain',
  'electron/daemons',
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
    'Reads page titles from the route table, which imports every page - and the unit tests run without a Vue plugin, so the first .vue file in that chain fails to parse before the test runs. The read side of the same concern lives in tabPosition.ts, which is dependency-free and is tested.',
  ],
  [
    'src/composables/useTabLoading.ts',
    'Nothing but Vue lifecycle: it injects the tab callback, then wires watch/onActivated/onDeactivated/onBeforeUnmount to it. Outside a component there is no lifecycle to attach to and nothing left to assert - what it decides is when to fire, which is the component the tab renders.',
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
  // `import(...)` as well as `from '...'`. A store that reads localStorage as it
  // loads can only be tested by re-importing it after seeding, so its tests are
  // all dynamic - and counting only static imports declared three of them
  // untested while their test files sat right there.
  const specifiers = [
    ...[...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  for (const spec of specifiers) {
    if (!spec.startsWith('.')) continue;
    const base = resolve(join(file, '..'), spec);
    for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        imported.add(rel(candidate));
        break;
      }
    }
  }

  // A main-process module is reached two ways, and neither is an import: by
  // name through tests/unit/support/electronStub.ts (`load('utils/crypto.cjs')`)
  // or by `require_('../../electron/utils/strings.cjs')`. The quoted path is
  // the only trace either leaves, so try it both relative to the test and
  // relative to electron/.
  for (const m of src.matchAll(/['"]([\w./-]+\.cjs)['"]/g)) {
    for (const candidate of [resolve(join(file, '..'), m[1]), join(ROOT, 'electron', m[1])]) {
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
  for (const file of walk(join(ROOT, dir), /\.(ts|cjs)$/)) {
    const name = rel(file);
    // A module with nothing exported is a private helper, not a surface.
    // `module.exports` counts as well as `export`: the main process is
    // CommonJS, and testing only for the ESM spelling silently skipped every
    // .cjs file the moment electron/ was added to the list above.
    const text = readFileSync(file, 'utf8');
    if (!/^export\s/m.test(text) && !/\bmodule\.exports\b/.test(text)) continue;
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
