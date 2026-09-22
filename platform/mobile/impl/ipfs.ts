/**
 * IPFS on Android, through a Kubo RPC API the user points us at.
 *
 * The desktop runs its own node: `electron/ipfs.cjs` spawns a kubo binary and
 * talks to it on 127.0.0.1:5001. A phone can host one too - kubo is Go, it
 * cross-compiles for Android, and gomobile-ipfs and Berty have both bound a Go
 * node into a mobile app. What this build does not do is SHIP one, which is a
 * narrower claim and the only one worth making here.
 *
 * So the address is a setting rather than an assumption: `ipfsApiBase`, on the
 * Network screen. These are the desktop's calls with one thing changed - the
 * base is whatever the user configured instead of a daemon we started. Point
 * it at a node you run and IPFS works today; leave it on 127.0.0.1 and it
 * works the day a node is embedded, with nothing in this file to change.
 *
 * TWO THINGS WILL BITE, and both are on the node rather than here:
 *
 *  - CORS. The page is served from https://localhost, so Kubo has to allow
 *    that origin in `API.HTTPHeaders.Access-Control-Allow-Origin` or the
 *    browser refuses the response before we ever see it. The error below names
 *    this, because "failed to fetch" sends people looking at their phone.
 *  - Exposure. An RPC API reachable from a handset is an RPC API reachable
 *    from elsewhere. That is the user's call to make, not ours, but it is
 *    worth their knowing they are making it.
 *
 * What stays unimplemented is what needs a local filesystem or a long-running
 * job: adding by path, directory walks, and the managed pin queue. Those are
 * not a missing base URL, they are a missing machine.
 */

import { getSettings } from './settings';

const trimSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * Loopback is noted, not refused.
 *
 * An earlier version rejected 127.0.0.1 outright, on the grounds that a phone
 * has no node of its own. That was wrong, and refusing it up front would have
 * blocked the very arrangement worth moving to: an embedded node answers on
 * exactly this address. The request is attempted either way now, and the
 * address only shapes the message when nothing answers.
 */
const isLoopback = (base: string) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])/i.test(base);

async function apiBase(): Promise<{ ok: true; base: string } | { ok: false; error: string }> {
  const base = trimSlash(String((await getSettings()).ipfsApiBase ?? ''));
  if (!base) return { ok: false, error: 'ipfs_api_not_configured' };
  return { ok: true, base };
}

/**
 * One Kubo RPC call. The API is POST-only, which is a common first surprise
 * when porting code that reached it another way.
 */
