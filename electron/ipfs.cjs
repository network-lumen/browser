const { app } = require('electron');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { recordCidResolutionFailure, recordCidResolutionSuccess } = require('./ipfs_seed.cjs');
const { getSetting } = require('./settings.cjs');

let ipfsProcess = null;
const PUBLIC_IPFS_GATEWAYS_SOURCE_URL =
  'https://raw.githubusercontent.com/ipfs/public-gateway-checker/main/gateways.json';
let publicIpfsGatewaysCache = {
  sourceUrl: PUBLIC_IPFS_GATEWAYS_SOURCE_URL,
  fetchedAt: 0,
  gateways: [],
};
let publicIpfsGatewaysInFlight = null;
const PUBLIC_IPFS_GATEWAY_PROBE_PATH =
  '/ipfs/bafybeifx7yeb55armcsxwwitkymga5xf53dxiarykms3ygqic223w5sk3m';
const PUBLIC_IPFS_GATEWAY_OFFLINE_TTL_MS = 60 * 60 * 1000;
const publicIpfsGatewayOfflineUntil = new Map();
const BYTES_PER_GIB = 1024 * 1024 * 1024;
const DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB = 10;
const DEFAULT_IPFS_CONNECTIVITY_MODE = 'normal';
const DEFAULT_IPFS_PIN_ADD_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const DEFAULT_IPFS_PIN_RETRY_BASE_MS = 5_000;
const DEFAULT_IPFS_PIN_MAX_RETRIES = 8;
const IPFS_PIN_JOBS_FILE = 'ipfs_pin_jobs.json';
const IPFS_CONNECTIVITY_PROFILES = Object.freeze({
  light: {
    lowWater: 12,
    highWater: 24,
    gracePeriod: '20s',
    silencePeriod: '10s',
  },
  normal: {
    // Kubo implicit defaults, made explicit so the app owns the behavior.
    lowWater: 32,
    highWater: 96,
    gracePeriod: '20s',
    silencePeriod: '10s',
  },
  high: {
    lowWater: 64,
    highWater: 192,
    gracePeriod: '20s',
    silencePeriod: '10s',
  },
});

function ipfsApiBase() {
  return String(getSetting('ipfsApiBase') || 'http://127.0.0.1:5001').replace(/\/+$/, '');
}

function localGatewayBase() {
  const setting = getSetting('localGatewayBase');
  const defaultValue = 'http://127.0.0.1:8088';
  const result = String(setting || defaultValue).replace(/\/+$/, '');
  console.log('[electron][ipfs] localGatewayBase - setting:', setting, 'default:', defaultValue, 'result:', result);
  return result;
}

function localDriveMaxUploadSizeGb() {
  const n = Number(getSetting('localDriveMaxUploadSizeGb'));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return DEFAULT_LOCAL_DRIVE_MAX_UPLOAD_SIZE_GB;
  }
  return n;
}

function localDriveMaxUploadBytes() {
  return localDriveMaxUploadSizeGb() * BYTES_PER_GIB;
}

function getHttpModuleForUrl(urlObj) {
  return urlObj.protocol === 'https:' ? https : http;
}

async function requestTextViaNodeHttp(urlString, { method = 'GET', headers = {}, body = null, timeoutMs = 30_000 } = {}) {
  const urlObj = new URL(String(urlString || '').trim());
  const transport = getHttpModuleForUrl(urlObj);
  const effectiveTimeoutMs = clampTimeoutMs(timeoutMs, 30_000, DEFAULT_IPFS_PIN_ADD_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    const req = transport.request(
      urlObj,
      {
        method,
        headers
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: Buffer.concat(chunks).toString('utf8')
          });
        });
        res.on('error', reject);
      }
    );

    req.setTimeout(effectiveTimeoutMs, () => {
      req.destroy(new Error(`ipfs_request_timeout_${effectiveTimeoutMs}ms`));
    });
    req.on('error', reject);

    if (body != null) req.write(body);
    req.end();
  });
}

const pinJobEmitter = new EventEmitter();
const pinJobs = new Map(); // jobId -> persisted snapshot
const activePinJobProcesses = new Map(); // jobId -> runtime
let pinJobsLoaded = false;
let pinJobsResumeScheduled = false;
let pinJobsPersistTimer = null;

function getPinJobsFilePath() {
  return path.join(app.getPath('userData'), IPFS_PIN_JOBS_FILE);
}

function sanitizePinJobName(input) {
  return String(input || '').trim().replace(/\s+/g, ' ').slice(0, 256);
}

function isFinalPinJobStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled';
}

function snapshotPinJob(job) {
  if (!job || typeof job !== 'object') return null;
  return {
    id: String(job.id || ''),
    target: String(job.target || ''),
    name: String(job.name || ''),
    status: String(job.status || ''),
    progressText: String(job.progressText || ''),
    progressCurrent:
      Number.isFinite(Number(job.progressCurrent)) && Number(job.progressCurrent) >= 0
        ? Number(job.progressCurrent)
        : null,
    progressTotal:
      Number.isFinite(Number(job.progressTotal)) && Number(job.progressTotal) > 0
        ? Number(job.progressTotal)
        : null,
    progressPercent:
      Number.isFinite(Number(job.progressPercent)) && Number(job.progressPercent) >= 0
        ? Number(job.progressPercent)
        : null,
    progressUnit: String(job.progressUnit || ''),
    pinnedCid: String(job.pinnedCid || ''),
    error: String(job.error || ''),
    retryCount: Number(job.retryCount || 0),
    nextRetryAt:
      Number.isFinite(Number(job.nextRetryAt)) && Number(job.nextRetryAt) > 0
        ? Number(job.nextRetryAt)
        : 0,
    createdAt: Number(job.createdAt || 0) || Date.now(),
    updatedAt: Number(job.updatedAt || 0) || Date.now(),
    startedAt: Number(job.startedAt || 0) || 0,
    completedAt: Number(job.completedAt || 0) || 0
  };
}

function persistPinJobsNow() {
  try {
    const jobs = Array.from(pinJobs.values())
      .map((job) => snapshotPinJob(job))
      .filter(Boolean)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    const finalJobs = jobs.filter((job) => isFinalPinJobStatus(job.status));
    const nonFinalJobs = jobs.filter((job) => !isFinalPinJobStatus(job.status));
    const pruned = [...nonFinalJobs, ...finalJobs.slice(0, 50)];
    fs.writeFileSync(getPinJobsFilePath(), JSON.stringify({ version: 1, jobs: pruned }, null, 2), 'utf8');
  } catch (e) {
    console.warn('[electron][ipfs] persist pin jobs failed:', String(e?.message || e));
  }
}

function schedulePersistPinJobs(immediate = false) {
  if (immediate) {
    if (pinJobsPersistTimer) {
      try {
        clearTimeout(pinJobsPersistTimer);
      } catch {}
      pinJobsPersistTimer = null;
    }
    persistPinJobsNow();
    return;
  }
  if (pinJobsPersistTimer) return;
  pinJobsPersistTimer = setTimeout(() => {
    pinJobsPersistTimer = null;
    persistPinJobsNow();
  }, 250);
}

function loadPersistedPinJobs() {
  if (pinJobsLoaded) return;
  pinJobsLoaded = true;
  try {
    const filePath = getPinJobsFilePath();
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    for (const entry of jobs) {
      const snapshot = snapshotPinJob(entry);
      if (!snapshot?.id || !snapshot?.target) continue;
      pinJobs.set(snapshot.id, snapshot);
    }
  } catch (e) {
    console.warn('[electron][ipfs] load pin jobs failed:', String(e?.message || e));
  }
}

function emitPinJobUpdate(job, reason = 'update') {
  if (!job || !job.id) return;
  job.updatedAt = Date.now();
  const snapshot = snapshotPinJob(job);
  if (!snapshot) return;
  pinJobs.set(snapshot.id, snapshot);
  schedulePersistPinJobs(isFinalPinJobStatus(snapshot.status));
  try {
    pinJobEmitter.emit('update', { reason: String(reason || 'update'), job: snapshot });
  } catch {}
}

function addPinJobListener(listener) {
  if (typeof listener !== 'function') return () => {};
  pinJobEmitter.on('update', listener);
  return () => {
    try {
      pinJobEmitter.off('update', listener);
    } catch {}
  };
}

function getOrCreatePinJobRuntime(jobId) {
  const key = String(jobId || '').trim();
  if (!key) return null;
  let runtime = activePinJobProcesses.get(key) || null;
  if (!runtime) {
    runtime = {
      child: null,
      stdoutBuffer: '',
      stderrBuffer: '',
      retryTimer: null,
      pauseRequested: false,
      cancelRequested: false
    };
    activePinJobProcesses.set(key, runtime);
  }
  return runtime;
}

function clearPinJobRetryTimer(jobId) {
  const runtime = getOrCreatePinJobRuntime(jobId);
  if (!runtime?.retryTimer) return;
  try {
    clearTimeout(runtime.retryTimer);
  } catch {}
  runtime.retryTimer = null;
}

function destroyPinJobRuntime(jobId) {
  const runtime = activePinJobProcesses.get(String(jobId || '').trim()) || null;
  if (!runtime) return;
  clearPinJobRetryTimer(jobId);
  activePinJobProcesses.delete(String(jobId || '').trim());
}

function normalizePinJobError(input) {
  return String(input?.message || input || 'pin_failed').trim() || 'pin_failed';
}

function isRetryablePinError(input) {
  const msg = normalizePinJobError(input).toLowerCase();
  if (!msg) return false;
  if (
    msg.includes('empty cid or path') ||
    msg.includes('cid/path too long') ||
    msg.includes('invalid cid') ||
    msg.includes('invalid path') ||
    msg.includes('unknown option') ||
    msg.includes('is already pinned recursively')
  ) {
    return false;
  }
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('connection refused') ||
    msg.includes('connection reset') ||
    msg.includes('headers timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('context deadline exceeded') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('no route to host') ||
    msg.includes('network is unreachable') ||
    msg.includes('stream reset') ||
    msg.includes('eof') ||
    msg.includes('no provider') ||
    msg.includes('routing') ||
    msg.includes('api endpoint') ||
    msg.includes('daemon')
  );
}

function parsePinProgressLine(job, line) {
  const raw = String(line || '').trim();
  if (!raw) return false;

  let changed = false;
  if (job.progressText !== raw) {
    job.progressText = raw;
    changed = true;
  }

  const pairMatch = raw.match(/(\d+)\s*\/\s*(\d+)\s+(nodes?|blocks?)/i);
  if (pairMatch) {
    const current = Number(pairMatch[1]);
    const total = Number(pairMatch[2]);
    const unit = String(pairMatch[3] || '').trim().toLowerCase();
    if (Number.isFinite(current) && job.progressCurrent !== current) {
      job.progressCurrent = current;
      changed = true;
    }
    if (Number.isFinite(total) && total > 0 && job.progressTotal !== total) {
      job.progressTotal = total;
      changed = true;
    }
    if (unit && job.progressUnit !== unit) {
      job.progressUnit = unit;
      changed = true;
    }
    if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
      const percent = Math.max(0, Math.min(100, (current / total) * 100));
      if (job.progressPercent !== percent) {
        job.progressPercent = percent;
        changed = true;
      }
    }
    return changed;
  }

  const singleMatch = raw.match(/Fetched\/Processed\s+(\d+)\s+(nodes?|blocks?)/i);
  if (singleMatch) {
    const current = Number(singleMatch[1]);
    const unit = String(singleMatch[2] || '').trim().toLowerCase();
    if (Number.isFinite(current) && job.progressCurrent !== current) {
      job.progressCurrent = current;
      changed = true;
    }
    if (unit && job.progressUnit !== unit) {
      job.progressUnit = unit;
      changed = true;
    }
  }

  return changed;
}

function createPinJobId() {
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createPinJob(target, name) {
  const now = Date.now();
  return {
    id: createPinJobId(),
    target,
    name,
    status: 'queued',
    progressText: '',
    progressCurrent: null,
    progressTotal: null,
    progressPercent: null,
    progressUnit: '',
    pinnedCid: '',
    error: '',
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: 0,
    completedAt: 0
  };
}

function attachLineBuffer(stream, runtime, bufferKey, onLine) {
  if (!stream || typeof stream.on !== 'function') return;
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    runtime[bufferKey] = String(runtime[bufferKey] || '') + String(chunk || '');
    const parts = runtime[bufferKey].split(/[\r\n]+/);
    runtime[bufferKey] = parts.pop() || '';
    for (const part of parts) {
      const line = String(part || '').trim();
      if (line) onLine(line);
    }
  });
}

function flushPinJobBuffers(job, runtime) {
  for (const key of ['stdoutBuffer', 'stderrBuffer']) {
    const line = String(runtime?.[key] || '').trim();
    if (!line) continue;
    parsePinProgressLine(job, line);
    runtime[key] = '';
  }
}

async function finalizePinJobSuccess(job) {
  const check = await ipfsPinLs(job.target, 'recursive').catch(() => null);
  const keys = check?.ok && Array.isArray(check.keys) ? check.keys : [];
  job.pinnedCid = String(keys[0] || job.pinnedCid || '').trim();
  job.status = 'completed';
  job.error = '';
  job.nextRetryAt = 0;
  job.completedAt = Date.now();
  if (job.progressPercent == null) job.progressPercent = 100;
  emitPinJobUpdate(job, 'completed');
}

