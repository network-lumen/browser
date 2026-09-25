import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  isUpdate,
  isValidatedRelease,
  normalizeArtifact,
  pickDownloadUrl,
  selectArtifact,
  selectLatestRelease
} from '../../src/internal/services/releaseSelection';

/**
 * Which release the app offers to install.
 *
 * This decides what an auto-update replaces the running app with, so the
 * failures worth pinning are the ones that would install the wrong thing: a
 * yanked build, an unvalidated one, another channel, another platform's
 * artifact, or a version older than the one already running.
 *
 * The payloads are shaped like the chain's, snake_case included.
 */
const artifact = (platform: string, kind = 'browser', extra: Record<string, unknown> = {}) => ({
  platform,
  kind,
  size_bytes: 59_503_751,
  sha256_hex: 'a'.repeat(64),
  urls: [`https://cdn.example/${platform}.bin`],
  ...extra
});

const release = (over: Record<string, unknown> = {}) => ({
  id: 7,
  version: '0.9.11',
  channel: 'beta',
  status: 'VALIDATED',
  yanked: false,
  artifacts: [artifact('windows-amd64'), artifact('android-arm64')],
  ...over
});

const ANDROID = { channel: 'beta', platform: 'android-arm64', kind: 'browser' };

describe('what the chain considers installable', () => {
  it('accepts VALIDATED however the chain spells it', () => {
    for (const status of ['VALIDATED', 'RELEASE_VALIDATED', '1', 1]) {
      expect(isValidatedRelease(release({ status }))).toBe(true);
    }
  });

  it('refuses anything else, including a pending release', () => {
    for (const status of ['PENDING', 'REJECTED', 0, 2, '', null, undefined]) {
      expect(isValidatedRelease(release({ status }))).toBe(false);
    }
  });

  it('refuses a yanked release even when it is validated', () => {
    // Yanked means "do not install this", and it has to win over every other
    // field: a build pulled for breaking wallets must not be offered.
    expect(isValidatedRelease(release({ yanked: true }))).toBe(false);
  });
});

describe('picking the artifact', () => {
  it('matches the platform and prefers the matching kind', () => {
    const list = [artifact('android-arm64', 'sdk'), artifact('android-arm64', 'browser')];
    expect(selectArtifact(list, 'android-arm64', 'browser')?.kind).toBe('browser');
  });

  it('falls back to the platform alone, so a single unnamed artifact still installs', () => {
    const list = [artifact('android-arm64', '')];
    expect(selectArtifact(list, 'android-arm64', 'browser')).toBeTruthy();
  });

  it('never hands over another platform', () => {
    expect(selectArtifact([artifact('windows-amd64')], 'android-arm64', 'browser')).toBeNull();
    expect(selectArtifact(null, 'android-arm64', 'browser')).toBeNull();
  });

  it('reads size and sha in either spelling', () => {
    const snake = normalizeArtifact(artifact('android-arm64'), 'android-arm64', 'browser');
    const camel = normalizeArtifact(
      { platform: 'android-arm64', kind: 'browser', sizeBytes: 59_503_751, sha256Hex: 'a'.repeat(64), urls: [] },
      'android-arm64',
      'browser'
    );
    expect(snake.size).toBe(59_503_751);
    expect(snake.sha256Hex).toBe(camel.sha256Hex);
  });
});

