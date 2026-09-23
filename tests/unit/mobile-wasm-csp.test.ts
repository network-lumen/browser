// @vitest-environment node
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

/**
 * The CSP exception WebAssembly needs on mobile.
 *
 * `index.html` is shared by both targets and ships `script-src 'self'`, which
 * blocks WebAssembly outright - "compiling or instantiating WebAssembly module
 * violates the following Content Security Policy directive". On mobile the
 * Dilithium WASM is instantiated in the renderer, so that refusal costs every
 * post-quantum signature, and with it every transaction the app can send.
 *
 * Two things are worth pinning: that the mobile build grants the exception,
 * and that the desktop build does not. The desktop runs the SDK in the main
 * process and has no WASM to compile, so widening its policy would buy
 * nothing.
 */
function resolveConfig(mode: string): any {
  return (config as any)({ mode, command: 'build' });
}

function transform(mode: string, html: string): string {
  const plugin = resolveConfig(mode).plugins.find(
    (p: any) => p?.name === 'lumen-mobile-wasm-csp'
  );
  expect(plugin, 'the CSP plugin is registered').toBeTruthy();
  return plugin.transformIndexHtml(html);
}

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; object-src 'none';" />`;

describe('WebAssembly under the app CSP', () => {
  it('grants the mobile build its exception', () => {
    expect(transform('mobile', CSP)).toContain(`script-src 'self' 'wasm-unsafe-eval'`);
  });

  it('grants it and nothing else - eval stays refused', () => {
    const out = transform('mobile', CSP);
    // `'unsafe-eval'` is what the browser's error message names, and it would
    // also open `eval()` and `new Function()`. `'wasm-unsafe-eval'` exists so
    // that WebAssembly can be allowed without them - the quote in front is
    // what tells the two apart.
    expect(out).not.toContain(`'unsafe-eval'`);
    expect(out).toContain(`object-src 'none'`);
  });

  it('leaves the desktop policy exactly as it was', () => {
    expect(transform('desktop', CSP)).toBe(CSP);
  });

  /**
   * A reworded CSP must stop the build, not ship a wallet that cannot sign.
   * The failure would otherwise only appear on a device, as a WASM error with
   * nothing pointing back at the rename that caused it.
   */
  it('refuses to build when index.html no longer says what it patches', () => {
    expect(() => transform('mobile', `<meta content="script-src-elem 'self';" />`)).toThrow(
      /not found in index\.html/
    );
  });

  it('is the real policy it patches, not one this test invented', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toContain(`script-src 'self'`);
    expect(transform('mobile', html)).toContain(`script-src 'self' 'wasm-unsafe-eval'`);
  });
});