function schedulePinJobRetry(job, errorMessage) {
  const runtime = getOrCreatePinJobRuntime(job.id);
  if (!runtime) return;

  clearPinJobRetryTimer(job.id);
  job.retryCount = Number(job.retryCount || 0) + 1;
  const delay = Math.min(
    60_000,
    DEFAULT_IPFS_PIN_RETRY_BASE_MS * Math.max(1, 2 ** (Math.max(0, job.retryCount - 1)))
  );
  job.status = 'retry_waiting';
  job.error = normalizePinJobError(errorMessage);
  job.nextRetryAt = Date.now() + delay;
  emitPinJobUpdate(job, 'retry_scheduled');

  runtime.retryTimer = setTimeout(() => {
    runtime.retryTimer = null;
    void startPinJob(job.id);
  }, delay);
}

async function handlePinJobExit(jobId, code, signal) {
  const job = pinJobs.get(String(jobId || '').trim()) || null;
  const runtime = activePinJobProcesses.get(String(jobId || '').trim()) || null;
  if (!job || !runtime) return;

  flushPinJobBuffers(job, runtime);
  const pauseRequested = !!runtime.pauseRequested;
  const cancelRequested = !!runtime.cancelRequested;
  runtime.child = null;
  runtime.pauseRequested = false;
  runtime.cancelRequested = false;

  if (cancelRequested) {
    job.status = 'cancelled';
    job.error = 'user_cancelled';
    job.nextRetryAt = 0;
    job.completedAt = Date.now();
    emitPinJobUpdate(job, 'cancelled');
    destroyPinJobRuntime(job.id);
    return;
  }

  if (pauseRequested) {
    job.status = 'paused';
    job.error = '';
    job.nextRetryAt = 0;
    emitPinJobUpdate(job, 'paused');
    return;
  }

  if (Number(code) === 0) {
    await finalizePinJobSuccess(job).catch((e) => {
      job.status = 'failed';
      job.error = normalizePinJobError(e);
      job.nextRetryAt = 0;
      job.completedAt = Date.now();
      emitPinJobUpdate(job, 'failed');
    });
    destroyPinJobRuntime(job.id);
    return;
  }

  const exitDetails = [job.error, runtime.stderrBuffer, runtime.stdoutBuffer, signal ? `signal:${signal}` : '', Number.isFinite(Number(code)) ? `code:${Number(code)}` : '']
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' | ');
  const errorMessage = normalizePinJobError(exitDetails || 'pin_add_failed');
  job.error = errorMessage;

  if (job.retryCount < DEFAULT_IPFS_PIN_MAX_RETRIES && isRetryablePinError(errorMessage)) {
    schedulePinJobRetry(job, errorMessage);
    return;
  }

  job.status = 'failed';
  job.nextRetryAt = 0;
  job.completedAt = Date.now();
  emitPinJobUpdate(job, 'failed');
  destroyPinJobRuntime(job.id);
}

async function startPinJob(jobId) {
  loadPersistedPinJobs();

  const key = String(jobId || '').trim();
  const job = pinJobs.get(key) || null;
  if (!job) return { ok: false, error: 'pin_job_not_found' };
  if (isFinalPinJobStatus(job.status)) return { ok: true, job: snapshotPinJob(job) };

  const runtime = getOrCreatePinJobRuntime(job.id);
  if (!runtime) return { ok: false, error: 'pin_job_runtime_missing' };
  if (runtime.child) return { ok: true, job: snapshotPinJob(job) };

  clearPinJobRetryTimer(job.id);
  job.status = 'running';
  job.error = '';
  job.nextRetryAt = 0;
  job.startedAt = Date.now();
  emitPinJobUpdate(job, 'started');

  const bin = resolveKuboBin();
  const repoPath = getIpfsRepoPath();
  const args = ['pin', 'add', '--progress'];
  if (job.name) args.push('--name', job.name);
  args.push('--', job.target);

  try {
    const child = spawn(bin, args, {
      env: {
        ...process.env,
        IPFS_PATH: repoPath,
        IPFS_ALLOW_BIG_BLOCK: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    });
    runtime.child = child;
    runtime.stdoutBuffer = '';
    runtime.stderrBuffer = '';

    attachLineBuffer(child.stdout, runtime, 'stdoutBuffer', (line) => {
      if (parsePinProgressLine(job, line)) emitPinJobUpdate(job, 'progress');
    });
    attachLineBuffer(child.stderr, runtime, 'stderrBuffer', (line) => {
      job.error = String(line || '').trim();
      const changed = parsePinProgressLine(job, line);
      emitPinJobUpdate(job, changed ? 'progress' : 'log');
    });

    child.on('error', (err) => {
      job.error = normalizePinJobError(err);
    });
    child.on('exit', (code, signal) => {
      void handlePinJobExit(job.id, code, signal);
    });
    return { ok: true, job: snapshotPinJob(job) };
  } catch (e) {
    job.error = normalizePinJobError(e);
    if (job.retryCount < DEFAULT_IPFS_PIN_MAX_RETRIES && isRetryablePinError(job.error)) {
      schedulePinJobRetry(job, job.error);
      return { ok: true, job: snapshotPinJob(job) };
    }
    job.status = 'failed';
    job.completedAt = Date.now();
    emitPinJobUpdate(job, 'failed');
    destroyPinJobRuntime(job.id);
    return { ok: false, error: job.error, job: snapshotPinJob(job) };
  }
}

function scheduleResumePersistedPinJobs() {
  if (pinJobsResumeScheduled) return;
  pinJobsResumeScheduled = true;
  setTimeout(() => {
    loadPersistedPinJobs();
    for (const job of pinJobs.values()) {
      if (!job?.id || isFinalPinJobStatus(job.status) || job.status === 'paused') continue;
      job.status = 'queued';
      job.error = '';
      job.nextRetryAt = 0;
      emitPinJobUpdate(job, 'restored');
      void startPinJob(job.id);
    }
  }, 4_000);
}

function getPinJob(jobId) {
  loadPersistedPinJobs();
  const key = String(jobId || '').trim();
  return snapshotPinJob(pinJobs.get(key) || null);
}

function listPinJobs() {
  loadPersistedPinJobs();
  return Array.from(pinJobs.values())
    .map((job) => snapshotPinJob(job))
    .filter(Boolean)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

async function startManagedPinJob(input) {
  loadPersistedPinJobs();

  const target = sanitizeCidOrPath(input?.cidOrPath ?? input?.target ?? input);
  const name = sanitizePinJobName(input?.name || '');
  const existing = Array.from(pinJobs.values()).find(
    (job) =>
      String(job?.target || '').trim() === target &&
      !isFinalPinJobStatus(job?.status) &&
      String(job?.status || '').trim().toLowerCase() !== 'cancelled'
  );
  if (existing) {
    if (String(existing.status || '').trim().toLowerCase() === 'paused') {
      await startPinJob(existing.id);
    }
    return { ok: true, reused: true, job: snapshotPinJob(existing) };
  }

  const job = createPinJob(target, name);
  pinJobs.set(job.id, job);
  emitPinJobUpdate(job, 'created');
  const res = await startPinJob(job.id);
  return { ok: !!res?.ok, reused: false, job: snapshotPinJob(pinJobs.get(job.id) || job), error: res?.error };
}

async function pauseManagedPinJob(jobId) {
  loadPersistedPinJobs();
  const key = String(jobId || '').trim();
  const job = pinJobs.get(key) || null;
  if (!job) return { ok: false, error: 'pin_job_not_found' };
  if (isFinalPinJobStatus(job.status)) return { ok: false, error: 'pin_job_finished', job: snapshotPinJob(job) };

  const runtime = getOrCreatePinJobRuntime(key);
  if (!runtime) return { ok: false, error: 'pin_job_runtime_missing' };

  if (runtime.retryTimer) {
    clearPinJobRetryTimer(key);
    job.status = 'paused';
    job.nextRetryAt = 0;
    emitPinJobUpdate(job, 'paused');
    return { ok: true, job: snapshotPinJob(job) };
  }

  if (runtime.child) {
    runtime.pauseRequested = true;
    try {
      runtime.child.kill();
    } catch (e) {
      return { ok: false, error: normalizePinJobError(e), job: snapshotPinJob(job) };
    }
    return { ok: true, job: snapshotPinJob(job) };
  }

  job.status = 'paused';
  job.nextRetryAt = 0;
  emitPinJobUpdate(job, 'paused');
  return { ok: true, job: snapshotPinJob(job) };
}

async function resumeManagedPinJob(jobId) {
  loadPersistedPinJobs();
  const key = String(jobId || '').trim();
  const job = pinJobs.get(key) || null;
  if (!job) return { ok: false, error: 'pin_job_not_found' };
  if (String(job.status || '').trim().toLowerCase() === 'completed') {
    return { ok: false, error: 'pin_job_finished', job: snapshotPinJob(job) };
  }
  if (String(job.status || '').trim().toLowerCase() === 'cancelled') {
    return { ok: false, error: 'pin_job_cancelled', job: snapshotPinJob(job) };
  }
  job.status = 'queued';
  job.error = '';
  job.nextRetryAt = 0;
  job.completedAt = 0;
  emitPinJobUpdate(job, 'queued');
  const res = await startPinJob(key);
  return { ok: !!res?.ok, error: res?.error, job: snapshotPinJob(pinJobs.get(key) || job) };
}

async function cancelManagedPinJob(jobId) {
  loadPersistedPinJobs();
  const key = String(jobId || '').trim();
  const job = pinJobs.get(key) || null;
  if (!job) return { ok: false, error: 'pin_job_not_found' };
  if (isFinalPinJobStatus(job.status)) return { ok: true, job: snapshotPinJob(job) };

  const runtime = getOrCreatePinJobRuntime(key);
  if (runtime?.retryTimer) {
    clearPinJobRetryTimer(key);
  }

  if (runtime?.child) {
    runtime.cancelRequested = true;
    try {
      runtime.child.kill();
    } catch (e) {
      return { ok: false, error: normalizePinJobError(e), job: snapshotPinJob(job) };
    }
    return { ok: true, job: snapshotPinJob(job) };
  }

  job.status = 'cancelled';
  job.error = 'user_cancelled';
  job.nextRetryAt = 0;
  job.completedAt = Date.now();
  emitPinJobUpdate(job, 'cancelled');
  destroyPinJobRuntime(key);
  return { ok: true, job: snapshotPinJob(job) };
}

async function waitForManagedPinJob(jobId, timeoutMs = 0) {
  loadPersistedPinJobs();
  const key = String(jobId || '').trim();
  const current = pinJobs.get(key) || null;
  if (!current) return { ok: false, error: 'pin_job_not_found' };
  if (isFinalPinJobStatus(current.status)) {
    return {
      ok: String(current.status) === 'completed',
      cancelled: String(current.status) === 'cancelled',
      error: String(current.error || ''),
      job: snapshotPinJob(current)
    };
  }

  return await new Promise((resolve) => {
    const cleanup = [];
    const finish = (payload) => {
      for (const fn of cleanup) {
        try { fn(); } catch {}
      }
      resolve(payload);
    };

    const handler = (payload) => {
      const job = payload?.job || null;
      if (!job || String(job.id || '') !== key) return;
      if (!isFinalPinJobStatus(job.status)) return;
      finish({
        ok: String(job.status) === 'completed',
        cancelled: String(job.status) === 'cancelled',
        error: String(job.error || ''),
        job
      });
    };
    pinJobEmitter.on('update', handler);
    cleanup.push(() => pinJobEmitter.off('update', handler));

    if (Number(timeoutMs) > 0) {
      const timer = setTimeout(() => {
        finish({ ok: false, error: 'pin_wait_timeout', job: getPinJob(key) });
      }, Math.floor(Number(timeoutMs)));
      cleanup.push(() => clearTimeout(timer));
    }
  });
}

function getIpfsConnectivityMode() {
  const value = String(getSetting('ipfsConnectivityMode') || DEFAULT_IPFS_CONNECTIVITY_MODE)
    .trim()
    .toLowerCase();
  return Object.prototype.hasOwnProperty.call(IPFS_CONNECTIVITY_PROFILES, value)
    ? value
    : DEFAULT_IPFS_CONNECTIVITY_MODE;
}

function getIpfsConnectivityProfile() {
  return IPFS_CONNECTIVITY_PROFILES[getIpfsConnectivityMode()] || IPFS_CONNECTIVITY_PROFILES.normal;
}

function multiaddrForHttpBase(rawBase) {
  try {
    const u = new URL(String(rawBase || '').trim());
    const host = String(u.hostname || '').trim();
    const port = Number(u.port || '');
    
    console.log('[electron][ipfs] multiaddrForHttpBase - rawBase:', rawBase, 'hostname:', host, 'port:', u.port, 'parsed port:', port);
    
    if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
      console.log('[electron][ipfs] multiaddrForHttpBase - invalid host or port');
      return null;
    }

    const isIpv6 = host.includes(':') && !host.includes('.');
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    const isLocalhost = host.toLowerCase() === 'localhost';

    const addrHost = isLocalhost ? '127.0.0.1' : host;
    const family = isIpv6 ? 'ip6' : 'ip4';

    if (!isIpv6 && !isIpv4 && !isLocalhost) {
      console.log('[electron][ipfs] multiaddrForHttpBase - not valid IP format');
      return null;
    }

    const result = `/${family}/${addrHost}/tcp/${port}`;
    console.log('[electron][ipfs] multiaddrForHttpBase - result:', result);
    return result;
  } catch (e) {
    console.log('[electron][ipfs] multiaddrForHttpBase - error:', e);
    return null;
  }
}

function applyIpfsAddressesConfig(bin, repoPath) {
  try {
    const apiAddr = multiaddrForHttpBase(ipfsApiBase());
    const gwAddr = multiaddrForHttpBase(localGatewayBase());
    const connectivityMode = getIpfsConnectivityMode();
    const connectivityProfile = getIpfsConnectivityProfile();
    
    console.log(
      '[electron][ipfs] Applying config - API:',
      apiAddr,
      'Gateway:',
      gwAddr,
      'Connectivity:',
      connectivityMode,
      connectivityProfile,
    );
    
    if (!apiAddr || !gwAddr) {
      console.warn('[electron][ipfs] Invalid addresses, skipping config');
      return;
    }

    const env = { ...process.env, IPFS_PATH: repoPath };
    const setCfg = (key, value) => {
      const r = spawnSync(bin, ['config', key, value], { env, stdio: 'pipe' });
      if (r.error) {
        console.warn('[electron][ipfs] ipfs config error', key, r.error);
      } else if (r.status !== 0) {
        console.warn('[electron][ipfs] ipfs config failed', key, r.status, String(r.stderr || ''));
      } else {
        console.log('[electron][ipfs] ipfs config success', key, value);
      }
    };
    const setCfgJson = (key, value) => {
      const r = spawnSync(bin, ['config', '--json', key, value], { env, stdio: 'pipe' });
      if (r.error) {
        console.warn('[electron][ipfs] ipfs config error', key, r.error);
      } else if (r.status !== 0) {
        console.warn('[electron][ipfs] ipfs config failed', key, r.status, String(r.stderr || ''));
      } else {
        console.log('[electron][ipfs] ipfs config --json success', key);
      }
    };

    setCfg('Addresses.API', apiAddr);
    setCfg('Addresses.Gateway', gwAddr);
    
    // Disable mDNS discovery to avoid warning spam on Windows
    setCfgJson('Discovery.MDNS.Enabled', 'false');

    // Improve connectivity for real-time PubSub apps over the Internet.
    setCfgJson('Swarm.RelayClient.Enabled', 'true');
    setCfgJson('Swarm.EnableAutoRelay', 'true');
    setCfgJson('Swarm.EnableHolePunching', 'true');
    setCfgJson('Swarm.ConnMgr.Type', JSON.stringify('basic'));
    setCfgJson('Swarm.ConnMgr.LowWater', String(connectivityProfile.lowWater));
    setCfgJson('Swarm.ConnMgr.HighWater', String(connectivityProfile.highWater));
    setCfgJson('Swarm.ConnMgr.GracePeriod', JSON.stringify(connectivityProfile.gracePeriod));
    setCfgJson('Swarm.ConnMgr.SilencePeriod', JSON.stringify(connectivityProfile.silencePeriod));

    // Allow the renderer (http://localhost / app://) to fetch gateway resources (HLS needs this).
    // Without these, Chromium blocks cross-origin HLS playlist/segment requests (CORS).
    setCfgJson('Gateway.HTTPHeaders.Access-Control-Allow-Origin', '["*"]');
    setCfgJson('Gateway.HTTPHeaders.Access-Control-Allow-Methods', '["GET","HEAD","OPTIONS"]');
    setCfgJson('Gateway.HTTPHeaders.Access-Control-Allow-Headers', '["Range","Origin","Accept","Content-Type","User-Agent"]');
    setCfgJson('Gateway.HTTPHeaders.Access-Control-Expose-Headers', '["Content-Range","Content-Length","Content-Type"]');
  } catch (e) {
    console.warn('[electron][ipfs] applyIpfsAddressesConfig failed', e);
  }
}

function ensureSubdomainGatewayConfig(repoPath) {
  try {
    const cfgFile = path.join(repoPath, 'config');
    if (!fs.existsSync(cfgFile)) return;
    const raw = fs.readFileSync(cfgFile, 'utf8');
    const cfg = JSON.parse(raw || '{}');

    cfg.Gateway = cfg.Gateway && typeof cfg.Gateway === 'object' ? cfg.Gateway : {};

    // Enables subdomain gateways like:
    //   http://<cid>.ipfs.localhost:8080/
    // so absolute paths (e.g. /assets/...) resolve within the site root.
    cfg.Gateway.UseSubdomains = true;

    const pg = cfg.Gateway.PublicGateways && typeof cfg.Gateway.PublicGateways === 'object'
      ? cfg.Gateway.PublicGateways
      : {};

    const ensurePg = (host) => {
      const cur = pg[host] && typeof pg[host] === 'object' ? pg[host] : {};
      const paths = Array.isArray(cur.Paths) ? cur.Paths : [];
      const nextPaths = Array.from(new Set([...paths, '/ipfs', '/ipns']));
      pg[host] = { ...cur, Paths: nextPaths, UseSubdomains: true };
    };

    // `*.localhost` resolves to 127.0.0.1 in modern browsers.
    ensurePg('localhost');
    // Keep explicit loopback host config too (doesn't hurt).
    ensurePg('127.0.0.1');

    cfg.Gateway.PublicGateways = pg;

    fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.warn('[electron][ipfs] ensureSubdomainGatewayConfig failed', e);
  }
}

function resolveKuboBin() {
  function unwrapAsarPath(p) {
    const s = String(p || '');
    if (!s) return s;
    return s.replace(/app\.asar([\\/])/g, 'app.asar.unpacked$1');
  }

  try {
    const kubo = require('kubo');
    const p = typeof kubo?.path === 'function' ? kubo.path() : kubo?.path;
    if (typeof p === 'string' && p.length > 0) return unwrapAsarPath(p);
  } catch (_e) {
    // fall through
  }
  return 'ipfs';
}

function ipfsCidToBase32(cid) {
  try {
    const input = String(cid || '').trim();
    if (!input) return null;
    const bin = resolveKuboBin();
    const r = spawnSync(bin, ['cid', 'format', '-v', '1', '-b', 'base32', input], { stdio: 'pipe' });
    if (r.error) return null;
    if (r.status !== 0) return null;
    const out = String(r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '';
    return out ? out.trim() : null;
  } catch {
    return null;
  }
}

function getIpfsRepoPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'ipfs');
}

