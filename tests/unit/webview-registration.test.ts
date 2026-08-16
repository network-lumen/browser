import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getWebviewWebContentsId,
  registerWebviewFindTarget,
  retryWebviewRegistration,
} from '../../src/internal/services/webviewRegistration';

/**
 * Waiting for a `<webview>` to be ready enough to point the find bar at.
 *
 * `getWebContentsId()` throws until the guest has attached, which happens some
 * frames after `dom-ready` - so every failure mode here is "not yet" rather
 * than "broken", and none of it may throw into a component. The retry must
 * also stop: it is recursive, and a webview that never attaches would
 * otherwise poll for the life of the tab.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe('getWebviewWebContentsId', () => {
  it('reads the id when the guest has attached', () => {
    expect(getWebviewWebContentsId({ getWebContentsId: () => 42 })).toBe(42);
  });

  it('gives null while the guest has not attached yet', () => {
    // This throws in Electron rather than returning anything.
    expect(getWebviewWebContentsId({ getWebContentsId() { throw new Error('not attached'); } })).toBeNull();
  });

  it('gives null for an element that is gone or was never a webview', () => {
    expect(getWebviewWebContentsId(null)).toBeNull();
    expect(getWebviewWebContentsId(undefined)).toBeNull();
    expect(getWebviewWebContentsId({})).toBeNull();
    expect(getWebviewWebContentsId({ getWebContentsId: 'not a function' })).toBeNull();
  });

  it('gives null for an id that is not a usable number', () => {
    expect(getWebviewWebContentsId({ getWebContentsId: () => NaN })).toBeNull();
    expect(getWebviewWebContentsId({ getWebContentsId: () => '42' })).toBeNull();
    expect(getWebviewWebContentsId({ getWebContentsId: () => undefined })).toBeNull();
  });

  it('keeps a zero, which is a valid id', () => {
    expect(getWebviewWebContentsId({ getWebContentsId: () => 0 })).toBe(0);
  });
});

describe('registerWebviewFindTarget', () => {
  it('registers the id under the tab', () => {
    const register = vi.fn();
    expect(registerWebviewFindTarget(register, 'tab-1', 7)).toBe(7);
    expect(register).toHaveBeenCalledWith('tab-1', 7);
  });

  it('registers null on purpose, to clear a tab’s target', () => {
    // Leaving the previous page's target in place would have the find bar
    // searching a page the user has navigated away from.
    const register = vi.fn();
    expect(registerWebviewFindTarget(register, 'tab-1', null)).toBeNull();
    expect(register).toHaveBeenCalledWith('tab-1', null);
  });

  it('does nothing without a tab id or without a provider', () => {
    const register = vi.fn();
    expect(registerWebviewFindTarget(register, '', 7)).toBeNull();
    expect(registerWebviewFindTarget(register, '   ', 7)).toBeNull();
    expect(registerWebviewFindTarget(null, 'tab-1', 7)).toBeNull();
    expect(registerWebviewFindTarget(undefined, 'tab-1', 7)).toBeNull();
    expect(register).not.toHaveBeenCalled();
  });

  it('reports the id even when the injected provider throws', () => {
    // The provider is injected; a failing one must not break the page.
    const register = vi.fn(() => { throw new Error('provider gone'); });
    expect(registerWebviewFindTarget(register, 'tab-1', 7)).toBe(7);
  });
});

describe('retryWebviewRegistration', () => {
  it('stops as soon as the registration succeeds', () => {
    vi.useFakeTimers();
    const register = vi.fn(() => 5);
    retryWebviewRegistration(register);
    vi.runAllTimers();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('keeps trying until the guest attaches', () => {
    vi.useFakeTimers();
    let calls = 0;
    const register = vi.fn(() => (++calls < 4 ? null : 9));
    retryWebviewRegistration(register);
    vi.runAllTimers();
    expect(register).toHaveBeenCalledTimes(4);
  });

  it('gives up after its budget, so a dead webview is not polled forever', () => {
    vi.useFakeTimers();
    const register = vi.fn(() => null);
    retryWebviewRegistration(register, undefined, 3);
    vi.runAllTimers();
    // The first call, then one per remaining attempt.
    expect(register).toHaveBeenCalledTimes(4);
  });

  it('does not retry at all when told not to', () => {
    vi.useFakeTimers();
    const register = vi.fn(() => null);
    retryWebviewRegistration(register, undefined, 0);
    vi.runAllTimers();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('stops early when the page’s own guard says to', () => {
    // A tab closed mid-poll, or navigated elsewhere.
    vi.useFakeTimers();
    let calls = 0;
    const register = vi.fn(() => null);
    retryWebviewRegistration(register, () => ++calls < 2);
    vi.runAllTimers();
    expect(register.mock.calls.length).toBeLessThan(5);
  });

  it('treats a registered id of zero as success', () => {
    vi.useFakeTimers();
    const register = vi.fn(() => 0);
    retryWebviewRegistration(register);
    vi.runAllTimers();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
