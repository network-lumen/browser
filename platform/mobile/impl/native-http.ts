/**
 * HTTP that is not the page's HTTP.
 *
 * Every request the desktop makes on the app's behalf - probing a gateway,
 * reading the chain, driving the IPFS API - happens in the main process, which
 * has no origin and therefore no same-origin policy. Ported naively to `fetch`
 * those calls become the page's requests, and the page has an origin:
 * https://localhost. From there a HEAD to ipfs.io is a cross-origin request,
 * and the browser discards the response unless the server opted in.
 *
 * That is what broke lumen:// addresses on Android. The domain resolved fine -
 * the chain answered with the right CID - and then `probeUrl` asked whether any
 * gateway had the content. Local, whitelisted and public gateways were all
 * probed through `httpHead`, every probe was refused before it was sent, and
 * the resolver concluded the content did not exist anywhere.
 *
 * `CapacitorHttp` performs the request in the native layer instead, where there
 * is no origin to violate. It is the closest thing this target has to the main
 * process, and using it everywhere removes a whole class of failure rather than
 * one instance of it - including, incidentally, the CORS configuration the
 * embedded kubo node needs, which now only matters for anything still going
 * through `fetch`.
 */

import type { NativeResponse } from '../../../src/types/platformBridge';

let nativeAvailable: boolean | null = null;

/**
 * Whether the native HTTP plugin is usable, which it is only on a device.
 *
 * Cached rather than asked each time: it cannot change during a run, and the
 * answer costs a dynamic import.
 */
async function useNative(): Promise<boolean> {
  if (nativeAvailable !== null) return nativeAvailable;
  try {
    const { Capacitor } = await import('@capacitor/core');
    nativeAvailable = Capacitor.getPlatform() === 'android';
  } catch {
    nativeAvailable = false;
  }
  return nativeAvailable;
}

/**
 * Rewrites a subdomain-gateway URL into the path form before it is requested.
 *
 * The WebView reaches `<cid>.ipfs.localhost` through the interceptor in
 * IpfsWebViewClient, which answers before any lookup. Java's resolver has no
 * such shortcut, so every request made HERE - a gateway probe above all - would
 * fail on the name.
 *
 * Both roads lead to the same bytes: the interceptor proxies to the path form,
 * and so does this. The page keeps the origin it needs for its absolute assets,
 * and `probeUrl` gets an answer instead of a DNS error.
 */
function toReachableUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    for (const [suffix, namespace] of [
      ['.ipfs.localhost', 'ipfs'],
      ['.ipns.localhost', 'ipns']
    ] as const) {
      if (!host.endsWith(suffix)) continue;
      const key = host.slice(0, -suffix.length);
      if (!key) continue;
      const port = parsed.port ? `:${parsed.port}` : '';
      return `${parsed.protocol}//127.0.0.1${port}/${namespace}/${key}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

function lowercaseHeaders(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k.toLowerCase()] = String(v ?? '');
    }
  }
  return out;
}

async function viaNative(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number
): Promise<NativeResponse> {
  const { CapacitorHttp } = await import('@capacitor/core');
  const response = await CapacitorHttp.request({
    url,
    method,
    headers,
    data: body,
    readTimeout: timeoutMs,
    connectTimeout: timeoutMs,
    // Text, always: the callers here parse JSON themselves, and letting the
    // plugin guess turns a JSON body into an object and a non-JSON one into a
    // surprise.
    responseType: 'text'
  });

  const status = Number(response.status ?? 0);
  const data = response.data;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: typeof data === 'string' ? data : data == null ? '' : JSON.stringify(data),
    headers: lowercaseHeaders(response.headers)
  };
}

async function viaFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number
): Promise<NativeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
    return {
      ok: res.ok,
      status: res.status,
      text: method === 'HEAD' ? '' : await res.text(),
      headers: out
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One request, native where that is possible and `fetch` otherwise.
 *
 * Never throws: a transport failure comes back as `ok: false` with a status of
 * 0, because every caller here is deciding whether something is reachable
 * rather than handling an exception.
 */
export async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {}
): Promise<NativeResponse> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = options.headers ?? {};
  url = toReachableUrl(url);
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 1_000), 180_000);

  if (await useNative()) {
    try {
      return await viaNative(url, method, headers, options.body, timeoutMs);
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e);

      // A request that failed is NOT a plugin that is missing, and an earlier
      // version conflated them: one unreachable host disabled native HTTP for
      // the session, every later call fell back to fetch, and fetch is exactly
      // what cannot reach a gateway cross-origin. The symptom was a bridge
      // reporting "Failed to fetch" while the native layer was working fine.
      //
      // So a transport error is reported as one, and only a plugin that says
      // it is unimplemented turns the fallback on.
      if (/unimplemented|not implemented/i.test(message)) {
        nativeAvailable = false;
        console.warn('[platform/mobile] native HTTP unavailable, falling back to fetch:', message);
      } else {
        return { ok: false, status: 0, text: '', headers: {}, error: message };
      }
    }
  }

  try {
    return await viaFetch(url, method, headers, options.body, timeoutMs);
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      text: '',
      headers: {},
      error: aborted ? 'timeout' : String(e instanceof Error ? e.message : e)
    };
  }
}

/** Parses a body as JSON, tolerating the newline-delimited streams Kubo sends. */
export function parseJsonBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // The last complete object in a stream is the one carrying the result.
    const lines = text.trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // Keep walking back; a partial line is not an error in itself.
      }
    }
    return undefined;
  }
}
