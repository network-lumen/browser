const { BrowserWindow, shell } = require('electron');
const { readState } = require('../chain/client.cjs');
const { currentAppVersion } = require('../utils/app_version.cjs');
const { isVersionUnstable } = require('../services/startup_health.cjs');

function parseSemver(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const m = s.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (![major, minor, patch].every((n) => Number.isFinite(n) && n >= 0)) return null;
  const pre = m[4] ? String(m[4]).split('.').filter(Boolean) : [];
  return { major, minor, patch, pre };
}

function compareSemver(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;
  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

  const aPre = va.pre;
  const bPre = vb.pre;
  if (!aPre.length && !bPre.length) return 0;
  if (!aPre.length) return 1; // release > prerelease
  if (!bPre.length) return -1;

  const len = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < len; i += 1) {
    const ai = aPre[i];
    const bi = bPre[i];
    if (ai == null && bi == null) return 0;
    if (ai == null) return -1; // shorter prerelease has lower precedence
    if (bi == null) return 1;
    if (ai === bi) continue;
    const aNum = /^[0-9]+$/.test(ai) ? Number(ai) : null;
    const bNum = /^[0-9]+$/.test(bi) ? Number(bi) : null;
    if (aNum != null && bNum != null) return aNum > bNum ? 1 : -1;
    if (aNum != null) return -1; // numeric < non-numeric
    if (bNum != null) return 1;
    return ai > bi ? 1 : -1;
  }

  return 0;
}

function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const va = parseSemver(latest);
  const vb = parseSemver(current);
  if (va && vb) return compareSemver(latest, current) > 0;
  // Fall back to strict inequality (legacy behavior) for non-semver versions.
  return String(latest) !== String(current);
}

/**
 * Whether the chain has published this release to clients.
 *
 * One rule, and it admits no exception: the DAO marks a release VALIDATED
 * through `MsgValidateRelease`, which x/release gates on the governance
 * authority, and nothing else reaches a user's machine. A release sits at
 * PENDING from the moment it is published until a vote moves it, so a publisher
 * - including whoever builds this app - cannot ship on their own say-so.
 *
 * Three things used to get past this, and all three are gone:
 *
 *  - The channel. The check only ran when the channel was 'stable', and the
 *    channel defaults to 'beta', so in practice it never ran at all: a PENDING
 *    release was offered to every client as soon as it was published.
 *  - `emergency_ok`. A release carrying it skipped validation entirely. The
 *    flag cannot be set - x/release's `SetEmergency` returns "emergency rollout
 *    is disabled" unconditionally - so this was a door onto a room that does
 *    not exist, which is the kind that gets opened by a later change to the
 *    chain rather than by anyone noticing it here.
 *  - The `/releases` fallback, which applied the same channel-conditional test.
 *
 * The status arrives as the enum's name over grpc-gateway, and as its number if
 * anything on the path emits proto JSON in the other dialect. Both are read:
 * the cost of getting that wrong is not a wrong update but no updates at all,
 * silently, which is the failure nobody reports.
 */
function isValidatedRelease(release) {
  if (!release || release.yanked) return false;
  const raw = release.status;
  if (typeof raw === 'number') return raw === 1;
  const text = String(raw ?? '').trim().toUpperCase();
  return text === 'VALIDATED' || text === 'RELEASE_VALIDATED' || text === '1';
}

const DEFAULT_CHANNEL = String(process.env.LUMEN_RELEASE_CHANNEL || 'beta');
const DEFAULT_KIND = String(process.env.LUMEN_RELEASE_KIND || 'browser');
const DEFAULT_PLATFORM = String(process.env.LUMEN_RELEASE_PLATFORM || detectPlatform());
const POLL_INTERVAL_MS = Number(process.env.LUMEN_RELEASE_POLL_MS || 10 * 60_000);
const UNSTABLE_VERSION_MESSAGE = 'This version seems unstable on your system. Please try again later.';

let cached = null;
let lastBroadcastKey = null;

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

