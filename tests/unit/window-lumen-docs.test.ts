import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
// @ts-ignore - .mjs, resolveJsonModule doesn't apply here
import { buildDocModel, jsonOutputPath } from '../../scripts/generate-window-lumen-doc.mjs';

/**
 * docs/window-lumen.json is a *generated* file (via `npm run doc:window.lumen`)
 * that is also committed to the repo, so it can drift from the source it was
 * generated from if someone edits electron/preloads/webview-preload.cjs's window.lumen
 * JSDoc without re-running the generator before committing. This test
 * re-parses the current source fresh and fails loudly if the committed JSON
 * doesn't match — the fix is always `npm run doc:window.lumen`.
 */
describe('docs/window-lumen.json freshness', () => {
  it('matches a fresh regeneration from electron/preloads/webview-preload.cjs', () => {
    const fresh = buildDocModel();
    const committedRaw = fs.readFileSync(jsonOutputPath, 'utf8');
    const committed = JSON.parse(committedRaw);

    // generatedAt is expected to differ (it's a timestamp) — everything else
    // must be byte-for-byte identical.
    const normalize = (model: any) => {
      const { generatedAt: _generatedAt, ...rest } = model;
      return rest;
    };

    expect(normalize(committed)).toEqual(normalize(fresh));
  });

  it('was generated with the current package.json version', () => {
    const fresh = buildDocModel();
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
    );
    expect(fresh.appVersion).toBe(pkg.version);
  });

  it('is valid JSON on disk with no trailing corruption', () => {
    expect(() => JSON.parse(fs.readFileSync(jsonOutputPath, 'utf8'))).not.toThrow();
  });
});
