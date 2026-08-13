import { describe, expect, it } from 'vitest';

/**
 * Telling page content apart from the app's own window.
 *
 * Used where a channel serves both and the site is entitled to less of the
 * answer - `profiles:getActive` returns the account a site is talking to, and
 * keeps the user's favourites map, avatar and internal fields for the app. So
 * the failure that matters is answering "not a webview" for something that is
 * one, and the check fails closed for anything it cannot identify.
 */

const require_ = (await import('node:module')).createRequire(import.meta.url);
const { isWebviewSender } = require_('../../electron/utils/sender.cjs');

const evt = (over: Record<string, unknown> = {}) => ({
  sender: { getType: () => 'window', isDestroyed: () => false, ...over },
});

describe('isWebviewSender', () => {
  it('recognises page content', () => {
    expect(isWebviewSender(evt({ getType: () => 'webview' }))).toBe(true);
  });

  it('does not mistake the app window, or a devtools view, for a page', () => {
    expect(isWebviewSender(evt({ getType: () => 'window' }))).toBe(false);
    expect(isWebviewSender(evt({ getType: () => 'browserView' }))).toBe(false);
  });

  it('reads the type case-insensitively, since it comes from Electron', () => {
    expect(isWebviewSender(evt({ getType: () => 'WebView' }))).toBe(true);
  });

  it('treats a sender it cannot identify as untrusted', () => {
    expect(isWebviewSender(evt({ getType: () => { throw new Error('gone'); } }))).toBe(true);
  });

  it('has nothing to answer about a sender that is gone', () => {
    // Not "untrusted": there is no call left to serve, and a destroyed sender
    // reaching a trimming branch would only hide a bug.
    expect(isWebviewSender(evt({ isDestroyed: () => true }))).toBe(false);
    expect(isWebviewSender({})).toBe(false);
    expect(isWebviewSender(undefined)).toBe(false);
  });
});
