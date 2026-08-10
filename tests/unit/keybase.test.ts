import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchKeybaseAvatarUrl } from '../../src/internal/services/keybase';

/**
 * Validator avatars.
 *
 * This decorates a list, so every failure is the same non-event: no avatar.
 * The tests are almost entirely about that - a validator without a picture, an
 * unreachable Keybase and a changed payload must all return `''` and never
 * reject, because the caller is inside a render path with nowhere to put an
 * error.
 */

// Declares the args so `spy.mock.calls[0][0]` is the requested URL and not an
// out-of-range index on an empty tuple.
function mockFetch(impl: () => unknown) {
  const spy = vi.fn(async (..._args: unknown[]) => impl() as never);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchKeybaseAvatarUrl', () => {
  it('returns the primary picture URL', async () => {
    mockFetch(() => ({
      json: async () => ({ them: [{ pictures: { primary: { url: 'https://k.io/a.jpg' } } }] }),
    }));
    await expect(fetchKeybaseAvatarUrl('abc123')).resolves.toBe('https://k.io/a.jpg');
  });

  it('asks for nothing when there is no id to look up', async () => {
    const spy = mockFetch(() => ({ json: async () => ({}) }));
    await expect(fetchKeybaseAvatarUrl('')).resolves.toBe('');
    await expect(fetchKeybaseAvatarUrl('   ')).resolves.toBe('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('escapes the id into the query string', async () => {
    const spy = mockFetch(() => ({ json: async () => ({}) }));
    await fetchKeybaseAvatarUrl('a b&c');
    expect(spy.mock.calls[0][0]).toContain('key_suffix=a%20b%26c');
  });

  it('returns nothing for a validator with no picture', async () => {
    mockFetch(() => ({ json: async () => ({ them: [{}] }) }));
    await expect(fetchKeybaseAvatarUrl('abc')).resolves.toBe('');
  });

  it('returns nothing when the payload is not the shape it expects', async () => {
    mockFetch(() => ({ json: async () => ({ them: 'not an array' }) }));
    await expect(fetchKeybaseAvatarUrl('abc')).resolves.toBe('');
  });

  it('never rejects when Keybase is unreachable', async () => {
    mockFetch(() => { throw new Error('ENOTFOUND'); });
    await expect(fetchKeybaseAvatarUrl('abc')).resolves.toBe('');
  });

  it('never rejects when the body is not JSON', async () => {
    mockFetch(() => ({ json: async () => { throw new SyntaxError('unexpected <'); } }));
    await expect(fetchKeybaseAvatarUrl('abc')).resolves.toBe('');
  });
});
