const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_NAME = 'lumen';
const BOOTSTRAP_CONFIG_FILENAME = 'bootstrap-paths.json';

function stripTrailingSeparators(inputPath) {
  const normalized = path.normalize(String(inputPath || '').trim());
  const root = path.parse(normalized).root;
  if (!normalized || normalized === root) return normalized;
  return normalized.replace(/[\\/]+$/, '');
}

function getDefaultUserDataPath() {
  return stripTrailingSeparators(path.join(app.getPath('appData'), APP_NAME));
}

function getBootstrapConfigPath() {
  return path.join(getDefaultUserDataPath(), BOOTSTRAP_CONFIG_FILENAME);
}

function normalizeCustomUserDataPath(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const resolved = path.resolve(raw);
  if (!path.isAbsolute(resolved)) return '';
  return stripTrailingSeparators(resolved);
}

function loadBootstrapConfig() {
  const fp = getBootstrapConfigPath();
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistBootstrapConfig(next) {
  const fp = getBootstrapConfigPath();
  const data = next && typeof next === 'object' ? next : {};
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    if (!Object.keys(data).length) {
      try {
        fs.unlinkSync(fp);
      } catch {}
      return { ok: true };
    }
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e || 'persist_failed') };
  }
  return { ok: true };
}

/**
 * A profile directory chosen from outside the app, for the run only.
 *
 * The same choice the Settings page already offers, reachable before the app
 * has a window: "start Lumen on an empty profile" is the first question support
 * asks when one looks corrupt, and it is the only way an end-to-end test can
 * launch the real app without reading and writing the user's own wallet.
 *
 * It is not persisted. Nothing here writes it to bootstrap-paths.json, so the
 * configured path is untouched and the next normal launch is unaffected.
 */
function getEnvUserDataPath() {
  const raw = String(process.env.LUMEN_USER_DATA_DIR ?? '').trim();
  // Absolute only. normalizeCustomUserDataPath would resolve a relative value
  // against the working directory, so the same command run from two places
  // would open two different wallets.
  if (!raw || !path.isAbsolute(raw)) return '';
  return normalizeCustomUserDataPath(raw);
}

function getBootstrapPathState() {
  const defaultUserDataPath = getDefaultUserDataPath();
  const disk = loadBootstrapConfig();
  let customUserDataPath = normalizeCustomUserDataPath(disk.customUserDataPath);
  if (customUserDataPath && customUserDataPath === defaultUserDataPath) {
    customUserDataPath = '';
  }
  const envUserDataPath = getEnvUserDataPath();
  return {
    bootstrapConfigPath: getBootstrapConfigPath(),
    defaultUserDataPath,
    customUserDataPath,
    envUserDataPath,
    usingCustomUserDataPath: !!customUserDataPath,
    // The environment wins over the configured path, which wins over the
    // default. Reported separately above so the Settings page can say which
    // one is in force rather than showing a path the user cannot change.
    usingEnvUserDataPath: !!envUserDataPath,
    effectiveUserDataPath: envUserDataPath || customUserDataPath || defaultUserDataPath,
  };
}

function getBootstrapRuntimeState() {
  const state = getBootstrapPathState();
  let activeUserDataPath = '';
  let activeLogsPath = '';
  try {
    activeUserDataPath = stripTrailingSeparators(app.getPath('userData'));
  } catch {}
  try {
    activeLogsPath = stripTrailingSeparators(app.getPath('logs'));
  } catch {}
  return {
    ...state,
    activeUserDataPath: activeUserDataPath || state.effectiveUserDataPath,
    activeLogsPath,
    restartRequired: !!activeUserDataPath && activeUserDataPath !== state.effectiveUserDataPath,
  };
}

function ensureUsableDirectory(targetPath) {
  const normalized = normalizeCustomUserDataPath(targetPath);
  if (!normalized) {
    return { ok: false, error: 'invalid_path' };
  }
  try {
    fs.mkdirSync(normalized, { recursive: true });
    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) {
      return { ok: false, error: 'path_is_not_directory' };
    }
    fs.accessSync(normalized, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true, path: normalized };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message ? e.message : e || 'path_unavailable'),
    };
  }
}

function setCustomUserDataPath(nextPath) {
  // Refused rather than saved-and-ignored: with the environment in force the
  // saved path would not take effect, and the Settings page would report a move
  // that did not happen.
  if (getEnvUserDataPath()) {
    return { ok: false, error: 'user_data_path_pinned_by_env' };
  }

  const normalized = normalizeCustomUserDataPath(nextPath);
  if (!normalized) return { ok: false, error: 'invalid_custom_user_data_path' };

  const defaultUserDataPath = getDefaultUserDataPath();
  if (normalized === defaultUserDataPath) {
    return resetCustomUserDataPath();
  }

  const usability = ensureUsableDirectory(normalized);
  if (!usability.ok) {
    return { ok: false, error: usability.error || 'path_unavailable' };
  }

  const saved = persistBootstrapConfig({ customUserDataPath: usability.path });
  if (!saved.ok) return saved;
  return { ok: true, state: getBootstrapRuntimeState() };
}

function resetCustomUserDataPath() {
  if (getEnvUserDataPath()) {
    return { ok: false, error: 'user_data_path_pinned_by_env' };
  }
  const saved = persistBootstrapConfig({});
  if (!saved.ok) return saved;
  return { ok: true, state: getBootstrapRuntimeState() };
}

function resolveStartupUserDataPath() {
  const state = getBootstrapPathState();
  const usability = ensureUsableDirectory(state.effectiveUserDataPath);
  if (!usability.ok) {
    return {
      ok: false,
      error: usability.error || 'path_unavailable',
      state,
    };
  }
  return {
    ok: true,
    state: {
      ...state,
      effectiveUserDataPath: usability.path,
    },
  };
}

module.exports = {
  APP_NAME,
  getBootstrapConfigPath,
  getBootstrapRuntimeState,
  getBootstrapPathState,
  getDefaultUserDataPath,
  normalizeCustomUserDataPath,
  resolveStartupUserDataPath,
  resetCustomUserDataPath,
  setCustomUserDataPath,
};
