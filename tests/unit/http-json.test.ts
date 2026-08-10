import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAbsoluteUrl,
  fetchAbsoluteJson,
  isTransientFetchError,
  trimTrailingSlash,
} from '../../src/internal/services/httpJson';

/**
 * Fetching JSON from a host the app does not own.
 *
 * Two things here are worth protecting. The request prefers the main process
 * because a renderer call to an arbitrary host is subject to CORS and the main
 * process is not - so a change that quietly stopped using the bridge would
 * break the chain registry only in the packaged app. And the retry has to fire
 * for a dropped connection but *not* for an HTTP 404, or a missing document
 * costs three round trips and a second of backoff every time it is asked for.
 */

function bridge(get: unknown) {
  (window as any).lumen = { http: { get } };
}

afterEach(() => {
  delete (window as any).lumen;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('URL building', () => {
  it('trims trailing slashes', () => {
    expect(trimTrailingSlash('https://x.test/')).toBe('https://x.test');
    expect(trimTrailingSlash('https://x.test///')).toBe('https://x.test');
    expect(trimTrailingSlash('https://x.test')).toBe('https://x.test');
    expect(trimTrailingSlash('')).toBe('');
  });

  it('joins a base and a path without doubling or dropping the slash', () => {
    expect(buildAbsoluteUrl('https://x.test', '/a/b')).toBe('https://x.test/a/b');
    expect(buildAbsoluteUrl('https://x.test/', '/a/b')).toBe('https://x.test/a/b');
    expect(buildAbsoluteUrl('https://x.test/', 'a/b')).toBe('https://x.test/a/b');
  });

  it('produces a usable URL even for an empty path', () => {
    expect(buildAbsoluteUrl('https://x.test', '')).toBe('https://x.test/');
  });
});

describe('isTransientFetchError', () => {
  it('recognises the failures worth repeating', () => {
    for (const message of [
      'Failed to fetch', 'fetch failed', 'network error', 'Timeout of 15000ms',
      'The operation was aborted', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND x.test',
      'socket hang up',
    ]) {
      expect(isTransientFetchError(new Error(message))).toBe(true);
    }
  });

  it('does not repeat an answer the server actually gave', () => {
    // A 404 is a real answer. Retrying it costs three round trips and a second
    // of backoff for a document that will still be missing.
    expect(isTransientFetchError(new Error('HTTP 404'))).toBe(false);
    expect(isTransientFetchError(new Error('Not Found'))).toBe(false);
    expect(isTransientFetchError(new Error('invalid json'))).toBe(false);
  });

  it('says no rather than throwing for a non-error', () => {
    expect(isTransientFetchError(null)).toBe(false);
    expect(isTransientFetchError(undefined)).toBe(false);
    expect(isTransientFetchError('')).toBe(false);
    expect(isTransientFetchError({})).toBe(false);
  });

  it('reads a bare thrown string too', () => {
    expect(isTransientFetchError('network unreachable')).toBe(true);
  });
});

describe('fetchAbsoluteJson through the bridge', () => {
  it('prefers the main process, which is not subject to CORS', async () => {
    const get = vi.fn(async () => ({ ok: true, json: { hello: 'world' } }));
    bridge(get);
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);

    await expect(fetchAbsoluteJson('https://x.test/a')).resolves.toEqual({ hello: 'world' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('asks for JSON and passes the timeout along', async () => {
    // Args declared so the call tuple below is indexable rather than empty.
    const get = vi.fn(async (..._args: unknown[]) => ({ ok: true, json: {} }));
    bridge(get);
    await fetchAbsoluteJson('https://x.test/a', 1234);
    expect(get.mock.calls[0][1]).toMatchObject({
      timeout: 1234,
      headers: { accept: 'application/json' },
    });
  });

  it('parses the body itself when the bridge only returns text', async () => {
    bridge(async () => ({ ok: true, text: '{"parsed":true}' }));
    await expect(fetchAbsoluteJson('https://x.test/a')).resolves.toEqual({ parsed: true });
  });

  it('throws with the server’s own wording when the reply is not ok', async () => {
    bridge(async () => ({ ok: false, status: 404, json: { message: 'chain not found' } }));
    await expect(fetchAbsoluteJson('https://x.test/a')).rejects.toThrow('chain not found');
  });

  it('falls back to the status when there is no wording to use', async () => {
    bridge(async () => ({ ok: false, status: 503 }));
    await expect(fetchAbsoluteJson('https://x.test/a')).rejects.toThrow('HTTP 503');
  });
});

describe('fetchAbsoluteJson without a bridge', () => {
  it('uses fetch, which is what the dev server does', async () => {
    delete (window as any).lumen;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, text: async () => '{"via":"fetch"}',
    })));
    await expect(fetchAbsoluteJson('https://x.test/a')).resolves.toEqual({ via: 'fetch' });
  });

  it('throws the body text for a failed response', async () => {
    delete (window as any).lumen;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 500, text: async () => 'upstream exploded',
    })));
    await expect(fetchAbsoluteJson('https://x.test/a')).rejects.toThrow('upstream exploded');
  });

  it('gives null for an empty 200, rather than throwing on the parse', async () => {
    delete (window as any).lumen;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '' })));
    await expect(fetchAbsoluteJson('https://x.test/a')).resolves.toBeNull();
  });
});

describe('the retry', () => {
  it('tries three times for a dropped connection, then gives up', async () => {
    vi.useFakeTimers();
    const get = vi.fn(async () => { throw new Error('ECONNRESET'); });
    bridge(get);

    const promise = fetchAbsoluteJson('https://x.test/a');
    const assertion = expect(promise).rejects.toThrow('ECONNRESET');
    await vi.runAllTimersAsync();
    await assertion;
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('stops as soon as one attempt works', async () => {
    vi.useFakeTimers();
    let calls = 0;
    bridge(async () => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return { ok: true, json: { ok: 1 } };
    });

    const promise = fetchAbsoluteJson('https://x.test/a');
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: 1 });
    expect(calls).toBe(2);
  });

  it('does not retry an answer the server gave', async () => {
    const get = vi.fn(async () => ({ ok: false, status: 404, json: { error: 'no such chain' } }));
    bridge(get);
    await expect(fetchAbsoluteJson('https://x.test/a')).rejects.toThrow('no such chain');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
