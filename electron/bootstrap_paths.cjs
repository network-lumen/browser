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
      return;
    }
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e || 'persist_failed') };
  }
  return { ok: true };
}

function getBootstrapPathState() {
  const defaultUserDataPath = getDefaultUserDataPath();
  const disk = loadBootstrapConfig();
  let customUserDataPath = normalizeCustomUserDataPath(disk.customUserDataPath);
  if (customUserDataPath && customUserDataPath === defaultUserDataPath) {
    customUserDataPath = '';
  }
  return {
    bootstrapConfigPath: getBootstrapConfigPath(),
    defaultUserDataPath,
    customUserDataPath,
    usingCustomUserDataPath: !!customUserDataPath,
    effectiveUserDataPath: customUserDataPath || defaultUserDataPath,
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
