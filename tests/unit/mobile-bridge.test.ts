import { beforeEach, describe, expect, it } from 'vitest';
import { checkLumenAPIReferences } from '../../src/internal/common/fatal_errors';
import {
  REQUIRED_FUNCTIONS,
  REQUIRED_NAMESPACES,
  REQUIRED_VALUES
} from '../../src/internal/common/lumenBridgeSurface';
import {
  BridgeNotImplementedError,
  bridgeReport,
  buildMobileBridge
} from '../../platform/mobile/bridge/stub';
import { isSubscription, mobileSupportOf } from '../../platform/mobile/bridge/support';
import { installPlatformBridge } from '../../platform/mobile/install';

/**
 * The mobile bridge is generated from the same contract `fatal_errors.ts`
 * validates against, so it should be complete by construction. This test is
 * what turns "should" into something CI enforces: if the generator ever stops
 * covering the contract, the Android build stops booting, and the failure
 * belongs here rather than on a device.
 */
describe('mobile bridge', () => {
  beforeEach(() => {
    delete (window as any).lumen;
    delete (window as any).__lumenBridgeReport;
  });

  it('satisfies the startup check that fatal_errors.ts runs on mount', async () => {
    (window as any).lumen = buildMobileBridge();
    await expect(checkLumenAPIReferences()).resolves.toBeUndefined();
  });

  it('covers every member of the contract', () => {
    const bridge = buildMobileBridge();
    const expected =
      REQUIRED_FUNCTIONS.length +
      REQUIRED_VALUES.length +
      Object.values(REQUIRED_NAMESPACES).reduce((n, members) => n + members.length, 0);

    expect(bridgeReport().total).toBe(expected);
    for (const name of REQUIRED_FUNCTIONS) expect(typeof bridge[name]).toBe('function');
    for (const name of REQUIRED_VALUES) expect(name in bridge).toBe(true);
  });

  it('has no planned member left without an implementation', () => {
    buildMobileBridge();
    const report = bridgeReport();

    // Every member the contract lists is now either implemented or classified
    // as having no Android equivalent. "Stubbed" was the third state - planned
    // but not written - and it is empty, which is the claim worth guarding:
    // a member added to the contract later shows up here rather than reaching
    // a user as a rejected promise.
    expect(report.stubbed).toEqual([]);
    expect(report.implemented.length + report.unsupported.length).toBe(report.total);
  });

  it('rejects rather than throws when a planned member has no implementation', async () => {
    // Staged, since nothing is in that state any more. A synchronous throw
    // would take down whichever component rendered first; a rejection is what
    // a screen already knows how to survive.
    const error = new BridgeNotImplementedError('wallet.somethingNew', 'planned');
    const member = () => Promise.reject(error);

    let pending: Promise<unknown> | undefined;
    expect(() => {
      pending = member();
    }).not.toThrow();
    await expect(pending).rejects.toThrow(/not implemented on mobile yet/);
  });

  it('answers with a failed result, not a rejection, for what Android will never have', async () => {
    const bridge = buildMobileBridge() as any;
    // The UI calls some of these at startup without awaiting them, so a
    // rejection here would be an unhandled rejection on every launch.
    // Adding a DIRECTORY, specifically. A single file now works - the chooser
    // hands back a handle and uploads.ts resolves it - but walking a folder
    // tree still wants a filesystem this target does not have.
    await expect(bridge.ipfsAddDirectory()).resolves.toMatchObject({
      ok: false,
      error: 'unsupported_on_mobile'
    });
    await expect(bridge.extensions.listExtensions()).resolves.toMatchObject({
      ok: false,
      error: 'unsupported_on_mobile'
    });
  });

  it('returns a usable unsubscribe for subscription-shaped members', () => {
    const bridge = buildMobileBridge() as any;
    // The failure this guards against is on teardown, not on subscribe: a
    // caller storing the return value and calling it later.
    for (const name of ['settingsOnChanged', 'tabsOnOpenInNewTab'] as const) {
      const unsubscribe = bridge[name](() => {});
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    }
    const un = bridge.net.onNetworkChanged(() => {});
    expect(() => un()).not.toThrow();
  });

  it('classifies local-daemon members as unsupported and chain members as planned', () => {
    expect(mobileSupportOf('ipfsPinAdd')).toBe('unsupported');
    expect(mobileSupportOf('gatewayServerStart')).toBe('unsupported');
    expect(mobileSupportOf('extensions.loadUnpacked')).toBe('unsupported');
    expect(mobileSupportOf('wallet.sendTokens')).toBe('planned');
    // gateway.* is the remote-gateway path, which is how mobile reaches IPFS.
    expect(mobileSupportOf('gateway.pinCid')).toBe('planned');
  });

  it('recognises the subscription naming shapes used by the contract', () => {
    expect(isSubscription('onChanged')).toBe(true);
    expect(isSubscription('settingsOnChanged')).toBe(true);
    expect(isSubscription('sendTokens')).toBe(false);
    expect(isSubscription('openStore')).toBe(false);
  });

  it('installs onto window and leaves a real bridge alone', () => {
    installPlatformBridge();
    expect(typeof (window as any).lumen.wallet.sendTokens).toBe('function');
    expect(typeof (window as any).__lumenBridgeReport).toBe('function');

    const sentinel = { mine: true };
    (window as any).lumen = sentinel;
    installPlatformBridge();
    expect((window as any).lumen).toBe(sentinel);
  });
});
