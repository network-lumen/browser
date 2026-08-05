import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES
} from '../../src/internal/common/lumenBridgeSurface';

/**
 * `lumenBridgeSurface.ts` hand-lists the preload surface. This re-derives that
 * surface from `electron/preload.cjs` and fails when the two drift, so a method
 * added or removed there is caught in CI instead of at a user's startup.
 *
 * Two things now rest on that list, not one: `fatal_errors.ts` checks the live
 * bridge against it at startup, and `src/types/lumenBridge.ts` derives the TYPE
 * of `useInternalLumen()` from it. So this test also keeps the compiler's idea
 * of the bridge honest.
 */

const repoRoot = path.resolve(__dirname, '../..');

function readLumenBridge(): string {
  const src = fs.readFileSync(path.join(repoRoot, 'electron/preload.cjs'), 'utf8');
  // Only the `lumen` bridge; the `electronAPI` block below it is a legacy alias.
  const start = src.indexOf("exposeInMainWorld('lumen'");
  const end = src.indexOf("exposeInMainWorld('electronAPI'");
  expect(start, 'lumen bridge not found in preload.cjs').toBeGreaterThan(-1);
  return end > start ? src.slice(start, end) : src.slice(start);
}

function parseBridge() {
  const functions: string[] = [];
  const values: string[] = [];
  const namespaces: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of readLumenBridge().split(/\r?\n/)) {
    const top = line.match(/^ {2}([a-zA-Z_$][\w$]*)\s*:\s*(.*)$/);
    if (top) {
      const [, name, rest] = top;
      current = null;
      if (/^\{\s*$/.test(rest!)) {
        current = name!;
        namespaces[name!] = [];
      } else if (/^\(\(/.test(rest!) || !/^(\(|async\b|function\b)/.test(rest!)) {
        values.push(name!);
      } else {
        functions.push(name!);
      }
      continue;
    }
    const nested = line.match(/^ {4}([a-zA-Z_$][\w$]*)\s*:\s*(.*)$/);
    if (nested && current) {
      namespaces[current]!.push(nested[1]!);
      continue;
    }
    if (/^ {2}\},?\s*$/.test(line)) current = null;
  }

  return { functions, values, namespaces };
}

describe('fatal_errors preload coverage', () => {
  const bridge = parseBridge();

  it('guards every top-level function the preload exposes', () => {
    expect([...REQUIRED_FUNCTIONS].sort()).toEqual([...bridge.functions].sort());
  });

  it('guards every top-level value the preload exposes', () => {
    expect([...REQUIRED_VALUES].sort()).toEqual([...bridge.values].sort());
  });

  it('guards every namespace the preload exposes', () => {
    expect(Object.keys(REQUIRED_NAMESPACES).sort()).toEqual(Object.keys(bridge.namespaces).sort());
  });

  it('guards every member of every namespace', () => {
    for (const [namespace, members] of Object.entries(bridge.namespaces)) {
      expect(
        [...(REQUIRED_NAMESPACES[namespace] ?? [])].sort(),
        `members of window.lumen.${namespace}`
      ).toEqual([...members].sort());
    }
  });

  it('checks a surface far wider than a handful of entries', () => {
    const total =
      REQUIRED_FUNCTIONS.length +
      REQUIRED_VALUES.length +
      Object.values(REQUIRED_NAMESPACES).reduce((n, m) => n + m.length, 0);
    expect(total).toBeGreaterThan(150);
  });
});