function ensureIpfsRepo(bin) {
  const repoPath = getIpfsRepoPath();
  try {
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
    }
    const configFile = path.join(repoPath, 'config');
    if (!fs.existsSync(configFile)) {
      console.log('[electron][ipfs] initializing repo at', repoPath);
      const r = spawnSync(bin, ['init'], {
        env: { ...process.env, IPFS_PATH: repoPath },
        stdio: 'pipe'
      });
      if (r.error) {
        console.warn('[electron][ipfs] ipfs init error', r.error);
      } else if (r.status !== 0) {
        console.warn(
          '[electron][ipfs] ipfs init failed with code',
          r.status,
          String(r.stderr || '')
        );
      }
    }
  } catch (e) {
    console.warn('[electron][ipfs] ensureIpfsRepo failed', e);
  }
  return repoPath;
}

function startIpfsDaemon(cb) {
  if (ipfsProcess) return;
  const bin = resolveKuboBin();
  console.log('[electron][ipfs] using binary:', bin);
  const repoPath = ensureIpfsRepo(bin);
  console.log('[electron][ipfs] starting daemon with repo:', repoPath);

  // Make the embedded daemon listen on the configured endpoints.
  applyIpfsAddressesConfig(bin, repoPath);
  // Enable subdomain gateway support for localhost.
  ensureSubdomainGatewayConfig(repoPath);

  try {
    ipfsProcess = spawn(
      bin,
      [ 'daemon', '--migrate=true', '--enable-gc', '--routing', 'dht', '--enable-pubsub-experiment' ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: {
          ...process.env,
          IPFS_PATH: repoPath,
          IPFS_ALLOW_BIG_BLOCK: '1'
        }
      }
    );
    ipfsProcess.stdout?.setEncoding('utf8');
    ipfsProcess.stderr?.setEncoding('utf8');
    ipfsProcess.stdout?.on('data', (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => console.log('[electron][ipfs][stdout]', line));
      if(cb && typeof cb == "function") cb()
    });
    ipfsProcess.stderr?.on('data', (d) => {
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((line) => !shouldIgnoreIpfsStderrLine(line))
        .forEach((line) => console.warn('[electron][ipfs][stderr]', line));
    });
    ipfsProcess.on('exit', () => {
      console.log('[electron][ipfs] daemon exited');
      ipfsProcess = null;
    });
    scheduleResumePersistedPinJobs();
  } catch (e) {
    console.error('[electron][ipfs] failed to spawn daemon:', e);
    ipfsProcess = null;
  }
}

function shouldIgnoreIpfsStderrLine(line) {
  const text = String(line || '');
  return (
    text.includes('A NEW VERSION OF KUBO DETECTED') ||
    text.includes('This Kubo node is running an outdated version') ||
    text.includes('sampled Kubo peers are running a higher version') ||
    text.includes('github.com/ipfs/kubo/releases') ||
    text.includes('dist.ipfs.tech/#kubo')
  );
}