async function rpc(
  path: string,
  params: Record<string, string> = {},
  body?: FormData,
  timeoutMs = 20_000
): Promise<{ ok: boolean; status?: number; json?: unknown; text?: string; error?: string }> {
  const resolved = await apiBase();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const url = new URL(`${resolved.base}/api/v0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      body,
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text, error: `http_${res.status}` };

    // Several endpoints stream newline-delimited JSON; the last complete object
    // is the one that carries the result.
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0 && json === undefined; i--) {
        try {
          json = JSON.parse(lines[i]);
        } catch {
          // Keep walking back; a partial line is not an error in itself.
        }
      }
    }
    return { ok: true, status: res.status, json, text };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    if (aborted) return { ok: false, error: 'timeout' };
    // A cross-origin refusal reaches us as an opaque network failure, so the
    // likely cause is named rather than left as "failed to fetch" - and which
    // cause is likely depends on where we were pointed.
    return {
      ok: false,
      error: isLoopback(resolved.base)
        ? 'no_node_answered_on_device'
        : 'request_failed_check_cors_and_reachability'
    };
  } finally {
    // Cleared on every path: a pending abort timer outliving its request would
    // fire into nothing, and 120s uploads would leave a pile of them behind.
    clearTimeout(timer);
  }
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const IPFS_MEMBERS = {
  ipfsStatus: async () => {
    const resolved = await apiBase();
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const res = await rpc('id', { 'enc': 'json' }, undefined, 6_000);
    if (!res.ok) return { ok: false, error: res.error };
    const id = (res.json as any)?.ID ?? null;
    return { ok: true, id, apiBase: resolved.base };
  },

  ipfsStats: async () => {
    const res = await rpc('repo/stat', { 'size-only': 'true' });
    return res.ok
      ? { ok: true, stats: res.json ?? {} }
      : { ok: false, error: res.error };
  },

  ipfsAdd: async (data: unknown, filename?: string) => {
    const form = new FormData();
    const name = String(filename ?? 'file');
    // Copied into a fresh buffer rather than handed over directly: a
    // Uint8Array may be backed by a SharedArrayBuffer, which a Blob will not
    // take, and the copy is cheap next to the upload that follows.
    const part: BlobPart =
      data instanceof Uint8Array ? new Uint8Array(data).slice().buffer : String(data ?? '');
    const blob = data instanceof Blob ? data : new Blob([part]);
    form.append('file', blob, name);

    const res = await rpc('add', { 'cid-version': '1', pin: 'true' }, form, 120_000);
    if (!res.ok) return { ok: false, error: res.error };
    const cid = (res.json as any)?.Hash ?? null;
    return cid ? { ok: true, cid, name: (res.json as any)?.Name ?? name } : { ok: false, error: 'add_returned_no_cid' };
  },

  ipfsGet: async (cidOrPath: string) => {
    const res = await rpc('cat', { arg: String(cidOrPath ?? '') }, undefined, 120_000);
    return res.ok ? { ok: true, data: res.text ?? '' } : { ok: false, error: res.error };
  },

  ipfsLs: async (cidOrPath: string) => {
    const res = await rpc('ls', { arg: String(cidOrPath ?? '') });
    if (!res.ok) return { ok: false, error: res.error };
    const objects = asArray((res.json as any)?.Objects) as any[];
    return { ok: true, entries: asArray(objects[0]?.Links) };
  },

  ipfsPinAdd: async (cid: string) => {
    const res = await rpc('pin/add', { arg: String(cid ?? '') }, undefined, 120_000);
    return res.ok ? { ok: true, pins: asArray((res.json as any)?.Pins) } : { ok: false, error: res.error };
  },

  ipfsUnpin: async (cid: string) => {
    const res = await rpc('pin/rm', { arg: String(cid ?? '') });
    return res.ok ? { ok: true, pins: asArray((res.json as any)?.Pins) } : { ok: false, error: res.error };
  },

  ipfsPinList: async () => {
    const res = await rpc('pin/ls', { type: 'recursive' }, undefined, 60_000);
    if (!res.ok) return { ok: false, error: res.error };
    const keys = (res.json as any)?.Keys ?? {};
    return { ok: true, pins: Object.keys(keys).map((cid) => ({ cid, type: keys[cid]?.Type })) };
  },

  ipfsCidToBase32: async (cid: string) => {
    const res = await rpc('cid/base32', { arg: String(cid ?? '') });
    return res.ok
      ? { ok: true, cid: (res.json as any)?.Formatted ?? String(cid ?? '') }
      : { ok: false, error: res.error };
  },

  ipfsResolveIPNS: async (name: string) => {
    const res = await rpc('name/resolve', { arg: String(name ?? '') }, undefined, 60_000);
    return res.ok ? { ok: true, path: (res.json as any)?.Path ?? null } : { ok: false, error: res.error };
  },

  ipfsPublishToIPNS: async (input: { cid?: string; key?: string } | string) => {
    const cid = String(typeof input === 'string' ? input : (input?.cid ?? ''));
    if (!cid) return { ok: false, error: 'missing_cid' };
    const key = String((typeof input === 'object' && input?.key) || 'self');
    const res = await rpc('name/publish', { arg: cid, key }, undefined, 180_000);
    return res.ok
      ? { ok: true, name: (res.json as any)?.Name ?? null, value: (res.json as any)?.Value ?? null }
      : { ok: false, error: res.error };
  },

  ipfsKeyList: async () => {
    const res = await rpc('key/list', { l: 'true' });
    return res.ok ? { ok: true, keys: asArray((res.json as any)?.Keys) } : { ok: false, error: res.error };
  }
};
