import { describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

const { isNewerVersion, isValidatedRelease } = stubElectron().load<any>('daemons/release_watcher.cjs');

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

/**
 * Whether a release has been published to clients at all.
 *
 * The chain holds a release at PENDING from the moment it is signed until a
 * governance vote moves it to VALIDATED, and this is the app's half of that
 * rule. Getting it wrong is silent in both directions: too loose and a build
 * nobody voted on installs itself, too tight and updates simply stop with no
 * error anywhere.
 */
describe('isValidatedRelease', () => {
  it('accepts a validated release', () => {
    expect(isValidatedRelease({ status: 'VALIDATED' })).toBe(true);
  });

  it('refuses every other state the chain can hold', () => {
    for (const status of ['PENDING', 'REJECTED', 'EXPIRED']) {
      expect(isValidatedRelease({ status })).toBe(false);
    }
  });

  it('refuses a yanked release even once validated', () => {
    // Yanking is how a bad build is withdrawn after the vote, so it has to
    // outrank the status rather than sit beside it.
    expect(isValidatedRelease({ status: 'VALIDATED', yanked: true })).toBe(false);
  });

  it('reads the enum as a number as well as a name', () => {
    // grpc-gateway answers with the name; proto JSON elsewhere may answer with
    // the ordinal. Reading only one would stop updates dead and say nothing.
    expect(isValidatedRelease({ status: 1 })).toBe(true);
    expect(isValidatedRelease({ status: '1' })).toBe(true);
    expect(isValidatedRelease({ status: 0 })).toBe(false);
    expect(isValidatedRelease({ status: 2 })).toBe(false);
  });

  it('ignores emergency_ok, which is how validation used to be skipped', () => {
    // x/release refuses MsgSetEmergency unconditionally, so the flag cannot be
    // set today - and if that ever changes it must not reopen this gate.
    expect(isValidatedRelease({ status: 'PENDING', emergency_ok: true })).toBe(false);
    expect(isValidatedRelease({ status: 'PENDING', emergencyOk: true })).toBe(false);
  });

  it('refuses anything it cannot read as a status', () => {
    expect(isValidatedRelease(null)).toBe(false);
    expect(isValidatedRelease({})).toBe(false);
    expect(isValidatedRelease({ status: '' })).toBe(false);
    expect(isValidatedRelease({ status: 'validated ' })).toBe(true);
  });
});