async function checkIpfsStatus(retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const base = ipfsApiBase();
      console.log(`[electron][ipfs] checking status on ${base} (attempt ${attempt}/${retries})`);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${base}/api/v0/id?enc=json`, {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(t);
      if (!res.ok) {
        console.warn('[electron][ipfs] status HTTP not ok:', res.status);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { ok: false, error: 'http_' + res.status };
      }
      await res.text().catch(() => '');
      console.log('[electron][ipfs] status ok');
      return { ok: true };
    } catch (e) {
      console.warn('[electron][ipfs] status error:', e.message || e);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }
  return { ok: false, error: 'max retries exceeded' };
}

async function ipfsAdd(data, filename) {
  try {
    const dataBuf = toBufferPayload(data);
    if (dataBuf.length > localDriveMaxUploadBytes()) {
      return { ok: false, error: 'file_too_large' };
    }
    console.log('[electron][ipfs] adding file:', filename, 'size:', dataBuf.length);
    // Create multipart form data
    const boundary = '----LumenIPFS' + Date.now();
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename || 'file'}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const body = Buffer.concat([headerBuf, dataBuf, footerBuf]);

    const res = await fetch(`${ipfsApiBase()}/api/v0/add?pin=true`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] add success:', json.Hash);
    return { ok: true, cid: json.Hash, name: json.Name, size: json.Size };
  } catch (e) {
    console.error('[electron][ipfs] add error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

function toSafeAbortError(e) {
  const msg = String(e?.message || e || '');
  const name = String(e?.name || '');
  const lower = msg.toLowerCase();
  if (name === 'AbortError') return true;
  return lower.includes('abort') || lower.includes('aborted') || lower.includes('cancel');
}

function clampTimeoutMs(input, fallbackMs, maxMs) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return fallbackMs;
  return Math.min(Math.floor(n), maxMs);
}

function normalizeHttpUrl(input) {
  try {
    const u = new URL(String(input || '').trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    u.hash = '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function normalizePublicGatewayList(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.gateways)
      ? raw.gateways
      : [];

  const seen = new Set();
  const out = [];
  for (const item of list) {
    const base = normalizeHttpUrl(item);
    if (!base || seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out.slice(0, 256);
}

function normalizePublicGatewayPath(cidOrPath) {
  const raw = String(cidOrPath || '').trim();
  if (!raw) throw new Error('missing_cid');
  if (/^\/(ipfs|ipns)\//i.test(raw)) return raw;
  if (/^(ipfs|ipns)\//i.test(raw)) return '/' + raw;
  return '/ipfs/' + raw.replace(/^\/+/, '');
}

function emitPublicGatewayProgress(onProgress, payload) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress(payload);
  } catch {}
}

function getOfflineGatewayEntry(baseUrl) {
  const key = normalizeHttpUrl(baseUrl);
  if (!key) return null;
  const entry = publicIpfsGatewayOfflineUntil.get(key) || null;
  if (!entry) return null;
  if (Number(entry.until || 0) <= Date.now()) {
    publicIpfsGatewayOfflineUntil.delete(key);
    return null;
  }
  return entry;
}

function markGatewayOffline(baseUrl, reason) {
  const key = normalizeHttpUrl(baseUrl);
  if (!key) return;
  publicIpfsGatewayOfflineUntil.set(key, {
    reason: String(reason || 'probe_failed'),
    until: Date.now() + PUBLIC_IPFS_GATEWAY_OFFLINE_TTL_MS,
  });
}

function clearGatewayOffline(baseUrl) {
  const key = normalizeHttpUrl(baseUrl);
  if (!key) return;
  publicIpfsGatewayOfflineUntil.delete(key);
}

async function loadPublicIpfsGateways(opts = {}) {
  const sourceUrlRaw =
    String(opts?.sourceUrl || publicIpfsGatewaysCache.sourceUrl || PUBLIC_IPFS_GATEWAYS_SOURCE_URL).trim() ||
    PUBLIC_IPFS_GATEWAYS_SOURCE_URL;
  const sourceUrl = normalizeHttpUrl(sourceUrlRaw) || PUBLIC_IPFS_GATEWAYS_SOURCE_URL;
  const timeoutMs = clampTimeoutMs(opts?.timeoutMs, 10_000, 30_000);
  const force = !!opts?.force;
  const outerSignal = opts?.signal;

  if (!force && sourceUrl === publicIpfsGatewaysCache.sourceUrl && publicIpfsGatewaysCache.gateways.length) {
    return {
      ok: true,
      sourceUrl: publicIpfsGatewaysCache.sourceUrl,
      fetchedAt: publicIpfsGatewaysCache.fetchedAt,
      gateways: [...publicIpfsGatewaysCache.gateways],
      cached: true,
    };
  }

  if (publicIpfsGatewaysInFlight && !outerSignal && !force) return publicIpfsGatewaysInFlight;

  const job = (async () => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        controller.abort();
      } catch {}
    }, timeoutMs);

    const onAbort = () => {
      try {
        controller.abort();
      } catch {}
    };

    if (outerSignal) {
      if (outerSignal.aborted) {
        onAbort();
      } else {
        outerSignal.addEventListener('abort', onAbort, { once: true });
      }
    }

    try {
      const res = await fetch(sourceUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false, error: 'http_' + res.status, sourceUrl };
      }

      const json = await res.json().catch(() => null);
      const gateways = normalizePublicGatewayList(json);
      if (!gateways.length) {
        return { ok: false, error: 'no_public_gateways', sourceUrl };
      }

      const fetchedAt = Date.now();
      publicIpfsGatewaysCache = {
        sourceUrl,
        fetchedAt,
        gateways,
      };

      return {
        ok: true,
        sourceUrl,
        fetchedAt,
        gateways: [...gateways],
        cached: false,
      };
    } catch (e) {
      if (outerSignal?.aborted || toSafeAbortError(e)) {
        return {
          ok: false,
          error: outerSignal?.aborted ? 'cancelled' : timedOut ? 'timeout' : 'cancelled',
          cancelled: !!outerSignal?.aborted,
          timeout: timedOut && !outerSignal?.aborted,
          sourceUrl,
        };
      }
      return { ok: false, error: String(e?.message || e || 'public_gateway_list_failed'), sourceUrl };
    } finally {
      try {
        clearTimeout(timeoutId);
      } catch {}
      if (outerSignal) {
        try {
          outerSignal.removeEventListener('abort', onAbort);
        } catch {}
      }
    }
  })();

  publicIpfsGatewaysInFlight = job;
  try {
    return await job;
  } finally {
    if (publicIpfsGatewaysInFlight === job) {
      publicIpfsGatewaysInFlight = null;
    }
  }
}

async function prefetchPublicIpfsGateways(opts = {}) {
  const res = await loadPublicIpfsGateways({ ...opts, force: true });
  if (res?.ok) {
    console.log(
      '[electron][ipfs] public gateway list refreshed:',
      Array.isArray(res.gateways) ? res.gateways.length : 0,
      'gateways',
    );
  } else {
    console.warn(
      '[electron][ipfs] public gateway list refresh failed:',
      String(res?.error || 'unknown_error'),
    );
  }
  return res;
}

function buildPublicGatewayRequestUrl(baseUrl, cidOrPath) {
  const base = normalizeHttpUrl(baseUrl);
  if (!base) throw new Error('invalid_gateway_base');
  const p = normalizePublicGatewayPath(cidOrPath);
  return new URL(p.replace(/^\/+/, ''), `${base}/`).toString();
}

async function requestPublicGateway(baseUrl, cidOrPath, opts = {}) {
  const outerSignal = opts?.signal;
  const timeoutMs = clampTimeoutMs(opts?.timeoutMs, 15_000, 60_000);
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    try {
      controller.abort();
    } catch {}
  }, timeoutMs);

  const onAbort = () => {
    try {
      controller.abort();
    } catch {}
  };

  if (outerSignal) {
    if (outerSignal.aborted) onAbort();
    else outerSignal.addEventListener('abort', onAbort, { once: true });
  }

  let url = '';

  try {
    url = buildPublicGatewayRequestUrl(baseUrl, cidOrPath);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });

    try {
      await res.body?.cancel?.();
    } catch {}

    return {
      gateway: baseUrl,
      url,
      ok: res.ok,
      status: Number(res.status || 0),
    };
  } catch (e) {
    const cancelled = !!outerSignal?.aborted;
    return {
      gateway: baseUrl,
      url,
      ok: false,
      status: 0,
      cancelled,
      timeout: timedOut && !cancelled,
      error: cancelled ? 'cancelled' : String(e?.message || e || 'gateway_request_failed'),
    };
  } finally {
    try {
      clearTimeout(timeoutId);
    } catch {}
    if (outerSignal) {
      try {
        outerSignal.removeEventListener('abort', onAbort);
      } catch {}
    }
  }
}

async function probePublicGateway(baseUrl, opts = {}) {
  const offline = getOfflineGatewayEntry(baseUrl);
  if (offline) {
    return {
      gateway: baseUrl,
      ok: false,
      skipped: true,
      cachedOffline: true,
      offlineUntil: Number(offline.until || 0) || 0,
      error: String(offline.reason || 'cached_offline'),
    };
  }

  const res = await requestPublicGateway(baseUrl, PUBLIC_IPFS_GATEWAY_PROBE_PATH, {
    signal: opts?.signal,
    timeoutMs: opts?.timeoutMs,
  });

  if (res.ok) {
    clearGatewayOffline(baseUrl);
    return { ...res, probe: true };
  }

  markGatewayOffline(baseUrl, res.timeout ? 'probe_timeout' : res.error || `probe_http_${res.status || 0}`);
  return { ...res, probe: true };
}

async function ipfsPropagateCidToPublicGateways(input = {}, opts = {}) {
  const cidOrPath = String(input?.cid || input?.cidOrPath || '').trim();
  if (!cidOrPath) return { ok: false, error: 'missing_cid' };

  const signal = opts?.signal;
  const onProgress = opts?.onProgress;
  const timeoutMs = clampTimeoutMs(input?.timeoutMs ?? opts?.timeoutMs, 15_000, 60_000);
  const probeTimeoutMs = clampTimeoutMs(input?.probeTimeoutMs ?? opts?.probeTimeoutMs, 3_000, 10_000);
  const sourceTimeoutMs = clampTimeoutMs(
    input?.sourceTimeoutMs ?? opts?.sourceTimeoutMs,
    10_000,
    30_000,
  );

  const sourceUrl =
    String(input?.sourceUrl || publicIpfsGatewaysCache.sourceUrl || PUBLIC_IPFS_GATEWAYS_SOURCE_URL).trim() ||
    PUBLIC_IPFS_GATEWAYS_SOURCE_URL;

  const gatewayPath = normalizePublicGatewayPath(cidOrPath);

  console.log(`[IPFS] Start propagation for CID=${cidOrPath}`);
  console.log(`[IPFS] Gateway path=${gatewayPath}`);

  emitPublicGatewayProgress(onProgress, {
    stage: 'fetching-list',
    cid: cidOrPath,
    path: gatewayPath,
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    timedOut: 0,
    skippedOffline: 0,
  });

  const gatewaysRes = await loadPublicIpfsGateways({
    sourceUrl,
    timeoutMs: sourceTimeoutMs,
    signal,
  });

  if (!gatewaysRes?.ok) {
    console.error(`[IPFS] Failed to load gateways list: ${gatewaysRes?.error}`);

    return {
      ok: false,
      error: String(gatewaysRes?.error || 'public_gateway_list_failed'),
      cancelled: !!gatewaysRes?.cancelled,
      timeout: !!gatewaysRes?.timeout,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      skippedOffline: 0,
    };
  }

  const gateways = Array.isArray(gatewaysRes.gateways) ? gatewaysRes.gateways : [];
  console.log(`[IPFS] Loaded ${gateways.length} gateways`);

  if (!gateways.length) {
    console.warn(`[IPFS] No public gateways available`);

    return {
      ok: false,
      error: 'no_public_gateways',
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      skippedOffline: 0,
    };
  }

  let probeCompleted = 0;
  let alive = 0;
  let skippedOffline = 0;

  emitPublicGatewayProgress(onProgress, {
    stage: 'probing',
    cid: cidOrPath,
    path: gatewayPath,
    total: gateways.length,
    completed: probeCompleted,
    succeeded: alive,
    failed: 0,
    timedOut: 0,
    skippedOffline,
  });

  const probeResults = await Promise.all(
    gateways.map(async (gateway) => {
      const res = await probePublicGateway(gateway, {
        signal,
        timeoutMs: probeTimeoutMs,
      });

      probeCompleted += 1;

      if (res.ok) {
        alive += 1;
        console.log(`[IPFS] ✓ gateway alive: ${gateway}`);
      } else if (res.skipped || res.cachedOffline) {
        skippedOffline += 1;
        console.warn(`[IPFS] - gateway skipped/offline: ${gateway}`);
      } else {
        console.warn(`[IPFS] ✗ gateway failed: ${gateway} status=${res.status}`);
      }

      emitPublicGatewayProgress(onProgress, {
        stage: signal?.aborted ? 'cancelled' : 'probing',
        cid: cidOrPath,
        path: gatewayPath,
        gateway,
        status: Number(res.status || 0) || 0,
        total: gateways.length,
        completed: probeCompleted,
        succeeded: alive,
        failed: Math.max(0, probeCompleted - alive - skippedOffline),
        timedOut: 0,
        skippedOffline,
      });

      return res;
    }),
  );

  console.log(`[IPFS] Probe done: ${alive}/${gateways.length} alive`);

  if (signal?.aborted) {
    console.warn(`[IPFS] Cancelled during probing`);

    emitPublicGatewayProgress(onProgress, {
      stage: 'cancelled',
      cid: cidOrPath,
      path: gatewayPath,
      total: gateways.length,
      completed: probeCompleted,
      succeeded: alive,
      failed: Math.max(0, probeCompleted - alive - skippedOffline),
      timedOut: 0,
      skippedOffline,
    });

    return {
      ok: false,
      error: 'cancelled',
      cancelled: true,
      total: gateways.length,
      completed: probeCompleted,
      succeeded: alive,
      failed: Math.max(0, probeCompleted - alive - skippedOffline),
      timedOut: 0,
      skippedOffline,
      results: probeResults,
      sourceUrl: gatewaysRes.sourceUrl,
      fetchedAt: gatewaysRes.fetchedAt,
    };
  }

  const aliveGateways = probeResults
    .filter((r) => r && r.ok)
    .map((r) => String(r.gateway || '').trim())
    .filter(Boolean);

  console.log(`[IPFS] Alive gateways: ${aliveGateways.length}`);

  if (!aliveGateways.length) {
    console.warn(`[IPFS] No alive gateways after probing`);

    emitPublicGatewayProgress(onProgress, {
      stage: 'done',
      cid: cidOrPath,
      path: gatewayPath,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      skippedOffline,
    });

    return {
      ok: true,
      cid: cidOrPath,
      path: gatewayPath,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      skippedOffline,
      results: [],
      probeResults,
      sourceUrl: gatewaysRes.sourceUrl,
      fetchedAt: gatewaysRes.fetchedAt,
    };
  }

  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  let timedOut = 0;

  console.log(`[IPFS] Starting propagation to ${aliveGateways.length} gateways`);

  emitPublicGatewayProgress(onProgress, {
    stage: 'propagating',
    cid: cidOrPath,
    path: gatewayPath,
    total: aliveGateways.length,
    completed,
    succeeded,
    failed,
    timedOut,
    skippedOffline,
  });

  const results = await Promise.all(
    aliveGateways.map(async (gateway) => {
      const res = await requestPublicGateway(gateway, gatewayPath, {
        signal,
        timeoutMs,
      });

      completed += 1;

      if (res.ok) {
        succeeded += 1;
        console.log(`[IPFS] ✓ propagated to ${gateway}`);
      } else {
        failed += 1;
        if (res.timeout) {
          timedOut += 1;
          console.warn(`[IPFS] ⏱ timeout ${gateway}`);
        } else {
          console.warn(`[IPFS] ✗ failed ${gateway} status=${res.status}`);
        }
      }

      emitPublicGatewayProgress(onProgress, {
        stage: signal?.aborted ? 'cancelled' : 'propagating',
        cid: cidOrPath,
        path: gatewayPath,
        gateway,
        status: res.status,
        total: aliveGateways.length,
        completed,
        succeeded,
        failed,
        timedOut,
        skippedOffline,
      });

      return res;
    }),
  );

  console.log(
    `[IPFS] Propagation done: ${succeeded}/${aliveGateways.length} succeeded, ${failed} failed`
  );

  if (signal?.aborted) {
    console.warn(`[IPFS] Cancelled during propagation`);

    emitPublicGatewayProgress(onProgress, {
      stage: 'cancelled',
      cid: cidOrPath,
      path: gatewayPath,
      total: aliveGateways.length,
      completed,
      succeeded,
      failed,
      timedOut,
      skippedOffline,
    });

    return {
      ok: false,
      error: 'cancelled',
      cancelled: true,
      total: aliveGateways.length,
      completed,
      succeeded,
      failed,
      timedOut,
      skippedOffline,
      results,
      probeResults,
      sourceUrl: gatewaysRes.sourceUrl,
      fetchedAt: gatewaysRes.fetchedAt,
    };
  }

  emitPublicGatewayProgress(onProgress, {
    stage: 'done',
    cid: cidOrPath,
    path: gatewayPath,
    total: aliveGateways.length,
    completed,
    succeeded,
    failed,
    timedOut,
    skippedOffline,
  });

  return {
    ok: true,
    cid: cidOrPath,
    path: gatewayPath,
    total: aliveGateways.length,
    completed,
    succeeded,
    failed,
    timedOut,
    skippedOffline,
    results,
    probeResults,
    sourceUrl: gatewaysRes.sourceUrl,
    fetchedAt: gatewaysRes.fetchedAt,
  };
}

function makeProgressReporter(onProgress, totalBytes) {
  const cb = typeof onProgress === 'function' ? onProgress : null;
  const total = typeof totalBytes === 'number' && Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : 0;
  let lastAt = 0;
  let lastPct = -1;
  let lastSent = -1;

  return (sentBytes, force = false) => {
    if (!cb) return;
    const sent = typeof sentBytes === 'number' && Number.isFinite(sentBytes) && sentBytes >= 0 ? sentBytes : 0;
    const pct = total ? Math.max(0, Math.min(100, Math.floor((sent / total) * 100))) : null;

    const now = Date.now();
    const shouldEmit =
      force ||
      pct !== lastPct ||
      sent !== lastSent ||
      now - lastAt >= 120;

    if (!shouldEmit) return;
    lastAt = now;
    lastPct = pct == null ? -1 : pct;
    lastSent = sent;

    try {
      cb({
        stage: 'uploading',
        sentBytes: sent,
        totalBytes: total || null,
        percent: pct,
      });
    } catch {
      // ignore callback errors
    }
  };
}

function makeBuffersStream(buffers, opts = {}) {
  const list = Array.isArray(buffers) ? buffers.filter(Boolean) : [];
  const totalBytes =
    typeof opts.totalBytes === 'number' && Number.isFinite(opts.totalBytes) && opts.totalBytes > 0
      ? opts.totalBytes
      : list.reduce((acc, b) => acc + (b?.length || 0), 0);
  const signal = opts.signal;
  const chunkSize =
    typeof opts.chunkSize === 'number' && Number.isFinite(opts.chunkSize) && opts.chunkSize > 0
      ? Math.floor(opts.chunkSize)
      : 64 * 1024;

  const report = makeProgressReporter(opts.onProgress, totalBytes);
  let bufIndex = 0;
  let offset = 0;
  let sent = 0;

  report(0, true);

  const stream = new ReadableStream({
    pull(controller) {
      try {
        if (signal?.aborted) {
          controller.error(new Error('cancelled'));
          return;
        }

        while (bufIndex < list.length) {
          const buf = list[bufIndex];
          const len = buf?.length || 0;
          if (!len || offset >= len) {
            bufIndex += 1;
            offset = 0;
            continue;
          }

          const end = Math.min(len, offset + chunkSize);
          const chunk = buf.subarray(offset, end);
          offset = end;
          sent += chunk.length;
          report(sent, false);
          controller.enqueue(chunk);
          return;
        }

        report(sent, true);
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      // no-op (fetch signal handles cancellation)
    },
  });

  return { stream, totalBytes };
}

function sanitizeFormFilename(input) {
  return String(input ?? '')
    .replace(/[\r\n\0]+/g, ' ')
    .replace(/"/g, "'")
    .trim();
}

function makeMultipartStream(sources, opts = {}) {
  const list = Array.isArray(sources)
    ? sources.filter((s) => {
        const t = String(s?.type || '');
        if (t === 'bytes') {
          const data = s?.data;
          return (
            data &&
            (typeof data.length === 'number' || typeof data.byteLength === 'number') &&
            typeof data.subarray === 'function'
          );
        }
        if (t === 'file') {
          return typeof s?.path === 'string' && s.path.trim().length > 0;
        }
        return false;
      })
    : [];

  const totalBytes =
    typeof opts.totalBytes === 'number' && Number.isFinite(opts.totalBytes) && opts.totalBytes > 0
      ? opts.totalBytes
      : list.reduce((acc, s) => {
          if (s.type === 'bytes') {
            const data = s.data;
            const len =
              typeof data?.length === 'number' ? data.length : Number(data?.byteLength || 0);
            return acc + (Number.isFinite(len) && len > 0 ? len : 0);
          }
          if (s.type === 'file') {
            const size = Number(s?.size || 0);
            return acc + (Number.isFinite(size) && size > 0 ? size : 0);
          }
          return acc;
        }, 0);

  const signal = opts.signal;
  const chunkSize =
    typeof opts.chunkSize === 'number' && Number.isFinite(opts.chunkSize) && opts.chunkSize > 0
      ? Math.floor(opts.chunkSize)
      : 64 * 1024;

  const report = makeProgressReporter(opts.onProgress, totalBytes);

  let srcIndex = 0;
  let bytesOffset = 0;
  let filePos = 0;
  let sent = 0;
  let fileHandle = null;
  let openPath = '';

  const closeHandle = async () => {
    if (!fileHandle) return;
    try {
      await fileHandle.close();
    } catch {}
    fileHandle = null;
    openPath = '';
    filePos = 0;
  };

  report(0, true);

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (signal?.aborted) {
          await closeHandle();
          controller.error(new Error('cancelled'));
          return;
        }

        while (srcIndex < list.length) {
          const src = list[srcIndex];
          if (src.type === 'bytes') {
            const data = src.data;
            const len =
              typeof data?.length === 'number' ? data.length : Number(data?.byteLength || 0);
            if (!Number.isFinite(len) || len <= 0 || bytesOffset >= len) {
              srcIndex += 1;
              bytesOffset = 0;
              continue;
            }
            const end = Math.min(len, bytesOffset + chunkSize);
            const chunk = data.subarray(bytesOffset, end);
            bytesOffset = end;
            sent += chunk.length;
            report(sent, false);
            controller.enqueue(chunk);
            return;
          }

          if (src.type === 'file') {
            const p = String(src.path || '').trim();
            const size = Number(src.size || 0);
            if (!p || !Number.isFinite(size) || size < 0) {
              await closeHandle();
              srcIndex += 1;
              continue;
            }

            if (openPath !== p) {
              await closeHandle();
              openPath = p;
            }

            if (!fileHandle && size > 0) {
              fileHandle = await fs.promises.open(p, 'r');
              filePos = 0;
            }

            const remaining = size - filePos;
            if (remaining <= 0) {
              await closeHandle();
              srcIndex += 1;
              continue;
            }

            const toRead = Math.min(chunkSize, remaining);
            const buf = Buffer.allocUnsafe(toRead);
            const { bytesRead } = await fileHandle.read(buf, 0, toRead, filePos);
            if (!bytesRead) {
              await closeHandle();
              srcIndex += 1;
              continue;
            }

            filePos += bytesRead;
            sent += bytesRead;
            report(sent, false);
            controller.enqueue(buf.subarray(0, bytesRead));
            return;
          }

          await closeHandle();
          srcIndex += 1;
          bytesOffset = 0;
        }

        await closeHandle();
        report(sent, true);
        controller.close();
      } catch (e) {
        await closeHandle();
        controller.error(e);
      }
    },
    async cancel() {
      await closeHandle();
    },
  });

  return { stream, totalBytes };
}

async function ipfsAddWithProgress(data, filename, opts = {}) {
  const signal = opts?.signal;
  const onProgress = opts?.onProgress;

  try {
    const dataBuf = toBufferPayload(data);
    if (dataBuf.length > localDriveMaxUploadBytes()) {
      return { ok: false, error: 'file_too_large' };
    }
    console.log('[electron][ipfs] adding file (progress):', filename, 'size:', dataBuf.length);

    const boundary = '----LumenIPFS' + Date.now();
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename || 'file'}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const totalBytes = headerBuf.length + dataBuf.length + footerBuf.length;

    const { stream } = makeBuffersStream([headerBuf, dataBuf, footerBuf], {
      signal,
      totalBytes,
      onProgress,
    });

    const res = await fetch(`${ipfsApiBase()}/api/v0/add?pin=true`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: stream,
      // Required by Node fetch for streaming request bodies
      duplex: 'half',
      ...(signal ? { signal } : {}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] add success:', json.Hash);
    return { ok: true, cid: json.Hash, name: json.Name, size: json.Size };
  } catch (e) {
    if (signal?.aborted || toSafeAbortError(e)) {
      return { ok: false, error: 'cancelled' };
    }
    console.error('[electron][ipfs] add error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsAddPath(filePath, filename) {
  return ipfsAddPathWithProgress(filePath, filename, {});
}


async function ipfsAddPathWithProgress(filePath, filename, opts = {}) {
  const signal = opts?.signal;

  try {
    const p = String(filePath || '').trim();
    if (!p) {
      return { ok: false, error: 'missing_path'};
    }

    const st = await fs.promises.stat(p).catch(() => null);

    console.log(st)
    if (!st || !st.isFile()) {
      return { ok: false, error: 'not_file' };
    }

    if (st.size > localDriveMaxUploadBytes()) {
      return { ok: false, error: 'file_too_large' };
    }

    const safeName =
      sanitizeFormFilename(
        filename || path.basename(p) || 'file',
      ) || 'file';

    const totalBytes = Number(st.size || 0);

    console.log(
      '[electron][ipfs] add file:',
      safeName,
      'path:',
      p,
      'size:',
      totalBytes,
    );

    // ---------------------------------------------------
    // spawn kubo
    // ---------------------------------------------------

    const ipfsBin = resolveKuboBin();
    const repoPath = getIpfsRepoPath();
    const args = [
      'add',
      '--progress',
      '--cid-version=1',
      '--quieter',
      p,
    ];

    console.log(
      '[electron][ipfs] spawn:',
      ipfsBin,
      args.join(' '),
    );

    const proc = spawn(ipfsBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        IPFS_PATH: repoPath,
        IPFS_ALLOW_BIG_BLOCK: '1'
      }
    });
    

    let stdoutBuffer = '';
    let stderrBuffer = '';

    let uploadedBytes = 0;
    let percent = 0;

    let cid = null;

    const startedAt = Date.now();

    // ---------------------------------------------------
    // cancellation
    // ---------------------------------------------------

    const onAbort = async () => {
      try {
        console.log(
          '[electron][ipfs] abort requested',
        );

        if (process.platform === 'win32') {
          spawn('taskkill', [
            '/pid',
            String(proc.pid),
            '/f',
            '/t',
          ]);
        } else {
          proc.kill('SIGTERM');

          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {}
          }, 2000);
        }
      } catch (e) {
        console.error(
          '[electron][ipfs] abort error:',
          e,
        );
      }
    };

    signal?.addEventListener?.('abort', onAbort);

    // ---------------------------------------------------
    // stdout = final cid
    // ---------------------------------------------------

    proc.stdout.on('data', chunk => {
      stdoutBuffer += String(chunk || '');
    });

    // ---------------------------------------------------
    // stderr = progress
    // ---------------------------------------------------

    proc.stderr.on('data', chunk => {
      stderrBuffer += String(chunk || '');

      const parts = stderrBuffer.split('\r');

      stderrBuffer = parts.pop() || '';

      for (const raw of parts) {
        const line = raw.trim();

        if (!line) continue;

        // example:
        // 553.00 MiB / 4.46 GiB   12.10% 00m25s

        const match = line.match(
          /([\d.]+)\s*(B|KiB|MiB|GiB)\s*\/\s*([\d.]+)\s*(B|KiB|MiB|GiB)\s+([\d.]+)%/i,
        );

        if (!match) continue;

        uploadedBytes = parseSizeToBytes(
          Number(match[1]),
          match[2],
        );

        const totalFromKubo = parseSizeToBytes(
          Number(match[3]),
          match[4],
        );

        percent = Number(match[5] || 0);

        opts?.onProgress?.({
          phase: 'upload',
          uploadedBytes,
          totalBytes:
            totalFromKubo || totalBytes,
          percent,
          fileCount: 1,
          elapsedMs:
            Date.now() - startedAt,
          filename: safeName,
          path: p,
          key: p
        });
      }
    });

    // ---------------------------------------------------
    // wait process end
    // ---------------------------------------------------

    const exitCode = await new Promise(
      (resolve, reject) => {
        proc.once('error', reject);

        proc.once('close', code => {
          resolve(code);
        });
      },
    );

    signal?.removeEventListener?.(
      'abort',
      onAbort,
    );

    // ---------------------------------------------------
    // cancelled
    // ---------------------------------------------------

    if (signal?.aborted) {
      return {
        ok: false,
        error: 'cancelled',
      };
    }

    // ---------------------------------------------------
    // non-zero exit
    // ---------------------------------------------------

    if (Number(exitCode) !== 0) {
      return {
        ok: false,
        error:
          stderrBuffer?.trim() ||
          `ipfs_add_exit_${exitCode}`,
      };
    }

    // ---------------------------------------------------
    // parse cid
    // ---------------------------------------------------

    const stdoutLines = stdoutBuffer
      .split(/\r?\n/)
      .map(v =>
        String(v || '').trim(),
      )
      .filter(Boolean);

    cid = stdoutLines.at(-1) || null;

    if (!cid) {
      return {
        ok: false,
        error: 'missing_cid',
      };
    }

    // ---------------------------------------------------
    // final progress
    // ---------------------------------------------------

    opts?.onProgress?.({
      phase: 'done',
      uploadedBytes: totalBytes,
      totalBytes,
      percent: 100,
      fileCount: 1,
      elapsedMs: Date.now() - startedAt,
      filename: safeName,
      path: p,
    });

    console.log(
      '[electron][ipfs] add success:',
      cid,
    );

      spawn(ipfsBin, [
        'routing',
        'provide',
        cid,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          IPFS_PATH: repoPath,
          IPFS_ALLOW_BIG_BLOCK: '1',
        },
      });

    return {
      ok: true,
      cid,
      rootCid: cid,
      name: safeName,
      filename: safeName,
      path: p,
      totalBytes,
      uploadedBytes: totalBytes,
      fileBytes: totalBytes,
      fileCount: 1,
      percent: 100,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (e) {
    if (
      signal?.aborted ||
      toSafeAbortError?.(e)
    ) {
      return {
        ok: false,
        error: 'cancelled',
      };
    }

    console.error(
      '[electron][ipfs] add path error:',
      e,
    );

    return {
      ok: false,
      error: String(e?.message || e),
    };
  }
}

async function ipfsAddDirectoryWithProgress(payload, opts = {}) {
  const signal = opts?.signal;
  const onProgress = opts?.onProgress;

  try {
    const filesRaw = Array.isArray(payload?.files) ? payload.files : [];
    if (!filesRaw.length) return { ok: false, error: 'no_files' };
    const rootName = String(payload?.rootName ?? '').trim();

    const boundary = '----LumenIPFS' + Date.now();
    const buffers = [];
    let dataBytes = 0;
    let totalBodyBytes = 0;
    const maxUploadBytes = localDriveMaxUploadBytes();

    for (const f of filesRaw) {
      const rel = sanitizeRelativePath(f?.path ?? f?.name ?? 'file');
      const fullName = rel;
      const dataBuf = toBufferPayload(f?.data);
      dataBytes += dataBuf.length;
      if (dataBytes > maxUploadBytes) throw new Error('directory_too_large');

      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fullName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n`;
      const headerBuf = Buffer.from(header, 'utf8');
      const footerBuf = Buffer.from(footer, 'utf8');

      totalBodyBytes += headerBuf.length + dataBuf.length + footerBuf.length;
      buffers.push(headerBuf, dataBuf, footerBuf);
    }

    const closing = Buffer.from(`--${boundary}--\r\n`, 'utf8');
    totalBodyBytes += closing.length;
    buffers.push(closing);

    const { stream } = makeBuffersStream(buffers, {
      signal,
      totalBytes: totalBodyBytes,
      onProgress,
    });

    const url = new URL(`${ipfsApiBase()}/api/v0/add`);
    url.searchParams.set('pin', 'true');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: stream,
      // Required by Node fetch for streaming request bodies
      duplex: 'half',
      ...(signal ? { signal } : {}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add directory failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const text = await res.text().catch(() => '');
    const lines = String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        if (j && j.Hash) entries.push({ cid: j.Hash, name: j.Name, size: j.Size });
      } catch {
        // ignore bad lines
      }
    }

    const last = entries[entries.length - 1] || null;
    const rootNameFromPaths = (() => {
      const first = filesRaw[0];
      const rel = sanitizeRelativePath(first?.path ?? first?.name ?? 'file');
      const seg = rel.split('/').filter(Boolean)[0] || '';
      return seg;
    })();
    const expectedRoot = rootName || rootNameFromPaths;
    const rootEntry = expectedRoot
      ? entries.find((e) => String(e?.name || '') === expectedRoot) || null
      : null;
    const rootCid = (rootEntry?.cid ? String(rootEntry.cid) : '') || (last?.cid ? String(last.cid) : '');
    if (!rootCid) return { ok: false, error: 'no_root_cid' };

    console.log('[electron][ipfs] add directory success:', rootCid, 'name:', expectedRoot || '', 'files:', filesRaw.length);
    return { ok: true, cid: rootCid, name: expectedRoot || '', entries };
  } catch (e) {
    if (signal?.aborted || toSafeAbortError(e)) {
      return { ok: false, error: 'cancelled' };
    }
    console.error('[electron][ipfs] add directory error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsAddDirectoryPaths(payload) {
  return ipfsAddDirectoryPathsWithProgress(payload, {});
}

async function ipfsAddDirectoryPathsWithProgress(payload, opts = {}) {
  const signal = opts?.signal;
  const onProgress = opts?.onProgress;

  try {
    const filesRaw = Array.isArray(payload?.files) ? payload.files : [];
    if (!filesRaw.length) return { ok: false, error: 'no_files' };
    const rootName = String(payload?.rootName ?? '').trim();

    const boundary = '----LumenIPFS' + Date.now();
    const sources = [];
    let dataBytes = 0;
    let totalBodyBytes = 0;
    const maxUploadBytes = localDriveMaxUploadBytes();

    for (const f of filesRaw) {
      const rel = sanitizeRelativePath(f?.path ?? f?.name ?? 'file');
      const fullName = sanitizeFormFilename(rel) || rel;
      const filePath = String(f?.filePath ?? '').trim();
      if (!filePath) throw new Error('invalid_payload');

      const st = await fs.promises.stat(filePath).catch(() => null);
      if (!st || !st.isFile()) throw new Error('not_file');

      dataBytes += st.size;
      if (dataBytes > maxUploadBytes) throw new Error('directory_too_large');

      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fullName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n`;
      const headerBuf = Buffer.from(header, 'utf8');
      const footerBuf = Buffer.from(footer, 'utf8');

      totalBodyBytes += headerBuf.length + st.size + footerBuf.length;
      sources.push(
        { type: 'bytes', data: headerBuf },
        { type: 'file', path: filePath, size: st.size },
        { type: 'bytes', data: footerBuf },
      );
    }

    const closing = Buffer.from(`--${boundary}--\r\n`, 'utf8');
    totalBodyBytes += closing.length;
    sources.push({ type: 'bytes', data: closing });

    const { stream } = makeMultipartStream(sources, {
      signal,
      totalBytes: totalBodyBytes,
      onProgress,
    });

    const url = new URL(`${ipfsApiBase()}/api/v0/add`);
    url.searchParams.set('pin', 'true');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: stream,
      // Required by Node fetch for streaming request bodies
      duplex: 'half',
      ...(signal ? { signal } : {}),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add directory paths failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const text = await res.text().catch(() => '');
    const lines = String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        if (j && j.Hash) entries.push({ cid: j.Hash, name: j.Name, size: j.Size });
      } catch {
        // ignore bad lines
      }
    }

    const last = entries[entries.length - 1] || null;
    const rootNameFromPaths = (() => {
      const first = filesRaw[0];
      const rel2 = sanitizeRelativePath(first?.path ?? first?.name ?? 'file');
      const seg = rel2.split('/').filter(Boolean)[0] || '';
      return seg;
    })();
    const expectedRoot = rootName || rootNameFromPaths;
    const rootEntry = expectedRoot
      ? entries.find((e) => String(e?.name || '') === expectedRoot) || null
      : null;
    const rootCid =
      (rootEntry?.cid ? String(rootEntry.cid) : '') || (last?.cid ? String(last.cid) : '');
    if (!rootCid) return { ok: false, error: 'no_root_cid' };

    console.log(
      '[electron][ipfs] add directory paths success:',
      rootCid,
      'name:',
      expectedRoot || '',
      'files:',
      filesRaw.length,
    );
    return {
      ok: true,
      cid: rootCid,
      name: expectedRoot || '',
      entries,
      totalBytes: dataBytes,
      fileCount: filesRaw.length,
    };
  } catch (e) {
    if (signal?.aborted || toSafeAbortError(e)) {
      return { ok: false, error: 'cancelled' };
    }
    console.error('[electron][ipfs] add directory paths error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsAddDirectoryFromPath(payload) {
  return ipfsAddDirectoryFromPathWithProgress(payload, {});
}

async function ipfsAddDirectoryFromPathWithProgress(payload, opts = {}) {
  const signal = opts?.signal;
  let rootCid = null;

  const log = (...a) => console.log('[ipfs:debug]', ...a);
  const logErr = (...a) => console.error('[ipfs:debug][stderr]', ...a);

  try {
    log('START upload (directory)');

    const rootPath = String(payload?.rootPath ?? payload?.path ?? '').trim();
    if (!rootPath) return { ok: false, error: 'missing_path' };

    const st = await fs.promises.stat(rootPath).catch(() => null);
    if (!st || !st.isDirectory()) return { ok: false, error: 'not_directory' };

    const rootName = String(payload?.rootName ?? path.basename(rootPath) ?? '').trim() || 'folder';

    // Scan
    log('START scan FS');
    let totalBytes = 0, totalFiles = 0;
    const stack = [''];

    while (stack.length) {
      if (signal?.aborted) throw new Error('cancelled');
      const relDir = stack.pop();
      const absDir = relDir ? path.join(rootPath, relDir) : rootPath;

      const ents = await fs.promises.readdir(absDir, { withFileTypes: true }).catch(() => []);

      for (const ent of ents) {
        if (ent.isDirectory()) {
          stack.push(relDir ? path.join(relDir, ent.name) : ent.name);
          continue;
        }
        if (!ent.isFile()) continue;

        const fst = await fs.promises.stat(path.join(rootPath, relDir || '', ent.name)).catch(() => null);
        if (fst) {
          totalBytes += Number(fst.size || 0);
          totalFiles++;
        }
      }
    }

    log('SCAN DONE', { totalBytes: (totalBytes / 1073741824).toFixed(2) + ' GiB', totalFiles });

    if (!totalFiles) return { ok: false, error: 'no_files' };

    // Stop daemon
    const ipfsBin = resolveKuboBin();
    const repoPath = getIpfsRepoPath();

    log('REPO PATH:', repoPath);
    await fs.promises.unlink(path.join(repoPath, 'api')).catch(() => {});
    await fs.promises.unlink(path.join(repoPath, 'repo.lock')).catch(() => {});

    log('Arrêt du daemon...');
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/im', 'ipfs.exe', '/f']);
      spawnSync('taskkill', ['/im', 'kubo.exe', '/f']);
    } else {
      spawnSync('pkill', ['-f', 'ipfs']);
      spawnSync('pkill', ['-f', 'kubo']);
    }
    await new Promise(r => setTimeout(r, 2200));

    const args = [
      'add', '-r',
      '--progress',
      '--cid-version=1',
      '--offline',
      '--quieter',
      '--raw-leaves',
      rootPath
    ];

    const proc = spawn(ipfsBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, IPFS_PATH: repoPath, IPFS_ALLOW_BIG_BLOCK: '1' }
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    const startedAt = Date.now();

    const onAbort = () => {
      log('ABORT REQUESTED');
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
      else { proc.kill('SIGTERM'); setTimeout(() => proc.kill('SIGKILL'), 2000); }
    };
    signal?.addEventListener?.('abort', onAbort);

    proc.stdout.on('data', chunk => {
      const str = String(chunk);
      stdoutBuffer += str;
      const match = str.match(/(bafy[a-z2-7]{50,})/);
      if (match) rootCid = match[1];
    });

    proc.stderr.on('data', chunk => {
      const str = String(chunk);
      stderrBuffer += str;
      if (stderrBuffer.length > 400000) stderrBuffer = stderrBuffer.slice(-150000);

      const lines = str.split(/\r?\n|\r/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (line.includes('being used by another process') || line.includes('cannot access the file')) {
          log('Fichier verrouillé ignoré:', line);
          continue;
        }

        const match = line.match(/([\d.]+)\s*(B|KiB|MiB|GiB)\s*\/\s*([\d.]+)\s*(B|KiB|MiB|GiB)\s+([\d.]+)%/i);
        if (match) {
          const uploaded = parseSizeToBytes(Number(match[1]), match[2]);
          const percent = Number(match[5] || 0);
          opts?.onProgress?.({
            phase: 'upload',
            uploadedBytes: uploaded,
            totalBytes,
            percent,
            fileCount: totalFiles,
            elapsedMs: Date.now() - startedAt
          });
        }
      }
    });

    const exitCode = await new Promise((resolve, reject) => {
      proc.once('error', reject);
      proc.once('close', code => resolve(code));
    });

    signal?.removeEventListener?.('abort', onAbort);

    if (signal?.aborted) return { ok: false, error: 'cancelled' };

    // On tolère une sortie non-zero si on a déjà un CID (fichiers verrouillés à la fin)
    if (exitCode !== 0 && !rootCid) {
      log('NON ZERO EXIT - last stderr:', stderrBuffer.slice(-3000));
      return { ok: false, error: 'ipfs_add_failed' };
    }

    // CID final
    await new Promise(r => setTimeout(r, 800));
    const cidMatch = stdoutBuffer.match(/(bafy[a-z2-7]{50,})/g);
    rootCid = cidMatch?.at(-1) || rootCid;

    if (!rootCid) return { ok: false, error: 'missing_root_cid' };

    opts?.onProgress?.({
      phase: 'done',
      uploadedBytes: totalBytes,
      totalBytes,
      percent: 100,
      fileCount: totalFiles,
      elapsedMs: Date.now() - startedAt,
    });

    log('SUCCESS → CID:', rootCid);


    startIpfsDaemon(() => {
      spawn(ipfsBin, [
        'routing',
        'provide',
        rootCid,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          IPFS_PATH: repoPath,
          IPFS_ALLOW_BIG_BLOCK: '1',
        },
      });
    });


    

    return {
      ok: true,
      cid: rootCid,
      rootCid,
      rootPath,
      rootName,
      totalBytes,
      fileCount: totalFiles
    };

  } catch (e) {
    logErr('FATAL ERROR:', e);
    startIpfsDaemon();
    return { ok: false, error: String(e?.message || e) };
  }
}

function parseSizeToBytes(value, unit) {
  const v = Number(value || 0);

  switch (String(unit || '').toLowerCase()) {
    case 'gib':
      return v * 1024 * 1024 * 1024;

    case 'mib':
      return v * 1024 * 1024;

    case 'kib':
      return v * 1024;

    default:
      return v;
  }
}


function toBufferPayload(data) {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (Array.isArray(data)) return Buffer.from(Uint8Array.from(data));
  throw new Error('invalid_payload');
}

function sanitizeRelativePath(p) {
  const raw = String(p ?? '').trim().replace(/\\/g, '/');
  const cleaned = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleaned) throw new Error('Empty file path');
  if (cleaned.length > 500) throw new Error('File path too long');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..')) throw new Error('Invalid path');
  return segments.join('/');
}

async function ipfsAddDirectory(payload) {
  try {
    const filesRaw = Array.isArray(payload?.files) ? payload.files : [];
    if (!filesRaw.length) return { ok: false, error: 'no_files' };
    const rootName = String(payload?.rootName ?? '').trim();

    const boundary = '----LumenIPFS' + Date.now();
    const parts = [];
    let totalBytes = 0;
    const maxUploadBytes = localDriveMaxUploadBytes();

    for (const f of filesRaw) {
      const rel = sanitizeRelativePath(f?.path ?? f?.name ?? 'file');
      const fullName = rel;
      const dataBuf = toBufferPayload(f?.data);
      totalBytes += dataBuf.length;
      if (totalBytes > maxUploadBytes) throw new Error('directory_too_large');

      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fullName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n`;
      parts.push(Buffer.from(header, 'utf8'));
      parts.push(dataBuf);
      parts.push(Buffer.from(footer, 'utf8'));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);

    const url = new URL(`${ipfsApiBase()}/api/v0/add`);
    url.searchParams.set('pin', 'true');

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] add directory failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const text = await res.text().catch(() => '');
    const lines = String(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        if (j && j.Hash) entries.push({ cid: j.Hash, name: j.Name, size: j.Size });
      } catch {
        // ignore bad lines
      }
    }

    const last = entries[entries.length - 1] || null;
    const rootNameFromPaths = (() => {
      const first = filesRaw[0];
      const rel = sanitizeRelativePath(first?.path ?? first?.name ?? 'file');
      const seg = rel.split('/').filter(Boolean)[0] || '';
      return seg;
    })();
    const expectedRoot = rootName || rootNameFromPaths;
    const rootEntry = expectedRoot
      ? entries.find((e) => String(e?.name || '') === expectedRoot) || null
      : null;
    const rootCid = (rootEntry?.cid ? String(rootEntry.cid) : '') || (last?.cid ? String(last.cid) : '');
    if (!rootCid) return { ok: false, error: 'no_root_cid' };

    console.log('[electron][ipfs] add directory success:', rootCid, 'name:', expectedRoot || '', 'files:', filesRaw.length);
    return { ok: true, cid: rootCid, name: expectedRoot || '', entries };
  } catch (e) {
    console.error('[electron][ipfs] add directory error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}
function encodeUrlPathSegments(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p));
  return '/' + parts.join('/');
}

