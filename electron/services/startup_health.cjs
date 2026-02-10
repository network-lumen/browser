const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const DEFAULT_CRASH_THRESHOLD = 3;

function currentCrashThreshold() {
  const n = Number(process.env.LUMEN_STARTUP_CRASH_THRESHOLD || DEFAULT_CRASH_THRESHOLD);
  if (!Number.isFinite(n)) return DEFAULT_CRASH_THRESHOLD;
  return Math.max(1, Math.min(10, Math.floor(n)));
}

function currentAppVersion() {
  try {
    const v = app && typeof app.getVersion === 'function' ? String(app.getVersion() || '').trim() : '';
    if (v) return v;
  } catch {}
  try {
    // electron/services -> electron -> app root
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const pkg = require('../../package.json');
    const pv = String(pkg && pkg.version ? pkg.version : '').trim();
    if (pv) return pv;
  } catch {}
  return '';
}

function safeString(v, maxLen = 128) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function getStatePath() {
  try {
    const base = app && typeof app.getPath === 'function' ? app.getPath('userData') : '';
    const dir = String(base || '').trim();
    if (dir) return path.join(dir, 'startup_health.json');
  } catch {}
  return path.join(process.cwd(), 'startup_health.json');
}

async function readState() {
  const filePath = getStatePath();
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object') throw new Error('invalid_state');
    if (Number(json.schemaVersion || 0) !== SCHEMA_VERSION) return null;
    return json;
  } catch {
    return null;
  }
}

async function writeState(next) {
  const filePath = getStatePath();
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  } catch {}

  const tmpPath = `${filePath}.tmp`;
  const data = JSON.stringify(next, null, 2);
  await fs.promises.writeFile(tmpPath, data, 'utf8');
  try {
    await fs.promises.unlink(filePath);
  } catch {}
  await fs.promises.rename(tmpPath, filePath);
}

function ensureVersionState(state, version) {
  const v = safeString(version, 64);
  if (!v) return null;
  if (!state.versions || typeof state.versions !== 'object') state.versions = {};
  if (!state.versions[v] || typeof state.versions[v] !== 'object') {
    state.versions[v] = { consecutiveCrashes: 0, unstable: false, unstableAt: null, lastCrashAt: null, lastSuccessAt: null };
  }
  return state.versions[v];
}

async function recordLaunchStart(versionInput) {
  const now = Date.now();
  const version = safeString(versionInput || currentAppVersion(), 64);
  if (!version) return { ok: false, error: 'missing_version' };

  const threshold = currentCrashThreshold();
  const state =
    (await readState()) || { schemaVersion: SCHEMA_VERSION, crashThreshold: threshold, lastLaunch: null, versions: {} };

  state.schemaVersion = SCHEMA_VERSION;
  state.crashThreshold = threshold;

  const prev = state.lastLaunch && typeof state.lastLaunch === 'object' ? state.lastLaunch : null;
  if (prev && prev.version && prev.success !== true && prev.endedGracefully !== true) {
    const pv = safeString(prev.version, 64);
    const vs = ensureVersionState(state, pv);
    if (vs) {
      const nextCount = Math.max(0, Number(vs.consecutiveCrashes || 0)) + 1;
      vs.consecutiveCrashes = nextCount;
      vs.lastCrashAt = now;
      if (nextCount >= threshold) {
        vs.unstable = true;
        vs.unstableAt = now;
      }
    }
  }

  state.lastLaunch = { version, startedAt: now, success: false, successAt: null, endedGracefully: false, endedAt: null };

  await writeState(state);

  const vs = ensureVersionState(state, version);
  return { ok: true, version, threshold, consecutiveCrashes: Number(vs?.consecutiveCrashes || 0), unstable: !!vs?.unstable };
}

async function markStartupSuccess(versionInput) {
  const now = Date.now();
  const version = safeString(versionInput || currentAppVersion(), 64);
  if (!version) return { ok: false, error: 'missing_version' };

  const threshold = currentCrashThreshold();
  const state =
    (await readState()) || { schemaVersion: SCHEMA_VERSION, crashThreshold: threshold, lastLaunch: null, versions: {} };

  state.schemaVersion = SCHEMA_VERSION;
  state.crashThreshold = threshold;

  if (state.lastLaunch && typeof state.lastLaunch === 'object' && safeString(state.lastLaunch.version, 64) === version) {
    state.lastLaunch.success = true;
    state.lastLaunch.successAt = now;
  }

  const vs = ensureVersionState(state, version);
  if (vs) {
    vs.consecutiveCrashes = 0;
    vs.unstable = false;
    vs.lastSuccessAt = now;
  }

  await writeState(state);
  return { ok: true };
}

async function markGracefulExit() {
  const now = Date.now();
  const threshold = currentCrashThreshold();
  const state =
    (await readState()) || { schemaVersion: SCHEMA_VERSION, crashThreshold: threshold, lastLaunch: null, versions: {} };

  state.schemaVersion = SCHEMA_VERSION;
  state.crashThreshold = threshold;

  if (state.lastLaunch && typeof state.lastLaunch === 'object' && state.lastLaunch.success !== true) {
    state.lastLaunch.endedGracefully = true;
    state.lastLaunch.endedAt = now;
  }

  await writeState(state);
  return { ok: true };
}

async function isVersionUnstable(versionInput) {
  const version = safeString(versionInput, 64);
  if (!version) return false;
  const state = await readState();
  const vs = state && state.versions && typeof state.versions === 'object' ? state.versions[version] : null;
  return !!(vs && vs.unstable);
}

module.exports = {
  currentAppVersion,
  recordLaunchStart,
  markStartupSuccess,
  markGracefulExit,
  isVersionUnstable
};

