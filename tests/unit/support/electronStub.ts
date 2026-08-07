import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Lets a main-process module be required from a test.
 *
 * Most of `electron/` reaches `app.getPath('userData')` sooner or later, by
 * way of `utils/fs.cjs`, and `require('electron')` outside a running Electron
 * process resolves to a package that exports a path string rather than an API.
 * Rather than threading a filesystem root through production code for the
 * tests' benefit, the stub is planted in the CommonJS module cache before the
 * module under test is loaded - so the module runs exactly as it ships.
 *
 * `userData` is a fresh temporary directory per call, so a test that writes
 * its JSON file to disk cannot be seen by the next one.
 */

const require_ = createRequire(import.meta.url);

export interface ElectronStub {
  /** The temporary directory standing in for the app's userData folder. */
  userData: string;
  /** Requires a module from `electron/`, e.g. `'site_data.cjs'`. */
  load: <T = any>(relativePath: string) => T;
}

export function stubElectron(overrides: Record<string, unknown> = {}): ElectronStub {
  const userData = mkdtempSync(join(tmpdir(), 'lumen-test-'));
  const id = require_.resolve('electron');

  const api = {
    app: {
      getPath: (name: string) => (name === 'userData' ? userData : userData),
      getAppPath: () => process.cwd(),
      isPackaged: false,
    },
    ipcMain: { handle: () => {}, on: () => {}, removeHandler: () => {} },
    ...overrides,
  };

  require_.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: api,
  } as NodeJS.Module;

  return {
    userData,
    load: <T,>(relativePath: string): T => {
      const target = require_.resolve(`../../../electron/${relativePath}`);
      // Drop the module and anything it pulled in from electron/, so each
      // test gets a module with its own module-level cache.
      for (const key of Object.keys(require_.cache)) {
        if (key.replace(/\\/g, '/').includes('/electron/')) delete require_.cache[key];
      }
      require_.cache[id] = { id, filename: id, loaded: true, exports: api } as NodeJS.Module;
      return require_(target) as T;
    },
  };
}