function normalizeGatewayTarget(input) {
  const s = String(input ?? '').trim();
  if (!s) throw new Error('Empty CID or path');
  if (/^\/ipfs\//i.test(s) || /^\/ipns\//i.test(s)) return s;
  if (/^ipfs\//i.test(s) || /^ipns\//i.test(s)) return '/' + s;
  return '/ipfs/' + s.replace(/^\/+/, '');
}

function buildGatewayUrl(base, cidOrPath) {
  const b = String(base || '').replace(/\/+$/, '');
  if (!b) throw new Error('gateway_base_missing');
  const target = normalizeGatewayTarget(cidOrPath);
  return `${b}${encodeUrlPathSegments(target)}`;
}

async function fetchBytesFromUrl(url, opts) {
  const signal = opts?.signal;
  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok && res.status !== 206) {
    const text = await res.text().catch(() => '');
    throw new Error(`http_${res.status}${text ? ':' + text.slice(0, 160) : ''}`);
  }
  return await res.arrayBuffer();
}

async function fetchBytesFromKuboCat(arg, opts) {
  const signal = opts?.signal;
  const url = new URL(`${ipfsApiBase()}/api/v0/cat`);
  url.searchParams.set('arg', String(arg ?? ''));
  const res = await fetch(url.toString(), { method: 'POST', signal });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`kubo_http_${res.status}${text ? ':' + text.slice(0, 160) : ''}`);
  }
  return await res.arrayBuffer();
}

