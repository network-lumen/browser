import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stubElectron } from './support/electronStub';

/**
 * Where the app keeps everything, decided before it has a window.
 *
 * Three sources, and the order between them is the whole point: an environment
 * override for this run, the path the user configured, then the default beside
 * the other app data. Getting the precedence wrong does not fail loudly - the
 * app simply opens the wrong profile, which for this app means the wrong wallet.
 */

const previous = process.env.LUMEN_USER_DATA_DIR;

afterEach(() => {
  if (previous === undefined) delete process.env.LUMEN_USER_DATA_DIR;
  else process.env.LUMEN_USER_DATA_DIR = previous;
});

const load = () => stubElectron().load<any>('bootstrap_paths.cjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'lumen-paths-'));

describe('choosing the profile directory', () => {
  it('defaults to the app data folder when nothing says otherwise', () => {
    delete process.env.LUMEN_USER_DATA_DIR;
    const state = load().getBootstrapPathState();
    expect(state.usingEnvUserDataPath).toBe(false);
    expect(state.effectiveUserDataPath).toBe(state.defaultUserDataPath);
  });

  it('takes the environment over everything else, for this run only', () => {
    const dir = tmp();
    process.env.LUMEN_USER_DATA_DIR = dir;
    const paths = load();

    const state = paths.getBootstrapPathState();
    expect(state.usingEnvUserDataPath).toBe(true);
    expect(state.envUserDataPath).toBe(dir);
    expect(state.effectiveUserDataPath).toBe(dir);
    expect(state.effectiveUserDataPath).not.toBe(state.defaultUserDataPath);
  });

  it('does not write the override anywhere', () => {
    // The next ordinary launch has to come back to the configured path. An
    // override that persisted itself would strand someone in a temp profile.
    const dir = tmp();
    process.env.LUMEN_USER_DATA_DIR = dir;
    const paths = load();
    paths.getBootstrapPathState();
    paths.resolveStartupUserDataPath();

    delete process.env.LUMEN_USER_DATA_DIR;
    const after = load().getBootstrapPathState();
    expect(after.effectiveUserDataPath).toBe(after.defaultUserDataPath);
    expect(after.customUserDataPath).toBe('');
  });

  it('creates the directory it was handed, so the app can start in it', () => {
    process.env.LUMEN_USER_DATA_DIR = join(tmp(), 'nested', 'profile');
    const res = load().resolveStartupUserDataPath();
    expect(res.ok).toBe(true);
    expect(res.state.effectiveUserDataPath).toContain('profile');
  });

  it('ignores a relative path rather than resolving it somewhere surprising', () => {
    process.env.LUMEN_USER_DATA_DIR = './somewhere';
    const state = load().getBootstrapPathState();
    // normalizeCustomUserDataPath resolves against cwd, which would depend on
    // how the app was launched; only an absolute path is honoured as given.
    expect(state.envUserDataPath).toBe('');
    expect(state.effectiveUserDataPath).toBe(state.defaultUserDataPath);
  });
});

describe('configuring the path while the environment pins it', () => {
  it('is refused, instead of saved and quietly ignored', () => {
    // Saving would report a move the running app did not make.
    process.env.LUMEN_USER_DATA_DIR = tmp();
    const paths = load();
    expect(paths.setCustomUserDataPath(tmp())).toMatchObject({
      ok: false,
      error: 'user_data_path_pinned_by_env'
    });
    expect(paths.resetCustomUserDataPath()).toMatchObject({
      ok: false,
      error: 'user_data_path_pinned_by_env'
    });
  });
});
