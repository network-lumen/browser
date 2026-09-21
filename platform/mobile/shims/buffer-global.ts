/**
 * Installs `Buffer` as a global, for the mobile target only.
 *
 * `bip39` - which `@lumen-chain/sdk` uses to mint a mnemonic - calls
 * `Buffer.from(...)`, and so do parts of the SDK and of cosmjs: 36 call sites
 * end up in the mobile bundle. On the desktop they resolve to Node's global,
 * because that code runs in the main process. In a WebView there is no such
 * global and every one of them throws `Buffer is not defined` - which is what
 * turned wallet creation into "Wallet creation failed" with nothing useful
 * behind it.
 *
 * This is a side-effecting module on purpose, and `install.ts` imports it
 * first: ES modules evaluate a file's imports before its body, and `@platform`
 * is the first import in `src/main.ts`, so the assignment lands before any
 * other application module is evaluated.
 */

import { Buffer } from 'buffer';

const target = globalThis as unknown as Record<string, unknown>;

if (!target.Buffer) target.Buffer = Buffer;

// The `buffer` package and a few of its peers still reach for `global`, which
// is Node's name for what browsers call `globalThis`.
if (!target.global) target.global = globalThis;