async function ipfsGet(cidOrPath, options = {}) {
  const defaultGateways = [
    // conservative, well-known public fallbacks
    'https://ipfs.io',
    'https://dweb.link',
  ];

  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    const timeoutMs =
      typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : 12000;

    // ============================================================================
    // Private Gateway Support
    // ============================================================================
    // Try private gateways first if configured
    try {
      const { fetchFromPrivateGateways } = require('./gateway-client.cjs');
      const { loadPrivateCloudConfig } = require('./settings.cjs');
      
      const privateConfig = loadPrivateCloudConfig();
      if (privateConfig.enabled && privateConfig.gatewayIds && privateConfig.gatewayIds.length > 0) {
        console.log('[electron][ipfs] trying private gateways for:', arg);
        
        // Get wallet address and mnemonic for authentication
        const { getWalletAddressForProfile, loadMnemonic, loadProfilesFile } = require('./ipc/gateway.cjs');
        
        try {
          // Get active profile
          const profilesData = loadProfilesFile();
          const activeProfileId = profilesData.activeId;
          
          if (activeProfileId) {
            const walletAddress = getWalletAddressForProfile(activeProfileId);
            const mnemonic = loadMnemonic(activeProfileId);
            
            if (walletAddress && mnemonic) {
              const privateContent = await fetchFromPrivateGateways(
                arg, 
                walletAddress, 
                mnemonic,
                { timeout: privateConfig.timeout || 5000 }
              );
              
              if (privateContent) {
                const bytes = new Uint8Array(privateContent);
                console.log('[electron][ipfs] get success from private gateway, size:', bytes.byteLength);
                try { recordCidResolutionSuccess(); } catch {}
                return { ok: true, data: Array.from(bytes), source: 'private_gateway' };
              }
            } else {
              console.warn('[electron][ipfs] no wallet credentials available for private gateway auth');
            }
          } else {
            console.warn('[electron][ipfs] no active profile for private gateway auth');
          }
        } catch (privateErr) {
          console.warn('[electron][ipfs] private gateway attempt failed:', privateErr.message);
          // Continue to fallback gateways
        }
        
        // If fallback is disabled, return error
        if (!privateConfig.fallbackToDAO) {
          console.warn('[electron][ipfs] private gateways failed and fallback disabled');
          return { ok: false, error: 'Private gateways failed and fallback disabled' };
        }
      }
    } catch (privateGatewayErr) {
      console.warn('[electron][ipfs] private gateway module error:', privateGatewayErr.message);
      // Continue to standard flow
    }
    // ============================================================================

    const extraGateways = Array.isArray(options?.gateways) ? options.gateways : [];
    const extraBases = Array.from(
      new Set(extraGateways.map((x) => String(x || '').trim().replace(/\/+$/, '')).filter(Boolean))
    );
    const publicBases = Array.from(
      new Set(defaultGateways.map((x) => String(x || '').trim().replace(/\/+$/, '')).filter(Boolean))
    );

    const localGatewayUrl = buildGatewayUrl(localGatewayBase(), arg);

    const controllers = [];
    const timers = [];

    function makeTask(name, fn) {
      const controller = new AbortController();
      const t = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, timeoutMs);

      controllers.push(controller);
      timers.push(t);

      const promise = fn(controller.signal)
        .then((buffer) => ({ name, buffer, controller }))
        .finally(() => {
          try {
            clearTimeout(t);
          } catch {
            // ignore
          }
        });

      return { name, controller, promise };
    }

    function abortAllExcept(winnerController) {
      for (const c of controllers) {
        if (c === winnerController) continue;
        try {
          c.abort();
        } catch {
          // ignore
        }
      }
    }

    async function raceTasks(taskObjs) {
      const wrapped = taskObjs.map((t) =>
        t.promise.then((res) => {
          abortAllExcept(t.controller);
          return res;
        })
      );
      return await Promise.any(wrapped);
    }

    const stage1 = [];
    stage1.push(makeTask('kubo_cat', (signal) => fetchBytesFromKuboCat(arg, { signal })));
    stage1.push(makeTask('local_gateway', (signal) => fetchBytesFromUrl(localGatewayUrl, { signal })));
    for (const base of extraBases) {
      const url = buildGatewayUrl(base, arg);
      stage1.push(makeTask(`gateway:${base}`, (signal) => fetchBytesFromUrl(url, { signal })));
    }

    console.log('[electron][ipfs] getting file:', arg, 'sources:', stage1.length + publicBases.length);
    let winner;
    try {
      try {
        winner = await raceTasks(stage1);
      } catch (_stage1Err) {
        // Last-resort fallbacks: public gateways are slower and less private, so only use them
        // once local/Kubo/whitelisted sources have all failed.
        const stage2 = [];
        for (const base of publicBases) {
          const url = buildGatewayUrl(base, arg);
          stage2.push(makeTask(`public_gateway:${base}`, (signal) => fetchBytesFromUrl(url, { signal })));
        }
        winner = await raceTasks(stage2);
      }
    } finally {
      for (const t of timers) {
        try {
          clearTimeout(t);
        } catch {
          // ignore
        }
      }
    }
    const bytes = new Uint8Array(winner.buffer);
    console.log('[electron][ipfs] get success from', winner.name, 'size:', bytes.byteLength);
    try { recordCidResolutionSuccess(); } catch {}
    return { ok: true, data: Array.from(bytes), source: winner.name };
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('[electron][ipfs] get error:', msg);
    if (!/^(Empty CID or path|CID\/path too long)\b/i.test(msg)) {
      try { recordCidResolutionFailure(); } catch {}
    }
    return { ok: false, error: msg };
  }
}

