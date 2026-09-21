/**
 * Just enough of Node's `fs`, `path`, `os` and `url` for `@lumen-chain/sdk` to
 * load inside a WebView.
 *
 * The SDK is written for the main process, where those modules are real. On the
 * desktop that is exactly where it runs, so nothing ever noticed. The mobile
 * target imports it from the renderer, and the build stops on
 * `"readFile" is not exported by "__vite-browser-external"`.
 *
 * Only one call actually matters. The SDK loads the Dilithium WASM with:
 *
 *     const wasmPath = fileURLToPath(new URL("./dilithium3.wasm", import.meta.url));
 *     const wasmBytes = await promises.readFile(path.resolve(wasmPath));
 *
 * so the three functions in that chain are made to carry a URL through
 * unchanged and fetch it at the end. Everything else here exists to satisfy the
 * import and rejects rather than pretending: a wallet silently reading nothing
 * from a fake filesystem would be much worse than a clear failure.
 *
 * `scripts/copy-wasm-mobile.mjs` puts `dilithium3.wasm` where that fetch will
 * find it, and `vite.config.ts` points the aliases here for the mobile target
 * only - the desktop build never sees this file.
 */

const isWasmRequest = (target: string) =>
  target.endsWith('.wasm') || target.includes('dilithium3');

/** The app is served from the bundle root, so that is where the asset lands. */
const WASM_URL = '/dilithium3.wasm';

async function readFile(target: unknown, encoding?: unknown): Promise<Uint8Array | string> {
  const name = String(target ?? '');
  if (!isWasmRequest(name)) {
    throw new Error(`fs.readFile is not available on this target (${name})`);
  }

  const response = await fetch(WASM_URL);
  if (!response.ok) throw new Error(`failed to load ${WASM_URL}: ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  return encoding ? new TextDecoder().decode(bytes) : bytes;
}

const refuse = (name: string) => async () => {
  throw new Error(`fs.${name} is not available on this target`);
};

export const promises = { readFile, mkdir: refuse('mkdir'), writeFile: refuse('writeFile') };
export { readFile };
export const mkdir = refuse('mkdir');
export const writeFile = refuse('writeFile');

// `path`: the SDK only ever joins and resolves the WASM's own location, so
// carrying the string through untouched is both sufficient and honest.
export const resolve = (...parts: string[]) => parts[parts.length - 1] ?? '';
export const join = (...parts: string[]) => parts.filter(Boolean).join('/');
export const dirname = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/')));
export const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);

// `url`: keep the URL as-is rather than converting it to a filesystem path
// there is no equivalent of - readFile above expects to receive it.
export const fileURLToPath = (value: URL | string) => String(value);
export const pathToFileURL = (value: string) => value;

// `os`: present so the import resolves. Nothing in the signing path reads it.
export const tmpdir = () => '/tmp';
export const homedir = () => '/';
export const platform = () => 'android';

const nodeShim = {
  promises,
  readFile,
  mkdir,
  writeFile,
  resolve,
  join,
  dirname,
  basename,
  fileURLToPath,
  pathToFileURL,
  tmpdir,
  homedir,
  platform
};

// The SDK does `import path from 'path'` and `import os from 'os'`, so the
// default export has to carry the same members as the named ones.
export default nodeShim;
