import { describe, expect, it } from 'vitest';
import { formatReleaseSize, isNewerVersion } from '../../src/internal/services/releaseUpdates';

/**
 * Whether the user is shown an update prompt.
 *
 * One comparison decides that for every install, and both of its edges invert
 * easily. A prerelease sorts *below* the release it leads to, so 1.0.0-beta.1
 * must never be offered to someone already on 1.0.0 - that would walk users
 * backwards onto a build the channel had moved past. And when neither string
 * parses, "different" counts as "newer", so a non-semver tag still prompts
 * instead of silently never updating anyone.
 */

describe('isNewerVersion', () => {
  it('compares the three numbers in order of significance', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.0.10', '1.0.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false);
  });

  it('compares numerically, not as text', () => {
    // The classic: '10' < '9' as strings.
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true);
    expect(isNewerVersion('0.9.0', '0.10.0')).toBe(false);
  });

  it('offers nothing for the version already installed', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });

  it('accepts a leading v on either side', () => {
    expect(isNewerVersion('v1.2.4', '1.2.3')).toBe(true);
    expect(isNewerVersion('1.2.3', 'v1.2.3')).toBe(false);
  });

  it('sorts a prerelease below the release it leads to', () => {
    // Offering 1.0.0-beta.1 to someone on 1.0.0 walks them backwards.
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.0-beta.1')).toBe(true);
  });

  it('orders prereleases among themselves', () => {
    expect(isNewerVersion('1.0.0-beta.2', '1.0.0-beta.1')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0-beta.2')).toBe(false);
    expect(isNewerVersion('1.0.0-beta', '1.0.0-alpha')).toBe(true);
    // A numeric identifier ranks below an alphanumeric one.
    expect(isNewerVersion('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBe(true);
  });

  it('treats a longer prerelease chain as later when the prefix matches', () => {
    expect(isNewerVersion('1.0.0-beta.1.1', '1.0.0-beta.1')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0-beta.1.1')).toBe(false);
  });

  it('ignores build metadata, which carries no precedence', () => {
    expect(isNewerVersion('1.0.0+build2', '1.0.0+build1')).toBe(false);
  });

  it('falls back to "different means newer" when a version does not parse', () => {
    // Better than never prompting: a tag we cannot read still reaches the user.
    expect(isNewerVersion('nightly-2026-08-07', '1.0.0')).toBe(true);
    expect(isNewerVersion('nightly', 'nightly')).toBe(false);
  });

  it('does not prompt on an empty version', () => {
    expect(isNewerVersion('', '')).toBe(false);
  });
});

describe('formatReleaseSize', () => {
  it('steps up the unit', () => {
    expect(formatReleaseSize(512)).toBe('512 B');
    expect(formatReleaseSize(1024)).toBe('1.0 KB');
    expect(formatReleaseSize(120 * 1024 * 1024)).toBe('120.0 MB');
    expect(formatReleaseSize(1024 ** 3)).toBe('1.0 GB');
  });

  it('shows nothing rather than a zero-byte download', () => {
    for (const nothing of [0, null, undefined, -1, NaN, Infinity]) {
      expect(formatReleaseSize(nothing as never)).toBe('');
    }
  });
});