async function applyStartupHealthBlock(payload) {
  try {
    const v = String(payload && payload.version ? payload.version : '').trim();
    if (!v) return payload;
    const unstable = await isVersionUnstable(v);
    if (unstable) {
      payload.blocked = true;
      payload.blockedReason = 'unstable_version';
      payload.blockedMessage = UNSTABLE_VERSION_MESSAGE;
    }
  } catch {}
  return payload;
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
    const entryChannel = String(entry.channel || '').trim().toLowerCase();
    if (entryChannel !== DEFAULT_CHANNEL.toLowerCase()) continue;
    if (!isValidatedRelease(entry)) continue;
    const artifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
    const art = selectArtifact(artifacts, DEFAULT_PLATFORM, DEFAULT_KIND);
    if (!art) continue;
    return {
      release: entry,
      artifact: normalizeArtifact(art, DEFAULT_PLATFORM, DEFAULT_KIND)
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
    // `/latest` is what every channel asks now. The chain answers it only for a
    // release that is VALIDATED and not yanked (x/release query.go), which is
    // exactly the rule this file wants - so the branch that used to scan
    // `/releases` first, to reach a PENDING build on a non-stable channel, has
    // nothing left to find.
    const canonPath = `/lumen/release/latest/${encodeURIComponent(DEFAULT_CHANNEL)}/${encodeURIComponent(DEFAULT_PLATFORM)}/${encodeURIComponent(DEFAULT_KIND)}`;
    let res = await readState(canonPath, { kind: 'rest', timeout: 12_000 });

    if (!res || !res.ok) {
      const qs = new URLSearchParams();
      qs.set('channel', DEFAULT_CHANNEL);
      qs.set('platform', DEFAULT_PLATFORM);
      qs.set('kind', DEFAULT_KIND);
      res = await readState(`/lumen/release/latest?${qs.toString()}`, { kind: 'rest', timeout: 12_000 });
      if (!res || !res.ok) {
        // Some networks may not expose /latest endpoints reliably. Fall back to scanning /releases.
        const fallback = await findLatestFromList().catch(() => null);
        if (!fallback) return;

        const payload = {
          version: String(fallback.release && fallback.release.version ? fallback.release.version : ''),
          channel: String(fallback.release && fallback.release.channel ? fallback.release.channel : DEFAULT_CHANNEL),
          platform: fallback.artifact.platform,
          kind: fallback.artifact.kind,
          release: fallback.release,
          artifact: fallback.artifact,
          downloadUrl: pickDownloadUrl(fallback.artifact)
        };

        await applyStartupHealthBlock(payload);
        cached = payload;

        const currentVersion = currentAppVersion();

        if (!payload.version) return;
        if (!currentVersion || !isNewerVersion(payload.version, currentVersion)) return;

        const broadcastKey = `${payload.version}|${payload.artifact.sha256Hex || ''}`;
        if (broadcastKey !== lastBroadcastKey) {
          lastBroadcastKey = broadcastKey;
          broadcastUpdate(payload);
        }
        return;
      }
    }

    const data = res.json || null;
    let release = (data && (data.release ?? data)) || null;
    let artifact = null;

    // Checked here as well as on the chain. The answer may have come from a
    // node this app does not control, and the whole point of the rule is that
    // it does not depend on one.
    if (isValidatedRelease(release)) {
      const artifacts = Array.isArray(release.artifacts) ? release.artifacts : [];
      const art = selectArtifact(artifacts, DEFAULT_PLATFORM, DEFAULT_KIND);
      if (art) artifact = normalizeArtifact(art, DEFAULT_PLATFORM, DEFAULT_KIND);
    }

    if (!artifact) {
      const fallback = await findLatestFromList().catch(() => null);
      if (!fallback) return;
      release = fallback.release;
      artifact = fallback.artifact;
    }

    // `findLatestFromList` only returns validated releases, so this holds for
    // both routes - and it is the last thing between the chain's answer and a
    // download the user is offered.
    if (!isValidatedRelease(release)) return;

    const payload = {
      version: String(release && release.version ? release.version : ''),
      channel: String(release && release.channel ? release.channel : DEFAULT_CHANNEL),
      platform: artifact.platform,
      kind: artifact.kind,
      release,
      artifact,
      downloadUrl: pickDownloadUrl(artifact)
    };

    await applyStartupHealthBlock(payload);
    cached = payload;

    const currentVersion = currentAppVersion();

    if (!payload.version) return;
    if (!currentVersion || !isNewerVersion(payload.version, currentVersion)) return;

    const broadcastKey = `${payload.version}|${artifact.sha256Hex || ''}`;
    if (broadcastKey !== lastBroadcastKey) {
      lastBroadcastKey = broadcastKey;
      broadcastUpdate(payload);
    }
  } catch {
    // ignore network errors
  }
}

function getLatestReleaseInfo() {
  return cached ? { ...cached } : null;
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
  pollReleaseOnce,
  RELEASE_POLL_INTERVAL_MS: Math.max(30_000, POLL_INTERVAL_MS | 0),
  getLatestReleaseInfo,
  pollNow,
  openExternal,
  // Exported for tests: together these are the whole decision to prompt
  // someone to update, and neither has a switch to bypass it. One asks whether
  // the release is newer; the other, whether the DAO has published it at all.
  isNewerVersion,
  isValidatedRelease
};