describe('where to download it from', () => {
  const base = (urls: string[], cid: string | null = null) =>
    normalizeArtifact({ urls, cid }, 'android-arm64', 'browser');

  it('prefers a direct https URL', () => {
    expect(pickDownloadUrl(base(['ipfs://bafyx', 'https://cdn.example/app.apk']))).toBe(
      'https://cdn.example/app.apk'
    );
  });

  it('turns an ipfs:// URL into a gateway one', () => {
    expect(pickDownloadUrl(base(['ipfs://bafyx']), 'http://127.0.0.1:8088')).toBe(
      'http://127.0.0.1:8088/ipfs/bafyx'
    );
  });

  it('reads a lumen:// ipfs path too', () => {
    expect(pickDownloadUrl(base(['lumen://ipfs/bafyx']), 'http://127.0.0.1:8088')).toBe(
      'http://127.0.0.1:8088/ipfs/bafyx'
    );
  });

  it('falls back to the bare CID when that is all there is', () => {
    expect(pickDownloadUrl(base([], 'bafyx'), 'http://127.0.0.1:8088')).toBe(
      'http://127.0.0.1:8088/ipfs/bafyx'
    );
  });

  it('answers empty rather than a broken URL', () => {
    expect(pickDownloadUrl(base([]))).toBe('');
    expect(pickDownloadUrl(null)).toBe('');
  });
});

describe('ordering versions', () => {
  it('orders by number, not by string', () => {
    // '0.9.10' < '0.9.9' as text, which is exactly the bug this guards.
    expect(compareVersions('0.9.10', '0.9.9')).toBe(1);
    expect(compareVersions('1.0.0', '0.99.99')).toBe(1);
  });

  it('ranks a prerelease below the release it leads to', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.1')).toBe(1);
  });

  it('tolerates a leading v', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
  });

  it('refuses to order what it cannot read, so nothing looks newer', () => {
    expect(compareVersions('nightly', '1.0.0')).toBe(0);
    expect(compareVersions('', '1.0.0')).toBe(0);
  });
});

describe('the release actually offered', () => {
  it('takes the newest id that fits', () => {
    const picked = selectLatestRelease(
      [release({ id: 3, version: '0.9.10' }), release({ id: 9, version: '0.9.12' })],
      ANDROID
    );
    expect(picked?.release.version).toBe('0.9.12');
    expect(picked?.artifact.platform).toBe('android-arm64');
  });

  it('skips a newer release from another channel', () => {
    const picked = selectLatestRelease(
      [release({ id: 9, version: '1.0.0', channel: 'nightly' }), release({ id: 2, version: '0.9.11' })],
      ANDROID
    );
    expect(picked?.release.version).toBe('0.9.11');
  });

  it('skips a newer release that is yanked or unvalidated', () => {
    const picked = selectLatestRelease(
      [
        release({ id: 9, version: '1.0.0', yanked: true }),
        release({ id: 8, version: '0.9.99', status: 'PENDING' }),
        release({ id: 2, version: '0.9.11' })
      ],
      ANDROID
    );
    expect(picked?.release.version).toBe('0.9.11');
  });

  it('skips a release that published nothing for this platform', () => {
    const picked = selectLatestRelease(
      [
        release({ id: 9, version: '1.0.0', artifacts: [artifact('windows-amd64')] }),
        release({ id: 2, version: '0.9.11' })
      ],
      ANDROID
    );
    expect(picked?.release.version).toBe('0.9.11');
  });

  it('answers null when nothing fits', () => {
    expect(selectLatestRelease([], ANDROID)).toBeNull();
    expect(selectLatestRelease(null, ANDROID)).toBeNull();
  });
});

describe('deciding to offer it at all', () => {
  const candidate = (version: string) => selectLatestRelease([release({ version })], ANDROID);

  it('offers a newer version', () => {
    expect(isUpdate(candidate('0.9.11'), '0.9.10')).toBe(true);
  });

  it('does not offer the same or an older one', () => {
    expect(isUpdate(candidate('0.9.10'), '0.9.10')).toBe(false);
    expect(isUpdate(candidate('0.9.9'), '0.9.10')).toBe(false);
  });

  /**
   * An app that cannot read one of the two versions offers nothing. Guessing
   * here means an update loop: install, still cannot compare, offer again.
   */
  it('offers nothing when a version is unreadable', () => {
    expect(isUpdate(candidate('nightly'), '0.9.10')).toBe(false);
    expect(isUpdate(candidate('0.9.11'), 'unknown')).toBe(false);
    expect(isUpdate(null, '0.9.10')).toBe(false);
  });
});
