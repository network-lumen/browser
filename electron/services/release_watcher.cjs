const { BrowserWindow, shell, app } = require('electron');
const { readState } = require('../network/network_middleware.cjs');

const DEFAULT_CHANNEL = String(process.env.LUMEN_RELEASE_CHANNEL || 'beta');
const DEFAULT_KIND = String(process.env.LUMEN_RELEASE_KIND || 'browser');
const DEFAULT_PLATFORM = String(process.env.LUMEN_RELEASE_PLATFORM || detectPlatform());
const POLL_INTERVAL_MS = Number(process.env.LUMEN_RELEASE_POLL_MS || 10 * 60_000);
const TEST_MODE = String(process.env.LUMEN_RELEASE_TEST_MODE || '') === '1';

let timer = null;
let cached = null;
let lastBroadcastKey = null;
let testOptions = {
  allowUnvalidatedStable: String(process.env.LUMEN_RELEASE_ALLOW_UNVALIDATED_STABLE || '') === '1',
  forcePrompt: String(process.env.LUMEN_RELEASE_FORCE_PROMPT || '') === '1'
};

function detectPlatform() {
  const archMap = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' };
  const platformMap = {
    win32: 'windows',
    darwin: 'darwin',
    linux: 'linux',
    aix: 'aix',
    freebsd: 'freebsd',
    openbsd: 'openbsd',
    sunos: 'sunos',
    android: 'android'
  };
  const plat = platformMap[process.platform] || process.platform;
  const arch = archMap[process.arch] || process.arch;
  return `${plat}-${arch}`;
}

function normalizeArtifact(input, platform, kind) {
  const urls = Array.isArray(input && input.urls)
    ? input.urls.map((u) => String(u || '')).filter(Boolean)
    : [];
  const sizeRaw = input && (input.size ?? input.size_bytes ?? input.sizeBytes);
  const sha = input && (input.sha256Hex || input.sha256_hex || input.sha256hex);
  return {
    platform: String((input && input.platform) || platform || ''),
    kind: String((input && input.kind) || kind || ''),
    size: sizeRaw != null ? Number(sizeRaw) || null : null,
    sha256Hex: sha ? String(sha) : null,
    urls,
    cid: input && input.cid ? String(input.cid) : null
  };
}

