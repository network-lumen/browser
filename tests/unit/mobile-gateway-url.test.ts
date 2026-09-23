import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest } from '../../platform/mobile/impl/native-http';

/**
 * Subdomain gateway URLs, made reachable without a resolver.
 *
 * A site served from a path gateway loses every absolute asset - `/assets/app.css`
 * resolves against the gateway root and 404s - so the URL the page is given has
 * to be the subdomain form, `<cid>.ipfs.localhost`. Nothing resolves that name.
 *
 * Two different mechanisms make it work, and they have to agree:
 *  - inside the WebView, IpfsWebViewClient answers before any lookup;
 *  - everywhere else, including every gateway probe, this rewrite does.
 *
 * If they disagree, `probeUrl` reports the content missing and the resolver
 * gives up on a CID the WebView could have rendered.
 */
describe('reaching a subdomain gateway URL', () => {
  const calls: string[] = [];

  function captureFetch() {
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url));
      return new Response('ok', { status: 200 });
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites an ipfs subdomain host to the path form, keeping the port', async () => {
    captureFetch();
    await httpRequest('http://bafytest.ipfs.localhost:8088/index.html');
    expect(calls[0]).toBe('http://127.0.0.1:8088/ipfs/bafytest/index.html');
  });

  it('does the same for ipns', async () => {
    captureFetch();
    await httpRequest('http://k51example.ipns.localhost:8088/');
    expect(calls[0]).toBe('http://127.0.0.1:8088/ipns/k51example/');
  });

  it('carries the query string across', async () => {
    captureFetch();
    await httpRequest('http://bafytest.ipfs.localhost:8088/app.js?v=2');
    expect(calls[0]).toBe('http://127.0.0.1:8088/ipfs/bafytest/app.js?v=2');
  });

  it('leaves every other URL exactly as it was', async () => {
    captureFetch();
    await httpRequest('https://ipfs.io/ipfs/bafytest/index.html');
    await httpRequest('http://127.0.0.1:5001/api/v0/id');
    await httpRequest('https://lumen-api.linknode.org/cosmos/bank/v1beta1/balances/lmn1abc');

    expect(calls).toEqual([
      'https://ipfs.io/ipfs/bafytest/index.html',
      'http://127.0.0.1:5001/api/v0/id',
      'https://lumen-api.linknode.org/cosmos/bank/v1beta1/balances/lmn1abc'
    ]);
  });

  it('leaves a bare localhost alone - only a real subdomain is a gateway host', async () => {
    captureFetch();
    await httpRequest('http://localhost:8088/ipfs/bafytest/index.html');
    // ".ipfs.localhost" with nothing in front names no CID and is not ours.
    await httpRequest('http://.ipfs.localhost:8088/index.html');

    expect(calls[0]).toBe('http://localhost:8088/ipfs/bafytest/index.html');
    expect(calls[1]).toBe('http://.ipfs.localhost:8088/index.html');
  });

  it('survives a string that is not a URL at all', async () => {
    captureFetch();
    await httpRequest('not a url');
    expect(calls[0]).toBe('not a url');
  });
});
