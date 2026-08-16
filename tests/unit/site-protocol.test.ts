import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The `lumen://` scheme, and the registry that decides what it will answer for.
 *
 * The registry is an allowlist, and that is the whole security property: only
 * a host SitePage registered gets served, so the app's own internal addresses
 * (lumen://home, lumen://ipfs/<cid>) can never be answered here as if they were
 * somebody's site, and a host nobody registered gets a 404 rather than a proxy
 * to whatever the URL happens to say.
 */

type Protocol = {
  registerSiteHost: (host: unknown, target: unknown) => { ok: boolean; error?: string };
  getSiteHostStatus: () => { ok: boolean; scheme: string; sites: number };
  installSiteProtocol: (ses: unknown) => boolean;
};

let handler: ((req: any) => Promise<Response>) | null = null;
let fetched: string[] = [];
let mod: Protocol;

function load() {
  handler = null;
  fetched = [];
  const stub = stubElectron({
    protocol: { registerSchemesAsPrivileged: () => {} },
    net: {
      fetch: vi.fn(async (url: string) => {
        fetched.push(url);
        return new Response('served', { status: 200 });
      })
    }
  });
  mod = stub.load<Protocol>('sites/protocol.cjs');
  mod.installSiteProtocol({
    protocol: {
      handle: (_scheme: string, fn: (req: any) => Promise<Response>) => {
        handler = fn;
      }
    }
  });
  return mod;
}

const request = (url: string) => handler!({ url, method: 'GET', headers: {}, body: null });

beforeEach(() => {
  load();
});

describe('registering a site host', () => {
  it('accepts an ipfs or ipns target', () => {
    expect(mod.registerSiteHost('mysite.lmn', { proto: 'ipfs', id: 'bafyabc' }).ok).toBe(true);
    expect(mod.registerSiteHost('other.lmn', { proto: 'ipns', id: 'k51xyz' }).ok).toBe(true);
    expect(mod.getSiteHostStatus().sites).toBe(2);
  });

  it('refuses a target that is neither ipfs nor ipns', () => {
    for (const proto of ['http', 'file', '', 'IPFSX']) {
      expect(mod.registerSiteHost('x.lmn', { proto, id: 'abc' }), proto).toMatchObject({
        ok: false,
        error: 'invalid_site_host'
      });
    }
  });

  it('refuses a host that is not a plain hostname', () => {
    // Anything that could carry a path, a port or a scheme has no business
    // becoming an origin the protocol answers for.
    for (const host of ['', '   ', 'a/b', 'a:8080', 'http://a.lmn', 'a b.lmn', 'é.lmn']) {
      expect(mod.registerSiteHost(host, { proto: 'ipfs', id: 'bafy' }), JSON.stringify(host))
        .toMatchObject({ ok: false });
    }
  });

  it('refuses a target with no id', () => {
    expect(mod.registerSiteHost('x.lmn', { proto: 'ipfs', id: '' }).ok).toBe(false);
    expect(mod.registerSiteHost('x.lmn', null).ok).toBe(false);
  });

  it('matches the host case-insensitively, the way an origin does', () => {
    mod.registerSiteHost('MySite.LMN', { proto: 'ipfs', id: 'bafyabc' });
    expect(mod.getSiteHostStatus().sites).toBe(1);
  });
});

describe('answering a lumen:// request', () => {
  it('proxies a registered host to the gateway', async () => {
    mod.registerSiteHost('mysite.lmn', { proto: 'ipfs', id: 'bafyabc' });
    const res = await request('lumen://mysite.lmn/index.html?v=1');
    expect(res.status).toBe(200);
    expect(fetched[0]).toContain('/ipfs/bafyabc');
    expect(fetched[0]).toContain('/index.html?v=1');
  });

  it('answers 404 for a host nobody registered', async () => {
    expect((await request('lumen://unknown.lmn/')).status).toBe(404);
  });

  it('answers 404 for the app own internal addresses', async () => {
    // These are renderer routes. Serving them here would turn an internal page
    // into something proxied from a gateway.
    for (const url of ['lumen://home', 'lumen://newtab/', 'lumen://ipfs/bafyabc/']) {
      expect((await request(url)).status, url).toBe(404);
    }
    expect(fetched).toEqual([]);
  });

  it('answers 400 for a url that will not parse', async () => {
    expect((await request('not a url')).status).toBe(400);
  });
});

describe('installing on a session', () => {
  it('says no when the session cannot register a handler', () => {
    expect(mod.installSiteProtocol(null)).toBe(false);
    expect(mod.installSiteProtocol({})).toBe(false);
    expect(mod.installSiteProtocol({ protocol: {} })).toBe(false);
  });
});
