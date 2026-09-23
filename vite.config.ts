import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Test config lives in vitest.config.ts, not here - see the comment in that
// file for why the two cannot share one config under vitest 1.x + Vite 6.

/**
 * Build target, `desktop` unless asked for otherwise with `--mode mobile`
 * (`npm run build:mobile`). `LUMEN_TARGET=mobile` does the same thing, for
 * callers that have an env var to hand but no argv - CI, mostly.
 *
 * Vite's own `--mode` is used rather than an env var on the command line
 * because the repo has no cross-env and `FOO=bar cmd` is not a thing in
 * PowerShell, so an env-first design would have been Unix-only in practice.
 *
 * The renderer in `src/` is identical on both targets. All that changes is
 * which module `@platform` resolves to - the one that puts `window.lumen` in
 * place, see platform/README.md - and where the bundle lands, so a mobile
 * build never overwrites the `dist/` that electron-builder packages.
 */
export default defineConfig(({ mode }) => {
  const isMobile = mode === 'mobile' || process.env.LUMEN_TARGET === 'mobile';

  const platformEntry = isMobile
    ? './platform/mobile/install.ts'
    : './platform/desktop/install.ts';

  const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

  /**
   * `@lumen-chain/sdk` is written for the main process: it reaches for fs, path,
   * os and url to load its Dilithium WASM. The desktop build never noticed,
   * because that is where it runs. The mobile target imports the same SDK from
   * the renderer, so those four are pointed at a shim that carries the WASM's
   * URL through and fetches it - see platform/mobile/shims/node.ts.
   *
   * Mobile only. The desktop keeps the real modules.
   */
  const nodeShim = resolvePath('./platform/mobile/shims/node.ts');

  /**
   * Lets the renderer instantiate the Dilithium WASM, on mobile only.
   *
   * `index.html` ships `script-src 'self'`, and that blocks WebAssembly
   * outright: "compiling or instantiating WebAssembly module violates the
   * following Content Security Policy directive". Without this, every
   * post-quantum signature fails, which on mobile means no transaction at all.
   *
   * `'wasm-unsafe-eval'` exists for exactly this and nothing else - it permits
   * WebAssembly compilation while `eval()` and `new Function()` stay refused,
   * so it is a far narrower hole than the `'unsafe-eval'` the error message
   * names. The desktop keeps the stricter policy untouched: there the SDK runs
   * in the main process, and its renderer has no WASM to compile.
   *
   * Rewritten at build time rather than written into `index.html`, so the one
   * file both targets share keeps the tightest policy either of them can run
   * with.
   */
  const CSP_SCRIPT_SRC = "script-src 'self'";
  const mobileWasmCsp = {
    name: 'lumen-mobile-wasm-csp',
    transformIndexHtml(html: string) {
      if (!isMobile) return html;
      if (!html.includes(CSP_SCRIPT_SRC)) {
        // Silence here would ship an app whose wallet cannot sign, and the
        // failure would only surface on a device.
        throw new Error(
          `vite.config.ts: "${CSP_SCRIPT_SRC}" not found in index.html - ` +
            'the mobile build cannot grant WebAssembly its CSP exception.'
        );
      }
      return html.replace(CSP_SCRIPT_SRC, `${CSP_SCRIPT_SRC} 'wasm-unsafe-eval'`);
    }
  };

  // Exact patterns, not bare strings: an object alias matches by PREFIX, so a
  // `fs` key also swallows `fs/promises` and rewrites it to <shim>/promises.
  const nodeShims = isMobile
    ? [
        { find: /^fs$/, replacement: nodeShim },
        { find: /^fs\/promises$/, replacement: nodeShim },
        { find: /^path$/, replacement: nodeShim },
        { find: /^os$/, replacement: nodeShim },
        { find: /^url$/, replacement: nodeShim }
      ]
    : [];

  return {
    base: './',
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'webview'
          }
        }
      }),
      mobileWasmCsp
    ],
    root: '.',
    resolve: {
      alias: [{ find: /^@platform$/, replacement: resolvePath(platformEntry) }, ...nodeShims]
    },
    server: {
      port: 5173,
      host: '127.0.0.1'
    },
    build: {
      outDir: isMobile ? 'dist-mobile' : 'dist',
      emptyOutDir: true
    }
  };
});
