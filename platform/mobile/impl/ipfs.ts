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

import { httpRequest, parseJsonBody } from './native-http';
import { createPinJobMembers } from './pin-jobs';
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

  // A multipart upload keeps using fetch: the native bridge carries a string
  // body, not a FormData, and an add goes to the node on this device anyway -
  // which is where CORS is answered by the config the plugin writes.
  if (body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), { method: 'POST', body, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, text, error: `http_${res.status}` };
      return { ok: true, status: res.status, json: parseJsonBody(text), text };
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return { ok: false, error: aborted ? 'timeout' : 'upload_failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  const res = await httpRequest(url.toString(), { method: 'POST', timeoutMs });
  if (!res.ok) {
    if (res.status > 0) return { ok: false, status: res.status, text: res.text, error: `http_${res.status}` };
    if (res.error === 'timeout') return { ok: false, error: 'timeout' };
    return {
      ok: false,
      error: isLoopback(resolved.base)
        ? 'no_node_answered_on_device'
        : 'request_failed_check_cors_and_reachability'
    };
  }
  return { ok: true, status: res.status, json: parseJsonBody(res.text), text: res.text };
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const IPFS_MEMBERS = {
  /**
   * Whether a node is answering - and, on loopback, a nudge if one is not.
   *
   * Drive polls this to colour its indicator, and the embedded daemon takes a
   * few seconds to come up. Without the nudge the first check of a session
   * lands before the node does, paints the indicator red and leaves it there
   * until something else asks again. Starting is idempotent and shared, so a
   * check that arrives mid-boot waits for that boot rather than racing it.
   */
  ipfsStatus: async () => {
    const resolved = await apiBase();
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const ask = () => rpc('id', { enc: 'json' }, undefined, 6_000);
    let res = await ask();

    if (!res.ok && isLoopback(resolved.base)) {
      const { startEmbeddedNode } = await import('./kubo');
      const started = await startEmbeddedNode();
      if (started.ok) res = await ask();
    }

    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, id: (res.json as any)?.ID ?? null, apiBase: resolved.base };
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

  /**
   * Normalised the way `electron/ipfs.cjs` normalises it, and for a reason:
   * every page reads `name`, `cid`, `size` and `type`, while kubo answers
   * `Name`, `Hash`, `Size` and a numeric `Type`. Passing its links through
   * untouched dropped every row at the filter that checks for a name, so
   * `lumen://ipfs/<cid>` listed an empty folder on Android for content that
   * was sitting right there.
   */
  ipfsLs: async (cidOrPath: string) => {
    const res = await rpc('ls', { arg: String(cidOrPath ?? ''), 'resolve-type': 'true' });
    if (!res.ok) return { ok: false, error: res.error };

    const body = res.json as any;
    const objects = asArray(body?.Objects) as any[];
    const links = objects.length ? asArray(objects[0]?.Links) : asArray(body?.Links);

    return {
      ok: true,
      entries: (links as any[]).map((link) => ({
        cid: String(link?.Hash ?? ''),
        name: String(link?.Name ?? ''),
        size: typeof link?.Size === 'number' ? link.Size : null,
        // 1 is a directory, 2 a file; anything else is not something to guess at.
        type: link?.Type === 1 ? 'dir' : link?.Type === 2 ? 'file' : 'unknown'
      }))
    };
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
  },

  /**
   * "Save to Drive" and everything that watches it.
   *
   * The pages start a managed job and then follow it, which used to answer
   * `unsupported_on_mobile` - the button existed and did nothing. The job
   * manager lives in pin-jobs.ts; all that is supplied here is how to pin and
   * how to take a pin back.
   *
   * The timeout is long on purpose: this is a whole DAG being fetched from
   * whoever has it, and a video directory is not a few seconds of work.
   */
  ...createPinJobMembers({
    pin: async (cid: string) => {
      const res = await rpc('pin/add', { arg: cid, recursive: 'true' }, undefined, 1_800_000);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    unpin: (cid: string) => rpc('pin/rm', { arg: cid })
  })
};