async function ipfsPinList() {
  try {
    const res = await fetch(`${ipfsApiBase()}/api/v0/pin/ls?type=recursive`, {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    const pins = Object.keys(json.Keys || {})
      .map((x) => String(x || '').trim())
      .filter((x) => x && x.toLowerCase() !== 'unknown');
    console.log('[electron][ipfs] pin list:', pins.length, 'items');
    return { ok: true, pins };
  } catch (e) {
    console.error('[electron][ipfs] pin list error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsPinAdd(cidOrPath) {
  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    console.log('[electron][ipfs] pin add:', arg);
    const url = new URL(`${ipfsApiBase()}/api/v0/pin/add`);
    url.searchParams.set('arg', arg);
    url.searchParams.set('recursive', 'true');
    const res = await requestTextViaNodeHttp(url.toString(), {
      method: 'POST',
      timeoutMs: DEFAULT_IPFS_PIN_ADD_TIMEOUT_MS
    });

    if (!res.ok) {
      const errText = String(res.text || '').trim();
      console.warn('[electron][ipfs] pin add failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const bodyText = String(res.text || '');
    let pins = [];
    try {
      const json = JSON.parse(bodyText || 'null');
      if (Array.isArray(json?.Pins)) pins = json.Pins.map((p) => String(p || '')).filter(Boolean);
    } catch {
      // Some IPFS setups can stream newline-delimited JSON.
      const lines = String(bodyText || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const json = JSON.parse(lines[i]);
          if (Array.isArray(json?.Pins)) {
            pins = json.Pins.map((p) => String(p || '')).filter(Boolean);
            break;
          }
        } catch {}
      }
    }

    // Fallback: if the response body isn't parseable / doesn't include Pins (happens on some gateways),
    // confirm what was pinned by querying pin/ls for the same arg. This is important because callers
    // persist metadata (names) keyed by the pinned CID, and Kubo may pin the resolved leaf CID when
    // arg is a path like /ipfs/<root>/<file>.
    if (!pins.length) {
      const check = await ipfsPinLs(arg, 'recursive').catch(() => null);
      const keys = check?.ok && Array.isArray(check.keys) ? check.keys : [];
      pins = keys.map((k) => String(k || '')).filter(Boolean);
    }

    return pins.length ? { ok: true, pins, pinnedCid: pins[0] } : { ok: true };
  } catch (e) {
    console.error('[electron][ipfs] pin add error:', e);
    const msg = String(e?.message || e);
    if (/ipfs_request_timeout_\d+ms/i.test(msg)) {
      return { ok: false, error: 'pin_add_timeout' };
    }
    return { ok: false, error: msg };
  }
}

async function ipfsPinLs(cidOrPath, type = 'recursive') {
  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    const pinType = String(type || 'recursive');
    const url = new URL(`${ipfsApiBase()}/api/v0/pin/ls`);
    url.searchParams.set('arg', arg);
    url.searchParams.set('type', pinType);
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || 'http_' + res.status };
    }

    const json = await res.json().catch(() => null);
    const keys = json && typeof json.Keys === 'object' ? Object.keys(json.Keys) : [];
    return { ok: true, pinned: keys.length > 0, keys };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsPinRm(cidOrPath) {
  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    const url = new URL(`${ipfsApiBase()}/api/v0/pin/rm`);
    url.searchParams.set('arg', arg);
    url.searchParams.set('recursive', 'true');
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || 'http_' + res.status };
    }

    await res.text().catch(() => '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsObjectStat(cidOrPath) {
  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    const url = new URL(`${ipfsApiBase()}/api/v0/object/stat`);
    url.searchParams.set('arg', arg);
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || 'http_' + res.status };
    }

    const json = await res.json().catch(() => null);
    const cumulativeSize = Number(json?.CumulativeSize ?? NaN);
    const dataSize = Number(json?.DataSize ?? NaN);
    const blockSize = Number(json?.BlockSize ?? NaN);
    const linksSize = Number(json?.LinksSize ?? NaN);
    const numLinks = Number(json?.NumLinks ?? NaN);

    return {
      ok: true,
      cumulativeSize: Number.isFinite(cumulativeSize) ? cumulativeSize : null,
      dataSize: Number.isFinite(dataSize) ? dataSize : null,
      blockSize: Number.isFinite(blockSize) ? blockSize : null,
      linksSize: Number.isFinite(linksSize) ? linksSize : null,
      numLinks: Number.isFinite(numLinks) ? numLinks : null,
      raw: json
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function sanitizeCidOrPath(input) {
  const s = String(input ?? '').trim();
  if (!s) throw new Error('Empty CID or path');
  if (/^\/ipfs\//i.test(s) || /^\/ipns\//i.test(s)) return s;
  if (/^ipfs\//i.test(s) || /^ipns\//i.test(s)) return '/' + s;
  if (s.length > 1024) throw new Error('CID/path too long');
  return s;
}

function mapLsObject(obj) {
  const type = obj?.Type === 1 ? 'dir' : obj?.Type === 2 ? 'file' : 'unknown';
  return {
    cid: String(obj?.Hash ?? ''),
    name: String(obj?.Name ?? ''),
    size: typeof obj?.Size === 'number' ? obj.Size : null,
    type,
  };
}

async function ipfsLs(cidOrPath) {
  try {
    const arg = sanitizeCidOrPath(cidOrPath);
    const url = new URL(`${ipfsApiBase()}/api/v0/ls`);
    url.searchParams.set('arg', arg);
    url.searchParams.set('resolve-type', 'true');
    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `http_${res.status}`);
    }
    const data = await res.json().catch(() => null);
    const list =
      Array.isArray(data?.Objects) && data.Objects.length
        ? (data.Objects[0]?.Links ?? []).map(mapLsObject)
        : Array.isArray(data?.Links)
          ? data.Links.map(mapLsObject)
          : [];
    return { ok: true, entries: list };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsUnpin(cid) {
  try {
    const arg = sanitizeCidOrPath(cid);
    console.log('[electron][ipfs] unpinning:', arg);
    const url = new URL(`${ipfsApiBase()}/api/v0/pin/rm`);
    url.searchParams.set('arg', arg);
    url.searchParams.set('recursive', 'true');
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] unpin failed:', res.status, errText);
      return { ok: false, error: errText || 'http_' + res.status };
    }

    await res.text().catch(() => '');
    console.log('[electron][ipfs] unpin success');
    return { ok: true };
  } catch (e) {
    console.error('[electron][ipfs] unpin error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsStats() {
  try {
    const res = await fetch(`${ipfsApiBase()}/api/v0/repo/stat`, {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    return { 
      ok: true, 
      repoSize: json.RepoSize,
      storageMax: json.StorageMax,
      numObjects: json.NumObjects
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsPublishToIPNS(cid, key = 'self', options = {}) {
  try {
    const keyName = String(key ?? 'self').trim() || 'self';
    if (options?.autoCreateKey && keyName !== 'self') {
      const listed = await ipfsKeyList().catch((e) => ({ ok: false, error: String(e?.message || e) }));
      const keys = Array.isArray(listed?.keys) ? listed.keys : [];
      const exists = keys.some((item) => String(item?.Name || item?.name || '').trim() === keyName);
      if (!exists && listed?.ok) {
        const created = await ipfsKeyGen(keyName);
        if (!created?.ok) return { ok: false, error: created?.error || 'ipns_key_create_failed' };
      }
    }

    console.log('[electron][ipfs] publishing to IPNS:', cid, 'key:', keyName);
    const url = new URL(`${ipfsApiBase()}/api/v0/name/publish`);
    url.searchParams.set('arg', `/ipfs/${String(cid ?? '')}`);
    url.searchParams.set('key', keyName);
    url.searchParams.set('allow-offline', 'true');
    url.searchParams.set('resolve', 'false');
    const timeoutMs =
      typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? Math.floor(options.timeoutMs)
        : 60000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url.toString(), { method: 'POST', signal: controller.signal }).finally(() => {
      try { clearTimeout(t); } catch {}
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] IPNS publish failed:', res.status, errText);
      return { ok: false, error: errText ? `http_${res.status}: ${errText.slice(0, 512)}` : 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] IPNS publish success:', json.Name);
    return { ok: true, name: json.Name, value: json.Value };
  } catch (e) {
    console.error('[electron][ipfs] IPNS publish error:', e);
    const aborted = e?.name === 'AbortError';
    return { ok: false, error: aborted ? 'ipns_publish_timeout' : String(e?.message || e) };
  }
}

async function ipfsResolveIPNS(name) {
  try {
    console.log('[electron][ipfs] resolving IPNS:', name);
    const url = new URL(`${ipfsApiBase()}/api/v0/name/resolve`);
    url.searchParams.set('arg', String(name ?? ''));
    url.searchParams.set('nocache', 'true');
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] IPNS resolve failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] IPNS resolve success:', json.Path);
    return { ok: true, path: json.Path };
  } catch (e) {
    console.error('[electron][ipfs] IPNS resolve error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsKeyList() {
  try {
    let lastError = '';
    for (const endpoint of ['key/ls', 'key/list']) {
      const res = await fetch(`${ipfsApiBase()}/api/v0/${endpoint}?ipns-base=base36`, {
        method: 'POST'
      });

      if (!res.ok) {
        lastError = 'http_' + res.status;
        if (res.status === 404) continue;
        return { ok: false, error: lastError };
      }

      const json = await res.json();
      console.log('[electron][ipfs] key list:', json.Keys?.length || 0, 'keys');
      return { ok: true, keys: json.Keys || [] };
    }
    return { ok: false, error: lastError || 'key_list_unavailable' };
  } catch (e) {
    console.error('[electron][ipfs] key list error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

function runKuboCommand(args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve) => {
    const bin = resolveKuboBin();
    const repoPath = getIpfsRepoPath();
    const child = spawn(bin, args, {
      env: {
        ...process.env,
        IPFS_PATH: repoPath,
        IPFS_ALLOW_BIG_BLOCK: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve({ ok: false, code: null, stdout, stderr, error: `kubo_timeout_${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, stdout, stderr, error: String(e?.message || e) });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      const ok = Number(code) === 0;
      resolve({
        ok,
        code: Number.isFinite(Number(code)) ? Number(code) : null,
        stdout,
        stderr,
        error: ok ? '' : String(stderr || stdout || `kubo_exit_${code}`).trim(),
      });
    });
  });
}

async function ipfsKeyGen(name) {
  try {
    console.log('[electron][ipfs] generating key:', name);
    const url = new URL(`${ipfsApiBase()}/api/v0/key/gen`);
    url.searchParams.set('arg', String(name ?? ''));
    url.searchParams.set('type', 'rsa');
    url.searchParams.set('size', '2048');
    const res = await fetch(url.toString(), { method: 'POST' });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[electron][ipfs] key gen failed:', res.status, errText);
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    console.log('[electron][ipfs] key gen success:', json.Name, json.Id);
    return { ok: true, name: json.Name, id: json.Id };
  } catch (e) {
    console.error('[electron][ipfs] key gen error:', e);
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsKeyRename(oldName, newName) {
  const currentName = String(oldName || '').trim();
  const nextName = String(newName || '').trim();
  if (!currentName) return { ok: false, error: 'missing_key_name' };
  if (!nextName) return { ok: false, error: 'missing_new_key_name' };
  if (currentName === 'self' || nextName === 'self') return { ok: false, error: 'cannot_rename_self_key' };
  if (currentName === nextName) return { ok: true, name: nextName, unchanged: true };

  try {
    const url = new URL(`${ipfsApiBase()}/api/v0/key/rename`);
    url.searchParams.append('arg', currentName);
    url.searchParams.append('arg', nextName);
    url.searchParams.set('ipns-base', 'base36');
    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || 'http_' + res.status };
    }
    const json = await res.json().catch(() => ({}));
    return {
      ok: true,
      id: String(json?.Id || '').trim(),
      name: String(json?.Now || nextName).trim(),
      oldName: String(json?.Was || currentName).trim(),
      overwrite: !!json?.Overwrite,
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsKeyImportFromPath(name, filePath) {
  const keyName = String(name || '').trim();
  const sourcePath = String(filePath || '').trim();
  if (!keyName) return { ok: false, error: 'missing_key_name' };
  if (!sourcePath) return { ok: false, error: 'missing_key_path' };
  if (!fs.existsSync(sourcePath)) return { ok: false, error: 'key_file_not_found' };

  const formats = ['pem-pkcs8-cleartext', 'libp2p-protobuf-cleartext'];
  let lastError = '';
  for (const format of formats) {
    const res = await runKuboCommand(
      ['key', 'import', keyName, sourcePath, '--format', format, '--ipns-base', 'base36'],
      { timeoutMs: 30_000 }
    );
    if (res.ok) {
      const listed = await ipfsKeyList();
      const keys = Array.isArray(listed?.keys) ? listed.keys : [];
      const hit = keys.find((key) => String(key?.Name || key?.name || '').trim() === keyName);
      return {
        ok: true,
        name: keyName,
        id: String(hit?.Id || hit?.id || '').trim(),
        format,
      };
    }
    lastError = String(res.error || '').trim();
  }
  return { ok: false, error: lastError || 'key_import_failed' };
}

async function ipfsKeyExportToPath(name, filePath) {
  const keyName = String(name || '').trim();
  const targetPath = String(filePath || '').trim();
  if (!keyName) return { ok: false, error: 'missing_key_name' };
  if (keyName === 'self') return { ok: false, error: 'cannot_export_self_key' };
  if (!targetPath) return { ok: false, error: 'missing_export_path' };

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) return { ok: false, error: 'export_directory_not_found' };
  const res = await runKuboCommand(
    ['key', 'export', keyName, '--format', 'pem-pkcs8-cleartext', '-o', targetPath],
    { timeoutMs: 30_000 }
  );
  if (!res.ok) return { ok: false, error: String(res.error || 'key_export_failed') };
  return { ok: true, path: targetPath, name: keyName, format: 'pem-pkcs8-cleartext' };
}

async function ipfsKeyRm(name) {
  const keyName = String(name || '').trim();
  if (!keyName) return { ok: false, error: 'missing_key_name' };
  if (keyName === 'self') return { ok: false, error: 'cannot_delete_self_key' };
  try {
    const url = new URL(`${ipfsApiBase()}/api/v0/key/rm`);
    url.searchParams.set('arg', keyName);
    url.searchParams.set('ipns-base', 'base36');
    const res = await fetch(url.toString(), { method: 'POST' });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: errText || 'http_' + res.status };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, keys: Array.isArray(json?.Keys) ? json.Keys : [] };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function ipfsSwarmPeers() {
  try {
    const res = await fetch(`${ipfsApiBase()}/api/v0/swarm/peers?enc=json`, {
      method: 'POST'
    });

    if (!res.ok) {
      return { ok: false, error: 'http_' + res.status };
    }

    const json = await res.json();
    const peers = Array.isArray(json.Peers) ? json.Peers : [];
    return { ok: true, peers };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function stopIpfsDaemon() {
  if (ipfsProcess && !ipfsProcess.killed) {
    try { ipfsProcess.kill(); } catch {}
  }
  ipfsProcess = null;
}

module.exports = {
  startIpfsDaemon,
  checkIpfsStatus,
  stopIpfsDaemon,
  prefetchPublicIpfsGateways,
  ipfsCidToBase32,
  ipfsAdd,
  ipfsAddWithProgress,
  ipfsAddPath,
  ipfsAddPathWithProgress,
  ipfsAddDirectory,
  ipfsAddDirectoryWithProgress,
  ipfsAddDirectoryPaths,
  ipfsAddDirectoryPathsWithProgress,
  ipfsAddDirectoryFromPath,
  ipfsAddDirectoryFromPathWithProgress,
  ipfsGet,
  ipfsLs,
  ipfsPinList,
  ipfsPinLs,
  ipfsPinAdd,
  startManagedPinJob,
  pauseManagedPinJob,
  resumeManagedPinJob,
  cancelManagedPinJob,
  waitForManagedPinJob,
  getPinJob,
  listPinJobs,
  addPinJobListener,
  ipfsPinRm,
  ipfsObjectStat,
  ipfsUnpin,
  ipfsStats,
  ipfsPublishToIPNS,
  ipfsResolveIPNS,
  ipfsKeyList,
  ipfsKeyGen,
  ipfsKeyRename,
  ipfsKeyImportFromPath,
  ipfsKeyExportToPath,
  ipfsKeyRm,
  ipfsSwarmPeers,
  ipfsPropagateCidToPublicGateways,
};
