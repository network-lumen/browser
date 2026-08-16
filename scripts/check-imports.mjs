// Holds every package specifier in the main process to what its package
// actually publishes.
//
// Run via `npm run check:imports` (wired into `npm test`). Written after a
// routine dependency refresh silently disarmed every signed transaction in the
// app: cosmjs-types 0.11.0 added `"./*.js": null` to its exports map, which
// revokes the `.js` suffix the ten imports in ipc/wallet.cjs were written with.
// Nothing failed at install, at lint, at typecheck or in any test - the specifier
// is a string, resolved when the handler runs, so the first sign of it was a
// user hitting Delegate and getting `Package subpath './cosmos/staking/v1beta1/
// tx.js' is not defined by "exports"`. Sending tokens, IBC transfers, staking,
// rewards and governance votes were all broken the same way, for a week.
//
// The main process is plain Node, so Node's own resolver is the authority here -
// no reimplementation of the exports algorithm, just a question put to it.
//
// This checks resolvability, not correctness: a specifier that resolves can
// still export the wrong name. That part is the unit tests' job.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1');
const MAIN = join(ROOT, 'electron');

/** Every .cjs under electron/, which is all the main process is. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith('.cjs')) out.push(full);
  }
  return out;
}

/**
 * A bare specifier is one that names a package rather than a path. Node built-ins
 * are skipped: `node:stream/promises` has no package.json to disagree with.
 */
function isBarePackageSpecifier(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(spec)) return false;
  return !spec.startsWith('node:');
}

const specifiers = new Map();
for (const file of sourceFiles(MAIN)) {
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(/(?:require|import)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!isBarePackageSpecifier(m[1])) continue;
    if (!specifiers.has(m[1])) specifiers.set(m[1], relative(ROOT, file).replace(/\\/g, '/'));
  }
}

// `import.meta.resolve` answers with the `import` condition, which is the one
// that applies: every specifier here is reached through `require` or `import()`
// from inside the app, and a package offering only an ESM entry (the Lumen SDK)
// is legitimate. `require.resolve` would report that as broken.
const parent = pathToFileURL(join(MAIN, 'ipc', 'index.cjs')).href;
const broken = [];
for (const [spec, where] of [...specifiers].sort()) {
  try {
    import.meta.resolve(spec, parent);
  } catch (err) {
    broken.push({ spec, where, reason: String(err?.message || err).split('\n')[0] });
  }
}

if (!broken.length) {
  console.log(`check:imports - all clear (${specifiers.size} package specifier(s) resolve).`);
  process.exit(0);
}

console.log(`\n=== A package specifier its package does not publish (${broken.length}) ===`);
for (const b of broken) {
  console.log(`  ${b.spec}\n      in ${b.where}\n      → ${b.reason}`);
}
console.log(`\ncheck:imports failed - ${broken.length} unresolvable specifier(s).`);
process.exit(1);
