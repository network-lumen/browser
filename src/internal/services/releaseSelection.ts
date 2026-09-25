/**
 * Which published release an app should offer to install, and from where.
 *
 * Lumen does not ask GitHub what the latest version is: releases live on the
 * chain, at `/lumen/release/releases`, each carrying artifacts per platform
 * with their size, their sha256 and one or more URLs - https, ipfs:// or
 * lumen://. `electron/daemons/release_watcher.cjs` has been reading that list
 * for the desktop all along.
 *
 * This is the part of it with rules in it, ported so the mobile target can
 * answer the same question, and kept pure so both can be tested without a
 * chain. `tests/unit/release-selection.test.ts` runs this and the desktop copy
 * over the same payloads and fails if they disagree - a release picked two
 * different ways is an app updating itself to the wrong build.
 *
 * WHAT THE RULES ARE, in the order they matter:
 *  - a yanked release is never offered, whatever else it says;
 *  - only a VALIDATED release is, because the chain marks the others as not
 *    ready;
 *  - only the requested channel;
 *  - newest first by id, since that is the order the chain assigns;
 *  - the artifact must match the platform, preferring one that also matches
 *    the kind;
 *  - and the version has to be greater than the one running, or there is
 *    nothing to offer.
 */

import type { ReleaseArtifact, ReleaseCandidate, ReleaseEntry } from '../../types/releaseUpdates';

/** Whether the chain considers this release ready to hand out. */
export function isValidatedRelease(release: ReleaseEntry | null | undefined): boolean {
  if (!release || release.yanked) return false;

  const raw = (release as { status?: unknown }).status;
  if (typeof raw === 'number') return raw === 1;

  const text = String(raw ?? '').trim().toUpperCase();
  return text === 'VALIDATED' || text === 'RELEASE_VALIDATED' || text === '1';
}

/** Both spellings of every field, because the LCD answers in snake_case. */
export function normalizeArtifact(
  input: Record<string, unknown> | null | undefined,
  platform: string,
  kind: string
): ReleaseArtifact {
  const raw = (input ?? {}) as Record<string, unknown>;
  const urls = Array.isArray(raw.urls) ? raw.urls.map((u) => String(u ?? '')).filter(Boolean) : [];
  const sizeRaw = raw.size ?? raw.size_bytes ?? raw.sizeBytes;
  const sha = raw.sha256Hex ?? raw.sha256_hex ?? raw.sha256hex;

  return {
    platform: String(raw.platform ?? platform ?? ''),
    kind: String(raw.kind ?? kind ?? ''),
    size: sizeRaw != null ? Number(sizeRaw) || null : null,
    sha256Hex: sha ? String(sha) : null,
    urls,
    cid: raw.cid ? String(raw.cid) : null
  };
}

/**
 * The artifact for this platform, preferring one that also matches the kind.
 *
 * The fallback is deliberate: a release that publishes a single artifact per
 * platform without naming its kind is still installable.
 */
export function selectArtifact(
  list: Record<string, unknown>[] | null | undefined,
  platform: string,
  kind: string
): Record<string, unknown> | null {
  if (!Array.isArray(list)) return null;

  const samePlatform = (art: Record<string, unknown>) =>
    String(art?.platform ?? '').toLowerCase() === platform.toLowerCase();

  const exact = list.find(
    (art) => samePlatform(art) && String(art?.kind ?? '').toLowerCase() === kind.toLowerCase()
  );
  return exact ?? list.find(samePlatform) ?? null;
}

function parseSemver(input: unknown) {
  const s = String(input ?? '').trim();
  const m = s.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;

  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (![major, minor, patch].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { major, minor, patch, pre: m[4] ? m[4].split('.').filter(Boolean) : [] };
}

/**
 * Semver order, with prereleases ranked below the release they lead to.
 *
 * `0` for anything unparseable on either side, which callers read as "not
 * newer" - an app does not update itself on a version string it cannot read.
 */
export function compareVersions(a: unknown, b: unknown): number {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;

  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

  if (!va.pre.length && !vb.pre.length) return 0;
  // A release outranks any prerelease of the same numbers.
  if (!va.pre.length) return 1;
  if (!vb.pre.length) return -1;

  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i += 1) {
    const x = va.pre[i];
    const y = vb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x);
    const ny = Number(y);
    const bothNumeric = Number.isFinite(nx) && Number.isFinite(ny);
    if (bothNumeric) {
      if (nx !== ny) return nx > ny ? 1 : -1;
    } else if (x !== y) {
      return x > y ? 1 : -1;
    }
  }
  return 0;
}

/** The first URL an installer can actually fetch, https preferred. */
export function pickDownloadUrl(artifact: ReleaseArtifact | null | undefined, gatewayBase = 'https://ipfs.io'): string {
  const urls = Array.isArray(artifact?.urls) ? artifact.urls : [];
  const base = String(gatewayBase || 'https://ipfs.io').replace(/\/+$/, '');

  const direct = urls.find((entry) => /^https?:\/\//i.test(entry));
  if (direct) return direct;

  const ipfs = urls.find((entry) => /^ipfs:\/\//i.test(entry));
  if (ipfs) {
    const cid = ipfs.replace(/^ipfs:\/\//i, '');
    if (cid) return `${base}/ipfs/${cid}`;
  }

  const lumen = urls.find((entry) => /^lumen:\/\//i.test(entry));
  if (lumen) {
    const path = lumen.replace(/^lumen:\/\//i, '');
    if (path.startsWith('ipfs/')) return `${base}/${path}`;
  }

  // A bare CID is still addressable.
  if (artifact?.cid) return `${base}/ipfs/${artifact.cid}`;
  return '';
}

/**
 * The newest release worth offering, or null.
 *
 * Sorted by id descending because that is the order the chain assigns them -
 * a version string is not authoritative here, and two releases can carry the
 * same one across channels.
 */
export function selectLatestRelease(
  releases: ReleaseEntry[] | null | undefined,
  options: { channel: string; platform: string; kind: string }
): ReleaseCandidate | null {
  const list = Array.isArray(releases) ? releases : [];
  const channel = String(options.channel || '').toLowerCase();

  const sorted = [...list].sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));

  for (const entry of sorted) {
    if (!isValidatedRelease(entry)) continue;
    if (String(entry.channel ?? '').trim().toLowerCase() !== channel) continue;

    const artifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
    const picked = selectArtifact(artifacts, options.platform, options.kind);
    if (!picked) continue;

    return {
      release: entry,
      artifact: normalizeArtifact(picked, options.platform, options.kind)
    };
  }

  return null;
}

/** Whether `candidate` is something the running version should be offered. */
export function isUpdate(candidate: ReleaseCandidate | null | undefined, currentVersion: string): boolean {
  const next = String(candidate?.release?.version ?? '').trim();
  if (!next) return false;
  return compareVersions(next, currentVersion) > 0;
}
