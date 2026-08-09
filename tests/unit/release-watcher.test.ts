import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

const { isNewerVersion } = stubElectron().load<any>('daemons/release_watcher.cjs');

/**
 * Whether the app offers you an update.
 *
 * This used to be skippable: a `forcePrompt` switch, driven by two checkboxes
 * and an env var, made the watcher prompt regardless. The switch is gone, so
 * this comparison is now the only thing between a user and an update banner -
 * and the only thing stopping a downgrade from looking like one.
 */

describe('isNewerVersion', () => {
  it('offers a higher version and nothing else', () => {
    expect(isNewerVersion('0.9.9', '0.9.8')).toBe(true);
    expect(isNewerVersion('0.9.8', '0.9.8')).toBe(false);
    expect(isNewerVersion('0.9.7', '0.9.8')).toBe(false);
  });

  it('compares numbers as numbers', () => {
    // The classic: string order puts 0.10.0 before 0.9.9, which would leave
    // everyone stuck one release behind at exactly the wrong moment.
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('0.9.9', '0.10.0')).toBe(false);
    expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
  });

  it('treats a release as newer than its own prereleases', () => {
    expect(isNewerVersion('1.0.0', '1.0.0-beta.1')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0')).toBe(false);
  });

  it('orders prerelease identifiers, numerically where they are numbers', () => {
    expect(isNewerVersion('1.0.0-beta.2', '1.0.0-beta.1')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.10', '1.0.0-beta.2')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.2', '1.0.0-beta.10')).toBe(false);
  });

  it('accepts a leading v, since tags carry one', () => {
    expect(isNewerVersion('v0.9.9', '0.9.8')).toBe(true);
    expect(isNewerVersion('v0.9.8', 'v0.9.8')).toBe(false);
  });

  it('falls back to plain inequality when either side is not semver', () => {
    // Deliberate: an unparseable version still gets offered if it differs, so a
    // non-standard channel is not silently frozen.
    expect(isNewerVersion('nightly-2', 'nightly-1')).toBe(true);
    expect(isNewerVersion('nightly-1', 'nightly-1')).toBe(false);
  });

  it('never offers anything when a side is missing', () => {
    expect(isNewerVersion('', '0.9.8')).toBe(false);
    expect(isNewerVersion('0.9.9', '')).toBe(false);
    expect(isNewerVersion(null, undefined)).toBe(false);
  });
});