function pickDownloadUrl(artifact) {
  const urls = Array.isArray(artifact && artifact.urls) ? artifact.urls : [];
  for (const entry of urls) {
    if (/^https?:\/\//i.test(entry)) return entry;
  }
  const ipfsUrl = urls.find((entry) => /^ipfs:\/\//i.test(entry));
  if (ipfsUrl) {
    const cid = ipfsUrl.replace(/^ipfs:\/\//i, '');
    if (cid) return `https://ipfs.io/ipfs/${cid}`;
  }
  const lumenUrl = urls.find((entry) => /^lumen:\/\//i.test(entry));
  if (lumenUrl) {
    const path = lumenUrl.replace(/^lumen:\/\//i, '');
    if (path.startsWith('ipfs/')) return `https://ipfs.io/${path}`;
  }
  if (artifact && artifact.cid) return `https://ipfs.io/ipfs/${artifact.cid}`;
  return null;
}

function selectArtifact(list, platform, kind) {
  if (!Array.isArray(list)) return null;
  const exact = list.find(
    (art) =>
      String(art && art.platform ? art.platform : '').toLowerCase() === platform.toLowerCase() &&
      String(art && art.kind ? art.kind : '').toLowerCase() === kind.toLowerCase()
  );
  if (exact) return exact;
  return list.find((art) => String(art && art.platform ? art.platform : '').toLowerCase() === platform.toLowerCase()) || null;
}

async function findLatestFromList() {
  const qs = new URLSearchParams();
  qs.set('limit', '50');
  qs.set('channel', DEFAULT_CHANNEL);
  const res = await readState(`/lumen/release/releases?${qs.toString()}`, { kind: 'rest', timeout: 12_000 });
  if (!res || !res.ok) return null;

  const data = res.json || null;
  const list = Array.isArray(data && data.releases)
    ? data.releases
    : Array.isArray(data && data.data && data.data.releases)
      ? data.data.releases
      : [];

  const sorted = [...list].sort((a, b) => Number(b && b.id ? b.id : 0) - Number(a && a.id ? a.id : 0));
  for (const entry of sorted) {
    if (!entry || entry.yanked) continue;
    const statusRaw = String(entry.status || '').toUpperCase();
    const emergencyOk = !!(entry.emergencyOk ?? entry.emergency_ok);
    if (DEFAULT_CHANNEL === 'stable' && statusRaw !== 'VALIDATED' && !emergencyOk) {
      if (!(TEST_MODE && testOptions.allowUnvalidatedStable)) continue;
    }
    const artifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
    const art = selectArtifact(artifacts, DEFAULT_PLATFORM, DEFAULT_KIND);
    if (!art) continue;
    return {
      release: entry,
      artifact: normalizeArtifact(art, DEFAULT_PLATFORM, DEFAULT_KIND),
      status: statusRaw,
      emergencyOk
    };
  }
  return null;
}

function broadcastUpdate(payload) {
  try {
    const wins = typeof BrowserWindow.getAllWindows === 'function' ? BrowserWindow.getAllWindows() : [];
    for (const w of wins) {
      try {
        w?.webContents?.send?.('release:updateAvailable', payload);
      } catch {}
    }
  } catch {}
}

async function pollReleaseOnce() {
  try {
    const canonPath = `/lumen/release/latest/${encodeURIComponent(DEFAULT_CHANNEL)}/${encodeURIComponent(DEFAULT_PLATFORM)}/${encodeURIComponent(DEFAULT_KIND)}`;
    let res = await readState(canonPath, { kind: 'rest', timeout: 12_000 });

    if (!res || !res.ok) {
      const qs = new URLSearchParams();
      qs.set('channel', DEFAULT_CHANNEL);
      qs.set('platform', DEFAULT_PLATFORM);
      qs.set('kind', DEFAULT_KIND);
      res = await readState(`/lumen/release/latest?${qs.toString()}`, { kind: 'rest', timeout: 12_000 });
      if (!res || !res.ok) return;
    }

    const data = res.json || null;
    let release = (data && (data.release ?? data)) || null;
    let artifact = null;
    let status = '';
    let emergencyOk = false;

    if (release && !release.yanked) {
      status = String(release.status || '').toUpperCase();
      emergencyOk = !!(release.emergencyOk ?? release.emergency_ok);
      const artifacts = Array.isArray(release.artifacts) ? release.artifacts : [];
      const art = selectArtifact(artifacts, DEFAULT_PLATFORM, DEFAULT_KIND);
      if (art) artifact = normalizeArtifact(art, DEFAULT_PLATFORM, DEFAULT_KIND);
    }

    if (!release || release.yanked || !artifact || (DEFAULT_CHANNEL === 'stable' && status !== 'VALIDATED' && !emergencyOk)) {
      const fallback = await findLatestFromList().catch(() => null);
      if (!fallback) return;
      release = fallback.release;
      artifact = fallback.artifact;
      status = fallback.status;
      emergencyOk = fallback.emergencyOk;
    }

    if (DEFAULT_CHANNEL === 'stable' && status !== 'VALIDATED' && !emergencyOk) {
      if (!(TEST_MODE && testOptions.allowUnvalidatedStable)) return;
    }

    const payload = {
      version: String(release && release.version ? release.version : ''),
      channel: String(release && release.channel ? release.channel : DEFAULT_CHANNEL),
      platform: artifact.platform,
      kind: artifact.kind,
      release,
      artifact,
      downloadUrl: pickDownloadUrl(artifact)
    };

    cached = payload;

    const currentVersion = (() => {
      try {
        return app && typeof app.getVersion === 'function' ? String(app.getVersion() || '') : '';
      } catch {
        return '';
      }
    })();

    if (!payload.version) return;
    if (!testOptions.forcePrompt) {
      if (!currentVersion || payload.version === currentVersion) return;
    }

    const broadcastKey = `${payload.version}|${artifact.sha256Hex || ''}`;
    if (broadcastKey !== lastBroadcastKey) {
      lastBroadcastKey = broadcastKey;
      broadcastUpdate(payload);
    }
  } catch {
    // ignore network errors
  }
}

function startReleaseWatcher() {
  if (timer) return;
  pollReleaseOnce().catch(() => {});
  timer = setInterval(() => pollReleaseOnce().catch(() => {}), Math.max(30_000, POLL_INTERVAL_MS | 0));
}

function stopReleaseWatcher() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function getLatestReleaseInfo() {
  return cached ? { ...cached } : null;
}

function getReleaseTestOptions() {
  if (!TEST_MODE) return { enabled: false };
  return { enabled: true, ...testOptions };
}

function setReleaseTestOptions(input) {
  if (!TEST_MODE) return { ok: false, error: 'test_mode_disabled' };
  const next = { ...testOptions };
  if (input && typeof input === 'object') {
    if (typeof input.allowUnvalidatedStable === 'boolean') next.allowUnvalidatedStable = input.allowUnvalidatedStable;
    if (typeof input.forcePrompt === 'boolean') next.forcePrompt = input.forcePrompt;
  }
  testOptions = next;
  return { ok: true, options: getReleaseTestOptions() };
}

async function pollNow() {
  await pollReleaseOnce().catch(() => {});
  return getLatestReleaseInfo();
}

async function openExternal(url) {
  const target = typeof url === 'string' ? url.trim() : '';
  if (!target || !/^https?:\/\//i.test(target)) return { ok: false, error: 'invalid_url' };
  try {
    await shell.openExternal(target);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

module.exports = {
  startReleaseWatcher,
  stopReleaseWatcher,
  getLatestReleaseInfo,
  getReleaseTestOptions,
  setReleaseTestOptions,
  pollNow,
  openExternal
};
