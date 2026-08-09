import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Both scans below read the syntax tree rather than the text. A regex over the
 * source counts prose: webview-preload carries a comment about the
 * `require('./utils/webview.cjs')` that once broke it, and a text scan reports
 * that sentence as the very thing it is warning about.
 */
function callsIn(file: string, callee: string) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const out: string[][] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === callee) {
      const args = node.arguments.map((a) => (ts.isStringLiteral(a) ? a.text : a.getText(sf)));
      out.push(args);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const electron = join(repoRoot, 'electron');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.cjs') ? [full] : [];
  });
}

const files = walk(electron);
const rel = (f: string) => relative(repoRoot, f).replace(/\\/g, '/');

/**
 * Paths the main process builds at runtime, and the rule that keeps preloads
 * loadable.
 *
 * `require()` is checked by every test that loads a module; `path.join(__dirname,
 * 'preloads', 'webview-preload.cjs')` is checked by nobody. Electron resolves it
 * when it attaches the preload, and a wrong one does not throw - the preload
 * simply never loads, and every site silently loses `window.lumen`. That has
 * happened here before. Moving these files into preloads/ is exactly the kind of
 * change that would do it again.
 */

describe('paths built with __dirname', () => {
  // path.join(__dirname, 'a', 'b.cjs') - the literal form, which is all the main
  // process uses to reach a file it must attach at runtime.
  const found: { file: string; parts: string[] }[] = [];
  for (const file of files) {
    for (const args of callsIn(file, 'path.join')) {
      if (args[0] !== '__dirname') continue;
      const parts = args.slice(1);
      if (parts.length && parts.every((p) => !p.includes('('))) found.push({ file, parts });
    }
  }

  it('finds the ones the app depends on', () => {
    // A guard on the guard: if this drops to zero because the shape changed,
    // the assertions below would pass while checking nothing.
    expect(found.length).toBeGreaterThanOrEqual(5);
  });

  it('every one of them points at something that exists', () => {
    const broken = found
      .map(({ file, parts }) => ({ file, parts, target: join(dirname(file), ...parts) }))
      .filter(({ target }) => !existsSync(target))
      // package.json lookups walk a list of candidates on purpose, and are
      // allowed to miss - see utils/app_version.cjs.
      .filter(({ parts }) => !parts[parts.length - 1].endsWith('package.json'));

    expect(
      broken.map((b) => `${rel(b.file)} -> ${b.parts.join('/')}`),
      'a path built at runtime points nowhere'
    ).toEqual([]);
  });

  it('still attaches all four preloads', () => {
    // Named individually: a preload that stops being referenced at all is as
    // broken as one pointing at the wrong file, and an existence check alone
    // would not notice.
    const attached = found
      .map(({ parts }) => parts[parts.length - 1])
      .filter((p) => p.includes('preload'));

    expect(new Set(attached)).toEqual(
      new Set(['preload.cjs', 'webview-preload.cjs', 'extension-preload.cjs', 'store-preload.cjs'])
    );
  });
});

describe('the preloads folder', () => {
  const preloads = walk(join(electron, 'preloads'));

  it('holds the four of them and nothing else', () => {
    expect(preloads.map((f) => f.split(/[\\/]/).pop()).sort()).toEqual([
      'extension-preload.cjs',
      'preload.cjs',
      'store-preload.cjs',
      'webview-preload.cjs'
    ]);
  });

  it('never requires a local file, which is why they are one big file each', () => {
    // A sandboxed preload can only require a small built-in allowlist. Pointing
    // one at a local module stops it loading entirely, in silence - the reason
    // safeString exists four times over instead of being shared.
    const offenders: string[] = [];
    for (const file of preloads) {
      for (const [first] of callsIn(file, 'require')) {
        if (typeof first === 'string' && first.startsWith('.')) {
          offenders.push(`${rel(file)} requires ${first}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
