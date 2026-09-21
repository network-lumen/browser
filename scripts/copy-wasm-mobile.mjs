// Puts the SDK's Dilithium WASM where the mobile build can fetch it.
//
// On the desktop the SDK reads it off disk from inside node_modules, in the
// main process. The mobile target runs the same SDK in a WebView, where there
// is no filesystem - platform/mobile/shims/node.ts fetches it over HTTP
// instead, and this is what makes that URL resolve.
//
// It is copied rather than imported so that nothing but the mobile build pays
// for it: `@lumen-chain/sdk` publishes only ".", so the file cannot be reached
// with Vite's `?url` and would otherwise have to be committed to public/, where
// the desktop build would bundle 2.8MB it never loads.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@lumen-chain', 'sdk', 'dist', 'dilithium3.wasm');
const target = join(root, 'dist-mobile', 'dilithium3.wasm');

if (!existsSync(source)) {
  console.error(`copy-wasm-mobile: ${source} not found - is @lumen-chain/sdk installed?`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('copy-wasm-mobile - dilithium3.wasm copied into dist-mobile/');
