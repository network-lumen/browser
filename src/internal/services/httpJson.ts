import { useInternalLumen } from '../../composables/useInternalLumen';

/**
 * Fetching JSON from a URL the app does not own - a chain's REST endpoint, the
 * Cosmos chain registry.
 *
 * Goes through the main process when the bridge is there and falls back to
 * `fetch`, because a renderer request to an arbitrary host is subject to CORS
 * and the main process is not.
 */

export function trimTrailingSlash(value: string): string {
  return String(value || '').replace(/\/+$/, '');
}

export function buildAbsoluteUrl(base: string, path: string): string {
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
  return `${trimTrailingSlash(base)}${normalizedPath}`;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Whether a failure is worth trying again. Matched on the message because the
 * two paths below throw different shapes - one from the bridge, one from
 * `fetch` - and neither carries a code worth branching on.
 */
export function isTransientFetchError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('enotfound') ||
    message.includes('socket')
  );
}

async function fetchAbsoluteJsonOnce(url: string, timeout: number): Promise<any> {
  const httpGet = useInternalLumen()?.http?.get || useInternalLumen()?.httpGet;
  if (typeof httpGet === 'function') {
    const res = await httpGet(String(url || ''), {
      timeout,
      headers: { accept: 'application/json' }
    });

    let json: any = res?.json ?? null;
    if (json == null) {
      const text = String(res?.text || '');
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
    }

    if (!res || res.ok === false) {
      const detail =
        json?.message ||
        json?.error ||
        String(res?.text || '').trim() ||
        String(res?.error || `HTTP ${res?.status || 0}`);
      throw new Error(String(detail));
    }

    return json;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    const text = await response.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail =
        json?.message ||
        json?.error ||
        (typeof text === 'string' && text.trim() ? text.trim() : '') ||
        `HTTP ${response.status}`;
      throw new Error(String(detail));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Three attempts, backing off, but only for failures worth repeating. */
export async function fetchAbsoluteJson(url: string, timeout = 15000): Promise<any> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchAbsoluteJsonOnce(url, timeout);
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || !isTransientFetchError(error)) {
        throw error;
      }
      await waitMs(350 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch JSON.');
}
