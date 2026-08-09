import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

/**
 * The embedded gateway's front door.
 *
 * Everything here decides whether a request that reached the local HTTP server
 * is allowed to spend the user's pinning quota. It had no tests.
 */
function loadAuth() {
  // Fresh module each time: setConfig writes module-level state, and a test
  // that inherits the previous one proves nothing about a cold start.
  delete require_.cache[require_.resolve('../../electron/gateways/server/auth.cjs')];
  return require_('../../electron/gateways/server/auth.cjs');
}

describe('API key check', () => {
  let auth: any;
  beforeEach(() => {
    auth = loadAuth();
  });

  it('accepts the configured key and nothing else', () => {
    auth.setConfig({ apiKey: 'secret-key' });
    expect(auth.verifyApiKey('secret-key')).toBe(true);
    expect(auth.verifyApiKey('secret-ke')).toBe(false);
    expect(auth.verifyApiKey('')).toBe(false);
  });

  it('refuses everything before a key is configured', () => {
    // The check is an equality test against config.apiKey. Before setConfig
    // runs - or if it runs without a key - that value is undefined, and an
    // undefined key would then match. Nothing may be accepted in that state.
    expect(auth.verifyApiKey(undefined)).toBe(false);
    expect(auth.verifyApiKey(null)).toBe(false);
    expect(auth.verifyApiKey('anything')).toBe(false);
  });

  it('refuses when the config carries no key', () => {
    auth.setConfig({});
    expect(auth.verifyApiKey(undefined)).toBe(false);
    expect(auth.verifyApiKey('')).toBe(false);
  });
});

describe('timestamp window', () => {
  let auth: any;
  beforeEach(() => {
    auth = loadAuth();
    auth.setConfig({ auth: { timestampTolerance: 300000 } });
  });

  it('accepts a timestamp inside the tolerance, either side of now', () => {
    const now = Date.now();
    expect(auth.validateTimestamp(now)).toBe(true);
    expect(auth.validateTimestamp(now - 299_000)).toBe(true);
    // Ahead of now too: clocks drift both ways, and the check is on the
    // absolute difference.
    expect(auth.validateTimestamp(now + 299_000)).toBe(true);
  });

  it('rejects one outside it', () => {
    const now = Date.now();
    expect(auth.validateTimestamp(now - 301_000)).toBe(false);
    expect(auth.validateTimestamp(now + 301_000)).toBe(false);
  });

  it('rejects a timestamp that is not a number', () => {
    // A replayed request with a junk timestamp must not pass by arithmetic
    // accident.
    expect(auth.validateTimestamp(undefined as unknown as number)).toBe(false);
    expect(auth.validateTimestamp('now' as unknown as number)).toBe(false);
    expect(auth.validateTimestamp(NaN)).toBe(false);
  });

  it('falls back to five minutes when no tolerance is configured', () => {
    const fresh = loadAuth();
    fresh.setConfig({});
    const now = Date.now();
    expect(fresh.validateTimestamp(now - 299_000)).toBe(true);
    expect(fresh.validateTimestamp(now - 301_000)).toBe(false);
  });
});
